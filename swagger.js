const swaggerJsDoc = require('swagger-jsdoc');
const PORT = process.env.PORT || 3000

// Swagger definition
const swaggerOptions = {
    swaggerDefinition: {
      openapi: '3.0.0', // OpenAPI version
      info: {
        title: 'My API',
        version: '1.0.0',
        description: 'API documentation',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
        },
      ],
    },
    apis: ['./routes/**/*.js']
  };

const swaggerDocs = swaggerJsDoc(swaggerOptions);
module.exports = swaggerDocs;
