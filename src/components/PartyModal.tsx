import React, { useState, useEffect } from 'react';
import { 
  X, 
  PartyPopper, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Share2, 
  CalendarPlus, 
  MessageCircle, 
  Users, 
  Sparkles, 
  Check, 
  Copy,
  DollarSign
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PartyDetails, PartyChecklistItem, Employee } from '../types';
import { DEFAULT_PARTY_CHECKLIST, STANDARD_PARTY_SERVICES, STANDARD_EVENT_TYPES } from '../lib/defaultPartyChecklist';
import { buildGoogleCalendarUrl, buildWhatsAppBriefing, downloadIcsFile, getAssignedEmployeesWithEmail } from '../lib/googleCalendarHelper';
import { cn } from '../lib/utils';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: PartyDetails | null;
  onSave: (party: PartyDetails, assignedEmployeeIds?: string[]) => Promise<void>;
  onDelete?: (partyId: string, date: string) => Promise<void>;
  employees: Employee[];
  initialDate?: string;
}

export default function PartyModal({
  isOpen,
  onClose,
  party,
  onSave,
  onDelete,
  employees,
  initialDate
}: PartyModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'contractor' | 'services' | 'checklist' | 'team'>('info');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedBriefing, setCopiedBriefing] = useState(false);

  // Form State
  const [id, setId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [setupTime, setSetupTime] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('Aniversário Infantil');
  const [birthdayPersonName, setBirthdayPersonName] = useState('');
  const [birthdayPersonAge, setBirthdayPersonAge] = useState<string | number>('');
  const [theme, setTheme] = useState('');
  
  // Contractor State
  const [contractorName, setContractorName] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [contractorEmail, setContractorEmail] = useState('');
  const [contractorNotes, setContractorNotes] = useState('');

  // Services & Checklist
  const [services, setServices] = useState<string[]>([]);
  const [newServiceInput, setNewServiceInput] = useState('');
  const [totalPrice, setTotalPrice] = useState<string>('');
  const [checklist, setChecklist] = useState<PartyChecklistItem[]>([]);
  const [newChecklistItemInput, setNewChecklistItemInput] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('custom');

  // Team Assignment State
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const defaultDate = initialDate || format(new Date(), 'yyyy-MM-dd');

    if (party) {
      setId(party.id);
      setPartyId(party.partyId || party.id);
      setDate(party.date || defaultDate);
      setName(party.name || '');
      setTime(party.time || '');
      setEndTime(party.endTime || '');
      setSetupTime(party.setupTime || '');
      setLocation(party.location || 'CCSP');
      setEventType(party.eventType || 'Aniversário Infantil');
      setBirthdayPersonName(party.birthdayPersonName || '');
      setBirthdayPersonAge(party.birthdayPersonAge || '');
      setTheme(party.theme || '');
      
      setContractorName(party.contractorName || '');
      setContractorPhone(party.contractorPhone || '');
      setContractorEmail(party.contractorEmail || '');
      setContractorNotes(party.contractorNotes || '');

      setServices(party.services && party.services.length > 0 ? party.services : ['Recreação Completa']);
      setTotalPrice(party.totalPrice ? party.totalPrice.toString() : '');
      
      // If party has checklist, use it, otherwise prefill with defaults
      setChecklist(
        party.checklist && party.checklist.length > 0 
          ? party.checklist 
          : DEFAULT_PARTY_CHECKLIST.map(i => ({ ...i }))
      );

      // Determine assigned employees from party record or workDays
      if (party.assignedEmployeeIds && party.assignedEmployeeIds.length > 0) {
        setAssignedEmployeeIds(party.assignedEmployeeIds);
      } else {
        const scheduled = employees.filter(emp => 
          emp.workDays?.some(d => d.date === party.date && d.type === 'party' && (!party.partyId || d.partyId === party.partyId || d.partyName === party.name))
        ).map(e => e.id);
        setAssignedEmployeeIds(scheduled);
      }
    } else {
      // New Party
      const newGeneratedId = `party_${Date.now()}`;
      setId(newGeneratedId);
      setPartyId(newGeneratedId);
      setDate(defaultDate);
      setName('');
      setTime('14:00');
      setEndTime('18:00');
      setSetupTime('13:30');
      setLocation('CCSP');
      setEventType('Aniversário Infantil');
      setBirthdayPersonName('');
      setBirthdayPersonAge('');
      setTheme('');
      setContractorName('');
      setContractorPhone('');
      setContractorEmail('');
      setContractorNotes('');
      setServices(['Recreação Completa', 'Pintura Facial Artística']);
      setTotalPrice('');
      setChecklist(DEFAULT_PARTY_CHECKLIST.map(i => ({ ...i })));
      setAssignedEmployeeIds([]);
    }
  }, [isOpen, party, initialDate, employees]);

  if (!isOpen) return null;

  const handleToggleChecklistItem = (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItemInput.trim()) return;
    const newItem: PartyChecklistItem = {
      id: `custom_${Date.now()}`,
      label: newChecklistItemInput.trim(),
      checked: false,
      category: newChecklistCategory
    };
    setChecklist(prev => [...prev, newItem]);
    setNewChecklistItemInput('');
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    setChecklist(prev => prev.filter(item => item.id !== itemId));
  };

  const handleToggleService = (service: string) => {
    setServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const handleAddCustomService = () => {
    if (!newServiceInput.trim()) return;
    if (!services.includes(newServiceInput.trim())) {
      setServices(prev => [...prev, newServiceInput.trim()]);
    }
    setNewServiceInput('');
  };

  const handleToggleEmployeeAssignment = (empId: string) => {
    setAssignedEmployeeIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleCopyWhatsAppBriefing = () => {
    const currentPartyObj: PartyDetails = {
      id,
      partyId,
      date,
      name: name.trim() || 'Festa',
      time,
      endTime,
      setupTime,
      location,
      eventType,
      birthdayPersonName,
      birthdayPersonAge,
      theme,
      contractorName,
      contractorPhone,
      contractorEmail,
      contractorNotes,
      services,
      checklist,
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      assignedEmployeeIds
    };

    const assignedEmps = employees.filter(e => assignedEmployeeIds.includes(e.id));
    const text = buildWhatsAppBriefing(currentPartyObj, assignedEmps);
    navigator.clipboard.writeText(text);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do evento / festa.');
      return;
    }
    if (!date) {
      alert('Por favor, selecione a data do evento.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedParty: PartyDetails = {
        id,
        partyId: partyId || id,
        date,
        name: name.trim(),
        time: time.trim(),
        endTime: endTime.trim(),
        setupTime: setupTime.trim(),
        location: location.trim(),
        eventType,
        birthdayPersonName: birthdayPersonName.trim(),
        birthdayPersonAge: birthdayPersonAge ? Number(birthdayPersonAge) : undefined,
        theme: theme.trim(),
        contractorName: contractorName.trim(),
        contractorPhone: contractorPhone.trim(),
        contractorEmail: contractorEmail.trim(),
        contractorNotes: contractorNotes.trim(),
        services,
        checklist,
        totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
        assignedEmployeeIds,
        updatedAt: new Date().toISOString()
      };

      await onSave(updatedParty, assignedEmployeeIds);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar festa:", error);
      alert("Não foi possível salvar o evento. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const completedChecklistCount = checklist.filter(i => i.checked).length;
  const currentAssignedEmployees = employees.filter(e => assignedEmployeeIds.includes(e.id));
  
  const currentPreviewParty: PartyDetails = {
    id,
    partyId,
    date,
    name: name.trim() || 'Festa',
    time,
    endTime,
    setupTime,
    location,
    eventType,
    birthdayPersonName,
    birthdayPersonAge,
    theme,
    contractorName,
    contractorPhone,
    contractorEmail,
    contractorNotes,
    services,
    checklist,
    totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
    assignedEmployeeIds
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-brand-card border border-brand-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-border bg-brand-bg/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-party/20 border border-brand-party/30 flex items-center justify-center text-brand-party shrink-0">
              <PartyPopper size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-brand-text flex items-center gap-2">
                <span>{party ? 'Gerenciar Festa & Evento' : 'Novo Evento / Festa'}</span>
              </h2>
              <p className="text-xs text-brand-muted">
                {date ? format(parseISO(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Defina os dados completos do evento'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-brand-muted hover:text-brand-text p-2 rounded-xl hover:bg-brand-primary/10 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-brand-border bg-brand-bg/20 px-2 sm:px-4 gap-1 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={cn(
              "px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap",
              activeTab === 'info'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            )}
          >
            <CalendarIcon size={15} />
            <span>Dados do Evento</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contractor')}
            className={cn(
              "px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap",
              activeTab === 'contractor'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            )}
          >
            <User size={15} />
            <span>Contratante</span>
            {contractorName && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={cn(
              "px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap",
              activeTab === 'services'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            )}
          >
            <Sparkles size={15} />
            <span>Serviços ({services.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={cn(
              "px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap",
              activeTab === 'checklist'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            )}
          >
            <CheckSquare size={15} />
            <span>Checklist ({completedChecklistCount}/{checklist.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={cn(
              "px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap",
              activeTab === 'team'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            )}
          >
            <Users size={15} />
            <span>Equipe ({assignedEmployeeIds.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* TAB 1: DADOS DO EVENTO */}
          {activeTab === 'info' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-brand-text mb-1.5">
                    Nome da Festa / Identificação <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Aniversário de 7 anos da Mariana / Festa CCSP"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5">
                    Data do Evento <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5">
                    Tipo de Evento
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  >
                    {STANDARD_EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <Clock size={13} className="text-brand-party" />
                    <span>Horário do Evento (Início - Fim)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Início (ex: 14:00)"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                    />
                    <input
                      type="text"
                      placeholder="Fim (ex: 18:00)"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-400" />
                    <span>Horário de Chegada / Montagem</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 13h30 (30 min antes)"
                    value={setupTime}
                    onChange={(e) => setSetupTime(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <MapPin size={13} className="text-red-400" />
                    <span>Local / Endereço Completo</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CCSP (Sede) ou Rua das Flores, 123 - Moema"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5">
                    Aniversariante (Nome e Idade)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nome da criança"
                      value={birthdayPersonName}
                      onChange={(e) => setBirthdayPersonName(e.target.value)}
                      className="col-span-2 bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                    />
                    <input
                      type="text"
                      placeholder="Idade (anos)"
                      value={birthdayPersonAge}
                      onChange={(e) => setBirthdayPersonAge(e.target.value)}
                      className="col-span-1 bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-primary text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5">
                    Tema da Festa
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Safari, Dinossauros, Harry Potter, etc."
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DADOS DO CONTRATANTE (CONFIDENCIAL) */}
          {activeTab === 'contractor' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-start gap-2.5">
                <User className="text-brand-primary shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-brand-text">
                  <strong>Área restrita aos administradores:</strong> Os recreadores não têm acesso direto aos telefones e e-mails dos contratantes por questões de privacidade e segurança.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <User size={13} className="text-brand-primary" />
                    <span>Nome Completo do Responsável / Contratante</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Eduardo Silveira"
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-400" />
                    <span>Telefone / WhatsApp</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={contractorPhone}
                      onChange={(e) => setContractorPhone(e.target.value)}
                      className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                    />
                    {contractorPhone && (
                      <a
                        href={`https://wa.me/55${contractorPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 rounded-xl flex items-center justify-center transition-all"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle size={18} />
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} className="text-sky-400" />
                    <span>E-mail do Responsável</span>
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={contractorEmail}
                    onChange={(e) => setContractorEmail(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-brand-text mb-1.5 flex items-center gap-1.5">
                    <FileText size={13} className="text-amber-400" />
                    <span>Observações Especiais, Alergias ou Restrições</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Criança aniversariante tem alergia a glúten. Pais pediram foco em brincadeiras de corrida e gincanas na quadra."
                    value={contractorNotes}
                    onChange={(e) => setContractorNotes(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SERVIÇOS CONTRATADOS */}
          {activeTab === 'services' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-brand-text">
                  Selecione os Serviços Inclusos na Festa:
                </label>
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-emerald-400" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor Total R$"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value)}
                    className="w-32 bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text text-right font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STANDARD_PARTY_SERVICES.map((s) => {
                  const isChecked = services.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleToggleService(s)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-bold text-left transition-all",
                        isChecked
                          ? "bg-brand-party/15 border-brand-party/40 text-brand-party shadow-sm"
                          : "bg-brand-bg/60 border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-bg"
                      )}
                    >
                      <span>{s}</span>
                      {isChecked ? (
                        <div className="w-5 h-5 rounded-md bg-brand-party text-slate-950 flex items-center justify-center shrink-0">
                          <Check size={13} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-brand-border shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Service Addition */}
              <div className="pt-2 border-t border-brand-border flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar serviço personalizado..."
                  value={newServiceInput}
                  onChange={(e) => setNewServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomService();
                    }
                  }}
                  className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                />
                <button
                  type="button"
                  onClick={handleAddCustomService}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1 shrink-0"
                >
                  <Plus size={16} />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CHECKLIST OPERACIONAL */}
          {activeTab === 'checklist' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Progress bar */}
              <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-brand-text">Conferência de Materiais & Equipamentos</span>
                  <span className="text-brand-primary font-mono">{completedChecklistCount} de {checklist.length} itens</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 transition-all duration-300"
                    style={{ width: `${checklist.length > 0 ? (completedChecklistCount / checklist.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Checklist items list */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs sm:text-sm",
                      item.checked
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium"
                        : "bg-brand-bg/40 border-brand-border text-brand-text hover:bg-brand-bg"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklistItem(item.id)}
                      className="flex items-center gap-2.5 flex-1 text-left"
                    >
                      {item.checked ? (
                        <CheckSquare size={18} className="text-emerald-400 shrink-0" />
                      ) : (
                        <Square size={18} className="text-brand-muted shrink-0" />
                      )}
                      <span className={cn(item.checked && "line-through opacity-80")}>
                        {item.label}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteChecklistItem(item.id)}
                      className="text-brand-muted hover:text-red-400 p-1 rounded-lg transition-colors ml-2"
                      title="Excluir item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom item */}
              <div className="pt-2 border-t border-brand-border flex gap-2">
                <input
                  type="text"
                  placeholder="Novo item de material (ex: 2x Caixas de Giz)..."
                  value={newChecklistItemInput}
                  onChange={(e) => setNewChecklistItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1 shrink-0"
                >
                  <Plus size={16} />
                  <span>Item</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: EQUIPE ESCALADA */}
          {activeTab === 'team' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
                <p className="text-xs text-brand-muted">
                  Selecione os recreadores que trabalharão nesta festa. Os dias de trabalho (workDays) serão vinculados automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {employees.filter(e => e.status !== 'inactive').map((emp) => {
                  const isAssigned = assignedEmployeeIds.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleToggleEmployeeAssignment(emp.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-left transition-all text-xs sm:text-sm",
                        isAssigned
                          ? "bg-brand-party/15 border-brand-party/40 text-brand-party font-bold shadow-sm"
                          : "bg-brand-bg/40 border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-bg"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-black text-xs shrink-0">
                          {(emp.artisticName || emp.name).charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-brand-text truncate">{emp.artisticName || emp.name}</p>
                          <p className="text-[10px] text-brand-muted truncate">{emp.level}</p>
                        </div>
                      </div>

                      {isAssigned ? (
                        <div className="w-5 h-5 rounded-md bg-brand-party text-slate-950 flex items-center justify-center shrink-0">
                          <Check size={13} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-brand-border shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-brand-border bg-brand-bg/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Google Calendar Link Generator */}
            {(() => {
              const withEmail = getAssignedEmployeesWithEmail(currentAssignedEmployees);
              const tooltip = withEmail.length > 0
                ? `Adicionar ao Google Agenda e convidar ${withEmail.length} recreador(es) automaticamente: ${withEmail.map(e => e.artisticName || e.name).join(', ')}`
                : 'Criar evento no Google Agenda';

              return (
                <a
                  href={buildGoogleCalendarUrl(currentPreviewParty, currentAssignedEmployees)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-none px-3 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                  title={tooltip}
                >
                  <CalendarPlus size={15} />
                  <span>Google Agenda</span>
                  {withEmail.length > 0 && (
                    <span 
                      className="px-1.5 py-0.5 rounded-md bg-blue-500/30 text-blue-200 group-hover:bg-blue-700 text-[10px] font-black"
                      title={`${withEmail.length} recreador(es) convidados na agenda`}
                    >
                      +{withEmail.length}
                    </span>
                  )}
                </a>
              );
            })()}

            {/* WhatsApp Briefing Copy */}
            <button
              type="button"
              onClick={handleCopyWhatsAppBriefing}
              className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              title="Copiar Briefing formatado para WhatsApp"
            >
              {copiedBriefing ? <Check size={15} /> : <MessageCircle size={15} />}
              <span>{copiedBriefing ? 'Copiado!' : 'Briefing WhatsApp'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {party && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Tem certeza que deseja excluir a festa "${party.name}"?`)) {
                    onDelete(party.partyId || party.id, party.date);
                    onClose();
                  }
                }}
                className="px-3 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-bold transition-colors"
              >
                Excluir
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 rounded-xl text-xs sm:text-sm font-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
              ) : (
                <Check size={16} strokeWidth={3} />
              )}
              <span>Salvar Evento</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
