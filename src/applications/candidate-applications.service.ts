import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity, JobStatus } from '../jobs/entities/job.entity';
import { ApplyJobDto } from './dto/apply-job.dto';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  MatchScoreResult,
  CvMatchScoreResult,
} from './interfaces/matching.interface';
import { CANDIDATE_MATCH_SCORE_PROMPT } from './prompts/candidate-match-score.prompt';
import { CV_MATCH_SCORE_PROMPT } from './prompts/cv-match-score.prompt';

@Injectable()
export class CandidateApplicationsService {
  private readonly logger = new Logger(CandidateApplicationsService.name);
  private genAI: GoogleGenerativeAI;
  private readonly aiModel: string;

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(ApplicationStatusHistoryEntity)
    private readonly historyRepo: Repository<ApplicationStatusHistoryEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    this.aiModel = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.5-flash',
    );
  }

  async apply(userId: number, jobId: number, dto: ApplyJobDto) {
    const candidate = await this.findCandidateByUserId(userId);

    if (!candidate.cvUrl) {
      throw new BadRequestException(
        'Vui lòng tải lên CV trước khi ứng tuyển. Truy cập API POST /api/candidates/cv để upload.',
      );
    }

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }

    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Tin tuyển dụng chưa được phát hành hoặc đã đóng',
      );
    }

    if (job.deadline && new Date(job.deadline) < new Date()) {
      throw new BadRequestException('Tin tuyển dụng đã hết hạn nộp hồ sơ');
    }

    const existing = await this.applicationRepo.findOne({
      where: { jobId, candidateId: candidate.id },
    });

    if (existing) {
      if (existing.status === (ApplicationStatus.WITHDRAWN as string)) {
        await this.dataSource.transaction(async (manager) => {
          existing.status = ApplicationStatus.APPLIED;
          existing.cvUrlSnapshot = candidate.cvUrl;
          existing.coverLetter = dto.coverLetter ?? null;
          existing.rejectionReason = null;
          existing.matchScore = null;
          existing.matchReasoning = null;
          existing.cvMatchScore = null;
          existing.cvMatchReasoning = null;

          const savedApp = await manager.save(JobApplicationEntity, existing);

          const history = manager.create(ApplicationStatusHistoryEntity, {
            applicationId: savedApp.id,
            oldStatus: ApplicationStatus.WITHDRAWN,
            newStatus: ApplicationStatus.APPLIED,
            reason: null,
            changedById: userId,
          });
          await manager.save(ApplicationStatusHistoryEntity, history);
        });

        // Fire and forget AI grading
        this.calculateAiMatchScore(existing.id).catch((err: unknown) => {
          this.logger.error(
            'Error calculating AI match score for re-apply',
            err instanceof Error ? err.stack : String(err),
          );
        });

        return {
          message:
            'Bạn đã từng ứng tuyển công việc này trước đó. Đơn ứng tuyển đã được gửi lại thành công.',
          applicationId: existing.id,
          reapplied: true,
        };
      }

      throw new ConflictException(
        'Bạn đã ứng tuyển công việc này rồi. Không thể nộp đơn trùng lặp.',
      );
    }

    let applicationId: number;

    await this.dataSource.transaction(async (manager) => {
      const application = manager.create(JobApplicationEntity, {
        jobId,
        candidateId: candidate.id,
        cvUrlSnapshot: candidate.cvUrl,
        coverLetter: dto.coverLetter,
        status: ApplicationStatus.APPLIED,
      });
      const saved = await manager.save(JobApplicationEntity, application);
      applicationId = saved.id;

      const history = manager.create(ApplicationStatusHistoryEntity, {
        applicationId: saved.id,
        oldStatus: null,
        newStatus: ApplicationStatus.APPLIED,
        reason: null,
        changedById: userId,
      });
      await manager.save(ApplicationStatusHistoryEntity, history);
    });

    // Fire and forget AI grading
    this.calculateAiMatchScore(applicationId!).catch((err: unknown) => {
      this.logger.error(
        'Error calculating AI match score',
        err instanceof Error ? err.stack : String(err),
      );
    });

    return {
      message: 'Ứng tuyển thành công',
      applicationId: applicationId!,
      reapplied: false,
    };
  }

  async getMyApplications(userId: number, filterDto: ApplicationFilterDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const { page = 1, limit = 10, status } = filterDto;

    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.job', 'job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.province', 'province')
      .leftJoinAndSelect('job.category', 'category')
      .where('app.candidateId = :candidateId', {
        candidateId: candidate.id,
      });

    if (status) {
      qb.andWhere('app.status = :status', { status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getMyApplicationDetail(userId: number, applicationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidateId: candidate.id },
      relations: [
        'job',
        'job.company',
        'job.province',
        'job.category',
        'job.jobType',
        'statusHistory',
      ],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    return application;
  }

  async withdrawApplication(userId: number, applicationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidateId: candidate.id },
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.status === (ApplicationStatus.WITHDRAWN as string)) {
      throw new BadRequestException('Đơn ứng tuyển đã được rút trước đó');
    }

    const nonWithdrawableStatuses = [
      ApplicationStatus.OFFER as string,
      ApplicationStatus.HIRED as string,
    ];
    if (nonWithdrawableStatuses.includes(application.status)) {
      throw new BadRequestException(
        'Không thể rút đơn khi đã nhận đề nghị việc làm hoặc đã được tuyển dụng. Vui lòng liên hệ nhà tuyển dụng.',
      );
    }

    const oldStatus = application.status;
    application.status = ApplicationStatus.WITHDRAWN;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(JobApplicationEntity, application);
      await manager.save(
        ApplicationStatusHistoryEntity,
        manager.create(ApplicationStatusHistoryEntity, {
          applicationId: application.id,
          oldStatus,
          newStatus: ApplicationStatus.WITHDRAWN,
          reason: 'Ứng viên tự rút đơn',
          changedById: userId,
        }),
      );
    });

    return { message: 'Đã rút đơn ứng tuyển thành công' };
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepo.findOne({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException('Hồ sơ ứng viên không tồn tại');
    }
    return candidate;
  }

  // Exposed as public để CandidateHeadhuntingService trigger AI scoring khi candidate accept invitation
  async calculateAiMatchScore(applicationId: number) {
    if (!this.genAI) {
      this.logger.warn('AI API key not configured. Skipping match score.');
      return;
    }

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: [
        'job',
        'job.skills',
        'job.skills.skillMetadata',
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.educations',
        'candidate.workExperiences',
        'candidate.projects',
        'candidate.certificates',
      ],
    });

    if (!application) return;

    const jobData = {
      title: application.job.title,
      requirements: application.job.requirements,
      yearsOfExperience: application.job.yearsOfExperience,
      skillTags:
        application.job.skills?.map((s) => s.skillMetadata?.canonicalName) ||
        [],
    };

    const promises: Promise<void>[] = [];

    promises.push(this.calculateProfileScore(application, jobData));

    if (application.cvUrlSnapshot) {
      promises.push(this.calculateCvScore(application, jobData));
    }

    await Promise.allSettled(promises);
  }

  private async calculateProfileScore(
    application: JobApplicationEntity,
    jobData: Record<string, any>,
  ) {
    const candidateData = {
      yearsOfExperience: application.candidate.yearWorkingExperience,
      skills:
        application.candidate.skills?.map(
          (s) => s.skillMetadata?.canonicalName,
        ) || [],
      workExperiences:
        application.candidate.workExperiences?.map((we) => ({
          position: we.position,
          company: we.companyName,
          description: we.description,
        })) || [],
      projects:
        application.candidate.projects?.map((p) => ({
          name: p.name,
          description: p.description,
        })) || [],
      certificates:
        application.candidate.certificates?.map((c) => ({
          name: c.name,
        })) || [],
    };

    const prompt = CANDIDATE_MATCH_SCORE_PROMPT(jobData, candidateData);

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.aiModel,
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as MatchScoreResult;

      if (typeof parsed.matchScore === 'number') {
        // Fix Race Condition by updating only specific columns
        await this.applicationRepo.update(application.id, {
          matchScore: parsed.matchScore,
          matchReasoning: parsed.reasoning || text,
        });

        this.logger.log(
          'AI Profile Score calculated for App #' +
            application.id +
            ': ' +
            parsed.matchScore,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        'Failed to calculate AI Profile Score for application ' +
          application.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async calculateCvScore(
    application: JobApplicationEntity,
    jobData: Record<string, any>,
  ) {
    try {
      const fileData = await this.fetchBase64Cv(application.cvUrlSnapshot);
      if (!fileData) {
        this.logger.warn(
          'Không thể đọc file CV định dạng này cho App #' + application.id,
        );
        return;
      }

      const prompt = CV_MATCH_SCORE_PROMPT(jobData);
      const model = this.genAI.getGenerativeModel({
        model: this.aiModel,
      });

      const result = await model.generateContent([
        {
          inlineData: {
            data: fileData.base64,
            mimeType: fileData.mimeType,
          },
        },
        prompt,
      ]);

      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in AI CV response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as CvMatchScoreResult;

      if (typeof parsed.cvMatchScore === 'number') {
        // Fix Race Condition by updating only specific columns
        await this.applicationRepo.update(application.id, {
          cvMatchScore: parsed.cvMatchScore,
          cvMatchReasoning: parsed.reasoning || text,
        });

        this.logger.log(
          'AI CV Score calculated for App #' +
            application.id +
            ': ' +
            parsed.cvMatchScore,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        'Failed to calculate AI CV Score for application ' + application.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async fetchBase64Cv(
    url: string | null,
  ): Promise<{ base64: string; mimeType: string } | null> {
    if (!url || !url.startsWith('http')) return null;

    // --- SSRF Protection Start ---
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    if (supabaseUrl) {
      try {
        const urlHost = new URL(url).host;
        const supabaseHost = new URL(supabaseUrl).host;
        if (urlHost !== supabaseHost) {
          this.logger.warn(
            `SSRF Blocked: URL host ${urlHost} does not match ${supabaseHost}`,
          );
          return null;
        }
      } catch {
        return null;
      }
    }
    // --- SSRF Protection End ---

    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
        this.logger.warn(`CV too large (${contentLength} bytes): ${url}`);
        return null; // Ignore files > 10MB
      }

      const mimeType = res.headers.get('content-type') || 'application/pdf';
      if (!mimeType.includes('pdf') && !mimeType.includes('image')) {
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { base64: buffer.toString('base64'), mimeType };
    } catch (e: unknown) {
      this.logger.error('Fetch CV failed: ' + url, e);
      return null;
    }
  }
}
