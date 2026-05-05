// Core & Config
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

// Services
import { AdminAuditLogsService } from './admin-audit-logs.service';

// DTOs
import { AdminAuditLogFilterDto } from './dto/admin-audit-log-filter.dto';

// Shared
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Lịch sử Thao tác (Audit Logs)')
@Controller('admin/audit-logs')
@ApiAuth(UserRole.ADMIN)
export class AdminAuditLogsController {
  constructor(private readonly auditLogsService: AdminAuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách Audit Logs' })
  getLogs(@Query() filter: AdminAuditLogFilterDto) {
    return this.auditLogsService.getLogs(filter);
  }
}
