import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../services/redis';

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

    // Get current request count
    const currentCount = await redisClient.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    if (count >= maxRequests) {
      // Rate limit exceeded
      const ttl = await redisClient.ttl(rateLimitKey);
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
      await redisClient.setex(rateLimitKey, windowSeconds, '1');
    } else {
      // Increment existing counter
      await redisClient.incr(rateLimitKey);
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - count - 1).toString());
    res.setHeader('X-RateLimit-Reset', (Date.now() + (await redisClient.ttl(rateLimitKey)) * 1000).toString());

    next();
  } catch (error: any) {
    console.error('Rate limit error:', error);
    // On error, allow request through (fail open)
    next();
  }
}
