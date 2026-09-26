/* ===================================================================
   myAlternates — SIF scheme list (sif.html)

   Specialised Investment Funds come from AMFI (Finalyca doesn't carry
   SIF), synced nightly by the backend — Regular plans only, with 1Y / 3Y /
   5Y / SI returns from each plan's AMFI NAV history. Reuses the PMS list's
   .scheme-row card styles from site.css, and its Discover flow: a
   registered visitor goes straight to scheme?sif=<code>, an anonymous one
   registers in the same gate modal first.
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
    '<input type="search" id="sifSearch" placeholder="Search by scheme, AMC or strategy" aria-label="Search SIF schemes"></div>' +
    '<div class="pss-pills" id="sifAsset"></div>' +
    '</div>' +
    '<div class="scheme-list" id="sifList"><div class="ps-empty">Loading SIF schemes…</div></div>' +
    '<p class="disc" id="sifDisc"></p>' +
    '</div>';

  var listEl = host.querySelector('#sifList');

  function retCol(label, v) {
    var cls = v == null ? 'na' : (v >= 0 ? 'pos' : 'neg');
    return '<div class="sr-ret"><b class="' + cls + '">' + (v == null ? 'NA' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%') +
      '</b><span>' + esc(label) + '</span></div>';
  }

  function rowHtml(s) {
    var r = s.returns || {};
    // Older backend (no NAV history yet) only sends si
    var siPct = r.si != null ? r.si : (s.si ? s.si.pct : null);
    return '<div class="scheme-row">' +
      '<div class="sr-id"><div class="sr-logo-fallback">' + esc((s.amcName || brandLabel(s.sifBrand)).charAt(0).toUpperCase()) + '</div>' +
      '<div class="sr-id-text">' +
      '<div class="sr-toprow"><span class="sc-amc">' + esc(s.amcName || brandLabel(s.sifBrand)) + '</span></div>' +
      '<div class="sr-scheme-name">' + esc(s.schemeName) + '</div>' +
      '<div class="sr-tags">' +
      (s.strategy ? '<span class="sr-tag">' + esc(s.strategy.replace(/\s+Fund$/i, '')) + '</span>' : '') +
      (s.assetClass ? '<span class="sr-tag-cat">' + esc(s.assetClass) + '</span>' : '') +
      '</div>' +
      '<div class="sr-meta">' +
      '<span>Inception <b>' + esc(fmtDate(s.launchDate)) + '</b></span>' +
      '<span>NAV <b>₹' + esc(s.nav.toFixed(4)) + '</b></span>' +
      '<span>Type <b>' + esc(s.fundType || '–') + '</b></span>' +
      '<span>Option <b>' + esc(s.option || '–') + '</b></span>' +
      (s.ter ? '<span>TER <b>' + esc(s.ter) + '</b></span>' : '') +
      '</div></div></div>' +
      // SIFs only began in 2025, so the list shows short periods; the
      // Discover page (scheme?sif=) carries every period up to 5Y.
      '<div class="sr-rets">' + retCol('1M', r.r1m) + retCol('3M', r.r3m) + retCol('6M', r.r6m) + retCol('SI', siPct) + '</div>' +
      '<div class="sr-actions"><button type="button" class="sc-discover" data-discover="' + esc(s.schemeCode) + '">Discover →</button></div>' +
      '</div>';
  }

  // Same as the PMS/AIF list's Discover (featured-schemes.js): registered →
  // straight to the scheme page; anonymous → register in the gate modal,
  // offer the optional call scheduler (unless one's already booked), then go.
  var INTEREST = 'Specialised Investment Fund (SIF)';
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
  listEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-discover]');
    if (b) goToScheme(b.getAttribute('data-discover'));
  });

  function render() {
    var q = state.q.toLowerCase();
    var rows = all.filter(function (s) {
      if (state.asset !== 'All' && s.assetClass !== state.asset) return false;
      if (!q) return true;
      return [s.schemeName, s.sifBrand, s.amcName, s.strategy].join(' ').toLowerCase().indexOf(q) > -1;
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
        'NAV source: AMFI, latest as of ' + fmtDate(navDate) + '. Regular plans shown. 1M / 3M / 6M returns are absolute; since-inception (SI) is measured from ' +
        'the launch NAV — absolute for strategies under a year old, annualised after. NA means the strategy is younger than that period. Minimum investment ₹10 lakh per investor across an AMC\'s SIF strategies. ' +
        'Past performance is not indicative of future returns; please read the scheme documents carefully.';
      renderPills(); render();
    })
    .catch(function () {
      listEl.innerHTML = '<div class="ps-empty">Couldn\'t load SIF schemes right now — please try again shortly.</div>';
    });
})();
