import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
// pdf-parse version 2.x uses a class-based API
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (options: { data: Buffer }) => {
    getText(): Promise<{ text: string }>;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PDF_TEXT_MIN_LENGTH = 50; // ký tự tối thiểu để coi là extract thành công

// ─── Types ────────────────────────────────────────────────────────────────────

import { FileData } from './interfaces/file-data.interface';

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * AiProviderService — Lớp trừu tượng AI trung tâm.
 *
 * Primary:  Gemini (Google Generative AI SDK)
 * Fallback: GLM-4.5-Air qua OpenRouter (OpenAI-compatible REST)
 * Bridge:   pdf-parse — extract text từ PDF buffer để GLM đọc được
 *
 * Public API:
 *   generateText(prompt)          — text-only, có fallback GLM ✅
 *   generateWithFile(prompt,file) — multimodal Gemini, fallback qua pdf-parse ✅
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly geminiModel: string;
  private readonly openrouterApiKey: string | null;
  private readonly openrouterModel: string;

  constructor(private readonly configService: ConfigService) {
    // ── Gemini setup ──
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(geminiApiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY not set — Gemini primary disabled');
    }
    this.geminiModel = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.5-flash',
    );

    // ── OpenRouter / GLM setup ──
    this.openrouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY') ?? null;
    this.openrouterModel = this.configService.get<string>(
      'OPENROUTER_MODEL',
      'z-ai/glm-4.5-air:free',
    );

    if (!this.openrouterApiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set — GLM fallback disabled');
    }
  }

  // ─── Public: Text-only ───────────────────────────────────────────────────

  /**
   * Gửi text prompt tới AI.
   * Luồng: Gemini → (nếu lỗi) → GLM-4.5-Air (OpenRouter)
   */
  async generateText(prompt: string): Promise<string> {
    // 1. Thử Gemini
    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: this.geminiModel,
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        this.logger.log(
          `[AI Primary] Successfully generated text using Gemini (${text.length} chars)`,
        );
        return text;
      } catch (geminiError: unknown) {
        this.logger.warn(
          `Gemini generateText failed: ${this._errMsg(geminiError)}. Trying GLM fallback...`,
        );
      }
    }

    // 2. Fallback → GLM
    return this._callOpenRouter(prompt);
  }

  // ─── Public: Multimodal (file + prompt) ──────────────────────────────────

  /**
   * Gửi file (PDF/ảnh) + text prompt tới AI.
   *
   * Luồng:
   *   1. Gemini multimodal (inlineData + prompt)
   *   2. Nếu Gemini lỗi + mimeType = PDF → pdf-parse → GLM text
   *   3. Nếu Gemini lỗi + mimeType = image/* → throw (không thể extract text)
   */
  async generateWithFile(prompt: string, file: FileData): Promise<string> {
    // 1. Thử Gemini multimodal
    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: this.geminiModel,
        });
        const result = await model.generateContent([
          { inlineData: { data: file.base64, mimeType: file.mimeType } },
          prompt,
        ]);
        const text = result.response.text().trim();
        this.logger.log(
          `[AI Primary] Successfully generated multimodal content using Gemini (${text.length} chars)`,
        );
        return text;
      } catch (geminiError: unknown) {
        this.logger.warn(
          `Gemini generateWithFile failed: ${this._errMsg(geminiError)}. Attempting PDF text-extraction fallback...`,
        );
      }
    }

    // 2. Fallback — chỉ khả dụng cho PDF
    if (!file.mimeType.includes('pdf')) {
      throw new Error(
        'AI tạm thời không khả dụng. File ảnh cần Gemini để xử lý — vui lòng thử lại sau.',
      );
    }

    const extractedText = await this._extractPdfText(file);
    if (!extractedText) {
      throw new Error(
        'AI tạm thời không khả dụng và CV có vẻ là file scan (không có text layer). ' +
          'Vui lòng thử lại sau hoặc điền thông tin thủ công.',
      );
    }

    this.logger.log(
      `PDF text extracted (${extractedText.length} chars) — using GLM fallback`,
    );

    // Bọc text vào prompt cho GLM
    const textPrompt =
      `[NOTE: The original CV file could not be read by the primary AI. ` +
      `The following is the raw text extracted from the PDF. Process it according to the instructions below.]\n\n` +
      `=== CV TEXT START ===\n${extractedText}\n=== CV TEXT END ===\n\n` +
      prompt;

    return this._callOpenRouter(textPrompt);
  }

  // ─── Private: OpenRouter call ─────────────────────────────────────────────

  private async _callOpenRouter(prompt: string): Promise<string> {
    if (!this.openrouterApiKey) {
      throw new Error(
        'Cả Gemini lẫn fallback đều không khả dụng (thiếu OPENROUTER_API_KEY). ' +
          'Vui lòng liên hệ quản trị viên.',
      );
    }

    const MAX_RETRIES = 3;
    let attempt = 1;

    while (attempt <= MAX_RETRIES) {
      this.logger.log(
        `[AI Fallback] Calling OpenRouter (${this.openrouterModel}) - Attempt ${attempt}/${MAX_RETRIES}`,
      );

      const response = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/tranquochuy061204/nestjs-ats',
          'X-Title': 'NestJS ATS',
        },
        body: JSON.stringify({
          model: this.openrouterModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');

        // Retry for Rate Limited (429) or Server Errors (5xx)
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_RETRIES
        ) {
          const delay = attempt * 2000;
          this.logger.warn(
            `OpenRouter rate limited or temp error (${response.status}). Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        throw new Error(
          `OpenRouter error ${response.status}: ${errBody || response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        // Có thể retry nếu trả về rỗng không hợp lệ
        if (attempt < MAX_RETRIES) {
          this.logger.warn(`OpenRouter empty response. Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempt++;
          continue;
        }
        throw new Error('OpenRouter returned empty response after all retries');
      }

      this.logger.log(
        `[AI Fallback] Fallback response received (${text.length} chars)`,
      );
      return text;
    }

    throw new Error(`OpenRouter failed after ${MAX_RETRIES} attempts`);
  }

  // ─── Private: PDF text extraction ────────────────────────────────────────

  private async _extractPdfText(file: FileData): Promise<string | null> {
    try {
      // Ưu tiên dùng buffer nếu có, fallback sang decode base64
      const buf: Buffer = file.buffer ?? Buffer.from(file.base64, 'base64');

      const parser = new PDFParse({ data: buf });
      const parsed = await parser.getText();
      const text = (parsed.text ?? '').trim();

      if (text.length < PDF_TEXT_MIN_LENGTH) {
        this.logger.warn(
          `PDF text extraction yielded too little text (${text.length} chars) — likely a scanned image`,
        );
        return null;
      }

      return text;
    } catch (err: unknown) {
      this.logger.error(`pdf-parse failed: ${this._errMsg(err)}`);
      return null;
    }
  }

  // ─── Private: Helpers ────────────────────────────────────────────────────

  private _errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
