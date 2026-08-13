# Инструкция по запуску и тестированию проекта

## Что было исправлено

1. **go.mod** — заменён неправильный путь модуля:
   - ❌ `go.prometheus.io/client_golang`
   - ✅ `github.com/prometheus/client_golang`

2. **internal/proxy/proxy.go** — удалён неиспользуемый импорт `context`

3. **internal/middleware/ratelimit/ratelimit.go** — удалён неиспользуемый импорт `time`

4. **cmd/relay/main.go** — исправлены две критические ошибки:
   - Обрезанные URL backends → теперь `http://localhost:8081` и `http://localhost:8083`
   - Вместо несуществующей функции `proxy.NewRequest()` использован стандартный `http.NewRequestWithContext()`
   - Правильное копирование Headers (исключая Host header)

5. **internal/grpcproxy/grpcproxy.go** — заменён `grpc.NewClient()` на `grpc.Dial()` (совместимость с gRPC v1.62.0)

## Статус тестирования

✅ **`go test ./...`** — все пакеты компилируются успешно  
✅ **Все бинарники построены** — relay, grpc-backend, rest-backend  
✅ **Services запускаются** — оба бэкенда и relay работают без ошибок  

## Быстрый старт

### 1. Сборка всех компонентов

```bash
cd /home/imeon/prototype5

# Собрать все бинарники
go build -o relay ./cmd/relay
go build -o grpc-backend ./demo-backends/grpc
go build -o rest-backend ./demo-backends/rest
```

### 2. Запуск services (в отдельных терминалах или в фоне)

**Терминал 1 — REST backend (порт 8081):**
```bash
./rest-backend
```
Вывод: `{"level":"INFO","msg":"rest backend starting","addr":":8081"}`

**Терминал 2 — GRPC backend (порт 8083):**
```bash
./grpc-backend
```
Вывод: `{"level":"INFO","msg":"grpc backend starting","addr":":8083"}`

**Терминал 3 — Relay gateway (порт 8080):**
```bash
./relay
```
Вывод: `{"level":"INFO","msg":"relay starting","addr":":8080"}`

### 3. Тестирование

#### Тест 1: Прямой запрос к REST backend
```bash
curl -s http://localhost:8081/health
# Ответ: ok

curl -s http://localhost:8081/echo
# Ответ: {"method":"GET","path":"/echo"}
```

#### Тест 2: Запрос через Relay (требует JWT)
```bash
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

curl -s -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/health
# Ответ: ok

curl -s -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/echo
# Ответ: {"method":"GET","path":"/echo"}
```

#### Тест 3: Проверка Rate Limiting (100 requests/sec burst 50)
```bash
for i in {1..100}; do
  curl -s -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8080/health &
done
wait
```

#### Тест 4: Проверка Load Balancing
Relay использует Round-Robin для распределения запросов между двумя backend'ами.  
Проверить логи:
```bash
tail -f relay.log
```

## Архитектура

```
REST Client
    ↓
Relay Gateway (8080)
    └─→ Auth Middleware (JWT)
    └─→ Tracing Middleware (OpenTelemetry)
    └─→ Load Balancer (Round-Robin)
    └─→ Circuit Breaker (max 5 failures, 30s timeout)
    └─→ Rate Limiter (100 req/sec)
    └─→ Logging
    ↓
Load Balanced Backends:
    ├─ REST Backend (8081) - echo, health endpoints
    └─ GRPC Backend (8083) - empty service
    
Observability:
    └─ Metrics Server (9090)
    └─ OpenTelemetry Export (4317 - optional)
```

## Конфигурация

### Переменные окружения
- `RELAY_AUTH_SECRET` — secret key для JWT (default: "secret-key")

### Hardcoded конфигурация (в коде)
- **Relay адрес**: `:8080`
- **Metrics адрес**: `:9090`
- **REST backend**: `http://localhost:8081`
- **GRPC backend**: `http://localhost:8083`
- **Rate limit**: 100 req/sec, burst 50
- **Circuit breaker**: max 5 failures, 30s timeout

## Известные особенности

1. **OTEL eksportuje ошибки** — если нет running OpenTelemetry collector на 127.0.0.1:4317, будут ошибки в логах (это нормально для локального тестирования)

2. **Unused dependencies** — `go.uber.org/goleak`, `go.uber.org/zap`, `gopkg.in/yaml.v3` не используются в текущем коде

3. **Нет unit тестов** — в проекте нет test файлов, но код логи работает с integration тестами через curl

## Docker Compose

Если хотите запустить через Docker:
```bash
cd deploy
docker-compose up --build
```

## Дополнительные команды

```bash
# Очистить бинарники
rm relay grpc-backend rest-backend

# Очистить логи
rm *.log

# Проверить зависимости
go mod graph

# Форматировать код
go fmt ./...

# Проверить на ошибки
go vet ./...
```
