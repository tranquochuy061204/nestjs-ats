import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiProviderService } from './ai-provider.service';

/**
 * AiProviderModule — Global module cung cấp AiProviderService cho toàn app.
 *
 * Được đánh dấu @Global() để tất cả module trong app có thể inject
 * AiProviderService mà không cần import module này từng nơi.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiProviderModule {}
