# DESIGN.md — Архитектурные решения Relay

## 1. Middleware как композируемая цепочка

Используем паттерн `func(http.Handler) http.Handler`. Каждый middleware независим и тестируем в изоляции. Сборка цепочки происходит в одном месте (`cmd/relay/main.go`).

## 2. Circuit breaker — явная state machine

Реализация с нуля (не сторонняя библиотека) для демонстрации понимания паттерна:
- Closed → Open: после N ошибок
- Open → HalfOpen: по таймауту
- HalfOpen → Closed: после M успешных запросов

## 3. Rate limiter — golang.org/x/time/rate

**Обоснование:** Token bucket — хорошо решённая задача. Переизобретение не добавляет ценности для портфолио. Используем проверенную библиотеку, фокусируясь на интеграции и обработке edge cases.

## 4. Context — сквозная отмена

Каждый запрос несёт context с deadline от клиента до backend. Отмена освобождает все горутины (проверено через goleak).

## 5. Kafka — асинхронно, never block hot path

Bounded buffer (channel с ограниченной ёмкостью). При переполнении — drop с метрикой counter.

## 6. Generic Cache[K, V]

TTL кэш для идемпотентных GET. Дженерики используются практически, не для витрины.

## Trade-offs

- **segmentio/kafka-go vs confluent-kafka-go:** Чистый Go без cgo для простоты сборки и кросс-платформенности.
- **Distroless образ:** Минимальный размер (~20MB), безопасность (нет shell).
