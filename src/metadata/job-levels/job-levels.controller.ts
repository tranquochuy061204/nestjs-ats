import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JobLevelsService } from './job-levels.service';

@ApiTags('Metadata - Danh mục cấp bậc')
@Controller('metadata/job-levels')
export class JobLevelsController {
  constructor(private readonly service: JobLevelsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các cấp bậc công việc' })
  @ApiResponse({ status: 200, description: 'Danh sách cấp bậc' })
  findAll() {
    return this.service.findAll();
  }
}
