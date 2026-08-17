# Relay — API Gateway на Go

Легковесный reverse proxy шлюз с балансировкой нагрузки, rate limiting, circuit breaker и observability.

## Фичи

- Reverse proxy с round-robin балансировкой
- JWT аутентификация
- Token bucket rate limiter
- Circuit breaker (Closed/Open/HalfOpen)
- Generic TTL кэш
- gRPC проксирование
- Async audit логирование через Kafka
- OpenTelemetry трассировка
- Prometheus метрики

## Быстрый старт

```bash
docker compose up
```

## Архитектура

См. [DESIGN.md](docs/DESIGN.md)

## Структура

```
relay/
├── cmd/relay/              # main.go
├── internal/
│   ├── proxy/              # reverse proxy
│   ├── middleware/         # auth, ratelimit, circuitbreaker, cache, tracing, logging
│   ├── grpcproxy/          # gRPC proxy
│   ├── audit/              # kafka publisher
│   └── observability/      # otel, metrics
├── demo-backends/          # тестовые бэкенды
├── deploy/                 # docker-compose, Dockerfile, k8s
└── docs/                   # DESIGN.md, profiling.md
```
