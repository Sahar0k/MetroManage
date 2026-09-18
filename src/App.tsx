import { useState, useEffect, useCallback, lazy, Suspense, Component, ReactNode } from 'react';
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

// Error Boundary для перехвата ошибок рендеринга
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 border border-red-500/30">
            <h2 className="text-xl font-bold text-red-400 mb-4">Ошибка приложения</h2>
            <p className="text-slate-300 mb-4">
              {this.state.error?.message || 'Произошла неизвестная ошибка'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type BootState = 'checking' | 'ready' | 'login' | 'error';

function AppContent() {
  const [bootState, setBootState] = useState<BootState>('checking');
  const [bootError, setBootError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentFilter, setCurrentFilter] = useState<string | undefined>(undefined);
  const [initialInstrumentId, setInitialInstrumentId] = useState<string | null>(null);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [userRole, setUserRole] = useState<'guest' | 'metrologist'>('guest');
  const [userId, setUserId] = useState<string | null>(null);
  const theme = 'dark';
  const notification = useNotification();

  // Единая функция boot для инициализации приложения
  const boot = useCallback(async () => {
    setBootState('checking');
    setBootError(null);

    try {
      const config = getStorageConfig();

      // Локальный режим: сразу инициализируем
      if (config.type === 'local') {
        await initStore();
        setBootState('ready');
        return;
      }

      // Серверный режим: проверяем авторизацию
      const adapter = getStorageAdapter();
      if ('getCurrentUser' in adapter) {
        const user = (adapter as any).getCurrentUser();
        if (user) {
          // Пользователь авторизован, инициализируем хранилище
          await initStore();
          setBootState('ready');
        } else {
          // Пользователь не авторизован - показываем LoginPage
          setBootState('login');
        }
      } else {
        // Адаптер не поддерживает авторизацию, инициализируем
        await initStore();
        setBootState('ready');
      }
    } catch (error) {
      console.error('Boot failed:', error);
      setBootError(error instanceof Error ? error.message : 'Неизвестная ошибка инициализации');
      setBootState('error');
    }
  }, []);

  // Запуск boot при монтировании
  useEffect(() => {
    boot();
  }, [boot]);

  // Инициализация пользователя после готовности
  useEffect(() => {
    if (bootState === 'ready') {
      const user = store.getCurrentUser();
      setUserRole(user?.role || 'guest');
      setUserId(user?.id || null);
    }
  }, [bootState]);

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
    if (userRole === 'guest') { setCurrentPage('instruments'); }
    else if (userRole === 'metrologist' && currentPage === 'instruments') { setCurrentPage('dashboard'); }
  }, [userRole]);

  useEffect(() => {
    if (userRole === 'guest' && currentPage !== 'instruments') { setCurrentPage('instruments'); }
  }, [userRole, currentPage]);

  const handleNavigate = useCallback((page: string, filter?: string, instrumentId?: string) => {
    setCurrentPage(page);
    if (filter !== undefined) setCurrentFilter(filter); else setCurrentFilter(undefined);
    if (instrumentId !== undefined) setInitialInstrumentId(instrumentId); else setInitialInstrumentId(null);
  }, []);

  const handleDataSourceClick = useCallback(() => { setShowDataSourceModal(true); }, []);

  const handleLogout = useCallback(() => {
    // Сбрасываем boot в 'login' для серверного режима
    const config = getStorageConfig();
    if (config.type === 'pocketbase') {
      const adapter = getStorageAdapter();
      if ('logout' in adapter) {
        (adapter as any).logout();
      }
      setBootState('login');
    } else {
      // Локальный режим
      store.setCurrentUser(null);
      handleUserChange();
    }
  }, [handleUserChange]);

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

  // Состояние проверки
  if (bootState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white text-lg">Загрузка приложения...</p>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (bootState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 border border-red-500/30">
          <h2 className="text-xl font-bold text-red-400 mb-4">Ошибка загрузки приложения</h2>
          <p className="text-slate-300 mb-4">{bootError}</p>
          <button
            onClick={boot}
            className="w-full py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  // Состояние логина
  if (bootState === 'login') {
    return (
      <>
        <LoginPage onLoginSuccess={async () => {
          try {
            await initStore();
            setBootState('ready');
          } catch (error) {
            console.error('Failed to initialize after login:', error);
            setBootError(error instanceof Error ? error.message : 'Ошибка инициализации после входа');
            setBootState('error');
          }
        }} />
        <NotificationContainer notifications={notification.notifications} onClose={notification.removeNotification} />
      </>
    );
  }

  // Состояние готовности
  return (
    <ErrorBoundary>
      <Layout currentPage={currentPage} onNavigate={handleNavigate} onUserChange={handleUserChange} onDataSourceClick={handleDataSourceClick} onLogout={handleLogout}>
        <Suspense fallback={<LoadingSpinner />}>{renderPage()}</Suspense>
      </Layout>
      <DataSourceModal isOpen={showDataSourceModal} onClose={() => setShowDataSourceModal(false)} />
      <NotificationContainer notifications={notification.notifications} onClose={notification.removeNotification} />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
