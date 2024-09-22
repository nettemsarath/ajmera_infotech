const jwt = require('jsonwebtoken');

const EXPIRETIME = "1h"

const signJWT = (payload)=>{ 
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: EXPIRETIME });
    return {token, expiresIn: EXPIRETIME}
}

module.exports = {signJWT}