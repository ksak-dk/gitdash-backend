import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service acting as a wrapper around ioredis client.
 * Provides easy-to-use methods for key retrieval, storage with TTL, and key deletion.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  /**
   * NestJS Lifecycle Hook. Initializes the Redis client connection.
   */
  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);

    this.client.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  /**
   * NestJS Lifecycle Hook. Closes the connection gracefully when module is destroyed.
   */
  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Retrieves a parsed JSON object cached in Redis by its key.
   *
   * @template T - The expected output type after parsing
   * @param key - The cache database key
   * @returns Promise resolving to the parsed value of type T, or null if key does not exist or fails parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.error(`Failed to get key "${key}" from Redis:`, err);
      return null;
    }
  }

  /**
   * Serializes a value to JSON string and caches it in Redis with an optional TTL.
   *
   * @param key - The cache database key
   * @param value - The object or value to cache
   * @param ttlSeconds - Optional Time-To-Live in seconds
   * @returns Promise resolving when cache operation is complete
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.set(key, stringValue, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, stringValue);
      }
    } catch (err) {
      this.logger.error(`Failed to set key "${key}" to Redis:`, err);
    }
  }

  /**
   * Deletes a key-value pair from the Redis store.
   *
   * @param key - The cache database key to evict
   * @returns Promise resolving when deletion operation is complete
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.error(`Failed to delete key "${key}" from Redis:`, err);
    }
  }
}
