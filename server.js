const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./swagger");
const dotenv = require("dotenv");
const passport = require("passport");

const apiRoutes = require("./routes");
const { prismaClient } = require("./prisma/prisma-client");
const { ErrorHandler } = require("./utils/errorhandler");
const { redisClient } = require("./redis");
const configurePassport = require("./config/passport");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(passport.initialize());
configurePassport(passport);

app.use(apiRoutes);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(ErrorHandler);

async function init() {
  try {
    await await prismaClient.$connect();
    await redisClient.connect(); // Connect to Redis
    console.log("Connected to database and redis");
    // Start the Express server
    app.listen(PORT, () => {
      console.log(`Example app listening on port ${PORT}`);
    });
  } catch (error) {
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await prismaClient.$disconnect();
  await redisClient.disconnect();
  console.log("Disconnected from Prisma and redis");
  process.exit(0);
});

init();
