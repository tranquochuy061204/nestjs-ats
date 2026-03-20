import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSkillMetadataAndCandidateSkillTag1773973588030 implements MigrationInterface {
    name = 'CreateSkillMetadataAndCandidateSkillTag1773973588030'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."skill_metadata_type_enum" AS ENUM('hard', 'soft')`);
        await queryRunner.query(`CREATE TABLE "skill_metadata" ("id" SERIAL NOT NULL, "canonical_name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "aliases" jsonb NOT NULL DEFAULT '[]', "type" "public"."skill_metadata_type_enum" NOT NULL, "use_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5212e338f56f23bb1461c0bd13f" UNIQUE ("canonical_name"), CONSTRAINT "UQ_47b723fa2ea644b93ab6f09460b" UNIQUE ("slug"), CONSTRAINT "PK_3c4075230b0d5f4375d3bce5229" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "candidate_skill_tag" ("id" SERIAL NOT NULL, "candidate_id" integer NOT NULL, "skill_metadata_id" integer NOT NULL, CONSTRAINT "UQ_6dd19fbd2d37a4db355fc7a6cb0" UNIQUE ("candidate_id", "skill_metadata_id"), CONSTRAINT "PK_90efb86c0ed156590c834a07961" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "candidate_skill_tag" ADD CONSTRAINT "FK_aa0eddc83dc8172af462980549b" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_skill_tag" ADD CONSTRAINT "FK_236ccc3920c30ec48fbefc4e009" FOREIGN KEY ("skill_metadata_id") REFERENCES "skill_metadata"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_skill_tag" DROP CONSTRAINT "FK_236ccc3920c30ec48fbefc4e009"`);
        await queryRunner.query(`ALTER TABLE "candidate_skill_tag" DROP CONSTRAINT "FK_aa0eddc83dc8172af462980549b"`);
        await queryRunner.query(`DROP TABLE "candidate_skill_tag"`);
        await queryRunner.query(`DROP TABLE "skill_metadata"`);
        await queryRunner.query(`DROP TYPE "public"."skill_metadata_type_enum"`);
    }

}
