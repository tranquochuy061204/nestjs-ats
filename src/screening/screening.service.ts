import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    // Xoá câu hỏi cũ của job này
    await this.questionRepo.delete({ jobId });

    // Tạo mới
    const questions = dto.questions.map((q, idx) =>
      this.questionRepo.create({
        jobId,
        questionText: q.questionText,
        questionType: q.questionType ?? ScreeningQuestionType.TEXT,
        options: q.options ? JSON.stringify(q.options) : null,
        preferredAnswer: q.preferredAnswer ?? null,
        isRequired: q.isRequired ?? true,
        sortOrder: q.sortOrder ?? idx,
      }),
    );

    return this.questionRepo.save(questions);
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
   * Trả về: { answers, screeningPassed }
   */
  async submitAnswers(
    applicationId: number,
    jobId: number,
    dto: SubmitScreeningAnswersDto,
  ): Promise<{ screeningPassed: boolean | null }> {
    const questions = await this.getQuestionsForJob(jobId);
    if (questions.length === 0) return { screeningPassed: null };

    const answerMap = new Map(
      dto.answers.map((a) => [a.questionId, a.answerText]),
    );

    // Validate required
    for (const q of questions) {
      if (q.isRequired && !answerMap.get(q.id)) {
        throw new BadRequestException(
          `Câu hỏi bắt buộc chưa được trả lời: "${q.questionText}"`,
        );
      }
    }

    // Lưu answers
    const answers = questions
      .filter((q) => answerMap.has(q.id))
      .map((q) =>
        this.answerRepo.create({
          applicationId,
          questionId: q.id,
          answerText: answerMap.get(q.id)!,
        }),
      );
    await this.answerRepo.save(answers);

    // Tính screening_passed
    const screeningPassed = this.computeScreeningPassed(questions, answerMap);
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
