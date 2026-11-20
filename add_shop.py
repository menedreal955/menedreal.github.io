import sys
import os
import re
import json
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHOPS_JSON = os.path.join(BASE_DIR, "data", "shops.json")
SHOPS_JS = os.path.join(BASE_DIR, "data", "shops.js")
CATEGORIES_JS = os.path.join(BASE_DIR, "data", "categories.js")
AVATARS_DIR = os.path.join(BASE_DIR, "avatars")

os.makedirs(AVATARS_DIR, exist_ok=True)

CATEGORY_KEYWORDS = {
    "food": ["еда", "мясо", "шашлык", "кухня", "бургер", "кафе", "ресторан", "пицца", "выпечка", "продукты", "гриль"],
    "clothes": ["одежда", "платья", "костюм", "обувь", "куртки", "мода", "бутик", "шопинг", "джинсы"],
    "perfume": ["парфюм", "духи", "аромат", "селектив", "стойкие"],
    "electronics": ["электроника", "компьютер", "пк", "телефон", "смартфон", "айфон", "iphone", "apple", "ноутбук", "гаджет"],
    "auto": ["авто", "запчасти", "разбор", "шины", "масла", "детейлинг", "ремонт авто", "гбо", "машина"],
    "jewelry": ["бижутерия", "украшения", "серебро", "золото", "кольца", "серьги", "браслет"],
    "gifts": ["цветы", "букет", "розы", "подарки", "боксы", "шары"],
    "home": ["дом", "жалюзи", "шторы", "мебель", "уют", "посуда", "отопление", "текстиль"],
    "realty": ["недвижимость", "участок", "квартира", "дом", "земля", "аренда", "продажа"],
    "tourism": ["тур", "отдых", "горы", "отель", "база отдыха", "экскурсии", "курорт"],
    "build": ["стройка", "бетон", "ремонт", "стройматериалы", "фундамент", "кирпич", "цемент"],
    "health": ["аптека", "здоровье", "лекарства", "масла", "травы", "витамины"]
}

CATEGORY_NAMES = {
    "food": "Еда и продукты",
    "clothes": "Одежда",
    "perfume": "Парфюмерия",
    "electronics": "Электроника",
    "auto": "Автоуслуги",
    "jewelry": "Бижутерия",
    "gifts": "Цветы & Подарки",
    "home": "Для дома",
    "realty": "Недвижимость",
    "tourism": "Отдых & Туризм",
    "build": "Стройка & Ремонт",
    "health": "Здоровье",
    "malls": "ТЦ & Гипер"
}

def clean_username(input_str):
    input_str = input_str.strip()
    match = re.search(r"instagram\.com/([^/?#&]+)", input_str)
    if match:
        return match.group(1).lower().strip()
    return input_str.replace("@", "").strip().lower()

def guess_category(text):
    text_lower = text.lower()
    for cat_id, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return cat_id, CATEGORY_NAMES.get(cat_id, "Разное")
    return "other", "Разное"

def fetch_instagram_meta(username):
    url = f"https://www.instagram.com/{username}/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    
    meta = {
        "name": username.replace("_", " ").title(),
        "description": "",
        "avatar_url": ""
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=7) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            
            # Извлекаем title
            t_match = re.search(r"<title>(.*?)</title>", html)
            if t_match:
                title = t_match.group(1).strip()
                title = re.sub(r"\s*\(@.*?\).*$", "", title)
                title = re.sub(r"\s*•.*$", "", title)
                title = title.replace("Instagram", "").strip()
                if title:
                    meta["name"] = title
            
            # Извлекаем description
            d_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html)
            if not d_match:
                d_match = re.search(r'<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']', html)
            if d_match:
                desc = d_match.group(1).strip()
                # Удаляем "X Followers, Y Following, Z Posts..."
                desc = re.sub(r"^.*?See Instagram photos and videos from.*?:?\s*", "", desc, flags=re.IGNORECASE)
                meta["description"] = desc.strip()
            
            # Извлекаем og:image для аватарки
            img_match = re.search(r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
            if not img_match:
                img_match = re.search(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html)
            if img_match:
                meta["avatar_url"] = img_match.group(1).replace("&amp;", "&")
    except Exception as e:
        print(f"  [Инфо] Инстаграм ограничил автоматический парсинг HTML: {e}")
        
    return meta

def save_avatar(username, img_url):
    if not img_url:
        return
    avatar_path = os.path.join(AVATARS_DIR, f"{username}.jpg")
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        req = urllib.request.Request(img_url, headers=headers)
        with urllib.request.urlopen(req, timeout=7) as resp:
            with open(avatar_path, "wb") as f:
                f.write(resp.read())
        print(f"  ✓ Аватарка сохранена в avatars/{username}.jpg")
    except Exception:
        pass

def add_shop(url_or_username, custom_category=None, custom_name=None, custom_desc=None):
    username = clean_username(url_or_username)
    if not username:
        print("Ошибка: не удалось распознать юзернейм.")
        return

    # Загружаем существующие магазины
    shops = []
    if os.path.exists(SHOPS_JSON):
        with open(SHOPS_JSON, "r", encoding="utf-8") as f:
            try:
                shops = json.load(f)
            except Exception:
                shops = []

    # Проверяем на дубликаты
    for s in shops:
        if s.get("instagram", "").lower() == username:
            print(f"Магазин @{username} уже есть в каталоге (ID: {s['id']})!")
            return

    print(f"\nПолучение данных для @{username}...")
    meta = fetch_instagram_meta(username)
    
    name = custom_name or meta["name"] or username
    desc = custom_desc or meta["description"] or f"Магазин {name} в Instagram."
    
    if meta.get("avatar_url"):
        save_avatar(username, meta["avatar_url"])

    cat_id, cat_name = guess_category(f"{name} {desc} {custom_category or ''}")
    if custom_category:
        for cid, cname in CATEGORY_NAMES.items():
            if custom_category.lower() in cname.lower() or custom_category.lower() == cid:
                cat_id, cat_name = cid, cname
                break

    new_id = max([s.get("id", 0) for s in shops], default=0) + 1
    
    new_shop = {
        "id": new_id,
        "name": name,
        "category": cat_id,
        "categoryName": cat_name,
        "isVip": False,
        "promoCode": "",
        "discountText": "",
        "avatar": "",
        "description": desc,
        "district": "Ахматовский район",
        "address": "г. Грозный",
        "instagram": username,
        "whatsapp": "",
        "telegram": "",
        "gisUrl": "https://2gis.ru/grozny",
        "tags": [cat_name.lower(), username, "грозный"]
    }

    shops.append(new_shop)

    # Сохраняем в shops.json
    with open(SHOPS_JSON, "w", encoding="utf-8") as f:
        json.dump(shops, f, ensure_ascii=False, indent=2)

    # Синхронизируем shops.js
    js_content = "// База магазинов г. Грозный\nwindow.INSTASHOP_DATA = " + json.dumps(shops, ensure_ascii=False, indent=2) + ";\n"
    with open(SHOPS_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"✓ Успешно добавлен: {name} (Категория: {cat_name})")
    print(f"Всего магазинов в каталоге: {len(shops)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
        category_hint = sys.argv[2] if len(sys.argv) > 2 else None
        add_shop(raw_input, custom_category=category_hint)
    else:
        print("Использование: python add_shop.py <ссылка_на_инстаграм_или_юзернейм> [категория]")
        user_url = input("Вставьте ссылку на профиль Instagram: ").strip()
        if user_url:
            cat_hint = input("Категория (нажмите Enter для автоопределения): ").strip()
            add_shop(user_url, custom_category=cat_hint if cat_hint else None)
