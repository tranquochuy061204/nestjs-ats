import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyEmployerEntities1774483434397 implements MigrationInterface {
  name = 'AddCompanyEmployerEntities1774483434397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "company_image" ("id" SERIAL NOT NULL, "company_id" integer NOT NULL, "image_url" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6ab2cb6d2e7bbc45e236dfffc40" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "company" ("id" SERIAL NOT NULL, "user_creator_id" integer NOT NULL, "category_id" integer NOT NULL, "name" character varying(255) NOT NULL, "email_contact" character varying(100), "phone_contact" character varying(20), "address" text, "province_id" integer, "logo_url" character varying(255), "banner_url" character varying(255), "description" text, "content" text, "company_size" character varying(50), "website_url" character varying(255), "facebook_url" character varying(255), "linkedin_url" character varying(255), "business_license_url" character varying(255), "is_verified" boolean NOT NULL DEFAULT false, "verified_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a645aeb71967c48aca6518b60c8" UNIQUE ("user_creator_id"), CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "employer" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "company_id" integer, "full_name" character varying(255) NOT NULL, "phone_contact" character varying(20), "avatar_url" character varying(255), "is_admin_company" boolean NOT NULL DEFAULT false, "status" character varying(20) NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6b1262606e8e48d624fa5557b3e" UNIQUE ("user_id"), CONSTRAINT "REL_6b1262606e8e48d624fa5557b3" UNIQUE ("user_id"), CONSTRAINT "PK_74029e6b1f17a4c7c66d43cfd34" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_image" ADD CONSTRAINT "FK_b439a47c162561ac50ffdf27a9f" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer" ADD CONSTRAINT "FK_6b1262606e8e48d624fa5557b3e" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer" ADD CONSTRAINT "FK_d1754874108e05008a8188abf2c" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer" DROP CONSTRAINT "FK_d1754874108e05008a8188abf2c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer" DROP CONSTRAINT "FK_6b1262606e8e48d624fa5557b3e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_image" DROP CONSTRAINT "FK_b439a47c162561ac50ffdf27a9f"`,
    );
    await queryRunner.query(`DROP TABLE "employer"`);
    await queryRunner.query(`DROP TABLE "company"`);
    await queryRunner.query(`DROP TABLE "company_image"`);
  }
}
