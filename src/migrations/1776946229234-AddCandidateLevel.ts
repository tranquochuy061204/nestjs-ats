import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCandidateLevel1776946229234 implements MigrationInterface {
    name = 'AddCandidateLevel1776946229234'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate" ADD "level_id" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_67170af9a05e67ebf48434db68" ON "candidate" ("level_id") `);
        await queryRunner.query(`ALTER TABLE "candidate" ADD CONSTRAINT "FK_67170af9a05e67ebf48434db686" FOREIGN KEY ("level_id") REFERENCES "job_level_metadata"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate" DROP CONSTRAINT "FK_67170af9a05e67ebf48434db686"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_67170af9a05e67ebf48434db68"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "level_id"`);
    }

}
