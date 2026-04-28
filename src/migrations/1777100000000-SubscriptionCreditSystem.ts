import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Subscription & Credit System
 * - 10 bảng mới
 * - Alter job: thêm hide_salary, require_cv, is_bumped, bumped_until
 * - Alter job_application: thêm screening_passed, ai_scored
 * - Alter application_status_history: thêm credit_charged
 * - Seed: subscription_package (Free, VIP)
 * - Seed: pipeline_fee_config
 * - Seed: credit_product
 * - Backfill: gán Free cho tất cả company hiện tại + tạo credit_wallet
 */
export class SubscriptionCreditSystem1777100000000 implements MigrationInterface {
  name = 'SubscriptionCreditSystem1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ══════════════════════════════════════════════════════
    // 1. SUBSCRIPTION PACKAGE
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "subscription_package" (
        "id" SERIAL NOT NULL,
        "name" VARCHAR(50) NOT NULL,
        "display_name" VARCHAR(255) NOT NULL,
        "price" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "duration_days" INT NOT NULL,

        "max_active_jobs" INT NOT NULL,
        "job_duration_days" INT NOT NULL,
        "max_profile_views_per_job" INT NOT NULL,
        "daily_application_process_limit" INT NOT NULL,
        "bump_post_quota" INT NOT NULL DEFAULT 0,
        "max_screening_questions" INT NOT NULL DEFAULT 0,
        "monthly_headhunt_profile_views" INT NOT NULL,
        "monthly_free_proceeds" INT NOT NULL DEFAULT 0,

        "can_headhunt_save_and_invite" BOOLEAN NOT NULL DEFAULT false,
        "can_use_ai_strict_filter" BOOLEAN NOT NULL DEFAULT false,
        "can_export_report" BOOLEAN NOT NULL DEFAULT false,
        "can_view_advanced_analytics" BOOLEAN NOT NULL DEFAULT false,
        "can_hide_salary" BOOLEAN NOT NULL DEFAULT false,
        "can_require_cv" BOOLEAN NOT NULL DEFAULT false,
        "has_vip_badge" BOOLEAN NOT NULL DEFAULT false,
        "can_use_premium_filters" BOOLEAN NOT NULL DEFAULT false,
        "free_contact_unlock" BOOLEAN NOT NULL DEFAULT false,
        "free_ai_scoring" BOOLEAN NOT NULL DEFAULT false,

        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscription_package_name" UNIQUE ("name"),
        CONSTRAINT "PK_subscription_package" PRIMARY KEY ("id")
      )
    `);

    // ══════════════════════════════════════════════════════
    // 2. COMPANY SUBSCRIPTION
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "company_subscription" (
        "id" SERIAL NOT NULL,
        "company_id" INT NOT NULL,
        "package_id" INT NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "start_date" TIMESTAMP NOT NULL,
        "end_date" TIMESTAMP,

        "used_bump_post_quota" INT NOT NULL DEFAULT 0,
        "daily_processed_count" INT NOT NULL DEFAULT 0,
        "daily_processed_date" DATE,
        "last_job_published_at" TIMESTAMP,

        "headhunting_views_used" INT NOT NULL DEFAULT 0,
        "headhunting_views_reset_at" TIMESTAMP,

        "used_free_proceeds" INT NOT NULL DEFAULT 0,
        "proceeds_reset_at" TIMESTAMP,

        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_subscription" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_subscription_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_subscription_package"
          FOREIGN KEY ("package_id") REFERENCES "subscription_package"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_company_subscription_company_id" ON "company_subscription" ("company_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 3. PIPELINE FEE CONFIG
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "pipeline_fee_config" (
        "id" SERIAL NOT NULL,
        "to_status" VARCHAR(30) NOT NULL,
        "credit_cost" INT NOT NULL DEFAULT 0,
        "vip_credit_cost" INT NOT NULL DEFAULT 0,
        "is_free" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "UQ_pipeline_fee_config_to_status" UNIQUE ("to_status"),
        CONSTRAINT "PK_pipeline_fee_config" PRIMARY KEY ("id")
      )
    `);

    // ══════════════════════════════════════════════════════
    // 4. JOB PROFILE VIEW
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "job_profile_view" (
        "id" SERIAL NOT NULL,
        "job_id" INT NOT NULL,
        "candidate_id" INT NOT NULL,
        "viewed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_profile_view" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_job_profile_view" UNIQUE ("job_id", "candidate_id"),
        CONSTRAINT "FK_job_profile_view_job"
          FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_job_profile_view_candidate"
          FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_job_profile_view_job_id" ON "job_profile_view" ("job_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 5. CONTACT UNLOCK LOG
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "contact_unlock_log" (
        "id" SERIAL NOT NULL,
        "company_id" INT NOT NULL,
        "candidate_id" INT NOT NULL,
        "credit_spent" INT NOT NULL DEFAULT 0,
        "unlocked_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_unlock_log" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contact_unlock_log" UNIQUE ("company_id", "candidate_id"),
        CONSTRAINT "FK_contact_unlock_log_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contact_unlock_log_candidate"
          FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_contact_unlock_log_company_id" ON "contact_unlock_log" ("company_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 6. SCREENING QUESTION
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "screening_question" (
        "id" SERIAL NOT NULL,
        "job_id" INT NOT NULL,
        "question_text" TEXT NOT NULL,
        "question_type" VARCHAR(20) NOT NULL DEFAULT 'text',
        "options" TEXT,
        "preferred_answer" VARCHAR(500),
        "is_required" BOOLEAN NOT NULL DEFAULT true,
        "sort_order" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_screening_question" PRIMARY KEY ("id"),
        CONSTRAINT "FK_screening_question_job"
          FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_screening_question_job_id" ON "screening_question" ("job_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 7. SCREENING ANSWER
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "screening_answer" (
        "id" SERIAL NOT NULL,
        "application_id" INT NOT NULL,
        "question_id" INT NOT NULL,
        "answer_text" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_screening_answer" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_screening_answer" UNIQUE ("application_id", "question_id"),
        CONSTRAINT "FK_screening_answer_application"
          FOREIGN KEY ("application_id") REFERENCES "job_application"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_screening_answer_question"
          FOREIGN KEY ("question_id") REFERENCES "screening_question"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_screening_answer_application_id" ON "screening_answer" ("application_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 8. CREDIT WALLET
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "credit_wallet" (
        "id" SERIAL NOT NULL,
        "company_id" INT NOT NULL,
        "balance" INT NOT NULL DEFAULT 0,
        "total_earned" INT NOT NULL DEFAULT 0,
        "total_spent" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_credit_wallet_company_id" UNIQUE ("company_id"),
        CONSTRAINT "PK_credit_wallet" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_wallet_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE
      )
    `);

    // ══════════════════════════════════════════════════════
    // 9. CREDIT TRANSACTION
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "credit_transaction" (
        "id" SERIAL NOT NULL,
        "wallet_id" INT NOT NULL,
        "type" VARCHAR(20) NOT NULL,
        "amount" INT NOT NULL,
        "balance_after" INT NOT NULL,
        "description" TEXT,
        "reference_type" VARCHAR(50),
        "reference_id" INT,
        "created_by" INT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_transaction" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_transaction_wallet"
          FOREIGN KEY ("wallet_id") REFERENCES "credit_wallet"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_transaction_wallet_id" ON "credit_transaction" ("wallet_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 10. CREDIT PRODUCT
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "credit_product" (
        "id" SERIAL NOT NULL,
        "slug" VARCHAR(50) NOT NULL,
        "display_name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "credit_cost" INT NOT NULL,
        "duration_days" INT,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "scope" VARCHAR(20) NOT NULL DEFAULT 'job',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_credit_product_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_credit_product" PRIMARY KEY ("id")
      )
    `);

    // ══════════════════════════════════════════════════════
    // 11. CREDIT PURCHASE LOG
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "credit_purchase_log" (
        "id" SERIAL NOT NULL,
        "company_id" INT NOT NULL,
        "product_id" INT NOT NULL,
        "credit_spent" INT NOT NULL,
        "target_job_id" INT,
        "activated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_purchase_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_purchase_log_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_credit_purchase_log_product"
          FOREIGN KEY ("product_id") REFERENCES "credit_product"("id"),
        CONSTRAINT "FK_credit_purchase_log_job"
          FOREIGN KEY ("target_job_id") REFERENCES "job"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_purchase_log_company_id" ON "credit_purchase_log" ("company_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 12. PAYMENT ORDER
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "payment_order" (
        "id" SERIAL NOT NULL,
        "company_id" INT NOT NULL,
        "order_type" VARCHAR(20) NOT NULL,
        "package_id" INT,
        "credit_amount" INT,
        "amount" DECIMAL(15,2) NOT NULL,
        "payment_method" VARCHAR(20) NOT NULL DEFAULT 'vnpay',
        "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
        "gateway_order_id" VARCHAR(255),
        "gateway_transaction_id" VARCHAR(255),
        "gateway_response_data" TEXT,
        "paid_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_order" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_order_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payment_order_package"
          FOREIGN KEY ("package_id") REFERENCES "subscription_package"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_order_company_id" ON "payment_order" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_order_gateway_order_id" ON "payment_order" ("gateway_order_id")`,
    );

    // ══════════════════════════════════════════════════════
    // 13. ALTER EXISTING TABLES
    // ══════════════════════════════════════════════════════
    await queryRunner.query(
      `ALTER TABLE "job" ADD COLUMN "hide_salary" BOOLEAN NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD COLUMN "require_cv" BOOLEAN NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD COLUMN "is_bumped" BOOLEAN NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD COLUMN "bumped_until" TIMESTAMP`,
    );

    await queryRunner.query(
      `ALTER TABLE "job_application" ADD COLUMN "screening_passed" BOOLEAN`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" ADD COLUMN "ai_scored" BOOLEAN NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `ALTER TABLE "application_status_history" ADD COLUMN "credit_charged" INT NOT NULL DEFAULT 0`,
    );

    // ══════════════════════════════════════════════════════
    // 14. SEED: SUBSCRIPTION PACKAGES
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      INSERT INTO "subscription_package" (
        "name", "display_name", "price", "duration_days",
        "max_active_jobs", "job_duration_days", "max_profile_views_per_job",
        "daily_application_process_limit", "bump_post_quota",
        "max_screening_questions", "monthly_headhunt_profile_views",
        "monthly_free_proceeds",
        "can_headhunt_save_and_invite", "can_use_ai_strict_filter",
        "can_export_report", "can_view_advanced_analytics",
        "can_hide_salary", "can_require_cv", "has_vip_badge",
        "can_use_premium_filters", "free_contact_unlock", "free_ai_scoring"
      ) VALUES
        ('free', 'Miễn Phí', 0, -1,
         1, 7, 30, 20, 0, 0, 20, 0,
         false, false, false, false, false, false, false, false, false, false),
        ('vip', 'VIP', 499000, 30,
         10, 30, -1, -1, 3, 5, -1, 100,
         true, true, true, true, true, true, true, true, true, true)
    `);

    // ══════════════════════════════════════════════════════
    // 15. SEED: PIPELINE FEE CONFIG
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      INSERT INTO "pipeline_fee_config" ("to_status", "credit_cost", "vip_credit_cost", "is_free") VALUES
        ('shortlisted', 2, 1, false),
        ('skill_test',  3, 1, false),
        ('interview',   5, 2, false),
        ('offer',       5, 2, false),
        ('hired',       0, 0, true),
        ('rejected',    0, 0, true),
        ('withdrawn',   0, 0, true)
    `);

    // ══════════════════════════════════════════════════════
    // 16. SEED: CREDIT PRODUCTS
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      INSERT INTO "credit_product" ("slug", "display_name", "credit_cost", "duration_days", "scope") VALUES
        ('ai_scoring',          'AI Đánh giá CV (1 ứng viên)',      1,  NULL, 'job'),
        ('ai_scoring_batch_10', 'AI Đánh giá CV (10 ứng viên)',     8,  NULL, 'job'),
        ('bump_post',           'Đẩy Tin (24h)',                   30,    1,  'job'),
        ('extra_job_slot',      'Thêm Slot Tin (+1)',              40,    7,  'company'),
        ('extend_job',          'Gia hạn Tin (+7 ngày)',           20,  NULL, 'job')
    `);

    // ══════════════════════════════════════════════════════
    // 17. BACKFILL: Gán Free cho tất cả company hiện tại
    //              + Tạo credit_wallet
    // ══════════════════════════════════════════════════════
    await queryRunner.query(`
      INSERT INTO "company_subscription" ("company_id", "package_id", "status", "start_date")
      SELECT
        c.id,
        (SELECT id FROM "subscription_package" WHERE name = 'free'),
        'active',
        now()
      FROM "company" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "company_subscription" cs WHERE cs.company_id = c.id
      )
    `);

    await queryRunner.query(`
      INSERT INTO "credit_wallet" ("company_id", "balance")
      SELECT c.id, 0
      FROM "company" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "credit_wallet" cw WHERE cw.company_id = c.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Undo alter existing tables
    await queryRunner.query(
      `ALTER TABLE "application_status_history" DROP COLUMN "credit_charged"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" DROP COLUMN "ai_scored"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" DROP COLUMN "screening_passed"`,
    );
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "bumped_until"`);
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "is_bumped"`);
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "require_cv"`);
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "hide_salary"`);

    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_purchase_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_transaction"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_wallet"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "screening_answer"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "screening_question"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_unlock_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_profile_view"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_subscription"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pipeline_fee_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_package"`);
  }
}
