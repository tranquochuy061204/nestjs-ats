import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublishedAtToJob1777704999925 implements MigrationInterface {
    name = 'AddPublishedAtToJob1777704999925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" ADD "published_at" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "published_at"`);
    }

}
