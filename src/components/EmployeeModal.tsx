import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Employee, EmployeeLevel } from '../types';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Partial<Employee>) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (id: string) => void;
  employee?: Employee;
}

const LEVELS: EmployeeLevel[] = ['Trainee', 'Aprendiz', 'Coordenador(a)', 'Recreador(a)', 'Recreador(a) Experiente'];

export default function EmployeeModal({ isOpen, onClose, onSave, onDelete, employee }: EmployeeModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<Employee>>({
    name: '',
    artisticName: '',
    level: 'Trainee',
    dailyRate: 0,
    partyRate: 0,
    extraHourRate: 0,
    workDays: [],
    email: '',
  });

  React.useEffect(() => {
    setIsDeleting(false);
    setError(null);
    if (employee) {
      setFormData(employee);
    } else {
      setFormData({
        name: '',
        artisticName: '',
        level: 'Trainee',
        dailyRate: 0,
        partyRate: 0,
        extraHourRate: 0,
        workDays: [],
        email: '',
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

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
      <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold text-white">
            {employee ? 'Editar Funcionário' : 'Adicionar Funcionário'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              onChange={(e) => setFormData({ ...formData, level: e.target.value as EmployeeLevel })}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Valor da Diária (R$)</label>
              <input
                type="number"
                value={formData.dailyRate}
                onChange={(e) => setFormData({ ...formData, dailyRate: Number(e.target.value) })}
                className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Diária de Festa (R$)</label>
              <input
                type="number"
                value={formData.partyRate}
                onChange={(e) => setFormData({ ...formData, partyRate: Number(e.target.value) })}
                className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Valor da Hora Extra (R$)</label>
            <input
              type="number"
              value={formData.extraHourRate}
              onChange={(e) => setFormData({ ...formData, extraHourRate: Number(e.target.value) })}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
            />
          </div>

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
