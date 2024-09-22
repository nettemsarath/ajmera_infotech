// Custom error class
class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
  }
}

// Error handler middleware
const ErrorHandler = (err, req, res, next) => {
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
        error: err.message,
        details: err.details || null,
    });
  }
  const errStatus = err.statusCode || 500;
  const errMsg = err.message || 'Something went wrong';

  res.status(errStatus).json({
    success: false,
    status: errStatus,
    message: errMsg
  });
};

// Exporting both the error handler and the custom error class
module.exports = {
  ErrorHandler,
  CustomError
};