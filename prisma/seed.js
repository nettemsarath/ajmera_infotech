const { PrismaClient, USERSROLES } = require('@prisma/client');
const {hashString} = require("../utils/hashpassword")

const prisma = new PrismaClient();

async function createUsers(usersData) {
  for (const userData of usersData) {
    try {
      const result = await prisma.$transaction(async (prisma)=>{
        let roleEntry = await prisma.role.findUnique({
          where: {
            role: userData.role,
          },
        });
        if (!roleEntry) {
          // Create role if it doesn't exist
          roleEntry = await prisma.role.create({
            data: {
              role: userData.role,
            },
          });
        };
        // Create user with role
        const hashedPassword = await hashString(userData.password)
        const user = await prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            roleId: roleEntry.id,
          },
        });

        return {roleEntry, user}
      })

      console.log('Transaction is completed', result);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }
}

const usersData = [
  {
    name: "John Doe",
    email: "john.doe@example.com",
    password: "john.doe@example.com",
    role: USERSROLES.ADMIN
  },
  {
    name: "Arpit",
    email: "arpit@example.com",
    password: "arpit@example.com",
    role: USERSROLES.ADMIN
  },
  {
    name: "cherry",
    email: "cherry@example.com",
    password: "cherry@example.com",
    role: USERSROLES.ADMIN
  },
  {
    name: "bhargav",
    email: "bhargav@example.com",
    password: "bhargav@example.com",
    role: USERSROLES.CUSTOMER
  },
  {
    name: "sarath",
    email: "nettemsarath@example.com",
    password: "nettemsarath@example.com",
    role: USERSROLES.CUSTOMER
  },
  {
    name: "nettem",
    email: "nettem@example.com",
    password: "nettem@example.com",
    role: USERSROLES.CUSTOMER
  },
]

createUsers(usersData)
.catch((error) => {
    console.error('Error in createUsers:', error);
}).finally(async () => {
    await prisma.$disconnect();
});
