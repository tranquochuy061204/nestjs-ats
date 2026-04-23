import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandMetadata1776943498363 implements MigrationInterface {
    name = 'ExpandMetadata1776943498363'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_employer_company_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_skill_tag_job_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_skill_tag_skill_id"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_job_skill_tag_job_skill"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_published_filters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_app_status_history_application_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_application_candidate_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_application_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_application_job_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_candidate_public_filters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_928b7aa1754e08e1ed7052cb9d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_invitation_employer_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_invitation_candidate_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_invitation_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_token_active"`);
        await queryRunner.query(`CREATE TABLE "job_level_metadata" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, CONSTRAINT "UQ_8b27c0571cd58217f3f2f56c67b" UNIQUE ("slug"), CONSTRAINT "PK_e5dd67af5c7b8a05508828aa780" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b27c0571cd58217f3f2f56c67" ON "job_level_metadata" ("slug") `);
        await queryRunner.query(`ALTER TABLE "job" ADD "level_id" integer`);
        await queryRunner.query(`CREATE TYPE "public"."job_required_degree_enum" AS ENUM('postgraduate', 'university', 'college', 'intermediate', 'high_school', 'certificate', 'none')`);
        await queryRunner.query(`ALTER TABLE "job" ADD "required_degree" "public"."job_required_degree_enum" NOT NULL DEFAULT 'none'`);
        await queryRunner.query(`ALTER TABLE "education" DROP COLUMN "degree"`);
        await queryRunner.query(`CREATE TYPE "public"."education_degree_enum" AS ENUM('postgraduate', 'university', 'college', 'intermediate', 'high_school', 'certificate', 'none')`);
        await queryRunner.query(`ALTER TABLE "education" ADD "degree" "public"."education_degree_enum" NOT NULL DEFAULT 'none'`);
        await queryRunner.query(`CREATE INDEX "IDX_d1754874108e05008a8188abf2" ON "employer" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_22fd397967d8cf550882d81918" ON "job_skill_tag" ("job_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ada5b78243b2bf23ff7e175a90" ON "job_skill_tag" ("skill_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ed33b770f75065dc25abd61d6" ON "job" ("level_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a461ff43395424ebd6e218deb3" ON "application_status_history" ("application_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a7f70771aaf242d17ef281570c" ON "job_application" ("job_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_451f4e4120357dbd64a9a3aca8" ON "job_application" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ec367917e8c93f63123e54656" ON "job_application" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_7e6a23e6c0ded3d4c07d4f77b1" ON "job_invitation" ("employer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c21a57f870e6f9cd935cfee256" ON "job_invitation" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e69629aa41088d169889c1146e" ON "job_invitation" ("job_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_30122f228a5cc52c40116f08ae" ON "job_invitation" ("status") `);
        await queryRunner.query(`ALTER TABLE "job_skill_tag" ADD CONSTRAINT "UQ_job_skill_tag_job_skill" UNIQUE ("job_id", "skill_id")`);
        await queryRunner.query(`ALTER TABLE "job" ADD CONSTRAINT "FK_8ed33b770f75065dc25abd61d6a" FOREIGN KEY ("level_id") REFERENCES "job_level_metadata"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" DROP CONSTRAINT "FK_8ed33b770f75065dc25abd61d6a"`);
        await queryRunner.query(`ALTER TABLE "job_skill_tag" DROP CONSTRAINT "UQ_job_skill_tag_job_skill"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30122f228a5cc52c40116f08ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e69629aa41088d169889c1146e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c21a57f870e6f9cd935cfee256"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e6a23e6c0ded3d4c07d4f77b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ec367917e8c93f63123e54656"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_451f4e4120357dbd64a9a3aca8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7f70771aaf242d17ef281570c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a461ff43395424ebd6e218deb3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ed33b770f75065dc25abd61d6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ada5b78243b2bf23ff7e175a90"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_22fd397967d8cf550882d81918"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d1754874108e05008a8188abf2"`);
        await queryRunner.query(`ALTER TABLE "education" DROP COLUMN "degree"`);
        await queryRunner.query(`DROP TYPE "public"."education_degree_enum"`);
        await queryRunner.query(`ALTER TABLE "education" ADD "degree" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "required_degree"`);
        await queryRunner.query(`DROP TYPE "public"."job_required_degree_enum"`);
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "level_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b27c0571cd58217f3f2f56c67"`);
        await queryRunner.query(`DROP TABLE "job_level_metadata"`);
        await queryRunner.query(`CREATE INDEX "IDX_refresh_token_active" ON "refresh_token" ("expiresAt", "userId") WHERE ("isRevoked" = false)`);
        await queryRunner.query(`CREATE INDEX "IDX_job_invitation_status" ON "job_invitation" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_invitation_candidate_id" ON "job_invitation" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_invitation_employer_id" ON "job_invitation" ("employer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_928b7aa1754e08e1ed7052cb9d" ON "notification" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_candidate_public_filters" ON "candidate" ("job_type_id", "province_id", "year_working_experience") WHERE (is_public = true)`);
        await queryRunner.query(`CREATE INDEX "IDX_job_application_job_status" ON "job_application" ("job_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_application_status" ON "job_application" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_application_candidate_id" ON "job_application" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_app_status_history_application_id" ON "application_status_history" ("application_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_published_filters" ON "job" ("category_id", "job_type_id", "province_id") WHERE ((status)::text = 'published'::text)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_job_skill_tag_job_skill" ON "job_skill_tag" ("job_id", "skill_id") WHERE (skill_id IS NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_job_skill_tag_skill_id" ON "job_skill_tag" ("skill_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_skill_tag_job_id" ON "job_skill_tag" ("job_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_employer_company_id" ON "employer" ("company_id") `);
    }

}
