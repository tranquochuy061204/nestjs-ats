import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { JobEntity } from '../src/jobs/entities/job.entity';
import { CandidateEntity } from '../src/candidates/entities/candidate.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function debugSearch() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const jobRepo = app.get<Repository<JobEntity>>(getRepositoryToken(JobEntity));
  const candidateRepo = app.get<Repository<CandidateEntity>>(
    getRepositoryToken(CandidateEntity),
  );

  const job = await jobRepo.findOne({
    where: { id: 76 },
    relations: ['skills', 'skills.skillMetadata'],
  });

  if (!job) {
    console.log('Job 76 not found');
    await app.close();
    return;
  }

  console.log('--- JOB 76 DETAILS ---');
  console.log(`Title: ${job.title}`);
  console.log(`Province: ${job.provinceId}`);
  console.log(`Category: ${job.categoryId}`);
  console.log(`Level: ${job.levelId}`);
  console.log(`Salary: ${job.salaryMin} - ${job.salaryMax}`);
  console.log(
    `Skills: ${job.skills.map((s: any) => s.skillMetadata?.canonicalName).join(', ')}`,
  );

  // Tìm thử ứng viên có lương thấp
  const candidates = await candidateRepo.find({
    relations: [
      'skills',
      'skills.skillMetadata',
      'jobCategories',
      'jobCategories.jobCategory',
    ],
  });

  console.log('\n--- CANDIDATES ANALYSIS ---');
  candidates.forEach((c: any) => {
    const reasons = [];
    if (job.provinceId && c.provinceId !== job.provinceId)
      reasons.push(
        `Province mismatch (Job: ${job.provinceId}, Can: ${c.provinceId})`,
      );
    if (job.levelId && c.levelId !== job.levelId)
      reasons.push(`Level mismatch (Job: ${job.levelId}, Can: ${c.levelId})`);

    const jobSkills = new Set(job.skills.map((s: any) => s.skillMetadataId));
    const canSkills = c.skills.map((s: any) => s.skillMetadataId);
    const hasSkill = canSkills.some((id: number) => jobSkills.has(id));
    if (jobSkills.size > 0 && !hasSkill) reasons.push(`No matching skills`);

    const jobCat = job.categoryId;
    const canCats = new Set(c.jobCategories.map((jc: any) => jc.jobCategoryId));
    if (jobCat && !canCats.has(jobCat))
      reasons.push(
        `Category mismatch (Job: ${jobCat}, Can: ${[...canCats].join(',')})`,
      );

    const sMin = Number(job.salaryMin) || 0;
    const sMax = Number(job.salaryMax) || 999999999;
    const cMin = Number(c.salaryMin) || 0;
    const cMax = Number(c.salaryMax) || 999999999;
    const overlap =
      (c.salaryMin === null || cMin <= sMax) &&
      (c.salaryMax === null || cMax >= sMin);
    if (!overlap)
      reasons.push(
        `Salary mismatch (Job: ${sMin}-${sMax}, Can: ${cMin}-${cMax})`,
      );

    if (reasons.length === 0) {
      console.log(`[MATCH] Candidate #${c.id}: ${c.fullName}`);
    } else {
      if (!reasons.some((r: string) => r.includes('Salary mismatch'))) {
        console.log(
          `[POTENTIAL] Candidate #${c.id}: ${c.fullName} matches salary but failed: ${reasons.join(', ')}`,
        );
      }
    }
  });

  await app.close();
}

debugSearch().catch((err) => {
  console.error(err);
  process.exit(1);
});
