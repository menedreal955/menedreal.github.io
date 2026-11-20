#!/usr/bin/env python3
"""
Скрипт автоматической загрузки аватарок Instagram для каталога магазинов.
Читает shops.js, находит логины Instagram и сохраняет аватарки в папку avatars/
"""

import os
import re
import json
import urllib.request
import urllib.error

AVATARS_DIR = os.path.join(os.path.dirname(__file__), "avatars")
SHOPS_FILE = os.path.join(os.path.dirname(__file__), "data", "shops.js")

os.makedirs(AVATARS_DIR, exist_ok=True)

def extract_shops():
    if not os.path.exists(SHOPS_FILE):
        print(f"Файл {SHOPS_FILE} не найден.")
        return []
    
    with open(SHOPS_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Извлечение JSON массива
    match = re.search(r"window\.INSTASHOP_DATA\s*=\s*(\[.*?\]);", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return []

def download_avatar(username):
    target_path = os.path.join(AVATARS_DIR, f"{username}.jpg")
    if os.path.exists(target_path):
        print(f"✓ Уже загружен: {username}")
        return True

    print(f"→ Загрузка аватарки для @{username}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
    }

    # Попытка через публичную страницу профиля
    profile_url = f"https://www.instagram.com/{username}/"
    req = urllib.request.Request(profile_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            # Поиск og:image
            match = re.search(r'property="og:image"\s+content="([^"]+)"', html)
            if not match:
                match = re.search(r'content="([^"]+)"\s+property="og:image"', html)
            
            if match:
                img_url = match.group(1).replace("&amp;", "&")
                img_req = urllib.request.Request(img_url, headers={"User-Agent": headers["User-Agent"]})
                with urllib.request.urlopen(img_req, timeout=10) as img_resp:
                    with open(target_path, "wb") as out:
                        out.write(img_resp.read())
                print(f"✓ Успешно сохранено: avatars/{username}.jpg")
                return True
    except Exception as e:
        print(f"✗ Не удалось автоматически загрузить @{username}: {e}")

    return False

def main():
    shops = extract_shops()
    if not shops:
        print("Магазины не найдены.")
        return

    print(f"Найдено магазинов: {len(shops)}\n")
    for shop in shops:
        ig = shop.get("instagram", "").strip().lstrip("@")
        if ig:
            download_avatar(ig)
    
    print("\nГотово! Все найденные аватарки сохранены в папке /avatars")

if __name__ == "__main__":
    main()
