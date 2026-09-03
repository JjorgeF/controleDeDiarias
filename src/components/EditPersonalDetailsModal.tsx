import React, { useState, useRef, useEffect } from 'react';
import { X, CreditCard, Calendar, Shirt, PhoneCall, Check, Building2, UserCheck, ChevronDown, Wind } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee } from '../types';

interface EditPersonalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onSave: (employeeId: string, updatedFields: Partial<Employee>) => Promise<void>;
}

interface CustomSelectOption<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps<T extends string> {
  value: T;
  onChange: (val: T) => void;
  options: CustomSelectOption<T>[];
  label: string;
  accentColor?: 'amber' | 'cyan' | 'emerald' | 'purple';
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  accentColor = 'amber'
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const borderFocusClasses = {
    amber: 'focus:border-amber-400 border-amber-500/30 text-amber-300',
    cyan: 'focus:border-cyan-400 border-cyan-500/30 text-cyan-300',
    emerald: 'focus:border-emerald-400 border-emerald-500/30 text-emerald-300',
    purple: 'focus:border-brand-party border-brand-party/30 text-brand-party',
  }[accentColor];

  const bgHoverClasses = {
    amber: 'hover:bg-amber-500/15 text-amber-300',
    cyan: 'hover:bg-cyan-500/15 text-cyan-300',
    emerald: 'hover:bg-emerald-500/15 text-emerald-300',
    purple: 'hover:bg-brand-party/15 text-brand-party',
  }[accentColor];

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-[11px] font-bold text-gray-400 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text flex items-center justify-between transition-all duration-200 hover:border-slate-500 shadow-inner ${
          isOpen ? 'ring-2 ring-amber-500/30 border-amber-500/60' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span>{selectedOption?.label}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="text-gray-400 shrink-0 ml-2"
        >
          <ChevronDown size={15} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 4 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 min-w-[160px] p-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl max-h-56 overflow-y-auto space-y-0.5"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all ${
                    isSelected
                      ? `bg-slate-800 ${borderFocusClasses} font-bold shadow-xs`
                      : `text-gray-300 ${bgHoverClasses}`
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon}
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={14} className="shrink-0 ml-2" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EditPersonalDetailsModal({
  isOpen,
  onClose,
  employee,
  onSave
}: EditPersonalDetailsModalProps) {
  const getInitialStartMonth = () => {
    if (employee.startDateAtLiga) {
      return employee.startDateAtLiga.length >= 7 ? employee.startDateAtLiga.substring(0, 7) : employee.startDateAtLiga;
    }
    if (employee.startDate) {
      return employee.startDate.length >= 7 ? employee.startDate.substring(0, 7) : employee.startDate;
    }
    return '';
  };

  const [pixType, setPixType] = useState<NonNullable<Employee['pixType']>>(employee.pixType || 'cpf');
  const [pixKey, setPixKey] = useState(employee.pixKey || '');
  const [pixBank, setPixBank] = useState(employee.pixBank || '');
  const [pixOwnerName, setPixOwnerName] = useState(employee.pixOwnerName || '');
  const [startDateAtLiga, setStartDateAtLiga] = useState(getInitialStartMonth());
  const [shirtSize, setShirtSize] = useState<NonNullable<Employee['shirtSize']>>(employee.shirtSize || 'M');
  const [shortsSize, setShortsSize] = useState<NonNullable<Employee['shortsSize']>>(employee.shortsSize || 'M');
  const [windbreakerSize, setWindbreakerSize] = useState<NonNullable<Employee['windbreakerSize']>>(employee.windbreakerSize || 'M');
  const [emergencyContactName, setEmergencyContactName] = useState(employee.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(employee.emergencyContactPhone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!pixKey.trim() || !pixBank.trim() || !pixOwnerName.trim() || !startDateAtLiga.trim() || !emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      setErrorMsg('Por favor, preencha todas as informações solicitadas (PIX, data de início e contato de emergência).');
      return;
    }

    setIsSaving(true);
    try {
      const formattedStartDate = startDateAtLiga ? (startDateAtLiga.includes('-') && startDateAtLiga.length === 7 ? `${startDateAtLiga}-01` : startDateAtLiga) : '';
      await onSave(employee.id, {
        pixType,
        pixKey,
        pixBank,
        pixOwnerName,
        startDateAtLiga,
        startDate: formattedStartDate || employee.startDate || '',
        shirtSize,
        shortsSize,
        windbreakerSize,
        emergencyContactName,
        emergencyContactPhone
      });
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar os dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const pixOptions: CustomSelectOption<NonNullable<Employee['pixType']>>[] = [
    { value: 'cpf', label: 'CPF' },
    { value: 'phone', label: 'Celular' },
    { value: 'email', label: 'E-mail' },
    { value: 'random', label: 'Chave Aleatória' },
    { value: 'cnpj', label: 'CNPJ' },
  ];

  const sizeOptions: CustomSelectOption<'PP' | 'P' | 'M' | 'G' | 'GG' | 'XGG'>[] = [
    { value: 'PP', label: 'PP' },
    { value: 'P', label: 'P' },
    { value: 'M', label: 'M' },
    { value: 'G', label: 'G' },
    { value: 'GG', label: 'GG' },
    { value: 'XGG', label: 'XGG' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-brand-card border border-brand-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8 p-6 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-brand-text uppercase tracking-wider">
                Editar Dados Pessoais & PIX
              </h2>
              <p className="text-xs text-gray-400">
                {employee.artisticName || employee.name}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            type="button"
            className="p-2 text-gray-400 hover:text-white bg-slate-800/80 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="py-4 space-y-5 overflow-y-auto pr-1 flex-1">
          {/* PIX Section */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <CreditCard size={15} />
              <span>Dados Bancários / PIX</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CustomSelect
                label="Tipo de Chave PIX"
                value={pixType}
                onChange={setPixType}
                options={pixOptions}
                accentColor="amber"
              />

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Chave PIX
                </label>
                <input 
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: 123.456.789-00 ou email@pix.com"
                  className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 flex items-center gap-1">
                  <Building2 size={13} className="text-gray-400" />
                  <span>Banco / Plataforma</span>
                </label>
                <input 
                  type="text"
                  value={pixBank}
                  onChange={(e) => setPixBank(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, Mercado Pago"
                  className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 flex items-center gap-1">
                  <UserCheck size={13} className="text-gray-400" />
                  <span>Nome do Titular</span>
                </label>
                <input 
                  type="text"
                  value={pixOwnerName}
                  onChange={(e) => setPixOwnerName(e.target.value)}
                  placeholder="Ex: Nome Completo do Titular"
                  className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Liga Positiva & Uniformes */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <Calendar size={15} />
              <span>Início na Liga Positiva & Uniformes</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">
                Mês/Ano de Início na Liga Positiva
              </label>
              <input 
                type="month"
                value={startDateAtLiga}
                onChange={(e) => setStartDateAtLiga(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <CustomSelect
                label="Camiseta"
                value={shirtSize}
                onChange={setShirtSize}
                options={sizeOptions}
                accentColor="cyan"
              />

              <CustomSelect
                label="Shorts"
                value={shortsSize}
                onChange={setShortsSize}
                options={sizeOptions}
                accentColor="emerald"
              />

              <CustomSelect
                label="Corta Vento"
                value={windbreakerSize}
                onChange={setWindbreakerSize}
                options={sizeOptions}
                accentColor="purple"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
              <PhoneCall size={15} />
              <span>Contato de Emergência</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Nome do Contato
                </label>
                <input 
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Ex: Mãe (Maria), Cônjuge (Carlos)"
                  className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Telefone / WhatsApp
                </label>
                <input 
                  type="text"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="Ex: (11) 99999-8888"
                  className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-semibold text-brand-text focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Dados'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
