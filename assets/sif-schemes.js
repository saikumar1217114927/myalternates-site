/* ===================================================================
   myAlternates — SIF scheme list (sif.html)

   Specialised Investment Funds come from AMFI's free daily SIF NAV file
   (Finalyca doesn't carry SIF), synced nightly by the backend — Regular
   plans only, latest NAV only. So each card shows the latest NAV and a
   since-inception return (from the ₹10 launch NAV), not 1Y/3Y/5Y.
   Reuses the PMS list's .scheme-row card styles from site.css.
   =================================================================== */
(function () {
  var API_URL = 'https://myalternates-backend-c3u7.onrender.com/';
  var host = document.querySelector('[data-sif-schemes]');
  if (!host) return;

  var all = [];
  var state = { q: '', asset: 'All' };

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

  host.innerHTML =
    '<div class="wrap">' +
    '<div class="p-schemes-head"><div class="section-head">' +
    '<div class="section-tag">Live from AMFI</div>' +
    '<h2>Explore SIF Schemes</h2>' +
    '</div></div>' +
    '<div class="sif-toolbar">' +
    '<div class="ps-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6.5"/><line x1="18" y1="18" x2="13.6" y2="13.6"/></svg>' +
    '<input type="search" id="sifSearch" placeholder="Search by scheme, SIF or strategy" aria-label="Search SIF schemes"></div>' +
    '<div class="pss-pills" id="sifAsset"></div>' +
    '</div>' +
    '<div class="scheme-list" id="sifList"><div class="ps-empty">Loading SIF schemes…</div></div>' +
    '<p class="disc" id="sifDisc"></p>' +
    '</div>';

  var listEl = host.querySelector('#sifList');

  function rowHtml(s) {
    var si = s.si;
    var siCls = !si ? 'na' : (si.pct >= 0 ? 'pos' : 'neg');
    var siVal = !si ? 'NA' : (si.pct >= 0 ? '+' : '') + si.pct.toFixed(2) + '%';
    var siLbl = !si ? 'Since incep.' : (si.annualised ? 'SI (p.a.)' : 'Since incep.');
    return '<div class="scheme-row">' +
      '<div class="sr-id"><div class="sr-logo-fallback">' + esc(brandLabel(s.sifBrand).charAt(0)) + '</div>' +
      '<div class="sr-id-text">' +
      '<div class="sr-toprow"><span class="sc-amc">' + esc(brandLabel(s.sifBrand)) + '</span></div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div>' +
      '<div class="sr-tags">' +
      (s.strategy ? '<span class="sr-tag">' + esc(s.strategy.replace(/\s+Fund$/i, '')) + '</span>' : '') +
      (s.assetClass ? '<span class="sr-tag-cat">' + esc(s.assetClass) + '</span>' : '') +
      '</div>' +
      '<div class="sr-meta">' +
      '<span>Type <b>' + esc(s.fundType || '–') + '</b></span>' +
      '<span>Option <b>' + esc(s.option || '–') + '</b></span>' +
      '<span>Launched <b>' + esc(fmtDate(s.launchDate)) + '</b></span>' +
      (s.ter ? '<span>TER <b>' + esc(s.ter) + '</b></span>' : '') +
      '</div></div></div>' +
      '<div class="sr-rets sif-rets">' +
      '<div class="sr-ret"><b>₹' + esc(s.nav.toFixed(4)) + '</b><span>NAV · ' + esc(fmtDate(s.navDate)) + '</span></div>' +
      '<div class="sr-ret"><b class="' + siCls + '">' + esc(siVal) + '</b><span>' + esc(siLbl) + '</span></div>' +
      '</div>' +
      '<div class="sr-actions"><a href="#enquiry" class="sc-discover">Enquire →</a></div>' +
      '</div>';
  }

  function render() {
    var q = state.q.toLowerCase();
    var rows = all.filter(function (s) {
      if (state.asset !== 'All' && s.assetClass !== state.asset) return false;
      if (!q) return true;
      return [s.schemeName, s.sifBrand, s.strategy].join(' ').toLowerCase().indexOf(q) > -1;
    });
    listEl.innerHTML = rows.length ? rows.map(rowHtml).join('')
      : '<div class="ps-empty">No SIF schemes match your search.</div>';
  }

  function renderPills() {
    var classes = ['All'].concat(all.map(function (s) { return s.assetClass; })
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort());
    var el = host.querySelector('#sifAsset');
    el.innerHTML = classes.map(function (c) {
      return '<button type="button" class="pss-pill' + (c === state.asset ? ' active' : '') + '" data-a="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    el.onclick = function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      state.asset = b.getAttribute('data-a');
      renderPills(); render();
    };
  }

  host.querySelector('#sifSearch').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });

  fetch(API_URL + '?action=getPublicSifSchemes')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      all = (d && d.ok && d.schemes) || [];
      if (!all.length) {
        listEl.innerHTML = '<div class="ps-empty">SIF schemes will appear here shortly.</div>';
        return;
      }
      var navDate = all.map(function (s) { return s.navDate; }).filter(Boolean).sort().pop();
      host.querySelector('#sifDisc').textContent =
        'NAV source: AMFI, latest as of ' + fmtDate(navDate) + '. Regular plans shown. Since-inception return is measured from the ₹10 launch NAV — ' +
        'absolute for strategies under a year old, annualised after. Minimum investment ₹10 lakh per investor across an AMC\'s SIF strategies. ' +
        'Past performance is not indicative of future returns; please read the scheme documents carefully.';
      renderPills(); render();
    })
    .catch(function () {
      listEl.innerHTML = '<div class="ps-empty">Couldn\'t load SIF schemes right now — please try again shortly.</div>';
    });
})();
