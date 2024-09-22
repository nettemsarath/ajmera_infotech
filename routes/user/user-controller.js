const { Router } = require("express");
const passport = require("passport");

const authorizeAction = require("../../middleware/authorization");
const userService = require("./user-service");
const { signJWT } = require("../../utils/signJWT");
const {
  getRedisCacheData,
  setRedisCacheData,
  removeCacheData,
} = require("../../redis");

const userRouter = Router();

/**
 * @swagger
 * /v1/:
 *   get:
 *     summary: Hello world
 *     description: Returns a greeting message.
 *     responses:
 *       200:
 *         description: A greeting message
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Hello World!
 */
userRouter.get("/", (req, res) => {
  res.send("Hello World!!!!!!");
});

/**
 * @swagger
 * /v1/signup:
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

userRouter.post("/signup", async (req, res, next) => {
  const { name, email, password } = req.body;
  try {
    const newUser = await userService.createUserWithRole(name, email, password);

    delete newUser.password;
    res.status(200).json({
      success: true,
      message: "User Created Successfully",
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /v1/login:
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

userRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userService.getLoginUser(email, password);
    const { token, expiresIn } = signJWT({ id: user.id });
    res.status(200).json({
      status: "Success",
      message: "Login successful",
      token,
      user,
      expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /v1/user:
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

userRouter.get(
  "/user",
  passport.authenticate("jwt", { session: false }),
  authorizeAction("get", "user"),
  async (req, res, next) => {
    const { name, role } = req.query;
    try {
      let cacheKey = name || role || "";
      const cachedUsers = await getRedisCacheData(cacheKey);
      if (cachedUsers) {
        return res.status(200).json(cachedUsers);
      }
      const allUsers = await userService.getUsersByNameorRole(name, role);
      await setRedisCacheData(cacheKey, allUsers);
      res.status(200).json({
        allUsers,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/user/{id}:
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

userRouter.get(
  "/user/:id",
  passport.authenticate("jwt", { session: false }),
  authorizeAction("get", "user"),
  async (req, res, next) => {
    const { id } = req.params;
    const userId = parseInt(id);
    try {
      const cacheUser = await getRedisCacheData(JSON.stringify(userId));
      if (cacheUser) {
        return res.status(200).json(cacheUser);
      }
      const user = await userService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      await setRedisCacheData(JSON.stringify(userId), user);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/user:
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

userRouter.post(
  "/user",
  passport.authenticate("jwt", { session: false }),
  authorizeAction("create", "user"),
  async (req, res, next) => {
    const { name, email, password, role } = req.body;
    try {
      const newUser = await userService.createUserWithRole(
        name,
        email,
        password,
        role
      );
      newUser.password = password;
      res.status(201).json(newUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/user/{id}:
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

userRouter.put(
  "/user/:id",
  passport.authenticate("jwt", { session: false }),
  authorizeAction("update", "user"),
  async (req, res, next) => {
    const userId = parseInt(req.params.id);
    const { name, email, role } = req.body;
    try {
      const updatedUser = await userService.updateUser(
        userId,
        name,
        email,
        role
      );
      await setRedisCacheData(JSON.stringify(userId), updatedUser);
      res.status(200).json(updatedUser);
    } catch (error) {
      // Handle specific Prisma error codes
      if (error.code === "P2025") {
        return next(new CustomError("User not found", 404));
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/user/{id}:
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

userRouter.delete(
  "/user/:id",
  passport.authenticate("jwt", { session: false }),
  authorizeAction("delete", "user"),
  async (req, res, next) => {
    const { id } = req.params;
    const userId = parseInt(id);
    try {
      console.log("deleting user", userId);
      await userService.deleteuserById(userId);
      await removeCacheData(JSON.stringify(userId));
      res.status(200).json({
        success: true,
        message: `User with ID ${userId} deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = userRouter;
