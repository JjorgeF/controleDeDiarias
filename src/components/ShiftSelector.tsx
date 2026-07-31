import React, { useState, useRef, useEffect } from 'react';
import { parseISO, isSunday } from 'date-fns';
import { Clock, ChevronDown, Check, Sun, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface ShiftOption {
  value: string;
  label: string;
  category: string;
  time?: string;
}

export const STANDARD_SHIFTS: ShiftOption[] = [
  { label: 'Brinquedoteca 1', time: '9h às 18h', value: 'Brinquedoteca 1 (9h - 18h)', category: 'Turnos CCSP' },
  { label: 'Brinquedoteca 2', time: '11h às 20h', value: 'Brinquedoteca 2 (11h - 20h)', category: 'Turnos CCSP' },
  { label: '5 a 10 anos', time: '13h às 21h', value: '5 a 10 anos (13h - 21h)', category: 'Turnos CCSP' },
  { label: '+11 anos', time: '13h30 às 21h30', value: '+11 anos (13h30 - 21h30)', category: 'Turnos CCSP' },
];

export const SUNDAY_SHIFTS: ShiftOption[] = [
  { label: 'Brinquedoteca', time: '9h às 18h', value: 'Brinquedoteca (9h - 18h)', category: 'Domingo' },
  { label: '5 a 10 anos', time: '10h às 18h', value: '5 a 10 anos (10h - 18h)', category: 'Domingo' },
  { label: '+11 anos', time: '10h às 18h', value: '+11 anos (10h - 18h)', category: 'Domingo' },
];

export const LEGACY_SHIFTS: ShiftOption[] = [
  { label: 'Turno Antigo', time: '11h - 21h00', value: '11h - 21h00', category: 'Anteriores' },
  { label: 'Turno Antigo', time: '13h30 - 21h30', value: '13h30 - 21h30', category: 'Anteriores' },
  { label: 'Externo Antigo', time: '10h às 18h', value: 'Externo (10h - 18h)', category: 'Anteriores' },
];

interface ShiftSelectorProps {
  currentShift?: string;
  dateStr?: string;
  onChange: (newShift: string) => void;
  className?: string;
}

export default function ShiftSelector({ currentShift = 'Brinquedoteca 1 (9h - 18h)', dateStr, onChange, className }: ShiftSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isSun = React.useMemo(() => {
    if (!dateStr) return false;
    try {
      return isSunday(parseISO(dateStr));
    } catch {
      return false;
    }
  }, [dateStr]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
    setIsOpen(!isOpen);
  };

  const allOptions = [...SUNDAY_SHIFTS, ...STANDARD_SHIFTS, ...LEGACY_SHIFTS];
  const selectedOption = allOptions.find(opt => opt.value === currentShift);

  const primaryGroup = isSun ? SUNDAY_SHIFTS : STANDARD_SHIFTS;
  const secondaryGroup = isSun ? STANDARD_SHIFTS : SUNDAY_SHIFTS;

  const showLegacy = LEGACY_SHIFTS.some(s => s.value === currentShift);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)} onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={cn(
          "flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border shadow-sm",
          isOpen
            ? "bg-brand-primary text-slate-950 border-brand-primary ring-2 ring-brand-primary/20"
            : "bg-brand-card/90 hover:bg-brand-card text-brand-text border-brand-border/80 hover:border-brand-primary/50"
        )}
      >
        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
          <Clock className={cn("w-3 h-3 shrink-0", isOpen ? "text-slate-950" : "text-brand-primary")} />
          <span className="truncate">{selectedOption ? `${selectedOption.label} (${selectedOption.time})` : currentShift}</span>
        </div>
        <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform duration-200", isOpen ? "rotate-180 text-slate-950" : "text-brand-muted")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: dropUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: dropUp ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 w-64 z-[100] bg-slate-950/70 backdrop-blur-2xl backdrop-saturate-150 border border-brand-primary/30 ring-1 ring-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden max-h-64 overflow-y-auto divide-y divide-white/10",
              dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
            )}
          >
            {/* Primary group */}
            <div className="p-1.5">
              <div className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-brand-primary flex items-center gap-1 bg-brand-primary/15 border border-brand-primary/20 backdrop-blur-md rounded-md mb-1.5">
                {isSun ? <Sun className="w-2.5 h-2.5 text-brand-primary" /> : <CalendarDays className="w-2.5 h-2.5 text-brand-primary" />}
                {isSun ? 'Domingo (Recomendado)' : 'Turnos CCSP Padrão'}
              </div>
              <div className="space-y-0.5">
                {primaryGroup.map((opt) => {
                  const isSelected = currentShift === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between transition-all",
                        isSelected
                          ? "bg-brand-primary text-slate-950 font-bold shadow-md ring-1 ring-brand-primary/50"
                          : "text-brand-text hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{opt.label}</span>
                        <span className={cn("text-[10px]", isSelected ? "text-slate-900/90 font-medium" : "text-brand-muted")}>{opt.time}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Secondary group */}
            <div className="p-1.5">
              <div className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-brand-primary flex items-center gap-1 bg-brand-primary/15 border border-brand-primary/20 backdrop-blur-md rounded-md mb-1.5">
                {isSun ? <CalendarDays className="w-2.5 h-2.5 text-brand-primary" /> : <Sun className="w-2.5 h-2.5 text-brand-primary" />}
                {isSun ? 'Outros Turnos Semanais' : 'Turnos de Domingo'}
              </div>
              <div className="space-y-0.5">
                {secondaryGroup.map((opt) => {
                  const isSelected = currentShift === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between transition-all",
                        isSelected
                          ? "bg-brand-primary text-slate-950 font-bold shadow-md ring-1 ring-brand-primary/50"
                          : "text-brand-text hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{opt.label}</span>
                        <span className={cn("text-[10px]", isSelected ? "text-slate-900/90 font-medium" : "text-brand-muted")}>{opt.time}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legacy group if selected */}
            {showLegacy && (
              <div className="p-1.5">
                <div className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 rounded-md mb-1.5">
                  Horário Anterior
                </div>
                <div className="space-y-0.5">
                  {LEGACY_SHIFTS.filter(s => s.value === currentShift).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between bg-brand-primary text-slate-950 font-bold"
                    >
                      <span>{opt.value}</span>
                      <Check className="w-3.5 h-3.5 text-slate-950 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
