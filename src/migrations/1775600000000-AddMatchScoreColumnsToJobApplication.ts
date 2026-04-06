import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchScoreColumnsToJobApplication1775600000000 implements MigrationInterface {
  name = 'AddMatchScoreColumnsToJobApplication1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "job_application"
        ADD COLUMN IF NOT EXISTS "match_score" integer,
        ADD COLUMN IF NOT EXISTS "match_reasoning" text,
        ADD COLUMN IF NOT EXISTS "cv_match_score" integer,
        ADD COLUMN IF NOT EXISTS "cv_match_reasoning" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "job_application"
        DROP COLUMN IF EXISTS "match_score",
        DROP COLUMN IF EXISTS "match_reasoning",
        DROP COLUMN IF EXISTS "cv_match_score",
        DROP COLUMN IF EXISTS "cv_match_reasoning"
    `);
  }
}
