import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import * as crypto from 'crypto';

@Injectable()
export class UpstashCacheService {
  private readonly logger = new Logger(UpstashCacheService.name);

  constructor(@Inject('UPSTASH_REDIS') private readonly redis: Redis) {}

  /**
   * Lấy giá trị từ cache.
   * Trả về null nếu không có hoặc xảy ra lỗi network.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get<T>(key);
      if (data) {
        this.logger.log(`[Cache HIT] Key: ${key}`);
      } else {
        this.logger.log(`[Cache MISS] Key: ${key}`);
      }
      return data;
    } catch (err) {
      this.logger.warn(`Cache GET failed for key "${key}": ${err}`);
      return null;
    }
  }

  /**
   * Lưu giá trị vào cache với TTL (giây).
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { ex: ttlSeconds });
      this.logger.log(`[Cache SET] Key: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (err) {
      this.logger.warn(`Cache SET failed for key "${key}": ${err}`);
    }
  }

  /**
   * Xóa một hoặc nhiều cache key cụ thể.
   */
  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(
        `Cache DEL failed for keys [${keys.join(', ')}]: ${err}`,
      );
    }
  }

  /**
   * Xóa tất cả keys khớp với glob pattern (ví dụ: "employer:jobs:42:*").
   * SCAN-based để tránh blocking KEYS trên production.
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = 0;
      const toDelete: string[] = [];

      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = Number(nextCursor);
        toDelete.push(...keys);
      } while (cursor !== 0);

      if (toDelete.length > 0) {
        await this.redis.del(...toDelete);
        this.logger.debug(
          `Pattern delete "${pattern}": removed ${toDelete.length} key(s)`,
        );
      }
    } catch (err) {
      this.logger.warn(`Cache DEL_PATTERN failed for "${pattern}": ${err}`);
    }
  }

  /**
   * Tạo hash MD5 ngắn từ object tùy ý để dùng làm cache key suffix.
   * Dùng cho các endpoint có filter params phức tạp.
   */
  hashKey(obj: unknown): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(obj))
      .digest('hex')
      .slice(0, 10);
  }
}
