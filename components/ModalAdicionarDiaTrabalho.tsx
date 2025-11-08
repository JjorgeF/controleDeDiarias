import React, { useState, useEffect, useMemo } from 'react';
import { Employee, WorkDayType } from '../types';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from './icones';

type Selection = { type: WorkDayType; extraHours: number };

interface AddWorkDayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (employeeId: string, monthSelections: { [date: string]: Selection }, editedMonth: Date) => void;
    employee: Employee | null;
    initialDate: Date | null;
}

const AddWorkDayModal: React.FC<AddWorkDayModalProps> = ({ isOpen, onClose, onSave, employee, initialDate }) => {
    
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState<{ [date: string]: Selection }>({});
    const [activeDay, setActiveDay] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const date = initialDate || new Date();
            date.setDate(1);
            setCurrentMonth(date);
            setActiveDay(null);
        }
    }, [isOpen, initialDate]);

    useEffect(() => {
        if (isOpen && employee) {
            const month = currentMonth.getMonth();
            const year = currentMonth.getFullYear();

            const monthWorkDays = employee.workDays.filter(wd => {
                const d = new Date(wd.date + 'T00:00:00');
                return d.getMonth() === month && d.getFullYear() === year;
            });

            const initialSelectedDays = monthWorkDays.reduce((acc, day) => {
                acc[day.date] = { type: day.type, extraHours: day.extraHours || 0 };
                return acc;
            }, {} as { [date: string]: Selection });

            setSelectedDays(initialSelectedDays);
        }
    }, [isOpen, currentMonth, employee]);
    
    const calendarData = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const placeholders = Array.from({ length: firstDayOfMonth }, (_, i) => null);
        
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        return { year, month, days, placeholders, weekDays };
    }, [currentMonth]);
    
    const handleDateClick = (day: number) => {
        const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const newSelectedDays = { ...selectedDays };
        const currentSelection = newSelectedDays[dateStr];

        if (!currentSelection) {
            newSelectedDays[dateStr] = { type: WorkDayType.COMUM, extraHours: 0 };
            setActiveDay(dateStr);
        } else if (currentSelection.type === WorkDayType.COMUM) {
            newSelectedDays[dateStr] = { ...currentSelection, type: WorkDayType.FESTA };
             setActiveDay(dateStr);
        } else {
            delete newSelectedDays[dateStr];
            if (activeDay === dateStr) {
                setActiveDay(null);
            }
        }
        setSelectedDays(newSelectedDays);
    };

    const handleExtraHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeDay) return;
        const hours = parseInt(e.target.value, 10) || 0;
        setSelectedDays(prev => ({
            ...prev,
            [activeDay]: { ...prev[activeDay], extraHours: hours >= 0 ? hours : 0 }
        }));
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setActiveDay(null);
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1));
            return newDate;
        });
    };

    if (!isOpen || !employee) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(employee.id, selectedDays, currentMonth);
    };

    const formattedMonthYear = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 sm:p-8" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gerenciar Dias de Trabalho</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><XMarkIcon /></button>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-4">Para: <span className="font-semibold text-slate-800 dark:text-slate-100">{employee.name}</span></p>
                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col md:flex-row md:space-x-6">
                        <div className="w-full md:w-72">
                            <div className="flex items-center justify-between mb-2">
                                <button type="button" onClick={() => navigateMonth('prev')} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"><ChevronLeftIcon className="h-5 w-5"/></button>
                                <h3 className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{formattedMonthYear}</h3>
                                <button type="button" onClick={() => navigateMonth('next')} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"><ChevronRightIcon className="h-5 w-5"/></button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                                {calendarData.weekDays.map(day => <div key={day} className="font-medium text-slate-500 dark:text-slate-400 text-xs">{day}</div>)}
                                {calendarData.placeholders.map((_, index) => <div key={`ph-${index}`}></div>)}
                                {calendarData.days.map(day => {
                                    const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const selection = selectedDays[dateStr];
                                    const isComum = selection?.type === WorkDayType.COMUM;
                                    const isFesta = selection?.type === WorkDayType.FESTA;
                                    
                                    return (
                                        <button 
                                            type="button" 
                                            key={day} 
                                            onClick={() => handleDateClick(day)}
                                            className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 font-medium border-2 ${
                                                activeDay === dateStr ? 'border-brand-primary' : 'border-transparent'
                                            } ${
                                                isComum 
                                                    ? 'bg-brand-primary text-white' 
                                                    : isFesta
                                                    ? 'bg-purple-600 text-white'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {day}
                                            {selection?.extraHours > 0 && <ClockIcon className="absolute top-0 right-0 h-3 w-3 text-white bg-blue-500 rounded-full p-0.5" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="flex-1 mt-4 md:mt-0">
                            {activeDay && selectedDays[activeDay] ? (
                                <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-md h-full animate-fade-in">
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                                        Editar Dia <span className="font-bold">{new Date(activeDay + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                    </h4>
                                    <div>
                                        <label htmlFor="extraHours" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Horas Extras</label>
                                        <input 
                                            type="number" 
                                            id="extraHours" 
                                            value={selectedDays[activeDay]?.extraHours || 0}
                                            onChange={handleExtraHoursChange}
                                            min="0"
                                            className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" 
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Valor Hora: {employee.extraHourRate.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-700/50 p-4 rounded-md h-full text-center">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Selecione um dia no calendário para editar.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-4 text-sm">
                        <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-brand-primary mr-2"></span><span className="text-slate-600 dark:text-slate-400">Dia Comum</span></div>
                        <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-purple-600 mr-2"></span><span className="text-slate-600 dark:text-slate-400">Dia de Festa</span></div>
                        <div className="flex items-center"><ClockIcon className="h-4 w-4 text-blue-500 mr-1.5" /><span className="text-slate-600 dark:text-slate-400">Com Hora Extra</span></div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400">Cancelar</button>
                        <button type="submit" className="bg-brand-primary border border-transparent rounded-md shadow-sm py-2 px-4 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary/50">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddWorkDayModal;