import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PublicJobsService } from '../services/public-jobs.service';
import { JobFilterDto } from '../dto/job-filter.dto';

@ApiTags('Jobs - Public')
@Controller('jobs/public')
export class PublicJobsController {
  constructor(private readonly publicJobsService: PublicJobsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách các công việc đang mở (Cho ứng viên tìm kiếm)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách công việc' })
  getPublicJobs(@Query() filterDto: JobFilterDto) {
    return this.publicJobsService.getPublicJobs(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết 1 bài đăng tuyển dụng' })
  @ApiParam({ name: 'id', description: 'ID Job' })
  @ApiResponse({ status: 200, description: 'Chi tiết bài đăng tuyển' })
  getJobDetail(@Param('id', ParseIntPipe) id: number) {
    return this.publicJobsService.getJobDetail(id);
  }
}
