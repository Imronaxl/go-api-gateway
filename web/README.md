# Relay · Gateway Control Plane

Operations-дашборд для сервиса [`go-api-gateway`](../README.md).
Построен на Next.js 16, TypeScript, Tailwind CSS 4 и shadcn/ui.

Портфолийный проект, демонстрирующий как строить реальный SRE / platform
engineering дашборд, работающий с настоящим Go-бэкендом.

## Скриншоты

Каждый скриншот ниже показывает отдельную часть интерфейса. Кликните по
изображению, чтобы открыть его в полном размере.

### 1. Overview

Главная страница — живые KPI (RPS, p99-латентность, error rate, состояние
circuit breaker) со спарклайнами, график трафика, панель circuit breaker с
визуализацией state-machine, цепочка middleware, пул бэкендов и таблица
недавних запросов. Кнопки управления симуляцией наверху позволяют в реальном
времени триггерить события circuit breaker.

![Overview](./screenshots/01-overview.png)

### 2. Playground — конструктор запроса

Отправка запросов через gateway с настраиваемым JWT. Кнопки пресетов для
частых путей, полноценный редактор заголовков, редактор тела для non-GET
методов. JWT-токен автоматически добавляется в заголовок `Authorization`.

![Playground — запрос](./screenshots/02-playground.png)

### 2b. Playground — ответ с timing waterfall

После отправки запроса панель ответа показывает статус, общую длительность,
какой бэкенд обработал запрос, и per-stage timing waterfall — каждая стадия
middleware (logging, tracing, auth, ratelimit, loadbalancer, circuitbreaker,
backend) отображается как горизонтальный отрезок, чтобы было видно, где
именно тратится время.

![Playground — ответ](./screenshots/02b-playground-response.png)

### 3. Metrics

Графики в стиле Prometheus на базе Recharts: KPI-карточки для rps/p50/p95/
p99/errors/429s, тренд латентности (стэк-диаграмма p50/p95/p99), гистограмма
латентности (распределение по бакетам), распределение статус-кодов
(горизонтальный бар), счётчик общего количества запросов и сырая выгрузка
Prometheus в текстовом виде в live-режиме.

![Metrics](./screenshots/03-metrics.png)

### 4. Backends

Пул upstream-сервисов с карточками по каждому бэкенду: прогресс-бар доли
трафика, средняя латентность, error rate, общее количество обработанных
запросов, контролы drain/enable. Сводка по пулу наверху показывает общий
размер, число живых, среднюю латентность и error rate пула.

![Backends](./screenshots/04-backends.png)

### 5. Logs

Структурированный просмотрщик `slog` — новые записи сверху, с фильтром по
уровню (debug/info/warn/error), полнотекстовым поиском по сообщению и полям,
паузой/возобновлением для заморозки потока при разборе, и экспортом в JSON
для офлайн-анализа.

![Logs](./screenshots/05-logs.png)

### 6. Architecture

Визуальная блок-схема цепочки middleware. Левая колонка — путь входящего
запроса (клиент → каждый middleware → бэкенд), правая колонка — путь
исходящего ответа. Карточки деталей ниже объясняют каждую стадию с указанием
пакета и overhead.

![Architecture](./screenshots/06-architecture.png)

### 7. Command palette (⌘K)

Нажмите `⌘K` (или `Ctrl+K`) где угодно, чтобы открыть командную палитру.
Fuzzy-поиск по всем разделам и действиям — навигация стрелками, запуск
через Enter.

![Командная палитра](./screenshots/07-command-palette.png)

### 8. Шпаргалка по горячим клавишам (?)

Нажмите `?`, чтобы открыть полный список горячих клавиш. Цифры 1–6
переключают разделы, `R` перепроверяет доступность gateway, `Esc` закрывает
любой открытый диалог.

![Шпаргалка](./screenshots/08-cheat-sheet.png)

### 9. Concept explainer

Маленькие кнопки `i` рядом с заголовками circuit breaker, rate limit, JWT,
load balancing, tracing и middleware chain открывают письменное объяснение
паттерна — какую проблему решает, как работает, как реализован в этом
gateway, и что ещё стоит знать.

![Concept explainer](./screenshots/09-concept-explainer.png)

### 10. Onboarding tour

При первом заходе посетитель получает пошаговый тур из 6 шагов с индикатором
прогресса. Пропущенные или завершённые туры запоминаются в `localStorage`,
чтобы не беспокоить возвращающихся пользователей.

![Onboarding tour](./screenshots/10-onboarding-tour.png)

### 11. Circuit breaker — состояние open

Клик по «Force breaker open» (или «Inject failure burst») переключает circuit
breaker в открытое состояние. Бейдж статуса становится розовым, визуализация
показывает `open` как активное состояние, а последующие запросы возвращают
503 с записями в логе «service unavailable — circuit open».

![Circuit breaker open](./screenshots/11-circuit-breaker-open.png)

## Быстрый старт

```bash
cd web
bun install
bun run dev      # http://localhost:3000
bun run lint     # ESLint
bun test         # 61 unit-тест в 3 файлах
```

Бэкенд не требуется — дашборд поставляется со встроенным симулятором, который
воспроизводит поведение Go-сервиса relay (token bucket, circuit breaker,
round-robin). Переключитесь в режим `live` в верхней панели, чтобы работать
с реальным relay.

## Возможности

### Шесть разделов

| Раздел        | Что внутри                                                         |
| ------------- | ------------------------------------------------------------------ |
| **Overview**  | KPI-карточки со спарклайнами, live-график трафика, панель circuit breaker с визуализацией state-machine, цепочка middleware, пул бэкендов, таблица недавних запросов, кнопки управления симуляцией |
| **Playground**| Конструктор запроса (метод, путь, заголовки, тело, пресеты) с авто-подстановкой JWT. Панель ответа показывает статус, per-stage timing waterfall, заголовки ответа и тело |
| **Metrics**   | Графики в стиле Prometheus на Recharts: тренд латентности (p50/p95/p99), гистограмма латентности, распределение статус-кодов, счётчик общего числа запросов, плюс сырая выгрузка Prometheus в live-режиме |
| **Backends**  | Сводка по пулу + карточки по каждому бэкенду с долей трафика, латентностью, error rate, контрлами drain/enable |
| **Logs**      | Структурированный просмотрщик `slog` с фильтром по уровню, полнотекстовым поиском, паузой/возобновлением, экспортом в JSON |
| **Architecture** | Визуальная блок-схема цепочки middleware (запрос → бэкенды → ответ) плюс карточки деталей по каждой стадии |

### Дополнительно для собеседования

- **Встроенный движок симуляции** (`src/lib/gateway/mock-engine.ts`) —
  воспроизводит на TypeScript token bucket, state-machine circuit breaker и
  round-robin балансировщик из Go-middleware. См. [ADR-0003](./docs/adr/0003-simulation-engine.md).
- **Concept explainer модалки** — кликните по `i` рядом с circuit breaker,
  rate limit, JWT, load balancing, tracing или middleware chain, чтобы
  открыть письменное объяснение паттерна.
- **Горячие клавиши** — `1`–`6` переключают разделы, `⌘K` открывает командную
  палитру, `?` — шпаргалку, `R` перепроверяет gateway.
- **Командная палитра** (⌘K) — fuzzy-поиск по всем разделам и действиям.
- **Onboarding tour** — пошаговое введение при первом запуске с индикатором
  прогресса, хранится в localStorage.
- **Unit-тесты** (61 тест, 3 файла) — фиксируют форматоры, state-machine
  circuit breaker и контракт с Go-бэкендом. Запуск: `bun test`.
- **Architecture Decision Records** (`docs/adr/`) — пять коротких документов,
  объясняющих, *почему* принято каждое крупное решение.
- **TypeScript-типы зеркалят Go-структуры** — `DEFAULT_GATEWAY_CONFIG`
  соответствует константам из `cmd/relay/main.go`, и тест это проверяет.
  См. [ADR-0005](./docs/adr/0005-types-mirror-go-structs.md).

### Live-режим

Когда реальный relay доступен, дашборд переключается в live-режим:

- Запросы из Playground идут через `fetch()` к relay на `:8080` с
  настроенным JWT
- Раздел Metrics скрапит и парсит текстовую выгрузку Prometheus с
  `:9090/metrics`
- Бейдж подключения в верхней панели показывает латентность пробы

Переключение через **шестерёнку** в верхней панели, либо нажмите `⌘K` и
ищите «live».

## Архитектура

```
web/
├── docs/adr/                # Architecture Decision Records
├── screenshots/             # Скриншоты для README
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Принудительно dark-тема, метаданные
│   │   ├── page.tsx         # Точка входа — рендерит <DashboardShell />
│   │   └── globals.css      # Токены dark SRE-темы, скроллбары, glow-утилиты
│   ├── lib/gateway/
│   │   ├── types.ts         # Доменные типы, зеркалящие Go-структуры (ADR-0005)
│   │   ├── client.ts        # Live-обёртка над fetch + парсер Prometheus
│   │   ├── mock-engine.ts   # Симулятор gateway (ADR-0003)
│   │   ├── store.ts         # Zustand-стор (ADR-0002)
│   │   ├── format.ts        # Форматтеры отображения
│   │   ├── use-keyboard-shortcuts.ts
│   │   └── __tests__/       # Unit-тесты (bun test)
│   ├── components/
│   │   ├── shell/           # Sidebar, topbar, dashboard shell, command palette, cheat sheet, onboarding
│   │   ├── overview/        # KPI, график трафика, панель CB, пул бэкендов
│   │   ├── playground/      # Конструктор запроса, панель ответа, timing waterfall
│   │   ├── metrics/         # Визуализации на Recharts
│   │   ├── backends/        # Карточки бэкендов с контролами
│   │   ├── logs/            # Структурированный просмотрщик логов с фильтрами
│   │   ├── architecture/    # Блок-схема цепочки middleware
│   │   ├── common/          # Panel, StatusDot, Sparkline, ConceptExplainer
│   │   └── ui/              # shadcn/ui-примитивы
│   └── hooks/
└── package.json
```

## Технологический стек

- **Next.js 16** с App Router — одностраничный SPA (см. [ADR-0001](./docs/adr/0001-single-route-spa.md))
- **TypeScript 5** strict mode во всём коде
- **Tailwind CSS 4** с собственными токенами dark SRE-темы
- **shadcn/ui** для примитивных компонентов (Button, Dialog, Select и т.д.)
- **Recharts** для time-series и гистограмм
- **Zustand** для глобального состояния — один стор, подписки через селекторы
- **Lucide** для иконок
- **Bun** как test runner и пакетный менеджер

## Визуальный язык

Тёмная тема в стиле терминала. Полное обоснование в [ADR-0004](./docs/adr/0004-dark-theme-default.md).

- **Фон**: глубокий сланцевый (`oklch(0.16 0.012 240)`) с лёгкой точечной сеткой 24px
- **Основной акцент**: циан (`oklch(0.78 0.15 195)`) — символизирует «активный запрос»
- **Здоровое состояние**: изумрудный — живые бэкенды, `closed` у circuit breaker
- **Деградация**: янтарный — `half-open` breaker, rate-limited ответы
- **Ошибки**: розовый — `open` breaker, 5xx-ответы, логи ошибок
- **Типографика**: Geist Sans для текста, Geist Mono для чисел и кода; `tabular-nums` глобально

## Документация

- [Скриншоты](./screenshots/) — 12 аннотированных скриншотов по каждому разделу и функции
- [ADR (Architecture Decision Records)](./docs/adr/README.md) — пять документов с обоснованием крупных решений
- [README основного проекта](../README.md) — описание Go-бэкенда

## Лицензия

Как у родительского репозитория.
