import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  parseISO, 
  nextMonday, 
  addMonths, 
  setDate, 
  startOfMonth, 
  endOfMonth, 
  addDays, 
  subDays,
  format,
  isBefore,
  isSameDay
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula a Páscoa pelo algoritmo de Meeus/Jones/Butcher
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed (2 = March, 3 = April)
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Verifica se uma data é feriado nacional brasileiro (fixos e móveis)
 */
export function isBrazilianNationalHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Feriados fixos nacionais
  if (month === 0 && day === 1) return true;  // 01/01 - Confraternização Universal
  if (month === 3 && day === 21) return true; // 21/04 - Tiradentes
  if (month === 4 && day === 1) return true;  // 01/05 - Dia do Trabalhador
  if (month === 8 && day === 7) return true;  // 07/09 - Independência do Brasil
  if (month === 9 && day === 12) return true; // 12/10 - N. Sra. Aparecida
  if (month === 10 && day === 2) return true; // 02/11 - Finados
  if (month === 10 && day === 15) return true;// 15/11 - Proclamação da República
  if (month === 10 && day === 20) return true;// 20/11 - Dia da Consciência Negra
  if (month === 11 && day === 25) return true;// 25/12 - Natal

  // Feriados móveis baseados na Páscoa
  const easter = getEasterSunday(year);
  const carnivalMon = subDays(easter, 48);
  const carnivalTue = subDays(easter, 47);
  const goodFriday = subDays(easter, 2);
  const corpusChristi = addDays(easter, 60);

  const checkSameDay = (d1: Date) => 
    d1.getFullYear() === year && d1.getMonth() === month && d1.getDate() === day;

  return (
    checkSameDay(goodFriday) ||
    checkSameDay(corpusChristi) ||
    checkSameDay(carnivalTue) ||
    checkSameDay(carnivalMon)
  );
}

/**
 * Retorna se o dia é sábado, domingo ou feriado nacional
 */
export function isWeekendOrHoliday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6 || isBrazilianNationalHoliday(date);
}

export interface CcspCycleInfo {
  workDate: Date;
  cycleMonth: Date; // 1º dia do mês de competência atribuído
  cycleMonthKey: string; // "yyyy-MM"
  cycleMonthName: string; // e.g. "Outubro 2026"
  dueDate: Date; // Dia 15 do mês seguinte ao ciclo de competência
  dueDateStr: string; // "yyyy-MM-15"
  dueDateFormatted: string; // "15/MM/yyyy"
  isRollover: boolean; // se rolou para o mês seguinte por virada em fds / feriadão
  rolloverReason?: string;
}

/**
 * Calcula a competência e a data de vencimento (Dia 15 do mês seguinte) para uma diária CCSP.
 * Regra:
 * - O trabalho realizado em um mês civil M é pago no dia 15 do mês seguinte (M+1).
 * - Exceção da Virada de Mês / Feriadão:
 *   Se o mês virar durante um fim de semana (ex: sábado dia 31 e domingo dia 01) ou durante um
 *   feriadão prolongado que cruza a virada do mês, essas diárias da virada são atribuídas
 *   ao mês que entrou (M+1), e consequentemente pagas no dia 15 do outro mês (M+2).
 */
export function getCcspCycleAndDueDate(dateStrOrObj: string | Date): CcspCycleInfo {
  const dateObj = typeof dateStrOrObj === 'string'
    ? parseISO(dateStrOrObj.includes('T') ? dateStrOrObj : `${dateStrOrObj}T12:00:00`)
    : dateStrOrObj;

  const currentMonthStart = startOfMonth(dateObj);
  const currentMonthEnd = endOfMonth(dateObj);
  const nextMonthStart = addDays(currentMonthEnd, 1);

  let isRollover = false;
  let rolloverReason = '';

  // Verifica se o dia atual está próximo ao final do mês (últimos 4 dias) e é fim de semana ou feriado
  const diffToEnd = currentMonthEnd.getDate() - dateObj.getDate();
  if (diffToEnd <= 3 && isWeekendOrHoliday(dateObj)) {
    // Verifica se há uma cadeia contínua de fim de semana/feriado desde dateObj até o início do próximo mês
    let isConnected = true;
    let cursor = dateObj;
    while (isBefore(cursor, addDays(nextMonthStart, 1))) {
      if (!isWeekendOrHoliday(cursor)) {
        isConnected = false;
        break;
      }
      cursor = addDays(cursor, 1);
    }

    if (isConnected) {
      isRollover = true;
      rolloverReason = 'Virada de mês em fim de semana / feriadão prolongado';
    }
  }

  // Se rolou, a competência é o mês que entrou (nextMonthStart); senão, é o mês atual (currentMonthStart)
  const effectiveCycle = isRollover ? nextMonthStart : currentMonthStart;
  const paymentMonth = addMonths(effectiveCycle, 1);
  const dueDate = setDate(paymentMonth, 15);
  const dueDateStr = format(dueDate, 'yyyy-MM-15');
  const dueDateFormatted = format(dueDate, 'dd/MM/yyyy');

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const cycleMonthName = `${monthNames[effectiveCycle.getMonth()]} ${effectiveCycle.getFullYear()}`;

  return {
    workDate: dateObj,
    cycleMonth: effectiveCycle,
    cycleMonthKey: format(effectiveCycle, 'yyyy-MM'),
    cycleMonthName,
    dueDate,
    dueDateStr,
    dueDateFormatted,
    isRollover,
    rolloverReason: isRollover ? rolloverReason : undefined
  };
}

/**
 * Retorna o próximo dia útil caso a data caia em fim de semana ou feriado
 */
export function getNextBusinessDay(date: Date): Date {
  let cur = date;
  while (isWeekendOrHoliday(cur)) {
    cur = addDays(cur, 1);
  }
  return cur;
}

/**
 * Retorna a data prevista de pagamento para eventos e festas:
 * - Grupo Geral / Recreador (padrão): na segunda-feira seguinte ao evento
 *   (ou no próximo dia útil caso a segunda-feira seja feriado).
 * - Grupo Gestão / Administração: no dia 15 do próximo mês.
 */
export function getPartyPaymentDueDate(partyDateStrOrObj: string | Date, isManagement = false): Date {
  const dateObj = typeof partyDateStrOrObj === 'string'
    ? parseISO(partyDateStrOrObj.includes('T') ? partyDateStrOrObj : `${partyDateStrOrObj}T12:00:00`)
    : partyDateStrOrObj;

  if (isManagement) {
    const nextMonth = addMonths(startOfMonth(dateObj), 1);
    return setDate(nextMonth, 15);
  }

  const nextMon = nextMonday(dateObj);
  return getNextBusinessDay(nextMon);
}

