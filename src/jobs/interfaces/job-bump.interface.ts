export interface BumpJobResult {
  message: string;
  bumpedUntil: Date;
  source: 'quota' | 'credit';
  creditsSpent: number;
  quotaRemaining: number;
}
