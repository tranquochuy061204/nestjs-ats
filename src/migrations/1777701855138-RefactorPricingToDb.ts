import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorPricingToDb1777701855138 implements MigrationInterface {
  name = 'RefactorPricingToDb1777701855138';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create credit_package table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_package" (
        "id" SERIAL PRIMARY KEY,
        "slug" varchar(50) UNIQUE NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "credit_base" int NOT NULL,
        "bonus" int NOT NULL DEFAULT 0,
        "price_vnd" decimal(15,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // 2. Seed credit_package data (using DO block for safety if data exists)
    await queryRunner.query(`
      INSERT INTO "credit_package" (slug, display_name, credit_base, bonus, price_vnd)
      VALUES
        ('starter', 'Gói Khởi Đầu', 100, 0, 100000),
        ('plus', 'Gói Cộng Thêm', 500, 50, 450000),
        ('pro', 'Gói Chuyên Nghiệp', 1000, 200, 800000),
        ('enterprise', 'Gói Doanh Nghiệp', 5000, 1500, 3500000)
      ON CONFLICT (slug) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        credit_base = EXCLUDED.credit_base,
        bonus = EXCLUDED.bonus,
        price_vnd = EXCLUDED.price_vnd;
    `);

    // 3. Update subscription_package price for VIP
    await queryRunner.query(`
      UPDATE "subscription_package" SET "price" = 499000 WHERE "name" = 'vip'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_package"`);
  }
}
