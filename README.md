# Telegram Mini App: Каталог Instagram-магазинов г. Грозный

Готовое легковесное веб-приложение для Telegram, в котором собраны популярные Instagram-магазины и сервисы города Грозный с фильтрацией по категориям, районам и мгновенным переходом в Instagram, WhatsApp и 2GIS.

---

## 🚀 Быстрый запуск и проверка на компьютере

1. Перейдите в папку проекта: `H:\Antigravity Projects\instashop\`
2. Просто дважды кликните по файлу **`index.html`** — приложение сразу откроется в вашем браузере.
3. В браузере можно нажать клавишу **F12** и включить режим смартфона (Ctrl+Shift+M), чтобы увидеть интерфейс в точности как на телефоне внутри Telegram.

---

## 📱 Как подключить к Telegram (в 3 шага бесплатно)

1. **Размещение в интернете**:
   - Загрузите файлы папки `instashop` на любой бесплатный хостинг статических сайтов:
     - [Vercel](https://vercel.com) (загрузка папки перетаскиванием в 1 клик)
     - [GitHub Pages](https://pages.github.com)
     - [Cloudflare Pages](https://pages.cloudflare.com)
   - Получите вашу ссылку (например: `https://grozny-shops.vercel.app`).

2. **Создание бота в Telegram**:
   - Напишите официальному боту [@BotFather](https://t.me/BotFather) команду `/newbot`.
   - Введите имя и юзернейм для вашего бота.

3. **Привязка Mini App**:
   - В [@BotFather](https://t.me/BotFather) отправьте команду `/newapp`.
   - Выберите созданного бота.
   - Введите название и описание приложения.
   - Загрузите иконку (640x360 px или квадратную).
   - Вставьте полученную ссылку на сайт (`https://...`).
   - Готово! В боте появится кнопка «Открыть меню / каталог».

---

## ✏️ Как добавить или изменить магазин

Все магазины изолированы в одном файле:
- [data/shops.js](file:///H:/Antigravity%20Projects/instashop/data/shops.js) (для работы офлайн)
- [data/shops.json](file:///H:/Antigravity%20Projects/instashop/data/shops.json) (чистый формат данных)

Чтобы добавить магазин, скопируйте и вставьте новый блок:
```javascript
{
  id: 8,
  name: "Название магазина",
  category: "perfume", // perfume | food | auto | malls | home
  categoryName: "Парфюмерия",
  avatar: "ссылка на фото/логотип",
  description: "Краткое описание того, что продается",
  district: "Ахматовский район",
  address: "г. Грозный, адрес",
  instagram: "username_в_инсте",
  whatsapp: "79281234567",
  gisUrl: "https://2gis.ru/grozny",
  tags: ["духи", "подарки"]
}
```

---

## 📁 Структура и дизайн для доработок
- [structure.md](file:///H:/Antigravity%20Projects/instashop/structure.md) — карта проекта для точечных правок без траты лишних токенов.
- [design.md](file:///H:/Antigravity%20Projects/instashop/design.md) — светлая дизайн-система, цвета и компоненты.
