import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  JobInvitationEntity,
  InvitationStatus,
} from '../../jobs/entities/job-invitation.entity';
import { CandidateEntity } from '../entities/candidate.entity';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from '../../applications/entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from '../../applications/entities/application-status-history.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

@Injectable()
export class CandidateHeadhuntingService {
  constructor(
    @InjectRepository(JobInvitationEntity)
    private readonly invitationRepo: Repository<JobInvitationEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMyInvitations(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.invitationRepo.find({
      where: { candidateId: candidate.id },
      relations: ['job', 'job.company', 'employer'],
      order: { createdAt: 'DESC' },
    });
  }

  async acceptInvitation(userId: number, invitationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, candidateId: candidate.id },
      relations: ['employer', 'job'],
    });

    if (!invitation) throw new NotFoundException('Không tìm thấy thư mời');
    if (invitation.status !== (InvitationStatus.PENDING as string)) {
      throw new BadRequestException('Thư mời này đã được xử lý trước đó');
    }

    // Kiểm tra xem đã ứng tuyển chưa (trường hợp hi hữu)
    const existingApp = await this.applicationRepo.findOne({
      where: { jobId: invitation.jobId, candidateId: candidate.id },
    });
    if (
      existingApp &&
      existingApp.status !== (ApplicationStatus.WITHDRAWN as string)
    ) {
      invitation.status = InvitationStatus.ACCEPTED;
      await this.invitationRepo.save(invitation);
      return {
        message:
          'Bạn đã ứng tuyển công việc này rồi. Thư mời đã được cập nhật trạng thái.',
      };
    }

    // Chuyển status & Tạo Application trong 1 Transaction
    await this.dataSource.transaction(async (manager) => {
      // 1. Cập nhật trạng thái thư mời
      invitation.status = InvitationStatus.ACCEPTED;
      await manager.save(JobInvitationEntity, invitation);

      // 2. Tạo đơn ứng tuyển mới
      const application = manager.create(JobApplicationEntity, {
        jobId: invitation.jobId,
        candidateId: candidate.id,
        cvUrlSnapshot: candidate.cvUrl,
        status: ApplicationStatus.APPLIED,
        // Có thể lưu note là "Ứng tuyển từ thư mời" nếu cần
      });
      const savedApp = await manager.save(JobApplicationEntity, application);

      // 3. Lưu lịch sử trạng thái đơn
      const history = manager.create(ApplicationStatusHistoryEntity, {
        applicationId: savedApp.id,
        oldStatus: null,
        newStatus: ApplicationStatus.APPLIED,
        reason: 'Chấp nhận lời mời từ nhà tuyển dụng',
        changedById: userId,
      });
      await manager.save(ApplicationStatusHistoryEntity, history);
    });

    // --- REAL-TIME NOTIFICATION ---
    await this.notificationsService.createNotification({
      userId: invitation.employer.userId,
      type: NotificationType.HEADHUNT_ACCEPT,
      title: 'Chấp nhận lời mời làm việc',
      content: `Ứng viên ${candidate.fullName || 'Một ai đó'} đã chấp nhận lời mời ứng tuyển cho vị trí "${invitation.job.title}".`,
      metadata: {
        jobId: invitation.jobId,
        candidateId: candidate.id,
        invitationId: invitation.id,
      },
    });

    return { message: 'Đã chấp nhận thư mời và tạo đơn ứng tuyển thành công' };
  }

  async declineInvitation(userId: number, invitationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, candidateId: candidate.id },
      relations: ['employer', 'job'],
    });

    if (!invitation) throw new NotFoundException('Không tìm thấy thư mời');
    if (invitation.status !== (InvitationStatus.PENDING as string)) {
      throw new BadRequestException('Thư mời này đã được xử lý trước đó');
    }

    invitation.status = InvitationStatus.DECLINED;
    await this.invitationRepo.save(invitation);

    // --- REAL-TIME NOTIFICATION ---
    await this.notificationsService.createNotification({
      userId: invitation.employer.userId,
      type: NotificationType.HEADHUNT_REJECT,
      title: 'Từ chối lời mời làm việc',
      content: `Ứng viên ${candidate.fullName || 'Một ai đó'} đã từ chối lời mời ứng tuyển cho vị trí "${invitation.job.title}".`,
      metadata: {
        jobId: invitation.jobId,
        candidateId: candidate.id,
        invitationId: invitation.id,
      },
    });

    return { message: 'Đã từ chối thư mời' };
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepo.findOne({ where: { userId } });
    if (!candidate) throw new NotFoundException('Hồ sơ ứng viên không tồn tại');
    return candidate;
  }
}
