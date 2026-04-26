import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  @Get('packages')
  @ApiOperation({ summary: 'Lấy danh sách gói đăng ký' })
  async getPackages() {
    return this.subscriptionsService.getAllPackages();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Xem subscription hiện tại của công ty' })
  async getMySubscription(@Req() req: Request & { user: { id: number } }) {
    const employer = await this.employerRepo.findOne({
      where: { userId: req.user.id },
    });
    if (!employer?.companyId) {
      return { error: 'Chưa tham gia công ty' };
    }
    return this.subscriptionsService.getCompanySubscription(employer.companyId);
  }
}
