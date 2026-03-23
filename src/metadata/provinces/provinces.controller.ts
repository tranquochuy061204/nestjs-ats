import { Controller, Get, Query, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ProvincesService } from './provinces.service';

@ApiTags('Metadata - Provinces')
@Controller('metadata/provinces')
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả tỉnh / thành phố' })
  @ApiResponse({ status: 200, description: 'Danh sách các tỉnh thành' })
  findAll() {
    return this.provincesService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm tỉnh / thành phố' })
  @ApiQuery({
    name: 'q',
    description: 'Từ khóa tìm kiếm',
    example: 'hà nội',
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Danh sách tỉnh thành phù hợp' })
  search(@Query('q') q?: string) {
    if (!q) {
      return this.provincesService.findAll();
    }
    return this.provincesService.search(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin một tỉnh / thành phố theo ID' })
  @ApiParam({
    name: 'id',
    description: 'Mã tỉnh / thành phố (code)',
    example: '01',
  })
  @ApiResponse({ status: 200, description: 'Thông tin tỉnh / thành phố' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tỉnh / thành phố' })
  findOne(@Param('id') id: string) {
    return this.provincesService.findOne(id);
  }
}
