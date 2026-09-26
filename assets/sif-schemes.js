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
    { value: 'si', label: 'Since Inception' },
    { value: 'r1m', label: '1 Month Return' },
    { value: 'r3m', label: '3 Month Return' },
    { value: 'r6m', label: '6 Month Return' }
  ];
  var DEFAULTS = { q: '', strategy: 'All', asset: 'All', amc: 'All', sortKey: 'si', sortDir: 'desc' };

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
    return '<div class="scheme-row">' +
      '<div class="sr-id"><div class="sr-logo-fallback">' + esc(amcOf(s).charAt(0).toUpperCase()) + '</div>' +
      '<div class="sr-id-text">' +
      '<div class="sr-toprow"><span class="sc-amc">' + esc(amcOf(s)) + '</span></div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div>' +
      '<div class="sr-tags">' +
      (s.strategy ? '<span class="sr-tag">' + esc(strategyOf(s)) + '</span>' : '') +
      (s.assetClass ? '<span class="sr-tag-cat">' + esc(s.assetClass) + '</span>' : '') +
      '</div>' +
      '<div class="sr-meta">' +
      '<span>Inception <b>' + esc(fmtDate(s.launchDate)) + '</b></span>' +
      '<span>NAV <b>₹' + esc(s.nav.toFixed(4)) + '</b></span>' +
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
      '<label>Strategy</label>' +
      '<div class="pss-pills" id="pssStrategy">' +
      ['All'].concat(strategies).map(function (v) {
        return '<button type="button" class="pss-pill' + (v === state.strategy ? ' active' : '') + '" data-val="' + esc(v) + '">' + esc(v) + '</button>';
      }).join('') +
      '</div></div>' +
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
    panel.querySelectorAll('.pss-pill').forEach(function (btn) {
      btn.onclick = function () { state.strategy = btn.dataset.val; renderFilterPanel(); applyFilters(); };
    });
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
    // NA returns always sink to the bottom, whichever direction
    var dir = state.sortDir === 'asc' ? 1 : -1;
    list.sort(function (a, b) {
      var x = retOf(a, state.sortKey), y = retOf(b, state.sortKey);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * dir;
    });
    var listEl = host.querySelector('.scheme-list');
    listEl.innerHTML = list.map(rowHtml).join('');
    host.querySelector('#sifEmpty').hidden = list.length > 0;
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
    var b = e.target.closest('[data-discover]');
    if (b) goToScheme(b.getAttribute('data-discover'));
  });
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
