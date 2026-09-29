/* ==========================================================================
   myAlternates — public event / announcement popup (landing page only).

   Reads whatever banner an admin has uploaded from the backoffice Settings
   page (Lead Check portal -> Settings -> Event advertisement) and shows it
   as a centred popup a moment after the landing page loads, with a close
   button top-right (backdrop click and Esc close it too). No banner set (or
   the request fails) -> nothing renders.

   Once per day, not on every load: once shown it stays away for the rest of
   that day in this browser (localStorage, keyed to the banner's version),
   so coming back to the home page by a link or Back doesn't pop it again.
   Two exceptions: refreshing the landing page itself always shows it, and
   a *new* upload always shows, even the same day.

   Never stacks on another dialog: if the schedule / registration popup is
   already open when it's due, it's skipped for this load (and not marked
   seen, so it still gets its turn next time).
   ========================================================================== */
(function () {
  'use strict';
  var API_URL = 'https://myalternates-backend-c3u7.onrender.com/';
  var SEEN_KEY = 'ma_event_popup_seen';
  var SHOW_DELAY_MS = 1500;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function seenToday(version) {
    try {
      var s = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
      return !!(s && s.v === version && s.d === today());
    } catch (e) { return false; }
  }

  function markSeen(version) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ v: version, d: today() })); } catch (e) {}
  }

  // A refresh of the landing page itself (F5 / Ctrl+R / Ctrl+Shift+R) always
  // shows it again; arriving by a link or Back doesn't.
  function isReload() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav) return nav.type === 'reload';
      return performance.navigation && performance.navigation.type === 1;
    } catch (e) { return false; }
  }

  function otherDialogOpen() {
    return !!document.querySelector('.sched-overlay.show, .ma-modal-overlay, .cmp-modal-backdrop, .scm-calc-modal');
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.ma-ev-overlay{position:fixed; inset:0; z-index:9000; background:rgba(8,10,14,0.72);' +
        'display:flex; align-items:center; justify-content:center; padding:24px 16px; box-sizing:border-box;' +
        'animation:ma-ev-fade .25s ease;}' +
      '.ma-ev-card{position:relative; max-width:min(720px,100%); max-height:100%; display:flex; flex-direction:column;' +
        'border-radius:12px; overflow:hidden; background:#181B20; box-shadow:0 30px 70px -20px rgba(0,0,0,0.6);' +
        'animation:ma-ev-pop .3s ease;}' +
      '.ma-ev-card a.ma-ev-link{display:block; min-height:0;}' +
      '.ma-ev-card img{display:block; width:100%; height:auto; max-height:calc(100vh - 120px); object-fit:contain; background:#0B0E13;}' +
      '.ma-ev-caption{padding:12px 18px; font-size:14px; font-weight:600; color:#F7F4ED; line-height:1.45;}' +
      '.ma-ev-close{position:absolute; top:10px; right:10px; width:34px; height:34px; border-radius:50%;' +
        'background:rgba(11,14,19,0.7); color:#fff; border:1px solid rgba(255,255,255,0.25); cursor:pointer;' +
        'font-size:16px; line-height:1; display:flex; align-items:center; justify-content:center; z-index:1;}' +
      '.ma-ev-close:hover{background:rgba(11,14,19,0.9);}' +
      '.ma-ev-close:focus-visible{outline:2px solid #C9A24B; outline-offset:2px;}' +
      '@keyframes ma-ev-fade{from{opacity:0}to{opacity:1}}' +
      '@keyframes ma-ev-pop{from{opacity:0; transform:translateY(12px) scale(.98)}to{opacity:1; transform:none}}' +
      '@media (prefers-reduced-motion:reduce){.ma-ev-overlay,.ma-ev-card{animation:none}}';
    document.head.appendChild(style);
  }

  function show(d) {
    injectStyles();
    var media = '<img src="' + escapeHtml(d.image) + '" alt="' + escapeHtml(d.title || 'Event') + '">';

    var overlay = document.createElement('div');
    overlay.className = 'ma-ev-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', d.title || 'Announcement');
    overlay.innerHTML =
      '<div class="ma-ev-card">' +
      '<button type="button" class="ma-ev-close" aria-label="Close" title="Close">✕</button>' +
      (d.link ? '<a class="ma-ev-link" href="' + escapeHtml(d.link) + '" target="_blank" rel="noopener">' + media + '</a>' : media) +
      (d.title ? '<div class="ma-ev-caption">' + escapeHtml(d.title) + '</div>' : '') +
      '</div>';

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    markSeen(d.version);

    function close() {
      overlay.remove();
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    overlay.querySelector('.ma-ev-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.ma-ev-close').focus();
  }

  function init() {
    fetch(API_URL + '?action=getEventBanner')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.image) return;
        if (seenToday(d.version) && !isReload()) return;
        // Preload so the popup opens with the poster already drawn.
        var img = new Image();
        img.onload = function () {
          setTimeout(function () {
            if (otherDialogOpen()) return;
            show(d);
          }, SHOW_DELAY_MS);
        };
        img.src = d.image;
      })
      .catch(function () {});   // no banner today shouldn't ever break the page
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
