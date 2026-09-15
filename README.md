# Metrolog_Manage — README

## Корпоративное развёртывание (Интранет)

### Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Корпоративная сеть                         │
│                                                               │
│  ┌──────────┐         ┌──────────────────┐                  │
│  │ Браузер  │ ──────> │  nginx:8080      │                  │
│  │ Пользов. │  HTTP   │  ├─ Статика      │                  │
│  └──────────┘         │  └─ /api/gosreestr│                  │
│                        └────────┬─────────┘                  │
│                                 │                             │
└─────────────────────────────────┼─────────────────────────────┘
                                  │ HTTPS (443)
                                  ↓
                    ┌─────────────────────────┐
                    │  fgis.gost.ru           │
                    │  (Госреестр СИ)         │
                    └─────────────────────────┘
```

### Быстрый старт

```bash
# Сборка и запуск
docker-compose up -d --build

# Проверка статуса
docker-compose ps

# Логи
docker-compose logs -f

# Остановка
docker-compose down
```

Приложение будет доступно на `http://<server-ip>:8080`

### Заявка в ИБ (Information Security)

**Тема:** Разрешение на доступ к внешнему ресурсу для сервера приложений

**Обоснование:** Система учёта средств измерений требует доступа к Федеральному фонду Госреестра СИ для автозаполнения карточек приборов.

**Технические детали:**
- **Источник:** Сервер приложений `<server-ip>`
- **Назначение:** `fgis.gost.ru` (443/tcp, HTTPS)
- **Протокол:** HTTPS (TLS 1.2/1.3)
- **Частота:** ~1 запрос/сек, кэширование на 30 дней
- **Данные:** Только чтение метаданных СИ (наименование, производитель, МПИ)

**Альтернатива (DMZ relay):**
Если прямой доступ невозможен, настроить relay-сервер в DMZ:
```nginx
# На relay-сервере в DMZ
location /api/gosreestr/ {
    proxy_pass https://fgis.gost.ru/fundmetrology/;
    # ... те же настройки кэширования
}

# На сервере приложений
location /api/gosreestr/ {
    proxy_pass http://<dmz-relay-ip>:8080/api/gosreestr/;
}
```

### Проверка кэширования

```bash
# Первый запрос (MISS)
curl -I http://localhost:8080/api/gosreestr/api/registry/4/data?search=мультиметр
# X-Cache-Status: MISS

# Второй запрос (HIT)
curl -I http://localhost:8080/api/gosreestr/api/registry/4/data?search=мультиметр
# X-Cache-Status: HIT
```

### Работа без интернета

Приложение полностью функционально без доступа к Госреестру:
- Ручное заполнение карточек СИ
- Все данные из кэша nginx (если были запрошены ранее)
- Клиентский IndexedDB кэш (если был populated)
- Снапшот-импорт/экспорт для полностью изолированных сегментов

### Мониторинг

```bash
# Статистика кэша
docker exec <container> nginx -T | grep -A 5 "proxy_cache"

# Логи запросов к Госреестру
docker logs <container> | grep gosreestr

# Проверка здоровья
curl http://localhost:8080/health
```

### Безопасность

- ✅ Все запросы через HTTPS (TLS 1.2+)
- ✅ Rate limiting: 1 req/s, burst 5
- ✅ Whitelist заголовков (только User-Agent, Accept)
- ✅ Удаление Cookie и Authorization из проксируемых запросов
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ Кэширование только успешных ответов (200)
- ✅ Защита от thundering herd (proxy_cache_lock)

---

## Интеграция с Госреестром СИ

### Настройка прокси

Для работы с API Госреестра СИ (fgis.gost.ru) необходимо настроить проксирование запросов.

#### Development (Vite)

Прокси уже настроен в `vite.config.js`:

```javascript
proxy: {
  '/api/gosreestr': {
    target: 'https://fgis.gost.ru',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/gosreestr/, '/fundmetrology'),
  },
}
```

Запросы вида `/api/gosreestr/api/registry/4/data` будут проксироваться на `https://fgis.gost.ru/fundmetrology/api/registry/4/data`.

#### Production (Nginx)

Добавьте в конфигурацию nginx:

```nginx
location /api/gosreestr/ {
    proxy_pass https://fgis.gost.ru/fundmetrology/;
    proxy_set_header Host fgis.gost.ru;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Rate limiting (опционально)
    limit_req zone=api_limit burst=10 nodelay;
}

# Определение зоны для rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=1r/s;
```

#### Production (Vercel Serverless Function)

Создайте файл `api/gosreestr/[...path].js`:

```javascript
export default async function handler(req, res) {
  const { path } = req.query;
  
  // path может быть строкой или массивом
  const pathArray = Array.isArray(path) ? path : [path];
  const targetUrl = `https://fgis.gost.ru/fundmetrology/${pathArray.join('/')}`;
  
  try {
    // Whitelist заголовков (не передаём cookie, host и т.д.)
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Metrolog-Manage/1.0',
      'Accept': req.headers['accept'] || 'application/json',
    };
    
    const response = await fetch(targetUrl, { headers });
    
    const contentType = response.headers.get('content-type') || 'application/json';
    
    // Обработка бинарных ответов (PDF)
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.byteLength);
      return res.status(response.status).send(Buffer.from(buffer));
    }
    
    // JSON ответы
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
```

### Ограничения API

- **Rate limit**: 1 запрос в секунду (реализовано в gosreestrService.ts)
- **User-Agent**: `Metrolog-Manage/1.0`
- **Кэширование**: 
  - Подсказки поиска: 24 часа
  - Полные карточки: 7 дней

### Тестирование

Примеры запросов для проверки:

1. **Точный поиск по номеру**: `52797-13` → единственная подсказка
2. **Текстовый поиск**: `Р2М-18А` → список результатов
3. **Выбор подсказки** → автозаполнение полей формы
4. **Скачивание PDF** → кнопки "Описание типа" и "Методика поверки"

### Обработка ошибок

- Сетевые ошибки → тихий тост, форма работает как раньше
- Статус 429 (Too Many Requests) → автоматический retry через 2 секунды
- Недействующий тип СИ → оранжевый бейдж "Тип не действует"

### Тестирование проксирования бинарных файлов

**Важно:** Прокси обязан корректно пропускать бинарные ответы (application/pdf).

Проверка:
1. Загрузите карточку СИ с методикой поверки
2. Нажмите "Скачать методику поверки"
3. Файл должен скачаться корректно (не повреждён)
4. Content-Type должен быть `application/pdf`

Если PDF открывается как текст или повреждён — проверьте, что Vercel-функция использует `Buffer.from(arrayBuffer)` вместо `response.json()`.

---

## Режим отладки: переключение источника данных

### Концепция

Приложение поддерживает два режима хранения данных:
- **Локальный режим** (по умолчанию) — данные хранятся в localStorage браузера
- **Серверный режим** — данные хранятся на сервере PocketBase

Переключение между режимами происходит без пересборки приложения через настройки.

### Настройка PocketBase

1. Установите PocketBase: https://pocketbase.io/docs/
2. Запустите сервер:
   ```bash
   ./pocketbase serve --http=127.0.0.1:8090
   ```
3. Создайте администратора через веб-интерфейс: http://127.0.0.1:8090/_/
4. Создайте коллекции:
   - `instruments` — средства измерений
   - `employees` — сотрудники
   - `departments` — отделы
   - `warehouses` — склады
   - `categories` — категории СИ
   - `issues` — выдачи СИ
   - `sendoffs` — отправки на поверку
   - `protocols` — протоколы поверок
   - `operations` — журнал операций

### Переключение источника данных

1. Откройте **Настройки** → **Источник данных**
2. Выберите режим:
   - **Локально (браузер)** — данные в localStorage
   - **Сервер (PocketBase)** — данные на сервере
3. Укажите URL сервера (по умолчанию: `http://127.0.0.1:8090`)
4. Нажмите **Проверить соединение**
5. Нажмите **Применить**

### Индикатор источника данных

В боковой панели отображается бейдж текущего источника:
- **Данные: ЛОКАЛЬНО** (серый) — локальный режим
- **Данные: СЕРВЕР <url>** (зелёный) — серверный режим

### Перенос данных

Страница **Перенос данных** позволяет мигрировать данные между хранилищами:

1. Откройте **Перенос данных**
2. Просмотрите статистику (количество записей в каждом хранилище)
3. Выберите направление:
   - **Локально → Сервер** — загрузить данные на сервер
   - **Сервер → Локально** — скачать данные в браузер
4. Дождитесь завершения миграции

**Важно:**
- Перед миграцией убедитесь, что сервер доступен
- Рекомендуется создать резервную копию данных
- При конфликтах (одинаковые ID) используется стратегия "последняя запись побеждает"

### Архитектура адаптеров

```
src/services/storage/
├── StorageAdapter.ts       # Интерфейс адаптера
├── localAdapter.ts         # Адаптер для localStorage
├── pocketbaseAdapter.ts    # Адаптер для PocketBase
└── index.ts                # Фабрика адаптеров
```

Все адаптеры реализуют единый интерфейс `StorageAdapter`, что обеспечивает взаимозаменяемость.

### Тестирование

Контрактные тесты (`src/services/storage/__tests__/adapter.test.ts`) проверяют, что оба адаптера корректно реализуют CRUD-операции для всех сущностей.

Запуск тестов:
```bash
npm run test
```
