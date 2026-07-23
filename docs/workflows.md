# Жизненные циклы

## Заказ

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> accepted: оформить
    draft --> cancelled: отменить
    accepted --> awaiting_payment: нужна предоплата
    accepted --> in_production: оплата достаточна
    awaiting_payment --> in_production: принять оплату
    in_production --> partially_ready: часть готова
    in_production --> ready: все активные готовы
    partially_ready --> ready: все активные готовы
    in_production --> problem: проблема
    problem --> in_production: разрешить проблему
    ready --> partially_issued: выдать часть
    partially_ready --> partially_issued: выдать готовую часть
    partially_issued --> partially_issued: выдать ещё часть
    partially_issued --> issued: выданы все
    ready --> issued: выдать все
    issued --> returned: зарегистрировать возврат
    accepted --> cancelled: отменить
    awaiting_payment --> cancelled: финансовая корректировка
    in_production --> cancelled: привилегированная отмена
```

Статусы `partially_ready`, `ready`, `partially_issued` и `issued` рассчитываются
из активных изделий и записей выдачи. Прямое обновление поля статуса запрещено.

## Изделие

```mermaid
stateDiagram-v2
    [*] --> accepted
    accepted --> inspection
    inspection --> sorting
    sorting --> cleaning
    sorting --> washing
    sorting --> repair
    cleaning --> drying
    washing --> drying
    drying --> ironing
    repair --> quality_control
    ironing --> quality_control
    cleaning --> quality_control
    quality_control --> rework: не принято
    rework --> cleaning
    rework --> washing
    rework --> repair
    quality_control --> packing: принято
    packing --> ready
    ready --> issued: частичная или полная выдача
    inspection --> rejected
    sorting --> rejected
```

Диаграмма показывает стандартный seed-маршрут. Реально разрешённые переходы
задаются `ProductionRouteStage`, но системные терминальные инварианты остаются
в коде.

## Контракт перехода

Каждый переход через `orderStatusService.transition` или
`itemWorkflowService.transition` определяет:

- исходный и целевой статус;
- permission;
- допустимый маршрут;
- предусловия и блокирующие ограничения;
- побочные действия;
- outbox-событие;
- запись истории и аудита;
- стабильные коды ошибок.

## Правила частичной выдачи

1. Выбираются изделия одного заказа со статусом `ready`.
2. Проверяются организация, филиал пользователя и `orders.issue`.
3. Проверяется достаточность оплаты; долг требует отдельного
   `orders.issue_with_debt`.
4. Заказ и изделия блокируются в транзакции.
5. Проверяется отсутствие предыдущей выдачи каждого изделия.
6. Создаются `OrderIssue` и `OrderIssueItem`.
7. Изделия становятся `issued`.
8. Агрегат заказа становится `partially_issued` или `issued`.
9. Создаются аудит и outbox-событие.
10. Повтор с тем же ключом идемпотентности возвращает первый результат.
