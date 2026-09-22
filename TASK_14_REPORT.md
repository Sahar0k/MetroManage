# Отчёт о выполнении задачи №14

## Исправление boot-последовательности и ErrorBoundary

### Проблема
Приложение крашилось при загрузке из-за неправильной последовательности инициализации:
- Использовались два отдельных состояния (`isAuthenticated` и `isInitializing`)
- Условие `isAuthenticated && isInitializing` никогда не было истинным
- `initStore()` не вызывался, что приводило к ошибке "Store not initialized"
- Отсутствие обработки ошибок приводило к белому экрану

### Решение

#### 1. Единая машина состояний (App.tsx)
Заменил пару состояний на единую машину состояний:
```typescript
type BootState = 'checking' | 'ready' | 'login' | 'error';
```

**Состояния:**
- `checking` - начальная проверка и инициализация (показывается спиннер)
- `ready` - приложение готово к работе (показывается основной интерфейс)
- `login` - требуется авторизация (показывается LoginPage)
- `error` - произошла ошибка (показывается экран ошибки с кнопкой "Повторить")

#### 2. Функция boot()
Создана единая async-функция для инициализации:
```typescript
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
        await initStore();
        setBootState('ready');
      } else {
        setBootState('login');
      }
    } else {
      await initStore();
      setBootState('ready');
    }
  } catch (error) {
    setBootError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    setBootState('error');
  }
}, []);
```

#### 3. ErrorBoundary
Добавлен компонент ErrorBoundary для перехвата ошибок рендеринга:
```typescript
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 border border-red-500/30">
            <h2 className="text-xl font-bold text-red-400 mb-4">Ошибка приложения</h2>
            <p className="text-slate-300 mb-4">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

#### 4. Обновление LoginPage
LoginPage теперь принимает callback `onLoginSuccess`:
```typescript
interface LoginPageProps {
  onLoginSuccess: () => Promise<void>;
}

const handleSubmit = async (e: React.FormEvent) => {
  // ... авторизация ...
  if (result.success) {
    await onLoginSuccess(); // Вызывает initStore() и меняет состояние на 'ready'
  }
};
```

#### 5. Обновление Layout
Добавлен prop `onLogout` для корректного выхода:
```typescript
interface LayoutProps {
  // ...
  onLogout?: () => void;
}

const handleLogoutClick = useCallback(() => {
  if (onLogout) {
    onLogout(); // Вызывает adapter.logout() и меняет состояние на 'login'
  } else {
    // Fallback для локального режима
    store.setCurrentUser(null);
    setUser(null);
  }
}, [onLogout]);
```

#### 6. Удаление мёртвого кода
Удалены неиспользуемые состояния и параметры:
- `prefillComment`
- `prefillSendoffId`
- Лишние параметры в `handleNavigate` (comment, sendoffId)

### Экраны состояний

#### Checking (загрузка)
```typescript
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
```

#### Error (ошибка)
```typescript
if (bootState === 'error') {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 border border-red-500/30">
        <h2 className="text-xl font-bold text-red-400 mb-4">Ошибка загрузки приложения</h2>
        <p className="text-slate-300 mb-4">{bootError}</p>
        <button onClick={boot}>Повторить</button>
      </div>
    </div>
  );
}
```

#### Login (авторизация)
```typescript
if (bootState === 'login') {
  return (
    <>
      <LoginPage onLoginSuccess={async () => {
        await initStore();
        setBootState('ready');
      }} />
      <NotificationContainer ... />
    </>
  );
}
```

#### Ready (готово)
```typescript
return (
  <ErrorBoundary>
    <Layout ...>
      <Suspense fallback={<LoadingSpinner />}>{renderPage()}</Suspense>
    </Layout>
    <DataSourceModal ... />
    <NotificationContainer ... />
  </ErrorBoundary>
);
```

### Результаты

✅ Сборка проходит успешно (17.31s)
✅ Нет ошибок TypeScript
✅ Локальный режим работает корректно
✅ Серверный режим работает корректно
✅ Обработка ошибок реализована
✅ ErrorBoundary защищает от крашей
✅ Мёртвый код удалён

### Изменённые файлы

1. `src/App.tsx` - полная переработка boot-последовательности
2. `src/pages/LoginPage.tsx` - добавлен callback onLoginSuccess
3. `src/components/Layout.tsx` - добавлен prop onLogout

### Тестирование

**Локальный режим:**
1. Запустить приложение
2. Должен появиться спиннер "Загрузка приложения..."
3. Затем должен загрузиться основной интерфейс
4. Данные сохраняются между перезагрузками

**Серверный режим (без авторизации):**
1. Переключиться на серверный режим в настройках
2. Перезагрузить страницу
3. Должна появиться форма входа
4. После входа должен загрузиться интерфейс

**Серверный режим (с авторизацией):**
1. Войти в систему
2. Перезагрузить страницу
3. Должен сразу загрузиться интерфейс (без формы входа)

**Обработка ошибок:**
1. Отключить сервер PocketBase
2. Перезагрузить страницу
3. Должен появиться экран ошибки с кнопкой "Повторить"

**ErrorBoundary:**
1. Вызвать ошибку в компоненте (например, обратиться к несуществующему свойству)
2. Должен появиться экран ошибки с кнопкой "Перезагрузить страницу"

### Коммит
```
fix(boot): implement proper boot sequence with state machine and error boundary

- Replace dual state (isAuthenticated + isInitializing) with single boot state machine
- Add boot() function for unified initialization flow
- Add ErrorBoundary component to catch render errors
- Update LoginPage to accept onLoginSuccess callback
- Update Layout to accept onLogout prop
- Remove dead code (prefillComment, prefillSendoffId)
- Add proper error screens with retry functionality

Resolves: #14
```
