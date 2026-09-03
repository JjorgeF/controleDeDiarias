import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
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
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { auth, db, googleProvider, isFirebaseConfigured, handleFirestoreError, OperationType } from './lib/firebase';
import { Employee, ViewMode, WorkDay, CancellationLog, Promotion, AppNotification, CustomNotificationDoc, DayConfig, PartyDetails } from './types';
import { recalculateEmployeeTimeline } from './utils/promotionUtils';
import Header from './components/Header';
import NavigationDock from './components/NavigationDock';
import EmployeeCard from './components/EmployeeCard';
import EmployeeList from './components/EmployeeList';
import CalendarView from './components/CalendarView';
import EmployeeModal from './components/EmployeeModal';
import SimulationBanner from './components/SimulationBanner';
import InAppBrowserGuide, { isInAppBrowser } from './components/InAppBrowserGuide';
import { registerPushSubscription, sendPushToAllTokens } from './lib/pushNotifications';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { WhatsNewModal } from './components/WhatsNewModal';
import { lazyWithRetry } from './lib/lazyWithRetry';

// Lazy loaded heavy components for optimal bundle size & performance with auto-retry
const AdminDashboard = lazyWithRetry(() => import('./components/AdminDashboard'));
const KpisView = lazyWithRetry(() => import('./components/KpisView').then(m => ({ default: m.KpisView })));
const MonthlyScheduleView = lazyWithRetry(() => import('./components/MonthlyScheduleView'));
const PaymentsView = lazyWithRetry(() => import('./components/PaymentsView'));
const PartyManagementView = lazyWithRetry(() => import('./components/PartyManagementView'));
const EmployeeStoryView = lazyWithRetry(() => import('./components/EmployeeStoryView'));
const EmployeeEarningsView = lazyWithRetry(() => import('./components/EmployeeEarningsView'));
const ManageDaysModal = lazyWithRetry(() => import('./components/ManageDaysModal'));
const SendNotificationModal = lazyWithRetry(() => import('./components/SendNotificationModal'));
const PushDiagnosticsModal = lazyWithRetry(() => import('./components/PushDiagnosticsModal'));
const AdvancedSettingsModal = lazyWithRetry(() => import('./components/AdvancedSettingsModal'));
const RevertCancellationModal = lazyWithRetry(() => import('./components/RevertCancellationModal'));

const ViewFallback = () => (
  <div className="flex items-center justify-center p-12 text-brand-muted">
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-bold uppercase tracking-wider">Carregando visualização...</span>
    </div>
  </div>
);
import Logo from './components/Logo';
import { LogIn, AlertTriangle, Calendar, Award, X, Table, UserPlus, Plus, DollarSign, UserRound } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isSameMonth, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [deadlines, setDeadlines] = useState<Record<string, string>>({}); // Key: "yyyy-MM", Value: "yyyy-MM-ddTHH:mm"
  const [dayConfigs, setDayConfigs] = useState<Record<string, DayConfig>>({});
  const [parties, setParties] = useState<PartyDetails[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'availabilities' | 'cancellations'>('availabilities');
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  
  // Estado para simulação de papéis (Role simulation)
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedEmployeeId, setSimulatedEmployeeId] = useState<string>('');

  // Flag de controle: ativa no modo desenvolvimento local ou via variável customizada VITE_ENABLE_SIMULATION no .env
  const isSimulationEnabled = import.meta.env.VITE_ENABLE_SIMULATION?.toLowerCase() === 'true' || import.meta.env.DEV;

  const isViewingAsAdmin = isAdmin && (!isSimulationEnabled || !simulationActive);

  // Modals & Navigation state
  const [employeeActiveTab, setEmployeeActiveTab] = useState<'schedule' | 'master_schedule' | 'profile' | 'earnings'>('schedule');
  const [selectedStoryEmployee, setSelectedStoryEmployee] = useState<Employee | null>(null);
  const [adminStoryModalTab, setAdminStoryModalTab] = useState<'profile' | 'earnings'>('profile');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isManageDaysModalOpen, setIsManageDaysModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (auth) {
      getRedirectResult(auth).catch((err) => {
        console.warn("Segurança de redirecionamento do Firebase Auth capturada:", err);
      });
    }
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    const unsub = onSnapshot(doc(db, 'settings', 'deadlines'), (snapshot) => {
      if (snapshot.exists()) {
        setDeadlines(snapshot.data() as Record<string, string>);
      } else {
        setDeadlines({});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/deadlines');
    });
    return () => unsub();
  }, [db, user]);

  useEffect(() => {
    if (!db || !user) return;
    const unsub = onSnapshot(doc(db, 'settings', 'dayConfigs'), (snapshot) => {
      if (snapshot.exists()) {
        setDayConfigs(snapshot.data() as Record<string, DayConfig>);
      } else {
        setDayConfigs({});
      }
    }, (error) => {
      console.error("Error loading dayConfigs:", error);
    });
    return () => unsub();
  }, [db, user]);

  useEffect(() => {
    if (!db || !user || !isViewingAsAdmin) {
      setParties([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'party_events'), (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as PartyDetails[];
      setParties(list);
    }, (error) => {
      // Ignora silenciosamente o erro de permissão (Missing or insufficient permissions)
      // para evitar poluir o console, pois as regras do Firebase podem não estar atualizadas
      if (error.code !== 'permission-denied') {
        console.warn("Aviso ao carregar eventos/festas:", error);
      }
    });
    return () => unsub();
  }, [db, user, isViewingAsAdmin]);



  useEffect(() => {
    // Apply theme class to html element
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Dynamic custom logo & PWA manifest updater
  useEffect(() => {
    const checkCustomLogo = async () => {
      const formats = ['png', 'svg', 'webp', 'jpg', 'jpeg'];
      for (const format of formats) {
        try {
          const logoUrl = `/brand/logo-custom.${format}`;
          const response = await fetch(logoUrl, { method: 'HEAD' });
          if (response.ok) {
            // Check if the file is empty (e.g. 0 bytes placeholder)
            const contentLength = response.headers.get('content-length');
            if (contentLength === '0') {
              continue;
            }

            // Found a custom logo! Update favicon & apple-touch-icon
            const favicon = document.querySelector('link[rel="icon"]');
            if (favicon) {
              favicon.setAttribute('href', logoUrl);
              favicon.setAttribute('type', format === 'svg' ? 'image/svg+xml' : `image/${format}`);
            }
            
            const appleTouch = document.querySelector('link[rel="apple-touch-icon"]');
            if (appleTouch) {
              appleTouch.setAttribute('href', logoUrl);
            }
            
            // Update manifest to append query parameter so Service Worker can serve custom icon
            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) {
              manifestLink.setAttribute('href', `/manifest.json?logo=logo-custom.${format}`);
            }
            break;
          }
        } catch (e) {
          // Ignore
        }
      }
    };
    checkCustomLogo();
  }, []);

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

          // Registra o log de acesso se ainda não tiver registrado nesta sessão do navegador
          const sessionLoggedKey = `logged_${user.email}_${new Date().toISOString().split('T')[0]}`;
          if (!sessionStorage.getItem(sessionLoggedKey)) {
            try {
              const logData = {
                type: 'access_log',
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                timestamp: new Date().toISOString()
              };

              // Tentativa 1: Escreve na coleção 'cancellations' (que permite isSignedIn)
              try {
                const logDocId = `access_log_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const logRef = doc(db, 'cancellations', logDocId);
                await setDoc(logRef, logData);
                console.log("Log de acesso salvo na coleção 'cancellations' com sucesso.");
                sessionStorage.setItem(sessionLoggedKey, 'true');
              } catch (err: any) {
                console.warn("Falha ao salvar log em 'cancellations', tentando fallback:", err);

                // Fallback:
                if (adminDoc.exists()) {
                  // Se for admin, grava em settings/access_logs
                  const settingsLogRef = doc(db, 'settings', 'access_logs');
                  const logId = `log_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                  await setDoc(settingsLogRef, {
                    [logId]: {
                      email: user.email,
                      name: user.displayName || user.email.split('@')[0],
                      timestamp: new Date().toISOString()
                    }
                  }, { merge: true });
                  console.log("Log de acesso do admin salvo em settings/access_logs.");
                  sessionStorage.setItem(sessionLoggedKey, 'true');
                } else {
                  // Se for funcionário, grava em seu próprio registro na lista de availabilities
                  const qEmp = query(collection(db, 'employees'), where('email', '==', user.email.trim().toLowerCase()));
                  const querySnapshot = await getDocs(qEmp);
                  if (!querySnapshot.empty) {
                    const empDoc = querySnapshot.docs[0];
                    const empData = empDoc.data() as Employee;
                    const currentAvails = empData.availabilities || [];
                    const loginToken = `login_${new Date().toISOString()}`;
                    
                    // Mantém apenas o ÚLTIMO log de login no array de availabilities para não poluir
                    const cleanAvails = currentAvails.filter(av => !av.startsWith('login_'));
                    
                    await updateDoc(doc(db, 'employees', empDoc.id), {
                      availabilities: [...cleanAvails, loginToken]
                    });
                    console.log("Log de acesso do funcionário salvo em availabilities:", loginToken);
                    sessionStorage.setItem(sessionLoggedKey, 'true');
                  }
                }
              }
            } catch (logErr) {
              console.error("Erro geral ao salvar log de acesso:", logErr);
            }
          }
          // Sync push subscription for PWA background notifications if permission was granted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const myEmailLower = (user.email || '').trim().toLowerCase();
            const myEmp = employees.find(e => (myEmailLower && (e.email || '').trim().toLowerCase() === myEmailLower) || (user.uid && e.userId === user.uid));
            registerPushSubscription(user.email, user.displayName || user.email.split('@')[0], myEmp?.id).catch(() => {});
          }
        } catch (error) {
          console.error("Erro ao verificar status de admin:", error);
          setIsAdmin(false);
          handleFirestoreError(error, OperationType.GET, 'usuarios_admin/' + user.email);
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
      setEmployeesLoading(false);
      return;
    }

    setEmployeesLoading(true);

    const userEmailRaw = (user.email || '').trim();
    const userEmailLower = userEmailRaw.toLowerCase();
    const emailOptions = Array.from(new Set([userEmailRaw, userEmailLower])).filter(Boolean);

    // Todos os usuários (admins e colaboradores) carregam a lista completa para visualização da escala geral e colegas de trabalho
    const q = query(collection(db, 'employees'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let emps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];

      emps.sort((a, b) => {
        const nameA = a.artisticName || a.name || '';
        const nameB = b.artisticName || b.name || '';
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
      
      setEmployees(emps);
      setEmployeesLoading(false);

      // Auto-vincular o UID do usuário autenticado se ele for funcionário e o campo userId estiver vazio
      if (!isAdmin && emps.length > 0 && user) {
        const myEmailLower = (user.email || '').trim().toLowerCase();
        const myEmp = emps.find(emp => (myEmailLower && (emp.email || '').trim().toLowerCase() === myEmailLower) || (emp.userId && emp.userId === user.uid));
        if (myEmp && (!myEmp.userId || myEmp.userId !== user.uid)) {
          try {
            const empRef = doc(db, 'employees', myEmp.id);
            await updateDoc(empRef, { userId: user.uid });
            console.log("userId vinculado com sucesso para o funcionário:", myEmp.name);
          } catch (err) {
            console.warn("Não foi possível auto-vincular o userId:", err);
          }
        }
      }
    }, (error) => {
      setEmployeesLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'employees');
    });

    return () => unsubscribe();
  }, [user, isAdmin, adminCheckLoading, db]);

  const activeEmployees = useMemo(() => {
    return employees.filter(emp => emp.status !== 'inactive');
  }, [employees]);

  const inactiveEmployees = useMemo(() => {
    return employees.filter(emp => emp.status === 'inactive');
  }, [employees]);

  // Auto-purge inactive employees older than 180 days (6 months)
  useEffect(() => {
    if (!isAdmin || !db || employeesLoading || employees.length === 0) return;
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = employees.filter(emp => {
      if (emp.status !== 'inactive' || !emp.inactivatedAt) return false;
      const inactTime = new Date(emp.inactivatedAt).getTime();
      return (now - inactTime) >= SIX_MONTHS_MS;
    });

    if (expired.length > 0) {
      console.log(`Auto-purging ${expired.length} expired inactive employee(s) (>6 months)...`);
      expired.forEach(async (emp) => {
        try {
          await deleteDoc(doc(db, 'employees', emp.id));
          console.log(`Successfully auto-deleted expired employee: ${emp.id} (${emp.name})`);
        } catch (err) {
          console.error(`Failed to auto-delete expired employee ${emp.id}:`, err);
        }
      });
    }
  }, [isAdmin, db, employeesLoading, employees]);

  const filteredEmployees = useMemo(() => {
    return activeEmployees
      .filter(emp => 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const nameA = a.artisticName || a.name || '';
        const nameB = b.artisticName || b.name || '';
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [activeEmployees, searchQuery]);

  const cancellations = useMemo(() => {
    const list: CancellationLog[] = [];
    employees.forEach(emp => {
      (emp.workDays || []).forEach(wd => {
        if (wd.isCancelled && !wd.cancellationDismissed && !wd.cancellationIgnored) {
          list.push({
            id: `${emp.id}_${wd.date}`,
            employeeId: emp.id,
            employeeName: emp.artisticName || emp.name,
            date: wd.date,
            type: wd.type as 'common' | 'party',
            cancelledAt: wd.cancelledAt || new Date().toISOString(),
            viewedByAdmins: !!wd.cancellationViewed
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime());
  }, [employees]);

  const unreadCancellations = useMemo(() => {
    return cancellations.filter(c => !c.viewedByAdmins);
  }, [cancellations]);

  const [customNotificationsDocs, setCustomNotificationsDocs] = useState<CustomNotificationDoc[]>([]);
  const [isSendNotificationModalOpen, setIsSendNotificationModalOpen] = useState(false);
  const [isPushDiagnosticsOpen, setIsPushDiagnosticsOpen] = useState(false);
  const [isRevertCancellationModalOpen, setIsRevertCancellationModalOpen] = useState(false);
  const [revertCancellationTarget, setRevertCancellationTarget] = useState<{ employeeId?: string; date?: string }>({});

  const handleOpenRevertCancellation = (employeeId?: string, date?: string) => {
    setRevertCancellationTarget({ employeeId, date });
    setIsRevertCancellationModalOpen(true);
  };

  useEffect(() => {
    if (!db || !user) {
      setCustomNotificationsDocs([]);
      return;
    }

    const unsub = onSnapshot(doc(db, 'settings', 'custom_notifications'), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const allItems: CustomNotificationDoc[] = data?.items || [];
        
        // Mantém notificações recentes (últimos 3 dias ou até 25 itens)
        const recentItems = allItems.filter(item => {
          try {
            const itemDate = parseISO(item.createdAt);
            return isToday(itemDate) || (new Date().getTime() - itemDate.getTime() < 3 * 24 * 60 * 60 * 1000);
          } catch {
            return true;
          }
        });

        setCustomNotificationsDocs(recentItems);

        // Se existirem notificações antigas (mais de 3 dias), limpa silenciosamente no Firestore em segundo plano
        if (isViewingAsAdmin && allItems.length !== recentItems.length) {
          try {
            await setDoc(doc(db, 'settings', 'custom_notifications'), { items: recentItems }, { merge: true });
          } catch (e) {
            console.warn('Aviso ao purgar notificações antigas do Firestore:', e);
          }
        }
      } else {
        setCustomNotificationsDocs([]);
      }
    }, (err) => {
      console.warn('Aviso ao escutar notificações personalizadas:', err);
      setCustomNotificationsDocs([]);
    });

    return () => unsub();
  }, [db, user, isViewingAsAdmin]);

  const activeUserKey = isViewingAsAdmin
    ? 'admin'
    : (simulationActive ? `emp_${simulatedEmployeeId}` : (user?.email || user?.uid || 'user'));

  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`read_notifications_${activeUserKey}`) || '[]');
    } catch {
      return [];
    }
  });

  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`dismissed_notifications_${activeUserKey}`) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const read = JSON.parse(localStorage.getItem(`read_notifications_${activeUserKey}`) || '[]');
      setReadNotificationIds(read);

      const dism = JSON.parse(localStorage.getItem(`dismissed_notifications_${activeUserKey}`) || '[]');
      setDismissedNotificationIds(dism);
    } catch (e) {
      console.error(e);
    }
  }, [activeUserKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_notifications_${activeUserKey}`, JSON.stringify(readNotificationIds));
    } catch {}
  }, [readNotificationIds, activeUserKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`dismissed_notifications_${activeUserKey}`, JSON.stringify(dismissedNotificationIds));
    } catch {}
  }, [dismissedNotificationIds, activeUserKey]);

  const allNotifications = useMemo(() => {
    const list: AppNotification[] = [];

    // 1. Cancellation notifications (for admins)
    if (isViewingAsAdmin) {
      cancellations.forEach(c => {
        const notifId = `cancellation_${c.id}`;
        if (!dismissedNotificationIds.includes(notifId)) {
          list.push({
            id: notifId,
            type: 'cancellation',
            title: `Cancelamento: ${c.employeeName}`,
            message: `Solicitou o cancelamento da escala do dia ${format(parseISO(c.date), 'dd/MM/yyyy')} (${c.type === 'party' ? 'Festa 🥳' : 'Diária CCSP'}).`,
            date: c.cancelledAt,
            isRead: c.viewedByAdmins || readNotificationIds.includes(notifId),
            employeeId: c.employeeId,
            targetDate: c.date
          });
        }
      });

      // 1.5 Extraordinary Availability notifications (for admins)
      Object.entries(dayConfigs || {}).forEach(([dateStr, cfg]) => {
        const dayCfg = cfg as DayConfig;
        if (!dayCfg) return;
        const lockedMap = dayCfg.extraordinaryLockedAvailabilities;
        const isExtraOpen = !!dayCfg.isExtraordinaryOpen;
        if (!lockedMap && !isExtraOpen) return;

        employees.forEach(emp => {
          const empAvails = (emp.availabilities || []).filter(a => a === dateStr || a.startsWith(`${dateStr}_`));
          if (empAvails.length === 0) return;

          const lockedKeys = lockedMap?.[emp.id] || [];
          const extraKeys = lockedMap
            ? empAvails.filter(k => !lockedKeys.includes(k) && (k !== dateStr || !lockedKeys.includes(`${dateStr}_common`)))
            : (isExtraOpen ? empAvails : []);

          extraKeys.forEach(extraKey => {
            const notifId = `extraordinary_avail_${emp.id}_${dateStr}_${extraKey}`;
            if (!dismissedNotificationIds.includes(notifId)) {
              let detail = 'Disponibilidade';
              if (extraKey === dateStr || extraKey.includes('_common')) {
                detail = 'Diária CCSP';
              } else if (extraKey.includes('_party')) {
                const partyId = extraKey.replace(`${dateStr}_party_`, '');
                const party = dayCfg.parties?.find(p => p.id === partyId);
                detail = party ? `Festa (${party.name})` : 'Festa';
              }

              let formattedDate = dateStr;
              try {
                formattedDate = format(parseISO(dateStr), 'dd/MM/yyyy');
              } catch {}

              let scopeInfo = '';
              if (dayCfg.extraordinaryScope === 'parties') scopeInfo = ' [Escopo: Festas]';
              else if (dayCfg.extraordinaryScope === 'ccsp') scopeInfo = ' [Escopo: CCSP]';

              list.push({
                id: notifId,
                type: 'extraordinary_avail',
                title: `⚡ Abertura Extra: ${emp.artisticName || emp.name}`,
                message: `${emp.artisticName || emp.name} enviou disponibilidade (${detail}) para o dia ${formattedDate} via Abertura Extra${scopeInfo}.`,
                date: new Date().toISOString(),
                isRead: readNotificationIds.includes(notifId),
                employeeId: emp.id,
                targetDate: dateStr
              });
            }
          });
        });
      });
    }

    // 2. Deadline notifications
    const currentMonthKey = format(currentMonth, 'yyyy-MM');
    const currentDeadline = deadlines?.[currentMonthKey];
    if (currentDeadline) {
      const deadlineDate = new Date(currentDeadline);
      const isExpired = new Date() > deadlineDate;
      const deadlineNotifId = `deadline_${currentMonthKey}_${isExpired ? 'expired' : 'active'}`;

      if (!dismissedNotificationIds.includes(deadlineNotifId)) {
        list.push({
          id: deadlineNotifId,
          type: isExpired ? 'deadline_expired' : 'deadline_warning',
          title: isExpired ? 'Prazo de Disponibilidades Encerrado' : 'Prazo de Disponibilidades Ativo',
          message: isExpired
            ? `O prazo para envio de disponibilidades de ${format(currentMonth, 'MMMM', { locale: ptBR })} encerrou em ${format(deadlineDate, "dd/MM/yyyy 'às' HH:mm")}.`
            : `Defina suas disponibilidades de ${format(currentMonth, 'MMMM', { locale: ptBR })} até ${format(deadlineDate, "dd/MM/yyyy 'às' HH:mm")}.`,
          date: new Date().toISOString(),
          isRead: readNotificationIds.includes(deadlineNotifId)
        });
      }
    }

    // 3. Custom broadcast or targeted notifications
    const userEmailLower = (user?.email || '').trim().toLowerCase();
    const myRecord = simulationActive
      ? employees.find(e => e.id === simulatedEmployeeId)
      : (userEmailLower
          ? employees.find(e => (e.email || '').trim().toLowerCase() === userEmailLower || (user?.uid && e.userId === user.uid))
          : null);

    customNotificationsDocs.forEach(cNotif => {
      const notifId = `custom_${cNotif.id}`;
      if (dismissedNotificationIds.includes(notifId)) return;

      const isTargetedToMe = 
        cNotif.targetType === 'all' || 
        !cNotif.targetEmployeeId || 
        (myRecord && cNotif.targetEmployeeId === myRecord.id) ||
        (userEmailLower && employees.some(e => e.id === cNotif.targetEmployeeId && (e.email || '').trim().toLowerCase() === userEmailLower));

      if (isViewingAsAdmin || isTargetedToMe) {
        let displayTitle = cNotif.title;
        if (isViewingAsAdmin && cNotif.targetType === 'specific' && cNotif.targetEmployeeName) {
          displayTitle = `${cNotif.title} (Para: ${cNotif.targetEmployeeName})`;
        }

        list.push({
          id: notifId,
          type: 'custom',
          title: displayTitle,
          message: cNotif.message,
          date: cNotif.createdAt,
          isRead: readNotificationIds.includes(notifId),
          employeeId: cNotif.targetEmployeeId
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cancellations, deadlines, currentMonth, isViewingAsAdmin, readNotificationIds, dismissedNotificationIds, customNotificationsDocs, employees, dayConfigs, simulationActive, simulatedEmployeeId, user]);

  const unreadNotificationsCount = useMemo(() => {
    return allNotifications.filter(n => !n.isRead).length;
  }, [allNotifications]);

  const handleSendCustomNotification = async (data: {
    title: string;
    message: string;
    targetType: 'all' | 'specific';
    targetEmployeeId?: string;
    targetEmployeeName?: string;
  }) => {
    if (!user || !db || !isViewingAsAdmin) {
      return { success: false, error: 'Apenas administradores podem enviar notificações.' };
    }

    try {
      const newNotif: CustomNotificationDoc = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
        title: data.title,
        message: data.message,
        targetType: data.targetType,
        ...(data.targetType === 'specific' && data.targetEmployeeId ? { targetEmployeeId: data.targetEmployeeId } : {}),
        ...(data.targetType === 'specific' && data.targetEmployeeName ? { targetEmployeeName: data.targetEmployeeName } : {}),
        createdAt: new Date().toISOString(),
        createdBy: user.email || 'Admin'
      };

      const docRef = doc(db, 'settings', 'custom_notifications');
      const docSnap = await getDoc(docRef);
      let items: CustomNotificationDoc[] = [];
      if (docSnap.exists()) {
        items = docSnap.data().items || [];
      }
      // Adiciona no início e limita aos 25 mais recentes para otimizar custo e armazenamento no Firestore
      items.unshift(newNotif);
      if (items.length > 25) {
        items = items.slice(0, 25);
      }

      await setDoc(docRef, { items }, { merge: true });

      // Dispatch background push notification to target user(s)
      sendPushToAllTokens(
        data.title,
        data.message,
        '/',
        data.targetType === 'specific' ? data.targetEmployeeId : undefined
      ).catch(e => {
        console.warn('Erro ao disparar push notification:', e);
      });

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao enviar notificação personalizada:', err);
      return { success: false, error: err.message || 'Erro ao salvar notificação.' };
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    setReadNotificationIds(prev => Array.from(new Set([...prev, notifId])));
    if (notifId.startsWith('cancellation_')) {
      const cancellationId = notifId.replace('cancellation_', '');
      await handleMarkCancellationRead(cancellationId);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unreadIds = allNotifications.filter(n => !n.isRead).map(n => n.id);
    setReadNotificationIds(prev => Array.from(new Set([...prev, ...unreadIds])));

    const unreadCancellationNotifs = allNotifications.filter(n => !n.isRead && n.type === 'cancellation');
    for (const notif of unreadCancellationNotifs) {
      const cancellationId = notif.id.replace('cancellation_', '');
      await handleMarkCancellationRead(cancellationId);
    }
  };

  const handleDismissNotification = async (notifId: string) => {
    setDismissedNotificationIds(prev => Array.from(new Set([...prev, notifId])));
  };

  const handleDeleteCustomNotification = async (customNotifId: string) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'settings', 'custom_notifications');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const items: CustomNotificationDoc[] = docSnap.data().items || [];
        const updated = items.filter(i => i.id !== customNotifId);
        await setDoc(docRef, { items: updated }, { merge: true });
      }
    } catch (err) {
      console.error('Erro ao excluir notificação do histórico:', err);
    }
  };

  const handleUpdatePhoto = async (employeeId: string, photoUrl: string) => {
    if (!db) return;
    try {
      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, { photoUrl });

      setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, photoUrl } : emp));
      if (selectedStoryEmployee?.id === employeeId) {
        setSelectedStoryEmployee(prev => prev ? { ...prev, photoUrl } : null);
      }
    } catch (error: any) {
      console.error("Erro ao atualizar foto de perfil:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    }
  };

  const handleUpdateEmployeeDetails = async (employeeId: string, updatedFields: Partial<Employee>) => {
    if (!db) return;
    
    // Optimistic UI Update
    setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, ...updatedFields } : emp));
    if (selectedStoryEmployee?.id === employeeId) {
      setSelectedStoryEmployee(prev => prev ? { ...prev, ...updatedFields } : null);
    }

    try {
      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, updatedFields);
    } catch (error: any) {
      console.error("Erro ao atualizar dados do funcionário:", error);
      
      // Revert on failure (fetch fresh data or just reload the window for safety in this simple implementation)
      // A more robust implementation would store the previous state and revert it.
      // For now, we will revert by triggering a re-fetch or informing the user.
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
      
      // Simple revert (re-fetching the document to ensure consistency)
      try {
        const docSnap = await getDoc(doc(db, 'employees', employeeId));
        if (docSnap.exists()) {
          const freshData = { id: docSnap.id, ...docSnap.data() } as Employee;
          setEmployees(prev => prev.map(emp => emp.id === employeeId ? freshData : emp));
          if (selectedStoryEmployee?.id === employeeId) {
            setSelectedStoryEmployee(freshData);
          }
        }
      } catch (revertErr) {
        console.error("Failed to revert state", revertErr);
      }
    }
  };



  // Native browser & mobile device notification trigger
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const userEmailLower = (user?.email || '').trim().toLowerCase();
      const myRecord = simulationActive
        ? employees.find(e => e.id === simulatedEmployeeId)
        : (userEmailLower
            ? employees.find(e => (e.email || '').trim().toLowerCase() === userEmailLower || (user?.uid && e.userId === user.uid))
            : null);

      // Filter unread notifications to ONLY those intended FOR this specific user/device to pop up natively:
      const unreadList = allNotifications.filter(n => {
        if (n.isRead) return false;
        if (n.type === 'custom') {
          // If targeted to a specific employee, only pop up if it's meant for this user (or sent to all)
          const isTargetedToMe = n.employeeId === 'all' || !n.employeeId || (myRecord && n.employeeId === myRecord.id);
          return isTargetedToMe;
        }
        return true;
      });

      if (unreadList.length === 0) return;

      let notifiedIds: string[] = [];
      try {
        const stored = localStorage.getItem('notified_ids_set');
        if (stored) notifiedIds = JSON.parse(stored);
      } catch {
        notifiedIds = [];
      }

      const newUnread = unreadList.filter(n => !notifiedIds.includes(n.id));

      if (newUnread.length > 0) {
        const emitDeviceNotifications = async () => {
          const updatedIds = [...notifiedIds];

          for (const item of newUnread) {
            try {
              if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                  await reg.showNotification(item.title, {
                    body: item.message,
                    icon: '/logo.svg',
                    badge: '/logo.svg',
                    vibrate: [200, 100, 200],
                    tag: item.id,
                  } as NotificationOptions & { vibrate?: number[] });
                  updatedIds.push(item.id);
                  continue;
                }
              }
              // Fallback
              new Notification(item.title, {
                body: item.message,
                icon: '/logo.svg'
              });
              updatedIds.push(item.id);
            } catch (e) {
              console.error('Erro ao emitir notificação nativa:', e);
            }
          }

          localStorage.setItem('notified_ids_set', JSON.stringify(Array.from(new Set(updatedIds))));
        };

        emitDeviceNotifications();
      }
    }
  }, [allNotifications]);

  const handleSaveEmployee = async (data: Partial<Employee>): Promise<{ success: boolean; error?: string }> => {
    if (!user || !db) return { success: false, error: "Usuário não autenticado." };

    const sanitizedData = { ...data };
    if (sanitizedData.email) {
      sanitizedData.email = sanitizedData.email.trim().toLowerCase();
    }

    // Validation: Unique Artistic Name
    if (sanitizedData.artisticName) {
      const isArtisticNameTaken = employees.some(emp => 
        emp.artisticName.trim().toLowerCase() === sanitizedData.artisticName?.trim().toLowerCase() && 
        emp.id !== selectedEmployee?.id
      );

      if (isArtisticNameTaken) {
        return { 
          success: false, 
          error: `O nome artístico "${sanitizedData.artisticName}" já está em uso. Por favor, escolha outro.` 
        };
      }
    }

    try {
      if (selectedEmployee) {
        const empRef = doc(db, 'employees', selectedEmployee.id);
        
        // Detect if level, rates or extra rates changed
        const levelChanged = sanitizedData.level && sanitizedData.level !== selectedEmployee.level;
        const dailyRateChanged = sanitizedData.dailyRate !== undefined && sanitizedData.dailyRate !== selectedEmployee.dailyRate;
        const partyRateChanged = sanitizedData.partyRate !== undefined && sanitizedData.partyRate !== selectedEmployee.partyRate;
        const extraHourRateChanged = sanitizedData.extraHourRate !== undefined && sanitizedData.extraHourRate !== selectedEmployee.extraHourRate;

        let currentPromotions: Promotion[] = sanitizedData.promotions || selectedEmployee.promotions || [];

        if (levelChanged || dailyRateChanged || partyRateChanged || extraHourRateChanged) {
          const effectiveDate = sanitizedData.promotionEffectiveDate || format(new Date(), 'yyyy-MM-dd');
          
          const newPromotion: Promotion = {
            id: Math.random().toString(36).substring(2, 9),
            date: effectiveDate,
            previousLevel: selectedEmployee.level,
            newLevel: sanitizedData.level || selectedEmployee.level,
            previousDailyRate: selectedEmployee.dailyRate,
            newDailyRate: sanitizedData.dailyRate !== undefined ? sanitizedData.dailyRate : selectedEmployee.dailyRate,
            previousPartyRate: selectedEmployee.partyRate,
            newPartyRate: sanitizedData.partyRate !== undefined ? sanitizedData.partyRate : selectedEmployee.partyRate,
          };

          currentPromotions = [...currentPromotions, newPromotion];
        }

        // Recalculate full timeline to ensure level, rates, and workDays are completely consistent
        const recalculated = recalculateEmployeeTimeline(
          { ...selectedEmployee, ...sanitizedData },
          currentPromotions
        );

        sanitizedData.promotions = recalculated.promotions;
        sanitizedData.level = recalculated.level;
        sanitizedData.dailyRate = recalculated.dailyRate;
        sanitizedData.partyRate = recalculated.partyRate;
        sanitizedData.workDays = recalculated.workDays;

        delete sanitizedData.promotionEffectiveDate;
        await updateDoc(empRef, sanitizedData);
      } else {
        // Ao criar novo, o userId pode ser vazio se for um convite por email
        // Se o email for do próprio admin, vincula a ele, senão deixa para o funcionário vincular no primeiro login
        const isSelf = sanitizedData.email === user.email?.trim().toLowerCase();
        await addDoc(collection(db, 'employees'), {
          ...sanitizedData,
          userId: isSelf ? user.uid : '',
          workDays: []
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error("Error saving employee:", error);
      handleFirestoreError(error, selectedEmployee ? OperationType.UPDATE : OperationType.CREATE, selectedEmployee ? `employees/${selectedEmployee.id}` : 'employees');
      return { 
        success: false, 
        error: "Erro ao salvar funcionário. Verifique sua conexão." 
      };
    }
  };

  const handleInactivateEmployee = useCallback(async (id: string) => {
    if (!id || !db) return;
    try {
      const docRef = doc(db, 'employees', id);
      await updateDoc(docRef, {
        status: 'inactive',
        inactivatedAt: new Date().toISOString()
      });
      console.log("Employee inactivated successfully:", id);
    } catch (error: any) {
      console.error("handleInactivateEmployee error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
      alert("Erro ao desativar funcionário: " + (error.message || "Erro desconhecido."));
      throw error;
    }
  }, [db]);

  const handleReactivateEmployee = useCallback(async (id: string) => {
    if (!id || !db) return;
    try {
      const docRef = doc(db, 'employees', id);
      await updateDoc(docRef, {
        status: 'active',
        inactivatedAt: null
      });
      console.log("Employee reactivated successfully:", id);
    } catch (error: any) {
      console.error("handleReactivateEmployee error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
      alert("Erro ao reativar funcionário: " + (error.message || "Erro desconhecido."));
      throw error;
    }
  }, [db]);

  const handlePurgeExpiredInactives = useCallback(async () => {
    if (!db) return;
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const expired = employees.filter(emp => {
      if (emp.status !== 'inactive' || !emp.inactivatedAt) return false;
      const inactTime = new Date(emp.inactivatedAt).getTime();
      return (now - inactTime) >= SIX_MONTHS_MS;
    });

    if (expired.length === 0) {
      alert("Nenhum funcionário desativado há mais de 6 meses encontrado.");
      return;
    }

    if (!window.confirm(`Deseja excluir definitivamente ${expired.length} funcionário(s) desativado(s) há mais de 6 meses? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      for (const emp of expired) {
        await deleteDoc(doc(db, 'employees', emp.id));
      }
      alert(`${expired.length} funcionário(s) desativado(s) há mais de 6 meses excluído(s) com sucesso da base de dados.`);
    } catch (error: any) {
      console.error("handlePurgeExpiredInactives error:", error);
      alert("Erro ao excluir desativados expirados: " + error.message);
    }
  }, [db, employees]);

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
      handleFirestoreError(error, OperationType.DELETE, `employees/${id}`);
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
      const monthDays = emp.workDays.filter(d => isSameMonth(parseISO(d.date), currentMonth) && !d.isCancelled);
      
      const earnings = monthDays.reduce((acc, day) => {
        let dayBase = 0;
        if (day.isReducedHours && day.customTotalPay !== undefined && day.customTotalPay >= 0) {
          dayBase = day.customTotalPay;
        } else if (day.type === 'common') {
          dayBase = day.dailyRateAtTime !== undefined ? day.dailyRateAtTime : emp.dailyRate;
        } else if (day.type === 'party') {
          dayBase = day.partyRateAtTime !== undefined ? day.partyRateAtTime : emp.partyRate;
        }
        const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : emp.extraHourRate;
        const extra = (day.extraHours || 0) * extraRate;
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
          let typeLabel = workDay.type === 'common' ? 'CCSP' : 'Festa';
          if (workDay.isReducedHours) {
            typeLabel += ` [Reduzido: ${workDay.customHoursText || 'Acordo'} - R$${workDay.customTotalPay || 0}]`;
          }
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
      handleFirestoreError(error, OperationType.UPDATE, `employees/${employeeId}`);
    }
  };

  const handleUpdateAvailabilities = async (employeeId: string, availabilities: string[]) => {
    if (!user || !db) return;
    try {
      let finalAvailabilities = availabilities;

      if (!isAdmin) {
        const empRef = doc(db, 'employees', employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const empData = empSnap.data() as Employee;
          const currentAvails = empData.availabilities || [];
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const currentMonthKeyNow = format(new Date(), 'yyyy-MM');

          // Preserva disponibilidades de datas passadas ou meses encerrados
          const protectedAvails = currentAvails.filter(av => {
            if (av.startsWith('login_') || av.startsWith('no_avail_')) return false;
            const dateStr = av.split('_')[0];
            const monthKey = dateStr.slice(0, 7);
            return dateStr < todayStr || monthKey < currentMonthKeyNow;
          });

          finalAvailabilities = Array.from(new Set([...availabilities, ...protectedAvails]));
        }
      }

      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, { availabilities: finalAvailabilities });
    } catch (error: any) {
      console.error("Error updating availabilities:", error);
      alert("Erro ao salvar suas disponibilidades: " + (error.message || "Verifique sua conexão e permissões do banco de dados."));
      handleFirestoreError(error, OperationType.UPDATE, `employees/${employeeId}`);
    }
  };

  const handleUpdateDeadline = async (monthKey: string, deadlineIso: string) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'settings', 'deadlines');
      await setDoc(docRef, { [monthKey]: deadlineIso }, { merge: true });
    } catch (error) {
      console.error("Error updating deadline:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/deadlines');
    }
  };

  const handleUpdateDayConfig = async (dateStr: string, config: DayConfig) => {
    if (!db) return;
    try {
      const cleanConfig: Record<string, any> = {
        isCommon: !!config.isCommon,
        isParty: !!config.isParty,
        partyDeadline: config.partyDeadline || '',
        partyTime: config.partyTime || '',
        parties: config.parties || [],
        isExtraordinaryOpen: !!config.isExtraordinaryOpen,
        extraordinaryDeadline: config.extraordinaryDeadline || '',
        extraordinaryScope: config.extraordinaryScope || 'all',
        extraordinaryPartyIds: config.extraordinaryPartyIds || null,
        extraordinaryCcspOpen: config.extraordinaryCcspOpen ?? null
      };
      if (config.extraordinaryLockedAvailabilities) {
        cleanConfig.extraordinaryLockedAvailabilities = config.extraordinaryLockedAvailabilities;
      }
      const docRef = doc(db, 'settings', 'dayConfigs');
      await setDoc(docRef, { [dateStr]: cleanConfig }, { merge: true });
    } catch (error) {
      console.error("Error updating day config:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/dayConfigs');
    }
  };

  const handleSaveParty = async (party: PartyDetails, assignedEmployeeIds: string[] = []) => {
    if (!db || !user) return;
    try {
      const partyId = party.partyId || party.id || `p_${Date.now()}`;
      const docId = `${party.date}_${partyId}`;
      const partyDocRef = doc(db, 'party_events', docId);

      const partyDataToSave: PartyDetails = {
        ...party,
        id: docId,
        partyId,
        assignedEmployeeIds,
        updatedAt: new Date().toISOString()
      };

      await setDoc(partyDocRef, partyDataToSave, { merge: true });

      // Sincroniza com as configurações do dia (dayConfigs)
      const currentCfg = dayConfigs[party.date] || { isCommon: false, isParty: false };
      const currentParties = currentCfg.parties || [];
      const existingIndex = currentParties.findIndex(p => p.id === partyId);
      
      let updatedPartiesList = [...currentParties];
      if (existingIndex >= 0) {
        updatedPartiesList[existingIndex] = {
          id: partyId,
          name: party.name,
          time: party.time || currentParties[existingIndex].time
        };
      } else {
        updatedPartiesList.push({
          id: partyId,
          name: party.name,
          time: party.time || ''
        });
      }

      await handleUpdateDayConfig(party.date, {
        ...currentCfg,
        isParty: true,
        partyTime: party.time || currentCfg.partyTime || '',
        parties: updatedPartiesList
      });

      // Sincroniza os dias de trabalho (workDays) dos funcionários atribuídos a esta festa
      for (const emp of employees) {
        const isAssigned = assignedEmployeeIds.includes(emp.id);
        const currentWorkDays = emp.workDays || [];
        const hasPartyWorkDay = currentWorkDays.some(
          d => d.date === party.date && d.type === 'party' && (d.partyId === partyId || (!d.partyId && d.partyName === party.name))
        );

        if (isAssigned && !hasPartyWorkDay) {
          const newWorkDay: WorkDay = {
            date: party.date,
            type: 'party',
            partyId,
            partyName: party.name
          };
          await handleUpdateDays(emp.id, [...currentWorkDays, newWorkDay]);
        } else if (!isAssigned && hasPartyWorkDay) {
          const filtered = currentWorkDays.filter(
            d => !(d.date === party.date && d.type === 'party' && (d.partyId === partyId || (!d.partyId && d.partyName === party.name)))
          );
          await handleUpdateDays(emp.id, filtered);
        }
      }
    } catch (err: any) {
      console.error("Erro ao salvar festa:", err);
      alert("Erro ao salvar detalhes da festa: " + (err.message || String(err)));
      throw err;
    }
  };

  const handleDeleteParty = async (partyId: string, dateStr: string) => {
    if (!db || !user) return;
    try {
      const docId = `${dateStr}_${partyId}`;
      await deleteDoc(doc(db, 'party_events', docId));

      // Atualiza o dayConfig removendo esta festa
      const currentCfg = dayConfigs[dateStr];
      if (currentCfg) {
        const remainingParties = (currentCfg.parties || []).filter(p => p.id !== partyId);
        await handleUpdateDayConfig(dateStr, {
          ...currentCfg,
          isParty: remainingParties.length > 0,
          parties: remainingParties
        });
      }

      // Remove dos workDays dos funcionários
      for (const emp of employees) {
        const hasPartyWorkDay = (emp.workDays || []).some(
          d => d.date === dateStr && d.type === 'party' && (d.partyId === partyId)
        );
        if (hasPartyWorkDay) {
          const filtered = (emp.workDays || []).filter(
            d => !(d.date === dateStr && d.type === 'party' && d.partyId === partyId)
          );
          await handleUpdateDays(emp.id, filtered);
        }
      }
    } catch (err: any) {
      console.error("Erro ao excluir festa:", err);
      alert("Erro ao excluir festa: " + (err.message || String(err)));
    }
  };

  const handleCancelWorkDay = async (employeeId: string, dateStr: string, type: 'common' | 'party', employeeName: string) => {
    if (!user || !db) return;
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const monthKey = dateStr.slice(0, 7);
      const currentMonthKeyNow = format(new Date(), 'yyyy-MM');

      if (!isAdmin && (dateStr < todayStr || monthKey < currentMonthKeyNow)) {
        return;
      }

      const empRef = doc(db, 'employees', employeeId);
      const empSnap = await getDoc(empRef);
      if (empSnap.exists()) {
        const empData = empSnap.data() as Employee;
        const updatedWorkDays = (empData.workDays || []).map(d => {
          if (d.date === dateStr) {
            return {
              ...d,
              isCancelled: true,
              cancelledAt: new Date().toISOString(),
              cancellationViewed: false
            };
          }
          return d;
        });

        // Remove the availability for this date so the employee doesn't show as available anymore after cancelling
        const currentAvailabilities = empData.availabilities || [];
        const updatedAvailabilities = currentAvailabilities.filter(av => 
          av !== dateStr && av !== `${dateStr}_common` && av !== `${dateStr}_party`
        );

        await updateDoc(empRef, { 
          workDays: updatedWorkDays,
          availabilities: updatedAvailabilities
        });
      }
    } catch (error: any) {
      console.error("Error cancelling workday:", error);
      alert("Erro ao cancelar escala: " + (error.message || String(error)));
    }
  };

  const handleMarkCancellationRead = async (cancellationId: string) => {
    if (!db) return;
    try {
      const [employeeId, dateStr] = cancellationId.split('_');
      if (employeeId && dateStr) {
        const empRef = doc(db, 'employees', employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const empData = empSnap.data() as Employee;
          const updatedWorkDays = (empData.workDays || []).map(d => {
            if (d.date === dateStr) {
              return { ...d, cancellationViewed: true };
            }
            return d;
          });
          await updateDoc(empRef, { workDays: updatedWorkDays });
        }
      }
    } catch (error) {
      console.error("Error marking cancellation as read:", error);
    }
  };

  const handleDismissCancellation = async (cancellationId: string) => {
    if (!db) return;
    try {
      const [employeeId, dateStr] = cancellationId.split('_');
      if (employeeId && dateStr) {
        const empRef = doc(db, 'employees', employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const empData = empSnap.data() as Employee;
          const updatedWorkDays = (empData.workDays || []).map(d => {
            if (d.date === dateStr) {
              return { ...d, cancellationDismissed: true };
            }
            return d;
          });
          await updateDoc(empRef, { workDays: updatedWorkDays });
        }
      }
    } catch (error) {
      console.error("Error dismissing cancellation:", error);
    }
  };

  const handleRevertCancellation = async ({
    employeeId,
    dates,
    reason,
    mode
  }: {
    employeeId: string;
    dates: string[];
    reason: string;
    mode: 'restore_workday' | 'ignore_penalty_only';
  }): Promise<{ success: boolean; error?: string }> => {
    if (!db) return { success: false, error: 'Banco de dados indisponível.' };
    try {
      const empRef = doc(db, 'employees', employeeId);
      const empSnap = await getDoc(empRef);
      if (!empSnap.exists()) {
        return { success: false, error: 'Colaborador não encontrado.' };
      }

      const empData = empSnap.data() as Employee;
      const updatedWorkDays = (empData.workDays || []).map(wd => {
        if (dates.includes(wd.date)) {
          return {
            ...wd,
            isCancelled: mode === 'restore_workday' ? false : true,
            cancellationIgnored: true,
            revertedAt: new Date().toISOString(),
            reversionReason: reason,
            revertedBy: user?.email || 'Admin',
            reversionMode: mode,
            cancellationDismissed: true,
            cancellationViewed: true
          };
        }
        return wd;
      });

      await updateDoc(empRef, { workDays: updatedWorkDays });

      // Atualiza estado do React
      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, workDays: updatedWorkDays } : e));
      if (selectedStoryEmployee?.id === employeeId) {
        setSelectedStoryEmployee(prev => prev ? { ...prev, workDays: updatedWorkDays } : null);
      }

      // Salva log de auditoria
      try {
        const logDocId = `reversion_${employeeId}_${Date.now()}`;
        const logRef = doc(db, 'cancellations', logDocId);
        await setDoc(logRef, {
          type: 'cancellation_reverted',
          employeeId,
          employeeName: empData.artisticName || empData.name,
          dates,
          reason,
          mode,
          revertedAt: new Date().toISOString(),
          revertedBy: user?.email || 'Admin'
        }, { merge: true });
      } catch (logErr) {
        console.warn("Log de reversão salvo:", logErr);
      }

      return { success: true };
    } catch (error: any) {
      console.error("Erro ao reverter cancelamento:", error);
      return { success: false, error: error.message || 'Falha ao processar reversão no banco de dados.' };
    }
  };

  const handleRestoreBackup = async (restoredData: { employees: Employee[]; dayConfigs?: Record<string, DayConfig>; deadlines?: Record<string, string> }) => {
    if (!user || !db) return;
    try {
      const batch = writeBatch(db);

      if (restoredData.employees && Array.isArray(restoredData.employees)) {
        restoredData.employees.forEach(emp => {
          if (!emp.id) return;
          const empRef = doc(db, 'employees', emp.id);
          batch.set(empRef, emp, { merge: true });
        });
      }

      if (restoredData.dayConfigs) {
        Object.entries(restoredData.dayConfigs).forEach(([dayKey, config]) => {
          const cfgRef = doc(db, 'dayConfigs', dayKey);
          batch.set(cfgRef, config, { merge: true });
        });
      }

      if (restoredData.deadlines) {
        Object.entries(restoredData.deadlines).forEach(([monthKey, val]) => {
          const dlRef = doc(db, 'deadlines', monthKey);
          batch.set(dlRef, { deadline: val }, { merge: true });
        });
      }

      await batch.commit();

      if (restoredData.employees) {
        setEmployees(restoredData.employees);
      }
      if (restoredData.dayConfigs) {
        setDayConfigs(prev => ({ ...prev, ...restoredData.dayConfigs }));
      }
      if (restoredData.deadlines) {
        setDeadlines(prev => ({ ...prev, ...restoredData.deadlines }));
      }

      alert("Restauração concluída com sucesso no banco de dados!");
    } catch (err: any) {
      console.error("Erro ao restaurar backup:", err);
      alert("Erro ao restaurar backup: " + (err.message || "Verifique sua conexão e tente novamente."));
    }
  };

  const handleLogin = async () => {
    if (!auth) return;
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      const isCancelError = error && (
        error.code === 'auth/cancelled-popup-request' || 
        error.code === 'auth/popup-closed-by-user' ||
        error.message?.includes('cancelled-popup-request') ||
        error.message?.includes('popup-closed-by-user')
      );
      if (isCancelError) {
        console.log("Login cancelado pelo usuário ou janela fechada.");
      } else {
        console.error("Login error:", error);
        if (isInAppBrowser()) {
          setAuthError("O login do Google foi bloqueado pelo navegador do WhatsApp/Instagram. Por favor, copie o link acima e abra direto no Safari ou Chrome.");
        } else {
          setAuthError("Não foi possível conectar com o Google (" + (error.message || "Erro de conexão") + "). Tente abrir no Chrome ou Safari.");
        }
      }
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

  if (loading || adminCheckLoading || (user && employeesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg p-4">
        <div className="bg-brand-card border border-brand-border p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full text-center flex flex-col items-center">
          <div className="mb-6 flex justify-center">
            <Logo size={96} />
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-brand-primary mb-2">
            Liga Positiva{isSimulationEnabled ? ' Dev2' : ''}
          </h1>
          <p className="text-gray-400 mb-6">Administração de Recreadores</p>
          
          {/* Guia de Navegador In-App (WhatsApp/Instagram) */}
          <InAppBrowserGuide />

          {authError && (
            <div className="w-full my-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 text-left flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2 shadow-lg"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
          
          <p className="mt-4 text-xs text-gray-500">Todo e qualquer problema contate o administrador (Cacheado)</p>
          <p className="mt-1 text-xs text-gray-500">
            Ao entrar, você concorda com nossos termos de serviço.
          </p>
        </div>
        <PWAInstallPrompt />
      </div>
    );
  }

  // Interface do Funcionário (Não Admin)
  if (!isViewingAsAdmin) {
    const userEmailLower = (user?.email || '').trim().toLowerCase();
    const myEmployeeRecord = simulationActive
      ? employees.find(emp => emp.id === simulatedEmployeeId)
      : (employees.find(emp => 
          (userEmailLower && (emp.email || '').trim().toLowerCase() === userEmailLower) || 
          (user?.uid && emp.userId === user.uid)
        ) || employees[0]);

    return (
      <div className="min-h-screen bg-brand-bg pb-28">
        {isSimulationEnabled && isAdmin && (
          <SimulationBanner 
            employees={employees}
            simulationActive={simulationActive}
            setSimulationActive={setSimulationActive}
            simulatedEmployeeId={simulatedEmployeeId}
            setSimulatedEmployeeId={setSimulatedEmployeeId}
            realUserEmail={user.email}
          />
        )}
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
          isAdmin={false}
          notifications={allNotifications}
          unreadNotificationsCount={unreadNotificationsCount}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onDismissNotification={handleDismissNotification}
          onOpenSendNotificationModal={() => setIsSendNotificationModalOpen(true)}
          onOpenPushDiagnostics={() => setIsPushDiagnosticsOpen(true)}
          customNotificationsDocs={customNotificationsDocs}
          onDeleteCustomNotification={handleDeleteCustomNotification}
          onNavigateToCalendar={() => {
            setSidebarTab('cancellations');
            setViewMode('calendar');
          }}
        />

        <main className={`w-full mx-auto px-2 md:px-4 py-4 md:py-8 ${employeeActiveTab === 'master_schedule' ? 'max-w-7xl' : 'max-w-4xl'}`}>
          {myEmployeeRecord ? (
            <div className="space-y-6">
              {employeeActiveTab === 'schedule' ? (
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                  <div className="w-full md:w-1/3">
                    <EmployeeCard 
                      employee={myEmployeeRecord}
                      onEdit={() => {}}
                      onManageDays={() => {}}
                      onViewStory={() => setEmployeeActiveTab('profile')}
                      currentMonth={currentMonth}
                      isReadOnly={true}
                      onUpdateDetails={handleUpdateEmployeeDetails}
                    />
                  </div>
                  <div className="w-full md:w-2/3 space-y-4">
                    <h2 className="text-lg md:text-xl font-black text-brand-text mb-2">Meu Calendário de Trabalho / Disponibilidade</h2>
                    <CalendarView 
                      employees={[myEmployeeRecord]} // Pass the simulated employee as the single record
                      allEmployees={employees} // Pass all employees to list co-workers
                      onUpdateDays={() => {}}
                      currentMonth={currentMonth}
                      setCurrentMonth={setCurrentMonth}
                      isReadOnly={false}
                      isAdmin={false}
                      deadlines={deadlines}
                      onUpdateAvailabilities={handleUpdateAvailabilities}
                      dayConfigs={dayConfigs}
                      onUpdateDayConfig={handleUpdateDayConfig}
                      onCancelWorkDay={handleCancelWorkDay}
                      cancellations={cancellations}
                      onDismissCancellation={handleDismissCancellation}
                      onMarkCancellationRead={handleMarkCancellationRead}
                      sidebarTab={sidebarTab}
                      onSidebarTabChange={setSidebarTab}
                    />
                  </div>
                </div>
              ) : employeeActiveTab === 'master_schedule' ? (
                <Suspense fallback={<ViewFallback />}>
                  <MonthlyScheduleView 
                    employees={activeEmployees}
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    currentEmployee={myEmployeeRecord}
                    isAdmin={false}
                    dayConfigs={dayConfigs}
                  />
                </Suspense>
              ) : employeeActiveTab === 'earnings' ? (
                <Suspense fallback={<ViewFallback />}>
                  <EmployeeEarningsView 
                    employee={myEmployeeRecord}
                    onViewStory={() => setEmployeeActiveTab('profile')}
                  />
                </Suspense>
              ) : (
                <Suspense fallback={<ViewFallback />}>
                  <EmployeeStoryView 
                    employee={myEmployeeRecord}
                    isAdmin={isViewingAsAdmin}
                    onEditEmployee={() => {
                      setSelectedEmployee(myEmployeeRecord);
                      setIsEmployeeModalOpen(true);
                    }}
                    onUpdatePhoto={(photoUrl) => handleUpdatePhoto(myEmployeeRecord.id, photoUrl)}
                    onUpdateDetails={handleUpdateEmployeeDetails}
                    canEditPhoto={true}
                    onNavigateToEarnings={() => setEmployeeActiveTab('earnings')}
                  />
                </Suspense>
              )}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-lg">Você ainda não foi vinculado a um registro de funcionário.</p>
              <p className="text-sm text-gray-500 mt-2">Entre em contato com o Cacheado e informe seu e-mail: {simulationActive ? '[Simulado Sem Registro]' : user.email}</p>
            </div>
          )}
        </main>
        
        {isSendNotificationModalOpen && (
          <Suspense fallback={null}>
            <SendNotificationModal
              isOpen={isSendNotificationModalOpen}
              onClose={() => setIsSendNotificationModalOpen(false)}
              onSend={handleSendCustomNotification}
              employees={activeEmployees}
            />
          </Suspense>
        )}
        
        <WhatsNewModal isAdmin={isViewingAsAdmin} />
        <PWAInstallPrompt />

        {/* Floating Navigation Dock for Employees */}
        <NavigationDock 
          isAdmin={false}
          employeeActiveTab={employeeActiveTab}
          onEmployeeTabChange={(tab) => setEmployeeActiveTab(tab)}
        />
      </div>
    );
  }

  // Interface do Admin
  return (
    <div className="min-h-screen bg-brand-bg pb-28">
      {isSimulationEnabled && isAdmin && (
        <SimulationBanner 
          employees={activeEmployees}
          simulationActive={simulationActive}
          setSimulationActive={setSimulationActive}
          simulatedEmployeeId={simulatedEmployeeId}
          setSimulatedEmployeeId={setSimulatedEmployeeId}
          realUserEmail={user.email}
        />
      )}
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
        isAdmin={isViewingAsAdmin}
        notifications={allNotifications}
        unreadNotificationsCount={unreadNotificationsCount}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onDismissNotification={handleDismissNotification}
        onOpenSendNotificationModal={() => setIsSendNotificationModalOpen(true)}
        onOpenAdvancedSettingsModal={() => setIsAdvancedSettingsOpen(true)}
        onOpenPushDiagnostics={() => setIsPushDiagnosticsOpen(true)}
        customNotificationsDocs={customNotificationsDocs}
        onDeleteCustomNotification={handleDeleteCustomNotification}
        onNavigateToCalendar={() => {
          setSidebarTab('cancellations');
          setViewMode('calendar');
          setTimeout(() => {
            document.getElementById('sidebar-panel')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
      />

      <main className="w-full mx-auto px-2 md:px-4 py-4 md:py-8 max-w-7xl">
        {isViewingAsAdmin && unreadCancellations.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-400 shrink-0" size={24} />
              <div>
                <p className="text-sm font-black">Atenção! Existem novos cancelamentos de escala:</p>
                <p className="text-xs text-red-300 font-bold mt-0.5">
                  {unreadCancellations.map(c => `${c.employeeName} (Dia ${format(parseISO(c.date), 'dd/MM')})`).join(', ')}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setSidebarTab('cancellations');
                setViewMode('calendar');
                setTimeout(() => {
                  document.getElementById('sidebar-panel')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-md animate-bounce"
            >
              Ver Quadro de Cancelamentos
            </button>
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="space-y-6">
            {isViewingAsAdmin && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-card/90 backdrop-blur-md p-4 rounded-2xl border border-brand-border shadow-md">
                <div>
                  <h2 className="text-lg font-black text-brand-text flex items-center gap-2">
                    <span>Equipe de Recreação</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                      {filteredEmployees.length} {filteredEmployees.length === 1 ? 'recreador' : 'recreadores'}
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5">Gerencie cartões, taxas, diárias e atalhos individuais</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(undefined);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black px-4 py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs md:text-sm shrink-0 active:scale-95"
                >
                  <UserPlus size={18} />
                  <span>Adicionar Recreador</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isViewingAsAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(undefined);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="border-2 border-dashed border-brand-border hover:border-brand-primary/60 bg-brand-card/30 hover:bg-brand-card/80 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-brand-muted hover:text-brand-primary transition-all group min-h-[260px] shadow-sm"
                >
                  <div className="w-14 h-14 rounded-full bg-brand-primary/10 group-hover:bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary transition-all group-hover:scale-110">
                    <UserPlus size={26} />
                  </div>
                  <div className="text-center">
                    <p className="font-extrabold text-sm text-brand-text group-hover:text-brand-primary">Adicionar Recreador</p>
                    <p className="text-xs text-brand-muted mt-1">Cadastrar novo membro na equipe</p>
                  </div>
                </button>
              )}

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
                  onViewStory={(e) => setSelectedStoryEmployee(e)}
                  currentMonth={currentMonth}
                  onUpdateDetails={handleUpdateEmployeeDetails}
                />
              ))}
              {filteredEmployees.length === 0 && !isViewingAsAdmin && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-gray-500 text-lg">Nenhum funcionário encontrado.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <EmployeeList 
            employees={employees}
            onEdit={(e) => {
              setSelectedEmployee(e);
              setIsEmployeeModalOpen(true);
            }}
            onManageDays={(e) => {
              setSelectedEmployee(e);
              setIsManageDaysModalOpen(true);
            }}
            onViewStory={(e) => setSelectedStoryEmployee(e)}
            onInactivate={handleInactivateEmployee}
            onReactivate={handleReactivateEmployee}
            onDelete={handleDeleteEmployee}
            onPurgeExpired={handlePurgeExpiredInactives}
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
            isAdmin={true}
            deadlines={deadlines}
            onUpdateDeadline={handleUpdateDeadline}
            dayConfigs={dayConfigs}
            onUpdateDayConfig={handleUpdateDayConfig}
            onCancelWorkDay={handleCancelWorkDay}
            cancellations={cancellations}
            onDismissCancellation={handleDismissCancellation}
            onMarkCancellationRead={handleMarkCancellationRead}
            sidebarTab={sidebarTab}
            onSidebarTabChange={setSidebarTab}
            onOpenRevertCancellation={handleOpenRevertCancellation}
          />
        )}

        {(viewMode === 'dashboard' || viewMode === 'kpis') && isViewingAsAdmin && (
          <Suspense fallback={<ViewFallback />}>
            <div className="space-y-10">
              <KpisView 
                employees={employees}
                monthConfigs={dayConfigs}
                promotions={[]}
                currentMonth={currentMonth}
              />
              <AdminDashboard 
                employees={employees}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                dayConfigs={dayConfigs}
                onOpenRevertCancellation={handleOpenRevertCancellation}
              />
            </div>
          </Suspense>
        )}

        {viewMode === 'payments' && isViewingAsAdmin && (
          <Suspense fallback={<ViewFallback />}>
            <PaymentsView 
              employees={employees}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              onUpdateDetails={handleUpdateEmployeeDetails}
              onViewStory={(e) => setSelectedStoryEmployee(e)}
            />
          </Suspense>
        )}

        {viewMode === 'master_schedule' && (
          <Suspense fallback={<ViewFallback />}>
            <MonthlyScheduleView 
              employees={employees}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              currentEmployee={simulationActive ? employees.find(e => e.id === simulatedEmployeeId) : null}
              isAdmin={isViewingAsAdmin}
              dayConfigs={dayConfigs}
            />
          </Suspense>
        )}

        {viewMode === 'parties' && isViewingAsAdmin && (
          <Suspense fallback={<ViewFallback />}>
            <PartyManagementView 
              parties={parties}
              dayConfigs={dayConfigs}
              employees={employees}
              onSaveParty={handleSaveParty}
              onDeleteParty={handleDeleteParty}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
            />
          </Suspense>
        )}
      </main>

      <EmployeeModal 
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSave={handleSaveEmployee}
        onInactivate={handleInactivateEmployee}
        onReactivate={handleReactivateEmployee}
        onDelete={handleDeleteEmployee}
        employee={selectedEmployee}
      />

      <Suspense fallback={null}>
        {selectedEmployee && isManageDaysModalOpen && (
          <ManageDaysModal 
            isOpen={isManageDaysModalOpen}
            onClose={() => setIsManageDaysModalOpen(false)}
            employee={selectedEmployee}
            onUpdateDays={handleUpdateDays}
          />
        )}

        {/* Modal de História do Funcionário */}
        {selectedStoryEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
            <div className="bg-brand-card border border-brand-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-8 p-6 relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setSelectedStoryEmployee(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-black/40 rounded-full z-20 hover:bg-black/60 transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>

              {/* Sub-navegação do modal: Perfil vs Ganhos */}
              <div className="flex items-center gap-2 mb-6 border-b border-brand-border pb-3 pr-12">
                <button
                  type="button"
                  onClick={() => setAdminStoryModalTab('profile')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    adminStoryModalTab === 'profile'
                      ? 'bg-brand-primary text-slate-900 shadow-md'
                      : 'bg-brand-bg/60 text-brand-muted hover:text-brand-text'
                  }`}
                >
                  <UserRound size={16} />
                  Perfil & Cadastro
                </button>
                <button
                  type="button"
                  onClick={() => setAdminStoryModalTab('earnings')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    adminStoryModalTab === 'earnings'
                      ? 'bg-brand-primary text-slate-900 shadow-md'
                      : 'bg-brand-bg/60 text-brand-muted hover:text-brand-text'
                  }`}
                >
                  <DollarSign size={16} />
                  Ganhos & Linha Financeira
                </button>
              </div>

              {adminStoryModalTab === 'earnings' ? (
                <EmployeeEarningsView 
                  employee={selectedStoryEmployee}
                  onViewStory={() => setAdminStoryModalTab('profile')}
                />
              ) : (
                <EmployeeStoryView 
                  employee={selectedStoryEmployee} 
                  isAdmin={isViewingAsAdmin}
                  onEditEmployee={() => {
                    const emp = selectedStoryEmployee;
                    setSelectedStoryEmployee(null);
                    setSelectedEmployee(emp);
                    setIsEmployeeModalOpen(true);
                  }}
                  onUpdatePhoto={(photoUrl) => handleUpdatePhoto(selectedStoryEmployee.id, photoUrl)}
                  onUpdateDetails={handleUpdateEmployeeDetails}
                  canEditPhoto={true}
                  onNavigateToEarnings={() => setAdminStoryModalTab('earnings')}
                />
              )}
            </div>
          </div>
        )}

        {isSendNotificationModalOpen && (
          <SendNotificationModal
            isOpen={isSendNotificationModalOpen}
            onClose={() => setIsSendNotificationModalOpen(false)}
            onSend={handleSendCustomNotification}
            employees={employees}
            onOpenDiagnostics={() => setIsPushDiagnosticsOpen(true)}
          />
        )}

        {isPushDiagnosticsOpen && (
          <Suspense fallback={<ViewFallback />}>
            <PushDiagnosticsModal
              isOpen={isPushDiagnosticsOpen}
              onClose={() => setIsPushDiagnosticsOpen(false)}
              userEmail={user?.email || undefined}
              userName={user?.displayName || undefined}
            />
          </Suspense>
        )}

        {isAdvancedSettingsOpen && (
          <Suspense fallback={<ViewFallback />}>
            <AdvancedSettingsModal
              isOpen={isAdvancedSettingsOpen}
              onClose={() => setIsAdvancedSettingsOpen(false)}
              employees={employees}
              dayConfigs={dayConfigs}
              deadlines={deadlines}
              onRestoreBackup={handleRestoreBackup}
            />
          </Suspense>
        )}

        {isRevertCancellationModalOpen && (
          <Suspense fallback={<ViewFallback />}>
            <RevertCancellationModal
              isOpen={isRevertCancellationModalOpen}
              onClose={() => setIsRevertCancellationModalOpen(false)}
              employees={employees}
              initialEmployeeId={revertCancellationTarget.employeeId}
              initialDate={revertCancellationTarget.date}
              onRevertCancellation={handleRevertCancellation}
            />
          </Suspense>
        )}
      </Suspense>
      
      <WhatsNewModal isAdmin={isViewingAsAdmin} />
      <PWAInstallPrompt />

      {/* Floating Action Dock for Admin Navigation */}
      <NavigationDock 
        isAdmin={true}
        adminViewMode={viewMode}
        onAdminViewModeChange={(mode) => setViewMode(mode)}
        partiesCount={parties.length}
      />

      <SpeedInsights />
    </div>
  );
}
