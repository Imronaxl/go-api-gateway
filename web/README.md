# Gateway Control Plane

Operations-дашборд для сервиса [`go-api-gateway`](../README.md) — фронтенд
на Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui.

Полная документация, скриншоты и описание разделов — в основном
[README репозитория](../README.md#web-интерфейс-gateway-control-plane).

## Быстрый старт

```bash
bun install
bun run dev       # http://localhost:3000
bun run lint      # ESLint
bun test          # 61 unit-тест
```

Бэкенд не требуется — дашборд поставляется со встроенным симулятором,
который воспроизводит поведение Go-middleware (token bucket, circuit
breaker, round-robin). Переключитесь в режим `live` в верхней панели для
работы с реальным relay.

## Структура

```
web/
├── docs/adr/        # 5 Architecture Decision Records
├── screenshots/     # 12 скриншотов интерфейса
└── src/
    ├── app/         # layout, page, globals.css
    ├── lib/gateway/ # types, client, mock-engine, store, format, тесты
    └── components/  # shell, overview, playground, metrics, backends, logs, architecture, common, ui
```

## Документация

- [Основной README](../README.md) — описание всего проекта (backend + frontend)
- [ADR](./docs/adr/README.md) — 5 документов с обоснованием архитектурных решений
- [Скриншоты](./screenshots/) — 12 аннотированных скриншотов
