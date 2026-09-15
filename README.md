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
  const targetUrl = `https://fgis.gost.ru/fundmetrology/${path.join('/')}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Metrolog-Manage/1.0',
        ...req.headers,
      },
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error' });
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
