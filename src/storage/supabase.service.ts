import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient<any, any, any>;
  private readonly logger = new Logger(SupabaseService.name);
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SECRET_KEY');
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ||
      'ats_storage';
    if (!supabaseUrl || !supabaseKey || !this.bucketName) {
      this.logger.error(
        'Missing SUPABASE_PROJECT_URL or SUPABASE_SECRET_KEY or SUPABASE_STORAGE_BUCKET in environment variables',
      );
      throw new InternalServerErrorException('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  /**
   * Upload file to Supabase Storage
   * @param file The file wrapped by Multer
   * @param path The path where the file will be uploaded (e.g. 'cv/123.pdf')
   * @param overrideBucket Optional bucket name to override the default
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    file: UploadFile,
    path: string,
    overrideBucket?: string,
  ): Promise<string> {
    const bucket = overrideBucket || this.bucketName;

    // Check if bucket exists, if not create it (this requires sufficient permissions)
    // In production, it's safer to create buckets manually in the Supabase Dashboard.

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(
        `Error uploading file to Supabase: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Cập nhật file thất bại');
    }

    const { data: publicUrlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  /**
   * Remove a file from Supabase Storage
   * @param path The path of the file to remove
   */
  async deleteFile(path: string, overrideBucket?: string): Promise<void> {
    const bucket = overrideBucket || this.bucketName;
    const { error } = await this.supabase.storage.from(bucket).remove([path]);

    if (error) {
      this.logger.error(
        `Error deleting file from Supabase: ${(error as Error).message}`,
      );
      // Usually we might not throw if delete fails, depending on requirements,
      // but let's log it.
    }
  }
}
