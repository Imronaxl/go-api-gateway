# go-api-gateway

Go API Gateway / relay service для микросервисной архитектуры, плюс
operations-дашборд на Next.js для управления им.

Проект реализует reverse proxy с middleware-слоем для маршрутизации
HTTP-запросов, аутентификации, ограничения нагрузки и наблюдаемости. Сервис
выступает в роли API Gateway между клиентом и backend-сервисами: принимает
входящие HTTP-запросы, проверяет авторизацию, ограничивает частоту запросов,
распределяет нагрузку между upstream-сервисами и передаёт трафик дальше.

## Возможности

- Маршрутизация запросов через middleware-пайплайн
- JWT-аутентификация
- Rate limiting (token bucket)
- Circuit breaker (closed / open / half-open)
- Round-robin load balancing
- Структурированное логирование (`slog`)
- Prometheus metrics на `:9090/metrics`
- OpenTelemetry tracing (OTLP/gRPC)
- gRPC proxy
- Web-дашборд для управления и мониторинга

## Архитектура

Приложение построено по модульному middleware-подходу:

```
запрос → logging → tracing → auth → ratelimit → [loadbalancer → circuitbreaker] → backend
```

| Пакет | Назначение |
|-------|-----------|
| `internal/proxy` | Базовый проксирующий слой, round-robin балансировщик |
| `internal/middleware/auth` | JWT-авторизация |
| `internal/middleware/ratelimit` | Token bucket rate limiter |
| `internal/middleware/circuitbreaker` | Защита от сбоев (state machine) |
| `internal/middleware/logging` | Структурированное логирование запросов |
| `internal/middleware/tracing` | Tracing через OpenTelemetry |
| `internal/middleware/cache` | Generic TTL-кеш (generic-типы Go) |
| `internal/observability` | Prometheus metrics и OTEL bootstrap |
| `internal/grpcproxy` | gRPC proxy |
| `internal/audit` | Аудит-события в Kafka |
| `demo-backends` | Test backends для проверки работы gateway |
| `web` | Operations-дашборд на Next.js 16 |

## Быстрый старт

### Backend (Go)

```bash
# Установка зависимостей
go mod download

# Сборка
go build -o relay ./cmd/relay
go build -o rest-backend ./demo-backends/rest
go build -o grpc-backend ./demo-backends/grpc

# Запуск backend-сервисов (в отдельных терминалах)
./rest-backend    # :8081
./grpc-backend    # :8083

# Запуск API Gateway
./relay           # :8080, metrics на :9090
```

### Frontend (Next.js)

```bash
cd web
bun install
bun run dev       # http://localhost:3000
bun run lint      # ESLint
bun test          # 61 unit-тест
```

Дашборд работает без запущенного backend-а — встроенный симулятор
воспроизводит поведение Go-middleware на TypeScript. Переключитесь в режим
`live` в верхней панели, чтобы работать с реальным relay.

### Docker Compose

```bash
cd deploy
docker-compose up
```

Поднимает relay, два REST backend-а, gRPC backend, Kafka, OTel Collector,
Prometheus и Grafana.

## Проверка работы

### Напрямую, без gateway

```bash
curl -s http://localhost:8081/health    # → ok
curl -s http://localhost:8081/echo      # → {"method":"GET","path":"/echo"}
```

### Через gateway (с JWT)

```bash
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/health
curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/echo
```

### Без JWT

```bash
curl -i http://localhost:8080/health    # → 401 Unauthorized
```

### Метрики

```bash
curl http://localhost:9090/metrics
```

## Web-интерфейс (Gateway Control Plane)

Operations-дашборд на Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui.
Работает с relay на `:8080` и Prometheus на `:9090`, при недоступности
бэкенда переключается на встроенный симулятор.

### Скриншоты

Каждый скриншот показывает отдельную часть интерфейса.

#### 1. Обзор

Живые KPI (RPS, p99, error rate, состояние circuit breaker) со спарклайнами,
график трафика, панель circuit breaker с визуализацией state-machine, цепочка
middleware, пул бэкендов, таблица недавних запросов. Кнопки управления
симуляцией наверху позволяют триггерить события circuit breaker в реальном
времени.

![Обзор](./web/screenshots/01-overview.png)

#### 2. Песочница — конструктор запроса

Отправка запросов через gateway с настраиваемым JWT. Пресеты для частых путей,
редактор заголовков, редактор тела для non-GET методов. JWT автоматически
добавляется в заголовок `Authorization`.

![Песочница — запрос](./web/screenshots/02-playground.png)

#### 2b. Песочница — ответ с timing waterfall

После отправки панель ответа показывает статус, общую длительность, какой
бэкенд обработал запрос, и per-stage timing waterfall — каждая стадия
middleware (logging, tracing, auth, ratelimit, loadbalancer, circuitbreaker,
backend) отображается как горизонтальный отрезок.

![Песочница — ответ](./web/screenshots/02b-playground-response.png)

#### 3. Метрики

Графики в стиле Prometheus на Recharts: KPI-карточки для rps/p50/p95/p99/
errors/429s, тренд латентности, гистограмма латентности, распределение
статус-кодов, счётчик общего числа запросов и сырая выгрузка Prometheus в
live-режиме.

![Метрики](./web/screenshots/03-metrics.png)

#### 4. Бэкенды

Пул upstream-сервисов с карточками по каждому бэкенду: прогресс-бар доли
трафика, средняя латентность, error rate, общее количество обработанных
запросов, контролы drain/enable. Сводка по пулу наверху показывает общий
размер, число живых, среднюю латентность и error rate пула.

![Бэкенды](./web/screenshots/04-backends.png)

#### 5. Логи

Структурированный просмотрщик `slog` — новые записи сверху, фильтр по уровню
(debug/info/warn/error), полнотекстовый поиск, пауза/возобновление для
заморозки потока, экспорт в JSON.

![Логи](./web/screenshots/05-logs.png)

#### 6. Архитектура

Визуальная блок-схема цепочки middleware. Левая колонка — путь входящего
запроса (клиент → каждый middleware → бэкенд), правая колонка — путь
исходящего ответа. Карточки деталей объясняют каждую стадию с указанием
пакета и overhead.

![Архитектура](./web/screenshots/06-architecture.png)

#### 7. Командная палитра (⌘K)

Нажмите `⌘K` (или `Ctrl+K`) — fuzzy-поиск по всем разделам и действиям.
Навигация стрелками, запуск через Enter.

![Командная палитра](./web/screenshots/07-command-palette.png)

#### 8. Шпаргалка по горячим клавишам (?)

Нажмите `?` — полный список горячих клавиш. Цифры 1–6 переключают разделы,
`R` перепроверяет gateway, `Esc` закрывает диалог.

![Шпаргалка](./web/screenshots/08-cheat-sheet.png)

#### 9. Concept explainer

Маленькие кнопки `i` рядом с заголовками circuit breaker, rate limit, JWT,
load balancing, tracing и middleware chain открывают письменное объяснение
паттерна — какую проблему решает, как работает, как реализован в этом
gateway, какие альтернативы существуют.

![Concept explainer](./web/screenshots/09-concept-explainer.png)

#### 10. Onboarding tour

При первом заходе — пошаговый тур из 6 шагов с индикатором прогресса.
Запоминается в `localStorage`, чтобы не беспокоить возвращающихся
пользователей.

![Onboarding tour](./web/screenshots/10-onboarding-tour.png)

#### 11. Circuit breaker — состояние open

Клик по «Открыть breaker» (или «Инжектить всплеск ошибок») переключает
circuit breaker в открытое состояние. Бейдж статуса становится розовым,
визуализация показывает `open` как активное состояние, последующие запросы
возвращают 503 с записями в логе «service unavailable — circuit open».

![Circuit breaker open](./web/screenshots/11-circuit-breaker-open.png)

### Разделы дашборда

| Раздел | Назначение |
|--------|-----------|
| **Обзор** | KPI-карточки со спарклайнами, live-график трафика, панель circuit breaker, цепочка middleware, пул бэкендов, таблица недавних запросов, кнопки управления симуляцией |
| **Песочница** | Конструктор запроса (метод, путь, заголовки, тело, пресеты) с авто-подстановкой JWT. Панель ответа: статус, per-stage timing waterfall, заголовки, тело |
| **Метрики** | Графики в стиле Prometheus: тренд латентности (p50/p95/p99), гистограмма, распределение статус-кодов, счётчик запросов, сырая выгрузка Prometheus |
| **Бэкенды** | Сводка по пулу + карточки с долей трафика, латентностью, error rate, контрлами drain/enable |
| **Логи** | Структурированный просмотрщик `slog` с фильтром по уровню, поиском, паузой, экспортом в JSON |
| **Архитектура** | Визуальная блок-схема цепочки middleware (запрос → бэкенды → ответ) |

### Режимы работы

- **Live** — реальные запросы к запущенному relay (`:8080`) и Prometheus
  (`:9090`). Бейдж подключения показывает латентность пробы.
- **Simulated** — встроенный движок симуляции на TypeScript, точно
  воспроизводящий token bucket, state-machine circuit breaker (closed → open
  → half-open → closed) и round-robin балансировщик из Go-middleware.

Переключение через **шестерёнку** в верхней панели, либо `⌘K` → «live».

### Дополнительно

- **Горячие клавиши** — `1`–`6` переключают разделы, `⌘K` открывает командную
  палитру, `?` — шпаргалку, `R` перепроверяет gateway.
- **Onboarding tour** — пошаговое введение при первом запуске, хранится в
  `localStorage`.
- **Concept explainer** — модальные окна с объяснением паттернов (circuit
  breaker, rate limiting, JWT, load balancing, tracing, middleware chain).
- **61 unit-тест** (`bun test`) — форматоры, state-machine circuit breaker,
  контракт с Go-бэкендом.
- **5 ADR** в [`web/docs/adr/`](./web/docs/adr/) — обоснование архитектурных
  решений (Zustand vs Redux, симулятор, тёмная тема, типы зеркалят
  Go-структуры, одностраничный SPA).
- **TypeScript-типы зеркалят Go-структуры** — `DEFAULT_GATEWAY_CONFIG`
  соответствует константам из `cmd/relay/main.go`, тест это проверяет.

## Структура репозитория

```
.
├── cmd/
│   └── relay/                # Точка входа gateway
├── demo-backends/
│   ├── grpc/                 # Тестовый gRPC backend
│   └── rest/                 # Тестовый REST backend
├── deploy/
│   ├── Dockerfile
│   └── docker-compose.yml    # relay + 2 REST + gRPC + Kafka + OTel + Prometheus + Grafana
├── internal/
│   ├── audit/                # Аудит-события в Kafka
│   ├── grpcproxy/            # gRPC proxy
│   ├── middleware/
│   │   ├── auth/             # JWT-авторизация
│   │   ├── cache/            # TTL-кеш (generic)
│   │   ├── circuitbreaker/   # State machine (closed/open/half-open)
│   │   ├── logging/          # slog-логирование
│   │   ├── ratelimit/        # Token bucket
│   │   └── tracing/          # OpenTelemetry
│   ├── observability/        # Prometheus + OTEL bootstrap
│   └── proxy/                # Reverse proxy + round-robin LB
├── web/                      # Frontend (Next.js 16)
│   ├── docs/adr/             # Architecture Decision Records (5 документов)
│   ├── screenshots/          # 12 скриншотов интерфейса
│   ├── src/
│   │   ├── app/              # layout, page, globals.css
│   │   ├── lib/gateway/      # types, client, mock-engine, store, format, тесты
│   │   └── components/       # shell, overview, playground, metrics, backends, logs, architecture, common, ui
│   └── package.json
├── go.mod
└── README.md
```

## Технологии

**Backend:**
- Go 1.23
- `net/http`, `httputil.ReverseProxy`
- `golang.org/x/time/rate` (token bucket)
- OpenTelemetry SDK (OTLP/gRPC exporter)
- Prometheus client_golang
- Kafka (segmentio/kafka-go) — аудит-события
- gRPC

**Frontend:**
- Next.js 16 (App Router, одностраничный SPA)
- TypeScript 5 (strict mode)
- Tailwind CSS 4 (тёмная SRE-тема на OKLCH)
- shadcn/ui (примитивные компоненты)
- Recharts (time-series, гистограммы)
- Zustand (глобальное состояние, selector-подписки)
- Lucide (иконки)
- Bun (test runner, пакетный менеджер)

**Инфраструктура:**
- Docker / Docker Compose
- Prometheus + Grafana
- OTel Collector
- Kafka (apache/kafka)

## Полезные команды

```bash
# Проверка компиляции
go build ./...

# Запуск тестов Go
go test ./...

# Запуск frontend-тестов
cd web && bun test

# Линт frontend
cd web && bun run lint

# Просмотр метрик
curl http://localhost:9090/metrics
```

## Лицензия

Проект доступен под лицензией MIT.
