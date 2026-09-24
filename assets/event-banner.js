/* ==========================================================================
   myAlternates — public event / announcement banner.

   Reads whatever banner an admin has uploaded from the backoffice Settings
   page (Lead Check portal -> Settings -> Event advertisement) and shows it
   just below the header nav, on every page. No banner set (or the request
   fails) -> nothing renders, the site looks exactly as it does today.

   Dismissing is remembered per-browser (localStorage) against that specific
   banner's version, so a *new* upload always shows again even if the last
   one was dismissed.
   ========================================================================== */
(function () {
  'use strict';
  var API_URL = 'https://myalternates-backend-c3u7.onrender.com/';
  var DISMISS_KEY = 'ma_site_banner_dismissed';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(header, d) {
    var style = document.createElement('style');
    style.textContent =
      '.ma-event-banner{max-width:1200px; margin:18px auto 0; padding:0 24px; box-sizing:border-box;}' +
      '.ma-event-banner .ma-eb-inner{position:relative; border-radius:8px; overflow:hidden; box-shadow:0 18px 40px -20px rgba(20,20,10,0.35);}' +
      '.ma-event-banner img{display:block; width:100%; max-height:260px; object-fit:cover;}' +
      '.ma-event-banner a.ma-eb-link{display:block;}' +
      '.ma-event-banner .ma-eb-caption{padding:10px 18px; font-size:13px; font-weight:600; background:#181B20; color:#F7F4ED;}' +
      '.ma-event-banner .ma-eb-close{' +
        'position:absolute; top:10px; right:10px; width:28px; height:28px; border-radius:50%;' +
        'background:rgba(11,14,19,0.55); color:#fff; border:none; cursor:pointer; font-size:15px; line-height:1;' +
        'display:flex; align-items:center; justify-content:center;' +
      '}' +
      '.ma-event-banner .ma-eb-close:hover{background:rgba(11,14,19,0.8);}' +
      '@media (max-width:640px){ .ma-event-banner{padding:0 16px; margin-top:12px;} .ma-event-banner img{max-height:170px;} }';
    document.head.appendChild(style);

    var media = '<img src="' + d.image + '" alt="' + escapeHtml(d.title || 'Event') + '">' +
      (d.title ? '<div class="ma-eb-caption">' + escapeHtml(d.title) + '</div>' : '');

    var wrap = document.createElement('div');
    wrap.className = 'ma-event-banner';
    wrap.innerHTML =
      '<div class="ma-eb-inner">' +
      (d.link ? '<a class="ma-eb-link" href="' + escapeHtml(d.link) + '" target="_blank" rel="noopener">' + media + '</a>' : media) +
      '<button class="ma-eb-close" aria-label="Dismiss" title="Dismiss">✕</button>' +
      '</div>';
    header.parentNode.insertBefore(wrap, header.nextSibling);

    wrap.querySelector('.ma-eb-close').addEventListener('click', function () {
      try { localStorage.setItem(DISMISS_KEY, d.version); } catch (e) {}
      wrap.remove();
    });
  }

  function init() {
    var header = document.querySelector('header.nav');
    if (!header) return;

    fetch(API_URL + '?action=getEventBanner')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.image) return;
        var dismissed = '';
        try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch (e) {}
        if (dismissed && d.version && dismissed === d.version) return;
        render(header, d);
      })
      .catch(function () {});   // no banner today shouldn't ever break the page
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
