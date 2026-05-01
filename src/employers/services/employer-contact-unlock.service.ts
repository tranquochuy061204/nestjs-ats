import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { EmployerEntity } from '../entities/employer.entity';
import { ContactUnlockLogEntity } from '../../subscriptions/entities/contact-unlock-log.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { CreditsService } from '../../credits/credits.service';
import { CreditTransactionType } from '../../credits/entities/credit-transaction.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Injectable()
export class EmployerContactUnlockService {
  private readonly logger = new Logger(EmployerContactUnlockService.name);

  /** Credit charge khi xem profile nếu không phải VIP free quota */
  private static readonly CONTACT_UNLOCK_CREDIT_COST = 5;

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(ContactUnlockLogEntity)
    private readonly contactUnlockRepo: Repository<ContactUnlockLogEntity>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Ẩn thông tin nhạy cảm của ứng viên nếu chưa được mở khoá.
   */
  public maskCandidate(
    candidate: CandidateEntity,
    isUnlocked: boolean,
  ): Record<string, unknown> {
    const { user, ...candidateData } = candidate;

    // Email extracted from user relation
    const email = user?.email || '';

    // Mask user email if relation exists
    let maskedUser: Record<string, unknown> | undefined = undefined;
    if (user) {
      const userRef = { ...user } as Record<string, any>;
      delete userRef.password;
      delete userRef.emailVerificationToken;
      delete userRef.resetPasswordToken;

      if (!isUnlocked) {
        userRef.email = '********@***.***';
      }
      maskedUser = userRef;
    }

    const baseResult = {
      ...(candidateData as any),
      user: maskedUser,
      email: isUnlocked ? email : '********@***.***', // Flattened email
    } as Record<string, any>;

    if (!isUnlocked) {
      return {
        ...baseResult,
        phone: '0*********',
        cvUrl: '',
        linkedinUrl: '',
        githubUrl: '',
        portfolioUrl: '',
        contactUnlocked: false,
      };
    }

    return {
      ...baseResult,
      contactUnlocked: true,
    };
  }

  /**
   * Lấy danh sách IDs ứng viên đã được công ty mở khoá trong một tập hợp cho trước.
   */
  async getUnlockedCandidateIds(
    companyId: number,
    candidateIds: number[],
  ): Promise<number[]> {
    if (!candidateIds.length) return [];

    const logs = await this.contactUnlockRepo.find({
      where: {
        companyId,
        candidateId: In(candidateIds),
      },
      select: ['candidateId'],
    });

    return logs.map((log) => log.candidateId);
  }

  async getCandidateDetail(employerUserId: number, candidateId: number) {
    const employer = await this.findEmployerWithCompany(employerUserId);
    const companyId = employer.companyId;

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, isPublic: true },
      relations: [
        'user',
        'jobType',
        'skills',
        'skills.skillMetadata',
        'workExperiences',
        'educations',
        'projects',
        'certificates',
        'jobCategories',
        'jobCategories.jobCategory',
      ],
    });

    if (!candidate) {
      throw new NotFoundException(
        'Không tìm thấy ứng viên hoặc hồ sơ không được công khai',
      );
    }

    const existingUnlock = await this.contactUnlockRepo.findOne({
      where: { companyId, candidateId },
    });

    return this.maskCandidate(candidate, !!existingUnlock);
  }

  async unlockCandidateContact(employerUserId: number, candidateId: number) {
    const employer = await this.findEmployerWithCompany(employerUserId);
    const companyId = employer.companyId;

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, isPublic: true },
      relations: [
        'user',
        'jobType',
        'skills',
        'skills.skillMetadata',
        'workExperiences',
        'educations',
        'projects',
        'certificates',
        'jobCategories',
        'jobCategories.jobCategory',
      ],
    });

    if (!candidate) {
      throw new NotFoundException(
        'Không tìm thấy ứng viên hoặc hồ sơ không được công khai',
      );
    }

    // ─── Idempotent atomic unlock (SELECT FOR UPDATE prevents race conditions) ──
    let creditSpent = 0;

    await this.dataSource.transaction(async (manager) => {
      // Lock potential existing row to prevent concurrent duplicate inserts
      const existing = await manager.query<{ id: number }[]>(
        `SELECT id FROM contact_unlock_log
         WHERE company_id = $1 AND candidate_id = $2
         LIMIT 1
         FOR UPDATE`,
        [companyId, candidateId],
      );

      // Already unlocked — exit early without charging
      if (existing.length > 0) {
        return;
      }

      // Calculate fee inside the transaction (atomic with the INSERT)
      const { package: pkg } =
        await this.subscriptionsService.getActiveSubscription(companyId);

      creditSpent = EmployerContactUnlockService.CONTACT_UNLOCK_CREDIT_COST;

      if (pkg.freeContactUnlock) {
        const firstOfMonth = new Date();
        firstOfMonth.setDate(1);
        firstOfMonth.setHours(0, 0, 0, 0);

        const [{ count }] = await manager.query<{ count: string }[]>(
          `SELECT COUNT(*) as count FROM contact_unlock_log
           WHERE company_id = $1 AND unlocked_at >= $2`,
          [companyId, firstOfMonth],
        );

        const usedThisMonth = parseInt(count, 10);
        if (
          pkg.monthlyHeadhuntProfileViews === -1 ||
          usedThisMonth < pkg.monthlyHeadhuntProfileViews
        ) {
          creditSpent = 0;
        }
      }

      // Charge credit first (throws if insufficient balance)
      if (creditSpent > 0) {
        await this.creditsService.chargeCreditWithManager(
          manager,
          companyId,
          creditSpent,
          {
            type: CreditTransactionType.CONTACT_UNLOCK,
            description: `Mở khoá liên hệ ứng viên #${candidateId}`,
            referenceType: 'candidate',
            referenceId: candidateId,
            createdBy: employerUserId,
          },
        );
      }

      // Insert log AFTER successful charge
      await manager.query(
        `INSERT INTO contact_unlock_log (company_id, candidate_id, credit_spent)
         VALUES ($1, $2, $3)`,
        [companyId, candidateId, creditSpent],
      );
    });

    this.logger.log(
      `Contact unlock: company=${companyId} candidate=${candidateId} creditSpent=${creditSpent}`,
    );

    if (candidate.user) {
      const userRef = candidate.user as Partial<UserEntity> &
        Record<string, unknown>;
      delete userRef.password;
      delete userRef.emailVerificationToken;
      delete userRef.resetPasswordToken;
    }

    return {
      ...this.maskCandidate(candidate, true),
      creditSpent,
    };
  }

  async getQuota(employerUserId: number) {
    const employer = await this.findEmployerWithCompany(employerUserId);
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(employer.companyId);

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const usedThisMonth = await this.contactUnlockRepo
      .createQueryBuilder('ul')
      .where('ul.company_id = :companyId', { companyId: employer.companyId })
      .andWhere('ul.unlocked_at >= :firstOfMonth', { firstOfMonth })
      .getCount();

    return {
      totalMonthlyQuota: pkg.monthlyHeadhuntProfileViews,
      usedThisMonth,
      remainingThisMonth:
        pkg.monthlyHeadhuntProfileViews === -1
          ? -1
          : Math.max(0, pkg.monthlyHeadhuntProfileViews - usedThisMonth),
      canUsePremiumFilters: pkg.canUsePremiumFilters,
      freeContactUnlock: pkg.freeContactUnlock,
    };
  }

  async getUnlockedCandidates(
    employerUserId: number,
    page: number,
    limit: number,
  ) {
    const employer = await this.findEmployerWithCompany(employerUserId);

    const [logs, total] = await this.contactUnlockRepo.findAndCount({
      where: { companyId: employer.companyId },
      order: { unlockedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (logs.length === 0) {
      return {
        data: [],
        total,
        page,
        lastPage: Math.ceil(total / limit),
      };
    }

    const candidateIds = logs.map((log) => log.candidateId);
    
    // Batch load relations to avoid huge JOINS / Cartesian products in pagination
    const candidates = await this.candidateRepo.find({
      where: { id: In(candidateIds) },
      relations: [
        'jobType',
        'skills',
        'skills.skillMetadata',
        'jobCategories',
        'jobCategories.jobCategory',
        'user',
      ],
    });

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));

    const data = logs.map((log) => {
      const candidate = candidateMap.get(log.candidateId);
      if (!candidate) return null;
      
      if (candidate.user) {
        const userRef = candidate.user as Partial<UserEntity> & Record<string, unknown>;
        delete userRef.password;
        delete userRef.emailVerificationToken;
        delete userRef.resetPasswordToken;
      }
      return {
        ...candidate,
        unlockedAt: log.unlockedAt,
        creditSpent: log.creditSpent,
      };
    }).filter(Boolean);

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  private async findEmployerWithCompany(employerUserId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId: employerUserId },
      relations: ['company'],
    });

    if (!employer || !employer.companyId) {
      throw new ForbiddenException(
        'Bạn chưa có công ty hoặc chưa được duyệt để thực hiện chức năng này',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
