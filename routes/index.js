const { Router } = require("express");
const userRouter = require("./user/user-controller");

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

const api = Router().use(userRouter);

module.exports = Router().use("/v1", api);
