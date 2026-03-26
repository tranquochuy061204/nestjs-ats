import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmployerEntity } from './entities/employer.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { SetupCompanyDto } from './dto/setup-company.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { SupabaseService } from '../storage/supabase.service';

@Injectable()
export class EmployersService {
  constructor(
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
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
      const company = this.companyRepo.create({
        userCreatorId: userId,
        categoryId: dto.categoryId,
        name: dto.companyName,
        provinceId: dto.provinceId,
        address: dto.address,
      });
      const savedCompany = await queryRunner.manager.save(
        CompanyEntity,
        company,
      );

      // 2. Create Employer linked to User & Company
      const employer = this.employerRepo.create({
        userId,
        companyId: savedCompany.id,
        fullName: dto.fullName,
        phoneContact: dto.phoneContact,
        isAdminCompany: true,
      });
      const savedEmployer = await queryRunner.manager.save(
        EmployerEntity,
        employer,
      );

      await queryRunner.commitTransaction();

      return {
        message: 'Khởi tạo công ty và hồ sơ HR thành công',
        employer: savedEmployer,
        company: savedCompany,
      };
    } catch (error) {
      console.log(error);
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
    const path = `employers/avatars/${userId}-${Date.now()}-${originalName}`;
    const avatarUrl = await this.supabaseService.uploadFile(file, path);

    employer.avatarUrl = avatarUrl;
    await this.employerRepo.save(employer);

    return {
      message: 'Cập nhật ảnh đại diện thành công',
      avatarUrl,
    };
  }
}
