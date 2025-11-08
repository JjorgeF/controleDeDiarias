import React, { useState, useEffect } from 'react';
import { Employee, Nivel } from '../types';
import { XMarkIcon } from './icons';

interface EmployeeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (employee: Omit<Employee, 'id' | 'workDays'> & { id?: string }) => void;
    employeeToEdit: Employee | null;
}

const initialFormState = {
    name: '',
    artisticName: '',
    // FIX: Changed Nivel.INICIANTE to Nivel.TRAINEE as INICIANTE does not exist in the Nivel enum.
    level: Nivel.TRAINEE,
    dailyRate: 0,
    partyRate: 0,
    extraHourRate: 0,
};

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ isOpen, onClose, onSave, employeeToEdit }) => {
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (employeeToEdit) {
            setFormData({
                name: employeeToEdit.name,
                artisticName: employeeToEdit.artisticName,
                level: employeeToEdit.level,
                dailyRate: employeeToEdit.dailyRate,
                partyRate: employeeToEdit.partyRate,
                extraHourRate: employeeToEdit.extraHourRate,
            });
        } else {
            setFormData(initialFormState);
        }
    }, [employeeToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['dailyRate', 'partyRate', 'extraHourRate'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumeric ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, id: employeeToEdit?.id });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 sm:p-8 transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{employeeToEdit ? 'Editar Funcionário' : 'Adicionar Funcionário'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><XMarkIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" />
                    </div>
                    <div>
                        <label htmlFor="artisticName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome Artístico</label>
                        <input type="text" name="artisticName" id="artisticName" value={formData.artisticName} onChange={handleChange} required className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" />
                    </div>
                    <div>
                        <label htmlFor="level" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nível</label>
                        <select name="level" id="level" value={formData.level} onChange={handleChange} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200">
                            {Object.values(Nivel).map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="dailyRate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Valor da Diária (R$)</label>
                            <input type="number" name="dailyRate" id="dailyRate" value={formData.dailyRate} onChange={handleChange} min="0" step="0.01" required className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" />
                        </div>
                        <div>
                            <label htmlFor="partyRate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Diária de Festa (R$)</label>
                            <input type="number" name="partyRate" id="partyRate" value={formData.partyRate} onChange={handleChange} min="0" step="0.01" required className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="extraHourRate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Valor da Hora Extra (R$)</label>
                        <input type="number" name="extraHourRate" id="extraHourRate" value={formData.extraHourRate} onChange={handleChange} min="0" step="0.01" required className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" />
                    </div>
                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400">Cancelar</button>
                        <button type="submit" className="bg-brand-primary border border-transparent rounded-md shadow-sm py-2 px-4 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary/50">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmployeeFormModal;