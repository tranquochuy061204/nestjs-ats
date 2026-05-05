import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AdminAuditLogsService } from './admin-audit-logs.service';
import { AdminAuditLogsController } from './admin-audit-logs.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AdminAuditLogsController],
  providers: [AdminAuditLogsService],
  exports: [AdminAuditLogsService],
})
export class AdminAuditLogsModule {}
