import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { EmployerEntity } from '../entities/employer.entity';
import { JobEntity, JobStatus } from '../../jobs/entities/job.entity';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from '../../applications/entities/job-application.entity';
import {
  JobInvitationEntity,
  InvitationStatus,
} from '../../jobs/entities/job-invitation.entity';
import { CreateJobInvitationDto } from '../../jobs/dto/create-job-invitation.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { MailService } from '../../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmployerInvitationService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobInvitationEntity)
    private readonly invitationRepo: Repository<JobInvitationEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async sendJobInvitation(employerUserId: number, dto: CreateJobInvitationDto) {
    const employer = await this.findEmployerWithCompany(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: dto.jobId, companyId: employer.companyId },
      relations: ['company'],
    });

    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }
    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Chỉ có thể gửi thư mời cho tin tuyển dụng đang đăng tuyển',
      );
    }

    const candidate = await this.candidateRepo.findOne({
      where: { id: dto.candidateId, isPublic: true },
      relations: ['user'],
    });
    if (!candidate) {
      throw new NotFoundException('Ứng viên không tồn tại hoặc đã ẩn hồ sơ');
    }

    const existing = await this.invitationRepo.findOne({
      where: { jobId: dto.jobId, candidateId: dto.candidateId },
    });
    if (existing) {
      throw new BadRequestException(
        'Bạn đã gửi thư mời cho ứng viên này vào vị trí này rồi',
      );
    }

    // --- CHECK IF CANDIDATE ALREADY APPLIED ---
    const existingApp = await this.applicationRepo.findOne({
      where: {
        jobId: dto.jobId,
        candidateId: dto.candidateId,
        status: Not(ApplicationStatus.WITHDRAWN),
      },
    });
    if (existingApp) {
      throw new BadRequestException(
        'Ứng viên này đã nộp đơn ứng tuyển vào vị trí này rồi',
      );
    }

    const invitation = this.invitationRepo.create({
      employerId: employer.id,
      candidateId: dto.candidateId,
      jobId: dto.jobId,
      message: dto.message,
      status: InvitationStatus.PENDING,
    });

    const savedInvitation = await this.invitationRepo.save(invitation);

    // --- REAL-TIME NOTIFICATION ---
    await this.notificationsService.createNotification({
      userId: candidate.userId,
      type: NotificationType.HEADHUNT_INVITATION,
      title: 'Lời mời công việc mới',
      content: `Bạn nhận được lời mời ứng tuyển vào vị trí "${job.title}" từ công ty ${job.company?.name || 'nhà tuyển dụng'}.`,
      metadata: {
        jobId: job.id,
        invitationId: savedInvitation.id,
      },
    });

    // --- EMAIL NOTIFICATION ---
    if (candidate.user?.email) {
      const appUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      const actionUrl = `${appUrl}/candidate/invitations/${savedInvitation.id}`;

      void this.mailService.sendJobInvitationEmail(
        candidate.user.email,
        candidate.fullName || 'Ứng viên',
        job.title,
        job.company?.name || 'Công ty',
        actionUrl,
        dto.message || undefined,
      );
    }

    return savedInvitation;
  }

  async getSentInvitations(employerUserId: number) {
    const employer = await this.findEmployer(employerUserId);
    return this.invitationRepo.find({
      where: { employerId: employer.id },
      relations: ['candidate', 'job'],
      order: { createdAt: 'DESC' },
    });
  }

  private async findEmployer(userId: number): Promise<EmployerEntity> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    return employer;
  }

  private async findEmployerWithCompany(
    userId: number,
  ): Promise<EmployerEntity & { companyId: number }> {
    const employer = await this.findEmployer(userId);
    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException(
        'Bạn đã bị xóa khỏi công ty. Vui lòng liên hệ admin để được hỗ trợ.',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
