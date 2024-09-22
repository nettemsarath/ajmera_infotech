const express = require('express')
const dotenv = require('dotenv')
const passport = require('passport');

const {prismaClient, USERSROLES} = require("./db/prisma")
const {ErrorHandler, CustomError} = require("./utils/errorhandler")
const { redisClient, setRedisCacheData, getRedisCacheData, removeCacheData} = require("./redis")
const { hashString, compareHashedString } = require("./utils/hashpassword")
const {signJWT} = require("./utils/signJWT")
const configurePassport = require('./config/passport');

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(passport.initialize());
configurePassport(passport);

app.get('/' ,(req, res) => {
  res.send('Hello World!')
})

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
    res.status(200).json({
      success: true,
      message: "User Created Successfully",
      user: newUser
    })
  } catch (error) {
    next(error)
  }
})

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

app.get("/user", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
  const {name, role} = req.query;
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

app.get("/user/:id", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
  const {id} = req.params
  const userId = parseInt(id)
  try {
    const cacheUser = await getRedisCacheData(JSON.stringify(userId));
    if(cacheUser){
      const parseUser = JSON.parse(cacheUser)
      return res.status(200).json(parseUser)
    }
    const user = await prismaClient.user.findUnique({
      where: {
        id: userId
      },
      include: {
        role: true
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

app.post("/user", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
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
    res.status(200).json(newUser)
  } catch (error) {
    next(error)
  }
})

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

app.delete("/user/:id", passport.authenticate('jwt', { session: false }), async(req, res, next)=>{
  const {id} = req.params
  const userId = parseInt(id)
  try {
    await prismaClient.user.delete({
      where: {
        id: userId
      }
    })
    await removeCacheData(JSON.stringify(userId))
    res.status(200).json({
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

init()