const { prismaClient, USERSROLES } = require("../../prisma/prisma-client");
const { hashString, compareHashedString } = require("../../utils/hashpassword");
const { CustomError } = require("../../utils/errorhandler");

const createUserWithRole = async (
  name,
  email,
  password,
  role = USERSROLES.ADMIN
) => {
  try {
    const { newUser } = await prismaClient.$transaction(async (prisma) => {
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
      }
      const hashedPassword = await hashString(password);
      // Create user with role
      const newUser = await prisma.user.create({
        data: {
          name: name,
          email: email,
          password: hashedPassword,
          roleId: roleEntry.id,
        },
      });
      newUser.role = roleEntry;
      return { roleEntry, newUser };
    });
    delete newUser.password;
    return newUser;
  } catch (error) {
    throw error;
  }
};

const getLoginUser = async (email, password) => {
  const user = await prismaClient.user.findUnique({
    where: {
      email: email,
    },
  });
  if (!user || !(await compareHashedString(password, user.password))) {
    throw new CustomError("Invalid credentials", 401);
  }
  delete user.password;
  return user;
};

const getUsersByNameorRole = async (name, role) => {
  if (role) {
    // get roleId based on user role
    const rollEntry = await prismaClient.role.findUnique({
      where: {
        role: role,
      },
    });
    query = {
      where: {
        roleId: rollEntry.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        role: true,
      },
    };
  }
  if (name) {
    query = {
      where: {
        name: name,
      },
    };
  }
  const allUsers = await prismaClient.user.findMany(query);
  return allUsers;
};

const getUserById = async (userId) => {
  const user = await prismaClient.user.findUnique({
    where: {
      id: userId,
    },
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
    },
  });
  return user;
};

const updateUser = async (userId, name, email, role) => {
  const { updatedUser } = await prismaClient.$transaction(async (prisma) => {
    const roleEntry = await prisma.role.findUnique({
      where: {
        role: role,
      },
    });
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: name,
        email: email,
        roleId: roleEntry.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        role: true,
      },
    });
    return { updatedUser };
  });
  return updatedUser;
};

const deleteuserById = async (userId) => {
  try {
    await prismaClient.user.delete({
      where: {
        id: userId,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      throw new CustomError("User not found", 404);
    }
  }
};

module.exports = {
  createUserWithRole,
  getLoginUser,
  getUsersByNameorRole,
  getUserById,
  updateUser,
  deleteuserById,
};
