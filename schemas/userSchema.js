const {z} = require('zod')

const userSignupSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    password: z.string()
})

const userLoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
})

const userDeleteSchema = z.object({
    id: z.string(),
});

module.exports = {
    userSignupSchema,
    userLoginSchema,
    userDeleteSchema
}