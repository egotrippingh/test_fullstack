# PromoCode Manager

Учебный fullstack-проект: управление промокодами, создание заказов, применение скидок и аналитика на ClickHouse с кэшем Redis.

## Что сделано

Backend:

- `NestJS` + MongoDB (запись)
- ClickHouse (чтение аналитики)
- Redis (lock + cache)
- admin seed для локального запуска
- Auth (JWT + refresh), users, promocodes, orders
- Swagger, health endpoint, базовые guard/DTO

Frontend:

- React + MUI + React Query + React Router
- страницы логина/регистрации
- промокоды (создание/редактирование/деактивация)
- заказы (создание, применение промокодов)
- аналитика (users, promocodes, promo-usages)

## Архитектура и CQRS

- **Write-path**: HTTP → MongoDB (основные сущности).
- **Sync**: после мутаций данные пишутся в ClickHouse, а обновления пользователей и промокодов пересинхронизируют зависимые строки `orders` и `promo_usages`.
- **Read-path**: аналитика, список промокодов и список заказов читаются только из ClickHouse.
- **Redis**:
  - lock при применении промокода
  - кэш аналитики с инвалидацией на мутациях

## MongoDB collections

- `users`: профиль, роль, состояние
- `promocodes`: правила скидок и лимиты
- `orders`: заказ пользователя + сведения о применённом промокоде
- `promo_usages`: история применений

## ClickHouse tables

- `users`
- `promocodes`
- `orders`
- `promo_usages`

Схемы создаются автоматически при старте backend.

Для снапшотных таблиц используется `ReplacingMergeTree`, а read-path читает их с `FINAL`, чтобы обновления не дублировали аналитику.

## Redis use-cases

- `lock:promocode:{id}` — защита от гонок применения
- `analytics:*` — кэш аналитики
- refresh tokens

## Запуск

Инфраструктура:

```bash
docker compose up --build
```

`docker compose` собирает production-версию frontend и раздает `dist` через `nginx`.

Backend локально:

```bash
cd apps/backend
npm ci
npm run start:dev
```

При локальном запуске backend автоматически создаёт admin-учётку:

- email: `admin@example.com`
- password: `admin12345`

Frontend локально:

```bash
cd apps/frontend
cp .env.example .env
npm ci
npm run dev
```

Сервисы:

- backend: `http://localhost:3000/api`
- swagger: `http://localhost:3000/docs`
- health: `http://localhost:3000/api/health`
- frontend: `http://localhost:4173`
- frontend dev: `http://localhost:5173`
- mongo: `localhost:27017`
- clickhouse: `http://localhost:8123`
- redis: `localhost:6379`

## Основные endpoints

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Users:

- `GET /users/me`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/:id/deactivate`

PromoCodes:

- `POST /promocodes`
- `GET /promocodes`
- `GET /promocodes/:id`
- `PATCH /promocodes/:id`
- `PATCH /promocodes/:id/deactivate`

Orders:

- `POST /orders`
- `GET /orders/my`
- `GET /orders/:id`
- `POST /orders/:id/apply-promocode`

Analytics:

- `GET /analytics/users`
- `GET /analytics/promocodes`
- `GET /analytics/promo-usages`

## Assumptions и ограничения

- без явного RBAC (роль есть в user, но UI не разделяет права)
- транзакций MongoDB нет, откаты применения промокода реализованы вручную
- фронтенд рассчитан на локальную разработку через Vite
- backend build пишет артефакты в `apps/backend/.build`, поэтому локальная сборка не зависит от docker-owned `dist`
