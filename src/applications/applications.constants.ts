export const CANDIDATE_MATCH_SCORE_PROMPT = (
  jobData: Record<string, any>,
  candidateData: Record<string, any>,
) => `You are an expert recruiter and headhunter. Your task is to read the provided Job Description and Candidate Profile, then calculate a suitability match score on a scale of 0 to 100 based on the following formula:
- Total Years of Experience vs Required (Weight 20%)
- Skills & Requirements match (Weight 30%)
- Related Work Experience (Weight 30%)
- Related Projects (Weight 10%)
- Related Certificates (Weight 10%)

Carefully calculate the score for each section and sum them up. Return ONLY a valid JSON object matching the exact format below (DO NOT include markdown blocks like \`\`\`json):
{ "matchScore": <integer total score from 0-100>, "reasoning": "<Brief explanation of the score>" }

JOB DATA:
${JSON.stringify(jobData, null, 2)}

CANDIDATE DATA:
${JSON.stringify(candidateData, null, 2)}
`;

export const CV_MATCH_SCORE_PROMPT = (
  jobData: Record<string, any>,
) => `You are an expert recruiter and headhunter. Your task is to read the attached CV file (PDF/Image) and the Job Description provided below, then calculate a suitability match score of this CV against the Job on a scale of 0 to 100.
Evaluate based on:
- Do the skills demonstrated in the CV align with the Job Requirements? (Weight 40%)
- Is the work experience relevant to the job? (Weight 40%)
- Quality of education, CV layout, language certificates, and related projects. (Weight 20%)

Carefully calculate the score and return ONLY a valid JSON object matching the exact format below (DO NOT include markdown blocks like \`\`\`json):
{ "cvMatchScore": <integer total score from 0-100>, "reasoning": "<Brief explanation for the score>" }

JOB DESCRIPTION TO COMPARE:
${JSON.stringify(jobData, null, 2)}
`;
