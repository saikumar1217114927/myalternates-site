/* ==========================================================================
   myAlternates — featured schemes list (real, unmasked, publicly visible)
   Renders on a product page, driven by <section class="p-schemes"
   data-schemes="PMS">. The list itself is open to everyone — up to 10
   schemes an admin has run the Performance action for. Registration only
   happens when a visitor clicks "Discover": an already-registered visitor
   goes straight to scheme.html?id=<planId>; an anonymous one first fills
   the full registration form in a modal, then is taken there.
   ========================================================================== */
(function () {
  var host = document.querySelector('.p-schemes[data-schemes]');
  if (!host) return;

  var API_URL = 'https://myalternates-backend.onrender.com/';
  var productCode = host.dataset.schemes || 'PMS';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }

  function retBlock(label, v) {
    var cls = v == null ? 'na' : (v >= 0 ? 'pos' : 'neg');
    return '<div class="sr-ret"><span>' + esc(label) + '</span><b class="' + cls + '">' + (v == null ? '–' : pct(v)) + '</b></div>';
  }

  function rowHtml(s) {
    var r = s.returns;
    var logo = s.amcLogo
      ? '<img class="sr-logo" src="' + esc(s.amcLogo) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;sr-logo-fallback&quot;>' + esc((s.amcName || '?').charAt(0)) + '</div>\'">'
      : '<div class="sr-logo-fallback">' + esc((s.amcName || s.productName || '?').charAt(0)) + '</div>';
    return '<div class="scheme-row' + (s.featured ? ' featured' : '') + '">' +
      '<div class="sr-amc">' + logo + '<div><div class="sc-amc">' + esc(s.amcName || s.productName) +
      (s.featured ? '<span class="sr-featured-tag">★ Featured</span>' : '') + '</div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div></div></div>' +
      '<div class="sr-rets">' + retBlock('1M', r.r1m) + retBlock('3M', r.r3m) + retBlock('1Y', r.r1y) + '</div>' +
      '<div class="sr-si">' + retBlock('SI', r.si) +
      '<button type="button" class="sc-discover" data-discover="' + esc(s.planId) + '">Discover →</button></div>' +
      '</div>';
  }

  function renderList(schemes) {
    if (!schemes.length) { host.remove(); return; } // nothing curated yet — don't show an empty section
    host.innerHTML =
      '<div class="wrap">' +
      '<div class="p-schemes-head">' +
      '<div class="section-head">' +
      '<div class="section-tag">Live on the platform</div>' +
      '<h2>Explore featured PMS schemes</h2>' +
      '</div>' +
      '<div class="p-schemes-tools">' +
      '<div class="ps-search">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6.5"/><line x1="18" y1="18" x2="13.6" y2="13.6"/></svg>' +
      '<input type="search" id="psSearch" placeholder="Search by scheme or AMC name" aria-label="Search schemes">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="scheme-list">' + schemes.map(rowHtml).join('') + '</div>' +
      '<p class="ps-empty" hidden>No schemes match your search.</p>' +
      '<p class="disc">Returns are trailing, annualised beyond one year, as of the date shown. Past performance is not indicative of future results — data sourced from Finalyca / scheme filings.</p>' +
      '</div>';
    host.querySelectorAll('[data-discover]').forEach(function (btn) {
      btn.onclick = function () { goToScheme(btn.dataset.discover); };
    });
    wireSearch();
  }

  // Client-side filter on scheme/AMC name — the search box now, with room
  // alongside it for category/asset-class filters to land later.
  function wireSearch() {
    var input = host.querySelector('#psSearch');
    var rows = host.querySelectorAll('.scheme-row');
    var empty = host.querySelector('.ps-empty');
    if (!input) return;
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {
        var hay = (row.querySelector('.sc-amc').textContent + ' ' + row.querySelector('.sr-scheme-name').textContent).toLowerCase();
        var match = !q || hay.indexOf(q) > -1;
        row.hidden = !match;
        if (match) shown++;
      });
      empty.hidden = shown > 0;
    });
  }

  function goToScheme(planId) {
    if (window.MASession && window.MASession.getToken()) {
      location.href = 'scheme?id=' + encodeURIComponent(planId);
      return;
    }
    openDiscoverGate(planId);
  }

  // A registered visitor skips straight through; an anonymous one registers
  // (full form, not just email) in this modal first, then lands on the page.
  function openDiscoverGate(planId) {
    var overlay = document.createElement('div');
    overlay.className = 'ma-modal-overlay';
    overlay.innerHTML = '<div class="ma-modal-card"><button type="button" class="ma-modal-close" aria-label="Close">✕</button><div class="ma-modal-body"></div></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    function close() { overlay.remove(); document.body.style.overflow = ''; }
    overlay.querySelector('.ma-modal-close').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    window.maRenderFullGate(overlay.querySelector('.ma-modal-body'), {
      message: 'Create your free account to see this scheme\'s live returns and full profile.',
      interest: 'Portfolio Management Services (PMS)',
      onVerified: function () { location.href = 'scheme?id=' + encodeURIComponent(planId); }
    });
  }

  function loadSchemes() {
    fetch(API_URL + '?action=getPublicFeaturedSchemes&productCode=' + encodeURIComponent(productCode) + '&limit=10')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) renderList(d.schemes || []); else host.remove(); })
      .catch(function () { host.remove(); });
  }

  loadSchemes();
})();
