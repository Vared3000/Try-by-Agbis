# Эксплуатация CleanFlow ERP

## Требования

- Node.js 24;
- pnpm 11.9;
- PostgreSQL 18;
- HTTPS reverse proxy в production;
- постоянные volumes для PostgreSQL и `FILE_STORAGE_PATH`.

## Первичный запуск

```bash
copy .env.example .env
pnpm install --frozen-lockfile
pnpm --filter @cleanflow/server db:migrate
pnpm --filter @cleanflow/server db:seed
pnpm --filter @cleanflow/server user:set-password owner@example.invalid
pnpm dev
```

Production-секреты нельзя брать из `.env.example`. `ACCESS_TOKEN_SECRET` должен
быть случайным, уникальным для окружения и содержать не менее 32 символов.

## Резервное копирование

Ежедневно сохраняются:

1. PostgreSQL через `pg_dump --format=custom`;
2. volume загруженных файлов;
3. конфигурация окружения без публикации секретов.

Восстановление проверяется на отдельном окружении не реже одного раза в месяц.
База и файлы восстанавливаются из одной временной точки.

## Миграции

Перед развёртыванием:

```bash
pnpm --filter @cleanflow/server db:migrate
```

Откат выполняется только после резервной копии:

```bash
pnpm --filter @cleanflow/server db:rollback
```

`Sequelize.sync()` в production не используется.

## Наблюдаемость

- `/api/v1/health` — процесс отвечает;
- `/api/v1/ready` — доступна PostgreSQL;
- логи имеют JSON-формат и correlation ID;
- токены, cookie и пароли редактируются logger-ом;
- заполнение диска файлового volume и БД должно контролироваться внешним
  мониторингом.

## Инциденты

При подозрении на компрометацию:

1. заменить `ACCESS_TOKEN_SECRET`;
2. отозвать активные `refresh_sessions`;
3. сохранить audit log и application logs;
4. проверить tenant scope затронутых запросов;
5. восстановить файлы/БД только из проверенной резервной копии.
