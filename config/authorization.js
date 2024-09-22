const { ForbiddenError, defineAbility } = require('@casl/ability');

const { CustomError } = require("../utils/errorhandler")

const defineAbilitiesFor = (user) => {
   return defineAbility((can, cannot)=>{
        if(user.role.role == "ADMIN" ){
            can('manage', 'all');
        } else{
            can('read', 'user');
            // cannot("delete", "user")
        }
    })
};

const authorizeAction = (action, subject) => {
    return (req, res, next) => {
        const user = req.user;
        const ability = defineAbilitiesFor(user);

        try {
            ForbiddenError.from(ability).throwUnlessCan(action, subject);
            next();
        } catch (error) {
            next(new CustomError(error.message, 403))
        }
    };
}

module.exports = authorizeAction;
