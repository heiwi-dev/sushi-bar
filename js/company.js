/* Подставляет реквизиты из js/data.js во все элементы [data-company]. */
(function () {
  'use strict';
  var company = window.SHOP && window.SHOP.company;
  if (!company) return;

  function isPlaceholder(value) {
    return typeof value === 'string' && value.indexOf('[ЗАПОЛНИТЬ') === 0;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-company]'), function (el) {
    var key = el.getAttribute('data-company');
    var textKey = el.getAttribute('data-company-text');
    /* У ссылки на почту нет отдельного ключа в data.js: берём company.email. */
    var value = key === 'emailHref' ? company.email : company[key];
    if (value == null) return;

    if (key === 'phoneHref') el.setAttribute('href', 'tel:' + company.phoneHref);
    else if (key === 'emailHref') el.setAttribute('href', 'mailto:' + company.email);
    else el.textContent = value;

    if (textKey && company[textKey]) el.textContent = company[textKey];
    if (el.classList.contains('placeholder') && !isPlaceholder(value)) {
      el.classList.remove('placeholder');
    }
  });
})();
