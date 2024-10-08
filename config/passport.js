const { Strategy, ExtractJwt } = require('passport-jwt');
const {prismaClient} = require("../prisma/prisma-client");

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

module.exports = (passport) => {
  passport.use(new Strategy(opts, async (jwt_payload, done) => {
    try {
      const user = await prismaClient.user.findUnique({
        where: {
          id: jwt_payload.id
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
        }
      })
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }));
};