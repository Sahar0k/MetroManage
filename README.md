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
curl -I http://localhost:8080/api/gosreestr/cm/xcdb/mit24/list?fq=*мультиметр*&rows=5
# X-Cache-Status: MISS

# Второй запрос (HIT)
curl -I http://localhost:8080/api/gosreestr/cm/xcdb/mit24/list?fq=*мультиметр*&rows=5
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

Запросы вида `/api/gosreestr/cm/xcdb/mit24/list` будут проксироваться на `https://fgis.gost.ru/fundmetrology/cm/xcdb/mit24/list`.

**Важно:** После обновления версии сервиса необходимо очистить кэш nginx:
```bash
# Очистка кэша nginx
docker exec <container_name> rm -rf /var/cache/nginx/gosreestr/*
docker exec <container_name> nginx -s reload
```

#### Production (Nginx)

Добавьте в конфигурацию nginx:

```nginx
location /api/gosreestr/ {
    proxy_pass https://fgis.gost.ru/fundmetrology/;
    proxy_set_header Host fgis.gost.ru;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Ботозащита fgis: без этих заголовков — gif-заглушка
    proxy_set_header User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    proxy_set_header Referer "https://fgis.gost.ru/fundmetrology/cm/mits";
    
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
    // Заголовки ботозащиты fgis.gost.ru (обязательны! без них — gif-заглушка)
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://fgis.gost.ru/fundmetrology/cm/mits',
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
- **User-Agent**: браузерный (Chrome UA string) — **обязателен** для обхода ботозащиты fgis.gost.ru
- **Referer**: `https://fgis.gost.ru/fundmetrology/cm/mits` — **обязателен**
- **Кэширование**:
  - Подсказки поиска: 24 часа
  - Полные карточки: 7 дней
- **Без UA/Referer**: сервер возвращает GIF-заглушку вместо JSON/PDF

### Тестирование

Поиск работает серверным фильтром `fq` эндпоинта `mit24`. Примеры:

1. **Точный поиск**: `fq=*52797-13*` → одна запись
2. **Широкий поиск**: `fq=*Р2М*` → список СИ семейства Р2М
3. **Выбор подсказки** → автозаполнение полей формы
4. **Скачивание PDF** → см. подраздел «PDF-документы Госреестра» ниже

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

### PDF-документы Госреестра

**Обнаружена проблема:** прямой доступ к `/files/{doc_uuid}` возвращает 404.

**Рабочий путь:** документ скачивается через API `/cm/iaux/docs/{doc_uuid}`, который отдаёт JSON:
```json
{
  "title": "Описание типа",
  "filename": "2018-53450-13.pdf",
  "mimetype": "application/pdf",
  "doc": "JVBERi0xLjQK..." (base64)
}
```

Клиент преобразует base64 в Blob URL для просмотра/скачивания.

> **Не использовать:** endpoint `/files/{uuid}` — отдаёт 404; endpoint `/cm/xcdb/mit24/file` — SPA-shell.

---

## Хранение данных

### Текущая реализация

Приложение использует **localStorage** для хранения всех данных:
- Средства измерений (СИ)
- Сотрудники, отделы, склады
- Выдачи и возвраты СИ
- Протоколы поверок
- Журнал операций

Все данные хранятся локально в браузере пользователя.

### Архитектура адаптеров (подготовка к серверному режиму)

Создана архитектура адаптеров для будущей интеграции с серверным хранилищем:

```
src/services/storage/
├── StorageAdapter.ts       # Интерфейс адаптера
├── localAdapter.ts         # Адаптер для localStorage (полностью реализован)
├── pocketbaseAdapter.ts    # Адаптер для PocketBase (базовая структура)
├── migrationService.ts     # Сервис миграции данных
└── index.ts                # Фабрика адаптеров
```

**Статус реализации:**
- ✅ LocalStorageAdapter — полностью реализован и используется
- ✅ PocketBaseAdapter — полностью реализован (in-memory кэш + write-through, login/logout, LoginPage)
- ✅ MigrationService — сервис миграции между хранилищами
- Схема коллекции PB: `pb_schema.json`

**Честно не реализовано:**
- Вложения протоколов в серверном режиме — клиентский IndexedDB (PB Files API не подключён, NotImplemented)
- Realtime-синк — в дорожной карте

### Тестирование

Контрактные тесты (`src/services/storage/__tests__/adapter.contract.test.ts`) проверяют корректность реализации CRUD-операций для обоих адаптеров.

**Запуск тестов для LocalStorageAdapter:**
```bash
npm run test
```

**Запуск тестов для PocketBaseAdapter:**
```bash
# Запустите PocketBase в Docker
docker compose up pocketbase -d

# Создайте суперпользователя через Admin UI: http://localhost:8090/_/

# Импортируйте схему: Admin UI → Settings → Collections → Import collections → pb_schema.json

# Создайте обычного пользователя для приложения

# Запустите тесты с переменной окружения
PB_URL=http://localhost:8090 npm run test
```

### Настройка PocketBase

1. Запустите PocketBase:
   ```bash
   docker compose up pocketbase -d
   ```

2. Откройте Admin UI: http://localhost:8090/_/

3. Создайте суперпользователя (email и пароль)

4. Импортируйте схему базы данных:
   - Перейдите в Settings → Collections
   - Нажмите "Import collections"
   - Загрузите файл `pb_schema.json` из корня репозитория

5. Создайте обычного пользователя для приложения:
   - Перейдите в Collections → users
   - Создайте новую запись с email и паролем
   - Этот пользователь будет использоваться для авторизации в приложении

6. Настройте приложение:
   - Откройте Настройки → Источник данных
   - Выберите "Сервер (PocketBase)"
   - Укажите URL: `http://localhost:8090`
   - Нажмите "Проверить соединение"
   - Нажмите "Применить"
   - Войдите с учётными данными созданного пользователя
