import React, { useState } from 'react';
import { X, Download, Upload, ShieldCheck, FileJson, AlertTriangle, CheckCircle, RefreshCw, Database } from 'lucide-react';
import { Employee, DayConfig } from '../types';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  dayConfigs: Record<string, DayConfig>;
  deadlines?: Record<string, string>;
  onRestoreBackup: (restoredData: { employees: Employee[]; dayConfigs?: Record<string, DayConfig>; deadlines?: Record<string, string> }) => Promise<void>;
}

interface BackupPreviewData {
  backupDate: string;
  app: string;
  version: string;
  employees: Employee[];
  dayConfigs?: Record<string, DayConfig>;
  deadlines?: Record<string, string>;
  stats: {
    totalEmployees: number;
    totalWorkDays: number;
    totalAvailabilities: number;
  };
}

export default function AdvancedSettingsModal({
  isOpen,
  onClose,
  employees,
  dayConfigs,
  deadlines,
  onRestoreBackup
}: AdvancedSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<BackupPreviewData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen) return null;

  // Handle Backup Export
  const handleExportBackup = () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      let totalWorkDays = 0;
      let totalAvailabilities = 0;

      employees.forEach(emp => {
        if (emp.workDays) totalWorkDays += emp.workDays.length;
        if (emp.availabilities) totalAvailabilities += emp.availabilities.length;
      });

      const backupPayload = {
        app: "LP-Diarias",
        version: "1.0.0",
        backupDate: now.toISOString(),
        formattedDate: now.toLocaleString('pt-BR'),
        stats: {
          totalEmployees: employees.length,
          totalWorkDays,
          totalAvailabilities
        },
        employees,
        dayConfigs,
        deadlines
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `backup_lp_diarias_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert("Erro ao exportar o backup: " + (err.message || String(err)));
    }
  };

  // Handle File Upload and Preview Generation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParseError(null);
    setPreviewData(null);
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Basic validation
        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error("Arquivo JSON inválido.");
        }

        const restoredEmployees: Employee[] = parsed.employees || (Array.isArray(parsed) ? parsed : []);
        
        if (!Array.isArray(restoredEmployees)) {
          throw new Error("Formato de backup não reconhecido. A lista de funcionários é necessária.");
        }

        let totalWorkDays = 0;
        let totalAvailabilities = 0;

        restoredEmployees.forEach(emp => {
          if (emp.workDays) totalWorkDays += emp.workDays.length;
          if (emp.availabilities) totalAvailabilities += emp.availabilities.length;
        });

        setPreviewData({
          backupDate: parsed.backupDate || parsed.formattedDate || new Date().toISOString(),
          app: parsed.app || "LP-Diarias",
          version: parsed.version || "1.0",
          employees: restoredEmployees,
          dayConfigs: parsed.dayConfigs || {},
          deadlines: parsed.deadlines || {},
          stats: {
            totalEmployees: restoredEmployees.length,
            totalWorkDays,
            totalAvailabilities
          }
        });
      } catch (err: any) {
        setParseError(err.message || "Não foi possível ler este arquivo JSON.");
      }
    };

    reader.readAsText(file);
  };

  // Handle Restoration Confirmation
  const handleConfirmRestore = async () => {
    if (!previewData) return;
    setIsRestoring(true);
    try {
      await onRestoreBackup({
        employees: previewData.employees,
        dayConfigs: previewData.dayConfigs,
        deadlines: previewData.deadlines
      });
      onClose();
    } catch (err: any) {
      alert("Erro ao aplicar restauração: " + (err.message || String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8 p-6 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-brand-text uppercase tracking-wider">
                Configurações Avançadas & Backup
              </h2>
              <p className="text-xs text-gray-400">
                Gerencie cópias de segurança e restauração de dados do sistema
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-slate-800/80 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-brand-border/60">
          <button
            onClick={() => { setActiveTab('export'); setPreviewData(null); setParseError(null); }}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-gray-400 hover:bg-slate-800/50'
            }`}
          >
            <Download size={15} />
            <span>Exportar Backup (JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'import'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-gray-400 hover:bg-slate-800/50'
            }`}
          >
            <Upload size={15} />
            <span>Importar / Restaurar Dados</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="py-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-brand-text">Backup Seguro do Sistema</div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      O arquivo gerado contém o cadastro completo de todos os funcionários, chave PIX, diárias agendadas, disponibilidades, histórico de fotos e prazos de encerramento do app.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="block text-lg font-black text-cyan-400">{employees.length}</span>
                    <span className="text-[10px] text-gray-400 font-medium">Funcionários</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="block text-lg font-black text-amber-400">
                      {employees.reduce((acc, e) => acc + (e.workDays?.length || 0), 0)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">Escalas Registradas</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="block text-lg font-black text-brand-party">
                      {employees.reduce((acc, e) => acc + (e.availabilities?.length || 0), 0)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">Disponividades</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleExportBackup}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all"
              >
                <Download size={16} />
                <span>Gerar e Baixar Cópia de Segurança (.json)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                <div className="text-xs font-bold text-brand-text flex items-center gap-2">
                  <FileJson size={16} className="text-amber-400" />
                  <span>Selecione o arquivo de Backup em seu computador</span>
                </div>
                <input 
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                />
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Visual Preview Dashboard */}
              {previewData && (
                <div className="space-y-3 border-t border-brand-border/60 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-brand-text flex items-center gap-1.5">
                      <CheckCircle size={15} className="text-emerald-400" />
                      Prévia do Arquivo de Backup
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      Data: {new Date(previewData.backupDate).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60">
                      <span className="block text-base font-black text-cyan-300">
                        {previewData.stats.totalEmployees}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Recreadores</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60">
                      <span className="block text-base font-black text-amber-300">
                        {previewData.stats.totalWorkDays}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Diárias/Escalas</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60">
                      <span className="block text-base font-black text-brand-party">
                        {previewData.stats.totalAvailabilities}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Disponibilidades</span>
                    </div>
                  </div>

                  {/* Sample List of Employees in Backup */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    <span className="text-[11px] font-bold text-gray-400">Recreadores Identificados no Backup:</span>
                    {previewData.employees.map((emp, idx) => (
                      <div key={emp.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-brand-bg/60 border border-brand-border/50 text-xs">
                        <span className="font-bold text-brand-text">{emp.artisticName || emp.name}</span>
                        <span className="text-[10px] text-gray-400">
                          {emp.workDays?.length || 0} diárias • PIX: {emp.pixKey || 'Não inf.'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      Atenção: A restauração substituirá os registros atuais do banco de dados pelos dados contidos nesta prévia.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setPreviewData(null)}
                      disabled={isRestoring}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-slate-800 transition-colors"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={handleConfirmRestore}
                      disabled={isRestoring}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Restaurando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} />
                          <span>Confirmar e Sobrescrever Banco de Dados</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
