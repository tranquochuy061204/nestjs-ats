import { dataSource } from '../../../typeorm.config';
import { JobLevelMetadataEntity } from '../../metadata/job-levels/job-level.entity';

async function seed() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(JobLevelMetadataEntity);

  const levels = [
    { name: 'Intern (Thực tập sinh)', slug: 'intern' },
    { name: 'Fresher (Mới tốt nghiệp)', slug: 'fresher' },
    { name: 'Junior (Nhân viên)', slug: 'junior' },
    { name: 'Middle/Senior (Chuyên viên)', slug: 'middle-senior' },
    { name: 'Lead/Manager (Quản lý)', slug: 'manager' },
  ];

  console.log('Seeding Job Levels...');
  for (const level of levels) {
    const exists = await repo.findOne({ where: { slug: level.slug } });
    if (!exists) {
      await repo.save(repo.create(level));
      console.log(`Added: ${level.name}`);
    } else {
      console.log(`Skipped (already exists): ${level.name}`);
    }
  }

  await dataSource.destroy();
  console.log('Seeding completed.');
}

seed().catch((err) => {
  console.error('Error seeding job levels:', err);
  process.exit(1);
});
