import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmployerEntity } from './entities/employer.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { SetupCompanyDto } from './dto/setup-company.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { AddMemberDto, CompanyRole } from './dto/add-member.dto';
import { SupabaseService } from '../storage/supabase.service';

@Injectable()
export class EmployersService {
  private readonly logger = new Logger(EmployersService.name);
  constructor(
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly supabaseService: SupabaseService,
  ) {}

  async setupCompany(userId: number, dto: SetupCompanyDto) {
    const existingEmployer = await this.employerRepo.findOne({
      where: { userId },
    });
    if (existingEmployer) {
      throw new ConflictException('Tài khoản này đã khởi tạo hồ sơ');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Company
      const company = queryRunner.manager.create(CompanyEntity, {
        userCreatorId: userId,
        categoryId: dto.categoryId,
        name: dto.companyName,
        provinceId: dto.provinceId,
        address: dto.address,
      });
      const savedCompany = await queryRunner.manager.save(company);

      // 2. Create Employer linked to User & Company
      const employer = queryRunner.manager.create(EmployerEntity, {
        userId,
        companyId: savedCompany.id,
        fullName: dto.fullName,
        phoneContact: dto.phoneContact,
        isAdminCompany: true,
      });
      const savedEmployer = await queryRunner.manager.save(employer);

      await queryRunner.commitTransaction();

      return {
        message: 'Khởi tạo công ty và hồ sơ HR thành công',
        employer: savedEmployer,
        company: savedCompany,
      };
    } catch (error: unknown) {
      this.logger.error('Lỗi trong quá trình khởi tạo công ty', error);
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Lỗi trong quá trình khởi tạo công ty');
    } finally {
      await queryRunner.release();
    }
  }

  async getProfile(userId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId },
      relations: ['company'],
    });

    if (!employer) {
      throw new NotFoundException(
        'Không tìm thấy thông tin tài khoản tuyển dụng',
      );
    }

    return employer;
  }

  async updateProfile(userId: number, dto: UpdateEmployerProfileDto) {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer) {
      throw new NotFoundException(
        'Không tìm thấy thông tin tài khoản tuyển dụng',
      );
    }

    Object.assign(employer, dto);
    await this.employerRepo.save(employer);
    return employer;
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Chưa cung cấp file ảnh đại diện');
    }

    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer) {
      throw new NotFoundException(
        'Không tìm thấy thông tin tài khoản tuyển dụng',
      );
    }

    const originalName = file.originalname.replace(/\s+/g, '_');
    const uploadPath = `employers/avatars/${userId}-${Date.now()}-${originalName}`;

    const { publicUrl } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      uploadPath,
      async (url) => {
        employer.avatarUrl = url;
        return this.employerRepo.save(employer);
      },
      employer.avatarUrl
        ? `employers/avatars/${employer.avatarUrl.split('/').pop()}`
        : undefined,
    );

    return {
      message: 'Cập nhật ảnh đại diện thành công',
      avatarUrl: publicUrl,
    };
  }

  // --- QUẢN LÝ THÀNH VIÊN CÔNG TY ---

  async addMember(adminUserId: number, dto: AddMemberDto) {
    // 1. Kiểm tra quyền Admin của công ty
    const adminEmployer = await this.employerRepo.findOne({
      where: { userId: adminUserId },
    });

    if (
      !adminEmployer ||
      !adminEmployer.isAdminCompany ||
      !adminEmployer.companyId
    ) {
      throw new BadRequestException(
        'Bạn không có quyền quản trị công ty hoặc chưa thiết lập công ty',
      );
    }

    // 2. Tìm User theo email
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['employer'],
    });

    if (user) {
      // TRƯỜNG HỢP: Email đã tồn tại
      if (user.role === UserRole.CANDIDATE) {
        throw new ConflictException(
          'Email này đã được sử dụng cho vai trò Ứng viên',
        );
      }

      const employer =
        user.employer ||
        (await this.employerRepo.findOne({ where: { userId: user.id } }));

      if (employer && employer.companyId) {
        throw new ConflictException(
          'Tài khoản này đã thuộc về một công ty khác',
        );
      }

      // Cập nhật thông tin công ty và vai trò
      if (employer) {
        employer.companyId = adminEmployer.companyId;
        employer.isAdminCompany = dto.role === CompanyRole.ADMIN;
        employer.fullName = dto.fullName;
        await this.employerRepo.save(employer);
      } else {
        // User là Employer nhưng chưa có hồ sơ Employer (ít khả năng xảy ra nhưng để chắc chắn)
        const newEmployer = this.employerRepo.create({
          userId: user.id,
          companyId: adminEmployer.companyId,
          fullName: dto.fullName,
          isAdminCompany: dto.role === CompanyRole.ADMIN,
        });
        await this.employerRepo.save(newEmployer);
      }

      return {
        message: 'Đã thêm thành viên vào công ty thành công',
        userId: user.id,
      };
    }

    // TRƯỜNG HỢP: Email chưa tồn tại -> Tạo mới hoàn toàn
    if (!dto.password) {
      throw new BadRequestException('Cần cung cấp mật khẩu cho tài khoản mới');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newUser = queryRunner.manager.create(UserEntity, {
        email: dto.email,
        password: dto.password,
        role: UserRole.EMPLOYER,
      });
      const savedUser = await queryRunner.manager.save(newUser);

      const newEmployer = queryRunner.manager.create(EmployerEntity, {
        userId: savedUser.id,
        companyId: adminEmployer.companyId,
        fullName: dto.fullName,
        isAdminCompany: dto.role === CompanyRole.ADMIN,
      });
      await queryRunner.manager.save(newEmployer);

      await queryRunner.commitTransaction();
      return {
        message: 'Đã tạo tài khoản và thêm thành viên mới thành công',
        userId: savedUser.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getCompanyMembers(userId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId },
    });

    if (!employer || !employer.companyId) {
      throw new BadRequestException('Tài khoản chưa thuộc công ty nào');
    }

    return this.employerRepo.find({
      where: { companyId: employer.companyId },
      relations: ['user'],
      order: { isAdminCompany: 'DESC', fullName: 'ASC' },
    });
  }

  async removeMember(adminUserId: number, targetEmployerId: number) {
    const admin = await this.employerRepo.findOne({
      where: { userId: adminUserId },
    });
    if (!admin || !admin.isAdminCompany) {
      throw new BadRequestException('Bạn không có quyền quản trị công ty');
    }

    const member = await this.employerRepo.findOne({
      where: { id: targetEmployerId },
    });
    if (!member || member.companyId !== admin.companyId) {
      throw new NotFoundException(
        'Không tìm thấy thành viên trong công ty của bạn',
      );
    }

    if (member.userId === adminUserId) {
      throw new BadRequestException(
        'Bạn không thể tự gỡ chính mình khỏi công ty',
      );
    }

    // Gỡ liên kết công ty
    member.companyId = null;
    member.isAdminCompany = false;
    await this.employerRepo.save(member);

    return { message: 'Đã gỡ thành viên khỏi công ty thành công' };
  }
}
