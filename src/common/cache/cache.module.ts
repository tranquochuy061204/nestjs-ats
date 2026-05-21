import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { UpstashCacheService } from './upstash-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'UPSTASH_REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('UPSTASH_REDIS_REST_URL');
        const token = config.get<string>('UPSTASH_REDIS_REST_TOKEN');

        if (!url || !token) {
          throw new Error(
            'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env variables',
          );
        }

        return new Redis({ url, token });
      },
    },
    UpstashCacheService,
  ],
  exports: [UpstashCacheService],
})
export class CacheModule {}
