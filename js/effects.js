/* Лёгкие эффекты: линия под шапкой при прокрутке и плавное появление блоков.
   Без эффектов сайт работает полностью. При prefers-reduced-motion блоки показываются сразу. */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');

  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var targets = document.querySelectorAll(
    '.hero-inner > div:first-child > *, .section-head, .promo-card, .info-card, ' +
    '.subscribe-box, .contact-box, .legal-hero .wrap > *, .legal-section'
  );

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });

  Array.prototype.forEach.call(targets, function (el) {
    /* Лёгкая «лесенка» для соседних элементов одного ряда */
    var index = Array.prototype.indexOf.call(el.parentNode.children, el);
    el.style.transitionDelay = Math.min(index, 4) * 70 + 'ms';
    el.classList.add('reveal');
    observer.observe(el);
  });
})();
