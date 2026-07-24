# Предварительный REST API

Официальный контракт будет храниться в OpenAPI 3. Все маршруты имеют префикс
`/api/v1`, используют единый envelope и возвращают `correlationId`.

## Ресурсы MVP

| Method    | URL                              | Назначение                    | Permission                    |
| --------- | -------------------------------- | ----------------------------- | ----------------------------- |
| POST      | `/auth/login`                    | открыть сессию                | public                        |
| POST      | `/auth/refresh`                  | ротировать refresh token      | session                       |
| POST      | `/auth/logout`                   | закрыть сессию                | session                       |
| GET       | `/auth/me`                       | текущий пользователь и права  | authenticated                 |
| GET/POST  | `/clients`                       | поиск и создание клиента      | `clients.*`                   |
| GET/PATCH | `/clients/{id}`                  | карточка и изменение          | `clients.*`                   |
| GET       | `/clients/{id}/orders`           | история заказов клиента       | `clients.view`, `orders.view` |
| GET       | `/catalog/*`                     | справочники                   | `catalog.view`                |
| GET       | `/services`                      | доступные услуги              | `catalog.view`                |
| GET/POST  | `/price-lists`                   | прайс-листы                   | `price_lists.manage`          |
| GET/POST  | `/orders`                        | список и черновик             | `orders.*`                    |
| GET/PATCH | `/orders/{id}`                   | заказ/изменение черновика     | `orders.*`                    |
| POST      | `/orders/{id}/accept`            | оформить и зафиксировать цены | `orders.create`               |
| POST      | `/orders/{id}/cancel`            | контролируемая отмена         | `orders.cancel`               |
| POST      | `/orders/{id}/items`             | добавить изделие              | `orders.update`               |
| POST      | `/order-items/{id}/services`     | назначить услуги              | `orders.update`               |
| POST      | `/order-items/{id}/transition`   | производственный переход      | `production.transition`       |
| POST      | `/orders/{id}/payments`          | принять оплату                | `payments.create`             |
| POST      | `/payments/{id}/refunds`         | оформить возврат              | `payments.refund`             |
| POST      | `/orders/{id}/issues`            | частично/полностью выдать     | `orders.issue`                |
| GET       | `/orders/{id}/receipt`           | HTML-квитанция                | `orders.view`                 |
| GET       | `/orders/{id}/labels`            | комплект бирок 55×55 мм       | `orders.view`                 |
| GET       | `/order-items/{id}/labels`       | QR/Code 128 этикетка          | `orders.view`                 |
| PATCH     | `/order-items/{id}/measurements` | внести фактический замер      | `orders.update`               |
| POST      | `/files`                         | загрузить фотографию          | `files.upload`                |
| GET       | `/files/{id}`                    | получить защищённый файл      | `files.view`                  |
| GET       | `/reports/operational`           | операционный отчёт            | `reports.operational`         |
| GET       | `/reports/financial`             | финансовый отчёт              | `reports.financial`           |
| GET       | `/audit`                         | журнал действий               | `audit.view`                  |

## Идемпотентность

`Idempotency-Key` обязателен для:

- оплаты;
- возврата;
- частичной или полной выдачи;
- оформления заказа.

Ключ scoped по организации, пользователю и операции. Повтор с тем же ключом и
другим payload возвращает `409 IDEMPOTENCY_PAYLOAD_MISMATCH`.

## Выдача

```http
POST /api/v1/orders/{orderId}/issues
Idempotency-Key: 4c7...
Content-Type: application/json
```

```json
{
  "itemIds": ["uuid-1", "uuid-2"],
  "paymentOverrideReason": null
}
```

Успешный ответ:

```json
{
  "data": {
    "issueId": "uuid",
    "issuedItemIds": ["uuid-1", "uuid-2"],
    "orderStatus": "partially_issued"
  },
  "meta": { "correlationId": "uuid" },
  "error": null
}
```

Основные ошибки: `ORDER_NOT_FOUND`, `ITEM_NOT_READY`,
`ITEM_ALREADY_ISSUED`, `PAYMENT_REQUIRED`, `BRANCH_ACCESS_DENIED`,
`CONCURRENT_MODIFICATION`, `IDEMPOTENCY_PAYLOAD_MISMATCH`.

## Пагинация и ошибки

Коллекции используют `page`, `pageSize`, сортировку и whitelisted-фильтры.
Поддерживаются статусы `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`.
Stack trace в production не возвращается.
