import { Controller, Get, Post, Delete, Param, ParseIntPipe, Query, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CandidateSavedJobsService } from './services/candidate-saved-jobs.service';

@ApiTags('Candidates - Saved Jobs')
@Controller('candidates/saved-jobs')
export class CandidateSavedJobsController {
  constructor(private readonly savedJobsService: CandidateSavedJobsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách các jobs đã lưu' })
  @ApiResponse({ status: 200, description: 'Danh sách jobs đã lưu' })
  getSavedJobs(
    @CurrentUser() user: { id: number },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.savedJobsService.getSavedJobs(user.id, page, limit);
  }

  @Get(':jobId/check')
  @ApiAuth()
  @ApiOperation({ summary: 'Kiểm tra xem job này đã được lưu chưa' })
  @ApiParam({ name: 'jobId', description: 'ID Job' })
  checkSaved(
    @CurrentUser() user: { id: number },
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.savedJobsService.checkSaved(user.id, jobId);
  }

  @Post(':jobId')
  @ApiAuth()
  @ApiOperation({ summary: 'Lưu công việc (Bookmark)' })
  @ApiParam({ name: 'jobId', description: 'ID Job' })
  @ApiResponse({ status: 201, description: 'Lưu thành công' })
  @ApiResponse({ status: 409, description: 'Job đã được lưu' })
  saveJob(
    @CurrentUser() user: { id: number },
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.savedJobsService.saveJob(user.id, jobId);
  }

  @Delete(':jobId')
  @ApiAuth()
  @ApiOperation({ summary: 'Bỏ lưu công việc' })
  @ApiParam({ name: 'jobId', description: 'ID Job' })
  @ApiResponse({ status: 200, description: 'Bỏ lưu thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy job' })
  unsaveJob(
    @CurrentUser() user: { id: number },
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.savedJobsService.unsaveJob(user.id, jobId);
  }
}
