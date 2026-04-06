import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { JobSkillTagEntity } from './entities/job-skill-tag.entity';
import { SkillsMetadataService } from '../metadata/skills/skills-metadata.service';

@Injectable()
export class JobSkillsService {
  private readonly logger = new Logger(JobSkillsService.name);

  constructor(
    @InjectRepository(JobSkillTagEntity)
    private readonly jobSkillRepo: Repository<JobSkillTagEntity>,
    private readonly skillsMetadataService: SkillsMetadataService,
  ) {}

  /**
   * Sync skills for a job — Includes AI normalization for raw text tags
   */
  async syncJobSkills(
    manager: EntityManager,
    jobId: number,
    skills: { skillId?: number; tagText?: string }[],
  ) {
    // 1. Remove old skills first
    await manager.delete(JobSkillTagEntity, { jobId });

    if (!skills || skills.length === 0) return;

    const skillRecords: Partial<JobSkillTagEntity>[] = [];
    const rawStrings: string[] = [];

    // 2. Separate IDs from raw strings
    for (const s of skills) {
      if (s.skillId) {
        skillRecords.push({ jobId, skillId: s.skillId });
      } else if (s.tagText && s.tagText.trim()) {
        rawStrings.push(s.tagText.trim());
      }
    }

    // 3. Process raw strings (AI Normalization) - Fixed N+1 issues
    if (rawStrings.length > 0) {
      // 3.1 Fetch fuzzy search concurrently
      const fuzzyResults = await Promise.all(
        rawStrings.map((raw) => this.skillsMetadataService.findByFuzzy(raw)),
      );

      const unmatchedRawStrings: string[] = [];
      for (let i = 0; i < rawStrings.length; i++) {
        const found = fuzzyResults[i];
        if (found) {
          skillRecords.push({ jobId, skillId: found.id });
          await this.skillsMetadataService.incrementUseCount(found.id);
        } else {
          unmatchedRawStrings.push(rawStrings[i]);
        }
      }

      // 3.2 AI calls are bundled entirely
      if (unmatchedRawStrings.length > 0) {
        const formatted = await this.skillsMetadataService.formatWithAI(
          unmatchedRawStrings,
        );
        if (formatted && formatted.length > 0) {
          for (let i = 0; i < formatted.length; i++) {
            const { name, type } = formatted[i];
            const raw = unmatchedRawStrings[i] || name;
            const skill = await this.skillsMetadataService.upsertSkill(
              name,
              type,
              raw,
            );
            skillRecords.push({ jobId, skillId: skill.id });
          }
        }
      }
    }

    // 4. Batch insert all resolved skills
    if (skillRecords.length > 0) {
      const uniqueRecords = this.deduplicateSkills(skillRecords);
      await manager.insert(JobSkillTagEntity, uniqueRecords);
    }
  }

  private deduplicateSkills(records: Partial<JobSkillTagEntity>[]) {
    const seen = new Set();
    return records.filter((r) => {
      if (seen.has(r.skillId)) return false;
      seen.add(r.skillId);
      return true;
    });
  }
}
