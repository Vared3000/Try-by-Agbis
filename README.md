# CleanFlow ERP

CleanFlow ERP — самостоятельная веб-система управления химчисткой и прачечной.

Репозиторий: `git@github.com:Vared3000/Try-by-Agbis.git`.

Этапы анализа, проектирования и инфраструктурного каркаса завершены. Реализован
слой данных: модели Sequelize, миграции и безопасные демонстрационные данные.

## Документы

- [Описание продукта и границы MVP](docs/product.md)
- [Архитектура и структура репозитория](docs/architecture.md)
- [Модель данных и ER-диаграмма](docs/data-model.md)
- [Роли и разрешения](docs/rbac.md)
- [Жизненные циклы заказа и изделия](docs/workflows.md)
- [Предварительный REST API](docs/api-contract.md)
- [OpenAPI 3.1](docs/openapi.json)
- [План разработки и backlog](docs/backlog.md)
- [Риски, допущения и критерии приёмки](docs/project-controls.md)
- [Реестр технического долга](docs/technical-debt.md)
- [Эксплуатация](docs/operations.md)
- [Security review](docs/security-review.md)
- [Отчёт по итерации 3](docs/iteration-3-report.md)
- [Отчёт по итерации 4](docs/iteration-4-report.md)
- [Отчёт по итерации 5](docs/iteration-5-report.md)
- [Отчёт по итерации 6](docs/iteration-6-report.md)
- [Отчёт по итерации 7](docs/iteration-7-report.md)
- [Отчёт по итерации 8](docs/iteration-8-report.md)
- [Отчёт по итерации 9](docs/iteration-9-report.md)
- [Отчёт по итерации 10](docs/iteration-10-report.md)
- [Отчёт по итерации 11](docs/iteration-11-report.md)
- [Отчёт по итерации 12](docs/iteration-12-report.md)
- [Отчёт по итерации 13](docs/iteration-13-report.md)

## Работа с базой данных

После настройки `DATABASE_URL`:

```bash
pnpm --filter @cleanflow/server db:migrate
pnpm --filter @cleanflow/server db:seed
pnpm --filter @cleanflow/server db:rollback
```

Seed создаёт только демонстрационного пользователя без пароля в статусе
`invited`; готовых учётных данных в репозитории нет.

Для активации пользователя пароль задаётся интерактивно:

```bash
pnpm --filter @cleanflow/server user:set-password owner@example.invalid
```

## Статус

MVP реализован: слой данных, авторизация и RBAC, клиенты, справочники, заказы,
оплаты, производство, выдача, уведомления, отчёты и аудит. Добавлены адаптивный
рабочий интерфейс, OpenAPI 3.1, автоматические проверки, CI и эксплуатационная
документация.
