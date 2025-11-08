import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, query } from 'firebase/firestore';

import { auth, db } from './firebaseConfig';
import { Employee, ViewMode, WorkDay, WorkDayType, Nivel } from './types';
import Header from './components/Header';
import EmployeeItem from './components/EmployeeItem';
import EmployeeFormModal from './components/EmployeeFormModal';
import AddWorkDayModal from './components/AddWorkDayModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import EmptyState from './components/EmptyState';
import Auth from './components/Auth';
import { MagnifyingGlassIcon, ArrowsUpDownIcon } from './components/icons';


type Theme = 'light' | 'dark';
type Selection = { type: WorkDayType; extraHours: number };

// Hook para preferências de UI (localStorage)
function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
}

// Hook de Tema
function useTheme(): [Theme, () => void] {
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
    }, [theme]);
    const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    return [theme, toggleTheme];
}

const levelOrder: { [key in Nivel]: number } = {
  [Nivel.TRAINEE]: 0,
  [Nivel.APRENDIZ]: 1,
  [Nivel.RECREADOR]: 2,
  [Nivel.RECREADOREXPERIENTE]: 3,
  [Nivel.COORDENADOR]: 4,
};

const Spinner: React.FC = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary"></div>
    </div>
);

const App: React.FC = () => {
    // Firebase state
    const [user, setUser] = useState<User | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI preferences state
    const [viewMode, setViewMode] = useLocalStorage<ViewMode>('viewMode', 'card');
    const [theme, toggleTheme] = useTheme();
    
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [isWorkDayModalOpen, setIsWorkDayModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [workDayModalContext, setWorkDayModalContext] = useState<{ employee: Employee | null, initialDate: Date | null }>({ employee: null, initialDate: null});
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
    const [employeeDisplayDates, setEmployeeDisplayDates] = useState<{ [id: string]: Date }>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useLocalStorage('sortOption', 'default');

    // Firebase Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Firestore data listener
    useEffect(() => {
        if (!user) {
            setEmployees([]);
            return;
        }
        const userEmployeesCollection = collection(db, 'users', user.uid, 'employees');
        const q = query(userEmployeesCollection); // Add sorting here if needed, e.g., orderBy("name")

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const employeesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Employee));
            setEmployees(employeesData);
            
            // Initialize display dates for new employees
            setEmployeeDisplayDates(prevDates => {
                const newDates = { ...prevDates };
                employeesData.forEach(emp => {
                    if (!newDates[emp.id]) {
                        newDates[emp.id] = new Date();
                    }
                });
                return newDates;
            });
        });
        return () => unsubscribe();
    }, [user]);

    const displayedEmployees = useMemo(() => {
        let filtered = employees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.artisticName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        switch (sortOption) {
            case 'name-asc': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'name-desc': filtered.sort((a, b) => b.name.localeCompare(a.name)); break;
            case 'level-asc': filtered.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]); break;
            case 'level-desc': filtered.sort((a, b) => levelOrder[b.level] - levelOrder[a.level]); break;
        }
        return filtered;
    }, [employees, searchTerm, sortOption]);

    // Employee CRUD Handlers (Firestore)
    const handleSaveEmployee = useCallback(async (employeeData: Omit<Employee, 'id' | 'workDays'> & { id?: string }) => {
        if (!user) return;

        // Validação de nome artístico duplicado (case-insensitive)
        const isArtisticNameDuplicate = employees.some(emp => 
            emp.artisticName.toLowerCase() === employeeData.artisticName.toLowerCase() &&
            emp.id !== employeeData.id // Garante que não estamos comparando o funcionário com ele mesmo durante a edição
        );

        if (isArtisticNameDuplicate) {
            alert(`O nome artístico "${employeeData.artisticName}" já está em uso. Por favor, escolha outro.`);
            return; // Impede o salvamento
        }

        const userEmployeesCollection = collection(db, 'users', user.uid, 'employees');
        const { id, ...dataToSave } = employeeData;

        try {
            if (id) { // Editando
                const employeeDoc = doc(userEmployeesCollection, id);
                await setDoc(employeeDoc, dataToSave, { merge: true });
            } else { // Adicionando
                const newEmployeeData = { ...dataToSave, workDays: [] };
                await addDoc(userEmployeesCollection, newEmployeeData);
            }
            setIsEmployeeModalOpen(false);
        } catch (error) {
            console.error("Erro ao salvar funcionário:", error);
            alert("Não foi possível salvar o funcionário. Verifique suas regras de segurança do Firestore e a conexão com a internet.");
        }
    }, [user, employees]);
    
    const confirmDeleteEmployee = useCallback(async () => {
        if (employeeToDelete && user) {
            const employeeDoc = doc(db, 'users', user.uid, 'employees', employeeToDelete.id);
            await deleteDoc(employeeDoc);
            setEmployeeToDelete(null);
            setIsConfirmDeleteOpen(false);
        }
    }, [employeeToDelete, user]);

    // WorkDay Handlers (Firestore)
    const handleSaveWorkDays = useCallback(async (employeeId: string, monthSelections: { [date: string]: Selection }, editedMonth: Date) => {
        if (!user) return;
        const employeeToUpdate = employees.find(emp => emp.id === employeeId);
        if (!employeeToUpdate) return;
        
        const year = editedMonth.getFullYear();
        const month = editedMonth.getMonth();

        const otherMonthsWorkDays = employeeToUpdate.workDays.filter(wd => {
            const d = new Date(wd.date + 'T00:00:00');
            return d.getFullYear() !== year || d.getMonth() !== month;
        });

        const newWorkDays: WorkDay[] = Object.entries(monthSelections).map(([date, selection]) => ({
            id: crypto.randomUUID(),
            date,
            type: selection.type,
            extraHours: selection.extraHours,
            value: (selection.type === WorkDayType.COMUM ? employeeToUpdate.dailyRate : employeeToUpdate.partyRate) + (selection.extraHours || 0) * employeeToUpdate.extraHourRate,
        }));

        const employeeDoc = doc(db, 'users', user.uid, 'employees', employeeId);
        await setDoc(employeeDoc, { workDays: [...otherMonthsWorkDays, ...newWorkDays] }, { merge: true });
        setIsWorkDayModalOpen(false);
    }, [user, employees]);
    
    const handleDeleteWorkDay = useCallback(async (employeeId: string, workDayId: string) => {
        if (!user) return;
        const employeeToUpdate = employees.find(emp => emp.id === employeeId);
        if (!employeeToUpdate) return;
        
        const updatedWorkDays = employeeToUpdate.workDays.filter(wd => wd.id !== workDayId);
        const employeeDoc = doc(db, 'users', user.uid, 'employees', employeeId);
        await setDoc(employeeDoc, { workDays: updatedWorkDays }, { merge: true });
    }, [user, employees]);
    
    // Other handlers
    const handleAddEmployeeClick = useCallback(() => { setEditingEmployee(null); setIsEmployeeModalOpen(true); }, []);
    const handleEditEmployeeClick = useCallback((employee: Employee) => { setEditingEmployee(employee); setIsEmployeeModalOpen(true); }, []);
    const handleDeleteEmployeeClick = useCallback((employee: Employee) => { setEmployeeToDelete(employee); setIsConfirmDeleteOpen(true); }, []);
    const handleAddWorkDayClick = useCallback((employee: Employee, date: Date) => { setWorkDayModalContext({ employee, initialDate: date }); setIsWorkDayModalOpen(true); }, []);
    const handleNavigateMonth = useCallback((id: string, direction: 'prev' | 'next') => {
        setEmployeeDisplayDates(prev => {
            const newDate = new Date(prev[id] || new Date());
            newDate.setDate(1);
            newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
            return { ...prev, [id]: newDate };
        });
    }, []);
    const handleToggleDetails = useCallback((id: string) => setExpandedEmployeeId(prev => (prev === id ? null : id)), []);
    const handleLogout = useCallback(() => { signOut(auth); }, []);

    // Export Handler (no change needed)
    const handleExport = useCallback((employee: Employee, date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthlyWorkDays = employee.workDays.filter(day => {
            const dayDate = new Date(day.date + 'T00:00:00');
            return dayDate.getFullYear() === year && dayDate.getMonth() === month;
        }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (monthlyWorkDays.length === 0) { alert('Nenhum dado para exportar para este mês.'); return; }
        const monthlyTotal = monthlyWorkDays.reduce((sum, day) => sum + day.value, 0);
        
        // FIX: Explicitly type `data` to allow for the summary row which has different types, resolving the TypeScript errors about incompatible types.
        const data: Array<{ [key: string]: string | number }> = monthlyWorkDays.map(day => ({
            'Data': new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR'),
            'Tipo': day.type, 'Horas Extras': day.extraHours || 0, 'Valor': day.value
        }));
        data.push({ 'Data': '', 'Tipo': '', 'Horas Extras': 'TOTAL', 'Valor': monthlyTotal });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{wch:12}, {wch:15}, {wch:12}, {wch:12}];
        // Formatting logic...
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Diárias');
        XLSX.writeFile(wb, `${employee.name.replace(/ /g, '_')}_${date.toLocaleDateString('pt-BR', { month: 'long' })}_${year}.xlsx`);
    }, []);

    if (loading) return <Spinner />;
    if (!user) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900"><Auth /></div>;

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <Header 
                employeeCount={employees.length}
                viewMode={viewMode}
                theme={theme}
                user={user}
                onAddEmployee={handleAddEmployeeClick}
                onSetViewMode={setViewMode}
                onToggleTheme={toggleTheme}
                onLogout={handleLogout}
            />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {employees.length > 0 ? (
                    <>
                        <div className="mb-6 flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-grow">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3"><MagnifyingGlassIcon className="h-5 w-5 text-slate-400" /></span>
                                <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200" />
                            </div>
                            <div className="relative sm:max-w-xs w-full">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><ArrowsUpDownIcon className="h-5 w-5 text-slate-400" /></span>
                                <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="w-full appearance-none pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary/50 focus:border-brand-primary/50 bg-white dark:bg-slate-700 dark:text-slate-200">
                                    <option value="default">Ordenação Padrão</option>
                                    <option value="name-asc">Nome (A-Z)</option>
                                    <option value="name-desc">Nome (Z-A)</option>
                                    <option value="level-asc">Nível (Crescente)</option>
                                    <option value="level-desc">Nível (Decrescente)</option>
                                </select>
                            </div>
                        </div>

                        {displayedEmployees.length > 0 ? (
                            <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start' : ''}>
                                {displayedEmployees.map(employee => (
                                    <EmployeeItem key={employee.id} employee={employee} viewMode={viewMode} isExpanded={expandedEmployeeId === employee.id} displayDate={employeeDisplayDates[employee.id] || new Date()} onToggleDetails={handleToggleDetails} onNavigateMonth={handleNavigateMonth} onAddWorkDay={handleAddWorkDayClick} onEdit={handleEditEmployeeClick} onDelete={handleDeleteEmployeeClick} onDeleteWorkDay={handleDeleteWorkDay} onExport={handleExport} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16"><h3 className="text-xl font-semibold">Nenhum funcionário encontrado</h3><p className="mt-2">Tente ajustar seus filtros de busca.</p></div>
                        )}
                    </>
                ) : ( <EmptyState onAddFirstEmployee={handleAddEmployeeClick} /> )}
            </main>

            <EmployeeFormModal isOpen={isEmployeeModalOpen} onClose={() => setIsEmployeeModalOpen(false)} onSave={handleSaveEmployee} employeeToEdit={editingEmployee} />
            <AddWorkDayModal isOpen={isWorkDayModalOpen} onClose={() => setIsWorkDayModalOpen(false)} onSave={handleSaveWorkDays} employee={workDayModalContext.employee} initialDate={workDayModalContext.initialDate} />
            <ConfirmDeleteModal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={confirmDeleteEmployee} title="Excluir Funcionário" message={`Tem certeza que deseja excluir ${employeeToDelete?.name}? Todos os seus dados serão removidos permanentemente.`} />
        </div>
    );
};

export default App;