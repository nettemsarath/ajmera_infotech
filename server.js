const express = require('express')
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const dotenv = require('dotenv')
const passport = require('passport');

const {prismaClient, USERSROLES} = require("./db/prisma")
const {ErrorHandler, CustomError} = require("./utils/errorhandler")
const { redisClient, setRedisCacheData, getRedisCacheData, removeCacheData} = require("./redis")
const { hashString, compareHashedString } = require("./utils/hashpassword")
const {signJWT} = require("./utils/signJWT")
const configurePassport = require('./config/passport');
const authorizeAction = require("./middleware/authorization")

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(passport.initialize());
configurePassport(passport);

// Swagger definition
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0', // OpenAPI version
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API documentation',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: ['./server.js'], // Point to the server file for documentation
};

// Initialize swagger-jsdoc
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
/**
* @swagger
* openapi: 3.0.0
* info:
*   title: User API
*   version: 1.0.0
* components:
*   securitySchemes:
*     Bearer:
*       type: http
*       scheme: bearer
*       bearerFormat: JWT
*       description: >-
*         Enter the token e.g. "abcde12345".
*/

/**
 * @swagger
 *   /:
 *     get:
 *       summary: Hello world
 *       security:
 *         - Bearer: []
 *       responses:
 *         200:
 *           description: Hello world response
 */

app.get('/', (req, res) => {
  console.log("header aree", req.headers)
  res.send('Hello World!')
})

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Admin user Sign up
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */
app.post("/signup", async(req, res, next)=>{
  const {name, email, password} = req.body;
  try {
    const {newUser} = await prismaClient.$transaction(async (prisma)=>{
      let roleEntry = await prisma.role.findUnique({
        where: {
          role: USERSROLES.ADMIN,
        },
      });
      if (!roleEntry) {
        // Create role if it doesn't exist
        roleEntry = await prisma.role.create({
          data: {
            role: USERSROLES.ADMIN,
          },
        });
      };
      const hashedPassword = await hashString(password)
      // Create user with role
      const newUser = await prisma.user.create({
        data: {
          name: name,
          email: email,
          password: hashedPassword,
          roleId: roleEntry.id,
        },
      });
      return { roleEntry, newUser }
    })
    delete newUser.password;
    res.status(200).json({
      success: true,
      message: "User Created Successfully",
      user: newUser
    })
  } catch (error) {
    next(error)
  }
})

/**
 * @swagger
 * /login:
 *   post:
 *     summary: ADMIN or CUSTOMER Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */

app.post("/login", async(req, res, next)=>{
  try {
    const {email, password}= req.body;
    const user = await prismaClient.user.findUnique({
      where: {
        email: email
      }
    })
    if( !user || !(await compareHashedString(password, user.password)) ){
      return next(new CustomError('Invalid credentials', 401));
    }
    delete user.password
    const {token, expiresIn} = signJWT({ id: user.id })
    res.status(200).json({
      status: "Success",
      message: "Login successful",
      token,
      user,
      expiresIn,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * @swagger
 * /user:
 *   get:
 *     summary: Get users by query fields
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: false
 *         description: Name of the user to filter by
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         required: false
 *         description: Role of the user to filter by (either ADMIN or CUSTOMER)
 *         schema:
 *           type: string
 *           enum: [ADMIN, CUSTOMER]
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: The user's ID
 *                   name:
 *                     type: string
 *                     description: The user's name
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: The user's email
 *                   roleId:
 *                     type: integer
 *                     description: The ID associated with the user's role
 *                   role:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The role's ID
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, CUSTOMER]
 *                         description: The user's role
 *       404:
 *         description: Users not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */

app.get("/user", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
  const {name, role} = req.query
  try {
    let query = {};
    let cacheKey = name || role || "";
    const cachedUsers = await getRedisCacheData(cacheKey);
    if(cachedUsers){
      return res.status(200).json(cachedUsers)
    }
    if(role){
      // get roleId based on user role
      const rollEntry = await prismaClient.role.findUnique({
        where: {
          role: role
        }
      })
      query = {
        where: {
          roleId: rollEntry.id
        }
      }
    }
    if(name){
      query = {
        where: {
          name: name
        }
      }
    }
    const allUsers = await prismaClient.user.findMany(query)
    await setRedisCacheData(cacheKey, allUsers)
    res.status(200).json({
      allUsers
    })
  } catch (error) {
    next(error)
  }
})

/**
 * @swagger
 * /user/{id}:
 *   get:
 *     summary: Get a user by ID
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to retrieve
 *         schema:
 *           type: integer  # Changed from string to integer
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The user's ID
 *                 name:
 *                   type: string
 *                   description: The user's name
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: The user's email
 *                 roleId:
 *                   type: integer
 *                   description: The ID associated with the user's role
 *                 role:
 *                   type: object  # Updated to an object type
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: The role's ID
 *                     role:
 *                       type: string
 *                       enum: [ADMIN, CUSTOMER]
 *                       description: The user's role
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */

app.get("/user/:id", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
  const {id} = req.params
  const userId = parseInt(id)
  try {
    const cacheUser = await getRedisCacheData(JSON.stringify(userId));
    if(cacheUser){
      return res.status(200).json(cacheUser)
    }
    const user = await prismaClient.user.findUnique({
      where: {
        id: userId
      },
      // include: {
      //   role: true
      // },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        role: {
          select: {
            id: true,
            role: true,
          },
        },
      }
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await setRedisCacheData(JSON.stringify(userId), user)
    res.status(200).json(user);
  } catch (error) {
    next(error)
  }
})

/**
 * @swagger
 * /user:
 *   post:
 *     summary: Create a new user
 *     security:
 *       - Bearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the user
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email of the user
 *               password:
 *                 type: string
 *                 format: password
 *                 description: The password for the user
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CUSTOMER]
 *                 description: The role of the user (either ADMIN or CUSTOMER)
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *     responses:
 *       201:
 *         description: User created successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */

app.post("/user", passport.authenticate('jwt', { session: false }), authorizeAction("create", "user"), async(req, res, next)=>{
  const {name, email, password, role} = req.body
  try {
    const {newUser} = await prismaClient.$transaction(async (prisma)=>{
      let roleEntry = await prisma.role.findUnique({
        where: {
          role: role,
        },
      });
      if (!roleEntry) {
        // Create role if it doesn't exist
        roleEntry = await prisma.role.create({
          data: {
            role: role,
          },
        });
      };
      const hashedPassword = await hashString(password)
      // Create user with role
      const newUser = await prisma.user.create({
        data: {
          name: name,
          email: email,
          password: hashedPassword,
          roleId: roleEntry.id,
        },
      });
      return { roleEntry, newUser }
    })
    newUser.password = password
    res.status(201).json(newUser)
  } catch (error) {
    next(error)
  }
})

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user by ID
 *     security:
 *       - bearerAuth: []  # Indicate that this endpoint requires authentication
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CUSTOMER]
 *             required:
 *               - name
 *               - email
 *               - role
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */
app.put("/user/:id", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
  const userId = parseInt(req.params.id);
  const { name, email, role } = req.body;
  try {
    const {updatedUser} = await prismaClient.$transaction(async (prisma)=>{
      const roleEntry = await prisma.role.findUnique({
        where: {
          role: role
        }
      })
      const updatedUser = await prisma.user.update({
        where: {
          id: userId
        },
        data: {
          name: name,
          email: email,
          roleId: roleEntry.id
        },
      })
      return {updatedUser}
    })
    await setRedisCacheData(JSON.stringify(userId), updatedUser)
    res.status(200).json(updatedUser)
  } catch (error) {
    // Handle specific Prisma error codes
    if (error.code === 'P2025') {
      return next(new CustomError("User not found", 404));
    }
    next(error);
  }
})

/**
 * @swagger
 * /user/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to delete
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */

app.delete("/user/:id", async(req, res, next)=>{
  const {id} = req.params
  const userId = parseInt(id)
  try {
    await prismaClient.user.delete({
      where: {
        id: userId
      }
    })
    await removeCacheData(JSON.stringify(userId))
    res.status(204).json({
      success:  true,
      message: `User with ID ${userId} deleted successfully`
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new CustomError("User not found", 404));
    }
    next(error)
  }
})

app.use(ErrorHandler)

async function init() {
  try {
    await await prismaClient.$connect();
    await redisClient.connect(); // Connect to Redis
    console.log('Connected to Redis server'); 
    // Start the Express server
    app.listen(PORT, () => {
        console.log(`Example app listening on port ${PORT}`);
    });
  } catch (error) {
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await prismaClient.$disconnect();
  await redisClient.disconnect();
  console.log('Disconnected from Prisma and redis');
  process.exit(0);
});

init()