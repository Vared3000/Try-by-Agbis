# Отчёт по итерации 4 — авторизация и доступ

## Реализовано

- установка и смена первоначального пароля через интерактивную CLI-команду;
- Argon2id с параметрами памяти и времени;
- login с единообразной ошибкой для неверного пользователя и пароля;
- JWT access token с issuer, audience и ограниченным временем жизни;
- непрозрачный refresh token только в HttpOnly/SameSite cookie;
- хранение только SHA-256 хеша refresh token;
- ротация refresh-сессий и связь `replacedById`;
- обнаружение повторного использования отозванного refresh token с отзывом
  всей семьи;
- logout и отзыв текущей refresh-сессии;
- middleware аутентификации, разрешений и филиального scope;
- загрузка tenant context только из проверенной сессии;
- редактируемые параметры токенов и cookie проходят env validation.

## API

- `POST /api/v1/auth/login`;
- `POST /api/v1/auth/refresh`;
- `POST /api/v1/auth/logout`;
- `GET /api/v1/auth/me`.

## Проверки

- PostgreSQL integration-тест неверных учётных данных;
- проверка выдачи только назначенного филиала, организации, роли и permissions;
- ротация refresh token;
- негативный тест reuse detection и отзыва всей семьи;
- unit-тесты permission и branch middleware.

## Первоначальный пароль

```bash
pnpm --filter @cleanflow/server user:set-password owner@example.invalid
```

Пароль вводится интерактивно без отображения и не передаётся аргументом
командной строки. После смены пароля действующие refresh-сессии пользователя
отзываются.
