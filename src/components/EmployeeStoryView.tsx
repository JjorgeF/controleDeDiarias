import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Award, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  Sparkles, 
  Star, 
  Clock, 
  User, 
  DollarSign, 
  PartyPopper, 
  ShieldCheck, 
  Zap, 
  Flame, 
  Crown,
  Edit2,
  Camera,
  Image as ImageIcon,
  Loader2,
  Trash2
} from 'lucide-react';
import { Employee } from '../types';
import { format, parseISO, differenceInMonths, differenceInYears, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compressProfileImage } from '../utils/imageCompressor';
import ImageCropperModal from './ImageCropperModal';

interface EmployeeStoryViewProps {
  employee: Employee;
  isAdmin?: boolean;
  onEditEmployee?: () => void;
  onUpdatePhoto?: (photoUrl: string) => Promise<void> | void;
  canEditPhoto?: boolean;
}

export default function EmployeeStoryView({
  employee,
  isAdmin,
  onEditEmployee,
  onUpdatePhoto,
  canEditPhoto = true
}: EmployeeStoryViewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Mobile file validation: allow image/* mime OR empty mime with image extension
    const isTypeImage = file.type ? (file.type.startsWith('image/') || file.type.includes('heic') || file.type.includes('heif')) : true;
    const isExtImage = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff)$/i.test(file.name || '');

    if (!isTypeImage && !isExtImage) {
      setFileError('Por favor selecione um arquivo de imagem.');
      return;
    }

    try {
      setIsUploading(true);
      setFileError(null);
      // Pre-process image to standard base64/dataURL so cropper can load it smoothly (including HEIC)
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
      } catch (err) {
        console.error('Erro ao remover foto:', err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Compute total completed/confirmed work days across all time
  const completedWorkDays = React.useMemo(() => {
    return (employee.workDays || []).filter(d => !d.isCancelled);
  }, [employee.workDays]);

  const totalDiarias = completedWorkDays.length;
  const ccspCount = completedWorkDays.filter(d => d.type === 'common').length;
  const partyCount = completedWorkDays.filter(d => d.type === 'party').length;

  // Calculate entry date
  const joinedDateStr = React.useMemo(() => {
    if (employee.startDate) return employee.startDate;
    
    // Fallback: earliest work day or promotion date
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
  }, [employee.startDate, employee.workDays, employee.promotions]);

  const formattedJoinedDate = React.useMemo(() => {
    try {
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
      const startDate = parseISO(joinedDateStr);
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

  // Total promotions
  const promotionsList = React.useMemo(() => {
    return [...(employee.promotions || [])].sort((a, b) => a.date.localeCompare(b.date));
  }, [employee.promotions]);

  // Estimate total earnings
  const totalEarnings = React.useMemo(() => {
    return completedWorkDays.reduce((acc, day) => {
      let dayBase = 0;
      if (day.type === 'common') {
        dayBase = day.dailyRateAtTime !== undefined ? day.dailyRateAtTime : employee.dailyRate;
      } else if (day.type === 'party') {
        dayBase = day.partyRateAtTime !== undefined ? day.partyRateAtTime : employee.partyRate;
      }
      const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : employee.extraHourRate;
      const extra = (day.extraHours || 0) * extraRate;
      return acc + dayBase + extra;
    }, 0);
  }, [completedWorkDays, employee]);

  // Group completed work days by month (YYYY-MM)
  const monthlySummaries = React.useMemo(() => {
    const map: Record<string, { monthKey: string; monthLabel: string; total: number; ccsp: number; party: number }> = {};
    
    completedWorkDays.forEach(day => {
      if (!day.date) return;
      const monthKey = day.date.substring(0, 7); // YYYY-MM
      if (!map[monthKey]) {
        let monthLabel = monthKey;
        try {
          const dateObj = parseISO(`${monthKey}-01`);
          if (isValid(dateObj)) {
            monthLabel = format(dateObj, "MMMM 'de' yyyy", { locale: ptBR });
            monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
          }
        } catch {
          // fallback
        }
        map[monthKey] = { monthKey, monthLabel, total: 0, ccsp: 0, party: 0 };
      }
      map[monthKey].total += 1;
      if (day.type === 'common') map[monthKey].ccsp += 1;
      if (day.type === 'party') map[monthKey].party += 1;
    });

    return Object.values(map).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [completedWorkDays]);

  // Unified Timeline Events
  const timelineEvents = React.useMemo(() => {
    type TimelineItem = 
      | { type: 'start'; date: string; title: string; formattedDate: string }
      | { type: 'promotion'; date: string; promo: typeof promotionsList[0]; idx: number }
      | { type: 'monthly'; date: string; summary: typeof monthlySummaries[0] };

    const items: TimelineItem[] = [];

    // 1. Joined
    items.push({
      type: 'start',
      date: joinedDateStr,
      title: 'Início na Liga Positiva',
      formattedDate: formattedJoinedDate
    });

    // 2. Promotions
    promotionsList.forEach((promo, idx) => {
      items.push({
        type: 'promotion',
        date: promo.date,
        promo,
        idx: idx + 1
      });
    });

    // 3. Monthly summaries
    monthlySummaries.forEach(summary => {
      items.push({
        type: 'monthly',
        date: `${summary.monthKey}-28`, // sort towards end of month
        summary
      });
    });

    // Sort chronologically ascending
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [joinedDateStr, formattedJoinedDate, promotionsList, monthlySummaries]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-2xl relative"
      >
        {/* Background Decorative Gradient with Logo Colors Animation */}
        <div className="h-32 bg-brand-bg relative overflow-hidden">
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
        <div className="px-6 pb-6 relative -mt-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
            {/* Avatar Circle */}
            <div className="w-24 h-24 rounded-2xl bg-brand-card p-1 ring-2 ring-brand-border shadow-2xl shrink-0 relative group">
              <div className="w-full h-full bg-brand-card rounded-[14px] flex items-center justify-center font-black text-3xl text-brand-primary uppercase overflow-hidden relative">
                {employee.photoUrl ? (
                  <img 
                    src={employee.photoUrl} 
                    alt={employee.artisticName || employee.name} 
                    className="w-full h-full object-cover rounded-[14px]" 
                  />
                ) : (
                  <span>{employee.artisticName?.substring(0, 2) || employee.name?.substring(0, 2)}</span>
                )}

                {/* Upload overlay on hover */}
                {canEditPhoto && onUpdatePhoto && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer rounded-[14px] gap-1 p-1 text-center backdrop-blur-xs"
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

              {/* Quick Remove Photo Trash Button if photo exists */}
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
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-medium text-gray-400">
                <span className="flex items-center gap-1.5 bg-brand-bg/60 border border-brand-border/60 px-2.5 py-1 rounded-lg">
                  <Calendar size={14} className="text-brand-primary" />
                  Entrou em: <strong className="text-brand-text">{formattedJoinedDate}</strong>
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
        </div>
      </motion.div>

      {/* Grid of Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Diárias */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-brand-card border border-brand-border p-4 rounded-xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diárias Totais</span>
            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg">
              <Award size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-brand-text">{totalDiarias}</span>
            <div className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-2">
              <span className="text-brand-primary">{ccspCount} CCSP</span>
              <span>•</span>
              <span className="text-purple-400">{partyCount} Festas</span>
            </div>
          </div>
        </motion.div>

        {/* Promoções */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-brand-card border border-brand-border p-4 rounded-xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Evolução de Nível</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-brand-text">{promotionsList.length}</span>
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              {promotionsList.length === 0 ? 'Nível inicial' : `${promotionsList.length} ${promotionsList.length === 1 ? 'promoção recebida' : 'promoções recebidas'}`}
            </p>
          </div>
        </motion.div>

        {/* Valor da Diária */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-brand-card border border-brand-border p-4 rounded-xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diária Atual</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-brand-text">R$ {employee.dailyRate}</span>
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              Festa: R$ {employee.partyRate}
            </p>
          </div>
        </motion.div>

        {/* Estimativa de Ganho Total */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-brand-card border border-brand-border p-4 rounded-xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total em Diárias</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Sparkles size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-brand-text">
              R$ {totalEarnings.toLocaleString('pt-BR')}
            </span>
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              Histórico acumulado
            </p>
          </div>
        </motion.div>
      </div>

      {/* Linha do Tempo da Jornada */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-black text-brand-text flex items-center gap-2">
            <Clock className="text-brand-primary" size={22} />
            Linha do Tempo da Jornada
          </h2>
          <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">Histórico de Atividades</span>
        </div>

        <div className="relative pl-6 md:pl-8 space-y-6 before:absolute before:left-2.5 md:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-border">
          {timelineEvents.map((item, idx) => {
            if (item.type === 'start') {
              return (
                <div key={`start-${idx}`} className="relative group">
                  <div className="absolute -left-6 md:-left-8 top-1.5 w-5 h-5 rounded-full bg-brand-primary border-4 border-brand-card shadow-lg flex items-center justify-center text-brand-bg font-bold text-[10px]" />
                  <div className="bg-brand-bg/50 border border-brand-border/80 rounded-xl p-4 transition-colors hover:border-brand-primary/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-extrabold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        Início na Liga Positiva
                      </span>
                      <span className="text-xs font-semibold text-brand-muted bg-brand-card px-2.5 py-0.5 rounded-md border border-brand-border">
                        {item.formattedDate}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-brand-text">
                      {employee.artisticName || employee.name} ingressou na equipe como <span className="text-brand-primary">{promotionsList.length > 0 ? promotionsList[0].previousLevel : employee.level}</span>!
                    </p>
                  </div>
                </div>
              );
            }

            if (item.type === 'promotion') {
              let promoFormattedDate = item.promo.date;
              try {
                promoFormattedDate = format(parseISO(item.promo.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
              } catch {
                promoFormattedDate = item.promo.date;
              }

              return (
                <div key={`promo-${item.promo.id || idx}`} className="relative group">
                  <div className="absolute -left-6 md:-left-8 top-1.5 w-5 h-5 rounded-full bg-emerald-400 border-4 border-brand-card shadow-lg flex items-center justify-center" />
                  <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-xl p-4 transition-colors hover:border-emerald-500/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={14} />
                        Subida de Nível (Promoção #{item.idx})
                      </span>
                      <span className="text-xs font-semibold text-gray-400 bg-brand-card px-2.5 py-0.5 rounded-md border border-brand-border">
                        {promoFormattedDate}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-brand-text">
                      Promovido(a) de <span className="text-gray-400 line-through">{item.promo.previousLevel}</span> para <span className="text-emerald-400 font-extrabold">{item.promo.newLevel}</span>!
                    </p>
                    <p className="text-xs font-medium text-gray-400 mt-1">
                      Novos valores: <strong className="text-brand-text">R$ {item.promo.newDailyRate}</strong> (CCSP) e <strong className="text-brand-text">R$ {item.promo.newPartyRate}</strong> (Festa).
                    </p>
                  </div>
                </div>
              );
            }

            if (item.type === 'monthly') {
              return (
                <div key={`monthly-${item.summary.monthKey}`} className="relative group">
                  <div className="absolute -left-6 md:-left-8 top-1.5 w-5 h-5 rounded-full bg-purple-500 border-4 border-brand-card shadow-lg flex items-center justify-center" />
                  <div className="bg-purple-500/[0.03] border border-purple-500/20 rounded-xl p-4 transition-colors hover:border-purple-500/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={14} />
                        Resumo de Atividades — {item.summary.monthLabel}
                      </span>
                      <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                        {item.summary.total} {item.summary.total === 1 ? 'diária' : 'diárias'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-brand-text">
                      Concluiu <span className="text-purple-400 font-black">{item.summary.total} {item.summary.total === 1 ? 'diária de trabalho' : 'diárias de trabalho'}</span> neste mês.
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-gray-400">
                      <span className="flex items-center gap-1 text-brand-primary">
                        <Award size={13} />
                        {item.summary.ccsp} {item.summary.ccsp === 1 ? 'diária CCSP' : 'diárias CCSP'}
                      </span>
                      {item.summary.party > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-pink-400">
                            <PartyPopper size={13} />
                            {item.summary.party} {item.summary.party === 1 ? 'festa' : 'festas'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </motion.div>

      <ImageCropperModal
        imageSrc={imageToCrop}
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
