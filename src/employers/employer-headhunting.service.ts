import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { CertificateEntity } from '../candidates/entities/certificate.entity';
import { SavedCandidateEntity } from './entities/saved-candidate.entity';
import { EmployerEntity } from './entities/employer.entity';
import { JobEntity, JobStatus } from '../jobs/entities/job.entity';
import {
  JobInvitationEntity,
  InvitationStatus,
} from '../jobs/entities/job-invitation.entity';
import { HeadhuntingFilterDto } from './dto/headhunting-filter.dto';
import { SaveCandidateDto } from './dto/save-candidate.dto';
import { CreateJobInvitationDto } from '../jobs/dto/create-job-invitation.dto';

@Injectable()
export class EmployerHeadhuntingService {
  private readonly logger = new Logger(EmployerHeadhuntingService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(CertificateEntity)
    private readonly certificateRepo: Repository<CertificateEntity>,
    @InjectRepository(SavedCandidateEntity)
    private readonly savedCandidateRepo: Repository<SavedCandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobInvitationEntity)
    private readonly invitationRepo: Repository<JobInvitationEntity>,
  ) {}

  async getSuggestedCandidates(employerUserId: number, jobId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
      relations: ['skills'],
    });

    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Chỉ có thể gợi ý ứng viên cho tin tuyển dụng đang đăng tuyển (PUBLISHED)',
      );
    }

    // Guard: categoryId missing - log warning but keep going (fallback to skill-only)
    if (!job.categoryId) {
      this.logger.warn(
        `Job #${jobId} missing categoryId. Results will be less accurate.`,
      );
    }

    const jobSkillIds = job.skills
      .map((s) => s.skillId)
      .filter((id): id is number => id != null);

    // ----------------------------------------------------------------
    // FIX #1: Tách thành 2-step query để tránh PostgreSQL GROUP BY crash
    //   Bước 1: Raw query chỉ lấy candidate_id + scores (GROUP BY c.id OK)
    //   Bước 2: Fetch full entities theo danh sách IDs
    // ----------------------------------------------------------------
    const rawQb = this.candidateRepo.createQueryBuilder('c');

    if (job.categoryId) {
      rawQb.innerJoin('c.jobCategories', 'cjc');
    } else {
      rawQb.leftJoin('c.jobCategories', 'cjc'); // Optional if no category set
    }

    rawQb
      .leftJoin(
        'c.skills',
        'cst',
        // FIX #2: Dùng property name (skillMetadataId) thay vì raw column
        jobSkillIds.length > 0 ? 'cst.skillMetadataId IN (:...skills)' : '1=0',
        jobSkillIds.length > 0 ? { skills: jobSkillIds } : {},
      )
      // FIX #3: Chỉ select c.id để GROUP BY hoạt động đúng
      .select('c.id', 'candidateId')
      .addSelect('COUNT(DISTINCT cst.skillMetadataId)', 'matchedSkills')
      // FIX #4: Dùng Entity class trong subquery thay vì raw string
      .addSelect((sub) => {
        return sub
          .select('COUNT(cert.id)', 'cnt')
          .from(CertificateEntity, 'cert')
          .where('cert.candidateId = c.id');
      }, 'certBonus')

      // LỚP 1: LỌC CỨNG
      .where('c.isPublic = true');

    if (job.categoryId) {
      rawQb.andWhere('cjc.jobCategoryId = :jobCategoryId', {
        jobCategoryId: job.categoryId,
      });
    }

    rawQb.andWhere('COALESCE(c.yearWorkingExperience, 0) >= :minExp', {
      minExp: job.yearsOfExperience ?? 0,
    });

    // FIX #6: Guard NULL jobTypeId (không thêm điều kiện nếu job chưa set)
    if (job.jobTypeId) {
      rawQb.andWhere('c.jobTypeId = :jobTypeId', { jobTypeId: job.jobTypeId });
    }

    // FIX #7: Guard NULL provinceId
    if (job.provinceId) {
      rawQb.andWhere('(c.provinceId = :provinceId OR c.provinceId IS NULL)', {
        provinceId: job.provinceId,
      });
    }

    // FIX #8: Dùng alias đã select và hàm aggregate cho các cột không nằm trong GROUP BY
    rawQb
      .groupBy('c.id')
      .orderBy('matchedSkills', 'DESC')
      .addOrderBy('MAX(c.yearWorkingExperience)', 'DESC')
      .limit(50);

    const rawRows = await rawQb.getRawMany<{
      candidateId: string; // Raw query trả về string
      matchedSkills: string;
      certBonus: string;
    }>();

    if (rawRows.length === 0) return [];

    const orderedIds = rawRows.map((r) => Number(r.candidateId));
    const scoreMap = new Map(
      rawRows.map((r) => [
        parseInt(String(r.candidateId), 10),
        {
          matchedSkillsCount: parseInt(r.matchedSkills || '0', 10),
          certificateBonusCount: parseInt(r.certBonus || '0', 10),
        },
      ]),
    );

    // Bước 2: Fetch full entities theo IDs đã có score
    const entities = await this.candidateRepo.find({
      where: { id: In(orderedIds) },
      relations: ['skills', 'skills.skillMetadata', 'jobCategories', 'jobType'],
    });

    // Preserve thứ tự theo score
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    return orderedIds
      .map((id) => {
        const entity = entityMap.get(id);
        if (!entity) return null;
        return { ...entity, ...scoreMap.get(id) };
      })
      .filter(Boolean);
  }

  async searchCandidates(employerUserId: number, filter: HeadhuntingFilterDto) {
    await this.findEmployerByUserId(employerUserId);

    const {
      keyword,
      provinceId,
      jobCategoryId,
      jobTypeId,
      minExperience,
      page,
      limit,
    } = filter;

    const qb = this.candidateRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.skills', 'skills')
      .leftJoinAndSelect('skills.skillMetadata', 'skillMeta')
      // FIX: Dùng property name thay vì raw column
      .where('c.isPublic = true');

    if (jobCategoryId) {
      // FIX: ON condition dùng property name để TypeORM map đúng
      qb.innerJoin('c.jobCategories', 'cjc', 'cjc.jobCategoryId = :catId', {
        catId: jobCategoryId,
      });
    }

    if (keyword) {
      // FIX: Dùng property name
      qb.andWhere(
        '(c.position ILIKE :kw OR c.bio ILIKE :kw OR c.fullName ILIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    if (provinceId) {
      qb.andWhere('c.provinceId = :provinceId', { provinceId });
    }

    if (jobTypeId) {
      qb.andWhere('c.jobTypeId = :jobTypeId', { jobTypeId });
    }

    if (minExperience !== undefined) {
      qb.andWhere('COALESCE(c.yearWorkingExperience, 0) >= :minExp', {
        minExp: minExperience,
      });
    }

    qb.orderBy('c.yearWorkingExperience', 'DESC').addOrderBy('c.id', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getCandidateDetail(employerUserId: number, candidateId: number) {
    await this.findEmployerByUserId(employerUserId);

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, isPublic: true },
      relations: [
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

    return candidate;
  }

  async saveCandidate(
    employerUserId: number,
    candidateId: number,
    dto: SaveCandidateDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, isPublic: true },
    });
    if (!candidate) {
      throw new NotFoundException('Ứng viên không tồn tại hoặc đã ẩn hồ sơ');
    }

    let saved = await this.savedCandidateRepo.findOne({
      where: { employerId: employer.id, candidateId },
    });

    if (saved) {
      saved.note = dto.note || saved.note;
    } else {
      saved = this.savedCandidateRepo.create({
        employerId: employer.id,
        candidateId,
        note: dto.note,
      });
    }

    return this.savedCandidateRepo.save(saved);
  }

  async unsaveCandidate(employerUserId: number, candidateId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);
    const result = await this.savedCandidateRepo.delete({
      employerId: employer.id,
      candidateId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Ứng viên chưa được lưu trong Talent Pool');
    }

    return { message: 'Đã xóa ứng viên khỏi Talent Pool' };
  }

  async getSavedCandidates(employerUserId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    return this.savedCandidateRepo.find({
      where: { employerId: employer.id },
      relations: [
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.jobCategories',
        'candidate.jobType',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async sendJobInvitation(employerUserId: number, dto: CreateJobInvitationDto) {
    const employer = await this.findEmployerByUserId(employerUserId);

    // FIX: Kiểm tra Job tồn tại + thuộc công ty + đang PUBLISHED
    const job = await this.jobRepo.findOne({
      where: { id: dto.jobId, companyId: employer.companyId },
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

    const invitation = this.invitationRepo.create({
      employerId: employer.id,
      candidateId: dto.candidateId,
      jobId: dto.jobId,
      message: dto.message,
      status: InvitationStatus.PENDING,
    });

    return this.invitationRepo.save(invitation);
  }

  async getSentInvitations(employerUserId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);
    return this.invitationRepo.find({
      where: { employerId: employer.id },
      relations: ['candidate', 'job'],
      order: { createdAt: 'DESC' },
    });
  }

  private async findEmployerByUserId(userId: number): Promise<EmployerEntity> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    if (!employer.companyId) {
      throw new ForbiddenException('Tài khoản chưa thuộc công ty nào');
    }
    return employer;
  }
}
