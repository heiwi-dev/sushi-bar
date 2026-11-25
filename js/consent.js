/* Cookie-согласие (Закон РБ № 99-З): ничего необязательного не грузится до согласия. */
(function () {
  'use strict';

  var KEY = 'kabuki.cookie.v1';
  var state = readState();
  var analyticsHooks = [];
  var marketingHooks = [];
  var analyticsLoaded = false;
  var marketingLoaded = false;

  var banner = document.getElementById('cookieBanner');
  var dialog = document.getElementById('cookieDialog');
  var analyticsInput = document.getElementById('cookieAnalytics');
  var marketingInput = document.getElementById('cookieMarketing');

  function readState() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveState(next) {
    next.necessary = true;
    next.updatedAt = new Date().toISOString();
    state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) { /* приватный режим: согласие живёт до закрытия вкладки */ }
    applyConsent();
  }

  function applyConsent() {
    loadAnalytics();
    loadMarketing();
    document.dispatchEvent(new CustomEvent('consent:change', { detail: state }));
  }

  function runHooks(hooks) {
    var queue = hooks.splice(0);
    queue.forEach(function (fn) {
      try { fn(); } catch (e) { /* сторонний скрипт не должен ломать сайт */ }
    });
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (banner) banner.hidden = false;
  }

  function fillDialog() {
    var s = state || { analytics: false, marketing: false };
    if (analyticsInput) analyticsInput.checked = !!s.analytics;
    if (marketingInput) marketingInput.checked = !!s.marketing;
  }

  function openSettings() {
    fillDialog();
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog() {
    if (dialog && dialog.open) dialog.close();
  }

  /* Точка подключения аналитики: сюда вставляется код счётчика. */
  function loadAnalytics() {
    if (!state || !state.analytics) return;
    if (!analyticsLoaded) {
      analyticsLoaded = true; // код счётчика подключается один раз за визит
      // Пример: (function(m,e,t,r,i,k,a){ ... })(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym',...);
      // Ничего не выполняем, пока пользователь не дал согласие.
    }
    runHooks(analyticsHooks);
  }

  function loadMarketing() {
    if (!state || !state.marketing) return;
    if (!marketingLoaded) {
      marketingLoaded = true;
      // Пример: пиксель ретаргетинга. Не подключается без согласия.
    }
    runHooks(marketingHooks);
  }

  function registerAnalytics(fn) {
    if (state && state.analytics) runHooks([fn]);
    else analyticsHooks.push(fn);
  }

  function registerMarketing(fn) {
    if (state && state.marketing) runHooks([fn]);
    else marketingHooks.push(fn);
  }

  if (banner) {
    if (state) hideBanner(); else showBanner();

    document.getElementById('cookieAcceptAll').addEventListener('click', function () {
      saveState({ analytics: true, marketing: true });
      hideBanner();
      toast('Cookie: приняты все');
    });

    document.getElementById('cookieRejectOptional').addEventListener('click', function () {
      saveState({ analytics: false, marketing: false });
      hideBanner();
      toast('Cookie: необязательные отклонены');
    });

    document.getElementById('cookieCustomize').addEventListener('click', function () {
      openSettings();
    });
  }

  var footerLink = document.getElementById('cookieSettingsFooter');
  if (footerLink) footerLink.addEventListener('click', openSettings);

  if (dialog) {
    document.getElementById('cookieSave').addEventListener('click', function () {
      saveState({
        analytics: !!(analyticsInput && analyticsInput.checked),
        marketing: !!(marketingInput && marketingInput.checked)
      });
      closeDialog();
      hideBanner();
      toast('Настройки cookie сохранены');
    });

    document.getElementById('cookieRejectAll').addEventListener('click', function () {
      saveState({ analytics: false, marketing: false });
      closeDialog();
      hideBanner();
      toast('Необязательные cookie отключены');
    });
  }

  function toast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  window.SushiConsent = {
    get: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
    openSettings: openSettings,
    registerAnalytics: registerAnalytics,
    registerMarketing: registerMarketing,
    loadAnalytics: loadAnalytics,
    loadMarketing: loadMarketing
  };

  if (state) applyConsent();

  /* Ссылка «Настройки cookie» с других страниц: index.html?cookie=1 */
  if (/[?&]cookie=1/.test(window.location.search)) {
    openSettings();
    /* Убираем параметр из адреса, чтобы окно не открывалось после каждой перезагрузки. */
    try {
      var params = new URLSearchParams(window.location.search);
      params.delete('cookie');
      var query = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    } catch (e) { /* некоторые браузеры запрещают replaceState для file:// */ }
  }
})();
