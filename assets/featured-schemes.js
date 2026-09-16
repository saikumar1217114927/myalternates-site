/* ==========================================================================
   myAlternates — featured schemes strip (real, unmasked examples)
   Renders on a product page, driven by <section class="p-schemes"
   data-schemes="PMS">. Pulls 1-2 real schemes (with returns) from the
   backend — an admin curates which ones show up simply by running the
   "Performance" action for them in the admin portal's Scheme page.
   "Discover" links to scheme.html?id=<planId>, its own shareable page.
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
    return '<div class="sc-ret"><span>' + esc(label) + '</span><b class="' + cls + '">' + (v == null ? '–' : pct(v)) + '</b></div>';
  }

  function cardHtml(s) {
    var r = s.returns;
    return '<div class="scheme-card">' +
      '<div class="sc-head"><div><div class="sc-amc">' + esc(s.amcName || s.productName) + '</div>' +
      '<div class="sc-name">' + esc(s.schemeName) + '</div></div>' +
      '<span class="sc-badge">' + esc(s.productName) + '</span></div>' +
      '<div class="sc-returns">' + retBlock('1M', r.r1m) + retBlock('3M', r.r3m) + retBlock('1Y', r.r1y) + retBlock('SI', r.si) + '</div>' +
      '<div class="sc-foot"><span class="sc-asof">' + (s.asOf ? 'As of ' + esc(s.asOf) : '') + '</span>' +
      '<a class="sc-discover" href="scheme?id=' + encodeURIComponent(s.planId) + '">Discover →</a></div>' +
      '</div>';
  }

  function renderCards(schemes) {
    if (!schemes.length) { host.remove(); return; } // nothing curated yet — don't show an empty section
    host.innerHTML =
      '<div class="wrap">' +
      '<div class="section-head"><div><div class="section-tag">Real examples</div><h2>A closer look at schemes on the platform</h2></div>' +
      '<p>Unmasked names, live return data and the full scheme profile — no factsheet request needed.</p></div>' +
      '<div class="scheme-grid">' + schemes.map(cardHtml).join('') + '</div>' +
      '<p class="disc">Returns are trailing, annualised beyond one year, as of the date shown. Past performance is not indicative of future results — data sourced from Finalyca / scheme filings.</p>' +
      '</div>';
  }

  fetch(API_URL + '?action=getPublicFeaturedSchemes&productCode=' + encodeURIComponent(productCode))
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ok) renderCards(d.schemes || []); else host.remove(); })
    .catch(function () { host.remove(); });
})();
