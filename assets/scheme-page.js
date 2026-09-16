/* ==========================================================================
   myAlternates — scheme.html (Discover page)
   Reads ?id=<planId> from the URL, fetches the full stored record from the
   backend's getPublicSchemeDetail, and renders a shareable, self-contained
   scheme profile page: trailing returns (chart + table), objective, fund
   profile, transactability and a callback CTA. All content is real data
   already stored by the admin's Product/AMC/Scheme workflow — nothing here
   is fabricated or placeholder.
   ========================================================================== */
(function () {
  var root = document.getElementById('schemeRoot');
  if (!root) return;

  var API_URL = 'https://myalternates-backend.onrender.com/';
  var params = new URLSearchParams(location.search);
  var planId = params.get('id');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  function money(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  function notFound() {
    root.innerHTML = '<div class="scm-loading wrap"><p>This scheme isn\'t available right now.</p>' +
      '<p style="margin-top:10px;"><a href="pms" class="btn-ghost" style="color:var(--ink-text) !important; border-color:#d7d0c0;">← Back to PMS</a></p></div>';
  }

  if (!planId) { notFound(); return; }

  function loadScheme() {
    fetch(API_URL + '?action=getPublicSchemeDetail&id=' + encodeURIComponent(planId))
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) render(d.scheme); else notFound(); })
      .catch(notFound);
  }

  function showGate() {
    root.innerHTML = '<div class="wrap" style="padding:60px 0;"><div id="scGate"></div></div>';
    window.maRenderGate(document.getElementById('scGate'),
      'Scheme performance data is available to registered users only — verify your email to see this scheme\'s live returns and full profile.',
      function () { loadScheme(); });
  }

  // window.MASession comes from lead-form.js, loaded earlier on the page.
  if (window.MASession && window.MASession.getToken()) {
    loadScheme();
  } else if (window.MASession) {
    showGate();
  } else {
    notFound();
  }

  // ---- trailing-returns bar chart (grouped: scheme vs benchmark, zero baseline) ----
  var RET_COLS = [['1M', 'r1m'], ['3M', 'r3m'], ['6M', 'r6m'], ['1Y', 'r1y'], ['2Y', 'r2y'], ['3Y', 'r3y'], ['5Y', 'r5y'], ['10Y', 'r10y'], ['SI', 'si']];

  function roundedBarPath(x, w, yTop, h, r, roundAtTop) {
    r = Math.max(0, Math.min(r, w / 2, h));
    if (h <= 0) return '';
    if (roundAtTop) {
      return 'M' + x + ',' + (yTop + h) + ' L' + x + ',' + (yTop + r) +
        ' Q' + x + ',' + yTop + ' ' + (x + r) + ',' + yTop +
        ' L' + (x + w - r) + ',' + yTop + ' Q' + (x + w) + ',' + yTop + ' ' + (x + w) + ',' + (yTop + r) +
        ' L' + (x + w) + ',' + (yTop + h) + ' Z';
    }
    return 'M' + x + ',' + yTop + ' L' + (x + w) + ',' + yTop +
      ' L' + (x + w) + ',' + (yTop + h - r) + ' Q' + (x + w) + ',' + (yTop + h) + ' ' + (x + w - r) + ',' + (yTop + h) +
      ' L' + (x + r) + ',' + (yTop + h) + ' Q' + x + ',' + (yTop + h) + ' ' + x + ',' + (yTop + h - r) + ' Z';
  }

  function buildChart(s) {
    var W = 900, H = 260, padL = 6, padR = 6, padTop = 14, padBottom = 26;
    var plotW = W - padL - padR, plotH = H - padTop - padBottom;

    var vals = [];
    RET_COLS.forEach(function (c) {
      if (s.returns[c[1]] != null) vals.push(s.returns[c[1]]);
      if (s.benchmark[c[1]] != null) vals.push(s.benchmark[c[1]]);
    });
    if (!vals.length) return '';
    var maxV = Math.max(0, Math.max.apply(null, vals));
    var minV = Math.min(0, Math.min.apply(null, vals));
    var range = (maxV - minV) || 1;
    maxV += range * 0.08; minV -= range * 0.08;
    var scale = plotH / (maxV - minV);
    var zeroY = padTop + maxV * scale;
    var groupW = plotW / RET_COLS.length;
    var barW = Math.min(22, groupW * 0.3);
    var gapBetween = 6;

    // No static value labels on the bars — with 9 grouped pairs, printing all
    // 18 would collide constantly (adjacent bars, adjacent groups). The
    // hover tooltip gives the exact value per bar, and the table right below
    // the chart already carries every number — so the chart stays a clean
    // shape-comparison, per the "label selectively" rule.
    var bars = '', axisLabels = '';
    RET_COLS.forEach(function (c, i) {
      var cx = padL + groupW * i + groupW / 2;
      var sv = s.returns[c[1]], bv = s.benchmark[c[1]];
      [['scheme', sv, s.schemeName, cx - barW - gapBetween / 2],
       ['bench', bv, s.benchmark.name || 'Benchmark', cx + gapBetween / 2]]
        .forEach(function (b) {
          var kind = b[0], v = b[1], seriesName = b[2], x = b[3];
          if (v == null) return;
          var h = Math.abs(v) * scale;
          var yTop = v >= 0 ? zeroY - h : zeroY;
          bars += '<path class="scm-bar ' + kind + '" d="' + roundedBarPath(x, barW, yTop, h, 4, v >= 0) +
            '" data-period="' + esc(c[0]) + '" data-series="' + esc(seriesName) + '" data-value="' + v + '"></path>';
        });
      axisLabels += '<text class="scm-axis-label" x="' + cx + '" y="' + (H - 8) + '">' + esc(c[0]) + '</text>';
    });

    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Trailing returns, scheme vs benchmark">' +
      '<line class="scm-baseline" x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY + '"></line>' +
      bars + axisLabels + '</svg>';
  }

  function wireTooltip(wrap) {
    var tip = document.createElement('div');
    tip.className = 'scm-tooltip';
    wrap.appendChild(tip);
    wrap.querySelectorAll('.scm-bar').forEach(function (bar) {
      bar.addEventListener('mouseenter', function (e) { show(e); });
      bar.addEventListener('mousemove', function (e) { show(e); });
      bar.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
    });
    function show(e) {
      var t = e.target;
      var v = parseFloat(t.dataset.value);
      tip.innerHTML = esc(t.dataset.series) + ' · ' + esc(t.dataset.period) + '<br><b>' + pct(v) + '</b>';
      var wrapRect = wrap.getBoundingClientRect();
      tip.style.left = (e.clientX - wrapRect.left) + 'px';
      tip.style.top = (e.clientY - wrapRect.top - 10) + 'px';
      tip.classList.add('show');
    }
  }

  function perfSection(s) {
    function row(label, obj, cls) {
      return '<tr class="' + cls + '"><td>' + esc(label) + '</td>' +
        RET_COLS.map(function (c) {
          var v = obj[c[1]];
          return '<td class="' + (v == null ? 'na' : (v >= 0 ? 'pos' : 'neg')) + '">' + (v == null ? '–' : pct(v)) + '</td>';
        }).join('') + '</tr>';
    }
    var chart = buildChart(s);
    return '<div class="scm-section"><h2>Trailing returns</h2>' +
      (chart ? '<div class="scm-legend"><span><i class="scheme"></i>' + esc(s.schemeName) + '</span>' +
        (s.benchmark.name ? '<span><i class="bench"></i>' + esc(s.benchmark.name) + '</span>' : '') + '</div>' +
        '<div class="scm-chart-wrap" id="scmChartWrap">' + chart + '</div>' : '') +
      '<div class="scm-table-wrap"><table class="scm-perf-table"><thead><tr><th>Returns (ann.)</th>' +
      RET_COLS.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row(s.schemeName, s.returns, '') +
      (s.benchmark.name ? row(s.benchmark.name, s.benchmark, 'bench-row') : '') +
      '</tbody></table></div>' +
      (s.asOf ? '<p class="scm-asof">As of ' + esc(s.asOf) + '</p>' : '') +
      '</div>';
  }

  // Weight is already a % of the portfolio, so the meter fill width is just
  // that number directly — no scale/max computation needed.
  function meterRow(name, sub, weight) {
    var w = weight == null ? 0 : Math.max(0, Math.min(100, weight));
    return '<div class="scm-meter-row">' +
      '<div class="scm-meter-label"><div class="scm-meter-name">' + esc(name) + '</div>' +
      (sub ? '<div class="scm-meter-sub">' + esc(sub) + '</div>' : '') + '</div>' +
      '<div class="scm-meter-track"><div class="scm-meter-fill" style="width:' + w + '%"></div></div>' +
      '<div class="scm-meter-val">' + (weight == null ? '–' : weight.toFixed(2) + '%') + '</div>' +
      '</div>';
  }

  function holdingsSection(s) {
    if (!s.holdings || !s.holdings.length) return '';
    return '<div class="scm-section"><h2>Top holdings</h2><div class="scm-meter-list">' +
      s.holdings.map(function (h) { return meterRow(h.name, [h.sector, h.cap].filter(Boolean).join(' · '), h.weight); }).join('') +
      '</div></div>';
  }

  function sectorsSection(s) {
    if (!s.sectors || !s.sectors.length) return '';
    return '<div class="scm-section"><h2>Sector allocation</h2><div class="scm-meter-list">' +
      s.sectors.map(function (sec) { return meterRow(sec.name, '', sec.weight); }).join('') +
      '</div></div>';
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
    return '<div class="scm-section"><h2>Scheme profile</h2><div class="scm-facts">' +
      facts.map(function (f) { return '<div class="scm-fact"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') +
      '</div></div>';
  }

  function flagsSection(p) {
    var flags = [
      ['SIP', p.sipAvailable], ['STP', p.stpAvailable], ['SWP', p.swpAvailable],
      ['Purchase open', p.purchaseAvailable], ['Redemption open', p.redemptionAvailable]
    ];
    return '<div class="scm-section"><h2>Transactability</h2><div class="scm-flags">' +
      flags.map(function (f) { return '<span class="scm-flag ' + (f[1] ? 'on' : 'off') + '">' + (f[1] ? '✓' : '—') + ' ' + esc(f[0]) + '</span>'; }).join('') +
      '</div></div>';
  }

  function fundHouseSection(s) {
    if (!s.amcName) return '';
    return '<div class="scm-section"><h2>Fund house</h2>' +
      '<div class="scm-facts"><div class="scm-fact"><span>Asset manager</span><b>' + esc(s.amcName) + '</b></div>' +
      '<div class="scm-fact"><span>Product</span><b>' + esc(s.productName) + '</b></div></div></div>';
  }

  // The registered visitor's meeting state — schedule a call, or reschedule
  // + a one-click "add this scheme to the meeting" (no free-text box).
  // Refreshes itself after a schedule/reschedule completes anywhere on the
  // page (the modal itself lives outside this page's own DOM section).
  function loadMeetingAction(s) {
    var box = document.getElementById('scMeetingSection');
    if (!box) return;
    var token = window.MASession && window.MASession.getToken();
    if (!token) return;
    window.MASession.checkStatus(token).then(function (r) {
      if (!r || !r.ok || !r.loggedIn) return;
      window.maRenderMeetingAction(box, token, r, {
        interest: 'Portfolio Management Services (PMS)',
        discussionNote: 'Discuss: ' + s.schemeName + (s.amcName ? ' (' + s.amcName + ')' : '')
      });
    });
  }

  function render(s) {
    document.title = s.schemeName + ' — myAlternates';
    var p = s.profile;
    var chips = [];
    if (s.benchmark.name) chips.push(['Benchmark', s.benchmark.name]);
    if (p.inceptionDate) chips.push(['Inception date', p.inceptionDate]);
    if (p.minInvestment) chips.push(['Min. investment', money(p.minInvestment)]);
    if (p.aum != null) chips.push(['AUM', money(p.aum) + ' ' + (p.aumScale || '')]);

    var logo = s.amcLogo
      ? '<img class="scm-hero-logo" src="' + esc(s.amcLogo) + '" alt="" onerror="this.remove()">'
      : '';

    root.innerHTML =
      '<div class="scm-hero"><div class="wrap">' +
      '<div class="scm-hero-id">' + logo + '<div><div class="sc-amc">' + esc(s.amcName || s.productName) + '</div>' +
      '<h1>' + esc(s.schemeName) + (s.planOption ? ' <span class="plan-opt">— ' + esc(s.planOption) + '</span>' : '') + '</h1></div></div>' +
      (chips.length ? '<div class="scm-chips">' + chips.map(function (c) {
        return '<div class="scm-chip"><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>';
      }).join('') + '</div>' : '') +
      '</div></div>' +
      '<div class="scm-body wrap">' +
      '<div class="scm-section" id="scMeetingSection"></div>' +
      perfSection(s) +
      holdingsSection(s) +
      sectorsSection(s) +
      (p.objective ? '<div class="scm-section"><h2>Investment objective</h2><p class="scm-objective">' + esc(p.objective) + '</p></div>' : '') +
      factsSection(p) +
      flagsSection(p) +
      fundHouseSection(s) +
      '<p class="scm-disclaimer">Data shown is sourced from Finalyca / scheme filings and may lag the live factsheet. Past performance is not indicative of future results and is not a guarantee. This is not investment advice — please read all scheme-related documents carefully before investing.</p>' +
      '</div>';

    var chartWrap = document.getElementById('scmChartWrap');
    if (chartWrap) wireTooltip(chartWrap);
    loadMeetingAction(s);

    // Scheduling happens through a full-screen modal that lives outside this
    // section (see lead-form.js) — refresh the meeting panel above once it
    // completes so "Schedule a call" flips to "Your call is scheduled".
    document.addEventListener('ma:scheduled', function (e) {
      if (e.detail && e.detail.scheduled) loadMeetingAction(s);
    });
  }
})();
