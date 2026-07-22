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
  getDocs,
  setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider, isFirebaseConfigured, handleFirestoreError, OperationType } from './lib/firebase';
import { Employee, ViewMode, WorkDay, CancellationLog, Promotion, AppNotification, CustomNotificationDoc } from './types';
import { recalculateEmployeeTimeline } from './utils/promotionUtils';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import EmployeeList from './components/EmployeeList';
import CalendarView from './components/CalendarView';
import AdminDashboard from './components/AdminDashboard';
import EmployeeModal from './components/EmployeeModal';
import ManageDaysModal from './components/ManageDaysModal';
import SendNotificationModal from './components/SendNotificationModal';
import SimulationBanner from './components/SimulationBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import Logo from './components/Logo';
import { LogIn, AlertTriangle } from 'lucide-react';
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
  const [dayConfigs, setDayConfigs] = useState<Record<string, { isCommon: boolean; isParty: boolean; partyTime?: string }>>({});
  const [sidebarTab, setSidebarTab] = useState<'availabilities' | 'cancellations'>('availabilities');
  
  // Estado para simulação de papéis (Role simulation)
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedEmployeeId, setSimulatedEmployeeId] = useState<string>('');

  // Flag de controle: ativa no modo desenvolvimento local ou via variável customizada VITE_ENABLE_SIMULATION no .env
  const isSimulationEnabled = import.meta.env.VITE_ENABLE_SIMULATION?.toLowerCase() === 'true' || import.meta.env.DEV;

  const isViewingAsAdmin = isAdmin && (!isSimulationEnabled || !simulationActive);

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isManageDaysModalOpen, setIsManageDaysModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);

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
        setDayConfigs(snapshot.data() as Record<string, { isCommon: boolean; isParty: boolean; partyTime?: string }>);
      } else {
        setDayConfigs({});
      }
    }, (error) => {
      console.error("Error loading dayConfigs:", error);
    });
    return () => unsub();
  }, [db, user]);



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

    // Se for admin, busca todos. Se não, busca pelos emails correspondentes (insensível a maiúsculas) ou por e-mail direto
    const q = isAdmin 
      ? query(collection(db, 'employees'))
      : query(
          collection(db, 'employees'), 
          where('email', 'in', emailOptions.length > 0 ? emailOptions : [''])
        );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let emps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      
      setEmployees(emps);
      setEmployeesLoading(false);

      // Auto-vincular o UID do usuário autenticado se ele for funcionário e o campo userId estiver vazio
      if (!isAdmin && emps.length > 0 && user) {
        const myEmp = emps[0];
        if (!myEmp.userId || myEmp.userId !== user.uid) {
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

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const cancellations = useMemo(() => {
    const list: CancellationLog[] = [];
    employees.forEach(emp => {
      (emp.workDays || []).forEach(wd => {
        if (wd.isCancelled && !wd.cancellationDismissed) {
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

  useEffect(() => {
    if (!db || !user) {
      setCustomNotificationsDocs([]);
      return;
    }

    const unsub = onSnapshot(doc(db, 'settings', 'custom_notifications'), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const allItems: CustomNotificationDoc[] = data?.items || [];
        
        // Mantém apenas notificações criadas no dia de hoje (limpeza automática no final do dia)
        const todayItems = allItems.filter(item => {
          try {
            return isToday(parseISO(item.createdAt));
          } catch {
            return true;
          }
        });

        setCustomNotificationsDocs(todayItems);

        // Se existirem notificações antigas de dias anteriores, limpa silenciosamente no Firestore em segundo plano
        if (isViewingAsAdmin && allItems.length !== todayItems.length) {
          try {
            await setDoc(doc(db, 'settings', 'custom_notifications'), { items: todayItems }, { merge: true });
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
    const myRecord = simulationActive
      ? employees.find(e => e.id === simulatedEmployeeId)
      : employees[0];

    customNotificationsDocs.forEach(cNotif => {
      const notifId = `custom_${cNotif.id}`;
      if (dismissedNotificationIds.includes(notifId)) return;

      const isTargetedToMe = !isViewingAsAdmin && (
        cNotif.targetType === 'all' || 
        (myRecord && cNotif.targetEmployeeId === myRecord.id)
      );

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
          isRead: isViewingAsAdmin ? true : readNotificationIds.includes(notifId),
          employeeId: cNotif.targetEmployeeId
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cancellations, deadlines, currentMonth, isViewingAsAdmin, readNotificationIds, dismissedNotificationIds, customNotificationsDocs, employees, simulationActive, simulatedEmployeeId]);

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

  // Native browser & mobile device notification trigger
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const unreadList = allNotifications.filter(n => !n.isRead);
      if (unreadList.length > 0) {
        const lastUnread = unreadList[0];
        const lastNotified = localStorage.getItem('last_notified_id');
        if (lastNotified !== lastUnread.id) {
          const emitDeviceNotification = async () => {
            try {
              // Prefer Service Worker showNotification for mobile notification bar support
              if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                  await reg.showNotification(lastUnread.title, {
                    body: lastUnread.message,
                    icon: '/logo.svg',
                    badge: '/logo.svg',
                    vibrate: [200, 100, 200],
                    tag: lastUnread.id,
                  } as NotificationOptions & { vibrate?: number[] });
                  localStorage.setItem('last_notified_id', lastUnread.id);
                  return;
                }
              }
              // Fallback to standard Notification API
              new Notification(lastUnread.title, {
                body: lastUnread.message,
                icon: '/logo.svg'
              });
              localStorage.setItem('last_notified_id', lastUnread.id);
            } catch (e) {
              console.error('Erro ao emitir notificação nativa:', e);
            }
          };
          emitDeviceNotification();
        }
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
        if (day.type === 'common') {
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
      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, { availabilities });
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

  const handleUpdateDayConfig = async (dateStr: string, config: { isCommon: boolean; isParty: boolean; partyTime?: string }) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'settings', 'dayConfigs');
      await setDoc(docRef, { [dateStr]: config }, { merge: true });
    } catch (error) {
      console.error("Error updating day config:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/dayConfigs');
    }
  };

  const handleCancelWorkDay = async (employeeId: string, dateStr: string, type: 'common' | 'party', employeeName: string) => {
    if (!user || !db) return;
    try {
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

  const handleLogin = async () => {
    if (!auth) return;
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
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl shadow-2xl max-w-md w-full text-center flex flex-col items-center">
          <div className="mb-6 flex justify-center">
            <Logo size={96} />
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-brand-primary mb-2">
            Liga Positiva{isSimulationEnabled ? ' Dev2' : ''}
          </h1>
          <p className="text-gray-400 mb-8">Administração de Recreadores</p>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
          
          <p className="mt-2 text-xs text-gray-500">Todo e qualquer problema contate o administrador (Cacheado)</p>
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
    const myEmployeeRecord = simulationActive
      ? employees.find(emp => emp.id === simulatedEmployeeId)
      : employees[0];

    return (
      <div className="min-h-screen bg-brand-bg pb-12">
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
          customNotificationsDocs={customNotificationsDocs}
          onDeleteCustomNotification={handleDeleteCustomNotification}
          onNavigateToCalendar={() => {
            setSidebarTab('cancellations');
            setViewMode('calendar');
          }}
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
                <div className="w-full md:w-2/3 space-y-4">
                  <h2 className="text-lg md:text-xl font-black text-brand-text mb-2">Meu Calendário de Trabalho / Disponibilidade</h2>
                  <CalendarView 
                    employees={[myEmployeeRecord]} // Pass the simulated employee as the single record
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
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-lg">Você ainda não foi vinculado a um registro de funcionário.</p>
              <p className="text-sm text-gray-500 mt-2">Entre em contato com o Cacheado e informe seu e-mail: {simulationActive ? '[Simulado Sem Registro]' : user.email}</p>
            </div>
          )}
        </main>
        <SendNotificationModal
          isOpen={isSendNotificationModalOpen}
          onClose={() => setIsSendNotificationModalOpen(false)}
          onSend={handleSendCustomNotification}
          employees={employees}
        />
        <PWAInstallPrompt />
      </div>
    );
  }

  // Interface do Admin
  return (
    <div className="min-h-screen bg-brand-bg pb-12">
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
          />
        )}

        {viewMode === 'dashboard' && isViewingAsAdmin && (
          <AdminDashboard 
            employees={employees}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            dayConfigs={dayConfigs}
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

      <SendNotificationModal
        isOpen={isSendNotificationModalOpen}
        onClose={() => setIsSendNotificationModalOpen(false)}
        onSend={handleSendCustomNotification}
        employees={employees}
      />
      
      <PWAInstallPrompt />
    </div>
  );
}
