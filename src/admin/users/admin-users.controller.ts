// Core & Config
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

// Services
import { AdminUsersService } from './admin-users.service';

// DTOs
import { AdminUserFilterDto } from './dto/admin-user-filter.dto';

// Shared
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Quản lý Người dùng')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Danh sách người dùng (filter theo role, status, email)',
  })
  getUsers(@Query() filter: AdminUserFilterDto) {
    return this.adminUsersService.getUsers(filter);
  }

  @Get(':id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chi tiết người dùng' })
  getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.getUserById(id);
  }

  @Patch(':id/lock')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Khóa tài khoản người dùng' })
  lockUser(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const adminId = (req.user as any).id;
    return this.adminUsersService.lockUser(id, adminId);
  }

  @Patch(':id/unlock')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mở khóa tài khoản người dùng' })
  unlockUser(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const adminId = (req.user as any).id;
    return this.adminUsersService.unlockUser(id, adminId);
  }

  @Patch(':id/verify-email')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xác thực email thủ công cho người dùng' })
  verifyEmail(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const adminId = (req.user as any).id;
    return this.adminUsersService.verifyEmail(id, adminId);
  }
}
