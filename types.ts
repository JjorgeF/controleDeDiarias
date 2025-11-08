export enum Nivel {
  TRAINEE = 'Trainee',
  APRENDIZ = 'Aprendiz',
  RECREADOR = 'Recreador(a)',
  RECREADOREXPERIENTE = 'Recreador(a) Experiente',
  COORDENADOR = 'Coordenador(a)'
}

export enum WorkDayType {
  COMUM = 'Dia Comum',
  FESTA = 'Dia de Festa',
}

export interface WorkDay {
  id: string;
  date: string; // ISO string format 'YYYY-MM-DD'
  type: WorkDayType;
  value: number;
  extraHours?: number;
}

export interface Employee {
  id: string;
  name: string;
  artisticName: string;
  level: Nivel;
  dailyRate: number;
  partyRate: number;
  extraHourRate: number;
  workDays: WorkDay[];
}

export type ViewMode = 'card' | 'list';
