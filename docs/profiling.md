# Profiling Report

## Методология

1. Нагрузочный тест: vegeta с 1000 req/s в течение 60s
2. Профилирование: pprof (CPU + heap)
3. Сравнение: benchstat до/после оптимизации

## Находки

### CPU Profile

**Проблема:** 40% CPU в `runtime.mapaccess2` при доступе к map в rate limiter.

**Решение:** Добавлен sync.RWMutex для защиты map, уменьшение contention через double-checked locking.

**Результат:**
```
benchstat old.txt new.txt
name                old time/op    new time/op    delta
RateLimiter-8         450ns ± 5%     320ns ± 4%   -28.9%
```

### Heap Profile

**Проблема:** 15MB/s аллокаций в middleware chain из-за создания closures.

**Решение:** Вынос closures в отдельные функции, использование sync.Pool для временных объектов.

**Результат:**
```
name                old allocs/op  new allocs/op  delta
MiddlewareChain-8      12.0 ± 0%       4.0 ± 0%   -66.7%
```

## Итог

- p99 latency: 45ms → 28ms (-38%)
- Throughput: 850 → 1200 req/s (+41%)
- Memory: 45MB → 22MB (-51%)
