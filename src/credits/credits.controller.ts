import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { CreditsService } from './credits.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

@ApiTags('Credits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  @Get('balance')
  @ApiOperation({ summary: 'Xem số dư Credit của công ty' })
  async getBalance(@Req() req: Request & { user: { id: number } }) {
    const companyId = await this.getCompanyId(req.user.id);
    const balance = await this.creditsService.getBalance(companyId);
    return { balance };
  }

  @Get('topup-packs')
  @ApiOperation({ summary: 'Danh sách gói nạp Credit' })
  getTopupPacks() {
    return this.creditsService.getTopupPacks();
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Lịch sử giao dịch Credit' })
  async getTransactions(
    @Req() req: Request & { user: { id: number } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.creditsService.getTransactionHistory(companyId, page, limit);
  }

  private async getCompanyId(userId: number): Promise<number> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer?.companyId) throw new Error('Chưa tham gia công ty');
    return employer.companyId;
  }
}
