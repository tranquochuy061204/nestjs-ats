import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJobApprovalAndRejectionReason1774929462699 implements MigrationInterface {
    name = 'AddJobApprovalAndRejectionReason1774929462699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" ADD "rejection_reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "rejection_reason"`);
    }

}
