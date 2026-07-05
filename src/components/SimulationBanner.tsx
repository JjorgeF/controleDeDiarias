import React from 'react';
import { Eye, Users, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';
import { Employee } from '../types';

interface SimulationBannerProps {
  employees: Employee[];
  simulationActive: boolean;
  setSimulationActive: (active: boolean) => void;
  simulatedEmployeeId: string;
  setSimulatedEmployeeId: (id: string) => void;
  realUserEmail: string | null;
}

export default function SimulationBanner({
  employees,
  simulationActive,
  setSimulationActive,
  simulatedEmployeeId,
  setSimulatedEmployeeId,
  realUserEmail,
}: SimulationBannerProps) {
  const currentSimulatedEmployee = employees.find(emp => emp.id === simulatedEmployeeId);

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-sm sticky top-0 z-50 py-2.5 px-3 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left section: Mode status */}
        <div className="flex items-center gap-2.5">
          <div className="bg-amber-500 text-slate-950 p-1.5 rounded-lg">
            <Eye size={16} className="animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">
              Ambiente de Testes / Simulação
            </p>
            <p className="text-[11px] text-gray-400">
              Usuário Real: <span className="font-semibold text-white/95">{realUserEmail}</span> (Admin)
            </p>
          </div>
        </div>

        {/* Center section: Controls */}
        <div className="flex flex-wrap items-center gap-2.5 bg-brand-bg/60 border border-brand-border px-3 py-1.5 rounded-xl">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-400">Ver como:</span>
            <button
              id="sim-role-admin"
              onClick={() => {
                setSimulationActive(false);
              }}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                !simulationActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              👑 Administrador
            </button>
            <button
              id="sim-role-employee"
              onClick={() => {
                setSimulationActive(true);
                // Se não tiver nenhum selecionado, seleciona o primeiro se existir
                if (!simulatedEmployeeId && employees.length > 0) {
                  setSimulatedEmployeeId(employees[0].id);
                }
              }}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                simulationActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              👤 Funcionário
            </button>
          </div>

          {simulationActive && (
            <div className="flex items-center gap-1.5 pl-2.5 border-l border-brand-border">
              <span className="text-xs font-medium text-gray-400">Perfil:</span>
              <select
                id="sim-employee-select"
                value={simulatedEmployeeId}
                onChange={(e) => setSimulatedEmployeeId(e.target.value)}
                className="bg-brand-card text-xs text-white border border-brand-border rounded-md px-2 py-1 focus:outline-none focus:border-amber-500 max-w-[180px] sm:max-w-[240px] truncate"
              >
                <option value="">[Sem Vínculo / Novo]</option>
                {employees
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.artisticName ? `(${emp.artisticName})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Right section: Informational helper */}
        <div className="hidden lg:flex items-center gap-2 text-right">
          <ShieldAlert size={14} className="text-amber-500/80" />
          <span className="text-[10px] text-amber-500/80 max-w-xs font-medium leading-tight">
            As ações de escrita usam sua credencial de Admin real. Mudanças feitas na simulação salvarão no Firestore.
          </span>
        </div>
      </div>
    </div>
  );
}
