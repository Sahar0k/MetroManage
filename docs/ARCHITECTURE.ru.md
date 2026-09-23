# MetroManage — Архитектура приложения

**Версия:** 6.2  
**Стек:** React + TypeScript + Vite + TailwindCSS  
**Хранилища:** `localStorage` (локально) / `PocketBase` (сервер, Docker)  
**Внешние интеграции:** ФГИС Госреестр (FGIS/Gost.ru), Excel-импорт

---

## 1. Обзор

MetroManage — система учёта средств измерений (СИ) для метрологической службы предприятия. Управляет жизненным циклом приборов: приём на склад, выдача/возврат, поверка (отправка → возврат с протоколом), списание. Интегрируется с ФГИС Госреестр для автозаполнения карточек СИ и импорта реестров из Excel.

### Ключевые особенности

- **Двойное хранилище:** переключение между `localStorage` и PocketBase в реальном времени
- **Оффлайн-работа:** IndexedDB кэш запросов к Госреестру (30 дней), снапшоты для изолированных контуров
- **Динамические категории:** конструктор пользовательских полей + фильтры для типов СИ
- **Логистика поверок:** отправка → статус «На поверке» → возврат с вердиктом (pass/fail)
- **Цифровой паспорт:** хронологический таймлайн истории прибора (протоколы, выдачи, операции)
- **Ролевая модель:** `guest` (только просмотр) / `metrologist` (все действия)

---

## 2. Структура проекта

```
src/
├── main.tsx                    # Точка входа React
├── App.tsx                     # Boot-машина, ErrorBoundary, lazy-pages router
├── types.ts                    # Все TS-типы (MeasuringInstrument, Employee, ...)
├── config.ts                   # COMPANY_NAME, APP_TITLE
├── store.ts                    # Хранилище + initStore() + сид-данные
├── index.css                   # Tailwind-базовый слой
│
├── pages/                      # Роуты (lazy-loaded)
│   ├── Dashboard.tsx           # Сводка: статистика, виджеты
│   ├── Instruments.tsx         # Реестр СИ + поиск + CRUD
│   ├── Verification.tsx        # График/план поверок
│   ├── IssueReturn.tsx         # Выдача и возврат СИ
│   ├── Personnel.tsx           # Сотрудники и отделы
│   ├── OperationsLog.tsx       # Аудит-ленту операций
│   ├── Scanner.tsx             # Сканирование DataMatrix
│   ├── ImportPage.tsx          # Импорт из Excel
│   ├── SettingsPage.tsx        # Настройки (кэш, снапшоты, источник)
│   ├── MigrationPage.tsx       # Миграция localStorage ↔ PocketBase
│   └── LoginPage.tsx           # Авторизация в PocketBase
│
├── components/                 # UI-компоненты
│   ├── Layout.tsx              # Боковое меню + шапка + роутинг
│   ├── InstrumentCard.tsx      # Карточка прибора (превью)
│   ├── InstrumentDetailModal   # Полная карточка + цифровой паспорт
│   ├── CategoryBuilder.tsx     # Конструктор категорий СИ
│   ├── FilterBuilder.tsx       # Построение фильтров
│   ├── SearchContextMenu.tsx   # Автоподсказки при поиске
│   ├── ConfirmDialog.tsx       # Диалог подтверждения
│   ├── DataSourceModal.tsx     # Переключатель источника данных
│   ├── Notification            # Система уведомлений (контекст + хуки)
│   ├── ReturnFromVerificationModal
│   └── verification/
│       ├── InstrumentHistory.tsx  # Таймлайн истории прибора
│       └── __tests__/
│
├── services/                   # Бизнес-сервисы
│   ├── gosreestrService.ts     # ФГИС Госреестр: mit24-search, PDF байт-в-байт
│   ├── indexedDBCache.ts       # IndexedDB-кэш для оффлайн-доступа
│   ├── importService.ts        # Импорт .xlsx / парсинг Excel
│   ├── storage/
│   │   ├── StorageAdapter.ts   # ← КОНТРАКТ: интерфейс адаптера (~90 методов)
│   │   ├── localAdapter.ts     # localStorage: все CRUD по mk_* ключам
│   │   ├── pocketbaseAdapter.ts# PocketBase SDK: in-memory cache + write-through
│   │   ├── migrationService.ts # Двусторонняя миграция с прогрессом
│   │   └── index.ts            # Фабрика: getStorageAdapter() + switchStorageSource()
│
├── utils/                      # Утилиты
│   ├── domain.ts               # Чистые функции: addMonths, isVerificationExpired,
│   │                           # canIssueInstrument, hasPermission, ...
│   ├── customFields.ts         # CATEGORY_TEMPLATES (10 типов СИ), applyFilters,
│   │                           # saveFilter/getSavedFilters (localStorage)
│   ├── audio.ts                # Web Audio API unlock для автовоспроизведения
│   └── hooks/
│       ├── useGosreestrSearch.ts    # Debounce 400ms + AbortController
│       └── index.ts
│
contexts/                       # React Context (NotificationContext)
__tests__/                      # Тесты vitest (используют src код)
```

---

## 3. Запуск и сборка

```bash
npm install
npm run dev           # Dev-сервер: localhost:3000, HMR
npm run build         # Production build (dist/)
npm test              # Vitest тесты (58 passed)
```

**vite.config.js:**
- `server.host: "0.0.0.0"` — доступ из контейнеров/сети
- `server.strictPort: true` — фиксированный порт 3000
- `proxy '/api/gosreestr' → fgis.gost.ru/fundmetrology` — прокси с подделкой User-Agent и Referer для обхода CORS

**deploy/docker-compose.yml:** Nginx-фронтенд с proxy_cache для Госреестра (30 дней), rate-limiting 1r/s burst=5.

---

## 4. Инициализация и загрузка (Boot)

### Цепочка запуска

```
App.tsx mount
  → AppContent boot()
    → getStorageConfig()  // чтение mk_storage_config из localStorage
    → switch по config.type:
      - 'local'   → initStore() → createSeedData() если версия сменилась
      - 'pocketbase' → check authStore.isValid → login или show LoginPage
    → bootState = 'checking' | 'ready' | 'login' | 'error'
```

### initStore() (store.ts)

1. Получает адаптер через `getStorageAdapter()` (фабрика в `storage/index.ts`)
2. **Локальный режим:** проверяет `mk_data_version`, при несовпадении очищает `mk_*` ключи и создаёт сид-данные
3. **Серверный режим:** проверяет наличие данных; сид только если ББ пуста
4. Сид-данные: 5 складов, 5 отделов, 6 сотрудников, 150 приборов (8 типов), 10 категорий

### Текущая версия данных: `'6.2'`

---

## 5. Архитектура хранилища

### 5.1 Фабрика адаптеров (`storage/index.ts`)

```typescript
// singleton pattern
let currentAdapter: StorageAdapter | null = null;
let currentConfig: StorageConfig | null = null;

getStorageConfig()  // reads from localStorage mk_storage_config key
getStorageAdapter() // creates or returns cached adapter instance
switchStorageSource() // tests connection then switches (invalidates cache)
```

**Конфигурация persistится в `mk_storage_config`:**
```json
{ "type": "local" }           // по умолчанию
{ "type": "pocketbase", "pocketbaseUrl": "http://pb.example.com:8090" }
```

### 5.2 Контракт адаптера (`StorageAdapter.ts`)

Интерфейс `StorageAdapter` определяет 70+ методов, охватывающих все сущности:

| Entity | CRUD | Notes |
|--------|------|-------|
| MeasuringInstrument | CRUD | Авто-расчёт `nextVerificationDate` |
| Employee | CRUD | Связь с departmentId, warehouseId |
| Department | CRUD | Защита от удаления при привязанных сотрудниках |
| Warehouse | CRUD | Защита от удаления при привязанных сотрудниках/приборах |
| InstrumentCategory | CRUD | Авто-генерация id/createdAt |
| IssueRecord | Create, returnInstrument | Привязка instrumentId → employeeId |
| VerificationSendoff | CRUD | Статусы: sent → returned |
| VerificationProtocol | CRUD | Статусная защита (draft/in_progress ↔ completed/rejected) |
| SavedFilter | Create, update, delete | |
| OperationLog | Append (до 500 записей) | FIFO at head |
| Users | getCurrentUser / setCurrentUser | Для авторизации |
| Attachments | saveAttachment / getAttachment | base64 строки |

### 5.3 LocalStorageAdapter

Каждая сущность — JSON-массив в отдельном `mk_*` ключе:

```typescript
const STORAGE_KEYS = {
  users: 'mk_users',
  departments: 'mk_departments',
  employees: 'mk_employees',
  instruments: 'mk_instruments',
  warehouses: 'mk_warehouses',
  issues: 'mk_issues',
  operations: 'mk_operations',
  currentUser: 'mk_current_user',
  categories: 'mk_categories',
  sendoffs: 'mk_verification_sendoffs',
  protocols: 'mk_verification_protocols',
  filters: 'mk_saved_filters',
};
```

**Атрибуты:** ID генерируются через `uuid.v4()`. При добавлении/обновлении инструмента пересчитывается `nextVerificationDate` по `calculateNextVerification()`. Операционный журнал ограничен 500 записями (FIFO).

### 5.4 PocketBaseAdapter

```
Инициализация: pb.collection('X').getFullList() для всех коллекций → fill memory cache
CRUD: modify in-memory cache first → async persistToPB() catch silently on error
Auth: pb.authStore.isValid → getCurrentUser reads model fields
```

**Стратегия записи:** In-memory cache + **write-through** (асинхронный `catch`). При потере соединения данные в кэше не теряются, но и не синхронизируются (TODO: offline queue not yet implemented).

**Коллекции PB:** `instruments`, `employees`, `departments`, `warehouses`, `categories`, `issues`, `sendoffs`, `protocols`, `filters`, `operations`.

**Отсутствует:** `saveAttachment`/`getAttachment` — бросают `NotImplemented` (требует реализации через файлы PB).

### 5.5 Миграция (`migrationService.ts`)

Двусторонняя миграция с callback-прогрессом:
- `migrateLocalToPocketBase(local, remote)` — линейно по всем типам (departments → warehouses → employees → categories → instruments → issues → sendoffs → protocols)
- `migratePocketBaseToLocal(remote, local)` — аналогично обратно

**Конфликты:** счётчик + стратегия `skip | overwrite | manual`. В текущей реализации — простой цикл без проверки дубликатов по уникальным полям.

### 5.6 IndexedDB Cache (`indexedDBCache.ts`)

```
DB: metrolog-manage-cache v1
Stores: gosreestr_cards | settings
```

**Для Госреестра:** кэширует ответы о карточках СИ (maxAge 30 дней по умолчанию). Поддерживает экспорт/импорт снапшота для полностью изолированных сегментов.

**Для настроек:** arbitrary key-value pairs с timestamp.

---

## 6. Внешние интеграции

### 6.1 ФГИС Госреестр (`gosreestrService.ts`)

**Прокси:** `/api/gosreestr/** → https://fgis.gost.ru/fundmetrology/**

Запросы проходят через dev-server proxy (Vite) или nginx reverse proxy (production).

**Основные эндпоинты:**
- `/mits` — поиск прибора по серии/номеру (mit24)
- `/iaux` — auxiliary данные
- `/docs` — PDF-вложения (методики поверки, описания типа)

**Обработка ответов:**
- Парсинг JSON с использованием `iaux` и `JField` структуры
- Декодирование Base64-байт в `Uint8Array` для отображения/скачивания PDF
- Rate limiting 1 запрос/сек в клиенте (queue with delay)
- abort controller для debounce-cancel при быстром наборе

**Сервисы:**
- `gosreestrService.ts` — HTTP-вызовы, парсинг, binary response handling
- `useGosreestrSearch.ts` — React hook с debounce(400ms) и AbortController
- `indexedDBCache.ts` — оффлайн-кэш карточек (IndexedDB, maxAge configurable)

### 6.2 Импорт из Excel (`importService.ts`)

Формат файла: `.xlsx` / `.xls`. Шаблоны колонок маппятся на стандартные поля `MeasuringInstrument`.

**Pipeline:**
1. Загрузка файла (FileReader → ArrayBuffer → xlsx parsing)
2. Маппинг колонок
3. Валидация: пустые обязательные поля, дубликаты серийных номеров
4. Обогащение через Госреестр (очередь 1 req/s)
5. Создание черновиков сотрудников/отделов если не найдены
6. Пакетная запись в адаптер

### 6.3 PocketBase backend (pb_schema.json)

JSON-схема для авто-создания коллекции PB. Коллекции: `instruments`, `employees`, `departments`, `warehouses`, `categories`, `issues`, `sendoffs`, `protocols`, `filters`. Поля маппятся по контракту `StorageAdapter`.

---

## 7. Бизнес-логика (utils/domain.ts)

Чистые функции, без зависимостей:

| Функция | Описание |
|---------|----------|
| `addMonths(date, months)` | Корректное сложение дат (учёт високосных/разной длины месяцев) |
| `calculateNextVerification(date, intervalMonths)` | Следующая дата поверки |
| `isVerificationExpired(instrument)` | Просрочена ли поверка |
| `isVerificationDueSoon(instrument, days=30)` | Скоро истекает (0 ≤ diff ≤ 30 дней) |
| `canIssueInstrument(instrument, role)` | Проверка блокировок: expired/issued/decomissioned/repair/verification |
| `hasPermission(role, action)` | RBAC матрица |
| `formatDate` / `formatDateTime` | Локализованное форматирование `ru-RU` |

**Матрица прав:**

| Действие | guest | metrologist |
|----------|-------|-------------|
| view_all | ✓ | ✓ |
| issue | ✗ | ✓ |
| return | ✗ | ✓ |
| edit_instruments | ✗ | ✓ |
| manage_users | ✗ | ✓ |
| manage_departments | ✗ | ✓ |

---

## 8. Категории и фильтры (`customFields.ts`)

### Категории (10 шаблонов)

Шаблонные типы СИ с предустановленными полями:

| Категория | Поля |
|-----------|------|
| Анализатор спектра | freq_min, freq_max, sensitivity, dyn_range |
| Генератор сигналов | freq_min, freq_max, power_max |
| Осциллограф | bandwidth, channels, sample_rate |
| Мультиметр | voltage_dc_max, voltage_ac_max, current_max, digits |
| Измеритель LCR | freq_min, freq_max, accuracy |
| Измеритель мощности | freq_min, freq_max, power_max |
| Измеритель КСВ | freq_min, freq_max, directivity |
| Источник питания | voltage_max, current_max, power_max |
| Тепловизор | temp_min, temp_max, resolution, thermal_sensitivity |
| Пирометр | temp_min, temp_max, accuracy |

### Фильтры

- `applyFilters(instruments, conditions, fields)` — фильтрация по customFields с операторами: equals, contains, greater, less, between
- Сохранённые фильтры живут в `localStorage` (`mk_saved_filters`) с name/category/conditions/createdAt

---

## 9. Роутинг страниц (`App.tsx`)

Страницы загружаются лениво через `React.lazy()`:

| Route | Компонент | Доступ |
|-------|-----------|--------|
| dashboard | Dashboard | metrologist |
| instruments | Instruments | guest + metrologist |
| verification | Verification | все |
| issue-return | IssueReturn | metrologist |
| personnel | Personnel | metrologist |
| operations | OperationsLog | metrologist |
| scanner | Scanner | metrologist |
| import | ImportPage | metrologist |
| settings | SettingsPage | metrologist |
| migration | MigrationPage | metrologist |

**Навигация:** `handleNavigate(page, filter?, instrumentId?)` — поддерживает deep-link с фильтром и начальной картой прибора.

**Role-based defaults:** `guest` всегда → `instruments`; `metrologist` стартует → `dashboard`.

---

## 10. Системы компонентов

### 10.1 Уведомления (`contexts/NotificationContext`)

Provider → `useNotification()` хук. Actions: `add(type, message, duration)`. Container рендерит список внизу экрана. Одно разовое уведомление при просроченных возвратах на старте.

### 10.2 История прибора (`verification/InstrumentHistory.tsx`)

Таймлайн событий агрегируется из:
- Протоколы поверок (`VerificationProtocol`)
- Записи выдачи/возврата (`IssueRecord`)
- Операции из лога (`OperationLog`)
- Отправки на поверку (`VerificationSendoff`)

Цветовое кодирование событий: зелёный (успех), красный (неудача), жёлтый (предупреждение), серый (нейтрально).

### 10.3 Логистика поверок

**Отправка на поверку** (из карточки СИ):
1. Форма: место поверки, ответственный, ожидаемый возврат
2. Статус СИ → `'verification'`, блокировка выдачи
3. Запись в `OperationLog`, событие в `InstrumentHistory`

**Возврат с поверки** (из реестра СИ, фильтр «На поверке»):
1. Дата возврата, вердикт (годен/не годен)
2. `pass`: статус `'available'`, пересчёт дат (авто из МПИ)
3. `fail`: статус `'repair'`, уведомление
4. Прикрепление файла протокола (опционально)

**Мониторинг:** подсветка просроченных возвратов (оранжевая), виджет на Сводке.

---

## 11. Типы данных (key interfaces)

### Средства измерений
```typescript
interface MeasuringInstrument {
  id: string; inventoryNumber: string; name: string;
  category: string; type: string; serialNumber: string;
  manufacturer: string; range: string; accuracy: string;
  status: 'available' | 'issued' | 'repair' | 'decommissioned' | 'verification';
  lastVerificationDate: string | null;
  intervalMonths: number;
  nextVerificationDate: string | null;
  location: string; warehouseId: string | null;
  customFields: Record<string, string | number>;
}
```

### Протокол поверки
```typescript
interface VerificationProtocol {
  id: string; deviceId: string;
  operatorId: string; dateStart: string; dateEnd?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'rejected';
  result?: 'pass' | 'fail';
  points: VerificationPoint[];
  createdAt: string; updatedAt: string;
}
```

### Отправка на поверку
```typescript
interface VerificationSendoff {
  id: string; instrumentId: string; destination: string;
  sentAt: string; responsibleId: string | null;
  expectedReturnDate: string | null;
  status: 'sent' | 'returned';
}
```

---

## 12. Зависимости (package.json ключевые)

| Зависимость | Назначение |
|-------------|------------|
| react + react-dom | UI runtime |
| @vitejs/plugin-react | Hot module replacement |
| @tailwindcss/vite | CSS framework |
| pocketbase | Клиентский SDK для серверного режима |
| uuid | Генерация ID |
| bwip-js | Генерация DataMatrix штрихкодов |
| recharts | Графики и диаграммы |
| xlsx (SheetJS) | Экспорт/импорт Excel |
| tesseract.js ~~удалено~~ | ~~OCR~~ удалено по продуктовому решению |
| puppeteer/chrome-aws-lambda ~~удалено~~ | ~~PWA deployment~~ удалено |

---

## 13. Безопасность и изоляция

### Для интранет-развёртывания:

1. **Настройка "Доступ к Госреестру: вкл/выкл"** — персистентная настройка
2. При выключенном доступе — бейдж **"Изолированный контур"**
3. Рабочий режим показывает бейдж **"Данные из кэша от \<date\>"**
4. Снапшот-импорт/экспорт (.json) для полностью air-gapped сегментов
5. Nginx: `proxy_cache` 30 дней + `proxy_cache_lock` на Gosreestr
6. Rate limiting: `limit_req_zone ... 1r/s burst=5`

### Данные:

- Сид-данные генерируются один раз при создании (version control через `mk_data_version`)
- Пользователи хранятся отдельно от бизнес-данных (`mk_users` vs `mk_*` keys)
- В PocketBase пользователи управляются через authStore SDK

---

## 14. Тестирование

**Тесты:** Vitest, 58 passing, 0 failing. Позиционируются в `__tests__/` папках рядом с кодом.

| Тестовый файл | Что тестирует |
|---------------|---------------|
| `components/verification/__tests__/InstrumentHistory.test.ts` | Агрегация истории прибора |
| `services/__tests__/gosreestrService.test.ts` | Парсинг Mit24, маппинг, роутинг, ошибки |
| `services/__tests__/importService.test.ts` | Парсинг XLSX, маппинг, валидация, дубликаты |
| `services/__tests__/indexedDBCache.test.ts` | Структура модуля IndexedDB |

**Инварианты тестирования:**
- Тесты только в `__tests__/` директориях
- Полный прогон: `npx vitest run`
- Перед сдачей: точечный прогон теста → полный прогон
- Контрактный тест для адаптеров (оба должны удовлетворять интерфейсу)

---

## 15. Удалённый функционал (не переделывать)

- ~~Рабочее место поверителя с ручным вводом точек~~ (удалено: калибраторы генерируют протоколы сами)
- ~~Форма регистрации поверок~~ (удалена: протоколы приходят от калибраторов/импорта)
- ~~OCR через tesseract.js~~ (не реализовано, удалено из roadmap)
- ~~Машинное зрение~~ (не реализовано, удалено из roadmap)

---

## 16. Roadmap (актуальный)

### Приоритет 1 ✅ Выполнено
- [x] Госреестр СИ (поиск + PDF + кэш + rate limiting)
- [x] Импорт из Excel + обогащение
- [x] Корпоративное развёртывание (Docker, Nginx, IndexedDB)
- [x] Переключаемое хранилище (localStorage ⇄ PocketBase)

### Приоритет 2: Документы
- [ ] Конструктор шаблонов Свидетельств и Протоколов (.docx / .pdf)
- Библиотеки: `docxtemplater`, `pdfmake`, `pizzip`

### Приоритет 3: Планирование и аналитика
- [ ] Календарь поверок (`react-big-calendar` / `fullcalendar`)
- [ ] Расширенные дашборды на Recharts

### Приоритет 4: Корпоративные фичи
- [ ] Ролевая модель RBAC (Principal Metrologist / Поверитель / Склад / Админ)
- [ ] Аудит-лог изменений
- [ ] Интеграция с 1С

### Будущие интеграции
- [ ] ФГИС АРШИН — экспорт результатов поверки в XML

---

## 17. Диаграмма потоков данных

```
Пользователь
    │
    ▼
┌─────────────┐     localStorage     ┌──────────────────┐
│  App.tsx    │ ◄──────────────────► │  LocalStorageAd. │
│  (Router +  │                      │  (mk_* keys)     │
│   Boot)     │                      └──────────────────┘
└──────┬──────┘
       │  fetch('/api/gosreestr/...') via Vite Proxy
       ▼
┌─────────────┐     HTTP         ┌──────────────────┐
│   Client    │ ──────────────► │ fgis.gost.ru     │
│   Services  │ ◄───────────── │ /fundmetrology   │
│ gosreestr   │                  │ (Mit24 search)   │
└──────┬──────┘                  └──────────────────┘
       │
       ▼
┌─────────────┐
│  IndexedDB  │
│   Cache     │  (offline fallback, 30d TTL)
└─────────────┘

       │  (pocketbase mode only)
       ▼
┌─────────────┐     REST API     ┌──────────────────┐
│ PocketBase  │ ──────────────► │ PocketBase DB    │
│   Adapter   │                  │ (in-memory + disk)│
└─────────────┘                  └──────────────────┘
```

---

## 18. Быстрые справочники

### Kubectl-like команды хранилища (localStorage inspect)
```javascript
localStorage.getItem('mk_instruments')   // массив инструментов
localStorage.getItem('mk_storage_config') // { type, pocketbaseUrl? }
localStorage.getItem('mk_data_version')  // '6.2'
localStorage.keys().filter(k => k.startsWith('mk_')) // все ключи
```

### URL маршруты (SPA hash-based)
Управление навигацией через `handleNavigate(page, filter?, instrumentId?)` — no browser history dependency.

---

*Документ создан автоматически на основе анализа исходного кода проекта.*
