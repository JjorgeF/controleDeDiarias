import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO, nextMonday, addMonths, setDate, startOfMonth } from "date-fns";

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
 * Retorna a data prevista de pagamento para eventos e festas:
 * - Grupo Geral / Recreador (padrão): sempre na segunda-feira seguinte ao evento.
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

  return nextMonday(dateObj);
}
