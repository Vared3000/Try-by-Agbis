# Security review

## Реализованные контроли

- Argon2id для паролей;
- короткоживущий JWT с issuer и audience;
- opaque refresh token, хранение только SHA-256 хеша;
- ротация, reuse detection и отзыв семьи;
- HttpOnly, SameSite и Secure cookie в production;
- backend RBAC для каждого действия;
- tenant context только из проверенной сессии;
- branch scope и негативные PostgreSQL-тесты;
- транзакции, row locks, optimistic version и advisory idempotency locks;
- отсутствие PII в QR/Code 128;
- magic-byte проверка фотографий, лимиты и `nosniff`;
- защищённая выдача файлов;
- финансовый аудит и transactional outbox;
- stack trace не возвращается клиенту;
- секреты и auth-заголовки редактируются в логах.

## Остаточные риски

- production должен работать только через HTTPS;
- rate limiting и внешний WAF настраиваются на reverse proxy;
- backup encryption и secret storage зависят от среды развёртывания;
- антивирусная проверка файлов рекомендуется перед публичной эксплуатацией;
- CSP должна быть зафиксирована после утверждения production-доменов;
- отдельный platform-superadmin flow пока не реализован.

## Перед production

- заменить все локальные секреты;
- включить `AUTH_COOKIE_SECURE=true`;
- провести dependency и container image scan;
- выполнить restore drill;
- проверить права production-ролей на копии обезличенных данных;
- провести ручной penetration test критичных финансовых и файловых операций.
