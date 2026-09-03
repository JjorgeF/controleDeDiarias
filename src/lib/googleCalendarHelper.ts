import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PartyDetails, Employee } from '../types';

/**
 * Formats a date and time string into Google Calendar ISO format: YYYYMMDDTHHMMSS
 */
function formatGoogleCalendarDate(dateStr: string, timeStr?: string): string {
  try {
    const cleanDate = dateStr.replace(/-/g, '');
    if (!timeStr) {
      return `${cleanDate}T090000`;
    }

    // Extract hours and minutes (e.g. "14:00" or "14h30" or "14h")
    const match = timeStr.match(/(\d{1,2})[h:]?(\d{0,2})/i);
    if (!match) {
      return `${cleanDate}T090000`;
    }

    const hours = match[1].padStart(2, '0');
    const minutes = (match[2] || '00').padStart(2, '0');
    return `${cleanDate}T${hours}${minutes}00`;
  } catch {
    return `${dateStr.replace(/-/g, '')}T090000`;
  }
}

/**
 * Builds Google Calendar web intent link with recreadores emails automatically added as guests (add param)
 */
export function buildGoogleCalendarUrl(
  party: PartyDetails, 
  assignedEmployees: Employee[] = [],
  includeContractorEmail: boolean = false
): string {
  const title = `🎉 Festa: ${party.name || 'Evento Liga Positiva'}`;
  
  const startTimeFormatted = formatGoogleCalendarDate(party.date, party.time);
  
  // Calculate end time (default to 4 hours after start if not provided)
  let endTimeFormatted = formatGoogleCalendarDate(party.date, party.endTime);
  if (!party.endTime) {
    try {
      const match = (party.time || '14:00').match(/(\d{1,2})[h:]?(\d{0,2})/i);
      if (match) {
        const startH = parseInt(match[1], 10);
        const endH = (startH + 4) % 24;
        const endM = (match[2] || '00').padStart(2, '0');
        endTimeFormatted = `${party.date.replace(/-/g, '')}T${endH.toString().padStart(2, '0')}${endM}00`;
      }
    } catch {
      endTimeFormatted = `${party.date.replace(/-/g, '')}T180000`;
    }
  }

  // Collect emails from assigned employees
  const guestEmails: string[] = [];
  const teamLines: string[] = [];

  assignedEmployees.forEach(e => {
    const hasEmail = e.email && e.email.trim().includes('@');
    const emailStr = hasEmail ? ` (${e.email?.trim()})` : '';
    teamLines.push(`• ${e.artisticName || e.name} - ${e.level}${emailStr}`);

    if (hasEmail) {
      const cleanEmail = e.email!.trim();
      if (!guestEmails.includes(cleanEmail)) {
        guestEmails.push(cleanEmail);
      }
    }
  });

  if (includeContractorEmail && party.contractorEmail && party.contractorEmail.trim().includes('@')) {
    const cEmail = party.contractorEmail.trim();
    if (!guestEmails.includes(cEmail)) {
      guestEmails.push(cEmail);
    }
  }

  const teamList = teamLines.length > 0 
    ? teamLines.join('\n')
    : 'Nenhum recreador escalado ainda';

  const servicesList = party.services && party.services.length > 0
    ? party.services.join(', ')
    : 'Recreação Padrão';

  let details = `🎈 LIGA POSITIVA - EVENTO & FESTA\n\n`;
  details += `📅 Data: ${party.date}\n`;
  if (party.time) details += `⏰ Horário: ${party.time}${party.endTime ? ` às ${party.endTime}` : ''}\n`;
  if (party.setupTime) details += `⏱️ Chegada / Montagem: ${party.setupTime}\n`;
  if (party.location) details += `📍 Local: ${party.location}\n`;
  if (party.eventType) details += `🏷️ Tipo: ${party.eventType}\n`;
  if (party.theme) details += `🎨 Tema: ${party.theme}\n`;
  if (party.birthdayPersonName) details += `🎂 Aniversariante: ${party.birthdayPersonName} ${party.birthdayPersonAge ? `(${party.birthdayPersonAge} anos)` : ''}\n`;
  
  details += `\n🎯 Serviços: ${servicesList}\n`;
  details += `\n👥 Equipe Escalada:\n${teamList}\n`;

  if (party.contractorName || party.contractorPhone) {
    details += `\n👤 Responsável Contratante:\n`;
    if (party.contractorName) details += `• Nome: ${party.contractorName}\n`;
    if (party.contractorPhone) details += `• Tel/WhatsApp: ${party.contractorPhone}\n`;
    if (party.contractorEmail) details += `• E-mail: ${party.contractorEmail}\n`;
  }

  if (party.contractorNotes) {
    details += `\n📝 Observações:\n${party.contractorNotes}\n`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startTimeFormatted}/${endTimeFormatted}`,
    details: details,
    location: party.location || 'CCSP - São Paulo',
  });

  // Automatically add all recreadores registered emails as guests / attendees
  if (guestEmails.length > 0) {
    params.set('add', guestEmails.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Builds formatted text briefing ready to copy for WhatsApp
 */
export function buildWhatsAppBriefing(party: PartyDetails, assignedEmployees: Employee[] = []): string {
  const teamList = assignedEmployees.length > 0 
    ? assignedEmployees.map(e => `👉 ${e.artisticName || e.name} (${e.level})`).join('\n')
    : 'A definir';

  const servicesList = party.services && party.services.length > 0
    ? party.services.join(', ')
    : 'Recreação Geral';

  let dateFormatted = party.date;
  try {
    dateFormatted = format(parseISO(party.date), "EEEE, dd 'de' MMMM", { locale: ptBR });
    dateFormatted = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
  } catch {}

  let msg = `🎉 *BRIEFING DE EVENTO - LIGA POSITIVA* 🎉\n\n`;
  msg += `📌 *Festa:* ${party.name}\n`;
  msg += `📅 *Data:* ${dateFormatted}\n`;
  msg += `⏰ *Horário:* ${party.time || 'A combinar'}${party.endTime ? ` até ${party.endTime}` : ''}\n`;
  if (party.setupTime) msg += `⏱️ *Chegada da Equipe:* ${party.setupTime}\n`;
  msg += `📍 *Local:* ${party.location || 'CCSP'}\n`;
  
  if (party.theme) msg += `🎨 *Tema:* ${party.theme}\n`;
  if (party.birthdayPersonName) msg += `🎂 *Aniversariante:* ${party.birthdayPersonName} ${party.birthdayPersonAge ? `(${party.birthdayPersonAge} anos)` : ''}\n`;
  msg += `🎯 *Atividades & Serviços:* ${servicesList}\n\n`;

  msg += `👥 *Equipe Escalada:*\n${teamList}\n\n`;

  if (party.contractorName || party.contractorPhone) {
    msg += `👤 *Contratante:*\n`;
    if (party.contractorName) msg += `• ${party.contractorName}\n`;
    if (party.contractorPhone) msg += `• Tel: ${party.contractorPhone}\n`;
  }

  if (party.contractorNotes) {
    msg += `\n⚠️ *Avisos / Restrições:* ${party.contractorNotes}\n`;
  }

  msg += `\n✨ *Bom evento a todos! Contamos com a energia de vocês!*`;

  return msg;
}

/**
 * Helper to get list of assigned employees with valid registered emails
 */
export function getAssignedEmployeesWithEmail(assignedEmployees: Employee[] = []): Employee[] {
  return assignedEmployees.filter(e => !!e.email && e.email.trim().includes('@'));
}

/**
 * Downloads standard .ics calendar file for Apple Calendar / Outlook
 */
export function downloadIcsFile(party: PartyDetails, assignedEmployees: Employee[] = []): void {
  const startTimeFormatted = formatGoogleCalendarDate(party.date, party.time);
  let endTimeFormatted = formatGoogleCalendarDate(party.date, party.endTime);
  if (!party.endTime) {
    endTimeFormatted = `${party.date.replace(/-/g, '')}T180000`;
  }

  const title = `Festa: ${party.name || 'Evento Liga Positiva'}`;
  const location = party.location || 'CCSP';
  const description = buildWhatsAppBriefing(party, assignedEmployees).replace(/\n/g, '\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liga Positiva//Eventos//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DTSTART:${startTimeFormatted}`,
    `DTEND:${endTimeFormatted}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
  ];

  // Add attendees to ICS
  assignedEmployees.forEach(e => {
    if (e.email && e.email.trim().includes('@')) {
      icsLines.push(`ATTENDEE;CN=${e.artisticName || e.name};RSVP=TRUE:mailto:${e.email.trim()}`);
    }
  });

  icsLines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');

  const icsContent = icsLines.join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `evento_${party.date}_${(party.name || 'festa').replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
