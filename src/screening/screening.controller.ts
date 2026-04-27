import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ScreeningService,
  UpsertScreeningQuestionsDto,
  SubmitScreeningAnswersDto,
} from './screening.service';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity } from '../jobs/entities/job.entity';

// ─────────────────────────────────────────────────────────
// EMPLOYER routes — /jobs/:jobId/screening
// CANDIDATE routes — /jobs/:jobId/screening/answers  (via application)
// ─────────────────────────────────────────────────────────

@ApiTags('Screening Questions')
@Controller('jobs')
export class ScreeningController {
  constructor(
    private readonly screeningService: ScreeningService,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
  ) {}

  // ── EMPLOYER: Lấy danh sách câu hỏi sàng lọc ──────────────

  @Get(':jobId/screening')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiParam({ name: 'jobId', type: Number })
  @ApiOperation({ summary: '[Employer] Xem câu hỏi sàng lọc của tin' })
  async getQuestionsEmployer(
    @Req() req: Request & { user: { id: number } },
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    await this.assertEmployerOwnsJob(req.user.id, jobId);
    return this.screeningService.getQuestionsForJob(jobId);
  }

  // ── EMPLOYER: Tạo / cập nhật câu hỏi sàng lọc ────────────

  @Post(':jobId/screening')
  @ApiAuth(UserRole.EMPLOYER)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'jobId', type: Number })
  @ApiOperation({
    summary: '[Employer] Tạo / cập nhật câu hỏi sàng lọc (upsert toàn bộ)',
    description:
      'Gửi toàn bộ danh sách câu hỏi. Phương thức này sẽ **xoá hết** câu hỏi cũ và lưu lại danh sách mới. ' +
      'Chỉ áp dụng cho gói VIP (`maxScreeningQuestions > 0`).',
  })
  async upsertQuestions(
    @Req() req: Request & { user: { id: number } },
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body() dto: UpsertScreeningQuestionsDto,
  ) {
    const companyId = await this.assertEmployerOwnsJob(req.user.id, jobId);
    return this.screeningService.upsertQuestions(jobId, companyId, dto);
  }

  // ── CANDIDATE: Xem câu hỏi sàng lọc của một tin ──────────

  @Get(':jobId/screening/public')
  @ApiParam({ name: 'jobId', type: Number })
  @ApiOperation({
    summary: '[Candidate] Xem câu hỏi sàng lọc trước khi ứng tuyển',
  })
  getQuestionsPublic(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.screeningService.getQuestionsForJob(jobId);
  }

  // ── CANDIDATE: Nộp câu trả lời ─────────────────────────────

  @Post('applications/:applicationId/screening/answers')
  @ApiAuth(UserRole.CANDIDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'applicationId', type: Number })
  @ApiOperation({
    summary: '[Candidate] Nộp câu trả lời sàng lọc cho đơn ứng tuyển',
    description:
      'Candidate gửi câu trả lời sau khi apply. ' +
      'Kết quả `screeningPassed` sẽ được cập nhật vào đơn ứng tuyển ngay lập tức nếu có `preferredAnswer`.',
  })
  async submitAnswers(
    @Req() req: Request & { user: { id: number } },
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Body() dto: SubmitScreeningAnswersDto,
  ) {
    const { jobId } = await this.assertCandidateOwnsApplication(
      req.user.id,
      applicationId,
    );
    return this.screeningService.submitAnswers(applicationId, jobId, dto);
  }

  // ── Private helpers ────────────────────────────────────────

  /** Kiểm tra employer sở hữu job. Trả về companyId. */
  private async assertEmployerOwnsJob(
    userId: number,
    jobId: number,
  ): Promise<number> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer?.companyId) {
      throw new ForbiddenException('Tài khoản chưa thuộc công ty nào');
    }

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    return employer.companyId;
  }

  /** Kiểm tra candidate sở hữu application. Trả về jobId. */
  private async assertCandidateOwnsApplication(
    userId: number,
    applicationId: number,
  ): Promise<{ jobId: number }> {
    const candidate = await this.candidateRepo.findOne({ where: { userId } });
    if (!candidate) {
      throw new ForbiddenException('Không tìm thấy hồ sơ ứng viên');
    }

    // Dùng raw query để tránh circular import
    const rows = await this.jobRepo.manager.query<{ job_id: number }[]>(
      `SELECT job_id FROM job_application WHERE id = $1 AND candidate_id = $2`,
      [applicationId, candidate.id],
    );

    if (!rows.length) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc không thuộc về bạn',
      );
    }

    return { jobId: rows[0].job_id };
  }
}
