/* ==========================================================================
   myAlternates — featured schemes: search + sidebar filters (sort, strategy,
   category, AUM) driving a card list. Renders on a product page, driven by
   <section class="p-schemes" data-schemes="PMS"> or data-schemes="AIF"> (the
   AIF page additionally gets a fixed All/Cat I/Cat II/Cat III tab row, since
   that's a regulatory taxonomy Finalyca's classification field carries, not
   a strategy tag). The list itself is open to everyone — up to 50 schemes an
   admin has run the Performance action for. Registration only happens when a
   visitor clicks "Explore": an
   already-registered visitor goes straight to scheme.html?id=<planId>; an
   anonymous one first fills the full registration form in a modal, then is
   taken there.
   ========================================================================== */
(function () {
  var host = document.querySelector('.p-schemes[data-schemes]');
  if (!host) return;

  var API_URL = 'https://myalternates-backend.onrender.com/';
  var productCode = host.dataset.schemes || 'PMS';
  var PRODUCT_LABEL = { PMS: 'PMS', AIF: 'AIF', GIFT_IFSC: 'GIFT City' }[productCode] || productCode;
  var PRODUCT_INTEREST = {
    PMS: 'Portfolio Management Services (PMS)',
    AIF: 'Alternative Investment Fund (AIF)',
    GIFT_IFSC: 'GIFT City products'
  }[productCode] || 'Portfolio Management Services (PMS)';

  var allSchemes = [];
  var state = { q: '', strategy: 'All', category: 'All', aum: 'All', aifCat: 'All', sortKey: 'r1y', sortDir: 'desc' };

  var AUM_BANDS = [
    { value: 'All', label: 'All' },
    { value: '0-100', label: 'Below ₹100 Cr' },
    { value: '100-500', label: '₹100 – 500 Cr' },
    { value: '500-1000', label: '₹500 – 1,000 Cr' },
    { value: '1000-999999999', label: 'Above ₹1,000 Cr' }
  ];
  var SORT_OPTIONS = [
    { value: 'r1y', label: '1 Year Return' },
    { value: 'r3y', label: '3 Year Return' },
    { value: 'r5y', label: '5 Year Return' },
    { value: 'si', label: 'Since Inception' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }

  // "Equity: Multi Cap" -> "Multi Cap"; falls back to the asset class, then
  // the product name, so a card always has something to tag itself with.
  function categoryLabel(s) {
    var p = s.profile || {};
    var c = String(p.classification || '').trim();
    if (c.indexOf(':') > -1) c = c.split(':').slice(1).join(':').trim();
    return c || p.assetClass || s.productName || '';
  }
  function strategyOf(s) { return (s.profile && s.profile.assetClass) || ''; }
  // AIF-only: Finalyca's classification for an AIF scheme leads with its
  // SEBI category, e.g. "CAT III - LONG SHORT" or "CAT II - VENTURE DEBT" —
  // pull just "I" / "II" / "III" out of that prefix. Checked longest-first
  // (III/II) since "CAT II" and "CAT III" both start with the same letters
  // as "CAT I".
  function aifCategoryOf(s) {
    var c = String((s.profile && s.profile.classification) || '').trim();
    var m = /^CAT\s+(III|II|I)\b/i.exec(c);
    return m ? m[1].toUpperCase() : '';
  }
  function aumOf(s) { return (s.profile && s.profile.aum != null) ? Number(s.profile.aum) : null; }
  function fmtAum(s) {
    var v = aumOf(s);
    if (v == null) return '–';
    return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: v < 100 ? 2 : 0 }) + ' Cr';
  }
  function fmtInception(s) {
    var d = s.profile && s.profile.inceptionDate;
    if (!d) return '–';
    var dt = new Date(String(d));
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function retCol(label, v) {
    var cls = v == null ? 'na' : (v >= 0 ? 'pos' : 'neg');
    return '<div class="sr-ret"><b class="' + cls + '">' + (v == null ? 'NA' : pct(v)) + '</b><span>' + esc(label) + '</span></div>';
  }

  function rowHtml(s) {
    var r = s.returns || {};
    var logo = s.amcLogo
      ? '<img class="sr-logo" src="' + esc(s.amcLogo) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;sr-logo-fallback&quot;>' + esc((s.amcName || '?').charAt(0)) + '</div>\'">'
      : '<div class="sr-logo-fallback">' + esc((s.amcName || s.productName || '?').charAt(0)) + '</div>';
    var cat = categoryLabel(s);
    var strategy = strategyOf(s);
    return '<div class="scheme-row' + (s.featured ? ' featured' : '') + '">' +
      '<div class="sr-id">' + logo +
      '<div class="sr-id-text">' +
      '<div class="sr-toprow"><span class="sc-amc">' + esc(s.amcName || s.productName) + '</span></div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div>' +
      (cat ? '<div class="sr-tags"><span class="sr-tag">' + esc(cat) + '</span></div>' : '') +
      '<div class="sr-meta">' +
      '<span>Inception <b>' + esc(fmtInception(s)) + '</b></span>' +
      (strategy ? '<span>Strategy <b>' + esc(strategy) + '</b></span>' : '') +
      '<span>AUM <b>' + esc(fmtAum(s)) + '</b></span>' +
      '</div>' +
      '</div></div>' +
      '<div class="sr-rets">' + retCol('1Y', r.r1y) + retCol('3Y', r.r3y) + retCol('5Y', r.r5y) + retCol('SI', r.si) + '</div>' +
      '<div class="sr-actions"><button type="button" class="sc-discover" data-discover="' + esc(s.planId) + '">Discover →</button></div>' +
      '</div>';
  }

  function applyFilters() {
    var q = state.q.trim().toLowerCase();
    var list = allSchemes.filter(function (s) {
      if (q) {
        var hay = ((s.amcName || '') + ' ' + (s.schemeName || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (state.strategy !== 'All' && strategyOf(s) !== state.strategy) return false;
      if (state.category !== 'All' && categoryLabel(s) !== state.category) return false;
      if (productCode === 'AIF' && state.aifCat !== 'All' && aifCategoryOf(s) !== state.aifCat) return false;
      if (state.aum !== 'All') {
        var band = state.aum.split('-');
        var lo = Number(band[0]), hi = Number(band[1]);
        var v = aumOf(s);
        if (v == null || v < lo || v > hi) return false;
      }
      return true;
    });
    // Featured picks always lead, in their admin-assigned position (1, 2,
    // 3...) — the sort/search/filter controls only reorder the rest below
    // them, never bump a featured scheme out of its slot.
    list.sort(function (a, b) {
      var af = Number(a.featured) || 0, bf = Number(b.featured) || 0;
      if (af > 0 || bf > 0) {
        if (af > 0 && bf > 0) return af - bf;
        return af > 0 ? -1 : 1;
      }
      var av = (a.returns && a.returns[state.sortKey]), bv = (b.returns && b.returns[state.sortKey]);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return state.sortDir === 'desc' ? bv - av : av - bv;
    });
    renderRows(list);
  }

  function renderRows(list) {
    var listEl = host.querySelector('.scheme-list');
    var emptyEl = host.querySelector('.ps-empty');
    if (!listEl) return;
    listEl.innerHTML = list.map(rowHtml).join('');
    emptyEl.hidden = list.length > 0;
    listEl.querySelectorAll('[data-discover]').forEach(function (btn) {
      btn.onclick = function () { goToScheme(btn.dataset.discover); };
    });
  }

  function uniqueSorted(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    out.sort();
    return out;
  }

  function sidebarHtml() {
    var strategies = uniqueSorted(allSchemes.map(strategyOf));
    var categories = uniqueSorted(allSchemes.map(categoryLabel));
    return '<aside class="p-schemes-sidebar">' +
      '<div class="ps-search">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6.5"/><line x1="18" y1="18" x2="13.6" y2="13.6"/></svg>' +
      '<input type="search" id="pssSearch" placeholder="Search by scheme or AMC name" aria-label="Search schemes">' +
      '</div>' +
      '<div class="pss-group">' +
      '<label>Sort by</label>' +
      '<select id="pssSort">' + SORT_OPTIONS.map(function (o) { return '<option value="' + o.value + '">' + esc(o.label) + '</option>'; }).join('') + '</select>' +
      '<div class="pss-dir">' +
      '<button type="button" class="pss-dir-btn active" data-dir="desc">High to Low</button>' +
      '<button type="button" class="pss-dir-btn" data-dir="asc">Low to High</button>' +
      '</div></div>' +
      '<div class="pss-group">' +
      '<label>Strategy</label>' +
      '<div class="pss-pills" id="pssStrategy">' +
      '<button type="button" class="pss-pill active" data-val="All">All</button>' +
      strategies.map(function (s) { return '<button type="button" class="pss-pill" data-val="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="pss-group">' +
      '<label>Category</label>' +
      '<select id="pssCategory"><option value="All">All Category</option>' +
      categories.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="pss-group">' +
      '<label>AUM (in Cr)</label>' +
      '<select id="pssAum">' + AUM_BANDS.map(function (b) { return '<option value="' + esc(b.value) + '">' + esc(b.label) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<button type="button" class="pss-clear" id="pssClear">Clear filters</button>' +
      '</aside>';
  }

  function wireSidebar() {
    host.querySelectorAll('.ps-cat-tab').forEach(function (btn) {
      btn.onclick = function () {
        host.querySelectorAll('.ps-cat-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.aifCat = btn.dataset.cat;
        applyFilters();
      };
    });

    var searchInput = host.querySelector('#pssSearch');
    searchInput.addEventListener('input', function () { state.q = searchInput.value; applyFilters(); });

    var sortSel = host.querySelector('#pssSort');
    sortSel.addEventListener('change', function () { state.sortKey = sortSel.value; applyFilters(); });

    host.querySelectorAll('.pss-dir-btn').forEach(function (btn) {
      btn.onclick = function () {
        host.querySelectorAll('.pss-dir-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.sortDir = btn.dataset.dir;
        applyFilters();
      };
    });

    host.querySelectorAll('.pss-pill').forEach(function (btn) {
      btn.onclick = function () {
        host.querySelectorAll('.pss-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.strategy = btn.dataset.val;
        applyFilters();
      };
    });

    var catSel = host.querySelector('#pssCategory');
    catSel.addEventListener('change', function () { state.category = catSel.value; applyFilters(); });

    var aumSel = host.querySelector('#pssAum');
    aumSel.addEventListener('change', function () { state.aum = aumSel.value; applyFilters(); });

    host.querySelector('#pssClear').onclick = function () {
      state = { q: '', strategy: 'All', category: 'All', aum: 'All', aifCat: 'All', sortKey: 'r1y', sortDir: 'desc' };
      searchInput.value = ''; sortSel.value = 'r1y'; catSel.value = 'All'; aumSel.value = 'All';
      host.querySelectorAll('.pss-dir-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.dir === 'desc'); });
      host.querySelectorAll('.pss-pill').forEach(function (b) { b.classList.toggle('active', b.dataset.val === 'All'); });
      host.querySelectorAll('.ps-cat-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.cat === 'All'); });
      applyFilters();
    };
  }

  // AIF-only tab row (All / Category I / II / III) sitting above the
  // sidebar+list — a fixed, regulatory taxonomy, so all three tabs always
  // show regardless of how many synced schemes currently fall into each.
  function catTabsHtml() {
    if (productCode !== 'AIF') return '';
    var tabs = [['All', 'All AIF'], ['I', 'Category I'], ['II', 'Category II'], ['III', 'Category III']];
    return '<div class="ps-cat-tabs" id="psCatTabs">' +
      tabs.map(function (t) {
        return '<button type="button" class="ps-cat-tab' + (t[0] === 'All' ? ' active' : '') + '" data-cat="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
      }).join('') +
      '</div>';
  }

  function renderList(schemes) {
    if (!schemes.length) { host.remove(); return; } // nothing curated yet — don't show an empty section
    allSchemes = schemes;
    host.innerHTML =
      '<div class="wrap">' +
      '<div class="p-schemes-head">' +
      '<div class="section-head">' +
      '<div class="section-tag">Live on the platform</div>' +
      '<h2>Explore ' + esc(PRODUCT_LABEL) + ' Schemes</h2>' +
      '</div>' +
      '</div>' +
      catTabsHtml() +
      '<div class="p-schemes-body">' +
      sidebarHtml() +
      '<div class="p-schemes-list">' +
      '<div class="scheme-list"></div>' +
      '<p class="ps-empty" hidden>No schemes match your filters.</p>' +
      '<p class="disc">Returns are trailing, annualised beyond one year, as of the date shown. Past performance is not indicative of future results — data sourced from Finalyca / scheme filings.</p>' +
      '</div>' +
      '</div>' +
      '</div>';
    wireSidebar();
    applyFilters();
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
      interest: PRODUCT_INTEREST,
      onVerified: function () { location.href = 'scheme?id=' + encodeURIComponent(planId); }
    });
  }

  function loadSchemes() {
    fetch(API_URL + '?action=getPublicFeaturedSchemes&productCode=' + encodeURIComponent(productCode) + '&limit=50')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) renderList(d.schemes || []); else host.remove(); })
      .catch(function () { host.remove(); });
  }

  loadSchemes();
})();
