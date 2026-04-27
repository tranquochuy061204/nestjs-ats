import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ScreeningQuestionEntity,
  ScreeningQuestionType,
} from './entities/screening-question.entity';
import { ScreeningAnswerEntity } from './entities/screening-answer.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface UpsertScreeningQuestionsDto {
  questions: Array<{
    id?: number;
    questionText: string;
    questionType: ScreeningQuestionType;
    options?: string[];
    preferredAnswer?: string;
    isRequired?: boolean;
    sortOrder?: number;
  }>;
}

export interface SubmitScreeningAnswersDto {
  answers: Array<{
    questionId: number;
    answerText: string;
  }>;
}

@Injectable()
export class ScreeningService {
  constructor(
    @InjectRepository(ScreeningQuestionEntity)
    private readonly questionRepo: Repository<ScreeningQuestionEntity>,
    @InjectRepository(ScreeningAnswerEntity)
    private readonly answerRepo: Repository<ScreeningAnswerEntity>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────────────
  // EMPLOYER — quản lý câu hỏi
  // ──────────────────────────────────────────────────────

  async upsertQuestions(
    jobId: number,
    companyId: number,
    dto: UpsertScreeningQuestionsDto,
  ): Promise<ScreeningQuestionEntity[]> {
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(companyId);

    if (pkg.maxScreeningQuestions === 0) {
      throw new ForbiddenException(
        'Tính năng Câu hỏi sàng lọc yêu cầu gói VIP',
      );
    }

    if (dto.questions.length > pkg.maxScreeningQuestions) {
      throw new BadRequestException(
        `Gói ${pkg.displayName} chỉ cho phép tối đa ${pkg.maxScreeningQuestions} câu hỏi/tin`,
      );
    }

    // Dùng transaction: xóa cũ + insert mới atomic
    return this.dataSource.transaction(async (manager) => {
      await manager.delete(ScreeningQuestionEntity, { jobId });

      const questions = dto.questions.map((q, idx) =>
        manager.create(ScreeningQuestionEntity, {
          jobId,
          questionText: q.questionText,
          questionType: q.questionType ?? ScreeningQuestionType.TEXT,
          options: q.options ? JSON.stringify(q.options) : null,
          preferredAnswer: q.preferredAnswer ?? null,
          isRequired: q.isRequired ?? true,
          sortOrder: q.sortOrder ?? idx,
        }),
      );

      return manager.save(ScreeningQuestionEntity, questions);
    });
  }

  async getQuestionsForJob(jobId: number): Promise<ScreeningQuestionEntity[]> {
    return this.questionRepo.find({
      where: { jobId },
      order: { sortOrder: 'ASC' },
    });
  }

  // ──────────────────────────────────────────────────────
  // CANDIDATE — nộp câu trả lời
  // ──────────────────────────────────────────────────────

  /**
   * Validate required questions, save answers, compute screening_passed.
   * Trả về: { screeningPassed }
   *
   * Fixes:
   *  - [BUG#1] Ghi screening_passed ngược lại vào job_application
   *  - [BUG#2] Validate chuỗi rỗng + trim
   *  - [BUG#3] Idempotent: dùng INSERT ... ON CONFLICT DO UPDATE (upsert)
   */
  async submitAnswers(
    applicationId: number,
    jobId: number,
    dto: SubmitScreeningAnswersDto,
  ): Promise<{ screeningPassed: boolean | null }> {
    const questions = await this.getQuestionsForJob(jobId);
    if (questions.length === 0) return { screeningPassed: null };

    // [BUG#2 FIX] Trim và coi chuỗi rỗng sau trim là "chưa trả lời"
    const answerMap = new Map(
      dto.answers.map((a) => [a.questionId, a.answerText.trim()]),
    );

    // Validate required — reject chuỗi rỗng
    for (const q of questions) {
      const ans = answerMap.get(q.id);
      if (q.isRequired && (!ans || ans === '')) {
        throw new BadRequestException(
          `Câu hỏi bắt buộc chưa được trả lời: "${q.questionText}"`,
        );
      }
    }

    // [BUG#1 + BUG#3 FIX] Dùng transaction + upsert để idempotent + ghi screening_passed
    const screeningPassed = this.computeScreeningPassed(questions, answerMap);

    await this.dataSource.transaction(async (manager) => {
      // Upsert answers — idempotent khi submit nhiều lần
      const answerRows = questions
        .filter((q) => answerMap.has(q.id) && answerMap.get(q.id) !== '')
        .map((q) => ({
          applicationId,
          questionId: q.id,
          answerText: answerMap.get(q.id)!,
        }));

      if (answerRows.length > 0) {
        // PostgreSQL upsert: conflict on (application_id, question_id) → update answer
        await manager
          .createQueryBuilder()
          .insert()
          .into(ScreeningAnswerEntity)
          .values(answerRows)
          .orUpdate(['answer_text'], ['application_id', 'question_id'])
          .execute();
      }

      // [BUG#1 FIX] Ghi screening_passed về job_application
      await manager.query(
        `UPDATE job_application SET screening_passed = $1 WHERE id = $2`,
        [screeningPassed, applicationId],
      );
    });

    return { screeningPassed };
  }

  /**
   * Logic auto-tag:
   * - Nếu có câu nào với preferred_answer → so sánh.
   *   - Tất cả đúng → true
   *   - Ít nhất 1 sai → false
   * - Nếu không có câu nào với preferred_answer → null (chờ employer review)
   */
  private computeScreeningPassed(
    questions: ScreeningQuestionEntity[],
    answerMap: Map<number, string>,
  ): boolean | null {
    const gradableQuestions = questions.filter(
      (q) => q.preferredAnswer !== null,
    );

    if (gradableQuestions.length === 0) return null;

    for (const q of gradableQuestions) {
      const answer = answerMap.get(q.id) ?? '';
      if (answer.toLowerCase() !== q.preferredAnswer!.toLowerCase()) {
        return false;
      }
    }
    return true;
  }
}
