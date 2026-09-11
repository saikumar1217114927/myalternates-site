/* ==========================================================================
   myAlternates — mobile header menu.

   The header ships a ☰ "burger" button that was never wired up (and on the
   product pages it wasn't even shown). This script:
     - guarantees the burger is visible <=980px
     - toggles a `.nav-open` class on <header class="nav">
     - lays the nav links out as a vertical panel and expands the
       Products / Tools / Login sub-menus inline (no hover on touch)
   Styles are injected here so every page gets the same behaviour whether it
   uses assets/site.css or its own inline <style>.
   ========================================================================== */
(function () {
  'use strict';

  function init() {
    var header = document.querySelector('header.nav');
    if (!header) return;
    var burger = header.querySelector('.burger');
    if (!burger) return;

    var style = document.createElement('style');
    style.textContent =
      '@media (max-width:980px){' +
        'header.nav .burger{display:block !important; margin-left:auto; position:relative; z-index:2;}' +
        'header.nav .nav-inner{position:relative;}' +
        'header.nav nav.links{display:none;}' +
        'header.nav.nav-open nav.links{' +
          'display:flex !important; flex-direction:column; align-items:stretch;' +
          'position:absolute; left:0; right:0; top:100%;' +
          'gap:0; padding:8px 20px 20px;' +
          'background:var(--ink,#0B0E13);' +
          'border-bottom:1px solid var(--line,#2A3140);' +
          'box-shadow:0 24px 40px -16px rgba(0,0,0,0.55);' +
          'max-height:calc(100vh - 68px); overflow-y:auto;' +
        '}' +
        'header.nav.nav-open nav.links > a,' +
        'header.nav.nav-open nav.links > .nav-products,' +
        'header.nav.nav-open nav.links > .nav-login{' +
          'display:block !important; width:100%; padding:13px 2px;' +
          'border-bottom:1px solid rgba(255,255,255,0.08); font-size:15px;' +
        '}' +
        'header.nav.nav-open nav.links > a::after{display:none;}' +
        'header.nav.nav-open nav.links .nav-products-trigger{padding:0; display:inline-flex;}' +
        'header.nav.nav-open nav.links .nav-menu,' +
        'header.nav.nav-open nav.links .login-menu{' +
          'position:static !important; opacity:1 !important; visibility:visible !important;' +
          'transform:none !important; pointer-events:auto !important; display:block !important;' +
          'background:transparent !important; box-shadow:none !important; border:none !important;' +
          'min-width:0 !important; max-height:none !important; margin:6px 0 2px;' +
          'padding:2px 0 2px 14px !important;' +
        '}' +
        'header.nav.nav-open nav.links .nav-menu a,' +
        'header.nav.nav-open nav.links .login-menu a{' +
          'display:block !important; padding:9px 0 !important; font-size:14px;' +
        '}' +
        'header.nav.nav-open nav.links .nav-login > span{display:block; padding:0 0 2px;}' +
        'header.nav.nav-open nav.links .nav-cta{' +
          'display:inline-block !important; text-align:center; margin-top:14px; align-self:flex-start;' +
        '}' +
      '}';
    document.head.appendChild(style);

    burger.setAttribute('aria-expanded', 'false');

    function setOpen(open) {
      header.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    burger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!header.classList.contains('nav-open'));
    });

    // tapping any real link closes the menu
    var links = header.querySelectorAll('nav.links a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () { setOpen(false); });
    }

    document.addEventListener('click', function (e) {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 980 && header.classList.contains('nav-open')) setOpen(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
