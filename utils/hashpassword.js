const bcrypt = require('bcryptjs')

const hashString = async(value)=>{
    return await bcrypt.hash(value, 10);
};

const compareHashedString = async(value, hashedString)=>{
    return await bcrypt.compare(value, hashedString)
}

module.exports = { hashString, compareHashedString }