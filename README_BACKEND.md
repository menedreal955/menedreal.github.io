# Instagram-магазины Грозного — Telegram Mini App + Bot

Исходный frontend каталога сохранён. Добавлен отдельный backend в `backend/`.

## Быстрый запуск backend локально

Требуется Node.js 20+.

```bash
cd backend
npm install
```

Создай `backend/.env` по примеру `backend/.env.example` и заполни значения. Затем запусти:

```bash
npm start
```

Для локального теста Telegram webhook нужен публичный HTTPS URL (например, временный туннель). Для постоянного размещения используй инструкцию [DEPLOY_RENDER.md](./DEPLOY_RENDER.md).

## Важно

- Токен бота хранить только в переменных окружения backend.
- В `config.js` указывается только публичный URL backend, это не секрет.
- Frontend публикуется на Cloudflare Pages, backend — на Render.
