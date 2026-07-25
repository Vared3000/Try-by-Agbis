# HANDOFF: перевести фронтенд на REST-ориентированную архитектуру

> Этот файл — для новой рабочей сессии. Открой его первым делом и
> следуй ему. Роль и архитектурные принципы уже описаны в
> `PROJECT_CONSTITUTION.md` и подгружаются автоматически через
> `CLAUDE.md` — они обязательны и здесь не дублируются.

## Стек и как поднять проект

- pnpm-монорепо: `server/` (Express 5 + Sequelize + Postgres), `client/`
  (React 19 + Vite + React Query + Zustand).
- Локальный Postgres — служба Windows `postgresql-x64-18`, не Docker.
  `.env` уже настроен на `localhost:5432`.
- Поднять: `node server/src/server.js` (порт 3000) и
  `pnpm --filter @cleanflow/client dev` (порт 5173). Актуальные скрипты
  смотри в `server/package.json` и `client/package.json`.
- Логин в приложение: `owner@example.invalid` / `DevPass123!`
- Перед стартом работы прогони:
  - `pnpm lint`
  - `pnpm --recursive test`
  - из `server/`: `node --env-file-if-exists=../.env
    node_modules/vitest/vitest.mjs run src/tests/auth.integration.test.js`
    — интеграционные тесты на реальной БД, пропускаются в обычном прогоне.

Всё должно быть зелёным до начала работы — если нет, сначала разберись,
почему, прежде чем добавлять свои изменения поверх.

## Задача

Бэкенд уже полноценный REST API (задокументирован в
`docs/api-contract.md` и `openapi.json`). Проблема — фронтенд: все ~70
вызовов `apiClient.get/post/patch/delete` раскиданы прямо по ~18 файлам
страниц и фич (`OrdersPage.jsx`, `ClientsPage.jsx`, `PriceListsPage.jsx`,
`CatalogPage.jsx`, `ProductionPage.jsx`, `TransfersPage.jsx`,
`NomenclaturePage.jsx`, `DefectGroupsPanel.jsx`, `ClientPickerModal.jsx`,
`ClientEditModal.jsx`, `OrderItemControls.jsx`, `PaymentModal.jsx`,
`OrderItemPickerModal.jsx`, `WorkspacePage.jsx` и др.) — нет отдельного
слоя данных, хотя `PROJECT_CONSTITUTION.md` явно требует структуру
`services/ queries/ mutations/` и запрещает бизнес-логику в pages.

### Целевой паттерн

- `client/src/services/<resource>.js` — чистые async-функции, обёртка
  над `apiClient`, по одной на REST-операцию (например `listOrders(params)`,
  `getOrder(id)`, `createOrder(payload)`, `updateOrder(id, payload)`,
  `acceptOrder(id)`). Разворачивают envelope (`response.data.data`).
- `client/src/queries/<resource>.js` — хуки на `useQuery` поверх сервисов,
  с единым источником правды для `queryKey`. Сегодня одни и те же ключи
  (`['clients']`, `['nomenclature']`, `['defect-groups']`, `['price-lists']`
  и т.д.) задублированы буквально в нескольких файлах — реальный источник
  рассинхрона инвалидации кэша.
- `client/src/mutations/<resource>.js` — хуки на `useMutation` поверх
  сервисов.
- Страницы/фичи дёргают только хуки из `queries/mutations`, никакого
  `apiClient` напрямую.

### Порядок миграции (от простого к сложному, Orders — последним)

1. **catalog** (materials/colors/contaminations/service-categories) +
   **services** — уже есть PATCH/DELETE на бэкенде, недавно добавлен UI
   редактирования в `CatalogPage.jsx`, паттерн инвалидации можно взять
   оттуда.
2. **defect-groups** (`DefectGroupsPanel.jsx`, общий `queryKey
   ['defect-groups']` также используется из `NomenclaturePage.jsx`).
3. **nomenclature** (`NomenclaturePage.jsx`).
4. **price-lists** (`PriceListsPage.jsx`, плюс используется из
   `OrdersPage.jsx` для ценообразования — общие ключи `['price-lists']`,
   `['price-list', id]`).
5. **clients** (`ClientsPage.jsx`, `ClientPickerModal.jsx`,
   `ClientEditModal.jsx` — три места создают/обновляют клиента и адрес,
   ключ `['clients']` используется в нескольких вариантах, плюс
   `['clients-page', search]` отдельно).
6. **production** (`ProductionPage.jsx`).
7. **transfers** (`TransfersPage.jsx`, `OrderItemPickerModal.jsx`).
8. **reports** (`WorkspacePage.jsx` — `/reports/operational`,
   `/reports/financial`).
9. **payments** (`PaymentModal.jsx` — `/cash-shifts`) и **files**
   (`OrderItemControls.jsx` — `/files`, `/order-items/:id/measurements`).
10. **auth** — `client/src/api/client.js` уже содержит `login`/
    `refreshSession`/`logout`/`getCurrentUser` как отдельные функции — по
    сути уже сервис-слой для auth, просто не в папке `services/`. Оценить,
    стоит ли переносить, или оставить как есть (используется в
    `App.jsx`, `InfrastructurePage.jsx`, `LoginPage.jsx`).
11. **orders** (`OrdersPage.jsx`) — самый большой и сложный файл, ~25
    вызовов `apiClient`. Делать последним, когда паттерн обкатан на
    остальном.

## Жёсткие ограничения

- Клиентские тесты (`client/src/tests/*.test.jsx`) мокают
  `../api/client.js` напрямую (`vi.mock('../api/client.js', ...)`) и
  проверяют, что `apiClient.get/post` вызывался с конкретными URL. Если
  сервисы просто оборачивают те же вызовы с теми же URL и структурой
  payload, тесты не должны ломаться без изменений — но проверяй после
  каждого мигрированного ресурса.
- Один и тот же `queryKey` сегодня используется в нескольких файлах для
  инвалидации кэша между страницами (список выше) — при переносе сведи
  их к одному месту, не расходись в написании.
- Не трогай поведение молча: если по пути видишь баг (в прошлой сессии
  так нашлись сломанная печать квитанции из-за Date-объекта вместо
  строки, неверная сортировка точек приёма/выдачи, время там, где нужна
  только дата) — чини и закрывай регрессионным тестом, но не смешивай
  архитектурный рефакторинг с новыми фичами без явного запроса.
- После каждого мигрированного ресурса: `pnpm lint`,
  `pnpm --recursive test`, и живая проверка в браузере через Playwright
  (`@playwright/test` уже в devDependencies; импортировать как
  `import { chromium } from '@playwright/test'` — голый пакет `playwright`
  не резолвится из временных скриптов вне `node_modules` окружения.
  Запускай временный `.mjs`-скрипт из корня репозитория, не из scratch-
  директории, иначе не найдёт `node_modules`, и удаляй его после
  проверки). Коммить и пушить после каждого законченного ресурса
  отдельным коммитом — не копить всё в один гигантский коммит.
- Пользователь не любит, когда его переспрашивают на локальные
  обратимые действия (команды, правки файлов, рестарт dev-сервера) —
  просто делай и отчитывайся результатом. Уточняющий вопрос — только
  когда решение реально неоднозначно и его нельзя вывести из кода или
  контекста.
- Не забывай коммитить и пушить по ходу работы, а не одним разом в
  конце — это уже случалось в этой сессии и вызвало нарекание.

## Как проверять руками

Демо-данные (заказы, клиенты, номенклатура, прайс-листы) уже засеяны.
Для скриншотов в headless-браузере: временный `.mjs` в scratch-
директории сессии, `page.screenshot({ path })`, затем `Read`-инструментом
посмотреть глазами — не полагайся только на отсутствие консольных ошибок.

## Когда закончишь

Удали этот файл (`HANDOFF.md`) из репозитория тем же коммитом, где
завершаешь миграцию последнего ресурса — он одноразовый, не часть
постоянной документации проекта.
