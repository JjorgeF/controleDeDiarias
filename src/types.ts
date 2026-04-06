export type EmployeeLevel = 'Trainee' | 'Aprendiz' | 'Coordenador(a)' | 'Recreador(a)' | 'Recreador(a) Experiente';

export type DayType = 'common' | 'party';

export interface WorkDay {
  date: string; // ISO string YYYY-MM-DD
  type: DayType;
  extraHours?: number;
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
  userId: string; // To associate with the logged in user
  email?: string; // Access email for the employee
}

export type ViewMode = 'grid' | 'list' | 'calendar';
