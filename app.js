// Главный скрипт каталога Instagram-магазинов г. Грозный
document.addEventListener("DOMContentLoaded", () => {
  // Яндекс Метрика: отправляем только события интерфейса, без Telegram ID,
  // телефонов, текста поиска и других персональных/введённых пользователем данных.
  const METRIKA_ID = 114414261;
  function trackGoal(goal, params = {}) {
    if (typeof window.ym === "function") {
      window.ym(METRIKA_ID, "reachGoal", goal, params);
    }
  }

  // Инициализация Telegram WebApp SDK
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    // Применение цветов темы Telegram если доступны
    if (tg.setHeaderColor) {
      tg.setHeaderColor("#f8fafc");
    }
  }

  // Источник данных: window.INSTASHOP_DATA или shops.json
  const shops = window.INSTASHOP_DATA || [];
  const categories = window.CATEGORIES_DATA || [];
  const districts = window.DISTRICTS_DATA || [];
  const promos = window.PROMOS_DATA || [];

  // Состояние фильтров
  let state = {
    searchQuery: "",
    selectedCategory: "all",
    selectedDistrict: "Все районы"
  };

  // DOM Элементы
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const categoriesContainer = document.getElementById("categoriesContainer");
  const districtSelect = document.getElementById("districtSelect");
  const shopsContainer = document.getElementById("shopsContainer");
  const promoContainer = document.getElementById("promoContainer");
  const emptyState = document.getElementById("emptyState");
  const statsCount = document.getElementById("statsCount");

  // Модальное окно деталей магазина
  const shopModal = document.getElementById("shopModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalAvatar = document.getElementById("modalAvatar");
  const modalName = document.getElementById("modalName");
  const modalCategory = document.getElementById("modalCategory");
  const modalDescription = document.getElementById("modalDescription");
  const modalAddress = document.getElementById("modalAddress");
  const modalTags = document.getElementById("modalTags");
  const modalBtnInstagram = document.getElementById("modalBtnInstagram");
  const modalBtnWhatsapp = document.getElementById("modalBtnWhatsapp");
  const modalBtnGis = document.getElementById("modalBtnGis");

  // Модальное окно добавления магазина (Монетизация №4)
  const addShopOpenBtn = document.getElementById("addShopOpenBtn");
  const addShopModal = document.getElementById("addShopModal");
  const addShopCloseBtn = document.getElementById("addShopCloseBtn");
  const addShopForm = document.getElementById("addShopForm");

  // Вспомогательная тактильная отдача для Telegram
  function triggerHaptic(type = "light") {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(type);
    }
  }

  // 1. Рендер категорий
  function renderCategories() {
    categoriesContainer.innerHTML = categories
      .map(
        (cat) => `
        <button class="cat-chip ${cat.id === state.selectedCategory ? "active" : ""}" data-category="${cat.id}">
          <span class="cat-icon">${cat.icon}</span>
          <span class="cat-title">${cat.name}</span>
        </button>
      `
      )
      .join("");

    categoriesContainer.querySelectorAll(".cat-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const catId = btn.dataset.category;
        state.selectedCategory = catId;
        trackGoal("category_filter", { category: catId });
        triggerHaptic("light");
        renderCategories();
        applyFilters();
      });
    });

    // Автоматическое заполнение выпадающего списка категорий в форме заявки
    const formCategory = document.getElementById("formCategory");
    if (formCategory) {
      formCategory.innerHTML = categories
        .filter((cat) => cat.id !== "all")
        .map((cat) => `<option value="${cat.name}">${cat.name}</option>`)
        .join("") + `<option value="Другое">Другое</option>`;
    }
  }

  // 2. Рендер районов
  function renderDistricts() {
    districtSelect.innerHTML = districts
      .map((dist) => `<option value="${dist}">${dist}</option>`)
      .join("");

    districtSelect.addEventListener("change", (e) => {
      state.selectedDistrict = e.target.value;
      trackGoal("district_filter", { district: state.selectedDistrict });
      triggerHaptic("light");
      applyFilters();
    });
  }

  // Автоматическое определение аватарки по логину Instagram
  function getShopAvatar(shop) {
    const ig = (shop.instagram || "").replace(/^@/, "").trim().toLowerCase();
    if (ig) {
      // Автоматический путь по имени инстаграма
      return `avatars/${ig}.jpg`;
    }
    return shop.avatar || "";
  }

  // Генерация фирменной аватарки в стиле Instagram
  function getFallbackAvatar(shop) {
    const name = typeof shop === "string" ? shop : (shop?.name || "M");
    const initial = name.trim().charAt(0).toUpperCase() || "M";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f09433"/>
          <stop offset="25%" stop-color="#e6683c"/>
          <stop offset="50%" stop-color="#dc2743"/>
          <stop offset="75%" stop-color="#cc2366"/>
          <stop offset="100%" stop-color="#bc1888"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#igGrad)"/>
      <text x="50" y="58" font-size="42" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  // 3. Рендер карточек магазинов
  function renderShops(filteredShops) {
    statsCount.textContent = `Найдено: ${filteredShops.length}`;

    if (filteredShops.length === 0) {
      shopsContainer.innerHTML = "";
      emptyState.classList.add("active");
      return;
    }

    emptyState.classList.remove("active");

    shopsContainer.innerHTML = filteredShops
      .map((shop) => {
        const tagsHtml = (shop.tags || [])
          .slice(0, 4)
          .map((t) => `<span class="tag-badge">#${t}</span>`)
          .join("");

        const isVipClass = shop.isVip ? "is-vip" : "";
        const vipBadgeHtml = shop.isVip
          ? `<span class="vip-badge">${shop.vipBadge || "🔥 ТОП"}</span>`
          : "";

        const discountHtml = (shop.discountText && shop.promoCode)
          ? `<div class="discount-badge">🎁 ${shop.discountText} (промокод: <b>${shop.promoCode}</b>)</div>`
          : "";

        const waText = shop.promoCode
          ? `Здравствуйте! Пишу вам из Каталога Грозного по промокоду "${shop.promoCode}". Хочу оформить заказ.`
          : "Здравствуйте! Нашел ваш магазин в каталоге Грозного.";

        const waLink = shop.whatsapp
          ? `https://wa.me/${shop.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`
          : "#";
        const igLink = shop.instagram
          ? `https://instagram.com/${shop.instagram.replace(/^@/, "")}`
          : "#";

        const avatarUrl = getShopAvatar(shop);

        return `
        <article class="shop-card ${isVipClass}" data-shop-id="${shop.id}">
          <div class="shop-card-header">
            <img class="shop-avatar" src="${avatarUrl}" alt="${shop.name}" loading="lazy" />
            <div class="shop-header-info">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 2px;">
                <span class="category-tag">${shop.categoryName}</span>
                ${vipBadgeHtml}
              </div>
              <div class="shop-title-row">
                <h3 class="shop-name">${shop.name}</h3>
              </div>
              <div class="shop-district">📍 ${shop.district}</div>
            </div>
          </div>

          ${discountHtml}

          <p class="shop-description">${shop.description}</p>

          <div class="shop-tags-row">
            ${tagsHtml}
          </div>

          <div class="shop-actions-row">
            <a href="${igLink}" target="_blank" rel="noopener noreferrer" class="btn btn-instagram" onclick="event.stopPropagation();">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              Instagram
            </a>
            <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp" onclick="event.stopPropagation();">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              WhatsApp
            </a>
            <button class="btn btn-more" data-more-id="${shop.id}">
              Инфо
            </button>
          </div>
        </article>
      `;
      })
      .join("");

    // Цели: переходы в Instagram и WhatsApp из карточек магазинов.
    shopsContainer.querySelectorAll(".shop-card").forEach((card) => {
      const shopId = Number(card.dataset.shopId);
      const shop = shops.find((item) => item.id === shopId);
      card.querySelector(".btn-instagram")?.addEventListener("click", () => {
        trackGoal("instagram_click", { shop_id: String(shopId), shop_name: shop?.name || "" });
      });
      card.querySelector(".btn-whatsapp")?.addEventListener("click", () => {
        trackGoal("whatsapp_click", { shop_id: String(shopId), shop_name: shop?.name || "" });
      });
    });

    // Обработка загрузки аватаров (каскад: avatars/{ig}.jpg -> shop.avatar -> фирменный Instagram-аватар)
    shopsContainer.querySelectorAll(".shop-avatar").forEach((img) => {
      img.addEventListener("error", () => {
        const card = img.closest(".shop-card");
        const id = Number(card?.dataset.shopId);
        const shop = shops.find((s) => s.id === id);
        if (shop?.avatar && img.src !== shop.avatar && !img.dataset.triedOriginal) {
          img.dataset.triedOriginal = "true";
          img.src = shop.avatar;
          return;
        }
        img.src = getFallbackAvatar(shop || "");
      });
    });

    // Клик по карточке открывает детали
    shopsContainer.querySelectorAll(".shop-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = Number(card.dataset.shopId);
        const shop = shops.find((s) => s.id === id);
        if (shop) openShopModal(shop);
      });
    });

    shopsContainer.querySelectorAll(".btn-more").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.moreId);
        const shop = shops.find((s) => s.id === id);
        if (shop) openShopModal(shop);
      });
    });
  }

  // 4. Фильтрация и поиск
  function applyFilters() {
    const q = state.searchQuery.toLowerCase().trim();

    const filtered = shops.filter((shop) => {
      // Фильтр по категории
      if (state.selectedCategory !== "all" && shop.category !== state.selectedCategory) {
        return false;
      }

      // Фильтр по району
      if (
        state.selectedDistrict !== "Все районы" &&
        !shop.district.includes(state.selectedDistrict)
      ) {
        return false;
      }

      // Поиск по названию, описанию и тегам
      if (q) {
        const inName = shop.name.toLowerCase().includes(q);
        const inDesc = shop.description.toLowerCase().includes(q);
        const inTags = (shop.tags || []).some((t) => t.toLowerCase().includes(q));
        const inDistrict = (shop.district || "").toLowerCase().includes(q);
        const inAddress = (shop.address || "").toLowerCase().includes(q);
        return inName || inDesc || inTags || inDistrict || inAddress;
      }

      return true;
    });

    // Сортировка: VIP магазины всегда идут в самом верху (Монетизация №1)
    filtered.sort((a, b) => {
      if (a.isVip && !b.isVip) return -1;
      if (!a.isVip && b.isVip) return 1;
      return 0;
    });

    renderShops(filtered);
  }

  // 5. Обработка поиска
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    if (state.searchQuery) {
      clearSearchBtn.classList.add("active");
    } else {
      clearSearchBtn.classList.remove("active");
    }
    applyFilters();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      trackGoal("search_used");
    }
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    clearSearchBtn.classList.remove("active");
    searchInput.focus();
    applyFilters();
  });

  // 6. Модальное окно деталей магазина
  function openShopModal(shop) {
    trackGoal("shop_open", {
      shop_id: String(shop.id),
      shop_name: shop.name || "",
      category: shop.categoryName || ""
    });
    triggerHaptic("medium");
    const avatarUrl = getShopAvatar(shop);

    modalAvatar.src = avatarUrl;
    modalAvatar.dataset.triedOriginal = "";
    modalAvatar.onerror = () => {
      if (shop.avatar && modalAvatar.src !== shop.avatar && !modalAvatar.dataset.triedOriginal) {
        modalAvatar.dataset.triedOriginal = "true";
        modalAvatar.src = shop.avatar;
      } else {
        modalAvatar.src = getFallbackAvatar(shop);
      }
    };
    modalName.textContent = shop.name;
    modalCategory.textContent = shop.categoryName;
    modalDescription.textContent = shop.description;
    modalAddress.textContent = shop.address || shop.district;

    modalTags.innerHTML = (shop.tags || [])
      .map((t) => `<span class="tag-badge">#${t}</span>`)
      .join("");

    const igClean = shop.instagram.replace(/^@/, "");
    modalBtnInstagram.href = `https://instagram.com/${igClean}`;
    modalBtnInstagram.dataset.shopId = String(shop.id);
    modalBtnInstagram.dataset.shopName = shop.name || "";
    modalBtnInstagram.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
      Открыть @${igClean} в Instagram
    `;

    const waNum = (shop.whatsapp || "").replace(/\D/g, "");
    const waModalText = shop.promoCode
      ? `Здравствуйте! Пишу вам из Каталога Грозного по промокоду "${shop.promoCode}". Хочу оформить заказ.`
      : "Здравствуйте! Нашел ваш магазин в каталоге Грозного.";
    modalBtnWhatsapp.href = `https://wa.me/${waNum}?text=${encodeURIComponent(waModalText)}`;
    modalBtnWhatsapp.dataset.shopId = String(shop.id);
    modalBtnWhatsapp.dataset.shopName = shop.name || "";

    const gisSearchQuery = encodeURIComponent(`${shop.name} Грозный`);
    modalBtnGis.href = shop.gisUrl || `https://2gis.ru/grozny/search/${gisSearchQuery}`;
    modalBtnGis.dataset.shopId = String(shop.id);
    modalBtnGis.dataset.shopName = shop.name || "";

    shopModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeShopModal() {
    shopModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  modalBtnInstagram.addEventListener("click", () => {
    trackGoal("instagram_click", {
      shop_id: modalBtnInstagram.dataset.shopId || "",
      shop_name: modalBtnInstagram.dataset.shopName || ""
    });
  });
  modalBtnWhatsapp.addEventListener("click", () => {
    trackGoal("whatsapp_click", {
      shop_id: modalBtnWhatsapp.dataset.shopId || "",
      shop_name: modalBtnWhatsapp.dataset.shopName || ""
    });
  });
  modalBtnGis.addEventListener("click", () => {
    trackGoal("map_click", {
      shop_id: modalBtnGis.dataset.shopId || "",
      shop_name: modalBtnGis.dataset.shopName || ""
    });
  });

  modalCloseBtn.addEventListener("click", closeShopModal);
  shopModal.addEventListener("click", (e) => {
    if (e.target === shopModal) {
      closeShopModal();
    }
  });

  // Закрытие по клавише Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shopModal.classList.contains("active")) {
      closeShopModal();
    }
  });

  // 7. Рендер рекламного промо-баннера (Монетизация №2)
  function renderPromos() {
    if (!promoContainer || promos.length === 0) return;
    const promo = promos[0];
    promoContainer.innerHTML = `
      <div class="promo-card" data-shop-id="${promo.shopId}">
        <img class="promo-card-bg" src="${promo.image}" alt="Баннер" />
        <div class="promo-card-content">
          <span class="promo-badge">${promo.badge}</span>
          <div class="promo-title">${promo.title}</div>
          <div class="promo-subtitle">${promo.subtitle}</div>
          <div><span class="promo-btn">${promo.btnText} →</span></div>
        </div>
      </div>
    `;

    promoContainer.querySelector(".promo-card").addEventListener("click", () => {
      triggerHaptic("medium");
      const shop = shops.find((s) => s.id === promo.shopId);
      if (shop) openShopModal(shop);
    });
  }

  // 8. Обработка формы подачи заявки магазина (Монетизация №4)
  function initAddShopModal() {
    if (!addShopOpenBtn || !addShopModal) return;

    function openAddModal() {
      trackGoal("add_shop_open");
      triggerHaptic("light");
      addShopModal.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeAddModal() {
      addShopModal.classList.remove("active");
      document.body.style.overflow = "";
    }

    addShopOpenBtn.addEventListener("click", openAddModal);
    addShopCloseBtn.addEventListener("click", closeAddModal);
    addShopModal.addEventListener("click", (e) => {
      if (e.target === addShopModal) closeAddModal();
    });

    addShopForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      triggerHaptic("medium");

      const name = document.getElementById("formShopName").value.trim();
      const category = document.getElementById("formCategory").value;
      const instagram = document.getElementById("formInstagram").value.trim();
      const whatsapp = document.getElementById("formWhatsapp").value.trim();
      const tariff = addShopForm.querySelector('input[name="tariff"]:checked')?.value || "Базовый";
      const orderText =
        `Заявка на добавление магазина в Каталог Грозного:\n\n` +
        `🏪 Магазин: ${name}\n` +
        `📁 Категория: ${category}\n` +
        `📷 Instagram: ${instagram}\n` +
        `📱 WhatsApp: ${whatsapp}\n` +
        `💎 Тариф: ${tariff}`;

      // В Telegram Mini App заявка отправляется на backend.
      // Backend проверяет подпись initData и пересылает заявку администратору.
      if (tg?.initData) {
        const apiBase = (window.INSTASHOP_API_URL || "").replace(/\/$/, "");
        if (!apiBase || apiBase.includes("YOUR-BACKEND")) {
          const message = "Backend ещё не настроен. Укажите адрес Render в config.js.";
          if (tg.showAlert) tg.showAlert(message); else alert(message);
          return;
        }

        const submitButton = addShopForm.querySelector('button[type="submit"]');
        const originalText = submitButton?.textContent;
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Отправляем заявку…";
        }

        try {
          const response = await fetch(`${apiBase}/api/applications`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              initData: tg.initData,
              name, category, instagram, whatsapp, tariff
            })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось отправить заявку.");

          trackGoal("application_submitted", { tariff: tariff });
          const successMessage = "Заявка отправлена! Администратор получил её и скоро свяжется с вами.";
          if (tg.showAlert) tg.showAlert(successMessage); else alert(successMessage);
          closeAddModal();
          addShopForm.reset();
        } catch (error) {
          const errorMessage = error.message || "Ошибка соединения с сервером. Попробуйте позже.";
          if (tg.showAlert) tg.showAlert(errorMessage); else alert(errorMessage);
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText || "Отправить заявку в Telegram";
          }
        }
        return;
      }

      // В обычном браузере сохраняем прежний сценарий: открываем чат администратора.
      const targetUrl = `https://t.me/Menedreal?text=${encodeURIComponent(orderText)}`;
      if (navigator.clipboard) navigator.clipboard.writeText(orderText).catch(() => {});
      window.open(targetUrl, "_blank");
      closeAddModal();
      addShopForm.reset();
    });
  }

  // Начальный запуск
  renderCategories();
  renderDistricts();
  renderPromos();
  initAddShopModal();
  applyFilters();
});
