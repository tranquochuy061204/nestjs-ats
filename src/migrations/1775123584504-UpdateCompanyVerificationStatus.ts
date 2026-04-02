import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCompanyVerificationStatus1775123584504 implements MigrationInterface {
    name = 'UpdateCompanyVerificationStatus1775123584504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "is_verified"`);
        await queryRunner.query(`ALTER TABLE "company" ADD "status" character varying(20) NOT NULL DEFAULT 'idle'`);
        await queryRunner.query(`ALTER TABLE "company" ADD "rejection_reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "rejection_reason"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "company" ADD "is_verified" boolean NOT NULL DEFAULT false`);
    }

}
