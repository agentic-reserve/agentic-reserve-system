import { createClient, RedisClientType } from 'redis';
import { Redis } from '@upstash/redis';
import { config } from '../config';

let redisClient: RedisClientType | null = null;
let upstashClient: Redis | null = null;

// Determine which Redis client to use
const useUpstash = !config.redis.url && config.redis.upstash.url && config.redis.upstash.token;

export async function getRedisClient(): Promise<RedisClientType | Redis> {
  if (useUpstash) {
    if (!upstashClient) {
      upstashClient = new Redis({
        url: config.redis.upstash.url!,
        token: config.redis.upstash.token!,
      });
      console.log('✓ Using Upstash Redis (REST API)');
    }
    return upstashClient;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: config.redis.url,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('✓ Connected to Redis');
  }
  return redisClient;
}

// Export the client for health checks and direct access
export { redisClient, upstashClient };

export async function getCachedData<T>(
  key: string,
  ttl: number = 300
): Promise<T | null> {
  try {
    const client = await getRedisClient();
    let data: any;
    
    if (client instanceof Redis) {
      // Upstash client
      data = await client.get<T>(key);
    } else {
      // Standard Redis client
      const redisData = await (client as RedisClientType).get(key);
      data = redisData;
    }
    
    if (!data) return null;
    
    // Upstash returns parsed data, redis returns string
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedData<T>(
  key: string,
  data: T,
  ttl: number = 300
): Promise<void> {
  try {
    const client = await getRedisClient();
    
    if (client instanceof Redis) {
      // Upstash accepts objects directly
      await client.set(key, data, { ex: ttl });
    } else {
      // Standard Redis needs stringified data
      await client.setEx(key, ttl, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Redis set error:', error);
  }
}
