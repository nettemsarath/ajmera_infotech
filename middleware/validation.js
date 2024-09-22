const { ZodError } = require('zod');
const { CustomError } = require("../utils/errorhandler")

const validateData = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.errors.map((issue) => ({
                    message: `${issue.path.join('.')} is ${issue.message}`,
                }));
                
                // Create a CustomError for validation issues
                const validationError = new CustomError('Invalid data', 400);
                validationError.details = errorMessages;
                next(validationError);
            } else {
                next(error);
            }
        }
    };
};

module.exports = validateData;