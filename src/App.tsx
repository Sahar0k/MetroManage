import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import DataSourceModal from './components/DataSourceModal';
import { NotificationContainer } from './components/Notification';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { store, initStore } from './store';
import { unlockAudio } from './utils/audio';
import { getStorageAdapter, getStorageConfig } from './services/storage';
import LoginPage from './pages/LoginPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Instruments = lazy(() => import('./pages/Instruments'));
const Verification = lazy(() => import('./pages/Verification'));

const IssueReturn = lazy(() => import('./pages/IssueReturn'));
const Personnel = lazy(() => import('./pages/Personnel'));
const OperationsLog = lazy(() => import('./pages/OperationsLog'));
const Scanner = lazy(() => import('./pages/Scanner'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MigrationPage = lazy(() => import('./pages/MigrationPage'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-400">Загрузка...</p>
    </div>
  </div>
);

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentFilter, setCurrentFilter] = useState<string | undefined>(undefined);
  const [initialInstrumentId, setInitialInstrumentId] = useState<string | null>(null);
  const [prefillComment, setPrefillComment] = useState<string | null>(null);
  const [prefillSendoffId, setPrefillSendoffId] = useState<string | null>(null);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [userRole, setUserRole] = useState<'guest' | 'metrologist'>(() => {
    const user = store.getCurrentUser();
    return user?.role || 'guest';
  });
  const [userId, setUserId] = useState<string | null>(() => {
    const user = store.getCurrentUser();
    return user?.id || null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const theme = 'dark';
  const notification = useNotification();

  // Проверка авторизации при запуске
  useEffect(() => {
    const checkAuth = async () => {
      const config = getStorageConfig();
      
      // Локальный режим не требует авторизации
      if (config.type === 'local') {
        setIsAuthenticated(true);
        setIsInitializing(false);
        return;
      }
      
      // Серверный режим требует авторизации
      const adapter = getStorageAdapter();
      if ('getCurrentUser' in adapter) {
        const user = (adapter as any).getCurrentUser();
        setIsAuthenticated(!!user);
      } else {
        setIsAuthenticated(true);
      }
      setIsInitializing(false);
    };

    checkAuth();
  }, []);

  // Инициализация хранилища после авторизации
  useEffect(() => {
    if (isAuthenticated && isInitializing) {
      initStore().catch(err => {
        console.error('Failed to initialize store:', err);
      });
    }
  }, [isAuthenticated, isInitializing]);

  useEffect(() => { document.documentElement.className = 'dark'; }, []);
  useEffect(() => {
    const handler = () => { unlockAudio(); document.removeEventListener('click', handler); document.removeEventListener('keydown', handler); document.removeEventListener('touchstart', handler); };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('click', handler); document.removeEventListener('keydown', handler); document.removeEventListener('touchstart', handler); };
  }, []);

  const handleUserChange = useCallback(() => {
    const user = store.getCurrentUser();
    setUserRole(user?.role || 'guest');
    setUserId(user?.id || null);
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    setUserRole(user?.role || 'guest');
    setUserId(user?.id || null);
  }, [currentPage]);

  useEffect(() => {
    if (userRole === 'guest') { setCurrentPage('instruments'); }
    else if (userRole === 'metrologist' && currentPage === 'instruments') { setCurrentPage('dashboard'); }
  }, [userRole]);

  useEffect(() => {
    if (userRole === 'guest' && currentPage !== 'instruments') { setCurrentPage('instruments'); }
  }, [userRole, currentPage]);

  const handleNavigate = useCallback((page: string, filter?: string, instrumentId?: string, comment?: string, sendoffId?: string) => {
    setCurrentPage(page);
    if (filter !== undefined) setCurrentFilter(filter); else setCurrentFilter(undefined);
    if (instrumentId !== undefined) setInitialInstrumentId(instrumentId); else setInitialInstrumentId(null);
    if (comment !== undefined) setPrefillComment(comment); else setPrefillComment(null);
    if (sendoffId !== undefined) setPrefillSendoffId(sendoffId); else setPrefillSendoffId(null);
  }, []);

  const handleDataSourceClick = useCallback(() => { setShowDataSourceModal(true); }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard theme={theme} onNavigate={handleNavigate} />;
      case 'instruments': return <Instruments theme={theme} userId={userId} userRole={userRole} initialFilter={currentFilter} onNavigate={handleNavigate} />;
      case 'verification': return <Verification theme={theme} onNavigate={handleNavigate} />;
      case 'issue-return': return <IssueReturn theme={theme} userId={userId} userRole={userRole} initialInstrumentId={initialInstrumentId} />;
      case 'personnel': return <Personnel theme={theme} userId={userId} userRole={userRole} />;
      case 'operations': return <OperationsLog theme={theme} />;
      case 'scanner': return <Scanner theme={theme} />;
      case 'import': return <ImportPage theme={theme} />;
      case 'settings': return <SettingsPage theme={theme} />;
      case 'migration': return <MigrationPage theme={theme} />;
      default: return <Instruments theme={theme} userId={userId} userRole={userRole} initialFilter={currentFilter} onNavigate={handleNavigate} />;
    }
  };

  // Показываем LoginPage если не авторизован в серверном режиме
  if (isAuthenticated === false) {
    return (
      <>
        <LoginPage />
        <NotificationContainer notifications={notification.notifications} onClose={notification.removeNotification} />
      </>
    );
  }

  // Показываем загрузку пока проверяем авторизацию
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={handleNavigate} onUserChange={handleUserChange} onDataSourceClick={handleDataSourceClick}>
        <Suspense fallback={<LoadingSpinner />}>{renderPage()}</Suspense>
      </Layout>
      <DataSourceModal isOpen={showDataSourceModal} onClose={() => setShowDataSourceModal(false)} />
      <NotificationContainer notifications={notification.notifications} onClose={notification.removeNotification} />
    </>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
