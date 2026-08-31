/* ==========================================================================
   myAlternates — product performance band (masked strategy returns)
   Renders below the hero on each product page, driven by
   <section class="p-metrics" data-metrics="pms|mf|sif|giftcity|aif">.
   --------------------------------------------------------------------------
   ALL NUMBERS BELOW ARE PLACEHOLDERS / ILLUSTRATIVE. Replace the DATA entries
   with real, compliance-approved figures before this goes live. Scheme and
   AMC names are intentionally masked; the calculator is illustrative only.
   ========================================================================== */
(function () {
  var host = document.querySelector('.p-metrics[data-metrics]');
  if (!host) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Trailing-return columns. y = years, used by the "what it would have grown to" calc.
  var PERIODS = [
    { k: '1Y', y: 1, cls: '' },
    { k: '2Y', y: 2, cls: 'c2y' },
    { k: '3Y', y: 3, cls: '' },
    { k: '5Y', y: 5, cls: 'c5y' }
  ];

  // Fake AMC labels — shown blurred, never revealed. Purely so the blur has text.
  var MASKS = ['Northcrest Capital', 'Aequitas AMC', 'Blue Meridian', 'Kaizen Asset Mgrs', 'Silverline Capital'];

  var DATA = {
    pms: {
      label: 'PMS',
      title: 'How the top PMS strategies on the platform have performed',
      amount: 5000000,
      rows: [
        { style: 'Mid & Small-Cap',    ret: [31.2, 25.0, 26.4, 22.7] },
        { style: 'Flexi-Cap',          ret: [26.4, 21.3, 22.8, 19.6] },
        { style: 'Quant / Multi-Factor', ret: [24.8, 20.4, 21.3, null] },
        { style: 'Focused 20',         ret: [22.1, 18.9, 19.9, 17.8] }
      ],
      more: 12
    },
    mf: {
      label: 'mutual fund',
      title: 'How the funds most tracked on the platform have performed',
      amount: 100000,
      rows: [
        { style: 'Small-Cap Fund',      ret: [27.6, 22.1, 24.0, 26.3] },
        { style: 'Mid-Cap Fund',        ret: [24.2, 19.8, 21.5, 24.1] },
        { style: 'Flexi-Cap Fund',      ret: [19.4, 16.2, 17.8, 18.9] },
        { style: 'Balanced Advantage',  ret: [14.1, 12.0, 12.8, 13.2] }
      ],
      more: 60
    },
    sif: {
      label: 'SIF',
      title: 'How the SIF strategies on the platform have performed',
      amount: 1000000,
      rows: [
        { style: 'Sector Rotation',     ret: [24.8, 19.2, null, null] },
        { style: 'Equity ex-Top 100',   ret: [26.1, null, null, null] },
        { style: 'Long-Short Equity',   ret: [21.4, 17.9, null, null] },
        { style: 'Hybrid Long-Short',   ret: [15.7, 13.1, null, null] }
      ],
      more: 6
    },
    giftcity: {
      label: 'GIFT City feeder',
      title: 'How the GIFT City feeder funds on the platform have performed',
      currency: 'USD',
      amount: 150000,
      unitNote: 'USD-denominated strategies; returns shown before currency effects',
      rows: [
        { style: 'US Tech Feeder',        ret: [22.3, 15.1, 14.4, 16.2] },
        { style: 'Global Equity Feeder',  ret: [16.8, 11.9, 11.2, 12.6] },
        { style: 'India-Focused Offshore', ret: [18.1, 13.4, 14.0, null] },
        { style: 'Diversified FoF',       ret: [12.4, 9.7, 9.1, 9.8] }
      ],
      more: 5
    },
    aif: {
      label: 'AIF',
      title: 'How the AIF strategies on the platform have performed',
      amount: 10000000,
      rows: [
        { style: 'Cat III — Long-Short',    ret: [19.6, 16.3, 17.1, 15.8] },
        { style: 'Cat III — Absolute Return', ret: [14.2, 12.8, 13.0, 12.4] },
        { style: 'Cat II — Venture Debt',   ret: [15.4, 13.9, null, null] },
        { style: 'Cat II — Private Credit', ret: [13.1, 12.6, 12.9, null] }
      ],
      more: 14
    }
  };

  var cfg = DATA[host.dataset.metrics];
  if (!cfg) return;

  function money(n) {
    n = Math.round(n);
    return cfg.currency === 'USD'
      ? '$' + n.toLocaleString('en-US')
      : '₹' + n.toLocaleString('en-IN');
  }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }

  // ---- build markup ----
  var headCells = '<span>Strategy</span>' + PERIODS.map(function (p) {
    return '<span class="' + p.cls + '">' + p.k + '</span>';
  }).join('');

  var bodyRows = cfg.rows.map(function (r, ri) {
    var cells = PERIODS.map(function (p, pi) {
      var v = r.ret[pi];
      if (v == null) return '<span class="pm-ret na ' + p.cls + '">–</span>';
      return '<span class="pm-ret ' + (v >= 0 ? 'pos' : 'neg') + ' ' + p.cls +
             '" data-v="' + v + '">' + pct(0) + '</span>';
    }).join('');
    return '<div class="pm-row">' +
      '<span class="pm-strat"><b>' + r.style + ' &nbsp;🔒</b>' +
      '<span class="pm-mask">' + MASKS[ri % MASKS.length] + '</span></span>' +
      cells + '</div>';
  }).join('');

  var toggleBtns = [1, 3, 5].map(function (y, i) {
    var pi = PERIODS.map(function (p) { return p.y; }).indexOf(y);
    var disabled = cfg.rows[0].ret[pi] == null ? ' disabled' : '';
    return '<button type="button" data-y="' + y + '"' + (i === 0 ? ' class="on"' : '') + disabled + '>' +
           y + ' year' + (y > 1 ? 's' : '') + ' ago</button>';
  }).join('');

  host.innerHTML =
    '<div class="wrap"><div class="pm-perf">' +
      '<span class="pm-live"><i></i>Platform performance</span>' +
      '<div class="pm-perf-head">' +
        '<h3>' + cfg.title + '</h3>' +
        '<p class="pm-disc">Strategy and manager names are masked. Returns are trailing, ' +
        'annualised beyond one year, pre-tax and representative of strategies available on the platform' +
        (cfg.unitNote ? ' (' + cfg.unitNote + ')' : '') +
        '. Illustrative — <strong>past performance is not indicative of future results.</strong></p>' +
      '</div>' +
      '<div class="pm-table">' +
        '<div class="pm-row head">' + headCells + '</div>' +
        bodyRows +
      '</div>' +
      '<div class="pm-actions">' +
        '<a href="#enquiry" class="btn-gold">Talk to an expert to see the names &amp; factsheets →</a>' +
        '<span class="pm-lockmsg">🔒 500+ strategies on the platform — names &amp; factsheets on a call</span>' +
      '</div>' +
      '<div class="pm-calc">' +
        '<div>' +
          '<span class="pm-calc-cap">If you had invested</span>' +
          '<div class="pm-calc-amt">' + money(cfg.amount) + '</div>' +
          '<div class="pm-calc-toggle">' + toggleBtns + '</div>' +
        '</div>' +
        '<div>' +
          '<span class="pm-calc-cap">it could be worth today</span>' +
          '<div class="pm-calc-fig">' + money(cfg.amount) + '</div>' +
          '<div class="pm-calc-gain" id="pmGain"></div>' +
          '<div class="pm-calc-bar"><i class="p" style="width:100%"></i><i class="g" style="width:0"></i></div>' +
        '</div>' +
      '</div>' +
    '</div></div>';

  var retEls = [].slice.call(host.querySelectorAll('.pm-ret[data-v]'));
  var figEl = host.querySelector('.pm-calc-fig');
  var gainEl = host.querySelector('#pmGain');
  var barP = host.querySelector('.pm-calc-bar .p');
  var barG = host.querySelector('.pm-calc-bar .g');
  var toggle = host.querySelector('.pm-calc-toggle');
  var top = cfg.rows[0];

  function periodIndex(years) {
    return PERIODS.map(function (p) { return p.y; }).indexOf(years);
  }

  function tween(el, to, dur, render, from) {
    from = from || 0;
    var t0 = performance.now();
    (function frame(now) {
      var p = Math.min((now - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      render(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(frame);
      else render(to);
    })(t0);
  }

  function runCalc(years, animated) {
    var r = top.ret[periodIndex(years)];
    if (r == null) return;
    var fv = cfg.amount * Math.pow(1 + r / 100, years);
    var gain = fv - cfg.amount;
    var pw = (cfg.amount / fv) * 100;
    barP.style.width = pw + '%';
    barG.style.width = (100 - pw) + '%';
    gainEl.innerHTML = '<b>▲ ' + money(gain) + '</b> over ' + years + ' year' + (years > 1 ? 's' : '') +
      ' &nbsp;·&nbsp; ' + pct(r) + ' p.a. on the top-performing strategy shown &nbsp;·&nbsp; illustrative, pre-tax';
    if (animated && !reduce) {
      tween(figEl, fv, 700, function (v) { figEl.textContent = money(v); }, cfg.amount);
    } else {
      figEl.textContent = money(fv);
    }
  }

  toggle.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    [].forEach.call(toggle.children, function (b) { b.classList.toggle('on', b === btn); });
    runCalc(parseInt(btn.dataset.y, 10), true);
  });

  function reveal() {
    retEls.forEach(function (el) {
      var v = parseFloat(el.dataset.v);
      if (reduce) { el.textContent = pct(v); return; }
      tween(el, v, 1000, function (n) { el.textContent = pct(n); });
    });
    runCalc(1, !reduce);
    if (!reduce) startFlicker();
  }

  // subtle "live NAV" cue — nudge one 1Y figure every few seconds
  function startFlicker() {
    var firstCol = [];
    [].forEach.call(host.querySelectorAll('.pm-row:not(.head)'), function (row) {
      var c = row.querySelector('.pm-ret');
      if (c && c.dataset.v) firstCol.push(c);
    });
    if (!firstCol.length) return;
    setInterval(function () {
      var el = firstCol[Math.floor(Math.random() * firstCol.length)];
      var base = parseFloat(el.dataset.v);
      var v = base + (Math.random() - 0.5) * 0.4;
      el.dataset.v = v.toFixed(2);
      el.textContent = pct(v);
      el.classList.toggle('pos', v >= 0);
      el.classList.toggle('neg', v < 0);
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 650);
    }, 3200);
  }

  if (reduce || !('IntersectionObserver' in window)) {
    reveal();
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { reveal(); io.disconnect(); }
    });
  }, { threshold: 0.3 });
  io.observe(host);
})();
