# go-api-gateway

Лёгкий API Gateway и relay-сервис на Go, предназначенный для микросервисных архитектур. Он маршрутизирует входящие HTTP-запросы к upstream-сервисам, применяет политики безопасности и управления трафиком и обеспечивает наблюдаемость для production-подобных сред.

## Обзор проекта

Этот проект реализует уровень reverse proxy с базовыми возможностями gateway-сервиса:

- маршрутизация и форвардинг HTTP-запросов
- аутентификация по JWT
- ограничение частоты запросов (rate limiting)
- защита от сбоев через circuit breaker
- round-robin балансировка нагрузки
- структурированное логирование запросов
- метрики и трассировка
- поддержка gRPC-прокси для внутренних сервисов

Gateway построен как переиспользуемый backend-компонент для сервисного взаимодействия и может служить основой для построения устойчивого API-трафика в микросервисной архитектуре.

## Архитектура

Проект построен по модульной middleware-архитектуре:

- слой проксирования
- middleware аутентификации
- middleware ограничения скорости
- middleware circuit breaker
- middleware логирования и трассировки
- observability через Prometheus и OpenTelemetry
- демонстрационные backend-сервисы для тестирования

## Технологический стек

- Go
- HTTP / REST
- JWT
- Prometheus
- OpenTelemetry
- gRPC
- Docker / Docker Compose
- Linux

## Структура проекта

```text
.
├── cmd/
│   └── relay/
│       └── main.go
├── demo-backends/
│   ├── grpc/
│   └── rest/
├── deploy/
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/
│   ├── DESIGN.md
│   └── profiling.md
├── internal/
│   ├── audit/
│   ├── grpcproxy/
│   ├── middleware/
│   │   ├── auth/
│   │   ├── cache/
│   │   ├── circuitbreaker/
│   │   ├── logging/
│   │   ├── ratelimit/
│   │   └── tracing/
│   ├── observability/
│   └── proxy/
├── go.mod
├── go.sum
├── RUNNING.md
└── README.md
```

## Возможности

### Маршрутизация запросов
Gateway принимает входящие запросы от клиентов и форвардит их на доступные upstream backend-сервисы. Поддерживается простая стратегия распределения нагрузки и возможность расширения до более сложной маршрутизации.

### Безопасность
Для защищённых маршрутов используется JWT-аутентификация. Middleware проверки токенов выполняется до отправки запроса к upstream-сервису.

### Управление трафиком
Gateway включает в себя:

- rate limiting
- circuit breaker
- логирование состояния запросов
- базовую проверку доступности backend-сервисов

### Наблюдаемость
Сервис предоставляет метрики и интегрируется с OpenTelemetry для трассировки. Это позволяет отслеживать latency, ошибки и нагрузку в распределённой системе.

## Быстрый старт

### Требования

- Go 1.22+
- Docker (опционально)
- Docker Compose (опционально)

### Запуск локально

1. Соберите бинарники:

```bash
go build -o relay ./cmd/relay
go build -o grpc-backend ./demo-backends/grpc
go build -o rest-backend ./demo-backends/rest
```

2. Запустите demo backend-сервисы:

```bash
./rest-backend
./grpc-backend
```

3. Запустите gateway:

```bash
./relay
```

4. Проверьте работу:

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:8080/health
curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:8080/echo
```

Более подробную инструкцию по запуску и тестированию см. в [`RUNNING.md`](RUNNING.md).

## Конфигурация

Gateway использует стандартные значения для локальной разработки.

Основные локальные настройки:

- Relay: `:8080`
- REST backend: `http://localhost:8081`
- gRPC backend: `http://localhost:8083`
- Metrics endpoint: `:9090`

## Сферы применения

Проект подходит для:

- прототипов API gateway
- маршрутизации внутренних сервисов
- управления микросервисным трафиком
- экспериментов с production-подобной backend-архитектурой
- демонстрации паттернов resilience и observability

## Лицензия

Проект предоставлен для обучения и демонстрации в портфолио.

## Примечание

Проект специально организован как переиспользуемая backend-основа и может быть расширен дополнительной маршрутизацией, авторизацией и мониторингом.
