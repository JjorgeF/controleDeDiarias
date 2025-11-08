import React, { useMemo } from 'react';
import { Employee, ViewMode, WorkDay, WorkDayType } from '../types';
import { 
    ChevronLeftIcon, ChevronRightIcon, PencilIcon, TrashIcon, 
    ChevronDownIcon, CalendarDaysIcon, DocumentArrowDownIcon 
} from './icones';

interface EmployeeItemProps {
    employee: Employee;
    viewMode: ViewMode;
    isExpanded: boolean;
    displayDate: Date;
    onToggleDetails: (id: string) => void;
    onNavigateMonth: (id: string, direction: 'prev' | 'next') => void;
    onAddWorkDay: (employee: Employee, date: Date) => void;
    onEdit: (employee: Employee) => void;
    onDelete: (employee: Employee) => void;
    onDeleteWorkDay: (employeeId: string, workDayId: string) => void;
    onExport: (employee: Employee, date: Date) => void;
}

const EmployeeItem: React.FC<EmployeeItemProps> = ({
    employee, viewMode, isExpanded, displayDate, onToggleDetails, onNavigateMonth, 
    onAddWorkDay, onEdit, onDelete, onDeleteWorkDay, onExport
}) => {
    
    const { monthlyWorkDays, monthlyTotal } = useMemo(() => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const monthlyWorkDays = employee.workDays.filter(day => {
            const dayDate = new Date(day.date + 'T00:00:00');
            return dayDate.getFullYear() === year && dayDate.getMonth() === month;
        });
        const monthlyTotal = monthlyWorkDays.reduce((sum, day) => sum + day.value, 0);
        return { monthlyWorkDays, monthlyTotal };
    }, [employee.workDays, displayDate]);

    const displayMonthYear = displayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedDisplayMonthYear = displayMonthYear.charAt(0).toUpperCase() + displayMonthYear.slice(1);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
    };

    const cardView = (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden flex flex-col transition-shadow duration-300 hover:shadow-xl dark:shadow-slate-900/50">
            <div className="p-5 flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-brand-primary font-semibold uppercase tracking-wider">{employee.artisticName}</p>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{employee.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{employee.level}</p>
                    </div>
                    <div className="flex space-x-1">
                         <button onClick={() => onEdit(employee)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 dark:hover:text-blue-400 rounded-full transition-colors"><PencilIcon /></button>
                         <button onClick={() => onDelete(employee)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-slate-700 dark:hover:text-red-400 rounded-full transition-colors"><TrashIcon /></button>
                    </div>
                </div>
                <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4 text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Diária Comum:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(employee.dailyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Diária Festa:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(employee.partyRate)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Hora Extra:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(employee.extraHourRate)}</span>
                    </div>
                </div>
            </div>
            {renderMonthlyControls()}
            {renderDetailsSection()}
        </div>
    );

    const listView = (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md mb-3 transition-shadow duration-300 hover:shadow-xl dark:shadow-slate-900/50">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 mb-4 sm:mb-0">
                    <div className="flex items-center">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{employee.name}</h3>
                        <span className="ml-3 px-2 py-0.5 text-xs font-semibold text-brand-primary bg-brand-light dark:bg-brand-primary/20 rounded-full">{employee.artisticName}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{employee.level}</p>
                </div>
                <div className="flex-shrink-0 flex items-center space-x-2">
                    {renderMonthlyControls(true)}
                    <button onClick={() => onAddWorkDay(employee, displayDate)} className="px-3 py-2 text-sm font-semibold text-white bg-brand-primary hover:opacity-90 rounded-md flex items-center space-x-1.5"><CalendarDaysIcon className="h-4 w-4" /><span>Adicionar Dia</span></button>
                    <button onClick={() => onToggleDetails(employee.id)} className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDownIcon className="h-5 w-5 text-slate-500 dark:text-slate-400"/></button>
                    <button onClick={() => onEdit(employee)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 dark:hover:text-blue-400 rounded-full transition-colors"><PencilIcon /></button>
                    <button onClick={() => onDelete(employee)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-slate-700 dark:hover:text-red-400 rounded-full transition-colors"><TrashIcon /></button>
                    <button onClick={() => onExport(employee, displayDate)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-100 dark:hover:bg-slate-700 dark:hover:text-green-400 rounded-full transition-colors"><DocumentArrowDownIcon /></button>
                </div>
            </div>
            {renderDetailsSection()}
        </div>
    );
    
    function renderMonthlyControls(isList = false) {
        return (
            <div className={`bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 ${isList ? 'px-4' : 'px-5 py-4'}`}>
                <div className="flex items-center justify-between">
                    <button onClick={() => onNavigateMonth(employee.id, 'prev')} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"><ChevronLeftIcon className="h-5 w-5"/></button>
                    <span className="font-semibold text-sm text-center text-slate-700 dark:text-slate-300 w-32">{formattedDisplayMonthYear}</span>
                    <button onClick={() => onNavigateMonth(employee.id, 'next')} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"><ChevronRightIcon className="h-5 w-5"/></button>
                </div>
                <div className="mt-3 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {monthlyWorkDays.length} {monthlyWorkDays.length === 1 ? 'dia trabalhado' : 'dias trabalhados'}
                    </p>
                    <p className="text-lg font-bold text-brand-primary">{formatCurrency(monthlyTotal)}</p>
                </div>
                 { !isList && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <button onClick={() => onAddWorkDay(employee, displayDate)} className="col-span-2 px-3 py-2 text-sm font-semibold text-white bg-brand-primary hover:opacity-90 rounded-md flex items-center justify-center space-x-1.5"><CalendarDaysIcon className="h-4 w-4" /><span>Adicionar Dia</span></button>
                        <button onClick={() => onToggleDetails(employee.id)} className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md flex items-center justify-center space-x-1.5">
                           <span>Detalhes</span> <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                 )}
            </div>
        );
    }
    
    function renderDetailsSection() {
        if (!isExpanded) return null;
    
        return (
            <div className="animate-slide-down bg-slate-100 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Detalhes de {formattedDisplayMonthYear}</h4>
                    {viewMode === 'card' && (
                        <button onClick={() => onExport(employee, displayDate)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-100 dark:hover:bg-slate-700 dark:hover:text-green-400 rounded-full transition-colors"><DocumentArrowDownIcon /></button>
                    )}
                </div>
                {monthlyWorkDays.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-200 dark:bg-slate-700">
                                <tr>
                                    <th scope="col" className="px-4 py-2">Data</th>
                                    <th scope="col" className="px-4 py-2">Tipo</th>
                                    <th scope="col" className="px-4 py-2 text-center">H. Extras</th>
                                    <th scope="col" className="px-4 py-2">Valor</th>
                                    <th scope="col" className="px-4 py-2 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyWorkDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((day) => (
                                    <tr key={day.id} className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{formatDate(day.date)}</td>
                                        <td className="px-4 py-2">{day.type}</td>
                                        <td className="px-4 py-2 text-center">{day.extraHours || 0}</td>
                                        <td className="px-4 py-2">{formatCurrency(day.value)}</td>
                                        <td className="px-4 py-2 text-right">
                                            <button onClick={() => onDeleteWorkDay(employee.id, day.id)} className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"><TrashIcon className="h-4 w-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">Nenhum dia de trabalho registrado para este mês.</p>
                )}
            </div>
        );
    }

    return viewMode === 'card' ? cardView : listView;
};

export default EmployeeItem;