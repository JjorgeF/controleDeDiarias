import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User,
  UserRound,
  Calendar, 
  Sparkles, 
  Clock, 
  DollarSign, 
  Camera,
  Loader2,
  Trash2,
  ChevronRight,
  Shirt,
  CreditCard,
  Building2,
  UserCheck,
  PhoneCall,
  Edit3,
  CheckCircle2,
  Wind
} from 'lucide-react';
import { Employee } from '../types';
import { format, parseISO, differenceInMonths, differenceInYears, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compressProfileImage } from '../utils/imageCompressor';
import ImageCropperModal from './ImageCropperModal';
import EditPersonalDetailsModal from './EditPersonalDetailsModal';

interface EmployeeProfileViewProps {
  employee: Employee;
  isAdmin?: boolean;
  onEditEmployee?: () => void;
  onUpdatePhoto?: (photoUrl: string) => Promise<void> | void;
  onUpdateDetails?: (employeeId: string, updatedFields: Partial<Employee>) => Promise<void> | void;
  canEditPhoto?: boolean;
  onNavigateToEarnings?: () => void;
}

export default function EmployeeProfileView({
  employee,
  isAdmin,
  onEditEmployee,
  onUpdatePhoto,
  onUpdateDetails,
  canEditPhoto = true,
  onNavigateToEarnings
}: EmployeeProfileViewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isTypeImage = file.type ? (file.type.startsWith('image/') || file.type.includes('heic') || file.type.includes('heif')) : true;
    const isExtImage = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff)$/i.test(file.name || '');

    if (!isTypeImage && !isExtImage) {
      setFileError('Por favor selecione um arquivo de imagem.');
      return;
    }

    try {
      setIsUploading(true);
      setFileError(null);
      const base64Image = await compressProfileImage(file, 800, 0.9);
      setImageToCrop(base64Image);
      setIsCropperOpen(true);
    } catch (err: any) {
      console.error('Erro ao ler imagem:', err);
      setFileError('Não foi possível carregar a imagem. Tente outra foto.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    if (!onUpdatePhoto) return;
    try {
      setIsUploading(true);
      await onUpdatePhoto(croppedDataUrl);
      showSuccessFeedback('Foto de perfil atualizada!');
    } catch (err) {
      console.error('Erro ao atualizar foto:', err);
      setFileError('Erro ao salvar a foto de perfil.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdatePhoto) return;
    if (window.confirm('Deseja remover a foto de perfil?')) {
      try {
        setIsUploading(true);
        await onUpdatePhoto('');
        showSuccessFeedback('Foto de perfil removida.');
      } catch (err) {
        console.error('Erro ao remover foto:', err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const showSuccessFeedback = (msg: string) => {
    setSavedSuccessMsg(msg);
    setTimeout(() => {
      setSavedSuccessMsg(null);
    }, 4000);
  };

  const handleSaveDetails = async (empId: string, updatedFields: Partial<Employee>) => {
    if (onUpdateDetails) {
      await onUpdateDetails(empId, updatedFields);
      showSuccessFeedback('Dados de perfil e uniformes salvos com sucesso!');
    }
  };

  // Calculate entry date
  const joinedDateStr = React.useMemo(() => {
    if (employee.startDateAtLiga) return employee.startDateAtLiga;
    if (employee.startDate) return employee.startDate;
    
    const allDates: string[] = [];
    (employee.workDays || []).forEach(d => {
      if (d.date) allDates.push(d.date);
    });
    (employee.promotions || []).forEach(p => {
      if (p.date) allDates.push(p.date);
    });

    if (allDates.length > 0) {
      allDates.sort();
      return allDates[0];
    }

    return format(new Date(), 'yyyy-MM-dd');
  }, [employee.startDateAtLiga, employee.startDate, employee.workDays, employee.promotions]);

  const formattedJoinedDate = React.useMemo(() => {
    try {
      // If it's YYYY-MM
      if (/^\d{4}-\d{2}$/.test(joinedDateStr)) {
        const [year, month] = joinedDateStr.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);
        return format(d, "MMMM 'de' yyyy", { locale: ptBR });
      }
      const date = parseISO(joinedDateStr);
      if (!isValid(date)) return 'Data não informada';
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return 'Data não informada';
    }
  }, [joinedDateStr]);

  // Compute time in company
  const timeInCompanyStr = React.useMemo(() => {
    try {
      let startDate: Date;
      if (/^\d{4}-\d{2}$/.test(joinedDateStr)) {
        const [year, month] = joinedDateStr.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      } else {
        startDate = parseISO(joinedDateStr);
      }
      if (!isValid(startDate)) return '';
      const now = new Date();
      const years = differenceInYears(now, startDate);
      const months = differenceInMonths(now, startDate) % 12;

      if (years > 0) {
        return years === 1 
          ? `1 ano${months > 0 ? ` e ${months} ${months === 1 ? 'mês' : 'meses'}` : ''}`
          : `${years} anos${months > 0 ? ` e ${months} ${months === 1 ? 'mês' : 'meses'}` : ''}`;
      } else if (months > 0) {
        return months === 1 ? '1 mês na Liga' : `${months} meses na Liga`;
      } else {
        return 'Novo integrante da Liga!';
      }
    } catch {
      return '';
    }
  }, [joinedDateStr]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast de Sucesso */}
      <AnimatePresence>
        {savedSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>{savedSuccessMsg}</span>
            </div>
            <button
              onClick={() => setSavedSuccessMsg(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-1"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-2xl relative"
      >
        {/* Background Decorative Gradient */}
        <div className="h-28 sm:h-32 bg-brand-bg relative overflow-hidden">
          <div className="absolute inset-0 bg-logo-gradient animate-logo-border opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-card/30 via-brand-card/60 to-brand-card" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_70%)]" />
          
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {canEditPhoto && onUpdatePhoto && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 bg-brand-card/80 hover:bg-brand-primary hover:text-brand-bg text-brand-primary rounded-full border border-brand-border/80 shadow-md backdrop-blur-md transition-all active:scale-95 disabled:opacity-50"
                title="Alterar foto de perfil"
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-slate-900 font-black text-xs rounded-xl shadow-lg hover:bg-brand-primary-hover active:scale-95 transition-all"
              title="Editar dados pessoais, uniformes e PIX"
            >
              <Edit3 size={15} />
              <span className="hidden sm:inline">Editar Dados</span>
            </button>
          </div>
        </div>

        {/* Hidden File Input for Profile Photo */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/*,.heic,.heif,image/heic,image/heif" 
          className="hidden" 
          onChange={handleFileChange} 
        />

        {/* Profile Content */}
        <div className="px-5 sm:px-6 pb-6 relative -mt-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
            {/* Avatar Circle */}
            <div className="w-24 h-24 rounded-full bg-brand-card p-1 ring-2 ring-brand-border shadow-2xl shrink-0 relative group">
              <div className="w-full h-full bg-brand-card rounded-full flex items-center justify-center font-black text-3xl text-brand-primary uppercase overflow-hidden relative">
                {employee.photoUrl ? (
                  <img 
                    src={employee.photoUrl} 
                    alt={employee.artisticName || employee.name} 
                    className="w-full h-full object-cover rounded-full" 
                  />
                ) : (
                  <span>{employee.artisticName?.substring(0, 2) || employee.name?.substring(0, 2)}</span>
                )}

                {/* Upload overlay on hover */}
                {canEditPhoto && onUpdatePhoto && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer rounded-full gap-1 p-1 text-center backdrop-blur-xs"
                    title="Clique para escolher nova foto"
                  >
                    {isUploading ? (
                      <Loader2 size={22} className="animate-spin text-brand-primary" />
                    ) : (
                      <>
                        <Camera size={20} className="text-brand-primary" />
                        <span className="text-[10px] font-bold leading-tight">Mudar Foto</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Remove Photo Trash Button */}
              {employee.photoUrl && canEditPhoto && onUpdatePhoto && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={isUploading}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-full shadow-md border border-red-400 transition-transform hover:scale-110"
                  title="Remover foto de perfil"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            <div>
              {fileError && (
                <div className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg mb-2">
                  {fileError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-black text-brand-text tracking-tight">
                  {employee.artisticName || employee.name}
                </h1>
                <span className="text-xs font-extrabold uppercase px-3 py-1 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
                  {employee.level}
                </span>
              </div>
              {employee.artisticName && employee.name !== employee.artisticName && (
                <p className="text-xs font-semibold text-brand-muted mb-2">
                  Nome completo: {employee.name}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs font-medium text-gray-400">
                <span className="flex items-center gap-1.5 bg-brand-bg/60 border border-brand-border/60 px-2.5 py-1 rounded-lg">
                  <Calendar size={14} className="text-brand-primary" />
                  Entrou na Liga em: <strong className="text-brand-text">{formattedJoinedDate}</strong>
                </span>
                {timeInCompanyStr && (
                  <span className="flex items-center gap-1.5 bg-brand-bg/60 border border-brand-border/60 px-2.5 py-1 rounded-lg">
                    <Clock size={14} className="text-emerald-400" />
                    {timeInCompanyStr}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex md:hidden justify-center mt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-slate-900 font-black text-xs rounded-xl shadow-md active:scale-98 transition-all"
            >
              <Edit3 size={16} />
              Editar Dados, Uniformes & PIX
            </button>
          </div>
        </div>
      </motion.div>

      {/* Grid: Uniformes & Dados Bancários (Conta de Recebimento) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bloco de Uniformes */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-brand-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <Shirt size={20} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-brand-text uppercase tracking-wider">
                    Uniformes & Vestuário
                  </h2>
                  <p className="text-[11px] text-gray-400">Tamanhos registrados na Liga</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
              >
                <Edit3 size={13} />
                Editar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {/* Camiseta */}
              <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Camiseta
                </span>
                <span className="text-xl font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-lg">
                  {employee.shirtSize || 'M'}
                </span>
              </div>

              {/* Shorts */}
              <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Shorts
                </span>
                <span className="text-xl font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-lg">
                  {employee.shortsSize || 'M'}
                </span>
              </div>

              {/* Corta Vento */}
              <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Corta Vento
                </span>
                <span className="text-xl font-black text-purple-300 bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-lg">
                  {employee.windbreakerSize || 'M'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/40 text-[11px] text-gray-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-cyan-400 shrink-0" />
            <span>Mantenha os tamanhos atualizados para novas remessas de uniformes.</span>
          </div>
        </motion.div>

        {/* Bloco de Conta de Recebimento (PIX) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-brand-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-brand-text uppercase tracking-wider">
                    Conta de Recebimento
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
              >
                <Edit3 size={13} />
                Editar
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    Chave PIX ({employee.pixType?.toUpperCase() || 'CPF'})
                  </span>
                  <span className="font-mono text-sm font-black text-amber-300 truncate block">
                    {employee.pixKey || 'Não cadastrada'}
                  </span>
                </div>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0">
                  {employee.pixType?.toUpperCase() || 'CHAVE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-2.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block flex items-center gap-1">
                    <Building2 size={11} className="text-gray-400" /> Banco / App
                  </span>
                  <span className="text-xs font-bold text-brand-text truncate block mt-0.5">
                    {employee.pixBank || 'Não informado'}
                  </span>
                </div>

                <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-2.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block flex items-center gap-1">
                    <UserCheck size={11} className="text-gray-400" /> Titular
                  </span>
                  <span className="text-xs font-bold text-brand-text truncate block mt-0.5">
                    {employee.pixOwnerName || employee.name || 'Mesmo titular'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/40 text-[11px] text-gray-400 flex items-center gap-1.5">
            <DollarSign size={13} className="text-amber-400 shrink-0" />
            <span>Os pagamentos são processados de acordo com a chave acima.</span>
          </div>
        </motion.div>
      </div>

      {/* Contato de Emergência & Entrada */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3 border-b border-brand-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
              <PhoneCall size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-brand-text uppercase tracking-wider">
                Contato de Emergência
              </h2>
              <p className="text-[11px] text-gray-400">Pessoas de contato para suporte e eventos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs font-bold text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
          >
            <Edit3 size={13} />
            Editar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">
              Contato de Emergência
            </span>
            <span className="text-xs font-bold text-brand-text mt-0.5 block truncate">
              {employee.emergencyContactName || 'Não cadastrado'}
            </span>
          </div>

          <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">
              Telefone / WhatsApp
            </span>
            <span className="text-xs font-bold text-rose-300 mt-0.5 block font-mono">
              {employee.emergencyContactPhone || 'Não cadastrado'}
            </span>
          </div>

          <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">
              Data de Início na Liga
            </span>
            <span className="text-xs font-bold text-brand-primary mt-0.5 block">
              {formattedJoinedDate}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Modal de Edição de Dados Pessoais, Uniformes & PIX */}
      <EditPersonalDetailsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        employee={employee}
        onSave={handleSaveDetails}
      />

      <ImageCropperModal
        imageSrc={imageToCrop}
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
