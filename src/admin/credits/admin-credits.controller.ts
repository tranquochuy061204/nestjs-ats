import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminCreditsService } from './admin-credits.service';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/update-credit-package.dto';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Quản lý Gói Credit')
@Controller('admin/credits/packages')
export class AdminCreditsController {
  constructor(private readonly adminCreditsService: AdminCreditsService) {}

  @Get()
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách tất cả gói nạp credit' })
  getAllPackages() {
    return this.adminCreditsService.getAllPackages();
  }

  @Get(':id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chi tiết gói nạp credit' })
  getPackageById(@Param('id', ParseIntPipe) id: number) {
    return this.adminCreditsService.getPackageById(id);
  }

  @Post()
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo gói nạp credit mới' })
  createPackage(@Body() dto: CreateCreditPackageDto) {
    return this.adminCreditsService.createPackage(dto);
  }

  @Patch(':id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật gói nạp credit (giá, bonus, trạng thái)' })
  updatePackage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCreditPackageDto,
  ) {
    return this.adminCreditsService.updatePackage(id, dto);
  }
}
