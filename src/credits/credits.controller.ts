import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
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

  @Get('products')
  @ApiOperation({ summary: 'Danh sách tính năng mua lẻ bằng Credit' })
  getProducts() {
    return this.creditsService.getAvailableProducts();
  }

  @Post('purchase')
  @ApiOperation({
    summary: 'Mua tính năng à-la-carte bằng Credit',
    description:
      'Mua các gói tính năng lẻ: `bump_post` (30 Credit), `extend_job` (20 Credit), `extra_job_slot` (40 Credit). ' +
      'Trường `targetJobId` bắt buộc với các sản phẩm scope=job.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: {
          type: 'string',
          example: 'bump_post',
          description:
            'Slug của sản phẩm (VD: bump_post, extend_job, extra_job_slot)',
        },
        targetJobId: {
          type: 'number',
          example: 42,
          description: 'ID của tin tuyển dụng (bắt buộc với scope=job)',
        },
      },
    },
  })
  async purchaseProduct(
    @Req() req: Request & { user: { id: number } },
    @Body('slug') slug: string,
    @Body('targetJobId') targetJobId?: number,
  ) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.creditsService.purchaseProduct(
      companyId,
      slug,
      targetJobId,
      req.user.id,
    );
  }

  @Get('balance')
  @ApiOperation({ summary: 'Xem số dư Credit của công ty' })
  async getBalance(@Req() req: Request & { user: { id: number } }) {
    const companyId = await this.getCompanyId(req.user.id);
    const balance = await this.creditsService.getBalance(companyId);
    return { balance };
  }

  @Get('topup-packs')
  @ApiOperation({ summary: 'Danh sách gói nạp Credit' })
  async getTopupPacks() {
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

  @Get('extra-slots')
  @ApiOperation({ summary: 'Xem số lượng slot tin mua thêm đang hoạt động' })
  async getExtraSlots(@Req() req: Request & { user: { id: number } }) {
    const companyId = await this.getCompanyId(req.user.id);
    const count = await this.creditsService.getExtraJobSlots(companyId);
    return { count };
  }

  private async getCompanyId(userId: number): Promise<number> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer?.companyId) {
      throw new ForbiddenException('Chưa tham gia công ty');
    }
    return employer.companyId;
  }
}
