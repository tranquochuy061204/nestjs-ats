import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

/**
 * Gom @UseGuards(JwtAuthGuard) + @ApiBearerAuth() + 401 response
 */
export function ApiAuth() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Chưa đăng nhập' }),
  );
}
