import { DataSource, IsNull } from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { toSlug } from '../utils/string.util';
import 'dotenv/config';
import * as path from 'path';

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.join(__dirname, '../../**/*.entity.{js,ts}')],
    synchronize: false,
  });

  await dataSource.initialize();
  const companyRepo = dataSource.getRepository(CompanyEntity);

  const companies = await companyRepo.find({ where: { slug: IsNull() } });
  console.log(`Found ${companies.length} companies without slugs.`);

  for (const company of companies) {
    let slug = toSlug(company.name);

    // Check for collisions (very basic check)
    const exists = await companyRepo.findOne({ where: { slug } });
    if (exists) {
      slug = `${slug}-${company.id}`;
    }

    company.slug = slug;
    await companyRepo.save(company);
    console.log(`Updated: ${company.name} -> ${slug}`);
  }

  await dataSource.destroy();
  console.log('Finished populating slugs.');
}

run().catch((err) => console.error(err));
