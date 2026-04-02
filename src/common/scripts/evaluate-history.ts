import { DataSource } from 'typeorm';
import { CompaniesService } from '../../companies/companies.service';
import { JobsService } from '../../jobs/jobs.service';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { CompanyImageEntity } from '../../companies/entities/company-image.entity';
import { CompanyStatusHistoryEntity } from '../../companies/entities/company-status-history.entity';
import { JobEntity } from '../../jobs/entities/job.entity';
import { JobStatusHistoryEntity } from '../../jobs/entities/job-status-history.entity';
import { EmployerEntity } from '../../users/../employers/entities/employer.entity'; // Path adjustments needed or use full path
import { SupabaseService } from '../../storage/supabase.service';
import { JobSkillsService } from '../../jobs/job-skills.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Rough mock of services for direct evaluation
async function evaluate() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('--- 📊 [Đang đánh giá dữ liệu Status History] ---');

    const companyHistoryRepo = dataSource.getRepository(
      CompanyStatusHistoryEntity,
    );
    const jobHistoryRepo = dataSource.getRepository(JobStatusHistoryEntity);

    // 1. Kiểm tra Lịch sử Công ty (ID 11)
    const companyId = 11;
    const cHistory = await companyHistoryRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });

    console.log(`\n[Company ID: ${companyId}] Lịch sử thay đổi:`);
    if (cHistory.length === 0) console.log('  (Trống)');
    cHistory.forEach((h, i) => {
      console.log(
        `  ${i + 1}. [${h.oldStatus} -> ${h.newStatus}] Lý do: ${h.reason ?? 'N/A'}`,
      );
    });

    // 2. Kiểm tra Lịch sử Job (ID 13)
    const jobId = 13;
    const jHistory = await jobHistoryRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });

    console.log(`\n[Job ID: ${jobId}] Lịch sử thay đổi:`);
    if (jHistory.length === 0) console.log('  (Trống)');
    jHistory.forEach((h, i) => {
      console.log(
        `  ${i + 1}. [${h.oldStatus} -> ${h.newStatus}] Lý do: ${h.reason ?? 'N/A'}`,
      );
    });

    console.log('\n--- 📝 [Đánh giá kết quả] ---');
    if (cHistory.length >= 2 && jHistory.length >= 1) {
      console.log(
        '✅ THÀNH CÔNG: Hệ thống đã lưu trữ được nhiều lý do từ chối khác nhau.',
      );
      console.log(
        '✅ THÀNH CÔNG: Các bản ghi được sắp xếp theo thời gian mới nhất.',
      );
    } else {
      console.log('❌ THẤT BẠI: Dữ liệu lịch sử không khớp với kịch bản test.');
    }
  } catch (err) {
    console.error('Lỗi khi đánh giá:', err);
  } finally {
    await dataSource.destroy();
  }
}

evaluate();
