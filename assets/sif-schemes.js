/* ===================================================================
   myAlternates — SIF scheme list (sif.html)

   Same page shape as the PMS/AIF lists (featured-schemes.js): a heading
   row with the cross-product switcher and "Talk to an expert", a sticky
   left sidebar (search, sort, strategy, asset class, fund house) and the
   scheme cards — reusing the same site.css classes. SIFs come from AMFI
   (Finalyca doesn't carry SIF), synced nightly by the backend — Regular
   plans only. SIFs only began in 2025, so the cards show 1M / 3M / 6M / SI;
   the Discover page (scheme?sif=<code>) carries every period.
   Discover works like PMS/AIF: a registered visitor goes straight to the
   scheme page, an anonymous one registers in the same gate modal first.
   =================================================================== */
(function () {
  var API_URL = 'https://myalternates-backend-c3u7.onrender.com/';
  var host = document.querySelector('[data-sif-schemes]');
  if (!host) return;

  var INTEREST = 'Specialised Investment Fund (SIF)';
  var OTHER_PRODUCTS = [['pms', 'PMS'], ['aif', 'AIF'], ['gift-city', 'GIFT City']];
  var SORT_OPTIONS = [
    { value: 'r1m', label: '1 Month Return' },
    { value: 'r3m', label: '3 Month Return' },
    { value: 'r6m', label: '6 Month Return' },
    { value: 'si', label: 'Since Inception' }
  ];
  var DEFAULTS = { q: '', strategy: 'All', asset: 'All', amc: 'All', sortKey: 'r1m', sortDir: 'desc' };
  // Like the PMS list: at most 50 cards unless the visitor is searching —
  // a search always looks through every SIF, not just the 50 shown.
  var LIST_LIMIT = 50;

  var all = [];
  var state = Object.assign({}, DEFAULTS);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '–';
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function brandLabel(b) { return String(b || '').replace(/\s+SIF$/i, '') + ' SIF'; }
  function amcOf(s) { return s.amcName || brandLabel(s.sifBrand); }
  // The fund house's official logo (copied once from AMFI, served by our
  // backend at API_URL + 'sif-logo/<key>'), else the first-letter tile.
  function logoHtml(s) {
    var letter = esc(amcOf(s).charAt(0).toUpperCase());
    if (!s.amcLogo) return '<div class="sr-logo-fallback">' + letter + '</div>';
    return '<img class="sr-logo" src="' + esc(API_URL + s.amcLogo) + '" alt="" loading="lazy" ' +
      'onerror="this.outerHTML=\'<div class=&quot;sr-logo-fallback&quot;>' + letter + '</div>\'">';
  }
  function strategyOf(s) { return String(s.strategy || '').replace(/\s+Fund$/i, ''); }
  function retOf(s, key) {
    var r = s.returns || {};
    if (key === 'si') return r.si != null ? r.si : (s.si ? s.si.pct : null);
    return r[key] == null ? null : r[key];
  }
  function uniqueSorted(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out.sort();
  }

  function retCol(label, v) {
    var cls = v == null ? 'na' : (v >= 0 ? 'pos' : 'neg');
    return '<div class="sr-ret"><b class="' + cls + '">' + (v == null ? 'NA' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%') +
      '</b><span>' + esc(label) + '</span></div>';
  }

  function rowHtml(s) {
    return '<div class="scheme-row' + (Number(s.featured) > 0 ? ' featured' : '') + '">' + compareBtnHtml(s) +
      '<div class="sr-id">' + logoHtml(s) +
      '<div class="sr-id-text">' +
      '<div class="sr-toprow"><span class="sc-amc">' + esc(amcOf(s)) + '</span></div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div>' +
      '<div class="sr-tags">' +
      (s.strategy ? '<span class="sr-tag">' + esc(strategyOf(s)) + '</span>' : '') +
      (s.assetClass ? '<span class="sr-tag-cat">' + esc(s.assetClass) + '</span>' : '') +
      '</div>' +
      '<div class="sr-meta">' +
      '<span>Inception <b>' + esc(fmtDate(s.launchDate)) + '</b></span>' +
      '<span>Type <b>' + esc(s.fundType || '–') + '</b></span>' +
      '<span>Option <b>' + esc(s.option || '–') + '</b></span>' +
      '</div></div></div>' +
      '<div class="sr-rets">' + retCol('1M', retOf(s, 'r1m')) + retCol('3M', retOf(s, 'r3m')) +
      retCol('6M', retOf(s, 'r6m')) + retCol('SI', retOf(s, 'si')) + '</div>' +
      '<div class="sr-actions"><button type="button" class="sc-discover" data-discover="' + esc(s.schemeCode) + '">Discover →</button></div>' +
      '</div>';
  }

  // ---- page shell: heading row + sidebar + list (featured-schemes.js layout) ----
  function crossProductHtml() {
    return '<div class="p-cross-switch">' +
      '<span class="p-cross-label">Also on myAlternates</span>' +
      OTHER_PRODUCTS.map(function (o) {
        return '<a href="' + esc(o[0]) + '" class="p-cross-btn">' + esc(o[1]) +
          ' <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
      }).join('') +
      '</div>';
  }

  function shellHtml() {
    return '<div class="wrap">' +
      '<div class="p-schemes-head">' +
      '<div class="section-head">' + crossProductHtml() + '<h2>Explore SIF Schemes</h2></div>' +
      '<div class="p-schemes-cta">' +
      '<span id="heroMeetingWhen"></span>' +
      '<div class="p-schemes-cta-row">' +
      '<a href="#" class="btn-gold" data-ma-talk="' + esc(INTEREST) + '">Talk to an expert →</a>' +
      '<a href="sip#lumpsum" class="btn-ghost btn-ghost-sm">Lumpsum calculator</a>' +
      '</div>' +
      '<span id="heroMeetingAdd"></span>' +
      '</div>' +
      '</div>' +
      '<div class="p-schemes-body">' +
      '<aside class="p-schemes-sidebar">' +
      '<div class="ps-search">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6.5"/><line x1="18" y1="18" x2="13.6" y2="13.6"/></svg>' +
      '<input type="search" id="pssSearch" placeholder="Search by scheme or AMC name" aria-label="Search SIF schemes">' +
      '</div>' +
      '<div id="pssFilterPanel"></div>' +
      '</aside>' +
      '<div class="p-schemes-list">' +
      '<div class="scheme-list"><div class="ps-empty">Loading SIF schemes…</div></div>' +
      '<p class="ps-empty" id="sifEmpty" hidden>No SIF schemes match your filters.</p>' +
      '<p class="disc" id="sifDisc"></p>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function filterPanelHtml() {
    var strategies = uniqueSorted(all.map(strategyOf));
    var assets = uniqueSorted(all.map(function (s) { return s.assetClass; }));
    var amcs = uniqueSorted(all.map(amcOf));
    function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }
    return '<div class="pss-group">' +
      '<label>Sort by</label>' +
      '<select id="pssSort">' + SORT_OPTIONS.map(function (o) { return opt(o.value, o.label, state.sortKey); }).join('') + '</select>' +
      '<div class="pss-dir">' +
      '<button type="button" class="pss-dir-btn' + (state.sortDir === 'desc' ? ' active' : '') + '" data-dir="desc">High to Low</button>' +
      '<button type="button" class="pss-dir-btn' + (state.sortDir === 'asc' ? ' active' : '') + '" data-dir="asc">Low to High</button>' +
      '</div></div>' +
      '<div class="pss-group">' +
      '<label>Strategy type</label>' +
      '<select id="pssStrategy">' + opt('All', 'All strategy types', state.strategy) +
      strategies.map(function (v) { return opt(v, v, state.strategy); }).join('') + '</select>' +
      '</div>' +
      '<div class="pss-group">' +
      '<label>Asset class</label>' +
      '<select id="pssAsset">' + opt('All', 'All asset classes', state.asset) +
      assets.map(function (v) { return opt(v, v, state.asset); }).join('') + '</select>' +
      '</div>' +
      '<div class="pss-group">' +
      '<label>Fund house</label>' +
      '<select id="pssAmc">' + opt('All', 'All fund houses', state.amc) +
      amcs.map(function (v) { return opt(v, v, state.amc); }).join('') + '</select>' +
      '</div>' +
      '<button type="button" class="pss-clear" id="pssClear">Clear filters</button>';
  }

  function renderFilterPanel() {
    var panel = host.querySelector('#pssFilterPanel');
    panel.innerHTML = filterPanelHtml();
    panel.querySelector('#pssSort').onchange = function () { state.sortKey = this.value; applyFilters(); };
    panel.querySelectorAll('.pss-dir-btn').forEach(function (btn) {
      btn.onclick = function () { state.sortDir = btn.dataset.dir; renderFilterPanel(); applyFilters(); };
    });
    panel.querySelector('#pssStrategy').onchange = function () { state.strategy = this.value; applyFilters(); };
    panel.querySelector('#pssAsset').onchange = function () { state.asset = this.value; applyFilters(); };
    panel.querySelector('#pssAmc').onchange = function () { state.amc = this.value; applyFilters(); };
    panel.querySelector('#pssClear').onclick = function () {
      state = Object.assign({}, DEFAULTS);
      host.querySelector('#pssSearch').value = '';
      renderFilterPanel(); applyFilters();
    };
  }

  function applyFilters() {
    var q = state.q.trim().toLowerCase();
    var list = all.filter(function (s) {
      if (state.strategy !== 'All' && strategyOf(s) !== state.strategy) return false;
      if (state.asset !== 'All' && s.assetClass !== state.asset) return false;
      if (state.amc !== 'All' && amcOf(s) !== state.amc) return false;
      if (!q) return true;
      return [s.schemeName, s.sifBrand, s.amcName, s.strategy].join(' ').toLowerCase().indexOf(q) > -1;
    });
    // Featured picks lead in their admin-set position (1, 2, 3...), like the
    // PMS list; the rest follow the chosen sort. NA returns always sink to
    // the bottom, whichever direction.
    var dir = state.sortDir === 'asc' ? 1 : -1;
    list.sort(function (a, b) {
      var af = Number(a.featured) || 0, bf = Number(b.featured) || 0;
      if (af > 0 || bf > 0) {
        if (af > 0 && bf > 0) return af - bf;
        return af > 0 ? -1 : 1;
      }
      var x = retOf(a, state.sortKey), y = retOf(b, state.sortKey);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * dir;
    });
    var shown = q ? list : list.slice(0, LIST_LIMIT);
    var listEl = host.querySelector('.scheme-list');
    listEl.innerHTML = shown.map(rowHtml).join('') +
      (shown.length < list.length
        ? '<p class="ps-empty">Showing the top ' + shown.length + ' of ' + list.length + ' SIF plans — search by scheme or AMC name to find any of them.</p>'
        : '');
    host.querySelector('#sifEmpty').hidden = list.length > 0;
    syncCompareButtons();
  }

  // Heading row stays pinned under the nav while the cards scroll — the
  // sidebar reads its sticky `top` from this custom property (site.css),
  // same as featured-schemes.js.
  function updateStickyOffsets() {
    var navEl = document.querySelector('header.nav');
    var headEl = host.querySelector('.p-schemes-head');
    var navH = navEl ? navEl.getBoundingClientRect().height : 0;
    var headH = headEl ? headEl.getBoundingClientRect().height : 0;
    host.style.setProperty('--schemes-top-1', (navH + headH) + 'px');
    host.style.setProperty('--schemes-top-2', (navH + headH) + 'px');
  }
  var resizeTimer = null;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateStickyOffsets, 150); });
  document.addEventListener('ma:scheduled', function () { setTimeout(updateStickyOffsets, 150); });

  // ---- Compare (2–3 SIF plans) — same tray, modal and table styles as the
  // PMS/AIF compare in featured-schemes.js; data from getPublicSifScheme.
  // Any SIF can sit next to any other (they share the same metrics).
  var COMPARE_MAX = 3, COMPARE_MIN = 2, COMPARE_KEY = 'maCompare:SIF';
  var compareSel = (function () {
    try { var v = JSON.parse(sessionStorage.getItem(COMPARE_KEY) || '[]'); return Array.isArray(v) ? v.slice(0, COMPARE_MAX) : []; }
    catch (e) { return []; }
  })();
  var compareMsgTimer = null, trayEl = null, cmpModal = null;
  function saveCompareSel() { try { sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compareSel)); } catch (e) {} }
  var COMPARE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7h11m0 0-3-3m3 3-3 3M16 13H5m0 0 3-3m-3 3 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function compareBtnHtml(s) {
    return '<button type="button" class="sr-compare" data-compare="' + esc(s.schemeCode) + '" title="Add to compare" aria-label="Add ' +
      esc(s.schemeName) + ' to compare" aria-pressed="false">' + COMPARE_ICON + '</button>';
  }
  function syncCompareButtons() {
    var picked = {};
    compareSel.forEach(function (c) { picked[c.code] = 1; });
    host.querySelectorAll('[data-compare]').forEach(function (btn) {
      var on = !!picked[btn.getAttribute('data-compare')];
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Remove from compare' : 'Add to compare';
    });
  }
  function toggleCompare(code) {
    var idx = -1;
    compareSel.forEach(function (c, i) { if (c.code === code) idx = i; });
    if (idx > -1) {
      compareSel.splice(idx, 1);
    } else {
      var s = all.filter(function (x) { return x.schemeCode === code; })[0];
      if (!s) return;
      if (compareSel.length >= COMPARE_MAX) {
        showCompareMsg('You can compare up to ' + COMPARE_MAX + ' SIFs at a time. Remove one to add another.');
        return;
      }
      compareSel.push({ code: code, schemeName: s.schemeName + ' – ' + (s.option || 'Growth'), amcName: amcOf(s) });
    }
    saveCompareSel(); syncCompareButtons(); renderCompareTray();
  }
  function ensureTray() {
    if (trayEl) return trayEl;
    trayEl = document.createElement('div');
    trayEl.className = 'cmp-tray';
    trayEl.hidden = true;
    trayEl.innerHTML = '<div class="cmp-tray-in">' +
      '<div class="cmp-tray-head"><b>Compare SIF</b><span id="cmpTrayCount"></span></div>' +
      '<div class="cmp-slots" id="cmpSlots"></div>' +
      '<div class="cmp-tray-actions"><button type="button" class="cmp-clear" id="cmpClear">Clear</button>' +
      '<button type="button" class="sc-discover cmp-go" id="cmpGo">Compare</button></div>' +
      '<div class="cmp-msg" id="cmpMsg" role="status" aria-live="polite"></div>' +
      '</div>';
    document.body.appendChild(trayEl);
    trayEl.querySelector('#cmpClear').onclick = function () { compareSel = []; saveCompareSel(); syncCompareButtons(); renderCompareTray(); };
    trayEl.querySelector('#cmpGo').onclick = function () { if (compareSel.length >= COMPARE_MIN) openCompareGated(); };
    trayEl.querySelector('#cmpSlots').onclick = function (e) {
      var x = e.target.closest('[data-cmp-remove]');
      if (x) toggleCompare(x.getAttribute('data-cmp-remove'));
    };
    return trayEl;
  }
  function renderCompareTray() {
    var t = ensureTray();
    if (!compareSel.length) { t.hidden = true; document.body.classList.remove('cmp-tray-on'); return; }
    t.querySelector('#cmpTrayCount').textContent = compareSel.length + ' of ' + COMPARE_MAX + ' selected' +
      (compareSel.length < COMPARE_MIN ? ' · add at least one more' : '');
    var slots = compareSel.map(function (c) {
      return '<div class="cmp-slot"><div class="cmp-slot-text"><span>' + esc(c.amcName) + '</span><b>' + esc(c.schemeName) + '</b></div>' +
        '<button type="button" class="cmp-slot-x" data-cmp-remove="' + esc(c.code) + '" aria-label="Remove ' + esc(c.schemeName) + '">✕</button></div>';
    });
    for (var i = compareSel.length; i < COMPARE_MAX; i++) slots.push('<div class="cmp-slot cmp-slot-empty">+ Add a scheme</div>');
    t.querySelector('#cmpSlots').innerHTML = slots.join('');
    t.querySelector('#cmpGo').disabled = compareSel.length < COMPARE_MIN;
    t.hidden = false;
    document.body.classList.add('cmp-tray-on');
    document.body.style.setProperty('--cmp-tray-h', t.offsetHeight + 'px');
  }
  function showCompareMsg(text) {
    var t = ensureTray();
    if (t.hidden) renderCompareTray();
    var m = t.querySelector('#cmpMsg');
    m.textContent = text; m.classList.add('show');
    clearTimeout(compareMsgTimer);
    compareMsgTimer = setTimeout(function () { m.classList.remove('show'); }, 4500);
  }
  // Same rule as Discover: full data is for registered visitors.
  function openCompareGated() {
    if (window.MASession && window.MASession.getToken()) { openCompare(); return; }
    if (!window.maOpenGateModal) { openCompare(); return; }
    window.maOpenGateModal({
      message: 'Create your free account to compare SIFs side by side.',
      interest: INTEREST,
      onVerified: function (token, r, lead, close) { close(); openCompare(); }
    });
  }

  function pct(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }
  function cmpText(v) { return v == null || v === '' ? '<span class="cmp-na">–</span>' : esc(v); }
  function cmpRow(label, cells) {
    return '<tr><th scope="row">' + esc(label) + '</th>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
  }
  function cmpSection(label, n) { return '<tr class="cmp-sec"><th colspan="' + (n + 1) + '">' + esc(label) + '</th></tr>'; }
  function cmpReturnRow(label, key, list) {
    var vals = list.map(function (s) { var v = (s.returns || {})[key]; return v == null ? null : Number(v); });
    var nums = vals.filter(function (v) { return v != null; });
    if (!nums.length) return '';
    var best = nums.length > 1 ? Math.max.apply(null, nums) : null;
    return cmpRow(label, vals.map(function (v) {
      if (v == null) return '<span class="cmp-na">–</span>';
      return '<b class="cmp-ret ' + (v >= 0 ? 'pos' : 'neg') + (v === best ? ' best' : '') + '">' + pct(v) + '</b>';
    }));
  }
  function compareTableHtml(list) {
    var n = list.length;
    var D = function (s) { return s.details || {}; };
    var head = '<tr><th class="cmp-corner"></th>' + list.map(function (s) {
      return '<th class="cmp-head">' + logoHtml(s) +
        '<div class="sc-amc">' + esc(amcOf(s)) + '</div>' +
        '<div class="cmp-head-name">' + esc(s.schemeName) + ' – ' + esc(s.option || 'Growth') + '</div>' +
        '<a class="cmp-head-link" href="scheme?sif=' + encodeURIComponent(s.schemeCode) + '">View details →</a></th>';
    }).join('') + '</tr>';
    var rows = [];
    rows.push(cmpSection('Overview', n));
    rows.push(cmpRow('Strategy type', list.map(function (s) { return cmpText(strategyOf(s)); })));
    rows.push(cmpRow('Asset class', list.map(function (s) { return cmpText(s.assetClass); })));
    rows.push(cmpRow('Structure', list.map(function (s) { return cmpText(s.fundType); })));
    rows.push(cmpRow('Inception', list.map(function (s) { return cmpText(s.launchDate ? fmtDate(s.launchDate) : null); })));
    rows.push(cmpRow('NAV', list.map(function (s) { return cmpText(s.nav == null ? null : '₹' + s.nav.toFixed(4) + ' · ' + fmtDate(s.navDate)); })));
    rows.push(cmpRow('Benchmark', list.map(function (s) { return cmpText(D(s).benchmark); })));
    rows.push(cmpRow('Riskometer', list.map(function (s) { return cmpText(D(s).riskometer); })));
    rows.push(cmpRow('Min. investment', list.map(function (s) {
      var v = D(s).minInvestment;
      return cmpText(v ? '₹' + Math.round(v).toLocaleString('en-IN') : '₹10,00,000');
    })));
    rows.push(cmpSection('Returns', n));
    [['1 Month', 'r1m'], ['3 Months', 'r3m'], ['6 Months', 'r6m'], ['1 Year', 'r1y'], ['3 Years', 'r3y'],
     ['5 Years', 'r5y'], ['Since inception', 'si']].forEach(function (r) {
      var row = cmpReturnRow(r[0], r[1], list);
      if (row) rows.push(row);
    });
    rows.push(cmpSection('Costs & exit', n));
    rows.push(cmpRow('Expense ratio (max.)', list.map(function (s) { return cmpText(String(D(s).ter || '').replace(/\n/g, ' · ')); })));
    rows.push(cmpRow('Exit load', list.map(function (s) {
      return cmpText(String(D(s).exitLoad || '').replace(/^Entry Load:[^\n]*\n?/i, '').replace(/^Exit\s*Load\s*[:–-]\s*/i, ''));
    })));
    rows.push(cmpRow('Fund managers', list.map(function (s) {
      var fm = D(s).fundManagers || [];
      return fm.length ? esc(fm.join(', ')) : '<span class="cmp-na">–</span>';
    })));
    return '<table class="cmp-table cols-' + n + '"><thead>' + head + '</thead><tbody>' + rows.join('') + '</tbody></table>';
  }
  // For the admin "Scheme comparisons" report and the Requests activity score.
  function logComparison(picked) {
    var vid = '';
    try { vid = localStorage.getItem('maVid') || ''; } catch (e) {}
    try {
      fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'logSchemeComparison', token: (window.MASession && window.MASession.getToken()) || '',
          vid: vid, productCode: 'SIF', group: 'SIF',
          planIds: picked.map(function (c) { return c.code; }), page: location.pathname + location.search
        })
      }).catch(function () {});
    } catch (e) {}
  }
  function closeCompare() {
    if (!cmpModal) return;
    cmpModal.remove(); cmpModal = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onCompareKey);
  }
  function onCompareKey(e) { if (e.key === 'Escape') closeCompare(); }
  function openCompare() {
    closeCompare();
    var picked = compareSel.slice();
    cmpModal = document.createElement('div');
    cmpModal.className = 'cmp-modal';
    cmpModal.innerHTML = '<div class="cmp-modal-backdrop"></div>' +
      '<div class="cmp-modal-box" role="dialog" aria-modal="true" aria-label="Compare SIFs">' +
      '<button type="button" class="cmp-modal-close" aria-label="Close">✕</button>' +
      '<h3>Compare SIF schemes</h3>' +
      '<div class="cmp-body"><div class="cmp-loading">Loading scheme data…</div></div>' +
      '<p class="cmp-note">Regular plans, NAV and returns from AMFI; scheme details from AMFI\'s strategy documents. ' +
      'Returns under a year are absolute. Past performance is not indicative of future returns.</p>' +
      '</div>';
    document.body.appendChild(cmpModal);
    document.body.style.overflow = 'hidden';
    cmpModal.querySelector('.cmp-modal-backdrop').onclick = closeCompare;
    cmpModal.querySelector('.cmp-modal-close').onclick = closeCompare;
    document.addEventListener('keydown', onCompareKey);
    logComparison(picked);
    var modalRef = cmpModal;
    Promise.all(picked.map(function (c) {
      return fetch(API_URL + '?action=getPublicSifScheme&code=' + encodeURIComponent(c.code))
        .then(function (r) { return r.json(); })
        .then(function (d) { return d && d.ok ? d.scheme : null; })
        .catch(function () { return null; });
    })).then(function (list) {
      if (cmpModal !== modalRef) return;
      list = list.filter(Boolean);
      modalRef.querySelector('.cmp-body').innerHTML = list.length >= COMPARE_MIN
        ? '<div class="cmp-scroll">' + compareTableHtml(list) + '</div>'
        : '<div class="cmp-loading">Couldn\'t load these schemes right now — please try again in a moment.</div>';
    });
  }

  // Same as the PMS/AIF list's Discover (featured-schemes.js): registered →
  // straight to the scheme page; anonymous → register in the gate modal,
  // offer the optional call scheduler (unless one's already booked), then go.
  function goToScheme(code) {
    var url = 'scheme?sif=' + encodeURIComponent(code);
    if (window.MASession && window.MASession.getToken()) { location.href = url; return; }
    if (!window.maOpenGateModal) { location.href = url; return; }
    window.maOpenGateModal({
      message: 'Create your free account to see this SIF\'s live returns and full profile.',
      interest: INTEREST,
      onVerified: function (token, res, lead, close) {
        close();
        window.MASession.checkStatus(token).then(function (sess) {
          if (sess && sess.ok && sess.upcomingMeeting && sess.upcomingMeeting.date) { location.href = url; return; }
          document.addEventListener('ma:scheduled', function goNext() {
            document.removeEventListener('ma:scheduled', goNext);
            location.href = url;
          }, { once: true });
          window.MASession.openSchedule(Object.assign({}, lead, res), '', INTEREST);
        });
      }
    });
  }

  host.innerHTML = shellHtml();
  host.querySelector('.scheme-list').addEventListener('click', function (e) {
    var c = e.target.closest('[data-compare]');
    if (c) { e.stopPropagation(); toggleCompare(c.getAttribute('data-compare')); return; }
    var b = e.target.closest('[data-discover]');
    if (b) goToScheme(b.getAttribute('data-discover'));
  });
  if (compareSel.length) renderCompareTray();
  host.querySelector('#pssSearch').addEventListener('input', function (e) { state.q = e.target.value; applyFilters(); });
  if (window.maWireTalkToExpertLinks) window.maWireTalkToExpertLinks();
  if (window.maInitHeroMeetingInfo) window.maInitHeroMeetingInfo(INTEREST);
  updateStickyOffsets();
  setTimeout(updateStickyOffsets, 350);

  fetch(API_URL + '?action=getPublicSifSchemes')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      all = (d && d.ok && d.schemes) || [];
      if (!all.length) {
        host.querySelector('.scheme-list').innerHTML = '<div class="ps-empty">SIF schemes will appear here shortly.</div>';
        return;
      }
      var navDate = all.map(function (s) { return s.navDate; }).filter(Boolean).sort().pop();
      host.querySelector('#sifDisc').textContent =
        'NAV source: AMFI, latest as of ' + fmtDate(navDate) + '. Regular plans shown. 1M / 3M / 6M returns are absolute; since-inception (SI) is measured from ' +
        'the launch NAV — absolute for strategies under a year old, annualised after. NA means the strategy is younger than that period. Minimum investment ₹10 lakh per investor across an AMC\'s SIF strategies. ' +
        'Past performance is not indicative of future returns; please read the scheme documents carefully.';
      renderFilterPanel();
      applyFilters();
      updateStickyOffsets();
    })
    .catch(function () {
      host.querySelector('.scheme-list').innerHTML = '<div class="ps-empty">Couldn\'t load SIF schemes right now — please try again shortly.</div>';
    });
})();
