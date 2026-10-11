export type Role = 'STUDENT' | 'ADMIN';
export type MonthlyCycleStatus = 'ACTIVE' | 'ARCHIVED';
export type RoundStatus = 'ACTIVE' | 'COMPLETED';
export type RoundMemberStatus = 'PENDING' | 'CURRENT' | 'DEFERRED' | 'COMPLETED';
export type CompletedMethod = 'NORMAL' | 'EARLY' | 'ADMIN_OVERRIDE' | null;
export type FoodEventAction = 'COMPLETED' | 'DEFERRED' | 'EARLY' | 'ADMIN_OVERRIDE' | 'UNDO' | 'ROUND_CREATED' | 'ROUND_COMPLETED';

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentFoodStat {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  count: number;
  lastTakenAt?: string | null;
}

export interface PgGroup {
  id: string;
  name: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  active: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface MonthlyCycle {
  id: string;
  group_id: string;
  year: number;
  month: number;
  status: MonthlyCycleStatus;
  created_at: string;
  archived_at: string | null;
}

export interface Round {
  id: string;
  monthly_cycle_id: string;
  round_number: number;
  status: RoundStatus;
  created_at: string;
  completed_at: string | null;
}

export interface RoundMember {
  id: string;
  round_id: string;
  student_id: string;
  position: number;
  status: RoundMemberStatus;
  deferred_count: number;
  completed_at: string | null;
  completed_method: CompletedMethod;
  profiles?: Profile; // Joined data
}

export interface FoodEvent {
  id: string;
  group_id: string;
  round_id: string | null;
  student_id: string | null;
  action: FoodEventAction;
  metadata: any;
  created_at: string;
  created_by: string | null;
}

export interface FoodRequest {
  id: string;
  group_id: string;
  student_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvals: string[]; // array of student_ids who approved
  rejections: string[]; // array of student_ids who rejected
  created_at: string;
  approved_at?: string | null;
  student?: Profile;
}
