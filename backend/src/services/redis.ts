import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: config.redis.url,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
  }
  return redisClient;
}

// Export the client for health checks and direct access
export { redisClient };

export async function getCachedData<T>(
  key: string,
  ttl: number = 300
): Promise<T | null> {
  try {
    const client = await getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
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
    await client.setEx(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Redis set error:', error);
  }
}
