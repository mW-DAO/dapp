import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// 确保在没有配置的情况下不会直接崩坏，而是抛出明确错误或 fallback
const redis = (redisUrl && redisToken) 
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

export default redis;
