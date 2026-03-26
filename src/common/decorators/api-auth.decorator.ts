import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Gom @UseGuards(JwtAuthGuard) + @ApiBearerAuth() + 401 response
 * Nếu có truyền roles, sẽ tự động gán @Roles và @UseGuards(RolesGuard)
 */
export function ApiAuth(...roles: UserRole[]) {
  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Chưa đăng nhập' }),
  ];

  if (roles.length > 0) {
    decorators.push(Roles(...roles));
    decorators.push(UseGuards(RolesGuard));
    decorators.push(
      ApiResponse({
        status: 403,
        description: 'Không có quyền truy cập (Sai Role)',
      }),
    );
  }

  return applyDecorators(...decorators);
}
