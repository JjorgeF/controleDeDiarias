import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, User, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider, isFirebaseConfigured } from './lib/firebase';
import { Employee, ViewMode, WorkDay } from './types';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import EmployeeList from './components/EmployeeList';
import CalendarView from './components/CalendarView';
import EmployeeModal from './components/EmployeeModal';
import ManageDaysModal from './components/ManageDaysModal';
import { LogIn, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isSameMonth, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isManageDaysModalOpen, setIsManageDaysModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);

  useEffect(() => {
    // Apply theme class to html element
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!auth) {
      setAdminCheckLoading(false);
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAdminCheckLoading(true);
      setUser(user);
      
      if (user && user.email && db) {
        try {
          // Verifica se o documento com o email do usuário existe na coleção usuarios_admin
          const adminDoc = await getDoc(doc(db, 'usuarios_admin', user.email));
          setIsAdmin(adminDoc.exists());
        } catch (error) {
          console.error("Erro ao verificar status de admin:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setAdminCheckLoading(false);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db || adminCheckLoading) {
      setEmployees([]);
      return;
    }

    // Se for admin, busca todos. Se não, busca apenas o dele pelo email.
    const q = isAdmin 
      ? query(collection(db, 'employees'))
      : query(collection(db, 'employees'), where('email', '==', user.email || ''));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let emps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      
      setEmployees(emps);
    });

    return () => unsubscribe();
  }, [user, isAdmin, adminCheckLoading, db]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const handleSaveEmployee = async (data: Partial<Employee>): Promise<{ success: boolean; error?: string }> => {
    if (!user || !db) return { success: false, error: "Usuário não autenticado." };

    // Validation: Unique Artistic Name
    if (data.artisticName) {
      const isArtisticNameTaken = employees.some(emp => 
        emp.artisticName.trim().toLowerCase() === data.artisticName?.trim().toLowerCase() && 
        emp.id !== selectedEmployee?.id
      );

      if (isArtisticNameTaken) {
        return { 
          success: false, 
          error: `O nome artístico "${data.artisticName}" já está em uso. Por favor, escolha outro.` 
        };
      }
    }

    try {
      if (selectedEmployee) {
        const empRef = doc(db, 'employees', selectedEmployee.id);
        await updateDoc(empRef, data);
      } else {
        // Ao criar novo, o userId pode ser vazio se for um convite por email
        // Se o email for do próprio admin, vincula a ele, senão deixa para o funcionário vincular no primeiro login
        const isSelf = data.email === user.email;
        await addDoc(collection(db, 'employees'), {
          ...data,
          userId: isSelf ? user.uid : '',
          workDays: []
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error("Error saving employee:", error);
      return { 
        success: false, 
        error: "Erro ao salvar funcionário. Verifique sua conexão." 
      };
    }
  };

  const handleDeleteEmployee = useCallback(async (id: string) => {
    if (!id) {
      console.error("handleDeleteEmployee: ID is missing");
      return;
    }
    
    console.log("handleDeleteEmployee: Attempting to delete employee with ID:", id);

    try {
      if (!db) {
        throw new Error("Banco de dados não inicializado. Verifique sua configuração do Firebase.");
      }
      
      const docRef = doc(db, 'employees', id);
      await deleteDoc(docRef);
      console.log("handleDeleteEmployee: Employee deleted successfully from Firestore:", id);
    } catch (error: any) {
      console.error("handleDeleteEmployee: Error deleting employee:", error);
      alert("Erro ao excluir funcionário: " + (error.message || "Erro desconhecido. Verifique sua conexão e permissões."));
      throw error;
    }
  }, [db]);

  const handleExportExcel = () => {
    const monthName = format(currentMonth, 'MMMM_yyyy', { locale: ptBR });
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({
      start: monthStart,
      end: monthEnd,
    });

    const data = employees.map(emp => {
      const monthDays = emp.workDays.filter(d => isSameMonth(parseISO(d.date), currentMonth));
      
      const earnings = monthDays.reduce((acc, day) => {
        let dayBase = 0;
        if (day.type === 'common') dayBase = emp.dailyRate;
        else if (day.type === 'party') dayBase = emp.partyRate;
        const extra = (day.extraHours || 0) * emp.extraHourRate;
        return acc + dayBase + extra;
      }, 0);

      const row: any = {
        'Nome': emp.name,
        'Nome Artístico': emp.artisticName,
        'Nível': emp.level,
        'Dias Trabalhados': monthDays.length,
        'Total a Receber': earnings,
      };

      daysInMonth.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const workDay = monthDays.find(d => d.date === dayStr);
        const dayLabel = format(day, 'dd/MM');
        
        if (workDay) {
          let typeLabel = workDay.type === 'common' ? 'Comum' : 'Festa';
          if (workDay.extraHours) typeLabel += ` (+${workDay.extraHours}h)`;
          row[dayLabel] = typeLabel;
        } else {
          row[dayLabel] = '-';
        }
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Mensal");
    
    const maxWidths = data.reduce((acc: any, row: any) => {
      Object.keys(row).forEach((key, i) => {
        const val = String(row[key]);
        acc[key] = Math.max(acc[key] || 0, val.length, key.length);
      });
      return acc;
    }, {});
    
    worksheet['!cols'] = Object.keys(maxWidths).map(key => ({ wch: maxWidths[key] + 2 }));

    XLSX.writeFile(workbook, `Relatorio_${monthName}.xlsx`);
  };

  const handleUpdateDays = async (employeeId: string, days: WorkDay[]) => {
    if (!user || !db) return;
    try {
      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, { workDays: days });
    } catch (error) {
      console.error("Error updating work days:", error);
    }
  };

  const handleLogin = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg p-4">
        <div className="bg-brand-card border border-red-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-white mb-2">Configuração Necessária</h1>
          <p className="text-gray-400 mb-6">As chaves do Firebase não foram configuradas. Por favor, adicione as variáveis de ambiente nos Secrets do AI Studio.</p>
          <div className="text-left bg-black/30 p-4 rounded-lg text-xs font-mono text-gray-300 space-y-1">
            <p>VITE_FIREBASE_API_KEY</p>
            <p>VITE_FIREBASE_AUTH_DOMAIN</p>
            <p>VITE_FIREBASE_PROJECT_ID</p>
            <p>...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || adminCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg p-4">
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <h1 className="text-4xl font-black text-brand-primary mb-2">Liga Positiva</h1>
          <p className="text-gray-400 mb-8">Gerencie sua equipe de recreadores de forma simples e eficiente.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
          
          <p className="mt-6 text-xs text-gray-500">
            Ao entrar, você concorda com nossos termos de serviço.
          </p>
        </div>
      </div>
    );
  }

  // Interface do Funcionário (Não Admin)
  if (!isAdmin) {
    const myEmployeeRecord = employees[0];

    return (
      <div className="min-h-screen bg-brand-bg pb-12">
        <Header 
          viewMode="grid"
          setViewMode={() => {}}
          onAddEmployee={() => {}}
          searchQuery=""
          setSearchQuery={() => {}}
          isDarkMode={isDarkMode}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
          onExportExcel={() => {}}
          hideControls={true}
        />

        <main className="w-full mx-auto px-2 md:px-4 py-4 md:py-8 max-w-4xl">
          {myEmployeeRecord ? (
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                <div className="w-full md:w-1/3">
                  <EmployeeCard 
                    employee={myEmployeeRecord}
                    onEdit={() => {}}
                    onManageDays={() => {}}
                    currentMonth={currentMonth}
                    isReadOnly={true}
                  />
                </div>
                <div className="w-full md:w-2/3 bg-brand-card border border-brand-border rounded-2xl p-3 md:p-6 shadow-xl">
                  <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">Meu Calendário de Trabalho</h2>
                  <CalendarView 
                    employees={[myEmployeeRecord]}
                    onUpdateDays={() => {}}
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    isReadOnly={true}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-lg">Carregando seus dados ou você ainda não foi vinculado a um registro de funcionário.</p>
              <p className="text-sm text-gray-500 mt-2">Entre em contato com o administrador e informe seu e-mail: {user.email}</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Interface do Admin
  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      <Header 
        viewMode={viewMode}
        setViewMode={setViewMode}
        onAddEmployee={() => {
          setSelectedEmployee(undefined);
          setIsEmployeeModalOpen(true);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        onExportExcel={handleExportExcel}
      />

      <main className="w-full mx-auto px-2 md:px-4 py-4 md:py-8 max-w-7xl">
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEmployees.map(emp => (
              <EmployeeCard 
                key={emp.id}
                employee={emp}
                onEdit={(e) => {
                  setSelectedEmployee(e);
                  setIsEmployeeModalOpen(true);
                }}
                onManageDays={(e) => {
                  setSelectedEmployee(e);
                  setIsManageDaysModalOpen(true);
                }}
                currentMonth={currentMonth}
              />
            ))}
            {filteredEmployees.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-gray-500 text-lg">Nenhum funcionário encontrado.</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'list' && (
          <EmployeeList 
            employees={filteredEmployees}
            onEdit={(e) => {
              setSelectedEmployee(e);
              setIsEmployeeModalOpen(true);
            }}
            onManageDays={(e) => {
              setSelectedEmployee(e);
              setIsManageDaysModalOpen(true);
            }}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
          />
        )}

        {viewMode === 'calendar' && (
          <CalendarView 
            employees={employees}
            onUpdateDays={handleUpdateDays}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
          />
        )}
      </main>

      <EmployeeModal 
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSave={handleSaveEmployee}
        onDelete={handleDeleteEmployee}
        employee={selectedEmployee}
      />

      {selectedEmployee && (
        <ManageDaysModal 
          isOpen={isManageDaysModalOpen}
          onClose={() => setIsManageDaysModalOpen(false)}
          employee={selectedEmployee}
          onUpdateDays={handleUpdateDays}
        />
      )}
    </div>
  );
}
