import { DataSource } from 'typeorm';
import config from './typeorm.config';

async function check() {
  const ds = new DataSource(config);
  await ds.initialize();
  
  const indexes = await ds.query("SELECT indexname FROM pg_indexes WHERE tablename = 'candidate'");
  console.log('Candidate Indexes:', indexes.map((i: any) => i.indexname));
  
  const catIndexes = await ds.query("SELECT indexname FROM pg_indexes WHERE tablename = 'candidate_job_category'");
  console.log('CandidateJobCategory Indexes:', catIndexes.map((i: any) => i.indexname));

  await ds.destroy();
}

check();
