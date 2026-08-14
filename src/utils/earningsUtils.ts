import { WorkDay, Employee } from '../types';

/**
 * Returns the effective base earnings for a workday.
 * If the workday is marked as reduced/custom hours with customTotalPay,
 * it returns that agreed value.
 * Otherwise, it uses the snapshot rates (dailyRateAtTime / partyRateAtTime) or standard employee rates.
 */
export function getWorkDayBaseAmount(workDay: WorkDay, employee?: Employee): number {
  if (workDay.isCancelled) return 0;
  
  if (workDay.isReducedHours && workDay.customTotalPay !== undefined && workDay.customTotalPay >= 0) {
    return workDay.customTotalPay;
  }

  if (workDay.type === 'party') {
    if (workDay.partyRateAtTime !== undefined) return workDay.partyRateAtTime;
    return employee?.partyRate || 0;
  }

  // Common (CCSP)
  if (workDay.dailyRateAtTime !== undefined) return workDay.dailyRateAtTime;
  return employee?.dailyRate || 0;
}

/**
 * Returns the effective extra hours earnings for a workday.
 * If reduced hours is enabled, extra hours are normally not used or 0 unless specified.
 */
export function getWorkDayExtraAmount(workDay: WorkDay, employee?: Employee): number {
  if (workDay.isCancelled) return 0;
  if (!workDay.extraHours || workDay.extraHours <= 0) return 0;

  const extraRate = workDay.extraHourRateAtTime !== undefined 
    ? workDay.extraHourRateAtTime 
    : (employee?.extraHourRate || 0);

  return workDay.extraHours * extraRate;
}

/**
 * Returns total earnings (base + extra) for a single workday.
 */
export function getWorkDayTotalAmount(workDay: WorkDay, employee?: Employee): number {
  return getWorkDayBaseAmount(workDay, employee) + getWorkDayExtraAmount(workDay, employee);
}
