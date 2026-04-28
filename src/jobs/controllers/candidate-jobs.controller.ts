import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CandidateJobsService } from '../services/candidate-jobs.service';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Jobs - Candidate Recommendation')
@Controller('jobs/candidate')
export class CandidateJobsController {
  constructor(private readonly candidateJobsService: CandidateJobsService) {}

  @Get('recommended')
  @ApiAuth()
  @ApiOperation({
    summary: 'Lấy danh sách việc làm gợi ý dựa trên hồ sơ ứng viên',
  })
  @ApiResponse({ status: 200, description: 'Danh sách việc làm gợi ý' })
  getRecommendedJobs(
    @CurrentUser() user: { id: number },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.candidateJobsService.getRecommendedJobs(user.id, page, limit);
  }
}
