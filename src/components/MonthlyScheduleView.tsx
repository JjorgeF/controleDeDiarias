import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Star, 
  Sparkles, 
  Table, 
  LayoutGrid, 
  List, 
  Users, 
  Clock, 
  PartyPopper, 
  Building2, 
  Printer, 
  FileSpreadsheet, 
  Filter, 
  Zap, 
  CheckCircle2, 
  X,
  UserCheck
} from 'lucide-react';
import { Employee, DayConfig, WorkDay } from '../types';
import { format, isSameMonth, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isToday, isWeekend, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

interface MonthlyScheduleViewProps {
  employees: Employee[];
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  currentEmployee?: Employee | null;
  isAdmin?: boolean;
  dayConfigs?: Record<string, DayConfig>;
}

type LayoutMode = 'grid' | 'timeline';

export default function MonthlyScheduleView({
  employees,
  currentMonth,
  setCurrentMonth,
  currentEmployee,
  isAdmin = false,
  dayConfigs = {}
}: MonthlyScheduleViewProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [timeScope, setTimeScope] = useState<'month' | 'week1' | 'week2' | 'week3' | 'week4' | 'week5'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMyDays, setOnlyMyDays] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string>(currentEmployee?.id || '');
  const [eventFilter, setEventFilter] = useState<'all' | 'common' | 'party'>('all');
  const [selectedDayModal, setSelectedDayModal] = useState<string | null>(null);

  // Sync selectedHighlightId with currentEmployee if available and not manually overridden
  const effectiveHighlightEmployee = useMemo(() => {
    if (selectedHighlightId) {
      return employees.find(e => e.id === selectedHighlightId) || currentEmployee || null;
    }
    return currentEmployee || null;
  }, [employees, selectedHighlightId, currentEmployee]);

  // Days of the current selected month
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Days filtered by selected time scope (Entire Month or specific Week 1..5)
  const displayedDays = useMemo(() => {
    if (timeScope === 'month') return monthDays;
    if (timeScope === 'week1') return monthDays.slice(0, 7);
    if (timeScope === 'week2') return monthDays.slice(7, 14);
    if (timeScope === 'week3') return monthDays.slice(14, 21);
    if (timeScope === 'week4') return monthDays.slice(21, 28);
    if (timeScope === 'week5') return monthDays.slice(28);
    return monthDays;
  }, [monthDays, timeScope]);

  // Previous & Next month navigation
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  // Helper to map workDays for each day
  // Returns map: dateStr -> Array of { employee, workDay } containing ALL scheduled employees
  const dailyScheduleMap: Record<string, { employee: Employee; workDay: WorkDay }[]> = useMemo(() => {
    const map: Record<string, { employee: Employee; workDay: WorkDay }[]> = {};

    monthDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      map[dateStr] = [];
    });

    employees.forEach(emp => {
      (emp.workDays || []).forEach(wd => {
        if (!wd.isCancelled && map[wd.date]) {
          map[wd.date].push({ employee: emp, workDay: wd });
        }
      });
    });

    // Sort employees inside each day by highlighting user first, then by artisticName
    Object.keys(map).forEach(dateStr => {
      map[dateStr].sort((a, b) => {
        // Highlighting user first if matches
        const aIsHighlighted = effectiveHighlightEmployee && a.employee.id === effectiveHighlightEmployee.id;
        const bIsHighlighted = effectiveHighlightEmployee && b.employee.id === effectiveHighlightEmployee.id;
        if (aIsHighlighted && !bIsHighlighted) return -1;
        if (!aIsHighlighted && bIsHighlighted) return 1;

        const nameA = a.employee.artisticName || a.employee.name;
        const nameB = b.employee.artisticName || b.employee.name;
        return nameA.localeCompare(nameB, 'pt-BR');
      });
    });

    return map;
  }, [monthDays, employees, effectiveHighlightEmployee]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const activeDaysSet = new Set<string>();
    const scheduledEmployeesSet = new Set<string>();
    let totalShiftsCount = 0;
    let myDaysCount = 0;

    Object.entries(dailyScheduleMap).forEach(([dateStr, items]) => {
      if (items.length > 0) {
        activeDaysSet.add(dateStr);
      }
      items.forEach(item => {
        scheduledEmployeesSet.add(item.employee.id);
        totalShiftsCount++;
        if (effectiveHighlightEmployee && item.employee.id === effectiveHighlightEmployee.id) {
          myDaysCount++;
        }
      });
    });

    return {
      activeDaysCount: activeDaysSet.size,
      totalEmployeesCount: scheduledEmployeesSet.size,
      totalShiftsCount,
      myDaysCount
    };
  }, [dailyScheduleMap, effectiveHighlightEmployee]);

  // Filtered days list matching search query, event filter, and "onlyMyDays"
  const filteredMonthDays = useMemo(() => {
    return displayedDays.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const items = dailyScheduleMap[dateStr] || [];

      // 1. If "onlyMyDays" is active, check if effectiveHighlightEmployee is scheduled on this day
      if (onlyMyDays && effectiveHighlightEmployee) {
        const isEmployeeInDay = items.some(item => item.employee.id === effectiveHighlightEmployee.id);
        if (!isEmployeeInDay) return false;
      }

      // 2. Check event filter
      if (eventFilter === 'common') {
        const hasCommon = items.some(item => item.workDay.type === 'common');
        if (!hasCommon) return false;
      } else if (eventFilter === 'party') {
        const hasParty = items.some(item => item.workDay.type === 'party');
        if (!hasParty) return false;
      }

      // 3. Check search query (matches if ANY employee, party name or shift on that day matches)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAny = items.some(item => 
          item.employee.name.toLowerCase().includes(q) ||
          item.employee.artisticName.toLowerCase().includes(q) ||
          (item.workDay.partyName && item.workDay.partyName.toLowerCase().includes(q)) ||
          (item.workDay.shift && item.workDay.shift.toLowerCase().includes(q))
        );
        if (!matchesAny) return false;
      }

      return true;
    });
  }, [displayedDays, onlyMyDays, effectiveHighlightEmployee, eventFilter, searchQuery, dailyScheduleMap]);

  // Excel Export
  const handleExportExcel = () => {
    const rows: any[] = [];

    monthDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const formattedDate = format(day, "dd/MM/yyyy (EEEE)", { locale: ptBR });
      const config = dayConfigs[dateStr];
      const items = dailyScheduleMap[dateStr] || [];

      if (items.length === 0) {
        rows.push({
          Data: formattedDate,
          'Tipo de Dia': config?.isCommon ? 'CCSP' : 'Sem Escala',
          'Recreador / Funcionário': '-',
          'Nível': '-',
          'Turno / Horário': '-',
          'Evento / Festa': '-'
        });
      } else {
        items.forEach(item => {
          rows.push({
            Data: formattedDate,
            'Tipo de Dia': item.workDay.type === 'party' ? 'Festa' : 'CCSP',
            'Recreador / Funcionário': item.employee.artisticName || item.employee.name,
            'Nível': item.employee.level,
            'Turno / Horário': item.workDay.shift || (item.workDay.type === 'party' ? 'Festa' : 'CCSP Padrão'),
            'Evento / Festa': item.workDay.partyName || '-'
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Escala_${format(currentMonth, 'MM-yyyy')}`);
    XLSX.writeFile(workbook, `Escala_Liga_Positiva_${format(currentMonth, 'yyyy_MM')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-brand-card via-brand-card to-purple-950/30 border border-brand-border rounded-2xl p-4 md:p-6 shadow-xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {effectiveHighlightEmployee && (
                  <span className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    Destaque: {effectiveHighlightEmployee.artisticName || effectiveHighlightEmployee.name}
                  </span>
                )}
              </div>
              <h1 className="text-xl md:text-3xl font-black text-white flex items-center gap-2">
                <CalendarIcon className="text-brand-primary shrink-0" size={28} />
                <span>Escala Mensal Geral</span>
              </h1>
              <p className="text-xs md:text-sm text-gray-300 mt-1 max-w-2xl">
                Acompanhe a escala de trabalho de toda a equipe no mês.
              </p>
            </div>

            {/* Month Selector Controls */}
            <div className="flex items-center gap-2 bg-brand-bg/80 border border-brand-border p-1.5 rounded-2xl shrink-0 self-stretch sm:self-auto justify-between">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-brand-card rounded-xl text-gray-300 hover:text-white transition-all active:scale-95"
                title="Mês Anterior"
              >
                <ChevronLeft size={20} />
              </button>
              
              <button
                onClick={handleCurrentMonth}
                className="px-3 py-1.5 rounded-xl text-xs md:text-sm font-black text-white hover:text-brand-primary transition-colors text-center"
                title="Voltar para o Mês Atual"
              >
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR }).toUpperCase()}
              </button>

              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-brand-card rounded-xl text-gray-300 hover:text-white transition-all active:scale-95"
                title="Próximo Mês"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-brand-border/60">
            <div className="bg-brand-bg/50 border border-brand-border/80 p-3 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                <CalendarIcon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dias com Escala</p>
                <p className="text-lg md:text-xl font-black text-white">{metrics.activeDaysCount} <span className="text-xs font-normal text-gray-400">/ {monthDays.length}</span></p>
              </div>
            </div>

            <div className="bg-brand-bg/50 border border-brand-border/80 p-3 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL DE RECREADORES</p>
                <p className="text-lg md:text-xl font-black text-white">{metrics.totalEmployeesCount} <span className="text-xs font-normal text-gray-400">no mês</span></p>
              </div>
            </div>

            <div className="bg-brand-bg/50 border border-brand-border/80 p-3 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total de Turnos</p>
                <p className="text-lg md:text-xl font-black text-white">{metrics.totalShiftsCount} <span className="text-xs font-normal text-gray-400">turnos</span></p>
              </div>
            </div>

            <div className={cn(
              "p-3 rounded-xl flex items-center gap-3 transition-all border",
              metrics.myDaysCount > 0 
                ? "bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm"
                : "bg-brand-bg/50 border-brand-border/80"
            )}>
              <div className={cn(
                "p-2.5 rounded-xl border shrink-0",
                metrics.myDaysCount > 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-gray-500/10 text-gray-400 border-gray-500/20"
              )}>
                <Star size={20} className={metrics.myDaysCount > 0 ? "fill-amber-400 text-amber-400" : ""} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {effectiveHighlightEmployee?.id === currentEmployee?.id ? "Sua Presença" : "Sua Presença / Destaque"}
                </p>
                <p className="text-lg md:text-xl font-black text-white">
                  {metrics.myDaysCount} <span className="text-xs font-normal text-gray-400">{metrics.myDaysCount === 1 ? 'dia escalado' : 'dias escalados'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Filter and View Controls Bar */}
      <div className="bg-brand-card border border-brand-border p-3 md:p-4 rounded-2xl flex flex-col gap-3 shadow-md">
        {/* Top Row: Search & Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Buscar por recreador, evento ou turno..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Highlight Selection Dropdown */}
            <div className="flex items-center gap-1.5 bg-brand-bg border border-brand-border px-2.5 py-1.5 rounded-xl">
              <UserCheck size={14} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-bold text-gray-400 hidden xl:inline">Destacar:</span>
              <select
                value={selectedHighlightId}
                onChange={(e) => setSelectedHighlightId(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                {currentEmployee && (
                  <option value={currentEmployee.id} className="bg-brand-card text-white">
                    ⭐ Você ({currentEmployee.artisticName || currentEmployee.name})
                  </option>
                )}
                <option value="" className="bg-brand-card text-white">Nenhum destaque</option>
                {employees
                  .filter(e => e.id !== currentEmployee?.id)
                  .map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-brand-card text-white">
                      {emp.artisticName || emp.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Filter Event Type */}
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as any)}
              className="bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-brand-primary cursor-pointer shrink-0"
            >
              <option value="all" className="bg-brand-card">Todos os Eventos</option>
              <option value="common" className="bg-brand-card">Apenas CCSP</option>
              <option value="party" className="bg-brand-card">Apenas Festas</option>
            </select>

            {/* Checkbox: Only My Days */}
            {effectiveHighlightEmployee && (
              <label className={cn(
                "flex items-center gap-2 cursor-pointer text-xs font-bold px-3 py-2 rounded-xl border transition-all select-none shrink-0",
                onlyMyDays 
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-300" 
                  : "bg-brand-bg border-brand-border text-gray-400 hover:text-white"
              )}>
                <input 
                  type="checkbox"
                  checked={onlyMyDays}
                  onChange={(e) => setOnlyMyDays(e.target.checked)}
                  className="rounded border-brand-border text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <Star size={13} className={onlyMyDays ? "fill-amber-400 text-amber-400" : ""} />
                <span>Apenas {effectiveHighlightEmployee.id === currentEmployee?.id ? 'Minhas Escalas' : 'Escalas do Destaque'}</span>
              </label>
            )}
          </div>

          {/* Right: Layout Modes & Export */}
          <div className="flex items-center gap-2 shrink-0 justify-between md:justify-end">
            {/* View Modes */}
            <div className="flex items-center bg-brand-bg border border-brand-border rounded-xl p-1">
              <button
                onClick={() => setLayoutMode('grid')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                  layoutMode === 'grid' ? "bg-brand-primary text-slate-950 shadow-sm" : "text-gray-400 hover:text-white"
                )}
                title="Visão em Cards por Dia"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Diário</span>
              </button>

              <button
                onClick={() => setLayoutMode('timeline')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                  layoutMode === 'timeline' ? "bg-brand-primary text-slate-950 shadow-sm" : "text-gray-400 hover:text-white"
                )}
                title="Visão Cronológica"
              >
                <List size={14} />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>

            {/* Excel Export Button */}
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              title="Exportar Escala em Excel"
            >
              <FileSpreadsheet size={15} />
              <span className="hidden lg:inline">Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Weekly Scope Tabs Selector */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-brand-border/60 text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter size={12} className="text-brand-primary" /> Visualização:
          </span>

          <button
            onClick={() => setTimeScope('month')}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border shrink-0",
              timeScope === 'month'
                ? "bg-brand-primary text-slate-950 border-brand-primary shadow-sm"
                : "bg-brand-bg text-gray-400 border-brand-border hover:text-white"
            )}
          >
            🗓️ Mês Inteiro ({monthDays.length} dias)
          </button>

          <button
            onClick={() => setTimeScope('week1')}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border shrink-0",
              timeScope === 'week1'
                ? "bg-brand-primary text-slate-950 border-brand-primary shadow-sm"
                : "bg-brand-bg text-gray-400 border-brand-border hover:text-white"
            )}
          >
            Semana 1 (1 a 7)
          </button>

          <button
            onClick={() => setTimeScope('week2')}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border shrink-0",
              timeScope === 'week2'
                ? "bg-brand-primary text-slate-950 border-brand-primary shadow-sm"
                : "bg-brand-bg text-gray-400 border-brand-border hover:text-white"
            )}
          >
            Semana 2 (8 a 14)
          </button>

          <button
            onClick={() => setTimeScope('week3')}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border shrink-0",
              timeScope === 'week3'
                ? "bg-brand-primary text-slate-950 border-brand-primary shadow-sm"
                : "bg-brand-bg text-gray-400 border-brand-border hover:text-white"
            )}
          >
            Semana 3 (15 a 21)
          </button>

          <button
            onClick={() => setTimeScope('week4')}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border shrink-0",
              timeScope === 'week4'
                ? "bg-brand-primary text-slate-950 border-brand-primary shadow-sm"
                : "bg-brand-bg text-gray-400 border-brand-border hover:text-white"
            )}
          >
            Semana 4 (22 a 28)
          </button>

          {monthDays.length > 28 && (
            <button
              onClick={() => setTimeScope('week5')}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border shrink-0",
                timeScope === 'week5'
                  ? "bg-brand-primary text-slate-950 border-brand-primary shadow-sm"
                  : "bg-brand-bg text-gray-400 border-brand-border hover:text-white"
              )}
            >
              Semana 5 (29 a {monthDays.length})
            </button>
          )}
        </div>
      </div>

      {/* ----------------- VIEW MODE 1: DAILY CARDS GRID ----------------- */}
      {layoutMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMonthDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayItems = dailyScheduleMap[dateStr] || [];
            const config = dayConfigs[dateStr];
            const isCurrentToday = isToday(day);
            const isWeekendDay = isWeekend(day);

            // Check if highlight employee is working on this day
            const myWorkItem = effectiveHighlightEmployee 
              ? dayItems.find(item => item.employee.id === effectiveHighlightEmployee.id)
              : null;
            const isMyDay = !!myWorkItem;

            return (
              <div 
                key={dateStr}
                className={cn(
                  "bg-brand-card rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden relative group",
                  isMyDay
                    ? "border-amber-500/80 ring-2 ring-amber-500/30 bg-gradient-to-b from-brand-card via-brand-card to-amber-950/20 shadow-lg shadow-amber-500/5"
                    : isCurrentToday
                    ? "border-brand-primary ring-1 ring-brand-primary/40"
                    : "border-brand-border hover:border-brand-primary/40"
                )}
              >
                {/* Header of Day Card */}
                <div className={cn(
                  "p-3 border-b flex items-center justify-between gap-2",
                  isMyDay ? "bg-amber-500/10 border-amber-500/30" : "bg-brand-bg/60 border-brand-border/60"
                )}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "min-w-[46px] px-1.5 py-1 h-11 rounded-xl flex flex-col items-center justify-center font-black shrink-0 border text-center shadow-sm",
                      isCurrentToday
                        ? "bg-brand-primary text-slate-950 border-brand-primary"
                        : isMyDay
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : isWeekendDay
                        ? "bg-purple-950/60 text-purple-200 border-purple-500/40"
                        : "bg-brand-bg text-white border-brand-border"
                    )}>
                      <span className="text-sm leading-none font-black tracking-tight">{format(day, 'dd')}</span>
                      <span className="text-[8.5px] uppercase font-extrabold leading-tight mt-0.5 opacity-90 truncate max-w-full tracking-wider">
                        {format(day, 'eee', { locale: ptBR }).replace('.', '')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-white capitalize">
                        {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {config?.isCommon && (
                          <span className="text-[9px] font-black text-brand-primary bg-brand-primary/15 border border-brand-primary/30 px-1.5 py-0.2 rounded-md">
                            CCSP
                          </span>
                        )}
                        {config?.parties && config.parties.length > 0 && (
                          <span className="text-[9px] font-black text-purple-300 bg-purple-950/50 border border-purple-500/30 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                            <PartyPopper size={10} />
                            <span>{config.parties.length} {config.parties.length === 1 ? 'Festa' : 'Festas'}</span>
                          </span>
                        )}
                        {config?.isExtraordinaryOpen && (
                          <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                            <Zap size={10} className="fill-amber-400" />
                            <span>Abertura Extra</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Highlight Badge */}
                  {isMyDay && (
                    <span className="text-[10px] font-black text-slate-950 bg-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm shrink-0 animate-pulse">
                      <Star size={10} className="fill-slate-950" />
                      <span>{effectiveHighlightEmployee?.id === currentEmployee?.id ? 'VOCÊ' : 'DESTAQUE'}</span>
                    </span>
                  )}
                </div>

                {/* Day Parties Summary */}
                {config?.parties && config.parties.length > 0 && (
                  <div className="bg-purple-950/20 border-b border-purple-500/20 p-2 text-[11px] space-y-1">
                    {config.parties.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between text-purple-200">
                        <span className="font-bold truncate flex items-center gap-1">
                          <span>🎉</span> {p.name}
                        </span>
                        {p.time && (
                          <span className="text-[10px] text-purple-300/80 font-mono shrink-0 ml-1">
                            ({p.time})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Body: List of Assigned Employees Grouped by Shift */}
                <div className="p-2.5 space-y-3 flex-1 min-h-[100px]">
                  {dayItems.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-xs">
                      Nenhum recreador escalado
                    </div>
                  ) : (
                    (() => {
                      // Group dayItems by shift / schedule / party
                      const groupedMap: Record<string, {
                        label: string;
                        isParty: boolean;
                        partyName?: string;
                        items: typeof dayItems;
                      }> = {};

                      dayItems.forEach(item => {
                        const isParty = item.workDay.type === 'party';
                        const shiftTime = item.workDay.shift || (isParty ? 'Festa' : 'CCSP (Horário Padrão)');
                        const groupKey = isParty 
                          ? `party_${item.workDay.partyName || 'festa'}_${shiftTime}` 
                          : `shift_${shiftTime}`;

                        if (!groupedMap[groupKey]) {
                          groupedMap[groupKey] = {
                            label: shiftTime,
                            isParty,
                            partyName: item.workDay.partyName,
                            items: []
                          };
                        }
                        groupedMap[groupKey].items.push(item);
                      });

                      const getShiftRank = (labelStr: string) => {
                        const norm = (labelStr || '').toLowerCase();
                        if (norm.includes('brinquedoteca 1') || norm === 'brinquedoteca (9h - 18h)') return 10;
                        if (norm.includes('brinquedoteca 2')) return 11;
                        if (norm.includes('brinquedoteca')) return 12;
                        if (norm.includes('5 a 10')) return 20;
                        if (norm.includes('+11')) return 30;
                        if (norm.includes('externo')) return 40;
                        return 100;
                      };

                      const sortedGroups = Object.entries(groupedMap).sort(([_keyA, a], [_keyB, b]) => {
                        if (a.isParty && !b.isParty) return -1;
                        if (!a.isParty && b.isParty) return 1;

                        const rankA = getShiftRank(a.label);
                        const rankB = getShiftRank(b.label);
                        if (rankA !== rankB) return rankA - rankB;

                        return a.label.localeCompare(b.label);
                      });

                      return sortedGroups.map(([groupKey, group]) => {
                        const headerText = group.isParty
                          ? `🎉 ${group.partyName || 'Festa'}${group.label && group.label !== 'Festa' ? ` (${group.label})` : ''}`
                          : group.label;

                        return (
                          <div key={groupKey} className="space-y-1.5">
                            <div className={cn(
                              "flex items-center justify-between text-[10px] font-extrabold px-2.5 py-1 rounded-lg border transition-all shadow-sm",
                              group.isParty
                                ? "bg-purple-900/80 text-purple-100 border-purple-500/60 ring-1 ring-purple-500/20"
                                : "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                            )}>
                              <span className="truncate flex items-center gap-1.5">
                                {group.isParty ? (
                                  <PartyPopper size={12} className="shrink-0 text-purple-300" />
                                ) : (
                                  <Clock size={11} className="shrink-0 text-brand-primary" />
                                )}
                                <span className="truncate font-black">{headerText}</span>
                              </span>
                              <span className={cn("text-[9px] font-bold ml-1.5 shrink-0", group.isParty ? "text-purple-200/90" : "text-gray-400")}>
                                {group.items.length} {group.items.length === 1 ? 'pessoa' : 'pessoas'}
                              </span>
                            </div>

                            <div className="space-y-1">
                              {group.items.map(({ employee, workDay }) => {
                                const isThisHighlighted = effectiveHighlightEmployee && employee.id === effectiveHighlightEmployee.id;

                                return (
                                  <div 
                                    key={`${employee.id}_${workDay.date}_${workDay.type}`}
                                    className={cn(
                                      "flex items-center justify-between gap-2 p-1.5 rounded-xl transition-all border text-xs",
                                      isThisHighlighted
                                        ? "bg-amber-500/20 border-amber-500/60 text-white font-bold ring-1 ring-amber-500/40 shadow-sm"
                                        : group.isParty
                                          ? "bg-purple-950/40 border-purple-500/30 hover:border-purple-500/60 text-gray-200"
                                          : "bg-brand-bg/70 border-brand-border/60 hover:border-brand-primary/30 text-gray-200"
                                    )}
                                  >
                                    {/* Recreador Info */}
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div className="relative shrink-0">
                                        {employee.photoUrl ? (
                                          <img 
                                            src={employee.photoUrl} 
                                            alt={employee.artisticName || employee.name} 
                                            className="w-7 h-7 rounded-full object-cover border border-brand-border"
                                          />
                                        ) : (
                                          <div className="w-7 h-7 rounded-full bg-brand-primary/20 text-brand-primary font-black flex items-center justify-center text-[10px] border border-brand-primary/30">
                                            {(employee.artisticName || employee.name).charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        {isThisHighlighted && (
                                          <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full">
                                            <Star size={8} className="fill-slate-950" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="truncate min-w-0">
                                        <p className={cn("truncate font-bold leading-tight text-xs", isThisHighlighted ? "text-amber-200" : "text-white")}>
                                          {employee.artisticName || employee.name}
                                        </p>
                                        <p className="text-[10px] text-gray-400 truncate leading-tight">
                                          {employee.level}
                                        </p>
                                      </div>
                                    </div>

                                    {!group.isParty && workDay.partyName && (
                                      <span className="text-[10px] font-extrabold text-purple-200 bg-purple-900/80 border border-purple-500/50 px-2 py-0.5 rounded-md truncate max-w-[120px] shrink-0 shadow-sm">
                                        {workDay.partyName}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>

                {/* Footer Count */}
                <div className="px-3 py-1.5 bg-brand-bg/40 border-t border-brand-border/40 text-[10px] font-bold text-gray-400 flex items-center justify-between">
                  <span>{dayItems.length} {dayItems.length === 1 ? 'escalado' : 'escalados'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------- VIEW MODE 2: TIMELINE LIST ----------------- */}
      {layoutMode === 'timeline' && (
        <div className="space-y-3">
          {filteredMonthDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayItems = dailyScheduleMap[dateStr] || [];
            const config = dayConfigs[dateStr];
            const isMyDay = effectiveHighlightEmployee && dayItems.some(i => i.employee.id === effectiveHighlightEmployee.id);

            if (dayItems.length === 0 && !config?.parties?.length && !config?.isCommon) {
              return null;
            }

            return (
              <div 
                key={dateStr}
                className={cn(
                  "bg-brand-card border rounded-2xl p-4 transition-all shadow-md",
                  isMyDay ? "border-amber-500/80 bg-gradient-to-r from-brand-card via-brand-card to-amber-950/20" : "border-brand-border"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-brand-border/60">
                  <div className="flex items-center gap-3">
                    <div className="text-center bg-brand-bg px-3 py-1.5 rounded-xl border border-brand-border">
                      <span className="text-xs font-bold text-gray-400 uppercase block">{format(day, 'eee', { locale: ptBR })}</span>
                      <span className="text-lg font-black text-white leading-none">{format(day, 'dd/MM')}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-white capitalize">
                        {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {config?.isCommon && (
                          <span className="text-[10px] font-black text-brand-primary bg-brand-primary/10 border border-brand-primary/30 px-2 py-0.5 rounded-md">
                            Dia CCSP
                          </span>
                        )}
                        {config?.parties?.map((p, idx) => (
                          <span key={p.id || idx} className="text-[10px] font-black text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 rounded-md">
                            🎉 {p.name} {p.time && `(${p.time})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 bg-brand-bg px-3 py-1.5 rounded-xl border border-brand-border">
                      {dayItems.length} {dayItems.length === 1 ? 'recreador' : 'recreadores'}
                    </span>
                    {isMyDay && (
                      <span className="text-xs font-black text-slate-950 bg-amber-400 px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm">
                        <Star size={14} className="fill-slate-950" />
                        <span>Você trabalha neste dia</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* List of Employees */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3">
                  {dayItems.map(({ employee, workDay }) => {
                    const isThisHighlighted = effectiveHighlightEmployee && employee.id === effectiveHighlightEmployee.id;

                    return (
                      <div 
                        key={employee.id}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border text-xs",
                          isThisHighlighted
                            ? "bg-amber-500/20 border-amber-500/60 text-white font-bold ring-1 ring-amber-500/40"
                            : "bg-brand-bg/60 border-brand-border/60 text-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {employee.photoUrl ? (
                            <img src={employee.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-brand-primary/20 text-brand-primary font-black flex items-center justify-center shrink-0">
                              {(employee.artisticName || employee.name).charAt(0)}
                            </div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-white truncate">{employee.artisticName || employee.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{employee.level}</p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-brand-bg border border-brand-border text-brand-primary shrink-0 ml-2">
                          {workDay.shift || workDay.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------- DAY DETAILS MODAL ----------------- */}
      {selectedDayModal && (() => {
        const modalDate = parseISO(selectedDayModal);
        const modalItems = dailyScheduleMap[selectedDayModal] || [];
        const modalConfig = dayConfigs[selectedDayModal];

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="p-4 bg-brand-bg border-b border-brand-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary text-slate-950 font-black flex flex-col items-center justify-center shrink-0 shadow-md">
                    <span className="text-base leading-none">{format(modalDate, 'dd')}</span>
                    <span className="text-[10px] uppercase leading-none mt-0.5 opacity-90">{format(modalDate, 'eee', { locale: ptBR })}</span>
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white capitalize">
                      {format(modalDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {modalConfig?.isCommon && (
                        <span className="text-[10px] font-extrabold text-brand-primary bg-brand-primary/10 border border-brand-primary/30 px-2 py-0.5 rounded-md">
                          Dia CCSP
                        </span>
                      )}
                      {modalConfig?.parties && modalConfig.parties.length > 0 && (
                        <span className="text-[10px] font-extrabold text-purple-300 bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <PartyPopper size={11} />
                          <span>{modalConfig.parties.length} {modalConfig.parties.length === 1 ? 'Festa' : 'Festas'}</span>
                        </span>
                      )}
                      {modalConfig?.isExtraordinaryOpen && (
                        <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Zap size={11} className="fill-amber-400" />
                          <span>Abertura Extra</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedDayModal(null)}
                  className="p-2 rounded-xl bg-brand-bg border border-brand-border text-gray-400 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Day Events Info */}
              {modalConfig?.parties && modalConfig.parties.length > 0 && (
                <div className="p-3 bg-purple-950/30 border-b border-purple-500/20 space-y-1.5">
                  <p className="text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1">
                    <PartyPopper size={12} /> Festas & Eventos Agendados
                  </p>
                  {modalConfig.parties.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between text-xs text-purple-200 bg-purple-900/30 p-2 rounded-xl border border-purple-500/20">
                      <span className="font-bold truncate flex items-center gap-1.5">
                        <span>🎉</span> {p.name}
                      </span>
                      {p.time && (
                        <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950 px-2 py-0.5 rounded-md border border-purple-500/30 shrink-0 ml-2">
                          {p.time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Body: List of Employees */}
              <div className="p-4 space-y-2 max-h-[350px] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-brand-border/40">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    Equipe Escalada ({modalItems.length})
                  </span>
                </div>

                {modalItems.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-xs">
                    Nenhum recreador escalado para este dia.
                  </div>
                ) : (
                  modalItems.map(({ employee, workDay }) => {
                    const isHighlighted = effectiveHighlightEmployee && employee.id === effectiveHighlightEmployee.id;

                    return (
                      <div 
                        key={`${employee.id}_${workDay.type}`}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all text-xs",
                          isHighlighted
                            ? "bg-amber-500/20 border-amber-500/60 text-white font-bold ring-1 ring-amber-500/40"
                            : "bg-brand-bg/80 border-brand-border text-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {employee.photoUrl ? (
                            <img src={employee.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border border-brand-border" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-brand-primary/20 text-brand-primary text-xs font-black flex items-center justify-center shrink-0 border border-brand-primary/30">
                              {(employee.artisticName || employee.name).charAt(0)}
                            </div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-white flex items-center gap-1.5 text-sm">
                              <span>{employee.artisticName || employee.name}</span>
                              {isHighlighted && (
                                <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{employee.level}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-xs font-black px-2.5 py-1 rounded-lg border inline-block",
                            workDay.type === 'party'
                              ? "bg-purple-950 text-purple-200 border-purple-500/40"
                              : "bg-brand-primary/15 text-brand-primary border-brand-primary/30"
                          )}>
                            {workDay.shift || (workDay.type === 'party' ? 'Festa' : 'CCSP')}
                          </span>
                          {workDay.partyName && (
                            <p className="text-[10px] text-purple-300 font-medium mt-0.5 truncate max-w-[120px]">
                              {workDay.partyName}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-brand-bg/60 border-t border-brand-border flex items-center justify-end">
                <button 
                  onClick={() => setSelectedDayModal(null)}
                  className="bg-brand-primary text-slate-950 font-black px-4 py-2 rounded-xl text-xs hover:bg-brand-primary/90 transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
