import React, { useState, useMemo } from 'react';
import { 
  PartyPopper, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  CheckSquare, 
  CalendarPlus, 
  MessageCircle, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Edit3, 
  Trash2,
  Sparkles,
  Layers,
  CalendarCheck,
  AlertCircle
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  differenceInCalendarDays, 
  isPast,
  isToday,
  isTomorrow
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PartyDetails, DayConfig, Employee } from '../types';
import { buildGoogleCalendarUrl, buildWhatsAppBriefing, getAssignedEmployeesWithEmail } from '../lib/googleCalendarHelper';
import PartyModal from './PartyModal';
import { cn } from '../lib/utils';

interface PartyManagementViewProps {
  parties: PartyDetails[];
  dayConfigs: Record<string, DayConfig>;
  employees: Employee[];
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  onSaveParty: (party: PartyDetails, assignedEmployeeIds?: string[]) => Promise<void>;
  onDeleteParty: (partyId: string, date: string) => Promise<void>;
}

export default function PartyManagementView({
  parties,
  dayConfigs,
  employees,
  currentMonth,
  setCurrentMonth,
  onSaveParty,
  onDeleteParty
}: PartyManagementViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'missing_team' | 'pending_checklist'>('all');
  const [selectedParty, setSelectedParty] = useState<PartyDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedPartyId, setCopiedPartyId] = useState<string | null>(null);

  // Synthesize unified parties list from both party_events collection and dayConfigs
  const allUnifiedParties = useMemo(() => {
    const map = new Map<string, PartyDetails>();

    // 1. First add from parties collection
    parties.forEach(p => {
      const key = `${p.date}_${p.partyId || p.id}`;
      map.set(key, p);
    });

    // 2. Add from dayConfigs if not already in party_events
    Object.entries(dayConfigs).forEach(([dateStr, config]) => {
      const partyList = config.parties && config.parties.length > 0
        ? config.parties
        : (config.isParty ? [{ id: 'default_party', name: 'Festa', time: config.partyTime }] : []);

      partyList.forEach(p => {
        const key = `${dateStr}_${p.id}`;
        if (!map.has(key)) {
          // Find employees with workDays for this party
          const assignedEmps = employees.filter(emp => 
            emp.workDays?.some(d => d.date === dateStr && d.type === 'party' && (d.partyId === p.id || d.partyName === p.name))
          ).map(e => e.id);

          map.set(key, {
            id: key,
            partyId: p.id,
            date: dateStr,
            name: p.name || 'Festa',
            time: p.time || config.partyTime || '14:00',
            location: 'CCSP',
            eventType: 'Aniversário Infantil',
            assignedEmployeeIds: assignedEmps,
            services: ['Recreação Completa'],
            checklist: []
          });
        }
      });
    });

    // Convert map to sorted array by date and time
    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.date + (a.time || '00:00');
      const dateB = b.date + (b.time || '00:00');
      return dateA.localeCompare(dateB);
    });
  }, [parties, dayConfigs, employees]);

  // Filter parties by month and search
  const filteredParties = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const today = new Date();

    return allUnifiedParties.filter(party => {
      // Month match
      let partyDate: Date;
      try {
        partyDate = parseISO(party.date);
      } catch {
        return false;
      }

      const inSelectedMonth = isSameMonth(partyDate, currentMonth);
      if (!inSelectedMonth && filterType !== 'upcoming') return false;

      // Filter by type
      if (filterType === 'upcoming') {
        const daysDiff = differenceInCalendarDays(partyDate, today);
        if (daysDiff < 0) return false;
      } else if (filterType === 'missing_team') {
        const assigned = party.assignedEmployeeIds || [];
        if (assigned.length > 0) return false;
      } else if (filterType === 'pending_checklist') {
        const list = party.checklist || [];
        const hasUnchecked = list.length === 0 || list.some(i => !i.checked);
        if (!hasUnchecked) return false;
      }

      // Search query filter
      if (query) {
        const matchName = (party.name || '').toLowerCase().includes(query);
        const matchContractor = (party.contractorName || '').toLowerCase().includes(query);
        const matchLocation = (party.location || '').toLowerCase().includes(query);
        const matchBirthday = (party.birthdayPersonName || '').toLowerCase().includes(query);
        const matchTheme = (party.theme || '').toLowerCase().includes(query);
        return matchName || matchContractor || matchLocation || matchBirthday || matchTheme;
      }

      return true;
    });
  }, [allUnifiedParties, currentMonth, searchQuery, filterType]);

  // Statistics for Current Month
  const monthParties = useMemo(() => {
    return allUnifiedParties.filter(p => {
      try {
        return isSameMonth(parseISO(p.date), currentMonth);
      } catch {
        return false;
      }
    });
  }, [allUnifiedParties, currentMonth]);

  const stats = useMemo(() => {
    const total = monthParties.length;
    const missingTeam = monthParties.filter(p => !p.assignedEmployeeIds || p.assignedEmployeeIds.length === 0).length;
    const completedChecklists = monthParties.filter(p => p.checklist && p.checklist.length > 0 && p.checklist.every(i => i.checked)).length;
    
    // Find next upcoming party
    const today = new Date();
    const upcoming = allUnifiedParties.find(p => {
      try {
        return differenceInCalendarDays(parseISO(p.date), today) >= 0;
      } catch {
        return false;
      }
    });

    return {
      total,
      missingTeam,
      completedChecklists,
      nextUpcoming: upcoming
    };
  }, [monthParties, allUnifiedParties]);

  const handleCopyWhatsApp = (party: PartyDetails) => {
    const assignedEmps = employees.filter(e => (party.assignedEmployeeIds || []).includes(e.id));
    const text = buildWhatsAppBriefing(party, assignedEmps);
    navigator.clipboard.writeText(text);
    setCopiedPartyId(party.id);
    setTimeout(() => setCopiedPartyId(null), 2500);
  };

  const getRelativeDayBadge = (dateStr: string) => {
    try {
      const partyDate = parseISO(dateStr);
      if (isToday(partyDate)) {
        return <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider animate-pulse">Hoje</span>;
      }
      if (isTomorrow(partyDate)) {
        return <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Amanhã</span>;
      }
      const daysDiff = differenceInCalendarDays(partyDate, new Date());
      if (daysDiff > 0 && daysDiff <= 7) {
        return <span className="bg-brand-party/20 text-brand-party border border-brand-party/30 px-2 py-0.5 rounded-md text-[10px] font-bold">Em {daysDiff} dias</span>;
      }
      if (daysDiff < 0) {
        return <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md text-[10px] font-bold">Realizado</span>;
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Banner & Statistics */}
      <div className="bg-gradient-to-br from-brand-party/40 via-brand-card to-brand-card border border-brand-party/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-party/20 border border-brand-party/40 flex items-center justify-center text-brand-party shrink-0 shadow-lg">
              <PartyPopper size={28} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-brand-text flex items-center gap-2">
                <span>Central de Festas & Eventos</span>
                <span className="text-xs px-2.5 py-0.5 bg-brand-party/20 text-brand-party border border-brand-party/40 rounded-full font-extrabold">
                  {monthParties.length} {monthParties.length === 1 ? 'evento' : 'eventos'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                Briefings, dados confidenciais dos contratantes, checklists de materiais e equipe escalada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedParty(null);
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-200" />
            <span>Cadastrar Nova Festa</span>
          </button>
        </div>

        {/* Quick KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-brand-border/60">
          <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
            <p className="text-[11px] font-bold text-brand-muted">Eventos em {format(currentMonth, 'MMMM', { locale: ptBR })}</p>
            <p className="text-xl font-black text-brand-text mt-0.5">{stats.total}</p>
          </div>

          <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
            <p className="text-[11px] font-bold text-brand-muted">Sem Equipe Definida</p>
            <p className={cn("text-xl font-black mt-0.5", stats.missingTeam > 0 ? "text-amber-400" : "text-emerald-400")}>
              {stats.missingTeam}
            </p>
          </div>

          <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
            <p className="text-[11px] font-bold text-brand-muted">Checklists 100% Prontos</p>
            <p className="text-xl font-black text-emerald-400 mt-0.5">
              {stats.completedChecklists} <span className="text-xs font-normal text-brand-muted">/ {stats.total}</span>
            </p>
          </div>

          <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
            <p className="text-[11px] font-bold text-brand-muted">Próxima Festa</p>
            <p className="text-xs font-black text-brand-party mt-1 truncate">
              {stats.nextUpcoming 
                ? `${format(parseISO(stats.nextUpcoming.date), 'dd/MM')} - ${stats.nextUpcoming.name}`
                : 'Nenhuma agendada'}
            </p>
          </div>
        </div>
      </div>

      {/* Month Navigator, Search and Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-brand-card p-3 sm:p-4 rounded-2xl border border-brand-border">
        {/* Month Selector */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-bg rounded-xl border border-brand-border transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-bg rounded-xl border border-brand-border">
            <CalendarIcon size={16} className="text-brand-primary" />
            <span className="text-sm font-extrabold text-brand-text capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-bg rounded-xl border border-brand-border transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={() => setCurrentMonth(new Date())}
            className="text-xs font-bold text-brand-primary hover:underline px-2"
          >
            Mês Atual
          </button>
        </div>

        {/* Search & Filter Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar por festa, aniversariante, local ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'all'
                  ? "bg-brand-primary text-slate-950"
                  : "bg-brand-bg text-brand-muted hover:text-brand-text"
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilterType('upcoming')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'upcoming'
                  ? "bg-brand-primary text-slate-950"
                  : "bg-brand-bg text-brand-muted hover:text-brand-text"
              )}
            >
              Próximos
            </button>
            <button
              type="button"
              onClick={() => setFilterType('missing_team')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'missing_team'
                  ? "bg-brand-primary text-slate-950"
                  : "bg-brand-bg text-brand-muted hover:text-brand-text"
              )}
            >
              Sem Equipe
            </button>
            <button
              type="button"
              onClick={() => setFilterType('pending_checklist')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'pending_checklist'
                  ? "bg-brand-primary text-slate-950"
                  : "bg-brand-bg text-brand-muted hover:text-brand-text"
              )}
            >
              Checklist Pendente
            </button>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {filteredParties.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-party/10 border border-brand-party/20 flex items-center justify-center text-brand-party mb-4">
            <PartyPopper size={32} />
          </div>
          <h3 className="text-lg font-bold text-brand-text mb-1">Nenhum evento encontrado</h3>
          <p className="text-xs sm:text-sm text-brand-muted max-w-md mb-6">
            Não há festas cadastradas para o período selecionado ou com os filtros atuais.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedParty(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 shadow-md"
          >
            <Plus size={16} />
            <span>Cadastrar Primeira Festa</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredParties.map((party) => {
            const assignedEmps = employees.filter(e => (party.assignedEmployeeIds || []).includes(e.id));
            const checklistItems = party.checklist || [];
            const completedCount = checklistItems.filter(i => i.checked).length;
            const hasChecklist = checklistItems.length > 0;
            const isChecklistComplete = hasChecklist && completedCount === checklistItems.length;
            const googleCalUrl = buildGoogleCalendarUrl(party, assignedEmps);

            return (
              <div 
                key={party.id}
                className="bg-brand-card border border-brand-border hover:border-brand-party/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-md group relative hover:shadow-xl"
              >
                {/* Card Header: Title & Relative Tag */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-brand-party bg-brand-party/15 border border-brand-party/30 px-2 py-0.5 rounded-lg">
                        {party.eventType || 'Festa'}
                      </span>
                      {getRelativeDayBadge(party.date)}
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-brand-text group-hover:text-brand-party transition-colors leading-tight">
                    {party.name}
                  </h3>

                  {/* Birthday person or Theme */}
                  {(party.birthdayPersonName || party.theme) && (
                    <div className="flex items-center gap-2 text-xs text-brand-muted mt-1 flex-wrap font-medium">
                      {party.birthdayPersonName && (
                        <span>🎂 {party.birthdayPersonName} {party.birthdayPersonAge ? `(${party.birthdayPersonAge}a)` : ''}</span>
                      )}
                      {party.theme && <span>🎨 {party.theme}</span>}
                    </div>
                  )}

                  {/* Date, Time and Location */}
                  <div className="space-y-1.5 mt-3 pt-3 border-t border-brand-border/60 text-xs">
                    <div className="flex items-center gap-2 text-brand-text font-bold">
                      <CalendarIcon size={14} className="text-brand-primary shrink-0" />
                      <span>{format(parseISO(party.date), "EEEE, dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>

                    <div className="flex items-center gap-2 text-brand-muted">
                      <Clock size={14} className="text-brand-party shrink-0" />
                      <span>{party.time || '14:00'}{party.endTime ? ` às ${party.endTime}` : ''} {party.setupTime ? `(chegada ${party.setupTime})` : ''}</span>
                    </div>

                    <div className="flex items-center gap-2 text-brand-muted">
                      <MapPin size={14} className="text-red-400 shrink-0" />
                      <span className="truncate">{party.location || 'CCSP'}</span>
                    </div>
                  </div>

                  {/* Contractor Preview (Admin only) */}
                  {(party.contractorName || party.contractorPhone) && (
                    <div className="mt-3 p-2.5 bg-brand-bg/50 rounded-xl border border-brand-border text-xs flex items-center justify-between gap-2">
                      <div className="truncate">
                        <p className="font-bold text-brand-text truncate flex items-center gap-1">
                          <User size={12} className="text-brand-primary shrink-0" />
                          <span>{party.contractorName || 'Contratante'}</span>
                        </p>
                        {party.contractorPhone && (
                          <p className="text-[11px] text-brand-muted truncate mt-0.5">{party.contractorPhone}</p>
                        )}
                      </div>

                      {party.contractorPhone && (
                        <a
                          href={`https://wa.me/55${party.contractorPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 rounded-lg transition-all shrink-0"
                          title="Abrir WhatsApp do Contratante"
                        >
                          <Phone size={14} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Checklist & Team Stack */}
                  <div className="mt-3 space-y-2">
                    {/* Checklist Bar */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-brand-muted font-bold flex items-center gap-1">
                        <CheckSquare size={12} className={isChecklistComplete ? "text-emerald-400" : "text-amber-400"} />
                        <span>Materiais: {hasChecklist ? `${completedCount}/${checklistItems.length}` : 'Não configurado'}</span>
                      </span>
                      {hasChecklist && (
                        <span className={cn("font-bold", isChecklistComplete ? "text-emerald-400" : "text-amber-400")}>
                          {Math.round((completedCount / checklistItems.length) * 100)}%
                        </span>
                      )}
                    </div>

                    {/* Assigned Employees */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-brand-border/40">
                      <div className="flex items-center gap-1">
                        <Users size={13} className="text-brand-primary shrink-0" />
                        <span className="text-xs font-bold text-brand-text">
                          Equipe ({assignedEmps.length})
                        </span>
                      </div>

                      <div className="flex -space-x-1.5 overflow-hidden">
                        {assignedEmps.slice(0, 4).map((emp) => (
                          <div
                            key={emp.id}
                            title={`${emp.artisticName || emp.name} (${emp.level})`}
                            className="w-6 h-6 rounded-full bg-brand-party text-slate-950 border border-brand-card flex items-center justify-center text-[10px] font-black"
                          >
                            {(emp.artisticName || emp.name).charAt(0)}
                          </div>
                        ))}
                        {assignedEmps.length > 4 && (
                          <div className="w-6 h-6 rounded-full bg-slate-800 text-brand-muted border border-brand-card flex items-center justify-center text-[9px] font-bold">
                            +{assignedEmps.length - 4}
                          </div>
                        )}
                        {assignedEmps.length === 0 && (
                          <span className="text-[11px] text-amber-400 font-bold">Pendente</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="grid grid-cols-3 gap-1.5 mt-4 pt-3 border-t border-brand-border">
                  {/* Google Calendar Link */}
                  {(() => {
                    const withEmail = getAssignedEmployeesWithEmail(assignedEmps);
                    const tooltip = withEmail.length > 0
                      ? `Criar no Google Agenda e convidar ${withEmail.length} recreador(es): ${withEmail.map(e => e.artisticName || e.name).join(', ')}`
                      : 'Adicionar ao Google Agenda';

                    return (
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-300 hover:text-white border border-blue-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all group"
                        title={tooltip}
                      >
                        <CalendarPlus size={14} />
                        <span className="hidden sm:inline">Agenda</span>
                        {withEmail.length > 0 && (
                          <span 
                            className="px-1 py-0.2 rounded text-[9px] font-black bg-blue-500/30 text-blue-200 group-hover:bg-blue-700"
                            title={`${withEmail.length} recreador(es) convidados na agenda`}
                          >
                            +{withEmail.length}
                          </span>
                        )}
                      </a>
                    );
                  })()}

                  {/* Copy WhatsApp Briefing */}
                  <button
                    type="button"
                    onClick={() => handleCopyWhatsApp(party)}
                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                    title="Copiar Briefing para WhatsApp"
                  >
                    <MessageCircle size={14} />
                    <span className="hidden sm:inline">{copiedPartyId === party.id ? 'Copiado!' : 'Briefing'}</span>
                  </button>

                  {/* Full Management Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedParty(party);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition-all shadow-sm"
                  >
                    <Edit3 size={14} />
                    <span>Abrir</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating or editing party */}
      {isModalOpen && (
        <PartyModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedParty(null);
          }}
          party={selectedParty}
          onSave={onSaveParty}
          onDelete={onDeleteParty}
          employees={employees}
          initialDate={format(currentMonth, 'yyyy-MM-dd')}
        />
      )}

    </div>
  );
}
