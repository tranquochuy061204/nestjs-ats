import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { CandidateSkillTagEntity } from '../entities/candidate-skill-tag.entity';
import { CandidateJobCategoryEntity } from '../entities/candidate-job-category.entity';
import { JobCategoryMetadataEntity } from '../../metadata/job-categories/job-category.entity';
import { JobTypeMetadataEntity } from '../../metadata/job-types/job-type.entity';
import { SkillsMetadataService } from '../../metadata/skills/skills-metadata.service';
import { AddSkillsDto } from '../dto/add-skills.dto';
import { UpdateJobCategoriesDto } from '../dto/update-job-categories.dto';
import { BadRequestException } from '@nestjs/common';

export const MAX_SKILLS_PER_CANDIDATE = 10;

@Injectable()
export class CandidateSkillsService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(CandidateSkillTagEntity)
    private readonly skillTagRepository: Repository<CandidateSkillTagEntity>,
    @InjectRepository(CandidateJobCategoryEntity)
    private readonly candidateJobCategoryRepository: Repository<CandidateJobCategoryEntity>,
    @InjectRepository(JobCategoryMetadataEntity)
    private readonly jobCategoryRepository: Repository<JobCategoryMetadataEntity>,
    @InjectRepository(JobTypeMetadataEntity)
    private readonly jobTypeRepository: Repository<JobTypeMetadataEntity>,
    private readonly skillsMetadataService: SkillsMetadataService,
  ) {}

  // ─── Skills CRUD ───────────────────────────────────────────

  async getSkills(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.skillTagRepository.find({
      where: { candidateId: candidate.id },
      relations: ['skillMetadata'],
    });
  }

  async addSkills(userId: number, dto: AddSkillsDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const results: CandidateSkillTagEntity[] = [];

    const currentSkillCount = await this.skillTagRepository.count({
      where: { candidateId: candidate.id },
    });

    // We approximate the new skill count by adding the dto.skills length
    // (This might be slightly inaccurate if the DTO contains duplicates or already-existing skills,
    // but it is a fast and safe upper-bound check)
    if (currentSkillCount + dto.skills.length > MAX_SKILLS_PER_CANDIDATE) {
      throw new BadRequestException(
        `Ứng viên không được có quá ${MAX_SKILLS_PER_CANDIDATE} kỹ năng. Bạn hiện có ${currentSkillCount} kỹ năng. Vui lòng xóa bớt trước khi thêm mới.`,
      );
    }

    const ids = dto.skills.filter((s): s is number => typeof s === 'number');
    const rawStrings = dto.skills.filter(
      (s): s is string => typeof s === 'string',
    );

    if (ids.length > 0) {
      const validSkills = await this.skillsMetadataService.findByIds(ids);
      if (validSkills.length > 0) {
        const validIds = validSkills.map((s) => s.id);
        await this.skillsMetadataService.incrementUseCountBulk(validIds);

        const existingTags = await this.skillTagRepository.find({
          where: { candidateId: candidate.id, skillMetadataId: In(validIds) },
        });
        const existingIds = new Set(existingTags.map((t) => t.skillMetadataId));

        const newTags = validIds
          .filter((id) => !existingIds.has(id))
          .map((id) =>
            this.skillTagRepository.create({
              candidateId: candidate.id,
              skillMetadataId: id,
            }),
          );

        if (newTags.length > 0) {
          const saved = await this.skillTagRepository.save(newTags);
          results.push(...saved);
        }
      }
    }

    const unknowns: string[] = [];

    for (const raw of rawStrings) {
      const found = await this.skillsMetadataService.findByFuzzy(raw);
      if (found) {
        await this.skillsMetadataService.incrementUseCount(found.id);
        if (
          raw.trim() !== found.canonicalName &&
          !found.aliases.includes(raw.trim())
        ) {
          found.aliases = [...found.aliases, raw.trim()];
          await this.skillsMetadataService.upsertSkill(
            found.canonicalName,
            found.type,
            raw.trim(),
          );
        }
        const tag = await this.saveSkillTag(candidate.id, found.id);
        if (tag) results.push(tag);
      } else {
        unknowns.push(raw);
      }
    }

    if (unknowns.length > 0) {
      const formatted = await this.skillsMetadataService.formatWithAI(unknowns);

      for (let i = 0; i < formatted.length; i++) {
        const { name, type } = formatted[i];
        const skill = await this.skillsMetadataService.upsertSkill(
          name,
          type,
          unknowns[i].trim(),
        );
        const tag = await this.saveSkillTag(candidate.id, skill.id);
        if (tag) results.push(tag);
      }
    }

    return this.skillTagRepository.find({
      where: { candidateId: candidate.id },
      relations: ['skillMetadata'],
    });
  }

  async deleteSkill(userId: number, skillTagId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const tag = await this.skillTagRepository.findOne({
      where: { id: skillTagId },
    });

    if (!tag) {
      throw new NotFoundException('Skill tag not found');
    }

    if (tag.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this skill',
      );
    }

    await this.skillTagRepository.remove(tag);
    return { message: 'Skill deleted successfully' };
  }

  private async saveSkillTag(
    candidateId: number,
    skillMetadataId: number,
  ): Promise<CandidateSkillTagEntity | null> {
    const existing = await this.skillTagRepository.findOne({
      where: { candidateId, skillMetadataId },
    });
    if (existing) return existing;

    const tag = this.skillTagRepository.create({
      candidateId,
      skillMetadataId,
    });
    return this.skillTagRepository.save(tag);
  }

  // ─── Job Categories CRUD ───────────────────────────────────────────

  async getJobCategories(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.candidateJobCategoryRepository.find({
      where: { candidateId: candidate.id },
      relations: ['jobCategory'],
    });
  }

  async addJobCategories(userId: number, dto: UpdateJobCategoriesDto) {
    const candidate = await this.findCandidateByUserId(userId);

    const validCategories = await this.jobCategoryRepository.find({
      where: { id: In(dto.categoryIds) },
    });

    if (validCategories.length > 0) {
      const validIds = validCategories.map((c) => c.id);

      const existingRefs = await this.candidateJobCategoryRepository.find({
        where: { candidateId: candidate.id, jobCategoryId: In(validIds) },
      });
      const existingIds = new Set(existingRefs.map((r) => r.jobCategoryId));

      const newRefs = validIds
        .filter((id) => !existingIds.has(id))
        .map((id) =>
          this.candidateJobCategoryRepository.create({
            candidateId: candidate.id,
            jobCategoryId: id,
          }),
        );

      if (newRefs.length > 0) {
        await this.candidateJobCategoryRepository.save(newRefs);
      }
    }

    return this.candidateJobCategoryRepository.find({
      where: { candidateId: candidate.id },
      relations: ['jobCategory'],
    });
  }

  async deleteJobCategory(userId: number, id: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const relation = await this.candidateJobCategoryRepository.findOne({
      where: { id },
    });

    if (!relation) {
      throw new NotFoundException('Job category not found');
    }

    if (relation.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this job category',
      );
    }

    await this.candidateJobCategoryRepository.remove(relation);
    return { message: 'Job category removed successfully' };
  }

  // ─── Job Types ───────────────────────────────────────

  async getJobTypes() {
    return this.jobTypeRepository.find();
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }
    return candidate;
  }
}
