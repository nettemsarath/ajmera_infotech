const { PrismaClient, USERSROLES } = require('@prisma/client');

const prismaClient = new PrismaClient()

module.exports = {prismaClient, USERSROLES}