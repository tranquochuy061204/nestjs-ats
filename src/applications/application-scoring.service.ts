import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplicationEntity } from './entities/job-application.entity';
import { ConfigService } from '@nestjs/config';
import {
  MatchScoreResult,
  CvMatchScoreResult,
} from './interfaces/matching.interface';
import { CANDIDATE_MATCH_SCORE_PROMPT } from './prompts/candidate-match-score.prompt';
import { CV_MATCH_SCORE_PROMPT } from './prompts/cv-match-score.prompt';
import { AiProviderService } from '../common/ai/ai-provider.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class ApplicationScoringService {
  private readonly logger = new Logger(ApplicationScoringService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    private readonly configService: ConfigService,
    private readonly aiProvider: AiProviderService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Fire-and-forget AI scoring.
   * VIP: tự động chạy ngay khi apply.
   * Free: bỏ qua — employer phải trigger thủ công.
   */
  public triggerAiScoringIfVip(
    applicationId: number,
    companyId: number | null | undefined,
  ): void {
    if (!companyId) return;

    void this.subscriptionsService
      .getActiveSubscription(companyId)
      .then(({ package: pkg }: { package: Record<string, any> }) => {
        if (!pkg.freeAiScoring) {
          this.logger.debug(
            `AI scoring skipped for application ${applicationId} — company ${companyId} is on Free plan`,
          );
          return;
        }
        return this.calculateAiMatchScore(applicationId);
      })
      .catch((err: unknown) => {
        this.logger.error(
          `triggerAiScoringIfVip failed for application ${applicationId}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
  }

  async calculateAiMatchScore(applicationId: number) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: [
        'job',
        'job.skills',
        'job.skills.skillMetadata',
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.educations',
        'candidate.workExperiences',
        'candidate.projects',
        'candidate.certificates',
      ],
    });

    if (!application) return;

    const jobData = {
      title: application.job.title,
      requirements: application.job.requirements,
      yearsOfExperience: application.job.yearsOfExperience,
      skillTags:
        application.job.skills?.map(
          (s: { skillMetadata?: { canonicalName: string } }) =>
            s.skillMetadata?.canonicalName,
        ) || [],
    };

    const promises: Promise<void>[] = [];

    promises.push(this.calculateProfileScore(application, jobData));

    if (application.cvUrlSnapshot) {
      promises.push(this.calculateCvScore(application, jobData));
    }

    await Promise.allSettled(promises);
  }

  private async calculateProfileScore(
    application: JobApplicationEntity,
    jobData: Record<string, any>,
  ) {
    const candidateData = {
      yearsOfExperience: application.candidate.yearWorkingExperience,
      skills:
        application.candidate.skills?.map(
          (s: { skillMetadata?: { canonicalName: string } }) =>
            s.skillMetadata?.canonicalName,
        ) || [],
      workExperiences:
        application.candidate.workExperiences?.map(
          (we: {
            position: string;
            companyName: string;
            description: string;
          }) => ({
            position: we.position,
            company: we.companyName,
            description: we.description,
          }),
        ) || [],
      projects:
        application.candidate.projects?.map(
          (p: { name: string; description: string }) => ({
            name: p.name,
            description: p.description,
          }),
        ) || [],
      certificates:
        application.candidate.certificates?.map((c: { name: string }) => ({
          name: c.name,
        })) || [],
    };

    const prompt = CANDIDATE_MATCH_SCORE_PROMPT(jobData, candidateData);

    try {
      const text = await this.aiProvider.generateText(prompt);
      const parsed = this.parseAiJsonResult(text) as MatchScoreResult;

      if (typeof parsed.matchScore === 'number') {
        await this.applicationRepo.update(application.id, {
          matchScore: parsed.matchScore,
          matchReasoning: parsed.reasoning || text,
        });

        this.logger.log(
          'AI Profile Score calculated for App #' +
            application.id +
            ': ' +
            parsed.matchScore,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to calculate AI Profile Score for application ${application.id}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async calculateCvScore(
    application: JobApplicationEntity,
    jobData: Record<string, any>,
  ) {
    try {
      const fileData = await this.fetchBase64Cv(application.cvUrlSnapshot);
      if (!fileData) {
        this.logger.warn(
          `Không thể đọc file CV định dạng này cho App #${application.id}`,
        );
        return;
      }

      const prompt = CV_MATCH_SCORE_PROMPT(jobData);
      const text = await this.aiProvider.generateWithFile(prompt, fileData);

      const parsed = this.parseAiJsonResult(text) as CvMatchScoreResult;

      if (typeof parsed.cvMatchScore === 'number') {
        await this.applicationRepo.update(application.id, {
          cvMatchScore: parsed.cvMatchScore,
          cvMatchReasoning: parsed.reasoning || text,
        });

        this.logger.log(
          `AI CV Score calculated for App #${application.id}: ${parsed.cvMatchScore}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to calculate AI CV Score for application ${application.id}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private parseAiJsonResult(text: string): Record<string, any> {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in AI response');
    }

    const jsonString = jsonMatch[0];
    try {
      return JSON.parse(jsonString) as Record<string, any>;
    } catch {
      this.logger.warn(
        'JSON parse failed, attempting regex extraction fallback...',
      );

      const result: Record<string, any> = {};

      const matchScoreMatch = jsonString.match(/"matchScore"\s*:\s*(\d+)/);
      if (matchScoreMatch) {
        result.matchScore = parseInt(matchScoreMatch[1], 10);
      }

      const cvMatchScoreMatch = jsonString.match(/"cvMatchScore"\s*:\s*(\d+)/);
      if (cvMatchScoreMatch) {
        result.cvMatchScore = parseInt(cvMatchScoreMatch[1], 10);
      }

      const reasoningMatch = jsonString.match(
        /"reasoning"\s*:\s*"([\s\S]*?)"\s*\}/,
      );
      if (reasoningMatch) {
        result.reasoning = reasoningMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"');
      }

      if (Object.keys(result).length === 0) {
        throw new Error('Regex extraction also failed');
      }

      return result;
    }
  }

  private async fetchBase64Cv(
    url: string | null,
  ): Promise<{ base64: string; mimeType: string; buffer: Buffer } | null> {
    if (!url || !url.startsWith('http')) return null;

    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    if (supabaseUrl) {
      try {
        const urlHost = new URL(url).host;
        const supabaseHost = new URL(supabaseUrl).host;
        if (urlHost !== supabaseHost) {
          this.logger.warn(
            `SSRF Blocked: URL host ${urlHost} does not match ${supabaseHost}`,
          );
          return null;
        }
      } catch {
        return null;
      }
    }

    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
        this.logger.warn(`CV too large (${contentLength} bytes): ${url}`);
        return null;
      }

      const mimeType = res.headers.get('content-type') || 'application/pdf';
      if (!mimeType.includes('pdf') && !mimeType.includes('image')) {
        this.logger.warn(
          `CV score skipped — unsupported MIME type "${mimeType}" for URL: ${url}`,
        );
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { base64: buffer.toString('base64'), mimeType, buffer };
    } catch (e: unknown) {
      this.logger.error(`Fetch CV failed: ${url}`, e);
      return null;
    }
  }
}
