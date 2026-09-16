/* ==========================================================================
   myAlternates — featured schemes list (real, unmasked, registered-leads-only)
   Renders on a product page, driven by <section class="p-schemes"
   data-schemes="PMS">. Gated: an anonymous visitor sees a "register to
   view" prompt (the same email-OTP identity lead-form.js manages); once
   registered, the real list shows — up to 10 schemes an admin has run the
   Performance action for. "Discover" links to scheme.html?id=<planId>.
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
      '<a class="sc-discover" href="scheme?id=' + encodeURIComponent(s.planId) + '">Discover →</a></div>' +
      '</div>';
  }

  function renderList(schemes) {
    if (!schemes.length) { host.remove(); return; } // nothing curated yet — don't show an empty section
    host.innerHTML =
      '<div class="wrap">' +
      '<div class="scheme-list">' + schemes.map(rowHtml).join('') + '</div>' +
      '<p class="disc">Returns are trailing, annualised beyond one year, as of the date shown. Past performance is not indicative of future results — data sourced from Finalyca / scheme filings.</p>' +
      '</div>';
  }

  function loadSchemes() {
    fetch(API_URL + '?action=getPublicFeaturedSchemes&productCode=' + encodeURIComponent(productCode) + '&limit=10')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) renderList(d.schemes || []); else host.remove(); })
      .catch(function () { host.remove(); });
  }

  function showGate() {
    host.innerHTML = '<div class="wrap"><div id="pgGate"></div></div>';
    window.maRenderGate(document.getElementById('pgGate'),
      'Scheme performance data is available to registered users only — verify your email to see live returns and the full profile for every scheme on the platform.',
      function () { loadSchemes(); });
  }

  // window.MASession comes from lead-form.js, loaded earlier on the page.
  if (window.MASession && window.MASession.getToken()) {
    loadSchemes();
  } else if (window.MASession) {
    showGate();
  } else {
    host.remove(); // lead-form.js didn't load — fail closed rather than show a broken gate
  }
})();
