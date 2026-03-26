import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JobCategoriesService } from './job-categories.service';

@ApiTags('Metadata')
@Controller('metadata/job-categories')
export class JobCategoriesController {
  constructor(private readonly service: JobCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách ngành nghề (Job Categories)' })
  findAll() {
    return this.service.findAll();
  }
}
