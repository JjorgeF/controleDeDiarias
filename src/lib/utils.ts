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
import { Employee, WorkDay } from "../types";

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

/**
 * Verifica se o dia é uma emenda clássica de feriado prolongado:
 * - Segunda-feira quando terça-feira é feriado nacional
 * - Sexta-feira quando quinta-feira é feriado nacional
 */
export function isHolidayBridgeDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 1) {
    return isBrazilianNationalHoliday(addDays(date, 1));
  }
  if (dayOfWeek === 5) {
    return isBrazilianNationalHoliday(subDays(date, 1));
  }
  return false;
}

/**
 * Retorna se o dia compõe um bloco de fim de semana, feriado ou emenda
 */
export function isHolidayBlockDay(date: Date): boolean {
  return isWeekendOrHoliday(date) || isHolidayBridgeDay(date);
}

export interface CcspCycleInfo {
  workDate: Date;
  cycleMonth: Date; // 1º dia do mês de competência atribuído
  cycleMonthKey: string; // "yyyy-MM"
  cycleMonthName: string; // e.g. "Outubro 2026"
  dueDate: Date; // Dia 15 do mês seguinte ao ciclo de competência
  dueDateStr: string; // "yyyy-MM-15"
  dueDateFormatted: string; // "15/MM/yyyy"
  isRollover: boolean; // true quando a data veio do mês entrante (ex: 01/11, 02/11) puxada para o lote 15/11
  isMonthTurnBridge: boolean; // true para qualquer dia de um bloco de feriado/emenda na virada do mês
  isPulledFromNextMonth: boolean; // true especificamente quando a data civil pertence ao mês seguinte ao ciclo
  bridgeDatesFormatted?: string[]; // Datas do bloco conectado (ex: ["31/10", "01/11", "02/11"])
  rolloverReason?: string;
}

/**
 * Calcula a competência e a data de vencimento (Dia 15) para uma diária CCSP.
 * Regra vigente:
 * - O trabalho realizado em um mês civil M é pago no dia 15 do mês seguinte (M+1).
 * - Exceção de Virada de Mês em Feriado Prolongado / Emenda:
 *   Quando um feriado nacional (ou sua emenda em segunda/sexta-feira) cria um bloco
 *   contínuo conectado ao fim de semana que cruza a virada do mês (ex: 31/10 Sáb,
 *   01/11 Dom e 02/11 Seg Finados), todo esse bloco conectado é agrupado na competência
 *   do mês que fecha (M), com pagamento agendado para o dia 15 do mês que se inicia (M+1, ex: 15/11).
 * - Finais de semana comuns na virada sem feriado/emenda seguem a separação normal de fechamento mensal.
 */
export function getCcspCycleAndDueDate(dateStrOrObj: string | Date): CcspCycleInfo {
  const dateObj = typeof dateStrOrObj === 'string'
    ? parseISO(dateStrOrObj.includes('T') ? dateStrOrObj : `${dateStrOrObj}T12:00:00`)
    : new Date(dateStrOrObj.getFullYear(), dateStrOrObj.getMonth(), dateStrOrObj.getDate(), 12, 0, 0);

  const currentMonthStart = startOfMonth(dateObj);
  let effectiveCycle = currentMonthStart;
  let isMonthTurnBridge = false;
  let isPulledFromNextMonth = false;
  let rolloverReason = '';
  let bridgeDatesFormatted: string[] | undefined;

  if (isHolidayBlockDay(dateObj)) {
    let blockStart = dateObj;
    let guard = 0;
    while (guard < 10 && isHolidayBlockDay(subDays(blockStart, 1))) {
      blockStart = subDays(blockStart, 1);
      guard++;
    }

    let blockEnd = dateObj;
    guard = 0;
    while (guard < 10 && isHolidayBlockDay(addDays(blockEnd, 1))) {
      blockEnd = addDays(blockEnd, 1);
      guard++;
    }

    const blockDays: Date[] = [];
    let cursor = blockStart;
    while (!isBefore(blockEnd, cursor)) {
      blockDays.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const crossesMonth =
      blockStart.getFullYear() !== blockEnd.getFullYear() ||
      blockStart.getMonth() !== blockEnd.getMonth();
    const hasNationalHoliday = blockDays.some(d => isBrazilianNationalHoliday(d));

    // Apenas agrupa na virada quando há feriado/emenda formando bloco prolongado (>= 3 dias) cruzando a virada
    if (crossesMonth && hasNationalHoliday && blockDays.length >= 3) {
      isMonthTurnBridge = true;
      effectiveCycle = startOfMonth(blockStart);
      isPulledFromNextMonth = effectiveCycle.getTime() !== currentMonthStart.getTime();
      bridgeDatesFormatted = blockDays.map(d => format(d, 'dd/MM'));
      rolloverReason = 'Feriado prolongado / emenda na virada do mês (lote no dia 15 do mês que inicia)';
    }
  }

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
    isRollover: isPulledFromNextMonth,
    isMonthTurnBridge,
    isPulledFromNextMonth,
    bridgeDatesFormatted,
    rolloverReason: isMonthTurnBridge ? rolloverReason : undefined
  };
}

/**
 * Regra legada anterior (para conciliação segura de lotes já quitados antes da mudança,
 * como o lote de 15/11/2026 onde 31/10, 01/11 e 02/11 haviam sido empurrados para 15/12/2026).
 */
export function getLegacyCcspCycleAndDueDate(dateStrOrObj: string | Date): { cycleMonth: Date; dueDateStr: string } {
  const dateObj = typeof dateStrOrObj === 'string'
    ? parseISO(dateStrOrObj.includes('T') ? dateStrOrObj : `${dateStrOrObj}T12:00:00`)
    : new Date(dateStrOrObj.getFullYear(), dateStrOrObj.getMonth(), dateStrOrObj.getDate(), 12, 0, 0);

  const currentMonthStart = startOfMonth(dateObj);
  const currentMonthEnd = endOfMonth(dateObj);
  const nextMonthStart = addDays(currentMonthEnd, 1);

  let isRollover = false;
  const diffToEnd = currentMonthEnd.getDate() - dateObj.getDate();
  if (diffToEnd <= 3 && isWeekendOrHoliday(dateObj)) {
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
    }
  }

  const effectiveCycle = isRollover ? nextMonthStart : currentMonthStart;
  const paymentMonth = addMonths(effectiveCycle, 1);
  const dueDate = setDate(paymentMonth, 15);
  return {
    cycleMonth: effectiveCycle,
    dueDateStr: format(dueDate, 'yyyy-MM-15')
  };
}

/**
 * Calcula o valor financeiro exato de uma diária (CCSP ou Festa) considerando acordos, pernoite e horas extras.
 */
export function getWorkDayPayAmount(d: WorkDay, employee: Employee): number {
  const isParty = d.type === 'party';
  let rate = d.isReducedHours && d.customTotalPay !== undefined && d.customTotalPay >= 0
    ? d.customTotalPay
    : isParty
      ? (d.partyRateAtTime !== undefined ? d.partyRateAtTime : employee.partyRate)
      : (d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : employee.dailyRate);

  if (d.isOvernight && d.overnightPay !== undefined && d.overnightPay > 0) {
    rate += d.overnightPay;
  }

  const extraRate = (d.extraHourRateAtTime && d.extraHourRateAtTime > 0)
    ? d.extraHourRateAtTime
    : (employee.extraHourRate || 0);
  const extra = (d.extraHours || 0) * extraRate;
  return Number((rate + extra).toFixed(2));
}

export interface CcspBatchStatus {
  matchingDays: WorkDay[];
  totalAmount: number;
  alreadyPaidAmount: number;
  remainingAmount: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  hasPaidFlagWithPendingBalance: boolean;
  unpaidDays: WorkDay[];
  paidDaysCount: number;
  pulledFromNextMonthDates: string[];
  bridgeDatesInBatch: string[];
}

/**
 * Calcula e concilia o status de pagamento de um lote CCSP (ex: "2026-11-15"),
 * detectando automaticamente lotes já quitados que receberam novas diárias ou dias da virada.
 */
export function computeCcspBatchStatus(employee: Employee, dueDateStr: string): CcspBatchStatus {
  const matchingDays = (employee.workDays || [])
    .filter(wd => {
      if (wd.isCancelled || !wd.date || wd.type !== 'common') return false;
      try {
        return getCcspCycleAndDueDate(wd.date).dueDateStr === dueDateStr;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (matchingDays.length === 0) {
    return {
      matchingDays: [],
      totalAmount: 0,
      alreadyPaidAmount: 0,
      remainingAmount: 0,
      isFullyPaid: false,
      isPartiallyPaid: false,
      hasPaidFlagWithPendingBalance: false,
      unpaidDays: [],
      paidDaysCount: 0,
      pulledFromNextMonthDates: [],
      bridgeDatesInBatch: []
    };
  }

  const totalAmount = Number(
    matchingDays.reduce((acc, d) => acc + getWorkDayPayAmount(d, employee), 0).toFixed(2)
  );

  const pulledFromNextMonthDates: string[] = [];
  const bridgeDatesInBatch: string[] = [];

  matchingDays.forEach(d => {
    const info = getCcspCycleAndDueDate(d.date);
    const shortDate = format(info.workDate, 'dd/MM');
    if (info.isPulledFromNextMonth && !pulledFromNextMonthDates.includes(shortDate)) {
      pulledFromNextMonthDates.push(shortDate);
    }
    if (info.isMonthTurnBridge && !bridgeDatesInBatch.includes(shortDate)) {
      bridgeDatesInBatch.push(shortDate);
    }
  });

  const settlement = employee.ccspSettlements?.[dueDateStr];
  const hasPaidDateFlag = (employee.paidDates || []).includes(dueDateStr);

  if (settlement) {
    const settledKeys = new Set(settlement.settledWorkDayKeys || []);
    const unpaidDays = matchingDays.filter(
      d => !settledKeys.has(getWorkDayUniqueKey(d.date, 'common', d.partyId))
    );
    const alreadyPaidAmount = Number((settlement.paidAmount || 0).toFixed(2));
    const remainingAmount = Math.max(0, Number((totalAmount - alreadyPaidAmount).toFixed(2)));
    const isFullyPaid = remainingAmount <= 0.009;
    const isPartiallyPaid = alreadyPaidAmount > 0 && remainingAmount > 0.009;
    const paidDaysCount = isFullyPaid
      ? matchingDays.length
      : Math.max(0, matchingDays.length - unpaidDays.length);

    return {
      matchingDays,
      totalAmount,
      alreadyPaidAmount,
      remainingAmount,
      isFullyPaid,
      isPartiallyPaid,
      hasPaidFlagWithPendingBalance: isPartiallyPaid,
      unpaidDays,
      paidDaysCount,
      pulledFromNextMonthDates,
      bridgeDatesInBatch
    };
  }

  if (hasPaidDateFlag) {
    let alreadyPaidAmount = 0;
    const unpaidDays: WorkDay[] = [];

    matchingDays.forEach(d => {
      const legacyDueStr = getLegacyCcspCycleAndDueDate(d.date).dueDateStr;
      const wasPaidUnderLegacy = (employee.paidDates || []).includes(legacyDueStr);
      if (wasPaidUnderLegacy) {
        alreadyPaidAmount += getWorkDayPayAmount(d, employee);
      } else {
        unpaidDays.push(d);
      }
    });

    alreadyPaidAmount = Number(alreadyPaidAmount.toFixed(2));
    const remainingAmount = Math.max(0, Number((totalAmount - alreadyPaidAmount).toFixed(2)));
    const isFullyPaid = remainingAmount <= 0.009;
    const isPartiallyPaid = alreadyPaidAmount > 0 && remainingAmount > 0.009;
    const hasPaidFlagWithPendingBalance = remainingAmount > 0.009;
    const paidDaysCount = matchingDays.length - unpaidDays.length;

    return {
      matchingDays,
      totalAmount,
      alreadyPaidAmount,
      remainingAmount,
      isFullyPaid,
      isPartiallyPaid,
      hasPaidFlagWithPendingBalance,
      unpaidDays,
      paidDaysCount,
      pulledFromNextMonthDates,
      bridgeDatesInBatch
    };
  }

  return {
    matchingDays,
    totalAmount,
    alreadyPaidAmount: 0,
    remainingAmount: totalAmount,
    isFullyPaid: false,
    isPartiallyPaid: false,
    hasPaidFlagWithPendingBalance: false,
    unpaidDays: matchingDays,
    paidDaysCount: 0,
    pulledFromNextMonthDates,
    bridgeDatesInBatch
  };
}

/**
 * Verifica se uma escala de Festa/Evento já foi marcada como paga (por chave única, isPaid ou legado).
 */
export function isPartyWorkDayPaid(pd: WorkDay, employee: Employee): boolean {
  if (pd.isPaid) return true;
  const paidDates = employee.paidDates || [];
  if (paidDates.length === 0) return false;

  const allPartyDays = (employee.workDays || []).filter(
    wd => !wd.isCancelled && wd.date && wd.type === 'party'
  );
  const idx = allPartyDays.findIndex(
    w => w === pd || (w.date === pd.date && w.partyId === pd.partyId && w.partyName === pd.partyName)
  );
  const partyUniqueKey = `party_${pd.date}_${pd.partyId || pd.partyName || (idx >= 0 ? idx : 0)}`;
  if (paidDates.includes(partyUniqueKey)) return true;

  const sameDayPartyCount = allPartyDays.filter(p => p.date === pd.date).length;
  if (sameDayPartyCount <= 1) {
    try {
      const isManagement = employee.paymentGroup === 'management';
      const dueDateStr = format(getPartyPaymentDueDate(pd.date, isManagement), 'yyyy-MM-dd');
      if (paidDates.includes(dueDateStr) || paidDates.includes(pd.date)) {
        return true;
      }
    } catch {
      if (paidDates.includes(pd.date)) return true;
    }
  }

  return false;
}

/**
 * Verifica se uma diária CCSP específica já foi quitada no seu lote correspondente.
 */
export function isCcspWorkDayPaid(wd: WorkDay, employee: Employee): boolean {
  try {
    const { dueDateStr } = getCcspCycleAndDueDate(wd.date);
    const batchStatus = computeCcspBatchStatus(employee, dueDateStr);
    if (batchStatus.isFullyPaid) return true;
    if (batchStatus.alreadyPaidAmount <= 0 && !batchStatus.hasPaidFlagWithPendingBalance) {
      return false;
    }
    const targetKey = getWorkDayUniqueKey(wd.date, 'common', wd.partyId);
    return !batchStatus.unpaidDays.some(
      u => getWorkDayUniqueKey(u.date, 'common', u.partyId) === targetKey && u.date === wd.date
    );
  } catch {
    return false;
  }
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

/**
 * Converte strings de horários em minutos desde a meia-noite para cálculo de choque de horário.
 * Exemplos aceitos:
 * - "11h - 21h00", "11:00 às 21:00", "14h até 18h", "14:00 até 18:00", "14:00", "14h"
 */
export function parseShiftHours(str?: string): { startMinutes: number; endMinutes: number } | null {
  if (!str) return null;
  const cleaned = str.trim().toLowerCase();

  // Caso com intervalo (ex: "11h - 21h00", "11:00 às 21:00", "14h até 18h")
  const intervalRegex = /(\d{1,2})(?:[h:](\d{2})?)?\s*(?:h)?\s*(?:-|até|às|as|a)\s*(\d{1,2})(?:[h:](\d{2})?)?\s*(?:h)?/;
  const match = cleaned.match(intervalRegex);
  if (match) {
    const startH = parseInt(match[1], 10);
    const startM = match[2] ? parseInt(match[2], 10) : 0;
    const endH = parseInt(match[3], 10);
    const endM = match[4] ? parseInt(match[4], 10) : 0;

    let startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;

    // Se o horário final for menor ou igual ao inicial, cruza a meia-noite (ex: pernoite 22h às 08h)
    if (endMin <= startMin) {
      endMin += 24 * 60;
    }
    return { startMinutes: startMin, endMinutes: endMin };
  }

  // Caso com apenas horário inicial (ex: "14:00" ou "14h") -> assume duração padrão de 4 horas para festa
  const singleRegex = /^(\d{1,2})(?:[h:](\d{2})?)?\s*(?:h)?$/;
  const singleMatch = cleaned.match(singleRegex);
  if (singleMatch) {
    const startH = parseInt(singleMatch[1], 10);
    const startM = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
    const startMin = startH * 60 + startM;
    return { startMinutes: startMin, endMinutes: startMin + 4 * 60 };
  }

  return null;
}

/**
 * Verifica se dois turnos/atividades possuem choque de horário (sobreposição)
 */
export function checkShiftsOverlap(shift1?: string, shift2?: string): { hasOverlap: boolean; message?: string } {
  if (!shift1 || !shift2) return { hasOverlap: false };
  const t1 = parseShiftHours(shift1);
  const t2 = parseShiftHours(shift2);
  if (!t1 || !t2) return { hasOverlap: false };

  // Dois intervalos [A, B] e [C, D] se sobrepõem se A < D e C < B
  const overlaps = t1.startMinutes < t2.endMinutes && t2.startMinutes < t1.endMinutes;
  if (overlaps) {
    return {
      hasOverlap: true,
      message: `Sobreposição de horários: "${shift1}" coincide com "${shift2}".`
    };
  }
  return { hasOverlap: false };
}

/**
 * Gera chave identificadora única para uma atividade/escala de trabalho
 */
export function getWorkDayUniqueKey(date: string, type: 'common' | 'party', partyId?: string): string {
  if (type === 'common') {
    return `${date}_common`;
  }
  return `${date}_party_${partyId || 'default'}`;
}
