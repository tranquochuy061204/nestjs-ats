import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployerApplicationsService } from './employer-applications.service';
import { JobApplicationEntity } from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { ApplicationNoteEntity } from './entities/application-note.entity';
import { DataSource } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('EmployerApplicationsService', () => {
  let service: EmployerApplicationsService;
  let noteRepo: any;
  let appRepo: any;
  let employerRepo: any;

  const mockNoteRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAppRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };

  const mockEmployerRepo = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployerApplicationsService,
        {
          provide: getRepositoryToken(JobApplicationEntity),
          useValue: mockAppRepo,
        },
        {
          provide: getRepositoryToken(ApplicationStatusHistoryEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(JobEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(EmployerEntity),
          useValue: mockEmployerRepo,
        },
        {
          provide: getRepositoryToken(ApplicationNoteEntity),
          useValue: mockNoteRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<EmployerApplicationsService>(
      EmployerApplicationsService,
    );
    noteRepo = module.get(getRepositoryToken(ApplicationNoteEntity));
    appRepo = module.get(getRepositoryToken(JobApplicationEntity));
    employerRepo = module.get(getRepositoryToken(EmployerEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addNote', () => {
    it('should throw NotFoundException if application not found', async () => {
      mockEmployerRepo.findOne.mockResolvedValue({ id: 1, companyId: 1 });
      mockAppRepo.findOne.mockResolvedValue(null);

      await expect(service.addNote(1, 1, { content: 'test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create and save a new note', async () => {
      const mockEmployer = { id: 1, companyId: 1 };
      const mockApp = { id: 1, job: { companyId: 1 } };
      const mockDto = { content: 'New review' };

      mockEmployerRepo.findOne.mockResolvedValue(mockEmployer);
      mockAppRepo.findOne.mockResolvedValue(mockApp);
      mockNoteRepo.create.mockReturnValue({
        ...mockDto,
        authorId: 1,
        applicationId: 1,
      });
      mockNoteRepo.save.mockResolvedValue({ id: 100, ...mockDto });

      const result = await service.addNote(1, 1, mockDto);

      expect(noteRepo.create).toHaveBeenCalledWith({
        applicationId: 1,
        authorId: 1,
        content: mockDto.content,
      });
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(100);
    });
  });

  describe('updateNote', () => {
    it('should throw ForbiddenException if user is not the author', async () => {
      mockEmployerRepo.findOne.mockResolvedValue({ id: 1, companyId: 1 });
      mockNoteRepo.findOne.mockResolvedValue({
        id: 100,
        authorId: 99,
        application: { job: { companyId: 1 } },
      });

      await expect(
        service.updateNote(1, 100, { content: 'edited' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update note content', async () => {
      const mockEmployer = { id: 1, companyId: 1 };
      const mockNote = {
        id: 100,
        authorId: 1,
        content: 'old',
        application: { job: { companyId: 1 } },
      };

      mockEmployerRepo.findOne.mockResolvedValue(mockEmployer);
      mockNoteRepo.findOne.mockResolvedValue(mockNote);
      mockNoteRepo.save.mockImplementation((n) => n);

      const result = await service.updateNote(1, 100, {
        content: 'new content',
      });

      expect(result.content).toBe('new content');
      expect(noteRepo.save).toHaveBeenCalled();
    });
  });
});
