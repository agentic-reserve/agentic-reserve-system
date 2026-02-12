import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../services/redis';
import { Redis } from '@upstash/redis';
import { RedisClientType } from 'redis';

/**
 * Rate limiter for memory query API
 * Limits: 100 queries per minute per agent
 */
export async function queryRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agentId = req.headers['x-agent-id'] as string;
    
    if (!agentId) {
      res.status(400).json({ error: 'Agent ID required (x-agent-id header)' });
      return;
    }

    const rateLimitKey = `rate_limit:query:${agentId}`;
    const windowSeconds = 60; // 1 minute window
    const maxRequests = 100;

    const redisClient = await getRedisClient();

    // Get current request count
    let count = 0;
    if (redisClient instanceof Redis) {
      const currentCount = await redisClient.get<string>(rateLimitKey);
      count = currentCount ? parseInt(currentCount, 10) : 0;
    } else {
      const currentCount = await (redisClient as RedisClientType).get(rateLimitKey);
      count = currentCount ? parseInt(currentCount, 10) : 0;
    }

    if (count >= maxRequests) {
      // Rate limit exceeded
      let ttl = windowSeconds;
      if (redisClient instanceof Redis) {
        ttl = await redisClient.ttl(rateLimitKey) || windowSeconds;
      } else {
        ttl = await (redisClient as RedisClientType).ttl(rateLimitKey);
      }
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        limit: maxRequests,
        window: windowSeconds,
        retryAfter: ttl > 0 ? ttl : windowSeconds,
      });
      return;
    }

    // Increment counter
    if (count === 0) {
      // First request in window - set with expiry
      if (redisClient instanceof Redis) {
        await redisClient.set(rateLimitKey, '1', { ex: windowSeconds });
      } else {
        await (redisClient as RedisClientType).setEx(rateLimitKey, windowSeconds, '1');
      }
    } else {
      // Increment existing counter
      await redisClient.incr(rateLimitKey);
    }

    // Add rate limit headers
    let ttl = windowSeconds;
    if (redisClient instanceof Redis) {
      ttl = await redisClient.ttl(rateLimitKey) || windowSeconds;
    } else {
      ttl = await (redisClient as RedisClientType).ttl(rateLimitKey);
    }
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - count - 1).toString());
    res.setHeader('X-RateLimit-Reset', (Date.now() + ttl * 1000).toString());

    next();
  } catch (error: any) {
    console.error('Rate limit error:', error);
    // On error, allow request through (fail open)
    next();
  }
}
