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
  // An extra, product-specific link next to the Talk to an Expert / Reschedule
  // button in the schemes header — only PMS has one today.
  var PRODUCT_EXTRA_LINK = {
    PMS: { href: 'pms-fees', label: 'PMS fee calculator' }
  }[productCode] || null;
  // PMS, AIF and GIFT City have all had their hero removed in favor of this
  // header CTA — SIF still has its own intact hero with this same button.
  var SHOW_HEADER_CTA = productCode === 'PMS' || productCode === 'AIF' || productCode === 'GIFT_IFSC';
  // Cross-product switcher — replaces the old static "Live on the platform"
  // eyebrow tag with links to the other two product pages, so a visitor
  // browsing PMS schemes can jump straight to AIF/GIFT City without going
  // back through the nav.
  var OTHER_PRODUCTS = {
    PMS: [['aif', 'AIF'], ['gift-city', 'GIFT City']],
    AIF: [['pms', 'PMS'], ['gift-city', 'GIFT City']],
    GIFT_IFSC: [['pms', 'PMS'], ['aif', 'AIF']]
  }[productCode] || null;

  var allSchemes = [];
  var state = {
    q: '', strategy: 'All', category: 'All', aum: 'All', aifCat: 'All', sortKey: 'r1y', sortDir: 'desc',
    // Cat I/II fund-terms filter panel only:
    asset: 'All', targetMin: 0, targetMax: null, tenureMin: 0, tenureMax: null
  };

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
  // Slider ceilings for the Cat I/II fund-terms filter panel — fixed, not
  // data-derived, so the scale stays stable as new funds sync in.
  var TARGET_SIZE_MAX = { I: 5000, II: 10000 };
  var TENURE_MAX = 15;

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
    // A Cat I/II AIF's own sub-category ("Private Credit", "Venture Capital")
    // is far more useful in the sidebar dropdown than its raw classification
    // string ("CAT II - PRIVATE CREDIT").
    if (p.subCategory) return p.subCategory;
    var c = String(p.classification || '').trim();
    if (c.indexOf(':') > -1) c = c.split(':').slice(1).join(':').trim();
    return c || p.assetClass || s.productName || '';
  }
  function strategyOf(s) { return (s.profile && s.profile.assetClass) || ''; }
  // AIF-only: prefer the structured category Finalyca nests under
  // alternate_scheme_details (only present for Cat I/II — see
  // publicSchemeView) since the free-text classification field is
  // occasionally mislabeled (a real scheme_category:"II" has been seen next
  // to classification "CAT III - Private Equity"). Fall back to parsing the
  // classification text's "CAT I/II/III" prefix for anything that field
  // doesn't cover (checked longest-first since "CAT II"/"CAT III" both start
  // like "CAT I").
  function aifCategoryOf(s) {
    var direct = String((s.profile && s.profile.aifCategory) || '').trim().toUpperCase();
    if (direct) return direct;
    var c = String((s.profile && s.profile.classification) || '').trim();
    var m = /^CAT\s+(III|II|I)\b/i.exec(c);
    return m ? m[1].toUpperCase() : '';
  }
  // Category I/II AIFs are close-ended, drawdown-structured funds that can
  // still be raising with no performance history at all — they get a
  // fund-terms card (target size, tenure, commitment, drawdown, closing)
  // instead of the usual returns row.
  function isFundTermsScheme(s) {
    var cat = aifCategoryOf(s);
    return cat === 'I' || cat === 'II';
  }
  // Whether the *page* is currently scoped to a single fund-terms category
  // (the Cat I or Cat II tab) — as opposed to "All <product>"/"Cat III",
  // which can mix in returns-tracked schemes and keep the standard filter
  // panel. GIFT_IFSC carries the exact same scheme_category shape as AIF —
  // Finalyca isn't AIF-specific about this taxonomy, so the site shouldn't
  // be either.
  var FUND_TERMS_PRODUCTS = { AIF: 1, GIFT_IFSC: 1 };
  function isFundTermsMode() {
    return !!FUND_TERMS_PRODUCTS[productCode] && (state.aifCat === 'I' || state.aifCat === 'II');
  }
  // Fund-terms amounts come back as an absolute figure in the fund's own
  // currency (Finalyca's own scheme_currency_scale for these is "absolute",
  // never "Cr"/"lakh") — an onshore AIF is INR, but a GIFT City Cat I/II
  // fund is commonly USD (a real target_amount of 270000000 there means
  // $270M, not "27 Cr").
  function amountUnit(currency) { return (!currency || currency === 'INR') ? 'Cr' : ((currency === 'USD' ? '$' : currency) + 'M'); }
  function amountValue(v, currency) {
    if (v == null) return null;
    return Math.round(v / ((!currency || currency === 'INR') ? 1e7 : 1e6));
  }
  function fmtAmount(v, currency) {
    if (v == null) return null;
    if (currency && currency !== 'INR') {
      var sym = currency === 'USD' ? '$' : currency + ' ';
      if (v >= 1e6) return sym + (Math.round(v / 1e5) / 10).toLocaleString('en-IN') + 'M';
      if (v >= 1e3) return sym + Math.round(v / 1e3).toLocaleString('en-IN') + 'K';
      return sym + Math.round(v).toLocaleString('en-IN');
    }
    return Math.round(v / 1e7).toLocaleString('en-IN') + ' Cr';
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

  // Category I/II AIF — fundraising terms instead of trailing returns (see
  // isFundTermsScheme above).
  function fundCardHtml(s) {
    var p = s.profile || {};
    var logo = s.amcLogo
      ? '<img class="sr-logo" src="' + esc(s.amcLogo) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;sr-logo-fallback&quot;>' + esc((s.amcName || '?').charAt(0)) + '</div>\'">'
      : '<div class="sr-logo-fallback">' + esc((s.amcName || s.productName || '?').charAt(0)) + '</div>';
    var tags = [];
    if (p.subCategory) tags.push('<span class="ft-tag ft-tag-cat">' + esc(p.subCategory) + '</span>');
    if (p.tenureYears != null) {
      tags.push('<span class="ft-tag ft-tag-tenure">Fund Tenure: ' + p.tenureYears + ' Year' + (p.tenureYears > 1 ? 's' : '') +
        ' <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.6V8l2.3 1.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></span>');
    }
    var currency = p.currency || 'INR';
    var target = p.targetAmount != null ? fmtAmount(p.targetAmount, currency) : null;
    var commitment = p.minCommitment != null ? fmtAmount(p.minCommitment, currency) : null;
    var targetLabel = 'Fund target size' + (currency === 'INR' ? ' (in Cr)' : '');
    var closing = p.finalClosingDate || p.finalClosingRemarks || 'To be determined';
    return '<div class="scheme-row fund-terms' + (s.featured ? ' featured' : '') + '">' +
      '<div class="sr-id">' + logo +
      '<div class="sr-id-text">' +
      '<div class="sr-toprow"><span class="sc-amc">' + esc(s.amcName || s.productName) + '</span></div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div>' +
      (tags.length ? '<div class="sr-tags ft-tags">' + tags.join('') + '</div>' : '') +
      '</div></div>' +
      '<div class="ft-meta">' +
      '<div class="ft-meta-col">' +
      (target != null ? '<div class="ft-line"><span>' + esc(targetLabel) + '</span><b>' + esc(target) + '</b></div>' : '') +
      (p.drawdownPercent != null ? '<div class="ft-line"><span>Initial drawdown</span><b>' + p.drawdownPercent + '%</b></div>' : '') +
      '</div>' +
      '<div class="ft-meta-col">' +
      (commitment != null ? '<div class="ft-line"><span>Min. commitment</span><b>' + esc(commitment) + '</b></div>' : '') +
      '<div class="ft-line"><span>Tentative final closing</span><b>' + esc(closing) + '</b></div>' +
      '</div>' +
      '</div>' +
      '<div class="sr-actions"><button type="button" class="sc-discover" data-discover="' + esc(s.planId) + '">Explore →</button></div>' +
      '</div>';
  }

  function applyFilters() {
    var ftMode = isFundTermsMode();
    var q = state.q.trim().toLowerCase();
    var list = allSchemes.filter(function (s) {
      if (q) {
        var hay = ((s.amcName || '') + ' ' + (s.schemeName || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (FUND_TERMS_PRODUCTS[productCode] && state.aifCat !== 'All' && aifCategoryOf(s) !== state.aifCat) return false;
      if (ftMode) {
        var p = s.profile || {};
        if (state.asset !== 'All' && (p.subCategory || '') !== state.asset) return false;
        var target = amountValue(p.targetAmount, p.currency);
        if (target == null || target < state.targetMin || target > state.targetMax) return false;
        var tenure = p.tenureYears;
        if (tenure == null || tenure < state.tenureMin || tenure > state.tenureMax) return false;
        return true;
      }
      if (state.strategy !== 'All' && strategyOf(s) !== state.strategy) return false;
      if (state.category !== 'All' && categoryLabel(s) !== state.category) return false;
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
      // Fund-terms mode has no return-based sort control — keep the
      // backend's own order (most-recently-synced first).
      if (ftMode) return 0;
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
    listEl.innerHTML = list.map(function (s) { return isFundTermsScheme(s) ? fundCardHtml(s) : rowHtml(s); }).join('');
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

  // The aside is a fixed shell (search box + a filter-panel slot); which
  // panel goes in that slot — the standard sort/strategy/category/AUM one,
  // or the Cat I/II range-slider one — is decided by renderFilterPanel,
  // called on load and again whenever the AIF category tab changes, so
  // switching to Cat I/II swaps the whole panel rather than just hiding a
  // couple of fields in it.
  function sidebarHtml() {
    return '<aside class="p-schemes-sidebar">' +
      '<div class="ps-search">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6.5"/><line x1="18" y1="18" x2="13.6" y2="13.6"/></svg>' +
      '<input type="search" id="pssSearch" placeholder="Search by scheme or AMC name" aria-label="Search schemes">' +
      '</div>' +
      '<div id="pssFilterPanel"></div>' +
      '</aside>';
  }

  function standardFilterPanelHtml() {
    // Scope the dropdown options to whichever category tab is active —
    // otherwise "Cat III" still offers every Cat I/II sub-category too, most
    // with zero matching schemes once that tab's own filter is applied.
    var scoped = (FUND_TERMS_PRODUCTS[productCode] && state.aifCat !== 'All')
      ? allSchemes.filter(function (s) { return aifCategoryOf(s) === state.aifCat; })
      : allSchemes;
    var strategies = uniqueSorted(scoped.map(strategyOf));
    var categories = uniqueSorted(scoped.map(categoryLabel));
    return '<div class="pss-group">' +
      '<label>Sort by</label>' +
      '<select id="pssSort">' + SORT_OPTIONS.map(function (o) { return '<option value="' + o.value + '"' + (o.value === state.sortKey ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select>' +
      '<div class="pss-dir">' +
      '<button type="button" class="pss-dir-btn' + (state.sortDir === 'desc' ? ' active' : '') + '" data-dir="desc">High to Low</button>' +
      '<button type="button" class="pss-dir-btn' + (state.sortDir === 'asc' ? ' active' : '') + '" data-dir="asc">Low to High</button>' +
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
      '<button type="button" class="pss-clear" id="pssClear">Clear filters</button>';
  }

  function rangeGroupHtml(id, label, unit, min, max, lo, hi) {
    return '<div class="pss-group pss-range-group" id="' + id + '">' +
      '<label>' + esc(label) + (unit ? ' (' + esc(unit) + ')' : '') + '</label>' +
      '<div class="pss-range-track"><div class="pss-range-fill"></div>' +
      '<input type="range" class="pss-range-min" min="' + min + '" max="' + max + '" value="' + lo + '">' +
      '<input type="range" class="pss-range-max" min="' + min + '" max="' + max + '" value="' + hi + '">' +
      '</div>' +
      '<div class="pss-range-inputs">' +
      '<input type="number" class="pss-range-num-min" min="' + min + '" max="' + max + '" value="' + lo + '">' +
      '<input type="number" class="pss-range-num-max" min="' + min + '" max="' + max + '" value="' + hi + '">' +
      '</div></div>';
  }

  // The Cat I/II AIF reference design's target-size ceilings (5000/10000
  // Cr) are pixel-matched to that pmsbazaar layout and stay fixed for AIF.
  // Any other fund-terms product (GIFT_IFSC) has no such reference and its
  // own currency scale (commonly USD, not INR) — its ceiling is derived
  // from the actual data instead, rounded up to a clean step.
  function targetSizeMaxFor(cat, currency, schemes) {
    if (productCode === 'AIF') return TARGET_SIZE_MAX[cat] || 5000;
    var vals = schemes.filter(function (s) { return aifCategoryOf(s) === cat; })
      .map(function (s) { return amountValue((s.profile || {}).targetAmount, (s.profile || {}).currency); })
      .filter(function (v) { return v != null; });
    var max = vals.length ? Math.max.apply(null, vals) : 0;
    var step = max > 1000 ? 100 : max > 100 ? 50 : 10;
    return Math.max(step, Math.ceil((max * 1.1) / step) * step);
  }
  function currencyForCat(cat, schemes) {
    var match = schemes.filter(function (s) { return aifCategoryOf(s) === cat; })[0];
    return (match && match.profile && match.profile.currency) || 'INR';
  }

  // Cat I/II only — every scheme in this view is a fund-terms card (see
  // isFundTermsScheme), so "Sort by return"/"AUM" have nothing to act on;
  // this replaces them with the fields that actually apply to a
  // still-fundraising, drawdown-structured fund.
  function fundTermsFilterPanelHtml(schemes) {
    var cat = state.aifCat;
    var currency = currencyForCat(cat, schemes);
    var targetMax = targetSizeMaxFor(cat, currency, schemes);
    var tenureMax = TENURE_MAX;
    if (state.targetMax == null || state.tenureMax == null) {
      state.targetMax = targetMax; state.tenureMax = tenureMax;
    }
    var assets = uniqueSorted(schemes.filter(function (s) { return aifCategoryOf(s) === cat; }).map(function (s) { return (s.profile && s.profile.subCategory) || ''; }));
    return '<div class="pss-ft-head"><span>Filter</span><button type="button" class="pss-ft-clear" id="pssFtClear">Clear</button></div>' +
      '<div class="pss-group">' +
      '<label>Asset</label>' +
      '<select id="pssAsset"><option value="All">All</option>' +
      assets.map(function (a) { return '<option value="' + esc(a) + '"' + (a === state.asset ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') +
      '</select></div>' +
      rangeGroupHtml('pssTargetGroup', 'Fund Target Size', 'in ' + amountUnit(currency), 0, targetMax, state.targetMin, state.targetMax) +
      rangeGroupHtml('pssTenureGroup', 'Fund Tenure', 'in Years', 0, tenureMax, state.tenureMin, state.tenureMax);
  }

  function wireRangeSlider(groupEl, onChange) {
    var minR = groupEl.querySelector('.pss-range-min');
    var maxR = groupEl.querySelector('.pss-range-max');
    var minN = groupEl.querySelector('.pss-range-num-min');
    var maxN = groupEl.querySelector('.pss-range-num-max');
    var fill = groupEl.querySelector('.pss-range-fill');
    var bound = Number(minR.max);
    function paint() {
      var lo = Number(minR.value), hi = Number(maxR.value);
      fill.style.left = (bound ? lo / bound * 100 : 0) + '%';
      fill.style.right = (bound ? 100 - hi / bound * 100 : 0) + '%';
    }
    function commit(lo, hi) {
      minR.value = lo; maxR.value = hi; minN.value = lo; maxN.value = hi;
      paint();
      onChange(lo, hi);
    }
    minR.addEventListener('input', function () {
      var lo = Number(minR.value), hi = Number(maxR.value);
      if (lo > hi) hi = lo;
      commit(lo, hi);
    });
    maxR.addEventListener('input', function () {
      var lo = Number(minR.value), hi = Number(maxR.value);
      if (hi < lo) lo = hi;
      commit(lo, hi);
    });
    minN.addEventListener('change', function () {
      var lo = Math.min(Math.max(Number(minN.value) || 0, 0), Number(maxR.value));
      commit(lo, Number(maxR.value));
    });
    maxN.addEventListener('change', function () {
      var hi = Math.max(Math.min(Number(maxN.value) || bound, bound), Number(minR.value));
      commit(Number(minR.value), hi);
    });
    paint();
  }

  // Backend search for this product, beyond whatever's already loaded — the
  // list itself only ever holds the top ~50 (sorted by how recently each
  // scheme's performance was synced), so a real match further down that
  // order wouldn't otherwise show up just because the sidebar box filters
  // client-side. Merges any newly-found schemes into allSchemes (never
  // removes any) and re-applies the current filters.
  function expandSearch(term) {
    var url = API_URL + '?action=getPublicFeaturedSchemes&productCode=' + encodeURIComponent(productCode) +
      '&q=' + encodeURIComponent(term) + '&limit=100';
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) return;
      var input = host.querySelector('#pssSearch');
      if (!input || input.value.trim() !== term) return; // stale — a newer keystroke has moved on
      var known = {};
      allSchemes.forEach(function (s) { known[s.planId] = true; });
      var added = false;
      (d.schemes || []).forEach(function (s) {
        if (!known[s.planId]) { allSchemes.push(s); known[s.planId] = true; added = true; }
      });
      if (added) applyFilters();
    }).catch(function () {});
  }

  // Swaps in the right filter panel for the current tab (standard vs.
  // fund-terms) and wires whichever one just went in. Called on load and
  // again on every AIF category tab click.
  function renderFilterPanel() {
    var panel = host.querySelector('#pssFilterPanel');
    if (!panel) return;
    if (isFundTermsMode()) {
      panel.innerHTML = fundTermsFilterPanelHtml(allSchemes);
      wireFundTermsFilterPanel(panel);
    } else {
      panel.innerHTML = standardFilterPanelHtml();
      wireStandardFilterPanel(panel);
    }
  }

  function wireStandardFilterPanel(panel) {
    var sortSel = panel.querySelector('#pssSort');
    sortSel.addEventListener('change', function () { state.sortKey = sortSel.value; applyFilters(); });

    panel.querySelectorAll('.pss-dir-btn').forEach(function (btn) {
      btn.onclick = function () {
        panel.querySelectorAll('.pss-dir-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.sortDir = btn.dataset.dir;
        applyFilters();
      };
    });

    panel.querySelectorAll('.pss-pill').forEach(function (btn) {
      btn.onclick = function () {
        panel.querySelectorAll('.pss-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.strategy = btn.dataset.val;
        applyFilters();
      };
    });

    var catSel = panel.querySelector('#pssCategory');
    catSel.addEventListener('change', function () { state.category = catSel.value; applyFilters(); });

    var aumSel = panel.querySelector('#pssAum');
    aumSel.addEventListener('change', function () { state.aum = aumSel.value; applyFilters(); });

    panel.querySelector('#pssClear').onclick = function () {
      state.strategy = 'All'; state.category = 'All'; state.aum = 'All';
      state.sortKey = 'r1y'; state.sortDir = 'desc';
      var searchInput = host.querySelector('#pssSearch');
      state.q = ''; searchInput.value = '';
      renderFilterPanel();
      applyFilters();
    };
  }

  function wireFundTermsFilterPanel(panel) {
    var assetSel = panel.querySelector('#pssAsset');
    assetSel.addEventListener('change', function () { state.asset = assetSel.value; applyFilters(); });

    wireRangeSlider(panel.querySelector('#pssTargetGroup'), function (lo, hi) {
      state.targetMin = lo; state.targetMax = hi; applyFilters();
    });
    wireRangeSlider(panel.querySelector('#pssTenureGroup'), function (lo, hi) {
      state.tenureMin = lo; state.tenureMax = hi; applyFilters();
    });

    panel.querySelector('#pssFtClear').onclick = function () {
      state.asset = 'All';
      // Left null — fundTermsFilterPanelHtml (called right after via
      // renderFilterPanel) recomputes the right ceiling for whichever
      // category/currency is now active (targetSizeMaxFor).
      state.targetMin = 0; state.targetMax = null;
      state.tenureMin = 0; state.tenureMax = TENURE_MAX;
      var searchInput = host.querySelector('#pssSearch');
      state.q = ''; searchInput.value = '';
      renderFilterPanel();
      applyFilters();
    };
  }

  function wireSidebar() {
    host.querySelectorAll('.ps-cat-tab').forEach(function (btn) {
      btn.onclick = function () {
        if (btn.dataset.cat === state.aifCat) return; // already on this tab
        host.querySelectorAll('.ps-cat-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.aifCat = btn.dataset.cat;
        // Cat I and Cat II have different target-size ceilings — reset the
        // fund-terms range filters (if leaving them set, a Cat II value like
        // 8000 would silently clip out of Cat I's 0–5000 scale). Left null —
        // fundTermsFilterPanelHtml recomputes the right ceiling below.
        state.asset = 'All';
        state.targetMin = 0; state.targetMax = null;
        state.tenureMin = 0; state.tenureMax = TENURE_MAX;
        renderFilterPanel();
        applyFilters();
      };
    });
    renderFilterPanel();

    var searchInput = host.querySelector('#pssSearch');
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value; applyFilters(); // instant: filters whatever's already loaded
      // Then widen beyond that — a scheme can rank outside the normal
      // top-N (sorted by how recently its performance was synced) and
      // still be a real, valid match the visitor is looking for.
      var term = searchInput.value.trim();
      clearTimeout(searchTimer);
      if (term.length >= 2) searchTimer = setTimeout(function () { expandSearch(term); }, 300);
    });
  }

  // Tab row (All / Category I / II / III) sitting above the sidebar+list —
  // a fixed, regulatory taxonomy Finalyca applies identically to AIF and
  // GIFT_IFSC's own Cat I/II/III schemes (PMS has no such taxonomy), so all
  // three tabs always show regardless of how many synced schemes currently
  // fall into each.
  function catTabsHtml() {
    if (!FUND_TERMS_PRODUCTS[productCode]) return '';
    var tabs = [['All', 'All ' + PRODUCT_LABEL], ['I', 'Category I'], ['II', 'Category II'], ['III', 'Category III']];
    return '<div class="ps-cat-tabs" id="psCatTabs">' +
      tabs.map(function (t) {
        return '<button type="button" class="ps-cat-tab' + (t[0] === 'All' ? ' active' : '') + '" data-cat="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
      }).join('') +
      '</div>';
  }

  function crossProductHtml() {
    if (!OTHER_PRODUCTS) return '';
    return '<div class="p-cross-switch">' +
      '<span class="p-cross-label">Also on myAlternates</span>' +
      OTHER_PRODUCTS.map(function (o) {
        return '<a href="' + esc(o[0]) + '" class="p-cross-btn">' + esc(o[1]) +
          ' <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
      }).join('') +
      '</div>';
  }

  function renderList(schemes) {
    if (!schemes.length) { host.remove(); return; } // nothing curated yet — don't show an empty section
    allSchemes = schemes;
    // The hero's old CTA row (Talk to an expert/Reschedule + a product-
    // specific extra link) and the "your call is scheduled" pieces
    // (#heroMeetingWhen / #heroMeetingAdd, either side of the button) both
    // live here now, opposite the heading, instead of in a separate hero
    // section — session-gate.js/hero-meeting.js only wire this new
    // data-ma-talk button and query the DOM for those two ids once we tell
    // them this section actually exists, since it all renders async (after
    // this section's own schemes fetch) and would otherwise find nothing if
    // they looked on script load.
    host.innerHTML =
      '<div class="wrap">' +
      '<div class="p-schemes-head">' +
      '<div class="section-head">' +
      crossProductHtml() +
      '<h2>Explore ' + esc(PRODUCT_LABEL) + ' Schemes</h2>' +
      '</div>' +
      // PMS-only: it's the one page with no separate hero any more (that CTA
      // row moved here). Other products still have their own intact hero
      // with this same button — adding it here too would just duplicate it.
      (SHOW_HEADER_CTA ?
        '<div class="p-schemes-cta">' +
        '<span id="heroMeetingWhen"></span>' +
        '<div class="p-schemes-cta-row">' +
        '<a href="#" class="btn-gold" data-ma-talk="' + esc(PRODUCT_INTEREST) + '">Talk to an expert →</a>' +
        (PRODUCT_EXTRA_LINK ? '<a href="' + esc(PRODUCT_EXTRA_LINK.href) + '" class="btn-ghost btn-ghost-sm">' + esc(PRODUCT_EXTRA_LINK.label) + '</a>' : '') +
        '</div>' +
        '<span id="heroMeetingAdd"></span>' +
        '</div>'
        : '') +
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
    if (window.maWireTalkToExpertLinks) window.maWireTalkToExpertLinks();
    if (window.maInitHeroMeetingInfo) window.maInitHeroMeetingInfo(PRODUCT_INTEREST);
    updateStickyOffsets();
    // The header/cat-tabs/sidebar's own heights can still change right after
    // this — a webfont swap reflowing the heading, or hero-meeting.js filling
    // in #heroMeetingWhen/#heroMeetingAdd async — so recheck shortly after.
    setTimeout(updateStickyOffsets, 350);
  }

  // The heading row (and, on AIF, the category tabs below it) stay pinned
  // under the nav while only the card list scrolls — .p-schemes-sidebar and
  // .ps-cat-tabs read their sticky `top` from these two custom properties
  // (site.css) instead of a guessed pixel value, since the header/heading's
  // real height varies by product and viewport width.
  function updateStickyOffsets() {
    var navEl = document.querySelector('header.nav');
    var headEl = host.querySelector('.p-schemes-head');
    var catEl = host.querySelector('.ps-cat-tabs');
    var navH = navEl ? navEl.getBoundingClientRect().height : 0;
    var headH = headEl ? headEl.getBoundingClientRect().height : 0;
    var catH = catEl ? catEl.getBoundingClientRect().height : 0;
    host.style.setProperty('--schemes-top-1', (navH + headH) + 'px');
    host.style.setProperty('--schemes-top-2', (navH + headH + catH) + 'px');
  }
  var stickyResizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(stickyResizeTimer);
    stickyResizeTimer = setTimeout(updateStickyOffsets, 150);
  });
  // A completed/rescheduled booking can add or remove the "Your call…" pill
  // in the heading row, changing its height.
  document.addEventListener('ma:scheduled', function () { setTimeout(updateStickyOffsets, 150); });

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
    window.maOpenGateModal({
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
