import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { JobProfileViewEntity } from '../subscriptions/entities/job-profile-view.entity';
import { ApplicationScoringService } from './application-scoring.service';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class EmployerApplicationsService {
  private readonly logger = new Logger(EmployerApplicationsService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobProfileViewEntity)
    private readonly profileViewRepo: Repository<JobProfileViewEntity>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creditsService: CreditsService,
    private readonly applicationScoringService: ApplicationScoringService,
  ) {}

  async getJobApplications(
    employerUserId: number,
    jobId: number,
    filterDto: ApplicationFilterDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    const { page = 1, limit = 10, status } = filterDto;

    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.candidate', 'candidate')
      .leftJoinAndSelect('candidate.skills', 'skills')
      .leftJoinAndSelect('skills.skillMetadata', 'skillMetadata')
      .where('app.jobId = :jobId', { jobId });

    if (status) {
      qb.andWhere('app.status = :status', { status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    const skip = (page - 1) * limit;
    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getKanbanBoard(employerUserId: number, jobId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    const columns = [
      { id: ApplicationStatus.APPLIED, title: 'Mới ứng tuyển' },
      { id: ApplicationStatus.SHORTLISTED, title: 'Tiềm năng' },
      { id: ApplicationStatus.SKILL_TEST, title: 'Skill Test' },
      { id: ApplicationStatus.INTERVIEW, title: 'Phỏng vấn' },
      { id: ApplicationStatus.OFFER, title: 'Gửi đề nghị' },
      { id: ApplicationStatus.HIRED, title: 'Đã tuyển' },
      { id: ApplicationStatus.REJECTED, title: 'Đã từ chối' },
      { id: ApplicationStatus.WITHDRAWN, title: 'Đã rút đơn' },
    ];

    const counts = await this.applicationRepo
      .createQueryBuilder('app')
      .select('app.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('app.jobId = :jobId', { jobId })
      .groupBy('app.status')
      .getRawMany<{ status: string; count: number }>();

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.status, row.count);
    }

    const columnPromises = columns.map(async (col) => {
      const items = await this.applicationRepo.find({
        where: { jobId, status: col.id },
        relations: [
          'candidate',
          'candidate.skills',
          'candidate.skills.skillMetadata',
        ],
        order: { appliedAt: 'DESC' },
        take: 10,
      });

      return {
        id: col.id,
        title: col.title,
        count: countMap.get(col.id) || 0,
        items,
      };
    });

    return Promise.all(columnPromises);
  }

  async getApplicationDetail(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: {
        id: applicationId,
        job: { companyId: employer.companyId },
      },
      relations: [
        'job',
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.workExperiences',
        'candidate.projects',
        'candidate.certificates',
        'statusHistory',
        'notes',
        'notes.author',
        'notes.author.employer',
      ],
      order: {
        notes: { createdAt: 'DESC' },
      },
    });

    if (!application) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền truy cập',
      );
    }

    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(employer.companyId);

    let profileViewsRemaining: number | null = null;

    if (pkg.maxProfileViewsPerJob === -1) {
      profileViewsRemaining = -1;
    } else {
      const limit = pkg.maxProfileViewsPerJob;
      const [viewedCount, alreadyViewed] = await Promise.all([
        this.profileViewRepo
          .createQueryBuilder('pv')
          .innerJoin('pv.job', 'job')
          .where('job.company_id = :companyId', { companyId: employer.companyId })
          .getCount(),
        this.profileViewRepo
          .createQueryBuilder('pv')
          .innerJoin('pv.job', 'job')
          .where('job.company_id = :companyId', { companyId: employer.companyId })
          .andWhere('pv.candidate_id = :candidateId', {
            candidateId: application.candidateId,
          })
          .getOne(),
      ]);

      if (!alreadyViewed) {
        if (viewedCount >= limit) {
          throw new ForbiddenException(
            `Bạn đã đạt giới hạn xem ${limit} hồ sơ ứng tuyển của gói hiện tại. Vui lòng nâng cấp VIP để xem không giới hạn.`,
          );
        }
        await this.profileViewRepo.save(
          this.profileViewRepo.create({
            jobId: application.jobId,
            candidateId: application.candidateId,
          }),
        );
        profileViewsRemaining = limit - viewedCount - 1;
      } else {
        profileViewsRemaining = limit - viewedCount;
      }
    }

    return { ...application, profileViewsRemaining };
  }

  async manuallyTriggerAiScoring(
    employerUserId: number,
    applicationId: number,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });

    if (!application || application.job.companyId !== employer.companyId) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    if (
      application.status === (ApplicationStatus.WITHDRAWN as string) ||
      application.status === (ApplicationStatus.REJECTED as string)
    ) {
      throw new BadRequestException(
        'Không thể phân tích AI cho đơn ứng tuyển đã bị rút hoặc từ chối',
      );
    }

    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(employer.companyId);

    if (!pkg.freeAiScoring) {
      await this.creditsService.purchaseProduct(
        employer.companyId,
        'ai_scoring',
        application.job.id,
        employerUserId,
      );
    }

    void this.applicationScoringService.calculateAiMatchScore(application.id);

    return {
      message:
        'Đã mua lượt phân tích AI thành công. Hệ thống đang xử lý ngầm, vui lòng tải lại trang sau ít phút.',
      applicationId,
    };
  }

  public async findEmployerByUserId(userId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId },
    });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException(
        'Bạn phải tham gia vào một công ty trước khi quản lý ứng tuyển',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
