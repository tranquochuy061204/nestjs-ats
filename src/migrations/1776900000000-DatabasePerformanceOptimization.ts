import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabasePerformanceOptimization1776900000000
  implements MigrationInterface
{
  name = 'DatabasePerformanceOptimization1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // GROUP 1: Missing indexes on job_application
    // ============================================================

    // Lookup: candidate's application history (candidateId WHERE clause)
    await queryRunner.query(
      `CREATE INDEX "IDX_job_application_candidate_id" ON "job_application" ("candidate_id")`,
    );

    // Lookup: filter by status (Kanban board counts, candidate filtering)
    await queryRunner.query(
      `CREATE INDEX "IDX_job_application_status" ON "job_application" ("status")`,
    );

    // Composite: most common Kanban query pattern – WHERE job_id AND status
    await queryRunner.query(
      `CREATE INDEX "IDX_job_application_job_status" ON "job_application" ("job_id", "status")`,
    );

    // ============================================================
    // GROUP 2: Missing index on application_status_history
    // ============================================================

    // Lookup: timeline/history per application
    await queryRunner.query(
      `CREATE INDEX "IDX_app_status_history_application_id" ON "application_status_history" ("application_id")`,
    );

    // ============================================================
    // GROUP 3: Composite index on notification
    // ============================================================

    // Replaces the single-column user_id index for the common
    // query: "get unread notifications for user X"
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_read" ON "notification" ("user_id", "is_read")`,
    );

    // ============================================================
    // GROUP 4: Missing indexes on job_invitation
    // ============================================================

    await queryRunner.query(
      `CREATE INDEX "IDX_job_invitation_employer_id" ON "job_invitation" ("employer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_invitation_candidate_id" ON "job_invitation" ("candidate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_invitation_status" ON "job_invitation" ("status")`,
    );

    // ============================================================
    // GROUP 5: Missing index on employer
    // ============================================================

    // Used in nearly every employer request after findEmployerByUserId
    await queryRunner.query(
      `CREATE INDEX "IDX_employer_company_id" ON "employer" ("company_id")`,
    );

    // ============================================================
    // GROUP 6: Missing indexes on job_skill_tag
    // ============================================================

    await queryRunner.query(
      `CREATE INDEX "IDX_job_skill_tag_job_id" ON "job_skill_tag" ("job_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_skill_tag_skill_id" ON "job_skill_tag" ("skill_id")`,
    );

    // Prevent duplicate skill tags per job (mirrors candidate_skill_tag behavior)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_job_skill_tag_job_skill" ON "job_skill_tag" ("job_id", "skill_id") WHERE "skill_id" IS NOT NULL`,
    );

    // ============================================================
    // GROUP 7: Partial indexes (smarter, smaller indexes)
    // ============================================================

    // Only index PUBLISHED jobs – the only status public users search
    await queryRunner.query(
      `CREATE INDEX "IDX_job_published_filters"
       ON "job" ("province_id", "category_id", "job_type_id")
       WHERE status = 'published'`,
    );

    // Only index public candidates – the only ones headhunters query
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_public_filters"
       ON "candidate" ("province_id", "job_type_id", "year_working_experience")
       WHERE is_public = true`,
    );

    // Only index active (non-revoked) refresh tokens
    // NOTE: column name is "isRevoked" (camelCase) – entity has no name: mapping
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_token_active"
       ON "refresh_token" ("userId", "expiresAt")
       WHERE "isRevoked" = false`,
    );

    // ============================================================
    // GROUP 8: Drop deprecated column
    // ============================================================

    // employer_note has been superseded by the application_note table
    await queryRunner.query(
      `ALTER TABLE "job_application" DROP COLUMN IF EXISTS "employer_note"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore deprecated column first
    await queryRunner.query(
      `ALTER TABLE "job_application" ADD COLUMN "employer_note" text`,
    );

    // Drop partial indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_token_active"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_candidate_public_filters"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_published_filters"`);

    // Drop job_skill_tag indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_job_skill_tag_job_skill"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_skill_tag_skill_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_skill_tag_job_id"`);

    // Drop employer index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employer_company_id"`);

    // Drop job_invitation indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_invitation_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_invitation_candidate_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_invitation_employer_id"`,
    );

    // Drop notification index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_user_read"`,
    );

    // Drop application_status_history index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_app_status_history_application_id"`,
    );

    // Drop job_application indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_application_job_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_application_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_job_application_candidate_id"`,
    );
  }
}
