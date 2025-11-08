
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebaseConfig';
import { 
    collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Employee, ViewMode, WorkDay, WorkDayType, Nivel } from './types';

import Header from './components/Header';
import Auth from './components/Auth';
import EmptyState from './components/EmptyState';
import EmployeeItem from './components/EmployeeItem';
import EmployeeFormModal from './components/EmployeeFormModal';
import AddWorkDayModal from './components/AddWorkDayModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { MagnifyingGlassIcon, ArrowsUpDownIcon } from './components/icons';

declare var XLSX: any;

const App: React.FC = () => {
    // Auth & Loading
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Core Data
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    // UI State
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            const storedTheme = window.localStorage.getItem('theme');
            if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        }
        return 'light';
    });
    const [viewMode, setViewMode] = useState<ViewMode>('card');
    const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
    const [displayDates, setDisplayDates] = useState<Record<string, Date>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<'name' | 'artisticName' | 'level'>('name');

    // Modal State
    const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
    const [isAddWorkDayModalOpen, setIsAddWorkDayModalOpen] = useState(false);
    const [employeeForWorkDay, setEmployeeForWorkDay] = useState<Employee | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

    // Theme effect
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    // Auth effect
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, currentUser => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Firestore data effect
    useEffect(() => {
        if (!user) {
            setEmployees([]);
            return;
        }
        const employeesCollectionRef = collection(db, 'users', user.uid, 'employees');
        const unsubscribe = onSnapshot(employeesCollectionRef, snapshot => {
            const fetchedEmployees: Employee[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<Employee, 'id'>)
            }));
            setEmployees(fetchedEmployees);
            setDisplayDates(prev => {
                const newDates = { ...prev };
                fetchedEmployees.forEach(emp => {
                    if (!newDates[emp.id]) newDates[emp.id] = new Date();
                });
                return newDates;
            });
        });
        return unsubscribe;
    }, [user]);

    // Handlers
    const handleLogout = () => signOut(auth);
    const handleToggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    
    // Employee CRUD
    const handleOpenEmployeeForm = (employee: Employee | null = null) => {
        setEmployeeToEdit(employee);
        setIsEmployeeFormOpen(true);
    };

    const handleSaveEmployee = async (employeeData: Omit<Employee, 'id' | 'workDays'> & { id?: string }) => {
        if (!user) return;
        const { id, ...data } = employeeData;
        const collectionRef = collection(db, 'users', user.uid, 'employees');
        try {
            if (id) {
                await updateDoc(doc(collectionRef, id), data);
            } else {
                await addDoc(collectionRef, { ...data, workDays: [] });
            }
            setIsEmployeeFormOpen(false);
        } catch (error) {
            console.error("Error saving employee: ", error);
        }
    };
    
    const handleOpenDeleteModal = (employee: Employee) => {
        setEmployeeToDelete(employee);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!user || !employeeToDelete) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'employees', employeeToDelete.id));
            setIsDeleteModalOpen(false);
            setEmployeeToDelete(null);
        } catch (error) {
            console.error("Error deleting employee: ", error);
        }
    };

    // WorkDay Management
    const handleOpenAddWorkDay = (employee: Employee, date: Date) => {
        setEmployeeForWorkDay(employee);
        setIsAddWorkDayModalOpen(true);
    };

    const handleSaveWorkDays = async (employeeId: string, monthSelections: { [date: string]: { type: WorkDayType, extraHours: number } }, editedMonth: Date) => {
        if (!user) return;
        const employeeRef = doc(db, 'users', user.uid, 'employees', employeeId);
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return;

        const year = editedMonth.getFullYear();
        const month = editedMonth.getMonth();

        const otherMonthWorkDays = employee.workDays.filter(wd => {
            const d = new Date(wd.date + 'T00:00:00');
            return d.getFullYear() !== year || d.getMonth() !== month;
        });

        const newMonthWorkDays: WorkDay[] = Object.entries(monthSelections).map(([date, selection]) => {
            const baseValue = selection.type === WorkDayType.COMUM ? employee.dailyRate : employee.partyRate;
            const extraValue = (selection.extraHours || 0) * employee.extraHourRate;
            return {
                id: date, 
                date,
                type: selection.type,
                extraHours: selection.extraHours,
                value: baseValue + extraValue
            };
        });

        try {
            await updateDoc(employeeRef, { workDays: [...otherMonthWorkDays, ...newMonthWorkDays] });
            setIsAddWorkDayModalOpen(false);
        } catch (error) {
            console.error("Error saving work days: ", error);
        }
    };
    
    const handleDeleteWorkDay = async (employeeId: string, workDayId: string) => {
         if (!user) return;
        const employeeRef = doc(db, 'users', user.uid, 'employees', employeeId);
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return;
        
        const updatedWorkDays = employee.workDays.filter(wd => wd.id !== workDayId);
        await updateDoc(employeeRef, { workDays: updatedWorkDays });
    };

    // UI Interaction Handlers
    const handleToggleDetails = (id: string) => setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
    const handleNavigateMonth = (id: string, direction: 'prev' | 'next') => {
        setDisplayDates(prev => {
            const currentDate = prev[id] || new Date();
            const newDate = new Date(currentDate);
            newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
            return { ...prev, [id]: newDate };
        });
    };
    
    const handleExport = (employee: Employee, date: Date) => {
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthWorkDays = employee.workDays.filter(day => {
            const dayDate = new Date(day.date + 'T00:00:00');
            return dayDate.getFullYear() === year && dayDate.getMonth() === month;
        });

        // FIX: Explicitly type dataToExport to allow for mixed types in the total row.
        const dataToExport: Array<Record<string, string | number>> = monthWorkDays.map(day => ({
            'Data': new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR'),
            'Tipo': day.type,
            'Horas Extras': day.extraHours || 0,
            'Valor': day.value
        }));
        
        const total = monthWorkDays.reduce((sum, day) => sum + day.value, 0);
        dataToExport.push({ 'Data': 'TOTAL', 'Tipo': '', 'Horas Extras': '', 'Valor': total });
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Diarias");
        XLSX.writeFile(workbook, `${employee.name}_${date.toLocaleString('pt-BR', {month: 'long', year: 'numeric'})}.xlsx`);
    };

    const filteredAndSortedEmployees = useMemo(() => {
        return employees
            .filter(emp => 
                emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                emp.artisticName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
    }, [employees, searchTerm, sortKey]);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-primary"></div></div>;
    }

    if (!user) {
        return (
             <div className={`${theme === 'dark' ? 'dark' : ''}`}>
                <div className="bg-slate-100 dark:bg-slate-900">
                    <Auth />
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen">
            <Header 
                employeeCount={employees.length}
                viewMode={viewMode}
                theme={theme}
                user={user}
                onAddEmployee={() => handleOpenEmployeeForm()}
                onSetViewMode={setViewMode}
                onToggleTheme={handleToggleTheme}
                onLogout={handleLogout}
            />
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {employees.length === 0 ? (
                    <EmptyState onAddFirstEmployee={() => handleOpenEmployeeForm()} />
                ) : (
                    <>
                        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
                           <div className="relative w-full sm:max-w-xs">
                               <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                               <input type="text" placeholder="Buscar funcionário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 focus:ring-1 focus:ring-brand-primary/50 focus:border-brand-primary/50" />
                           </div>
                           <div className="relative w-full sm:w-auto">
                                <select value={sortKey} onChange={e => setSortKey(e.target.value as any)} className="appearance-none w-full sm:w-48 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 pr-8 focus:outline-none focus:ring-1 focus:ring-brand-primary/50 focus:border-brand-primary/50">
                                   <option value="name">Ordenar por Nome</option>
                                   <option value="artisticName">Ordenar por Nome Artístico</option>
                                   <option value="level">Ordenar por Nível</option>
                               </select>
                               <ArrowsUpDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"/>
                           </div>
                        </div>

                        <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
                            {filteredAndSortedEmployees.map(employee => (
                                <EmployeeItem
                                    key={employee.id}
                                    employee={employee}
                                    viewMode={viewMode}
                                    isExpanded={!!expandedDetails[employee.id]}
                                    displayDate={displayDates[employee.id] || new Date()}
                                    onToggleDetails={handleToggleDetails}
                                    onNavigateMonth={handleNavigateMonth}
                                    onAddWorkDay={handleOpenAddWorkDay}
                                    onEdit={handleOpenEmployeeForm}
                                    onDelete={handleOpenDeleteModal}
                                    onDeleteWorkDay={handleDeleteWorkDay}
                                    onExport={handleExport}
                                />
                            ))}
                        </div>
                    </>
                )}
            </main>
            
            <EmployeeFormModal 
                isOpen={isEmployeeFormOpen}
                onClose={() => setIsEmployeeFormOpen(false)}
                onSave={handleSaveEmployee}
                employeeToEdit={employeeToEdit}
            />

            <AddWorkDayModal
                isOpen={isAddWorkDayModalOpen}
                onClose={() => setIsAddWorkDayModalOpen(false)}
                onSave={handleSaveWorkDays}
                employee={employeeForWorkDay}
                initialDate={employeeForWorkDay ? displayDates[employeeForWorkDay.id] : null}
            />

            <ConfirmDeleteModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão"
                message={`Tem certeza que deseja excluir ${employeeToDelete?.name}? Esta ação não pode ser desfeita.`}
            />
        </div>
    );
};

export default App;