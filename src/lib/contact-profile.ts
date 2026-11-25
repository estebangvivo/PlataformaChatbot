export type ContactProfile = {
  firstName?: string;
  lastName?: string;
  locality?: string;
  matricula?: string;
  role?: string;
  email?: string;
  observations?: string;
  interests: string[];
  notes: string[];
  lastGreetedOn?: string;
  unansweredStreak: number;
  lastTopic?: string;
  awaiting?: string | null;
  notifyOnAgent?: boolean;
  notifyDepartment?: string | null;
};

export const EMPTY_PROFILE: ContactProfile = {
  interests: [],
  notes: [],
  unansweredStreak: 0,
};

export const CONTACT_ROLES = ["matriculado", "arquitecto", "estudiante", "publico"] as const;
