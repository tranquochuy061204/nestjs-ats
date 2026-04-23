import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SkillsMetadataService } from './skills-metadata.service';
import { PAGINATION_DEFAULTS } from '../../common/constants/headhunting.constant';

@ApiTags('Metadata - Skills')
@Controller('metadata/skills')
export class SkillsMetadataController {
  constructor(private readonly skillsMetadataService: SkillsMetadataService) {}

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm / gợi ý skills (autocomplete)' })
  @ApiQuery({
    name: 'q',
    description: 'Từ khóa tìm kiếm',
    example: 'java',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Số kết quả tối đa',
    required: false,
    example: PAGINATION_DEFAULTS.LIMIT,
  })
  @ApiResponse({ status: 200, description: 'Danh sách skills gợi ý' })
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.skillsMetadataService.search(
      query,
      limit || PAGINATION_DEFAULTS.LIMIT,
    );
  }
}
