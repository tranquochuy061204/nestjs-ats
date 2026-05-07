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
import { ApplicationScoringService } from './application-scoring.service';
import {
  JobInvitationEntity,
  InvitationStatus,
} from '../jobs/entities/job-invitation.entity';

@Injectable()
export class CandidateApplicationsService {
  private readonly logger = new Logger(CandidateApplicationsService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobInvitationEntity)
    private readonly invitationRepo: Repository<JobInvitationEntity>,
    private readonly dataSource: DataSource,
    private readonly applicationScoringService: ApplicationScoringService,
  ) {}

  async apply(userId: number, jobId: number, dto: ApplyJobDto) {
    const candidate = await this.findCandidateByUserId(userId);

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

    if (job.requireCv && !candidate.cvUrl) {
      throw new BadRequestException({
        message:
          'Tin tuyển dụng này yêu cầu bắt buộc có CV. Vui lòng tải lên CV trước khi ứng tuyển.',
        errorCode: 'CV_REQUIRED',
      });
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

          // --- AUTO-ACCEPT PENDING INVITATION (RE-APPLY CASE) ---
          const pendingInvitation = await manager.findOne(JobInvitationEntity, {
            where: {
              jobId,
              candidateId: candidate.id,
              status: InvitationStatus.PENDING,
            },
          });

          if (pendingInvitation) {
            pendingInvitation.status = InvitationStatus.ACCEPTED;
            await manager.save(JobInvitationEntity, pendingInvitation);
          }
        });

        void this.applicationScoringService.triggerAiScoringIfVip(
          existing.id,
          job.companyId,
        );

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

      // --- AUTO-ACCEPT PENDING INVITATION ---
      const pendingInvitation = await manager.findOne(JobInvitationEntity, {
        where: {
          jobId,
          candidateId: candidate.id,
          status: InvitationStatus.PENDING,
        },
      });

      if (pendingInvitation) {
        pendingInvitation.status = InvitationStatus.ACCEPTED;
        await manager.save(JobInvitationEntity, pendingInvitation);
      }

      const history = manager.create(ApplicationStatusHistoryEntity, {
        applicationId: saved.id,
        oldStatus: null,
        newStatus: ApplicationStatus.APPLIED,
        reason: null,
        changedById: userId,
      });
      await manager.save(ApplicationStatusHistoryEntity, history);
    });

    void this.applicationScoringService.triggerAiScoringIfVip(
      applicationId!,
      job.companyId,
    );

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
    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();

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
}
