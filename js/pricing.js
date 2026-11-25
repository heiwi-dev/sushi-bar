/* Чистый расчёт заказа. Без DOM — покрыт tests/pricing.test.html. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Pricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var PROMOS = {
    FIRST10: { kind: 'percent', value: 10, min: 0, firstOnly: true, label: 'Скидка на первый заказ −10%' },
    SUSHI15: { kind: 'percent', value: 15, min: 60, label: 'Промокод SUSHI15 −15%' },
    FREE5: { kind: 'fixed', value: 5, min: 40, label: 'Промокод FREE5 −5 BYN' }
  };

  var DELIVERY = { freeFrom: 50, fee: 5, minOrder: 20 };

  /* Условия доставки берутся из js/data.js (SHOP.delivery), если заданы числами. */
  var configured = root && root.SHOP && root.SHOP.delivery;
  if (configured) {
    Object.keys(DELIVERY).forEach(function (key) {
      var value = configured[key];
      if (typeof value === 'number' && isFinite(value) && value >= 0) DELIVERY[key] = value;
    });
  }

  function money(n) {
    return Math.round(n * 100) / 100;
  }

  function formatMoney(n) {
    return money(n).toFixed(2).replace('.', ',') + ' BYN';
  }

  function subtotal(items) {
    return money((items || []).reduce(function (sum, item) {
      if (!item || !(item.qty > 0)) return sum;
      return sum + item.price * item.qty;
    }, 0));
  }

  function promoInfo(code) {
    if (!code) return null;
    return PROMOS[String(code).trim().toUpperCase()] || null;
  }

  function discountFor(sum, code, firstOrder) {
    var promo = promoInfo(code);
    if (promo) {
      if (promo.firstOnly && !firstOrder) {
        return {
          discount: 0, applied: false, label: '',
          reason: 'Промокод действует только на первый заказ'
        };
      }
      if (sum < promo.min) {
        return {
          discount: 0, applied: false, label: '',
          reason: 'Промокод действует от ' + formatMoney(promo.min)
        };
      }
      var value = promo.kind === 'percent' ? sum * promo.value / 100 : promo.value;
      return {
        discount: money(Math.min(value, sum)), applied: true,
        label: promo.label, reason: '', code: String(code).trim().toUpperCase()
      };
    }
    if (code) return { discount: 0, applied: false, label: '', reason: 'Промокод не найден' };
    if (firstOrder) {
      return { discount: money(sum * 0.1), applied: true, label: 'Скидка на первый заказ −10%', reason: '', code: '' };
    }
    return { discount: 0, applied: false, label: '', reason: '' };
  }

  function deliveryFee(method, afterDiscount) {
    if (method === 'pickup') return { fee: 0, free: true, reason: 'Самовывоз — бесплатно' };
    if (afterDiscount >= DELIVERY.freeFrom) {
      return { fee: 0, free: true, reason: 'Бесплатно от ' + formatMoney(DELIVERY.freeFrom) };
    }
    return { fee: DELIVERY.fee, free: false, reason: 'Доставка ' + formatMoney(DELIVERY.fee) };
  }

  function totals(items, opts) {
    opts = opts || {};
    var sum = subtotal(items);
    var method = opts.method === 'pickup' ? 'pickup' : 'delivery';
    var promo = discountFor(sum, opts.promo, !!opts.firstOrder);
    var afterDiscount = money(sum - promo.discount);
    var delivery = deliveryFee(method, afterDiscount);
    return {
      subtotal: sum,
      discount: promo.discount,
      promo: promo,
      afterDiscount: afterDiscount,
      delivery: delivery.fee,
      deliveryInfo: delivery,
      total: money(afterDiscount + delivery.fee),
      method: method,
      canOrder: sum >= DELIVERY.minOrder,
      minOrder: DELIVERY.minOrder
    };
  }

  return {
    PROMOS: PROMOS,
    DELIVERY: DELIVERY,
    money: money,
    formatMoney: formatMoney,
    subtotal: subtotal,
    promoInfo: promoInfo,
    discountFor: discountFor,
    deliveryFee: deliveryFee,
    totals: totals
  };
});
