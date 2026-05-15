export interface RawJobStats {
  total: string;
  draft: string;
  pending: string;
  published: string;
  closed: string;
  rejected: string;
  expiring_soon: string;
  published_in_period: string;
}

export interface RawPublishedJob {
  id: string;
  title: string;
  status: string;
  published_at: string;
}

export interface RawAppDetail {
  id: string;
  candidate_name: string;
  job_title: string;
  status: string;
  created_at: string;
}

export interface RawInvitationDetail {
  id: string;
  candidate_name: string;
  job_title: string;
  status: string;
  created_at: string;
}

export interface RawAppStats {
  total: string;
  applied: string;
  shortlisted: string;
  skill_test: string;
  interview: string;
  offer: string;
  hired: string;
  rejected: string;
  withdrawn: string;
}

export interface RawTrendRow {
  date: string;
  count: string;
}

export interface RawFunnelStats {
  total_applied: string;
  ever_shortlisted: string;
  ever_interviewed: string;
  ever_hired: string;
  total_rejected: string;
}

export interface RawHeadhuntingStats {
  invitations_sent: string;
  accepted: string;
  declined: string;
  pending: string;
  saved_candidates: string;
}

export interface RawTopJob {
  job_id: string;
  title: string;
  status: string;
  application_count: string;
}

export interface RawInvitationStats {
  sent: string;
  accepted: string;
  declined: string;
  pending: string;
}
