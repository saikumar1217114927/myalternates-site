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
  // Fund-terms amounts (target size, min/sponsor commitment) come back as
  // an absolute figure in the fund's own currency (Finalyca's own
  // scheme_currency_scale for these is "absolute", never "Cr"/"lakh") — an
  // onshore AIF is INR, but a GIFT City Cat I/II fund is commonly USD (e.g.
  // a real target_amount of 250000000 there means $250M, not "25 Cr").
  function fmtAmount(n, currency) {
    if (currency && currency !== 'INR') {
      var sym = currency === 'USD' ? '$' : currency + ' ';
      // A GIFT City fund's min/sponsor commitment is often well under $1M
      // (e.g. a real min commitment of $250,000) — rounding straight to
      // whole millions would show that as "$0M".
      if (n >= 1e6) return sym + (Math.round(n / 1e5) / 10).toLocaleString('en-IN') + 'M';
      if (n >= 1e3) return sym + Math.round(n / 1e3).toLocaleString('en-IN') + 'K';
      return sym + Math.round(n).toLocaleString('en-IN');
    }
    return Math.round(n / 1e7).toLocaleString('en-IN') + ' Cr';
  }

  // scheme.html now serves both PMS and AIF schemes — the interest label
  // sent along with a schedule/discussion-note action needs to match
  // whichever product this particular scheme actually is.
  function schemeInterest(s) {
    var code = String((s && s.productName) || '').trim().toUpperCase();
    return code === 'AIF' ? 'Alternative Investment Fund (AIF)' : 'Portfolio Management Services (PMS)';
  }

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

  // Reached directly (a bookmarked/shared link) without going through the
  // schemes list's own Discover flow — same full registration form, just
  // triggered here instead.
  function showGate() {
    root.innerHTML = '<div class="wrap" style="padding:60px 0;"><div id="scGate"></div></div>';
    window.maRenderFullGate(document.getElementById('scGate'), {
      message: 'Scheme performance data is available to registered users only — create your free account to see this scheme\'s live returns and full profile.',
      interest: 'Portfolio Management Services (PMS)',
      onVerified: function () { loadScheme(); }
    });
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
  // The chart drops 1M — the Scheme returns table right below it still
  // carries every period including 1M, this is chart-only.
  var CHART_RET_COLS = RET_COLS.filter(function (c) { return c[0] !== '1M'; });

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
    CHART_RET_COLS.forEach(function (c) {
      if (s.returns[c[1]] != null) vals.push(s.returns[c[1]]);
      if (s.benchmark[c[1]] != null) vals.push(s.benchmark[c[1]]);
    });
    if (!vals.length) return '';
    var maxV = Math.max(0, Math.max.apply(null, vals));
    var minV = Math.min(0, Math.min.apply(null, vals));
    var range = (maxV - minV) || 1;
    maxV += range * 0.06; minV -= range * 0.06;
    var scale = plotH / (maxV - minV);
    // Snap to a half-pixel so the 1px baseline stroke lands crisply on one
    // pixel row instead of straddling two — against a plain white card that
    // sub-pixel blur read as the bars sitting slightly off the baseline.
    var zeroY = Math.round(padTop + maxV * scale - 0.5) + 0.5;
    var groupW = plotW / CHART_RET_COLS.length;
    var barW = Math.min(28, groupW * 0.34);
    var gapBetween = 6;

    // No static value labels on the bars — with 8 grouped pairs, printing all
    // 16 would collide constantly (adjacent bars, adjacent groups). The
    // hover tooltip gives the exact value per bar, and the table right below
    // the chart already carries every number — so the chart stays a clean
    // shape-comparison, per the "label selectively" rule.
    var bars = '', axisLabels = '';
    CHART_RET_COLS.forEach(function (c, i) {
      var cx = padL + groupW * i + groupW / 2;
      var sv = s.returns[c[1]], bv = s.benchmark[c[1]];
      [['scheme', sv, s.schemeName, cx - barW - gapBetween / 2],
       ['bench', bv, s.benchmark.name || 'Benchmark', cx + gapBetween / 2]]
        .forEach(function (b) {
          var kind = b[0], v = b[1], seriesName = b[2], x = b[3];
          if (v == null) {
            // No bar drawn (nothing to draw), but a bare gap next to a real
            // bar reads as "zero", not "unknown" — an explicit NA marker at
            // the baseline, right in that series' own slot, makes clear this
            // period just isn't disclosed for it.
            bars += '<text class="scm-bar-na" x="' + (x + barW / 2) + '" y="' + (zeroY + 4) + '" text-anchor="middle">NA</text>';
            return;
          }
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
      tip.innerHTML = (t.dataset.series ? esc(t.dataset.series) + ' · ' : '') + esc(t.dataset.period) + '<br><b>' + pct(v) + '</b>';
      var wrapRect = wrap.getBoundingClientRect();
      tip.style.left = (e.clientX - wrapRect.left) + 'px';
      tip.style.top = (e.clientY - wrapRect.top - 10) + 'px';
      tip.classList.add('show');
    }
  }

  // Scheme returns' own Table/Graph switch reuses this chart — see
  // schemeReturnsSection below (used to be a separate always-visible
  // "Trailing returns" section; folded in as the Graph view instead of
  // showing the same table's numbers twice in two different shapes).

  // ---- yearly returns bar chart (single series: Calendar Year or Financial
  // Year, zero baseline) — own section, right below Scheme returns. No
  // per-bar value labels, same reasoning as Scheme returns' own graph view:
  // up to 17 years packed in would collide; the hover tooltip carries the
  // exact figure instead.
  var yearlyMode = 'cy';

  function buildYearlyChart(rows) {
    if (!rows || !rows.length) return '';
    var W = 900, H = 260, padL = 6, padR = 6, padTop = 14, padBottom = 26;
    var plotW = W - padL - padR, plotH = H - padTop - padBottom;
    var vals = rows.map(function (r) { return r.ret; }).filter(function (v) { return v != null; });
    if (!vals.length) return '';
    var maxV = Math.max(0, Math.max.apply(null, vals));
    var minV = Math.min(0, Math.min.apply(null, vals));
    var range = (maxV - minV) || 1;
    maxV += range * 0.06; minV -= range * 0.06;
    var scale = plotH / (maxV - minV);
    var zeroY = Math.round(padTop + maxV * scale - 0.5) + 0.5;
    var groupW = plotW / rows.length;
    var barW = Math.min(30, groupW * 0.68);

    var bars = '', axisLabels = '';
    rows.forEach(function (r, i) {
      var cx = padL + groupW * i + groupW / 2;
      var v = r.ret;
      if (v != null) {
        var h = Math.abs(v) * scale;
        var yTop = v >= 0 ? zeroY - h : zeroY;
        var cls = 'scm-bar ' + (v >= 0 ? 'pos' : 'neg') + (r.isPartial ? ' partial' : '');
        bars += '<path class="' + cls + '" d="' + roundedBarPath(cx - barW / 2, barW, yTop, h, 3, v >= 0) +
          '" data-period="' + esc(r.period) + '" data-value="' + v + '"></path>';
      }
      // "CY 25" -> "’25"; YTD/FYTD (the current, still-in-progress period) is
      // short enough to show as-is.
      var shortLabel = r.isPartial ? r.period : r.period.replace(/^(CY|FY)\s*/, '’');
      axisLabels += '<text class="scm-axis-label" x="' + cx + '" y="' + (H - 8) + '">' + esc(shortLabel) + '</text>';
    });

    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Yearly returns">' +
      '<line class="scm-baseline" x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY + '"></line>' +
      bars + axisLabels + '</svg>';
  }

  function yearlyChartHtml(s) {
    var rows = (s.historicPerformance && s.historicPerformance[yearlyMode]) || [];
    return buildYearlyChart(rows) ||
      '<p style="color:var(--muted);font-size:12.5px;padding:20px 0;text-align:center;">No yearly data yet.</p>';
  }

  function historicReturnsSection(s) {
    var hp = s.historicPerformance || {};
    if (!(hp.cy && hp.cy.length) && !(hp.fy && hp.fy.length)) return '';
    return '<div class="scm-section"><div class="scm-sec-head"><h2>Yearly returns</h2>' +
      '<div class="scm-yr-toggle" id="scmYrToggle">' +
      '<button type="button" class="' + (yearlyMode === 'cy' ? 'active' : '') + '" data-mode="cy">Calendar year</button>' +
      '<button type="button" class="' + (yearlyMode === 'fy' ? 'active' : '') + '" data-mode="fy">Financial year</button>' +
      '</div></div>' +
      '<div class="scm-chart-wrap" id="scmYearlyChartWrap">' + yearlyChartHtml(s) + '</div>' +
      '</div>';
  }

  function wireYearlyToggle(s) {
    var toggle = document.getElementById('scmYrToggle');
    if (!toggle) return;
    toggle.querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () {
        if (btn.dataset.mode === yearlyMode) return;
        yearlyMode = btn.dataset.mode;
        toggle.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        var wrap = document.getElementById('scmYearlyChartWrap');
        wrap.innerHTML = yearlyChartHtml(s);
        wireTooltip(wrap);
      };
    });
  }

  // The scheme's own trailing numbers — the single most important thing a
  // lead comes to this page for, so this section gets the page's one
  // highlighted-card treatment (.scm-highlight) instead of sitting as a
  // plain section like everything around it. A Table/Graph switch (same
  // .scm-yr-toggle piece Yearly returns' own Calendar/Financial year switch
  // uses) lets a lead read it either way, without showing the identical
  // numbers twice in two always-visible sections.
  var returnsViewMode = 'table';

  function schemeReturnsTableHtml(s) {
    function row(label, obj, cls) {
      return '<tr class="' + cls + '"><td>' + esc(label) + '</td>' +
        RET_COLS.map(function (c) {
          var v = obj[c[1]];
          return '<td class="' + (v == null ? 'na' : (v >= 0 ? 'pos' : 'neg')) + '">' + (v == null ? 'NA' : pct(v)) + '</td>';
        }).join('') + '</tr>';
    }
    return '<div class="scm-table-wrap"><table class="scm-perf-table"><thead><tr><th>Returns (ann.)</th>' +
      RET_COLS.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row(s.schemeName, s.returns, '') +
      (s.benchmark.name ? row(s.benchmark.name, s.benchmark, 'bench-row') : '') +
      '</tbody></table></div>';
  }

  function schemeReturnsGraphHtml(s) {
    var chart = buildChart(s);
    if (!chart) return '<p style="color:var(--muted);font-size:12.5px;padding:20px 0;text-align:center;">No graph data yet.</p>';
    return '<div class="scm-chart-wrap" id="scmChartWrap">' + chart + '</div>' +
      '<div class="scm-legend"><span><i class="scheme"></i>' + esc(s.schemeName) + '</span>' +
      (s.benchmark.name ? '<span><i class="bench"></i>' + esc(s.benchmark.name) + '</span>' : '') + '</div>';
  }

  function schemeReturnsBodyHtml(s) {
    return returnsViewMode === 'table' ? schemeReturnsTableHtml(s) : schemeReturnsGraphHtml(s);
  }

  function schemeReturnsSection(s) {
    var hasAny = RET_COLS.some(function (c) { return s.returns[c[1]] != null || s.benchmark[c[1]] != null; });
    if (!hasAny) return ''; // a brand-new, still-fundraising scheme (see fundTermsSection) has nothing here yet
    // The toggle sits right beside the "As of" date (both on the row's right
    // edge, same as the date sat alone before this toggle existed) — not
    // floating on its own in the middle of the header, which is what a
    // plain 3-way space-between would have done.
    return '<div class="scm-section scm-highlight"><div class="scm-sec-head"><h2>Scheme returns</h2>' +
      '<div class="scm-ret-controls">' +
      '<div class="scm-yr-toggle" id="scmRetToggle">' +
      '<button type="button" class="' + (returnsViewMode === 'table' ? 'active' : '') + '" data-mode="table">Table</button>' +
      '<button type="button" class="' + (returnsViewMode === 'graph' ? 'active' : '') + '" data-mode="graph">Graph</button>' +
      '</div>' +
      (s.asOf ? '<span class="scm-asof">As of ' + esc(s.asOf) + '</span>' : '') +
      '</div></div>' +
      '<div id="scmRetBody">' + schemeReturnsBodyHtml(s) + '</div>' +
      '</div>';
  }

  function wireReturnsToggle(s) {
    var toggle = document.getElementById('scmRetToggle');
    if (!toggle) return;
    toggle.querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () {
        if (btn.dataset.mode === returnsViewMode) return;
        returnsViewMode = btn.dataset.mode;
        toggle.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        var body = document.getElementById('scmRetBody');
        body.innerHTML = schemeReturnsBodyHtml(s);
        var chartWrap = document.getElementById('scmChartWrap');
        if (chartWrap) wireTooltip(chartWrap);
      };
    });
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
    return '<div class="scm-section"><h2>Top holdings</h2><div class="scm-meter-card"><div class="scm-meter-list">' +
      s.holdings.map(function (h) { return meterRow(h.name, [h.sector, h.cap].filter(Boolean).join(' · '), h.weight); }).join('') +
      '</div></div></div>';
  }

  function sectorsSection(s) {
    if (!s.sectors || !s.sectors.length) return '';
    return '<div class="scm-section"><h2>Sector allocation</h2><div class="scm-meter-card"><div class="scm-meter-list">' +
      s.sectors.map(function (sec) { return meterRow(sec.name, '', sec.weight); }).join('') +
      '</div></div></div>';
  }

  // Portfolio characteristics — field names confirmed against a real call
  // (plan_code=ASK1_01): p_e, p_b, dividend_yield, avg_mkt_cap,
  // avg_mkt_cap_in_usd, median_mkt_cap, total_stocks, scheme_asset_class_name
  // (equity funds); avg_credit_rating, avg_maturity_yrs, macaulay_duration_yrs,
  // modified_duration_yrs, yield_to_maturity (debt funds — null on an equity
  // scheme like this one). scheme_code/scheme_id/auto_populate are internal
  // bookkeeping, not portfolio metrics, and date is the as-of date — none of
  // the three belong in the tile grid. An unrecognised key (a field Finalyca
  // adds later) still renders via the auto-formatted fallback below rather
  // than silently vanishing.
  var CHAR_SKIP_KEYS = { scheme_code: 1, scheme_id: 1, auto_populate: 1, date: 1 };
  var CHAR_LABELS = {
    p_e: 'P/E Ratio', p_b: 'P/B Ratio', dividend_yield: 'Dividend Yield',
    avg_mkt_cap: 'Average Market Cap', avg_mkt_cap_in_usd: 'Average Market Cap (USD)',
    median_mkt_cap: 'Median Market Cap', total_stocks: 'Number of Stocks',
    scheme_asset_class_name: 'Asset Class', avg_credit_rating: 'Average Credit Rating',
    avg_maturity_yrs: 'Average Maturity', macaulay_duration_yrs: 'Macaulay Duration',
    modified_duration_yrs: 'Modified Duration', yield_to_maturity: 'Yield to Maturity'
  };
  var CHAR_PERCENT_KEYS = { dividend_yield: 1, yield_to_maturity: 1 };
  var CHAR_YEARS_KEYS = { avg_maturity_yrs: 1, macaulay_duration_yrs: 1, modified_duration_yrs: 1 };
  var CHAR_CRORE_KEYS = { avg_mkt_cap: 1, median_mkt_cap: 1 };
  var CHAR_USD_KEYS = { avg_mkt_cap_in_usd: 1 };

  function charLabel(key) {
    if (CHAR_LABELS[key]) return CHAR_LABELS[key];
    return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function charValue(key, v) {
    if (v == null || v === '') return '—';
    if (typeof v === 'number') {
      if (CHAR_PERCENT_KEYS[key]) return v.toFixed(2) + '%';
      if (CHAR_YEARS_KEYS[key]) return v.toFixed(2) + ' yrs';
      if (CHAR_CRORE_KEYS[key]) return money(v) + ' Cr';
      if (CHAR_USD_KEYS[key]) return '$' + v.toLocaleString('en-IN');
      if (key === 'total_stocks') return Math.round(v).toString();
      return (Math.abs(v) < 10 ? v.toFixed(2) : Math.round(v * 100) / 100).toString();
    }
    return String(v);
  }

  function portfolioCharacteristicsSection(s) {
    // Not applicable to a Cat I/II AIF — P/E, P/B, average maturity etc. are
    // listed-securities portfolio stats; a close-ended, drawdown-structured
    // fund has fundTermsSection instead (target size, tenure, commitment,
    // drawdown, closing).
    if (s.profile && s.profile.aifCategory) return '';
    var p = s.profile || {};
    var pc = s.portfolioCharacteristics || {};
    var keys = Object.keys(pc).filter(function (k) { return !CHAR_SKIP_KEYS[k] && pc[k] != null && pc[k] !== ''; });
    var tiles = keys.map(function (k) {
      return '<div class="scm-char-tile"><span class="scm-char-label">' + esc(charLabel(k)) + '</span>' +
        '<span class="scm-char-value">' + esc(charValue(k, pc[k])) + '</span></div>';
    });
    // SIP/STP availability (scheme_sip_available/scheme_stp_available,
    // already stored — see publicSchemeView's sipAvailable/stpAvailable) —
    // moved here from the old standalone Transactability section.
    [['SIP Availability', p.sipAvailable], ['STP Availability', p.stpAvailable]].forEach(function (f) {
      tiles.push('<div class="scm-char-tile"><span class="scm-char-label">' + esc(f[0]) + '</span>' +
        '<span class="scm-char-value">' + (f[1] ? 'Available' : 'Not Available') + '</span></div>');
    });
    if (!tiles.length) return '';
    return '<div class="scm-section"><div class="scm-sec-head"><h2>Portfolio characteristics</h2>' +
      (pc.date ? '<span class="scm-asof">As of ' + esc(pc.date) + '</span>' : '') + '</div>' +
      '<div class="scm-chars-panel"><div class="scm-chars-grid">' + tiles.join('') + '</div></div></div>';
  }

  function factsSection(p) {
    var facts = [];
    if (p.assetClass) facts.push(['Asset class', p.assetClass]);
    if (p.schemeType) facts.push(['Scheme type', p.schemeType]);
    if (p.fundManagers && p.fundManagers.length) facts.push(['Fund manager' + (p.fundManagers.length > 1 ? 's' : ''), p.fundManagers.join(', ')]);
    if (p.minInvestment) facts.push(['Minimum investment', money(p.minInvestment)]);
    if (p.minLockinMonths) facts.push(['Minimum lock-in', p.minLockinMonths + ' month' + (p.minLockinMonths > 1 ? 's' : '')]);
    if (p.expenseRatio != null) facts.push(['Expense ratio', p.expenseRatio + '%']);
    if (!facts.length) return '';
    return '<div class="scm-section"><h2>Scheme profile</h2><div class="scm-facts">' +
      facts.map(function (f) { return '<div class="scm-fact"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') +
      '</div></div>';
  }

  // A handful of Finalyca's own fundraising-status fields come back as
  // placeholder shorthand ("ND") or blank when a term genuinely hasn't been
  // fixed yet — read as "To be determined" rather than shown raw or omitted.
  function tbd(v) {
    var s = String(v == null ? '' : v).trim();
    return (!s || /^(nd|na|n\/a|tbd)$/i.test(s)) ? 'To be determined' : s;
  }

  // Category I/II AIF only (see publicSchemeView's aifCategory) — a
  // close-ended, drawdown-structured fund that's still raising, so its
  // fundraising terms matter more than trailing returns it may not have yet
  // (and Portfolio characteristics, above, doesn't apply — see its own
  // aifCategory guard). One light card per field, same pattern as this
  // page's own Fee structure/Exit load cards below — fund target size
  // leads as its own accented card since it's the headline number, the rest
  // follow as plain cards, each with its own remark line where Finalyca
  // actually gives one (e.g. "Extendable by 1+1 Years"). Field set
  // confirmed field-by-field against a real Category I fund (Morphosis
  // Venture Capital Fund I).
  // A CSS grid row stretches every cell in it to match its tallest one — so
  // one long value (Finalyca's own asset_structure text in particular can
  // run to several sentences) was inflating the whole row, leaving its
  // short neighbours (Fund structure, Subscription status, ...) mostly
  // empty space. Any card whose value runs long moves to its own full-width
  // row (same treatment Taxation already got), positioned right before it —
  // a short card's position/width is untouched either way.
  var HEAVY_VALUE_LEN = 70;

  function fundTermsSection(p) {
    if (!p.aifCategory) return '';
    var cards = [];
    if (p.targetAmount != null) cards.push({ label: 'Fund target size', value: fmtAmount(p.targetAmount, p.currency) });
    if (p.fundStructure) cards.push({ label: 'Fund structure', value: p.fundStructure });
    cards.push({ label: 'Subscription status', value: p.closedForSubscription ? 'Closed' : 'Open' });
    if (p.assetStructure) cards.push({ label: 'Asset structure', value: p.assetStructure });
    if (p.targetedGrossIrr != null) cards.push({ label: 'Targeted gross IRR', value: p.targetedGrossIrr + '%', note: p.targetedGrossIrrRemarks });
    if (p.inceptionDate) cards.push({ label: 'Fund open date', value: p.inceptionDate });
    if (p.tenureYears != null) cards.push({ label: 'Fund tenure', value: p.tenureYears + ' yr' + (p.tenureYears > 1 ? 's' : ''), note: p.tenureRemarks });
    if (p.drawdownPercent != null) cards.push({ label: 'Initial drawdown', value: p.drawdownPercent + '%', note: p.drawdownRemarks });
    cards.push({ label: 'Tentative balance commitment call', value: tbd(p.balanceCommitmentCall) });
    if (p.minCommitment != null) cards.push({ label: 'Min. commitment', value: fmtAmount(p.minCommitment, p.currency), note: p.minCommitmentRemarks });
    if (p.sponsorCommitmentAmount != null || p.sponsorCommitmentRemarks) {
      cards.push({
        label: 'Sponsor commitment',
        value: p.sponsorCommitmentAmount != null ? fmtAmount(p.sponsorCommitmentAmount, p.currency) : p.sponsorCommitmentRemarks,
        note: p.sponsorCommitmentAmount != null ? p.sponsorCommitmentRemarks : ''
      });
    }
    cards.push({ label: 'Tentative final closing', value: tbd(p.finalClosingDate), note: p.finalClosingDate ? p.finalClosingRemarks : '' });

    // Split out any naturally short card from any that turned out heavy —
    // order within each group is otherwise untouched, so the normal 5-up
    // grid reads exactly as it did before for every short card.
    var shortCards = [], heavyCards = [];
    cards.forEach(function (c) {
      (String(c.value || '').length > HEAVY_VALUE_LEN ? heavyCards : shortCards).push(c);
    });
    heavyCards.forEach(function (c) { c.wide = true; });
    cards = shortCards.concat(heavyCards);
    if (p.taxationRemarks) cards.push({ label: 'Taxation', value: p.taxationRemarks, wide: true });

    var badge = 'Category ' + p.aifCategory + (p.subCategory ? ' · ' + p.subCategory : '');
    // .scm-asof (a plain, low-contrast pill) is right for a quiet "as of
    // <date>" caption elsewhere on this page, but this badge is the
    // category/asset-class itself — worth calling out, and worth reading as
    // the same category pill the AIF/GIFT list cards already show (.ft-tag-
    // cat), not a timestamp footnote.
    return '<div class="scm-section"><div class="scm-sec-head"><h2>Fund terms</h2><span class="scm-cat-badge">' + esc(badge) + '</span></div>' +
      '<div class="scm-fee-cards">' +
      cards.map(function (c) {
        // Finalyca's own remark fields occasionally just restate the value
        // (e.g. a min_commitment_remarks of "1 Cr" next to a value that
        // already formats to "1 Cr") — skip a note that adds nothing new.
        var note = c.note && String(c.note).trim().toLowerCase() !== String(c.value).trim().toLowerCase() ? c.note : '';
        return '<div class="scm-fee-card' + (c.hero ? ' hero' : '') + (c.wide ? ' wide' : '') + '"><span>' + esc(c.label) + '</span>' +
          '<b>' + esc(c.value) + '</b>' + (note ? '<i>' + esc(note) + '</i>' : '') + '</div>';
      }).join('') +
      '</div></div>';
  }

  // Fee structure comes back as one free-text string (e.g. "Fixed fee: 2.50%,
  // Variable Fee: 1.50%, Hurdle Fee: 10.00%, Profit Sharing: 20% over 10%
  // Hurdle") — split it into its labeled components. Each captured value runs
  // up to the NEXT recognised label (not the next comma), since a value like
  // Profit Sharing's own description often contains commas.
  var FEE_LABELS = ['Fixed fee', 'Variable Fee', 'Hurdle Fee', 'Profit Sharing', 'Hybrid Fee'];
  function parseFeeStructure(raw) {
    if (!raw) return null;
    var pattern = new RegExp('(' + FEE_LABELS.join('|') + ')\\s*:\\s*([\\s\\S]*?)(?=(?:' + FEE_LABELS.join('|') + ')\\s*:|$)', 'gi');
    var out = {};
    var m;
    while ((m = pattern.exec(raw))) {
      var label = m[1].toLowerCase();
      var value = m[2].replace(/,\s*$/, '').trim();
      if (!value) continue;
      if (label.indexOf('fixed') > -1) out.fixed = value;
      else if (label.indexOf('variable') > -1) out.variable = value;
      else if (label.indexOf('profit sharing') > -1) out.profitSharing = value;
      else if (label.indexOf('hurdle') > -1) out.hurdle = value;
      else if (label.indexOf('hybrid') > -1) out.hybrid = value;
    }
    return out;
  }

  // Cat I/II's structured fee classes (see publicSchemeView's feeClasses) —
  // one row per commitment tier, e.g. a fund charging the same 2%/20%/10hurdle
  // whether you commit ₹1-10Cr (class A1) or ₹10Cr+ (class A2). Renders as an
  // actual table (unlike the free-text path below, which has no natural rows/
  // columns to line up) in this page's own light card styling — not the plain
  // black-on-white reference layout, so it reads as part of this page rather
  // than a pasted-in spec sheet.
  function capitalCommitmentText(terms, currency) {
    if (!terms || !terms.length) return '—';
    var lower = terms.filter(function (t) { return t.operator === '>=' || t.operator === '>'; })[0];
    var upper = terms.filter(function (t) { return t.operator === '<=' || t.operator === '<'; })[0];
    if (lower && upper) {
      return fmtAmount(lower.value, currency) + ' to ' + (upper.operator === '<' ? '< ' : '') + fmtAmount(upper.value, currency);
    }
    if (lower) return fmtAmount(lower.value, currency) + '+';
    if (upper) return (upper.operator === '<' ? 'Up to < ' : 'Up to ') + fmtAmount(upper.value, currency);
    return fmtAmount(terms[0].value, currency);
  }

  function feeClassesSection(p) {
    if (!p.feeClasses || !p.feeClasses.length) return '';
    var remarks = p.feeClasses.filter(function (c) { return c.remarks; });
    return '<div class="scm-section"><h2>Fee structure</h2>' +
      '<div class="scm-fee-table-wrap"><table class="scm-fee-table">' +
      '<thead><tr><th>Class</th><th>Capital Commitment</th><th>Fixed Mgmt. Fee (p.a.)</th><th>Performance Fee</th><th>Hurdle</th></tr></thead>' +
      '<tbody>' +
      p.feeClasses.map(function (c) {
        return '<tr>' +
          '<td><span class="scm-fee-class">' + esc(c.class || '—') + '</span></td>' +
          '<td>' + esc(capitalCommitmentText(c.capitalCommitment, p.currency)) + '</td>' +
          '<td>' + esc(c.fixedFee || '—') + '</td>' +
          '<td>' + esc(c.performanceFee || '—') + '</td>' +
          '<td>' + esc(c.hurdle || '—') + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      (remarks.length ? '<p class="scm-fee-note">' +
        remarks.map(function (c) { return '<b>' + esc(c.class) + ':</b> ' + esc(c.remarks); }).join(' &nbsp;·&nbsp; ') +
        '</p>' : '') +
      '</div>';
  }

  function feeStructureSection(p) {
    if (p.feeClasses && p.feeClasses.length) return feeClassesSection(p);
    if (!p.feeStructure) return '';
    var parsed = parseFeeStructure(p.feeStructure);
    var cards = [];
    if (parsed) {
      var variableVal = parsed.variable || '';
      var profitVal = parsed.profitSharing || '';
      // Some AMCs' own Profit Sharing text names a "Variable Option" inline
      // (e.g. "Profit Sharing: Variable Option: 20% ... or Fixed 1% + ...") —
      // that clause is variable-fee information, so pull it into the
      // Variable card and leave the other (fixed-linked) clause in Profit
      // Sharing, rather than burying "Variable" content inside that card.
      if (profitVal) {
        var vm = profitVal.match(/^([\s\S]*?)\bVariable\b\s*(?:Option)?\s*:?\s*([\s\S]*)$/i);
        if (vm) {
          var before = vm[1].trim();
          var afterParts = vm[2].split(/\s+or\s+/i);
          var variablePart = afterParts[0].trim();
          var rest = afterParts.slice(1).join(' or ').trim();
          variableVal = variableVal ? (variableVal + ' · ' + variablePart) : variablePart;
          profitVal = (before + ' ' + rest).trim();
        }
      }
      if (parsed.fixed) cards.push(['Fixed', parsed.fixed]);
      if (variableVal) cards.push(['Variable', variableVal]);
      if (profitVal) cards.push(['Profit Sharing', profitVal + (parsed.hurdle ? ' (Hurdle: ' + parsed.hurdle + ')' : '')]);
    }
    // Couldn't split it into the three buckets (format varies by AMC) — show
    // the original text rather than lose the information.
    if (!cards.length) {
      return '<div class="scm-section"><h2>Fee structure</h2><p class="scm-objective">' + esc(p.feeStructure) + '</p></div>';
    }
    return '<div class="scm-section"><h2>Fee structure</h2><div class="scm-fee-cards">' +
      cards.map(function (c) { return '<div class="scm-fee-card"><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>'; }).join('') +
      '</div></div>';
  }

  // Cat I/II only (see publicSchemeView's whoCanInvest/whoCannotInvest) —
  // the same green/red-accented language .scm-flag's on/off states and the
  // returns tables' pos/neg colours already use elsewhere on this page, so
  // "allowed" vs "not allowed" reads the same way everywhere rather than
  // introducing a new colour pairing.
  function investorEligibilitySection(p) {
    if (!p.whoCanInvest && !p.whoCannotInvest) return '';
    return '<div class="scm-section"><h2>Investor eligibility</h2><div class="scm-eligibility-grid">' +
      (p.whoCanInvest ? '<div class="scm-eligibility-card can"><span class="scm-eligibility-label">✓ Can invest</span><p>' + esc(p.whoCanInvest) + '</p></div>' : '') +
      (p.whoCannotInvest ? '<div class="scm-eligibility-card cannot"><span class="scm-eligibility-label">✕ Cannot invest</span><p>' + esc(p.whoCannotInvest) + '</p></div>' : '') +
      '</div></div>';
  }

  // Exit load comes back as "Exit Load: 1 Year: 1.00%, 2 Year: 0.00%, 3 Year:
  // 0.00%" — pull out each year's rate for its own card.
  function parseExitLoad(raw) {
    if (!raw) return [];
    var out = [];
    var re = /(\d+)\s*Year\s*:\s*([\d.]+%)/gi;
    var m;
    while ((m = re.exec(raw))) out.push([m[1] + 'Y', m[2]]);
    return out;
  }

  function exitLoadSection(p) {
    // Doesn't apply to a closed-ended, drawdown-structured Cat I/II fund —
    // there's no redeem-early penalty to speak of, so Finalyca's own field
    // for these just comes back as boilerplate ("1 Year: No Option, 2 Year:
    // No Option, ..."), not real information worth a section.
    if (p.aifCategory) return '';
    if (!p.exitLoad) return '';
    var years = parseExitLoad(p.exitLoad);
    if (!years.length) {
      return '<div class="scm-section"><h2>Exit load</h2><p class="scm-objective">' + esc(p.exitLoad) + '</p></div>';
    }
    return '<div class="scm-section"><h2>Exit load</h2><div class="scm-fee-cards">' +
      years.map(function (y) { return '<div class="scm-fee-card"><span>' + esc(y[0]) + '</span><b>' + esc(y[1]) + '</b></div>'; }).join('') +
      '</div></div>';
  }

  // Who currently manages this fund — see publicSchemeView's
  // activeFundManagers (server-side join on finalyca_fund_manager_funds,
  // fund_manager_to IS NULL). A scheme with no fund manager data fetched
  // yet, or none currently active, just omits this section — nothing to
  // show yet isn't an error.
  function fundManagersSection(s) {
    var mgrs = s.profile && s.profile.activeFundManagers;
    if (!mgrs || !mgrs.length) return '';
    var heading = mgrs.length > 1 ? 'Fund managers' : 'Fund manager';
    return '<div class="scm-section"><h2>' + heading + '</h2><div class="scm-fm-list">' +
      mgrs.map(function (m) {
        var photo = m.image
          ? '<img class="scm-fm-photo" src="' + esc(m.image) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;scm-fm-photo-fallback&quot;>' + esc((m.name || '?').charAt(0)) + '</div>\'">'
          : '<div class="scm-fm-photo-fallback">' + esc((m.name || '?').charAt(0)) + '</div>';
        return '<div class="scm-fm-card">' + photo +
          '<div class="scm-fm-body">' +
          '<div class="scm-fm-name">' + esc(m.name) +
          (m.linkedinUrl ? ' <a href="' + esc(m.linkedinUrl) + '" target="_blank" rel="noopener" class="scm-fm-li" aria-label="LinkedIn">in</a>' : '') +
          '</div>' +
          (m.designation ? '<div class="scm-fm-role">' + esc(m.designation) + '</div>' : '') +
          (m.description ? '<p class="scm-fm-desc">' + esc(m.description) + '</p>' : '') +
          '</div></div>';
      }).join('') +
      '</div></div>';
  }

  // A highlighted card, not a plain facts row — this AMC (logo, name,
  // product) is the future entry point to "every scheme under this fund
  // house", so it's styled to already read as a distinct, navigable unit
  // (same .sr-logo/.sr-tag language the product-list cards use for an AMC)
  // even though nothing here is clickable yet — no href/onclick, on purpose.
  function fundHouseSection(s) {
    if (!s.amcName) return '';
    var logo = s.amcLogo
      ? '<img class="sr-logo" src="' + esc(s.amcLogo) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;sr-logo-fallback&quot;>' + esc((s.amcName || '?').charAt(0)) + '</div>\'">'
      : '<div class="sr-logo-fallback">' + esc((s.amcName || '?').charAt(0)) + '</div>';
    return '<div class="scm-section"><h2>Fund house</h2>' +
      '<div class="scm-fundhouse-card">' +
      '<div class="scm-fundhouse-id">' + logo +
      '<div><div class="scm-fundhouse-name">' + esc(s.amcName) + '</div>' +
      (s.productName ? '<span class="sr-tag">' + esc(s.productName) + '</span>' : '') +
      '</div></div>' +
      '<span class="scm-fundhouse-arrow" aria-hidden="true">→</span>' +
      '</div></div>';
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
        interest: schemeInterest(s),
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
      '<div class="scm-hero-top">' +
      '<div class="scm-hero-id">' + logo + '<div><div class="sc-amc">' + esc(s.amcName || s.productName) + '</div>' +
      '<h1>' + esc(s.schemeName) + '</h1></div></div>' +
      '<div class="scm-hero-meeting" id="scMeetingSection"></div>' +
      '</div>' +
      (chips.length ? '<div class="scm-chips">' + chips.map(function (c) {
        return '<div class="scm-chip"><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>';
      }).join('') + '</div>' : '') +
      '</div></div>' +
      '<div class="scm-body wrap">' +
      factsSection(p) +
      (p.objective ? '<div class="scm-section"><h2>Investment objective</h2><p class="scm-objective">' + esc(p.objective) + '</p></div>' : '') +
      fundTermsSection(p) +
      schemeReturnsSection(s) +
      historicReturnsSection(s) +
      '<div class="scm-two-col">' + holdingsSection(s) + sectorsSection(s) + '</div>' +
      portfolioCharacteristicsSection(s) +
      feeStructureSection(p) +
      investorEligibilitySection(p) +
      exitLoadSection(p) +
      fundManagersSection(s) +
      fundHouseSection(s) +
      '</div>';

    var chartWrap = document.getElementById('scmChartWrap');
    if (chartWrap) wireTooltip(chartWrap);
    var yearlyWrap = document.getElementById('scmYearlyChartWrap');
    if (yearlyWrap) wireTooltip(yearlyWrap);
    wireYearlyToggle(s);
    wireReturnsToggle(s);
    loadMeetingAction(s);

    // Scheduling happens through a full-screen modal that lives outside this
    // section (see lead-form.js) — refresh the meeting panel above once it
    // completes so "Schedule a call" flips to "Your call is scheduled".
    document.addEventListener('ma:scheduled', function (e) {
      if (e.detail && e.detail.scheduled) loadMeetingAction(s);
    });
  }
})();
