import React from 'react';
import { X, AlertCircle, Trash2, ArrowRight, Calendar } from 'lucide-react';
import { Employee, EmployeeLevel } from '../types';
import { recalculateEmployeeTimeline, LEVEL_RATES } from '../utils/promotionUtils';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Partial<Employee>) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (id: string) => void;
  employee?: Employee;
}

const LEVELS: EmployeeLevel[] = ['Trainee', 'Aprendiz', 'Coordenador(a)', 'Recreador(a)', 'Recreador(a) Experiente', 'Motorista'];

export default function EmployeeModal({ isOpen, onClose, onSave, onDelete, employee }: EmployeeModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<Employee>>({
    name: '',
    artisticName: '',
    level: 'Trainee',
    dailyRate: 70,
    partyRate: 70,
    extraHourRate: 0,
    workDays: [],
    email: '',
  });

  React.useEffect(() => {
    setIsDeleting(false);
    setError(null);
    if (employee) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      setFormData({
        ...employee,
        promotionEffectiveDate: employee.promotionEffectiveDate || todayStr
      });
    } else {
      setFormData({
        name: '',
        artisticName: '',
        level: 'Trainee',
        dailyRate: 70,
        partyRate: 70,
        extraHourRate: 0,
        workDays: [],
        email: '',
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

  const handleDeletePromotion = (promoId: string) => {
    const currentPromos = formData.promotions || [];
    const updated = currentPromos.filter(p => p.id !== promoId);
    const recalculated = recalculateEmployeeTimeline(formData, updated);

    setFormData(prev => ({
      ...prev,
      promotions: recalculated.promotions,
      level: recalculated.level,
      dailyRate: recalculated.dailyRate,
      partyRate: recalculated.partyRate,
      workDays: recalculated.workDays
    }));
  };

  const handleUpdatePromotionDate = (promoId: string, newDate: string) => {
    const currentPromos = formData.promotions || [];
    const updated = currentPromos.map(p => p.id === promoId ? { ...p, date: newDate } : p);
    const recalculated = recalculateEmployeeTimeline(formData, updated);

    setFormData(prev => ({
      ...prev,
      promotions: recalculated.promotions,
      level: recalculated.level,
      dailyRate: recalculated.dailyRate,
      partyRate: recalculated.partyRate,
      workDays: recalculated.workDays
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await onSave(formData);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Ocorreu um erro ao salvar.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-brand-border shrink-0">
          <h2 className="text-xl font-bold text-white">
            {employee ? 'Editar Funcionário' : 'Adicionar Funcionário'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="text-red-500 shrink-0" size={18} />
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nome Artístico</label>
            <input
              type="text"
              value={formData.artisticName}
              onChange={(e) => setFormData({ ...formData, artisticName: e.target.value })}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">E-mail de Acesso</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com (opcional)"
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nível</label>
            <select
              value={formData.level}
              onChange={(e) => {
                const selectedLevel = e.target.value as EmployeeLevel;
                const rates = LEVEL_RATES[selectedLevel] || { daily: 0, party: 0 };
                setFormData({ 
                  ...formData, 
                  level: selectedLevel,
                  dailyRate: rates.daily,
                  partyRate: rates.party
                });
              }}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Valor da Diária CCSP (R$)</label>
              <input
                type="number"
                readOnly
                value={formData.dailyRate}
                className="w-full bg-brand-bg/60 border border-brand-border/60 rounded-lg py-2 px-4 text-gray-400 focus:outline-none cursor-not-allowed font-semibold"
                title="Valor fixo definido pelo nível selecionado"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Diária de Festa (R$)</label>
              <input
                type="number"
                readOnly
                value={formData.partyRate}
                className="w-full bg-brand-bg/60 border border-brand-border/60 rounded-lg py-2 px-4 text-gray-400 focus:outline-none cursor-not-allowed font-semibold"
                title="Valor fixo definido pelo nível selecionado"
              />
            </div>
          </div>
          <p className="text-[10px] text-brand-muted font-bold -mt-2">
            * Os valores de diária e festa são fixos de acordo com o nível selecionado.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Valor da Hora Extra (R$)</label>
            <input
              type="number"
              value={formData.extraHourRate}
              onChange={(e) => setFormData({ ...formData, extraHourRate: Number(e.target.value) })}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
            />
          </div>

          {employee && (
            <div className="space-y-3 pt-2">
              {/* If level changed in dropdown from current employee level */}
              {formData.level !== employee.level && (
                <div className="bg-yellow-500/[0.05] border border-yellow-500/30 rounded-xl p-3.5 space-y-2">
                  <label className="block text-xs font-bold text-yellow-500 uppercase tracking-wider">
                    Vigência da Promoção ({formData.level}) 📅
                  </label>
                  <input
                    type="date"
                    value={formData.promotionEffectiveDate || ''}
                    onChange={(e) => setFormData({ ...formData, promotionEffectiveDate: e.target.value })}
                    className="w-full bg-brand-bg border border-yellow-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-yellow-500 text-sm font-semibold"
                  />
                  <p className="text-[10px] text-gray-400 leading-normal">
                    Indique a partir de qual data o novo nível ({formData.level}) passa a vigorar. O sistema atualizará os dias agendados a partir dessa data.
                  </p>
                </div>
              )}

              {/* Promotion history list */}
              {formData.promotions && formData.promotions.length > 0 && (
                <div className="bg-brand-bg/50 border border-brand-border/60 rounded-xl p-3.5 space-y-2.5">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-brand-primary" />
                    Histórico de Promoções ({formData.promotions.length})
                  </label>
                  <p className="text-[11px] text-gray-400 leading-normal">
                    Altere a data de vigência de uma promoção ou clique na lixeira para excluí-la/revertê-la.
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {formData.promotions.map((promo) => (
                      <div
                        key={promo.id}
                        className="bg-brand-card border border-brand-border rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium text-gray-400">{promo.previousLevel}</span>
                          <ArrowRight size={12} className="text-yellow-500 shrink-0" />
                          <span className="font-bold text-yellow-400">{promo.newLevel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={promo.date}
                            onChange={(e) => handleUpdatePromotionDate(promo.id, e.target.value)}
                            className="bg-brand-bg border border-brand-border rounded py-1 px-2 text-xs text-white focus:outline-none focus:border-brand-primary font-mono"
                            title="Alterar data de vigência desta promoção"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeletePromotion(promo.id)}
                            title="Excluir/Cancelar esta promoção"
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold py-3 rounded-lg transition-colors"
              >
                Salvar
              </button>
            </div>
            
            {employee && onDelete && (
              <button
                type="button"
                onClick={async () => {
                  if (!isDeleting) {
                    setIsDeleting(true);
                    // Reset after 3 seconds if not clicked again
                    setTimeout(() => setIsDeleting(false), 3000);
                    return;
                  }
                  
                  console.log("EmployeeModal: Confirmed delete for employee:", employee.id);
                  try {
                    await onDelete(employee.id);
                    onClose();
                  } catch (err) {
                    console.error("EmployeeModal: Error during onDelete:", err);
                    setIsDeleting(false);
                  }
                }}
                className={`w-full text-xs font-bold py-2 rounded-lg transition-all border ${
                  isDeleting 
                    ? "bg-red-600 text-white border-red-700 animate-pulse" 
                    : "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20"
                }`}
              >
                {isDeleting ? "CLIQUE NOVAMENTE PARA CONFIRMAR EXCLUSÃO" : "Excluir Funcionário"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
