# go-api-gateway

Go API Gateway / relay service для микросервисной архитектуры. Проект реализует reverse proxy и middleware-слой для маршрутизации HTTP-запросов, аутентификации, ограничения нагрузки и наблюдаемости.

Этот сервис выступает в роли API Gateway между клиентом и backend-сервисами. Он принимает входящие HTTP-запросы, проверяет авторизацию, ограничивает частоту запросов, распределяет нагрузку между upstream-сервисами и передаёт трафик дальше.

В проекте реализованы базовые принципы production-подобной архитектуры:

- маршрутизация запросов
- JWT-аутентификация
- rate limiting
- circuit breaker
- round-robin load balancing
- структурированное логирование
- Prometheus metrics
- OpenTelemetry tracing
- поддержка gRPC proxy

## Архитектура

Приложение построено по модульному middleware-подходу:

- `internal/proxy` — базовый проксирующий слой
- `internal/middleware/auth` — JWT-авторизация
- `internal/middleware/ratelimit` — ограничение скорости
- `internal/middleware/circuitbreaker` — защита от сбоев
- `internal/middleware/logging` — логирование запросов
- `internal/middleware/tracing` — tracing через OpenTelemetry
- `internal/observability` — Prometheus metrics и OTEL bootstrap
- `internal/grpcproxy` — gRPC proxy
- `demo-backends` — test backends для проверки работы gateway

## Технологии

- Go
- HTTP / REST
- JWT
- gRPC
- Prometheus
- OpenTelemetry
- Docker / Docker Compose
- Linux

## Быстрый старт

### 1. Установка зависимостей

```bash
cd /home/imeon/prototype5
go mod download
```

### 2. Сборка проекта

```bash
go build -o relay ./cmd/relay
go build -o grpc-backend ./demo-backends/grpc
go build -o rest-backend ./demo-backends/rest
```

### 3. Запуск backend-сервисов

Откройте два терминала и запустите:

```bash
cd /home/imeon/prototype5
./rest-backend
```

```bash
cd /home/imeon/prototype5
./grpc-backend
```

### 4. Запуск API Gateway

В отдельном терминале:

```bash
cd /home/imeon/prototype5
./relay
```

После запуска сервисы будут доступны по адресам:

- REST backend: `http://localhost:8081`
- gRPC backend: `http://localhost:8083`
- API Gateway: `http://localhost:8080`

## Проверка работы

### Проверка напрямую, без gateway

```bash
curl -s http://localhost:8081/health
curl -s http://localhost:8081/echo
```

Ожидаемый результат:

```json
{"method":"GET","path":"/echo"}
```

### Проверка через gateway

Для доступа к gateway нужен JWT token.

Пример токена:

```bash
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
```

Проверка:

```bash
curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/health
curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/echo
```

### Проверка без JWT

```bash
curl -i http://localhost:8080/health
```

Ожидаемый результат: `401 Unauthorized`.

## Полезные команды

```bash
# Проверка компиляции
cd /home/imeon/prototype5
go test ./...

# Просмотр метрик
curl http://localhost:9090/metrics
```

## Структура репозитория

```text
.
├── cmd/
│   └── relay/
├── demo-backends/
│   ├── grpc/
│   └── rest/
├── deploy/
│   ├── Dockerfile
│   └── docker-compose.yml
├── internal/
│   ├── audit/
│   ├── grpcproxy/
│   ├── middleware/
│   ├── observability/
│   └── proxy/
├── web/                      # Frontend dashboard (Next.js 16)
│   ├── docs/adr/             # Architecture Decision Records
│   ├── src/                  # App, components, lib, tests
│   └── README.md
├── go.mod
├── go.sum
└── README.md
```

## Web-интерфейс

В папке [`web/`](./web/) находится **Gateway Control Plane** — operations-дашборд
на Next.js 16 + TypeScript + Tailwind CSS 4, который работает с этим бэкендом.

**Шесть разделов:**

- **Overview** — живые KPI (RPS, p99, error rate, состояние circuit breaker),
  traffic chart, диаграмма state-machine circuit breaker, пул бэкендов,
  таблица недавних запросов + кнопки управления симуляцией
- **Playground** — отправка запросов через gateway с настраиваемым JWT,
  per-stage timing waterfall
- **Metrics** — графики в стиле Prometheus: latency (p50/p95/p99), histogram,
  статус-коды, raw metrics endpoint
- **Backends** — пул upstream-сервисов с health, traffic share, drain/enable
- **Logs** — структурированный просмотрщик slog-вывода с фильтрами, паузой,
  экспортом JSON
- **Architecture** — визуальная диаграмма middleware chain с info-точками на
  каждой стадии

**Режимы работы:**

- **Live** — реальные запросы к запущенному `relay` (`:8080`) и Prometheus (`:9090`)
- **Simulated** — встроенный движок симуляции, точно воспроизводящий поведение
  middleware (token bucket, circuit breaker state machine, round-robin).
  Позволяет изучать дашборд без запущенного бэкенда.

**Что интересно для собеседования:**

- 61 unit-тест (`bun test`) — форматоры, state-machine circuit breaker,
  контракт с Go-бэкендом
- Architecture Decision Records в [`web/docs/adr/`](./web/docs/adr/) — 5 ADR с
  обоснованием решений (Zustand vs Redux, симулятор, dark theme, и т.д.)
- Concept explainer модалки — нажми на `i` рядом с circuit breaker / rate
  limit / JWT / load balancing / tracing чтобы прочитать объяснение паттерна
- Command palette (⌘K) и keyboard shortcuts (`?` для cheat sheet)
- Onboarding tour при первом запуске
- 12 скриншотов в [`web/screenshots/`](./web/screenshots/) — каждая часть
  интерфейса задокументирована с описанием что показано

Подробности и скриншоты в [`web/README.md`](./web/README.md).
