'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const required = ['BOT_TOKEN', 'ADMIN_ID', 'FRONTEND_URL', 'WEBHOOK_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID);
const FRONTEND_URL = process.env.FRONTEND_URL.replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PORT = Number(process.env.PORT || 10000);
const BASE_URL = (process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '').replace(/\/$/, '');
const WEBHOOK_PATH = `/telegram/webhook/${WEBHOOK_SECRET}`;

const app = express();
const bot = new Telegraf(BOT_TOKEN);
const recentApplications = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === FRONTEND_URL || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || FRONTEND_URL);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function verifyTelegramInitData(initData) {
  if (typeof initData !== 'string' || !initData) {
    throw new Error('Откройте каталог через Telegram, чтобы отправить заявку.');
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !Number.isFinite(authDate)) throw new Error('Некорректные данные Telegram.');

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) {
    throw new Error('Сессия Telegram устарела. Закройте и снова откройте приложение.');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  let suppliedHash;
  try { suppliedHash = Buffer.from(receivedHash, 'hex'); } catch { throw new Error('Некорректная подпись Telegram.'); }
  if (suppliedHash.length !== calculatedHash.length || !crypto.timingSafeEqual(suppliedHash, calculatedHash)) {
    throw new Error('Не удалось подтвердить пользователя Telegram.');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Telegram не передал данные пользователя.');
  const user = JSON.parse(userRaw);
  if (!user.id) throw new Error('Не удалось определить Telegram ID.');
  return user;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'instashop-bot-api' }));

app.post('/api/applications', async (req, res) => {
  try {
    const user = verifyTelegramInitData(req.body?.initData);
    const { name, category, instagram, whatsapp, tariff } = req.body || {};
    const clean = {
      name: String(name || '').trim().slice(0, 100),
      category: String(category || '').trim().slice(0, 80),
      instagram: String(instagram || '').trim().slice(0, 100),
      whatsapp: String(whatsapp || '').trim().slice(0, 40),
      tariff: String(tariff || '').trim().slice(0, 100)
    };

    if (!clean.name || !clean.category || !clean.instagram || !clean.whatsapp || !clean.tariff) {
      return res.status(400).json({ ok: false, error: 'Заполните все обязательные поля.' });
    }

    const last = recentApplications.get(String(user.id)) || 0;
    if (Date.now() - last < 30_000) {
      return res.status(429).json({ ok: false, error: 'Подождите 30 секунд перед следующей заявкой.' });
    }

    const requestId = crypto.randomBytes(4).toString('hex');
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const username = user.username ? `@${user.username}` : 'не указан';
    const message = [
      '🆕 <b>Новая заявка на размещение</b>',
      '',
      `<b>Магазин:</b> ${escapeHtml(clean.name)}`,
      `<b>Категория:</b> ${escapeHtml(clean.category)}`,
      `<b>Instagram:</b> ${escapeHtml(clean.instagram)}`,
      `<b>WhatsApp:</b> ${escapeHtml(clean.whatsapp)}`,
      `<b>Тариф:</b> ${escapeHtml(clean.tariff)}`,
      '',
      '<b>Заявитель:</b>',
      `${escapeHtml(fullName || 'Имя не указано')} (${escapeHtml(username)})`,
      `<b>Telegram ID:</b> <code>${user.id}</code>`,
      `<b>Номер заявки:</b> <code>${requestId}</code>`
    ].join('\n');

    await bot.telegram.sendMessage(ADMIN_ID, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Принять', callback_data: `app:approve:${user.id}:${requestId}` },
          { text: '❌ Отклонить', callback_data: `app:reject:${user.id}:${requestId}` }
        ]]
      }
    });

    recentApplications.set(String(user.id), Date.now());
    return res.json({ ok: true, message: 'Заявка отправлена администратору.' });
  } catch (error) {
    console.error('Application error:', error.message);
    const status = /Откройте каталог|Сессия Telegram|подтвердить|подпись|данные Telegram|Telegram не передал|определить Telegram/.test(error.message) ? 401 : 500;
    return res.status(status).json({ ok: false, error: status === 500 ? 'Не удалось отправить заявку. Попробуйте позже.' : error.message });
  }
});

bot.start(async (ctx) => {
  await ctx.reply(
    'Добро пожаловать в Каталог Instagram-магазинов Грозного! 🛍\n\nЗдесь вы найдёте магазины, услуги и специальные предложения города. Нажмите кнопку ниже, чтобы открыть каталог.',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🛍 Открыть каталог', FRONTEND_URL)],
      [Markup.button.url('📩 Связаться с администратором', 'https://t.me/Menedreal')]
    ])
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply('Команды бота:\n/start — открыть каталог\n/help — помощь\n/id — показать ваш Telegram ID');
});

bot.command('id', async (ctx) => {
  await ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`);
});

bot.action(/^app:(approve|reject):(\d+):([a-f0-9]+)$/, async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) {
    return ctx.answerCbQuery('У вас нет прав для обработки заявок.', { show_alert: true });
  }

  const [, action, userId, requestId] = ctx.match;
  const approved = action === 'approve';
  const statusText = approved ? '✅ Заявка принята' : '❌ Заявка отклонена';

  try {
    await bot.telegram.sendMessage(
      userId,
      approved
        ? `Ваша заявка №${requestId} принята! Администратор свяжется с вами для уточнения деталей размещения.`
        : `К сожалению, заявка №${requestId} отклонена. По вопросам обратитесь к администратору @Menedreal.`
    );
  } catch (error) {
    console.warn('Could not notify applicant:', error.message);
  }

  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.reply(`${statusText}. Номер заявки: ${requestId}`);
  } catch (error) {
    console.warn('Could not update admin message:', error.message);
  }
  return ctx.answerCbQuery(statusText);
});

bot.catch((error) => console.error('Telegram bot error:', error));

app.post(WEBHOOK_PATH, async (req, res) => {
  console.log('Telegram update received:', JSON.stringify({
    update_id: req.body?.update_id,
    message: req.body?.message?.text,
    chat_id: req.body?.message?.chat?.id
  }));

  try {
    await bot.handleUpdate(req.body);
    console.log('Telegram update processed successfully');
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Instashop backend listening on ${PORT}`);
  if (!BASE_URL) {
    console.warn('RENDER_EXTERNAL_URL/APP_URL is not set. Configure webhook manually after deployment.');
    return;
  }
  try {
    await bot.telegram.setWebhook(`${BASE_URL}${WEBHOOK_PATH}`);
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Открыть каталог' },
      { command: 'help', description: 'Помощь' },
      { command: 'id', description: 'Мой Telegram ID' }
    ]);
    console.log(`Telegram webhook configured: ${BASE_URL}${WEBHOOK_PATH}`);
  } catch (error) {
    console.error('Could not configure Telegram webhook:', error.message);
  }
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
