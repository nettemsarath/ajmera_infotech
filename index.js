const express = require('express')
const dotenv = require('dotenv')

const prismaClient = require("./db/prisma")
const {ErrorHandler, CustomError} = require("./utils/errorhandler")
const { redisClient, setRedisCacheData, getRedisCacheData, removeCacheData} = require("./redis")

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get("/user", async(req, res, next)=>{
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

app.get("/user/:id", async(req, res, next)=>{
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

app.post("/user", async(req, res, next)=>{
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
      // Create user with role
      const newUser = await prisma.user.create({
        data: {
          name: name,
          email: email,
          password: password,
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

app.put("/user/:id", async(req, res, next)=>{
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