import { DataSource } from 'typeorm';
import {
  CompanyEntity,
  CompanyStatus,
} from '../../companies/entities/company.entity';
import { CompanyStatusHistoryEntity } from '../../companies/entities/company-status-history.entity';
import { JobEntity, JobStatus } from '../../jobs/entities/job.entity';
import { JobStatusHistoryEntity } from '../../jobs/entities/job-status-history.entity';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function seedTestData() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('--- 🚀 [Bật đầu tạo dữ liệu test] ---');

    const companyRepo = dataSource.getRepository(CompanyEntity);
    const companyHistoryRepo = dataSource.getRepository(
      CompanyStatusHistoryEntity,
    );
    const jobRepo = dataSource.getRepository(JobEntity);
    const jobHistoryRepo = dataSource.getRepository(JobStatusHistoryEntity);
    const userRepo = dataSource.getRepository(UserEntity);

    // 1. Tìm hoặc tạo User Employer
    let employerUser = await userRepo.findOne({
      where: { email: 'test_employer@ats.com' },
    });
    if (!employerUser) {
      employerUser = userRepo.create({
        email: 'test_employer@ats.com',
        password: 'password123',
        role: UserRole.EMPLOYER,
      });
      await userRepo.save(employerUser);
    }

    // 2. Tìm hoặc tạo Công ty Test
    let testCompany = await companyRepo.findOne({
      where: { name: 'Công ty Test Audit Log' },
    });
    if (!testCompany) {
      testCompany = companyRepo.create({
        name: 'Công ty Test Audit Log',
        userCreatorId: employerUser.id,
        categoryId: 1, // Giả sử category 1 tồn tại
        status: CompanyStatus.IDLE,
      });
      await companyRepo.save(testCompany);
    }

    // 3. Giả lập luồng từ chối Doanh nghiệp nhiều lần
    console.log('--- Đang tạo lịch sử cho Doanh nghiệp ---');

    // Lần 1: Từ PENDING sang REJECTED
    testCompany.status = CompanyStatus.REJECTED;
    testCompany.rejectionReason =
      'Ảnh giấy phép quá mờ, không nhìn rõ mã số thuế.';
    await companyRepo.save(testCompany);
    await companyHistoryRepo.save(
      companyHistoryRepo.create({
        companyId: testCompany.id,
        oldStatus: CompanyStatus.PENDING,
        newStatus: CompanyStatus.REJECTED,
        reason: testCompany.rejectionReason,
      }),
    );

    // Lần 2: Từ REJECTED (cũ) sang REJECTED (mới)
    testCompany.rejectionReason =
      'Thiếu bản gốc đối chiếu, vui lòng gửi bản scan màu.';
    await companyRepo.save(testCompany);
    await companyHistoryRepo.save(
      companyHistoryRepo.create({
        companyId: testCompany.id,
        oldStatus: CompanyStatus.REJECTED,
        newStatus: CompanyStatus.REJECTED,
        reason: testCompany.rejectionReason,
      }),
    );

    // 4. Tìm hoặc tạo Job Test
    console.log('--- Đang tạo lịch sử cho Tin tuyển dụng ---');
    let testJob = await jobRepo.findOne({
      where: { title: 'Lập trình viên Node.js (Test AI Skills)' },
    });
    if (!testJob) {
      testJob = jobRepo.create({
        title: 'Lập trình viên Node.js (Test AI Skills)',
        companyId: testCompany.id,
        employerId: 1, // Giả định ID 1 là employerId hợp lệ
        description: 'Test description',
        status: JobStatus.DRAFT,
      });
      await jobRepo.save(testJob);
    }

    // Lần 1: Bị từ chối vì nội dung ngắn
    testJob.status = JobStatus.REJECTED;
    testJob.rejectionReason =
      'Mô tả công việc quá ngắn, vui lòng bổ sung ít nhất 50 từ.';
    await jobRepo.save(testJob);
    await jobHistoryRepo.save(
      jobHistoryRepo.create({
        jobId: testJob.id,
        oldStatus: JobStatus.PENDING,
        newStatus: JobStatus.REJECTED,
        reason: testJob.rejectionReason,
      }),
    );

    console.log('--- ✅ [Hoàn tất tạo dữ liệu test] ---');
    console.log(`- Company ID: ${testCompany.id}`);
    console.log(`- Job ID: ${testJob.id}`);
    console.log('Bạn có thể gọi API history theo các ID này để kiểm tra.');
  } catch (err) {
    console.error('Lỗi khi seed dữ liệu:', err);
  } finally {
    await dataSource.destroy();
  }
}

void seedTestData();
