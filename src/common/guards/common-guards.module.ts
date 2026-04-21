import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { VerifiedEmailGuard } from './verified-email.guard';

/**
 * Module tập trung các Guard dùng chung giữa nhiều module.
 * Import module này vào bất kỳ module nào cần dùng VerifiedEmailGuard.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [VerifiedEmailGuard],
  exports: [VerifiedEmailGuard],
})
export class CommonGuardsModule {}
