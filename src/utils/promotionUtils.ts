import { Employee, Promotion, WorkDay, EmployeeLevel } from '../types';

export const LEVEL_RATES: Record<EmployeeLevel, { daily: number; party: number }> = {
  'Trainee': { daily: 70, party: 70 },
  'Aprendiz': { daily: 150, party: 120 },
  'Recreador(a)': { daily: 180, party: 150 },
  'Recreador(a) Experiente': { daily: 210, party: 180 },
  'Coordenador(a)': { daily: 230, party: 210 },
  'Motorista': { daily: 0, party: 0 }
};

/**
 * Recalculates employee level, rates, and workDays based on an updated list of promotions.
 */
export function recalculateEmployeeTimeline(
  currentEmployee: Partial<Employee>,
  updatedPromotions: Promotion[]
) {
  // Sort promotions chronologically
  const sortedPromos = [...updatedPromotions].sort((a, b) => a.date.localeCompare(b.date));

  // Determine base level and rates before any promotions
  let baseLevel: EmployeeLevel = currentEmployee.level || 'Trainee';
  let baseDaily = currentEmployee.dailyRate !== undefined ? currentEmployee.dailyRate : (LEVEL_RATES[baseLevel]?.daily ?? 70);
  let baseParty = currentEmployee.partyRate !== undefined ? currentEmployee.partyRate : (LEVEL_RATES[baseLevel]?.party ?? 70);

  if (sortedPromos.length > 0) {
    baseLevel = sortedPromos[0].previousLevel;
    baseDaily = sortedPromos[0].previousDailyRate ?? (LEVEL_RATES[baseLevel]?.daily ?? 70);
    baseParty = sortedPromos[0].previousPartyRate ?? (LEVEL_RATES[baseLevel]?.party ?? 70);
  }

  // Determine current (latest) level and rates after all promotions
  let finalLevel = baseLevel;
  let finalDaily = baseDaily;
  let finalParty = baseParty;

  if (sortedPromos.length > 0) {
    const lastPromo = sortedPromos[sortedPromos.length - 1];
    finalLevel = lastPromo.newLevel;
    finalDaily = lastPromo.newDailyRate;
    finalParty = lastPromo.newPartyRate;
  }

  // Recalculate workDays
  const workDays = currentEmployee.workDays || [];
  const updatedWorkDays: WorkDay[] = workDays.map((day) => {
    // Find active promotion on or before this workDay's date
    const activePromos = sortedPromos.filter((p) => p.date <= day.date);
    if (activePromos.length > 0) {
      const active = activePromos[activePromos.length - 1]; // latest promo on or before day.date
      return {
        ...day,
        levelAtTime: active.newLevel,
        dailyRateAtTime: active.newDailyRate,
        partyRateAtTime: active.newPartyRate,
        extraHourRateAtTime: day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : (currentEmployee.extraHourRate || 0)
      };
    } else {
      // Prior to all promotions
      return {
        ...day,
        levelAtTime: baseLevel,
        dailyRateAtTime: baseDaily,
        partyRateAtTime: baseParty,
        extraHourRateAtTime: day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : (currentEmployee.extraHourRate || 0)
      };
    }
  });

  return {
    promotions: sortedPromos,
    level: finalLevel,
    dailyRate: finalDaily,
    partyRate: finalParty,
    workDays: updatedWorkDays
  };
}