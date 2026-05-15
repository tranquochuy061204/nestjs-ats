import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveScreeningFeature1778526696497 implements MigrationInterface {
  name = 'RemoveScreeningFeature1778526696497';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_package" DROP COLUMN "max_screening_questions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "screening_answer"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "screening_question"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "screening_question" ("id" SERIAL PRIMARY KEY, "job_id" integer NOT NULL, "question_text" text NOT NULL, "question_type" character varying NOT NULL DEFAULT 'text', "options" text, "preferred_answer" character varying, "is_required" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "FK_1beaa4671be609e6a63b2b17ae2" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "screening_answer" ("id" SERIAL PRIMARY KEY, "application_id" integer NOT NULL, "question_id" integer NOT NULL, "answer_text" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "FK_0fcad94dc3f7b8b86c2f4547820" FOREIGN KEY ("application_id") REFERENCES "job_application"("id") ON DELETE CASCADE, CONSTRAINT "FK_12362f6705c69bb8d04784b2c59" FOREIGN KEY ("question_id") REFERENCES "screening_question"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_package" ADD "max_screening_questions" integer NOT NULL DEFAULT '0'`,
    );
  }
}
