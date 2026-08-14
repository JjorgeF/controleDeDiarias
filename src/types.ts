export type EmployeeLevel = 'Trainee' | 'Aprendiz' | 'Coordenador(a)' | 'Recreador(a)' | 'Recreador(a) Experiente' | 'Motorista';

export type DayType = 'common' | 'party';

export interface PartyConfig {
  id: string;
  name: string;
  time?: string;
}

export interface DayConfig {
  isCommon: boolean;
  isParty?: boolean;
  partyTime?: string;
  parties?: PartyConfig[];
  isExtraordinaryOpen?: boolean;
  extraordinaryDeadline?: string; // Format: 'YYYY-MM-DDTHH:mm'
  extraordinaryLockedAvailabilities?: Record<string, string[]>; // Map employeeId -> locked availability keys before extra opening
  extraordinaryScope?: 'all' | 'ccsp' | 'parties' | 'custom';
  extraordinaryPartyIds?: string[];
  extraordinaryCcspOpen?: boolean;
}

export interface WorkDay {
  date: string; // ISO string YYYY-MM-DD
  type: DayType;
  partyId?: string;
  partyName?: string;
  extraHours?: number;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancellationViewed?: boolean;
  cancellationDismissed?: boolean;
  cancellationIgnored?: boolean;
  revertedAt?: string;
  reversionReason?: string;
  revertedBy?: string;
  reversionMode?: 'restore_workday' | 'ignore_penalty_only';
  dailyRateAtTime?: number;
  partyRateAtTime?: number;
  extraHourRateAtTime?: number;
  levelAtTime?: EmployeeLevel;
  shift?: string; // e.g. "11h - 21h00" or "13h30 - 21h30"
  isPaid?: boolean;
  isReducedHours?: boolean; // When employee works reduced / custom agreed hours
  customHoursText?: string; // e.g. "01h30m" or "1h30" or "4h"
  customTotalPay?: number; // Total agreed payment e.g. 45.00
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
  promotionEffectiveDate?: string;
  startDate?: string; // YYYY-MM-DD date when employee joined
  photoUrl?: string; // Base64 compressed profile photo or URL
  phone?: string;
  status?: 'active' | 'inactive';
  inactivatedAt?: string; // ISO timestamp when inactivated
  pixType?: 'cpf' | 'phone' | 'email' | 'random' | 'cnpj';
  pixKey?: string;
  pixBank?: string; // Banco / Plataforma (ex: Nubank, Itaú)
  pixOwnerName?: string; // Nome do titular da conta
  startDateAtLiga?: string; // Data de inicio na Liga Positiva (YYYY-MM ou YYYY-MM-DD)
  shirtSize?: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XGG';
  shortsSize?: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XGG';
  windbreakerSize?: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XGG';
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  paidDates?: string[]; // Array of YYYY-MM-DD or milestone date strings marked as paid by admin
}

export type ViewMode = 'grid' | 'list' | 'calendar' | 'dashboard' | 'master_schedule' | 'payments' | 'kpis';

export interface CancellationLog {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  type: 'common' | 'party';
  cancelledAt: string; // ISO string
  viewedByAdmins: boolean;
}

export type NotificationType = 'cancellation' | 'deadline_warning' | 'deadline_expired' | 'info' | 'custom' | 'extraordinary_avail';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  employeeId?: string;
  targetDate?: string;
}

export interface CustomNotificationDoc {
  id: string;
  title: string;
  message: string;
  targetType: 'all' | 'specific';
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  createdAt: string;
  createdBy: string;
}
