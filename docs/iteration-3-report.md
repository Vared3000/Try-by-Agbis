# Отчёт по итерации 3 — база данных

## Реализовано

- 47 Sequelize-моделей для tenant-контура, клиентов, справочников, заказов,
  производства, оплат, файлов, уведомлений, аудита и outbox;
- associations между основными сущностями;
- начальная миграция со всеми таблицами, внешними ключами, индексами и
  критическими unique/check constraints;
- собственный последовательный migration runner с журналом
  `sequelize_migrations`;
- идемпотентный seed безопасных демонстрационных данных;
- seed-пользователь не имеет пароля и находится в статусе `invited`;
- unit-тесты полноты схемы и критических ограничений.

## Команды

```bash
pnpm --filter @cleanflow/server db:migrate
pnpm --filter @cleanflow/server db:seed
pnpm --filter @cleanflow/server db:rollback
```

Все команды используют `DATABASE_URL` из окружения или корневого `.env`.
`Sequelize.sync()` не используется.

## Проверки

- unit/integration tests — пройдены;
- ESLint и Prettier — пройдены;
- production build клиента и сервера — пройден;
- миграция на чистой PostgreSQL 18 — пройдена;
- повторный запуск миграции — пройден;
- повторный идемпотентный seed — пройден;
- rollback с последующим повторным migrate и seed — пройден.
