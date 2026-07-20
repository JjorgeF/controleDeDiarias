export type EmployeeLevel = 'Trainee' | 'Aprendiz' | 'Coordenador(a)' | 'Recreador(a)' | 'Recreador(a) Experiente' | 'Motorista';

export type DayType = 'common' | 'party';

export interface WorkDay {
  date: string; // ISO string YYYY-MM-DD
  type: DayType;
  extraHours?: number;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancellationViewed?: boolean;
  dailyRateAtTime?: number;
  partyRateAtTime?: number;
  extraHourRateAtTime?: number;
  levelAtTime?: EmployeeLevel;
}

export interface Promotion {
  id: string;
  date: string; // YYYY-MM-DD format
  previousLevel: EmployeeLevel;
  newLevel: EmployeeLevel;
  previousDailyRate: number;
  newDailyRate: number;
  previousPartyRate: number;
  newPartyRate: number;
}

export interface Employee {
  id: string;
  name: string;
  artisticName: string;
  level: EmployeeLevel;
  dailyRate: number;
  partyRate: number;
  extraHourRate: number;
  workDays: WorkDay[];
  availabilities?: string[]; // Date strings 'YYYY-MM-DD'
  userId: string; // To associate with the logged in user
  email?: string; // Access email for the employee
  promotions?: Promotion[];
}

export type ViewMode = 'grid' | 'list' | 'calendar' | 'dashboard';

export interface CancellationLog {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  type: 'common' | 'party';
  cancelledAt: string; // ISO string
  viewedByAdmins: boolean;
}
