import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO, nextMonday } from "date-fns";

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
 * Acontece sempre na segunda-feira seguinte à realização do evento.
 */
export function getPartyPaymentDueDate(partyDateStrOrObj: string | Date): Date {
  const dateObj = typeof partyDateStrOrObj === 'string'
    ? parseISO(partyDateStrOrObj.includes('T') ? partyDateStrOrObj : `${partyDateStrOrObj}T12:00:00`)
    : partyDateStrOrObj;
  return nextMonday(dateObj);
}
