import { Test, TestingModule } from '@nestjs/testing';
import { EmployersService } from './employers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployerEntity } from './entities/employer.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { DataSource } from 'typeorm';
import { SupabaseService } from '../storage/supabase.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CompanyRole } from './dto/add-member.dto';

describe('EmployersService', () => {
  let service: EmployersService;
  let employerRepo: any;
  let userRepo: any;
  let dataSource: any;

  const mockEmployerRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCompanyRepo = {};
  const mockSupabaseService = {};

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployersService,
        { provide: getRepositoryToken(EmployerEntity), useValue: mockEmployerRepo },
        { provide: getRepositoryToken(CompanyEntity), useValue: mockCompanyRepo },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<EmployersService>(EmployersService);
    employerRepo = module.get(getRepositoryToken(EmployerEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    dataSource = module.get(DataSource);
  });

  describe('addMember', () => {
    const adminUserId = 1;
    const adminEmployer = { userId: 1, companyId: 10, isAdminCompany: true };
    const dto = {
      email: 'new@example.com',
      fullName: 'New Recruiter',
      role: CompanyRole.RECRUITER,
      password: 'password123',
    };

    it('should throw BadRequest if inviter is not an admin', async () => {
      employerRepo.findOne.mockResolvedValue({ ...adminEmployer, isAdminCompany: false });
      await expect(service.addMember(adminUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw Conflict if email is used by a Candidate', async () => {
      employerRepo.findOne.mockResolvedValue(adminEmployer);
      userRepo.findOne.mockResolvedValue({ role: UserRole.CANDIDATE });
      await expect(service.addMember(adminUserId, dto)).rejects.toThrow(ConflictException);
    });

    it('should link existing Employer to company if they are currently unlinked', async () => {
      employerRepo.findOne.mockResolvedValueOnce(adminEmployer); // For admin check
      userRepo.findOne.mockResolvedValue({ id: 2, role: UserRole.EMPLOYER });
      const existingEmployer = { id: 20, userId: 2, companyId: null };
      employerRepo.findOne.mockResolvedValueOnce(existingEmployer); // For target check

      const result = await service.addMember(adminUserId, dto);

      expect(employerRepo.save).toHaveBeenCalled();
      expect(result.message).toContain('Đã thêm thành viên vào công ty thành công');
    });

    it('should create a new User and Employer if email does not exist', async () => {
      employerRepo.findOne.mockResolvedValue(adminEmployer);
      userRepo.findOne.mockResolvedValue(null);
      
      mockQueryRunner.manager.create.mockReturnValueOnce({ id: 2, email: dto.email }); // Mock User
      mockQueryRunner.manager.save.mockResolvedValueOnce({ id: 2 });
      mockQueryRunner.manager.create.mockReturnValueOnce({ id: 20 }); // Mock Employer
      
      const result = await service.addMember(adminUserId, dto);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.message).toContain('Đã tạo tài khoản và thêm thành viên mới thành công');
    });
  });

  describe('removeMember', () => {
    it('should unlink member from company', async () => {
      const admin = { userId: 1, companyId: 10, isAdminCompany: true };
      const member = { id: 20, userId: 2, companyId: 10 };
      
      employerRepo.findOne
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(member);

      const result = await service.removeMember(1, 20);

      expect(member.companyId).toBeNull();
      expect(employerRepo.save).toHaveBeenCalledWith(member);
      expect(result.message).toContain('thành công');
    });
  });
});
