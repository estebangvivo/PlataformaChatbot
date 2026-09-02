export type KnowledgeSyncResult = {
  ranAt: string;
  source: "cron" | "manual";
  changed: boolean;
  skipped: boolean;
  reason?: string;
  stored: number;
  pages: number;
  errors: string[];
  added: string[];
  removed: string[];
  updated: string[];
};
