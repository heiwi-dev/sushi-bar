/* Витрина, корзина и оформление заказа. */
(function () {
  'use strict';

  var SHOP = window.SHOP;
  var P = window.Pricing;
  if (!SHOP || !P) return;

  /* URL обработчиков (POST JSON). Пустая строка = демо-режим: данные никуда не отправляются,
     и сайт честно сообщает об этом пользователю. */
  var ORDER_ENDPOINT = '';
  var SUBSCRIBE_ENDPOINT = '';
  var FEEDBACK_ENDPOINT = '';

  var CART_KEY = 'kabuki.cart.v1';
  var PROMO_KEY = 'kabuki.promo.v1';
  var ORDERED_KEY = 'kabuki.ordered.v1';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var money = P.formatMoney;
  var products = {};
  SHOP.products.forEach(function (p) { products[p.id] = p; });

  var state = {
    cart: loadCart(),
    promo: storageGet(PROMO_KEY) || '',
    filters: { q: '', cat: 'all', tags: [] }
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var el = {
    catalog: $('#catalog'),
    empty: $('#empty'),
    categories: $('#categories'),
    tags: $('#tags'),
    search: $('#search'),
    resultCount: $('#resultCount'),
    cartCount: $('#cartCount'),
    cartDialog: $('#cartDialog'),
    cartItems: $('#cartItems'),
    cartFoot: $('#cartFoot'),
    cartSubtotal: $('#cartSubtotal'),
    cartDiscountRow: $('#cartDiscountRow'),
    cartDiscount: $('#cartDiscount'),
    cartDelivery: $('#cartDelivery'),
    cartTotal: $('#cartTotal'),
    promoInput: $('#promoInput'),
    promoMessage: $('#promoMessage'),
    checkoutDialog: $('#checkoutDialog'),
    checkoutForm: $('#checkoutForm'),
    successDialog: $('#successDialog'),
    addressField: $('#addressField'),
    toast: $('#toast')
  };

  /* ---------- Storage ---------- */

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* игнорируем */ }
  }
  function loadCart() {
    try {
      var raw = JSON.parse(storageGet(CART_KEY) || '{}');
      var clean = {};
      Object.keys(raw).forEach(function (id) {
        var qty = Math.floor(Number(raw[id]));
        if (products[id] && qty > 0) clean[id] = Math.min(qty, 99);
      });
      return clean;
    } catch (e) {
      return {};
    }
  }
  function saveCart() { storageSet(CART_KEY, JSON.stringify(state.cart)); }
  function isFirstOrder() { return !storageGet(ORDERED_KEY); }

  function cartItems() {
    return Object.keys(state.cart).map(function (id) {
      return { id: id, price: products[id].price, qty: state.cart[id] };
    });
  }

  function cartCount() {
    return Object.keys(state.cart).reduce(function (sum, id) { return sum + state.cart[id]; }, 0);
  }

  /* ---------- Catalog ---------- */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function imageUrl(photoId, width) {
    /* Свой файл (assets/roll.jpg) или полный URL берём как есть, иначе это ID фото Unsplash. */
    if (/[./]/.test(photoId)) return photoId;
    return 'https://images.unsplash.com/' + photoId + '?auto=format&fit=crop&w=' + width + '&q=70';
  }

  function discountPercent(product) {
    if (!product.oldPrice) return 0;
    return Math.round((1 - product.price / product.oldPrice) * 100);
  }

  function tagName(id) {
    for (var i = 0; i < SHOP.tags.length; i++) if (SHOP.tags[i].id === id) return SHOP.tags[i].name;
    return '';
  }

  function plural(n, forms) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function renderFilters() {
    el.categories.innerHTML = [{ id: 'all', name: 'Все' }].concat(SHOP.categories).map(function (c) {
      return '<button class="chip' + (state.filters.cat === c.id ? ' is-active' : '') + '" type="button" data-cat="' +
        c.id + '" aria-pressed="' + (state.filters.cat === c.id) + '">' + c.name + '</button>';
    }).join('');

    el.tags.innerHTML = SHOP.tags.map(function (t) {
      var active = state.filters.tags.indexOf(t.id) !== -1;
      return '<button class="chip' + (active ? ' is-active' : '') + '" type="button" data-tag="' +
        t.id + '" aria-pressed="' + active + '">' + t.name + '</button>';
    }).join('');
  }

  function filteredProducts() {
    var q = state.filters.q.trim().toLowerCase();
    return SHOP.products.filter(function (p) {
      if (state.filters.cat !== 'all' && p.cat !== state.filters.cat) return false;
      if (state.filters.tags.length && !state.filters.tags.every(function (t) { return p.tags.indexOf(t) !== -1; })) return false;
      if (!q) return true;
      return (p.name + ' ' + p.desc).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderCatalog() {
    var list = filteredProducts();

    el.catalog.innerHTML = list.map(function (p) {
      var percent = discountPercent(p);
      var badge = '';
      if (percent) badge += '<span class="badge--discount">−' + percent + '%</span>';
      if (p.tags.length) badge += '<span>' + tagName(p.tags[0]) + '</span>';

      return '<article class="card">' +
        '<div class="card-media">' +
          '<img src="' + esc(imageUrl(p.img, 700)) + '" alt="' + esc(p.name) + '" width="700" height="525" loading="lazy" data-fallback>' +
          (badge ? '<div class="badge">' + badge + '</div>' : '') +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + esc(p.name) + '</h3>' +
          '<p class="card-desc">' + esc(p.desc) + '</p>' +
          '<p class="card-meta">' + esc(p.weight) + '</p>' +
          '<div class="card-foot">' +
            '<div class="price">' +
              (p.oldPrice ? '<span class="price-old">' + money(p.oldPrice) + '</span>' : '') +
              '<span class="price-new' + (p.oldPrice ? ' price-new--sale' : '') + '">' + money(p.price) + '</span>' +
            '</div>' +
            '<button class="add-btn" type="button" data-add="' + esc(p.id) + '" aria-label="Добавить «' + esc(p.name) + '» в корзину">В корзину</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    el.empty.hidden = list.length > 0;
    el.resultCount.textContent = list.length
      ? 'Найдено: ' + list.length + ' ' + plural(list.length, ['блюдо', 'блюда', 'блюд'])
      : '';
    attachImageFallback(el.catalog);
  }

  function attachImageFallback(root) {
    $$('img[data-fallback]', root).forEach(function (img) {
      img.addEventListener('error', function () {
        img.src = fallbackImage(img.alt);
      }, { once: true });
    });
  }

  function fallbackImage(label) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="525">' +
      '<rect width="100%" height="100%" fill="#f4f1ea"/>' +
      '<text x="50%" y="50%" font-family="Georgia,serif" font-size="30" fill="#b3a894" text-anchor="middle">' +
      String(label).replace(/[<>&]/g, '') + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function renderPromos() {
    $('#promos').innerHTML = SHOP.promos.map(function (p) {
      return '<article class="promo-card' + (p.id === 'first' ? ' promo-card--accent' : '') + '">' +
        '<h3>' + p.title + '</h3><p>' + p.text + '</p>' +
        '<p class="promo-note">' + p.note + '</p></article>';
    }).join('');
  }

  /* ---------- Cart ---------- */

  function setPromoMessage(text, kind) {
    el.promoMessage.textContent = text || '';
    el.promoMessage.className = 'promo-message' + (kind ? ' is-' + kind : '');
  }

  function cartTotals() {
    return P.totals(cartItems(), { promo: state.promo, method: 'delivery', firstOrder: isFirstOrder() });
  }

  function updateCartBadge() {
    el.cartCount.textContent = cartCount();
  }

  function renderCart() {
    var ids = Object.keys(state.cart);

    if (!ids.length) {
      el.cartItems.innerHTML = '<p class="cart-empty">Корзина пуста. Добавьте блюда из меню.</p>';
      el.cartFoot.hidden = true;
    } else {
      el.cartFoot.hidden = false;
      el.cartItems.innerHTML = ids.map(function (id) {
        var p = products[id];
        var qty = state.cart[id];
        return '<div class="cart-item">' +
          '<div class="cart-thumb"><img src="' + esc(imageUrl(p.img, 160)) + '" alt="' + esc(p.name) + '" width="160" height="160" loading="lazy" data-fallback></div>' +
          '<div>' +
            '<p class="cart-name">' + esc(p.name) + '</p>' +
            '<p class="cart-meta">' + esc(p.weight) + ' · ' + money(p.price * qty) + '</p>' +
            '<button class="cart-remove" type="button" data-remove="' + id + '">Удалить</button>' +
          '</div>' +
          '<div class="qty">' +
            '<button type="button" data-dec="' + id + '" aria-label="Уменьшить количество">−</button>' +
            '<span aria-live="polite">' + qty + '</span>' +
            '<button type="button" data-inc="' + id + '" aria-label="Увеличить количество">+</button>' +
          '</div>' +
        '</div>';
      }).join('');
      attachImageFallback(el.cartItems);
    }

    var t = cartTotals();
    el.cartSubtotal.textContent = money(t.subtotal);
    el.cartDiscountRow.hidden = !t.discount;
    el.cartDiscount.textContent = '−' + money(t.discount);
    el.cartDelivery.textContent = money(t.delivery);
    el.cartTotal.textContent = money(t.total);
    el.promoInput.value = state.promo;

    if (state.promo) {
      if (t.promo.applied) setPromoMessage(t.promo.label + ' — применена', 'ok');
      else setPromoMessage(t.promo.reason || 'Промокод не применён', 'error');
    } else if (t.promo.applied) {
      setPromoMessage('Применена скидка на первый заказ −10%', 'ok');
    } else {
      setPromoMessage('', '');
    }

    updateCartBadge();
  }

  function addToCart(id) {
    if (!products[id]) return;
    state.cart[id] = Math.min((state.cart[id] || 0) + 1, 99);
    saveCart();
    renderCart();
    toast('«' + products[id].name + '» в корзине');
  }

  function changeQty(id, delta) {
    if (!state.cart[id]) return;
    var next = state.cart[id] + delta;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = Math.min(next, 99);
    saveCart();
    renderCart();
  }

  function openDialog(dialog) {
    if (dialog && !dialog.open) dialog.showModal();
  }

  /* ---------- Checkout ---------- */

  function currentMethod() {
    var checked = $('input[name="method"]:checked');
    return checked ? checked.value : 'delivery';
  }

  function checkoutTotals() {
    return P.totals(cartItems(), {
      promo: state.promo,
      method: currentMethod(),
      firstOrder: isFirstOrder()
    });
  }

  function renderCheckoutSummary() {
    var t = checkoutTotals();
    $('#sumSubtotal').textContent = money(t.subtotal);
    $('#sumDiscountRow').hidden = !t.discount;
    $('#sumDiscount').textContent = '−' + money(t.discount);
    $('#sumDelivery').textContent = money(t.delivery);
    $('#sumTotal').textContent = money(t.total);
    $('#sumMinNote').hidden = t.canOrder;
    $('#placeOrderBtn').disabled = !t.canOrder;

    if (t.method === 'pickup') {
      $('#sumDeliveryNote').textContent = 'Самовывоз — бесплатно.';
    } else if (t.delivery === 0) {
      $('#sumDeliveryNote').textContent = 'Доставка бесплатно: заказ от 50,00 BYN после скидки.';
    } else {
      $('#sumDeliveryNote').textContent = 'Доставка 5,00 BYN. Бесплатно от 50,00 BYN после скидки.';
    }
  }

  function toggleAddress() {
    var pickup = currentMethod() === 'pickup';
    el.addressField.hidden = pickup;
    if (pickup) setError('orderAddress', 'errAddress', '');
  }

  function openCheckout() {
    var t = cartTotals();
    if (!Object.keys(state.cart).length) {
      toast('Сначала добавьте блюда в корзину');
      return;
    }
    if (!t.canOrder) {
      toast('Минимальный заказ — 20,00 BYN');
      return;
    }
    if (el.cartDialog.open) el.cartDialog.close();
    renderCheckoutSummary();
    toggleAddress();
    openDialog(el.checkoutDialog);
  }

  function setError(inputId, errorId, message) {
    var input = document.getElementById(inputId);
    var error = document.getElementById(errorId);
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      if (error) input.setAttribute('aria-describedby', errorId);
    }
    if (error) error.textContent = message || '';
  }

  function isPhone(value) {
    var digits = value.replace(/\D/g, '');
    return (digits.length === 12 && digits.indexOf('375') === 0) || digits.length === 9;
  }

  /* Маска +375 (XX) XXX-XX-XX. Работает и при наборе по символам (+375…, 375…, 80…, 29…), и при вставке.
     Разделители добавляются только перед следующей цифрой, поэтому Backspace не «застревает». */
  function formatPhone(value) {
    var s = String(value || '');
    var plus = /^\s*\+/.test(s);
    var digits = s.replace(/\D/g, '');
    var d;

    if (!digits) return plus ? '+' : '';

    if (plus) {
      /* Набирают или стирают код страны: +3, +37, +375 */
      if (digits.length < 3 && '375'.indexOf(digits) === 0) return '+' + digits;
      d = digits.indexOf('375') === 0 ? digits.slice(3) : digits;
    } else {
      /* Без «+»: 3 и 37 — начало 375, 8 — начало 80, их пока не трогаем */
      if (digits === '3' || digits === '37' || digits === '8') return digits;
      if (digits.indexOf('375') === 0) d = digits.slice(3);
      else if (digits.indexOf('80') === 0) d = digits.slice(2);
      else d = digits;
    }

    d = d.slice(0, 9);
    var out = '+375';
    if (d.length > 0) out += ' (' + d.slice(0, 2);
    if (d.length > 2) out += ') ' + d.slice(2, 5);
    if (d.length > 5) out += '-' + d.slice(5, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    return out;
  }

  function validateCheckout() {
    var invalid = null;
    var name = $('#orderName').value.trim();
    var phone = $('#orderPhone').value.trim();
    var email = $('#orderEmail').value.trim();
    var address = $('#orderAddress').value.trim();
    var consent = $('#orderConsent').checked;

    if (name.length < 2) {
      setError('orderName', 'errName', 'Укажите имя — минимум 2 символа.');
      invalid = invalid || $('#orderName');
    } else setError('orderName', 'errName', '');

    if (!isPhone(phone)) {
      setError('orderPhone', 'errPhone', 'Укажите телефон в формате +375 (XX) XXX-XX-XX.');
      invalid = invalid || $('#orderPhone');
    } else setError('orderPhone', 'errPhone', '');

    if (email && !EMAIL_RE.test(email)) {
      setError('orderEmail', 'errEmail', 'Проверьте e-mail: похоже, есть опечатка.');
      invalid = invalid || $('#orderEmail');
    } else setError('orderEmail', 'errEmail', '');

    if (currentMethod() === 'delivery' && address.length < 5) {
      setError('orderAddress', 'errAddress', 'Укажите улицу, дом и квартиру.');
      invalid = invalid || $('#orderAddress');
    } else setError('orderAddress', 'errAddress', '');

    if (!consent) {
      setError('orderConsent', 'errConsent', 'Отметьте согласие на обработку персональных данных — без него мы не можем принять заказ.');
      invalid = invalid || $('#orderConsent');
    } else setError('orderConsent', 'errConsent', '');

    if (invalid) {
      invalid.focus();
      invalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return null;
    }

    return {
      name: name,
      phone: formatPhone(phone),
      email: email,
      method: currentMethod(),
      address: currentMethod() === 'delivery' ? address : '',
      time: $('#orderTime').value,
      payment: $('#orderPayment').value,
      comment: $('#orderComment').value.trim(),
      consent: consentRecord(),
      promo: state.promo,
      items: cartItems().map(function (i) {
        return { id: i.id, name: products[i.id].name, price: products[i.id].price, qty: i.qty };
      }),
      totals: checkoutTotals()
    };
  }

  /* Запись о согласии на обработку персональных данных: уходит вместе с данными формы,
     чтобы оператор мог подтвердить, когда и на что получено согласие. */
  function consentRecord() {
    return { given: true, at: new Date().toISOString(), document: 'legal.html#consent' };
  }

  /* Отправка JSON. Без endpoint — демо-режим: ничего не уходит, ответ помечен demo: true. */
  function postJson(endpoint, payload) {
    if (!endpoint) return Promise.resolve({ demo: true });
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json().catch(function () { return {}; });
    });
  }

  function sendOrder(order) {
    return postJson(ORDER_ENDPOINT, order);
  }

  /* Простые формы (подписка, обратная связь). В демо-режиме честно сообщаем, что данные не отправлены. */
  function submitForm(endpoint, payload, form, successSelector, messages) {
    var button = $('button[type="submit"]', form);
    var box = $(successSelector);
    box.hidden = true;
    if (button) button.disabled = true;
    postJson(endpoint, payload).then(function (response) {
      var demo = !!(response && response.demo);
      box.textContent = demo ? messages.demo : messages.done;
      box.hidden = false;
      form.reset();
      toast(demo ? 'Демо-режим: данные не отправлены' : messages.toast);
    }).catch(function () {
      toast('Не удалось отправить. Попробуйте ещё раз или позвоните: ' + SHOP.company.phone);
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  var timeLabels = {
    asap: 'как можно скорее',
    '12-14': '12:00–14:00',
    '14-16': '14:00–16:00',
    '16-18': '16:00–18:00',
    '18-20': '18:00–20:00',
    '20-22': '20:00–22:00'
  };

  var successNoteDefault = null;

  function finishOrder(order, number, demo) {
    var t = order.totals;
    var note = $('#successDialog .form-note');
    if (successNoteDefault === null) successNoteDefault = note.textContent;
    $('#successTitle').textContent = demo ? 'Демо-режим: заказ не отправлен' : 'Заказ принят';
    note.textContent = demo
      ? 'Сайт работает в тестовом режиме: заказ никуда не передан и выполнен не будет. Чтобы оформить заказ, позвоните нам: ' + SHOP.company.phone + '.'
      : successNoteDefault;
    $('#successNumber').textContent = number;
    $('#successTotal').textContent = money(t.total);
    $('#successMethod').textContent = order.method === 'pickup'
      ? 'Самовывоз: ' + SHOP.company.pickup + ', ' + timeLabels[order.time] + '.'
      : 'Доставка: ' + order.address + ', ' + timeLabels[order.time] + '.';

    state.cart = {};
    state.promo = '';
    saveCart();
    storageSet(PROMO_KEY, '');
    if (!demo) storageSet(ORDERED_KEY, new Date().toISOString());
    renderCart();
    el.checkoutForm.reset();
    toggleAddress();
    setError('orderConsent', 'errConsent', '');

    el.checkoutDialog.close();
    openDialog(el.successDialog);
  }

  /* ---------- Forms ---------- */

  function bindForms() {
    el.checkoutForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!cartTotals().canOrder) {
        toast('Минимальный заказ — 20,00 BYN');
        return;
      }
      var order = validateCheckout();
      if (!order) return;

      var button = $('#placeOrderBtn');
      button.disabled = true;
      sendOrder(order).then(function (response) {
        var demo = !!(response && response.demo);
        var number = demo ? 'демо' : ((response && response.orderNumber) || 'KB-' + String(Date.now()).slice(-6));
        finishOrder(order, number, demo);
        toast(demo ? 'Демо-режим: заказ не отправлен' : 'Заказ оформлен');
      }).catch(function () {
        toast('Не удалось отправить заказ. Позвоните нам: ' + SHOP.company.phone);
      }).then(function () {
        button.disabled = false;
        if (el.checkoutDialog.open) renderCheckoutSummary();
      });
    });

    $('#orderPhone').addEventListener('input', function (event) {
      event.target.value = formatPhone(event.target.value);
    });

    $$('input[name="method"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        toggleAddress();
        renderCheckoutSummary();
      });
    });

    $$('#checkoutForm input, #checkoutForm textarea').forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.id === 'orderConsent') setError('orderConsent', 'errConsent', '');
        else if (input.id) setError(input.id, 'err' + input.id.replace('order', ''), '');
      });
    });

    // Подписка на акции
    var subscribeForm = $('#subscribeForm');
    subscribeForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = $('#subscribeEmail').value.trim();
      var ok = true;
      if (!EMAIL_RE.test(email)) {
        setError('subscribeEmail', 'errSubscribeEmail', 'Укажите корректный e-mail.');
        ok = false;
      } else setError('subscribeEmail', 'errSubscribeEmail', '');

      if (!$('#subscribeConsent').checked) {
        setError('subscribeConsent', 'errSubscribeConsent', 'Для подписки нужно согласие на обработку персональных данных.');
        ok = false;
      } else setError('subscribeConsent', 'errSubscribeConsent', '');

      if (!ok) return;
      submitForm(SUBSCRIBE_ENDPOINT, { email: email, consent: consentRecord() }, subscribeForm, '#subscribeSuccess', {
        done: 'Заявка на подписку принята. Отписаться можно в любом письме.',
        demo: 'Демо-режим: форма не подключена к серверу, адрес никуда не отправлен.',
        toast: 'Подписка оформлена'
      });
    });

    // Обратная связь
    var feedbackForm = $('#feedbackForm');
    feedbackForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var ok = true;
      if ($('#feedbackName').value.trim().length < 2) {
        setError('feedbackName', 'errFeedbackName', 'Укажите имя.');
        ok = false;
      } else setError('feedbackName', 'errFeedbackName', '');

      if ($('#feedbackContact').value.trim().length < 5) {
        setError('feedbackContact', 'errFeedbackContact', 'Оставьте телефон или e-mail для ответа.');
        ok = false;
      } else setError('feedbackContact', 'errFeedbackContact', '');

      if ($('#feedbackMessage').value.trim().length < 5) {
        setError('feedbackMessage', 'errFeedbackMessage', 'Опишите вопрос — минимум 5 символов.');
        ok = false;
      } else setError('feedbackMessage', 'errFeedbackMessage', '');

      if (!$('#feedbackConsent').checked) {
        setError('feedbackConsent', 'errFeedbackConsent', 'Для отправки обращения нужно согласие на обработку персональных данных.');
        ok = false;
      } else setError('feedbackConsent', 'errFeedbackConsent', '');

      if (!ok) return;
      submitForm(FEEDBACK_ENDPOINT, {
        name: $('#feedbackName').value.trim(),
        contact: $('#feedbackContact').value.trim(),
        message: $('#feedbackMessage').value.trim(),
        consent: consentRecord()
      }, feedbackForm, '#feedbackSuccess', {
        done: 'Сообщение отправлено. Мы ответим по указанному контакту.',
        demo: 'Демо-режим: форма не подключена к серверу, сообщение никуда не отправлено.',
        toast: 'Сообщение отправлено'
      });
    });

    $$('#subscribeForm input, #feedbackForm input, #feedbackForm textarea').forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.type === 'checkbox') return;
        var prefix = input.id.indexOf('subscribe') === 0 ? 'errSubscribe' : 'errFeedback';
        var key = input.id.replace('subscribe', '').replace('feedback', '');
        setError(input.id, prefix + key, '');
      });
    });

    [['subscribeConsent', 'errSubscribeConsent'], ['feedbackConsent', 'errFeedbackConsent']].forEach(function (pair) {
      var box = document.getElementById(pair[0]);
      if (box) box.addEventListener('change', function () { setError(pair[0], pair[1], ''); });
    });
  }

  /* ---------- Events ---------- */

  function bindEvents() {
    el.catalog.addEventListener('click', function (event) {
      var button = event.target.closest('[data-add]');
      if (button) addToCart(button.getAttribute('data-add'));
    });

    el.categories.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-cat]');
      if (!chip) return;
      state.filters.cat = chip.getAttribute('data-cat');
      renderFilters();
      renderCatalog();
    });

    el.tags.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-tag]');
      if (!chip) return;
      var id = chip.getAttribute('data-tag');
      var index = state.filters.tags.indexOf(id);
      if (index === -1) state.filters.tags.push(id);
      else state.filters.tags.splice(index, 1);
      renderFilters();
      renderCatalog();
    });

    el.search.addEventListener('input', function (event) {
      state.filters.q = event.target.value;
      renderCatalog();
    });

    $('#openCart').addEventListener('click', function () {
      renderCart();
      openDialog(el.cartDialog);
    });

    el.cartItems.addEventListener('click', function (event) {
      var inc = event.target.closest('[data-inc]');
      var dec = event.target.closest('[data-dec]');
      var remove = event.target.closest('[data-remove]');
      if (inc) changeQty(inc.getAttribute('data-inc'), 1);
      if (dec) changeQty(dec.getAttribute('data-dec'), -1);
      if (remove) {
        delete state.cart[remove.getAttribute('data-remove')];
        saveCart();
        renderCart();
      }
    });

    $('#checkoutBtn').addEventListener('click', openCheckout);

    $('#promoApply').addEventListener('click', function () {
      var code = el.promoInput.value.trim();
      if (!code) {
        state.promo = '';
        storageSet(PROMO_KEY, '');
        renderCart();
        return;
      }
      var promo = P.promoInfo(code);
      if (!promo) {
        renderCart();
        el.promoInput.value = code;
        setPromoMessage('Промокод не найден. Проверьте написание.', 'error');
        return;
      }
      var check = P.discountFor(P.subtotal(cartItems()), code, isFirstOrder());
      if (!check.applied) {
        renderCart();
        el.promoInput.value = code;
        setPromoMessage(check.reason, 'error');
        return;
      }
      state.promo = code.toUpperCase();
      storageSet(PROMO_KEY, state.promo);
      renderCart();
      toast('Промокод применён');
    });

    el.promoInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        $('#promoApply').click();
      }
    });

    // Закрытие диалогов
    $$('dialog').forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
      $$('[data-close]', dialog).forEach(function (button) {
        button.addEventListener('click', function () { dialog.close(); });
      });
    });

    // Мобильное меню
    var toggle = $('#menuToggle');
    var nav = $('#siteNav');
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('a', nav).forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.toast.classList.remove('is-visible'); }, 2600);
  }

  /* ---------- Init ---------- */

  $('#year').textContent = new Date().getFullYear();
  renderPromos();
  renderFilters();
  renderCatalog();
  renderCart();
  bindEvents();
  bindForms();
})();
