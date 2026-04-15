import { DataSource } from 'typeorm';
import config from './typeorm.config';

async function check() {
  const ds = new DataSource(config);
  await ds.initialize();
  
  const c16 = await ds.query('SELECT id, "full_name", "province_id", "job_type_id", "year_working_experience" FROM candidate WHERE id = 16');
  console.log('Candidate 16 Detail:', c16);
  
  await ds.destroy();
}

check();
