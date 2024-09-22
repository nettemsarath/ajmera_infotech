const { createClient } = require("redis");
const CACHETIME = process.env.CACHETIME || 3600
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;

const redisClient = createClient({
    host: REDIS_HOST,
    port: REDIS_PORT,
});

redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
});

const setRedisCacheData = async (cacheKey, data, expireTime = CACHETIME)=>{
    await redisClient.setEx(cacheKey, expireTime, JSON.stringify(data));
    return
};

const getRedisCacheData = async (cacheKey)=>{
    const data = await redisClient.get(cacheKey);
    return JSON.parse(data)
};

const removeCacheData = async (cacheKey)=>{
    await redisClient.del(cacheKey);
    return
}

module.exports = { redisClient, setRedisCacheData, getRedisCacheData, removeCacheData}