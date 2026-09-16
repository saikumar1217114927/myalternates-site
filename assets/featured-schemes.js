/* ==========================================================================
   myAlternates — featured schemes strip (real, unmasked examples)
   Renders below the masked performance band on a product page, driven by
   <section class="p-schemes" data-schemes="PMS">. Pulls 1-2 real schemes
   (with returns + full profile) from the backend — an admin curates which
   ones show up simply by running the "Performance" action for them in the
   admin portal's Scheme page. "Discover" opens the full stored record in a
   full-screen panel.
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
  function money(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  function retBlock(label, v) {
    var cls = v == null ? 'na' : (v >= 0 ? 'pos' : 'neg');
    return '<div class="sc-ret"><span>' + esc(label) + '</span><b class="' + cls + '">' + (v == null ? '–' : pct(v)) + '</b></div>';
  }

  function cardHtml(s, i) {
    var r = s.returns;
    return '<div class="scheme-card">' +
      '<div class="sc-head"><div><div class="sc-amc">' + esc(s.amcName || s.productName) + '</div>' +
      '<div class="sc-name">' + esc(s.schemeName) + '</div></div>' +
      '<span class="sc-badge">' + esc(s.productName) + '</span></div>' +
      '<div class="sc-returns">' + retBlock('1M', r.r1m) + retBlock('3M', r.r3m) + retBlock('1Y', r.r1y) + retBlock('SI', r.si) + '</div>' +
      '<div class="sc-foot"><span class="sc-asof">' + (s.asOf ? 'As of ' + esc(s.asOf) : '') + '</span>' +
      '<button type="button" class="sc-discover" data-discover="' + i + '">Discover →</button></div>' +
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
      '</div>' +
      '<div class="scm-page" id="scmPage"></div>';

    host.querySelectorAll('[data-discover]').forEach(function (btn) {
      btn.addEventListener('click', function () { openDetail(schemes[Number(btn.dataset.discover)]); });
    });
  }

  // ---- Discover panel ----
  function openDetail(s) {
    var page = document.getElementById('scmPage');
    page.innerHTML = detailHtml(s);
    page.classList.add('show');
    document.body.style.overflow = 'hidden';
    page.querySelector('.scm-close').addEventListener('click', closeDetail);
    var cta = page.querySelector('.scm-cta a');
    if (cta) cta.addEventListener('click', closeDetail);
    page.scrollTop = 0;
  }
  function closeDetail() {
    var page = document.getElementById('scmPage');
    if (!page) return;
    page.classList.remove('show');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();
  });

  var RET_COLS = [['1M', 'r1m'], ['3M', 'r3m'], ['6M', 'r6m'], ['1Y', 'r1y'], ['2Y', 'r2y'], ['3Y', 'r3y'], ['5Y', 'r5y'], ['10Y', 'r10y'], ['Since inception', 'si']];

  function perfSection(s) {
    function row(label, obj, cls) {
      return '<tr class="' + cls + '"><td>' + esc(label) + '</td>' +
        RET_COLS.map(function (c) {
          var v = obj[c[1]];
          return '<td class="' + (v == null ? 'na' : (v >= 0 ? 'pos' : 'neg')) + '">' + (v == null ? '–' : pct(v)) + '</td>';
        }).join('') + '</tr>';
    }
    return '<div class="scm-section"><h3>Trailing returns</h3>' +
      '<div class="scm-table-wrap"><table class="scm-perf-table"><thead><tr><th>Returns (ann.)</th>' +
      RET_COLS.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row(s.schemeName, s.returns, '') +
      (s.benchmark.name ? row(s.benchmark.name, s.benchmark, 'bench-row') : '') +
      '</tbody></table></div>' +
      (s.asOf ? '<p class="sc-asof" style="margin-top:10px;">As of ' + esc(s.asOf) + '</p>' : '') +
      '</div>';
  }

  function factsSection(p) {
    var facts = [];
    if (p.assetClass) facts.push(['Asset class', p.assetClass]);
    if (p.schemeType) facts.push(['Scheme type', p.schemeType]);
    if (p.fundManagers && p.fundManagers.length) facts.push(['Fund manager' + (p.fundManagers.length > 1 ? 's' : ''), p.fundManagers.join(', ')]);
    if (p.minInvestment) facts.push(['Minimum investment', money(p.minInvestment)]);
    if (p.minLockinMonths) facts.push(['Minimum lock-in', p.minLockinMonths + ' month' + (p.minLockinMonths > 1 ? 's' : '')]);
    if (p.exitLoad) facts.push(['Exit load', p.exitLoad]);
    if (p.feeStructure) facts.push(['Fee structure', p.feeStructure]);
    if (p.expenseRatio != null) facts.push(['Expense ratio', p.expenseRatio + '%']);
    if (!facts.length) return '';
    return '<div class="scm-section"><h3>Scheme profile</h3><div class="scm-facts">' +
      facts.map(function (f) { return '<div class="scm-fact"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') +
      '</div></div>';
  }

  function flagsSection(p) {
    var flags = [
      ['SIP', p.sipAvailable], ['STP', p.stpAvailable], ['SWP', p.swpAvailable],
      ['Purchase open', p.purchaseAvailable], ['Redemption open', p.redemptionAvailable]
    ];
    return '<div class="scm-section"><h3>Transactability</h3><div class="scm-flags">' +
      flags.map(function (f) { return '<span class="scm-flag ' + (f[1] ? 'on' : 'off') + '">' + (f[1] ? '✓' : '—') + ' ' + esc(f[0]) + '</span>'; }).join('') +
      '</div></div>';
  }

  function detailHtml(s) {
    var p = s.profile;
    return '<button type="button" class="scm-close" aria-label="Close">✕</button>' +
      '<div class="scm-hero"><div class="scm-hero-inner">' +
      '<div class="sc-amc">' + esc(s.amcName || s.productName) + '</div>' +
      '<h2>' + esc(s.schemeName) + (s.planOption ? ' <span style="color:var(--muted-light); font-weight:400;">— ' + esc(s.planOption) + '</span>' : '') + '</h2>' +
      '<div class="scm-hero-meta">' +
      (p.classification ? '<span><b>' + esc(p.classification) + '</b></span>' : '') +
      (p.inceptionDate ? '<span>Since <b>' + esc(p.inceptionDate) + '</b></span>' : '') +
      (p.aum != null ? '<span>AUM <b>' + money(p.aum) + ' ' + esc(p.aumScale || '') + '</b></span>' : '') +
      '</div></div></div>' +
      '<div class="scm-body">' +
      perfSection(s) +
      (p.objective ? '<div class="scm-section"><h3>Investment objective</h3><p class="scm-objective">' + esc(p.objective) + '</p></div>' : '') +
      factsSection(p) +
      flagsSection(p) +
      '<div class="scm-cta"><p>Want the full factsheet, minimums and onboarding steps for this scheme?</p>' +
      '<a href="#enquiry" class="btn-gold">Talk to an expert →</a></div>' +
      '<p class="scm-disclaimer">Data shown is sourced from Finalyca / scheme filings and may lag the live factsheet. Past performance is not indicative of future results and is not a guarantee. This is not investment advice — please read all scheme-related documents carefully before investing.</p>' +
      '</div>';
  }

  fetch(API_URL + '?action=getPublicFeaturedSchemes&productCode=' + encodeURIComponent(productCode))
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ok) renderCards(d.schemes || []); else host.remove(); })
    .catch(function () { host.remove(); });
})();
