#### Build and Run the application

### Clone the git repo and run the following command, which will build and start postgresql container, redis container and nodejs app

```
docker-compose up --build
```

## The nodejs app runs on port 300, open http://localhost:3000/docs/ in the browser to the api swagger documentation

### Features Implemented:

## 1. API endpoints

    a. User signup POST API: /v1/signup ( this is ADMIN user )
    b. login API this is for both ADMIN and CUSTOMER: /v1/login
    c. Retrive all users GET API: /v1/user ( query based on role or name ) role is either ADMIN or CUSTOMER
    d. Get single user GET API: /v1/user/:id
    e. update user details API
    f. delete user api - to delete a user

## 2. Authentication and Authorization

    a. Added JWT authentication using passportjs
    b. added authorization using CASL npm library, where only ADMIN can able to create, update, delete user, CUSTOMER can only see the users eithers but cannot create, update or delete user

## 3. Database

    a. used postgresql database to store data
    b. created schema using prisma ORM, and created unique constraints for necessary fields
    c. added indexing for email address

## 4. Create a Custom global error handler

## 5. Transactional Operations:

    a. Used transactions while creating users, creating and assigning roles to them,
    b. if transaction fails it will do the roll back

## 6. API Caching

    a. Added REDIS to cache the data for frequently accesed api's
    b. Also cache is invalidated each time an user is updated or deleted

## 7. Containerised with Docker

    a. Added dokcer and docker-compose file, to simplify build and run process

## 8. API version

    a. all my api's are under version v1 ( ex: /v1/user/:id, /v1/user/ ) to make changes eaiser in future

## 9. Data seeding and data migrations

    a. Curreclty there are User Table for users and Role Table for user role ( i.e either ADMIN or CUSTOMER )
    b. For data seeding run
    ```
    node prisma/seed.js
    ```
    c. Migrations are applied when you build and run the container,  however if you want to change schema and want to run migrations use the following command
    ```
    npm run migrate
    ```
