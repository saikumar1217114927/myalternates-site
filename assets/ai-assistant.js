/* ==========================================================================
   myAlternates — site-wide AI Assistant: a floating chat bubble a registered
   visitor can ask anything about any fund/AMC on the platform. Gated exactly
   like Discover/Talk-to-Expert: an anonymous visitor gets the same
   registration gate first; once verified, the question they were mid-typing
   is sent automatically so registering doesn't lose their place. On a scheme
   page, the current planId rides along so "this fund" resolves without the
   visitor having to name it.
   Every real question is a metered Anthropic API call server-side (see
   handlers-ext.js's askAssistant) — this widget itself does no AI work, it
   only talks to that one action.
   Ships its own <style> (see injectStyles) rather than relying on site.css —
   index.html doesn't load site.css at all (its own inline <style> block
   covers it instead), so a component styled only in site.css renders
   completely unstyled there. It does define the same CSS custom properties
   (--ink/--gold/--paper/etc.) as site.css, so this can safely lean on var()
   the same way session-gate.js's own injected styles already do.
   ========================================================================== */
(function () {
  var API_URL = 'https://myalternates-backend-c3u7.onrender.com/';
  var messages = []; // {role: 'user'|'assistant'|'error', text}
  var pendingQuestion = null; // set while the gate modal is open, sent once verified
  var sending = false;
  var built = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function currentPlanId() {
    var m = /[?&]id=(\d+)/.exec(location.search);
    return m ? Number(m[1]) : null;
  }

  // ---- reply formatting: escaped first, then only paragraphs / "- " and
  // "1. " lists / **bold** are turned into markup, so nothing in a reply can
  // inject HTML. ----
  function md(text) {
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    function flushList() {
      if (list) { out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; }
    }
    esc(text).split('\n').forEach(function (line) {
      var b = /^\s*[-•*]\s+(.*)$/.exec(line), n = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (b || n) {
        flushPara();
        var tag = b ? 'ul' : 'ol';
        if (!list || list.tag !== tag) { flushList(); list = { tag: tag, items: [] }; }
        list.items.push((b || n)[1]);
      } else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line); }
    });
    flushPara(); flushList();
    return out.join('').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  // ---- data cards (built from database numbers the backend sends with the
  // reply — see collectAssistantVisual in handlers-ext.js) ----
  function pctCell(v) {
    if (v == null || isNaN(v)) return '<td class="num na">NA</td>';
    return '<td class="num ' + (v >= 0 ? 'pos' : 'neg') + '">' + (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%</td>';
  }
  function schemeLink(planId, name) {
    return planId ? '<a href="scheme?id=' + encodeURIComponent(planId) + '">' + esc(name) + '</a>' : esc(name);
  }
  var RET_COLS = [['3M', 'r3m'], ['6M', 'r6m'], ['1Y', 'r1y'], ['2Y', 'r2y'], ['3Y', 'r3y'], ['5Y', 'r5y'], ['10Y', 'r10y'], ['SI', 'si']];
  var MINI_COLS = [['1Y', 'r1y'], ['3Y', 'r3y'], ['5Y', 'r5y']];

  // Compact version, inside the chat bubble.
  function visualCompact(v, ref) {
    var head = '', rows = '', title = v.title || '';
    if (v.type === 'rankSchemes') {
      head = '<tr><th>#</th><th>Scheme</th><th style="text-align:right;">Return</th></tr>';
      rows = v.rows.slice(0, 5).map(function (r) {
        return '<tr><td>' + r.rank + '</td><td>' + schemeLink(r.planId, r.schemeName) + '<span class="sub">' + esc(r.amcName) + '</span></td>' + pctCell(r.returnPct) + '</tr>';
      }).join('');
    } else if (v.type === 'rankManagers') {
      head = '<tr><th>#</th><th>Fund manager</th><th style="text-align:right;">Best return</th></tr>';
      rows = v.rows.slice(0, 5).map(function (r) {
        return '<tr><td>' + r.rank + '</td><td>' + esc(r.name) + '<span class="sub">' + esc(r.fundHouse || (r.schemes[0] && r.schemes[0].schemeName) || '') + '</span></td>' + pctCell(r.bestReturnPct) + '</tr>';
      }).join('');
    } else if (v.type === 'schemes') {
      title = v.schemes.length > 1 ? 'Comparison · returns' : 'Returns';
      head = '<tr><th>' + (v.schemes.length > 1 ? 'Scheme' : '') + '</th>' + MINI_COLS.map(function (c) { return '<th style="text-align:right;">' + c[0] + '</th>'; }).join('') + '</tr>';
      rows = v.schemes.map(function (s) {
        var r = '<tr><td>' + schemeLink(s.planId, s.schemeName) + '</td>' + MINI_COLS.map(function (c) { return pctCell(s.returns[c[1]]); }).join('') + '</tr>';
        if (v.schemes.length === 1 && s.benchmark && s.benchmark.name) {
          r += '<tr class="bench"><td>' + esc(s.benchmark.name) + '</td>' + MINI_COLS.map(function (c) { return pctCell(s.benchmark[c[1]]); }).join('') + '</tr>';
        }
        return r;
      }).join('');
    } else return '';
    return '<div class="ma-ai-vis"><div class="ma-ai-vis-title">' + esc(title) + '</div>' +
      '<table class="ma-ai-tbl"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>' +
      '<button type="button" class="ma-ai-full" data-vis="' + ref + '">⛶ View full</button></div>';
  }

  function barsHtml(items, label, weightKey, subFn) {
    if (!items || !items.length) return '<div class="ma-ai-bar-sub">No ' + label + ' data.</div>';
    var max = Math.max.apply(null, items.map(function (i) { return Number(i[weightKey]) || 0; }).concat([1]));
    return items.map(function (i) {
      var w = i[weightKey];
      var hasW = w != null && !isNaN(w);
      return '<div class="ma-ai-bar"><div class="ma-ai-bar-top"><span>' + esc(i.name) + '</span>' + (hasW ? '<b>' + Number(w).toFixed(2) + '%</b>' : '') + '</div>' +
        (subFn ? '<div class="ma-ai-bar-sub">' + esc(subFn(i)) + '</div>' : '') +
        (hasW ? '<div class="ma-ai-bar-track"><div class="ma-ai-bar-fill" style="width:' + Math.max(2, (w / max) * 100) + '%"></div></div>' : '') + '</div>';
    }).join('');
  }

  // Full version, in the pop-up.
  function visualFull(v) {
    if (v.type === 'rankSchemes') {
      return '<h3>' + esc(v.title) + '</h3><p class="ma-ai-ov-note">' + esc(v.order || '') + ' · past performance, not a prediction or recommendation.</p>' +
        '<table class="ma-ai-tbl"><thead><tr><th>#</th><th>Scheme</th><th>AMC</th><th>Category</th><th style="text-align:right;">Return</th><th>As of</th></tr></thead><tbody>' +
        v.rows.map(function (r) {
          return '<tr><td>' + r.rank + '</td><td>' + schemeLink(r.planId, r.schemeName) + '</td><td>' + esc(r.amcName) + '</td><td>' + esc(r.category || '—') + '</td>' +
            pctCell(r.returnPct) + '<td style="white-space:nowrap;">' + esc(r.asOf || '—') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (v.type === 'rankManagers') {
      return '<h3>' + esc(v.title) + '</h3><p class="ma-ai-ov-note">Ranked by the best-performing scheme each manager currently runs · past performance, not a recommendation.</p>' +
        '<table class="ma-ai-tbl"><thead><tr><th>#</th><th>Fund manager</th><th>Fund house</th><th style="text-align:right;">Best return</th><th>Scheme(s)</th></tr></thead><tbody>' +
        v.rows.map(function (r) {
          return '<tr><td>' + r.rank + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.fundHouse || '—') + '</td>' + pctCell(r.bestReturnPct) +
            '<td>' + r.schemes.map(function (s) {
              return schemeLink(s.planId, s.schemeName) + ' <span class="sub" style="display:inline;">' + (s.returnPct > 0 ? '+' : '') + Number(s.returnPct).toFixed(2) + '%</span>';
            }).join('<br>') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (v.type === 'schemes') {
      var many = v.schemes.length > 1;
      var retRows = v.schemes.map(function (s) {
        var r = '<tr><td>' + schemeLink(s.planId, s.schemeName) + '<span class="sub">' + esc(s.amcName) + '</span></td>' + RET_COLS.map(function (c) { return pctCell(s.returns[c[1]]); }).join('') + '</tr>';
        if (s.benchmark && s.benchmark.name) r += '<tr class="bench"><td>' + esc(s.benchmark.name) + '</td>' + RET_COLS.map(function (c) { return pctCell(s.benchmark[c[1]]); }).join('') + '</tr>';
        return r;
      }).join('');
      var asOf = v.schemes.map(function (s) { return s.asOf; }).filter(Boolean)[0] || '';
      var cols = function (fn) {
        return '<div class="ma-ai-grid">' + v.schemes.map(function (s) {
          return '<div class="ma-ai-col"><div class="ma-ai-col-head">' + esc(s.schemeName) + '</div>' + fn(s) + '</div>';
        }).join('') + '</div>';
      };
      return '<h3>' + (many ? 'Scheme comparison' : esc(v.schemes[0].schemeName)) + '</h3>' +
        '<p class="ma-ai-ov-note">' + (asOf ? 'Returns as of ' + esc(asOf) + ' · ' : '') + 'Under 1 year absolute, 1 year and over annualised · past performance, not a recommendation.</p>' +
        '<h4>Returns</h4><div style="overflow-x:auto;"><table class="ma-ai-tbl"><thead><tr><th></th>' +
        RET_COLS.map(function (c) { return '<th style="text-align:right;">' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + retRows + '</tbody></table></div>' +
        '<h4>Top holdings</h4>' + cols(function (s) { return barsHtml(s.holdings, 'holdings', 'weight', function (h) { return [h.sector, h.cap].filter(Boolean).join(' · '); }); }) +
        '<h4>Top sectors</h4>' + cols(function (s) { return barsHtml(s.sectors, 'sector', 'weight'); });
    }
    return '';
  }

  function openFull(v) {
    var ov = document.createElement('div');
    ov.className = 'ma-ai-ov';
    ov.innerHTML = '<div class="ma-ai-ov-box" role="dialog" aria-modal="true"><button type="button" class="ma-ai-ov-close" aria-label="Close">✕</button>' + visualFull(v) + '</div>';
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.ma-ai-ov-close').onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  }

  (function injectStyles() {
    if (document.getElementById('maAiStyles')) return;
    var style = document.createElement('style');
    style.id = 'maAiStyles';
    style.textContent =
      '.ma-ai-bubble{position:fixed; right:26px; bottom:26px; z-index:1300; width:62px; height:62px; border-radius:50%;' +
        'background:var(--ink); background-image:linear-gradient(135deg,#171B24,var(--ink)); color:var(--gold-light);' +
        'border:1.5px solid rgba(201,162,75,0.55); box-shadow:0 16px 36px -8px rgba(11,14,19,0.55); cursor:pointer;' +
        'display:flex; align-items:center; justify-content:center; transition:transform .18s ease, opacity .18s ease;}' +
      '.ma-ai-bubble::before{content:\'\'; position:absolute; inset:-6px; border-radius:50%; border:1.5px solid var(--gold);' +
        'opacity:.55; animation:maAiRing 2.6s ease-out infinite;}' +
      '.ma-ai-bubble svg{width:28px; height:28px; position:relative;}' +
      '.ma-ai-bubble:hover{transform:translateY(-2px);}' +
      '.ma-ai-bubble.hide{opacity:0; pointer-events:none; transform:scale(.7);}' +
      '@keyframes maAiRing{0%{transform:scale(1); opacity:.55;} 100%{transform:scale(1.35); opacity:0;}}' +
      '.ma-ai-panel{position:fixed; right:26px; bottom:26px; z-index:1301; width:min(420px, calc(100vw - 32px));' +
        'height:min(650px, calc(100vh - 48px)); background:#fff; border-radius:18px; overflow:hidden;' +
        'box-shadow:0 40px 90px -20px rgba(11,14,19,0.5); border:1px solid rgba(201,162,75,0.25);' +
        'display:flex; flex-direction:column; opacity:0; transform:translateY(20px) scale(.97); pointer-events:none;' +
        'transition:opacity .2s ease, transform .2s ease;}' +
      '.ma-ai-panel.open{opacity:1; transform:none; pointer-events:auto;}' +
      '.ma-ai-head{background:var(--ink); background-image:radial-gradient(120% 180px at 15% -20%, rgba(201,162,75,0.28), transparent 60%), linear-gradient(135deg,#0B0E13,#1B212B);' +
        'color:var(--gold-light); padding:20px 20px 18px; display:flex; align-items:center; gap:12px; flex:none;}' +
      '.ma-ai-head-icon{width:38px; height:38px; border-radius:50%; background:rgba(201,162,75,0.16); border:1px solid rgba(201,162,75,0.4);' +
        'display:flex; align-items:center; justify-content:center; flex:none;}' +
      '.ma-ai-head-icon svg{width:20px; height:20px;}' +
      '.ma-ai-head-text{flex:1 1 auto; min-width:0;}' +
      '.ma-ai-head-text b{display:block; font-size:15px; font-weight:700; color:var(--paper); letter-spacing:0.01em;}' +
      '.ma-ai-head-text span{display:block; font-size:11px; color:var(--muted-light); margin-top:2px;}' +
      '.ma-ai-close{background:none; border:none; color:var(--muted-light); font-size:15px; cursor:pointer; padding:4px 6px; flex:none; line-height:1;}' +
      '.ma-ai-close:hover{color:var(--paper);}' +
      '.ma-ai-body{flex:1 1 auto; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:12px; background:#fff;}' +
      '.ma-ai-msg{font-size:13.5px; line-height:1.6; padding:11px 14px; border-radius:14px; max-width:86%; white-space:pre-wrap;}' +
      '.ma-ai-msg-assistant{background:var(--paper-2); color:var(--ink-text); align-self:flex-start; border-bottom-left-radius:4px;}' +
      '.ma-ai-msg-user{background:var(--ink); background-image:linear-gradient(135deg,#171B24,var(--ink)); color:var(--paper);' +
        'align-self:flex-end; border-bottom-right-radius:4px; box-shadow:0 6px 16px -8px rgba(11,14,19,0.35);}' +
      '.ma-ai-msg-error{background:#FBE6E0; border:1px solid #E8B9A8; color:#8a3d24; align-self:flex-start;}' +
      '.ma-ai-thinking{display:flex; gap:4px; align-items:center; padding:13px 15px;}' +
      '.ma-ai-thinking span{width:6px; height:6px; border-radius:50%; background:var(--muted); animation:maAiPulse 1.1s ease-in-out infinite;}' +
      '.ma-ai-thinking span:nth-child(2){animation-delay:.15s;} .ma-ai-thinking span:nth-child(3){animation-delay:.3s;}' +
      '@keyframes maAiPulse{0%,80%,100%{opacity:.3; transform:scale(.85);} 40%{opacity:1; transform:scale(1);}}' +
      '.ma-ai-form{display:flex; gap:9px; padding:14px; border-top:1px solid var(--paper-2); background:#fff; flex:none;}' +
      '.ma-ai-form input{flex:1 1 auto; border:1px solid #E4DFD1; border-radius:11px; padding:11px 14px; font-size:13.5px;' +
        'font-family:inherit; outline:none; background:var(--paper-2); color:var(--ink-text);}' +
      '.ma-ai-form input:focus{border-color:var(--gold); background:#fff;}' +
      '.ma-ai-send{flex:none; width:40px; height:40px; border-radius:11px; background:var(--gold); color:var(--ink);' +
        'border:none; font-size:17px; font-weight:700; cursor:pointer; transition:background .15s ease;}' +
      '.ma-ai-send:hover{background:var(--gold-light);}' +
      '@media (max-width:600px){.ma-ai-bubble, .ma-ai-panel{right:14px; bottom:14px;}}' +
      // Assistant replies: light formatting (paragraphs, bullets, bold)
      // instead of raw pre-wrapped text, plus the data cards below.
      '.ma-ai-msg-assistant{white-space:normal;}' +
      '.ma-ai-msg-assistant p{margin:0 0 8px;} .ma-ai-msg-assistant p:last-child{margin-bottom:0;}' +
      '.ma-ai-msg-assistant ul, .ma-ai-msg-assistant ol{margin:0 0 8px; padding-left:18px;} .ma-ai-msg-assistant li{margin:2px 0;}' +
      '.ma-ai-msg-assistant b{font-weight:700; color:var(--ink-text);}' +
      '.ma-ai-msg.has-vis{max-width:100%; width:100%;}' +
      '.ma-ai-vis{margin-top:10px; background:#fff; border:1px solid #E8E2D2; border-radius:10px; padding:10px 10px 8px;}' +
      '.ma-ai-vis-title{font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;}' +
      '.ma-ai-tbl{width:100%; border-collapse:collapse; font-size:12px;}' +
      '.ma-ai-tbl th{font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); font-weight:700; text-align:left; padding:4px 6px; border-bottom:1px solid #EFEAE0;}' +
      '.ma-ai-tbl td{padding:6px; border-bottom:1px solid #F4F0E8; vertical-align:top;}' +
      '.ma-ai-tbl tr:last-child td{border-bottom:none;}' +
      '.ma-ai-tbl .num{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; font-weight:700;}' +
      '.ma-ai-tbl .pos{color:#15803D;} .ma-ai-tbl .neg{color:#B91C1C;} .ma-ai-tbl .na{color:var(--muted); font-weight:500;}' +
      '.ma-ai-tbl .sub{display:block; font-size:10.5px; color:var(--muted); font-weight:500;}' +
      '.ma-ai-tbl .bench td{color:var(--muted); font-style:italic;}' +
      '.ma-ai-tbl a{color:var(--ink-text); text-decoration:none; font-weight:700;} .ma-ai-tbl a:hover{text-decoration:underline;}' +
      '.ma-ai-full{margin-top:8px; background:none; border:1px solid #E4DFD1; border-radius:8px; padding:5px 10px; font:inherit;' +
        'font-size:11.5px; font-weight:700; color:var(--ink-text); cursor:pointer;}' +
      '.ma-ai-full:hover{border-color:var(--gold); background:var(--paper-2);}' +
      // "View full" pop-up (above the chat panel, below the site's own modals)
      '.ma-ai-ov{position:fixed; inset:0; z-index:1360; background:rgba(11,14,19,.6); display:flex; align-items:center; justify-content:center; padding:20px;}' +
      '.ma-ai-ov-box{position:relative; background:#fff; border-radius:16px; width:min(1000px,100%); max-height:88vh; overflow:auto; padding:26px 26px 22px;' +
        'box-shadow:0 40px 90px -20px rgba(11,14,19,.55);}' +
      '.ma-ai-ov-box h3{margin:0 0 4px; font-size:19px; color:var(--ink-text);}' +
      '.ma-ai-ov-note{font-size:11.5px; color:var(--muted); margin:0 0 16px;}' +
      '.ma-ai-ov-close{position:absolute; top:14px; right:14px; width:32px; height:32px; border-radius:50%; border:1px solid #E4DFD1; background:#fff; cursor:pointer; font-size:14px;}' +
      '.ma-ai-ov h4{margin:20px 0 8px; font-size:13px; color:var(--ink-text);}' +
      '.ma-ai-ov .ma-ai-tbl{font-size:13px;} .ma-ai-ov .ma-ai-tbl td{padding:8px;}' +
      '.ma-ai-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px;}' +
      '.ma-ai-col{border:1px solid #EFEAE0; border-radius:10px; padding:12px;}' +
      '.ma-ai-col-head{font-size:12.5px; font-weight:700; color:var(--ink-text); margin-bottom:8px;}' +
      '.ma-ai-bar{margin:0 0 8px;} .ma-ai-bar-top{display:flex; justify-content:space-between; gap:8px; font-size:12px;}' +
      '.ma-ai-bar-top b{font-variant-numeric:tabular-nums;} .ma-ai-bar-sub{font-size:10.5px; color:var(--muted);}' +
      '.ma-ai-bar-track{height:6px; background:#F1ECE1; border-radius:4px; margin-top:4px; overflow:hidden;}' +
      '.ma-ai-bar-fill{height:100%; background:var(--gold); border-radius:4px;}' +
      '@media (max-width:600px){.ma-ai-ov{padding:0;} .ma-ai-ov-box{width:100%; height:100%; max-height:none; border-radius:0; padding:20px 16px;}}' +
      // Simple, ongoing attention-grabber: a little illustrated bot tucked
      // directly behind the launcher (lower z-index, same spot — fully
      // hidden at rest) peeks out every so often, holds a moment, then
      // ducks back out of sight. One continuous CSS loop, no per-cycle DOM
      // work — the peek direction (side vs. top) is randomized each lap by
      // toggling the --peek-x/--peek-y custom properties on the
      // 'animationiteration' event (see build()), not by juggling separate
      // keyframe sets. Hidden (and paused) while the chat panel is open.
      '.ma-ai-peekbot{position:fixed; right:40px; bottom:34px; z-index:1299; width:34px; height:34px;' +
        '--peek-x:-70px; --peek-y:0px; transform:translate(0,0) scale(.5); opacity:0; pointer-events:none;' +
        'animation:maAiPeekaboo 9s ease-in-out infinite; transition:opacity .18s ease;}' +
      '.ma-ai-peekbot svg{width:100%; height:100%; display:block;}' +
      '.ma-ai-peekbot.hide{opacity:0 !important; animation-play-state:paused;}' +
      // The speech bubble is a child of the same animated container, so it
      // rides along with the bot (fades and moves with it) for free — no
      // separate positioning logic needed for the side vs. top case.
      '.ma-ai-peek-bubble{position:absolute; bottom:100%; left:50%; transform:translateX(-50%);' +
        'margin-bottom:9px; white-space:nowrap; background:var(--ink);' +
        'background-image:linear-gradient(135deg,#171B24,var(--ink)); color:var(--paper);' +
        'font-family:inherit; font-size:12px; font-weight:700; padding:7px 12px; border-radius:10px;' +
        'border:1px solid rgba(201,162,75,0.45); box-shadow:0 10px 24px -8px rgba(11,14,19,0.5);}' +
      '.ma-ai-peek-bubble::after{content:\'\'; position:absolute; top:100%; left:50%; transform:translateX(-50%);' +
        'width:0; height:0; border:5px solid transparent; border-top-color:var(--ink);}' +
      // 70px clears the launcher's own 62px width (plus its pulsing ring) in
      // either direction — anything smaller left the "peek" still hidden
      // behind the ring.
      '@keyframes maAiPeekaboo{' +
        '0%,68%{transform:translate(0,0) scale(.5); opacity:0;}' +
        '74%{opacity:1;}' +
        '80%,90%{transform:translate(var(--peek-x),var(--peek-y)) scale(1); opacity:1;}' +
        '96%,100%{transform:translate(0,0) scale(.5); opacity:0;}' +
      '}' +
      '@media (max-width:600px){.ma-ai-peekbot{right:28px; bottom:22px;}}' +
      '@media (prefers-reduced-motion: reduce){.ma-ai-bubble::before{animation:none; display:none;}' +
        '.ma-ai-peekbot{display:none;}}';
    document.head.appendChild(style);
  })();

  function build() {
    if (built) return;
    built = true;
    var bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'ma-ai-bubble';
    bubble.setAttribute('aria-label', 'Ask the myAlternates AI Assistant');
    bubble.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4.97 0-9 3.5-9 7.8 0 2.4 1.24 4.55 3.2 6-.15 1.1-.6 2.1-1.35 2.95 1.5.1 2.9-.3 4.1-1.1.66.14 1.35.15 2.05.15 4.97 0 9-3.5 9-7.8S16.97 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.6" cy="10.8" r="1" fill="currentColor"/><circle cx="12" cy="10.8" r="1" fill="currentColor"/><circle cx="15.4" cy="10.8" r="1" fill="currentColor"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'ma-ai-panel';
    panel.innerHTML =
      '<div class="ma-ai-head">' +
      '<div class="ma-ai-head-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.8 4.4 4.4 1.8-4.4 1.8L12 15l-1.8-4.5-4.4-1.8 4.4-1.8L12 2.5z" fill="currentColor"/><path d="M19 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" fill="currentColor"/></svg></div>' +
      '<div class="ma-ai-head-text"><b>myAlternates AI Assistant</b><span>Ask about any PMS, AIF or GIFT City fund</span></div>' +
      '<button type="button" class="ma-ai-close" aria-label="Close">✕</button></div>' +
      '<div class="ma-ai-body" id="maAiBody">' +
      '<div class="ma-ai-msg ma-ai-msg-assistant">Hi! Ask me about any fund or AMC on the platform — returns, fees, tenure, min. investment, anything we have data on.</div>' +
      '</div>' +
      '<form class="ma-ai-form" id="maAiForm">' +
      '<input type="text" id="maAiInput" placeholder="Ask about a fund or AMC…" autocomplete="off">' +
      '<button type="submit" class="ma-ai-send" aria-label="Send">→</button>' +
      '</form>';

    var peekbot = document.createElement('div');
    peekbot.className = 'ma-ai-peekbot';
    peekbot.setAttribute('aria-hidden', 'true');
    // A small illustrated bot (not a plain emoji) — rounded head, glowing
    // eyes, a smile, in the site's own ink/gold palette rather than a
    // generic cyan-on-white stock look.
    peekbot.innerHTML =
      '<div class="ma-ai-peek-bubble" id="maAiPeekBubble"></div>' +
      '<svg viewBox="0 0 40 40" aria-hidden="true">' +
      '<line x1="20" y1="2" x2="20" y2="6" stroke="var(--gold)" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="20" cy="1.6" r="1.6" fill="var(--gold)"/>' +
      '<rect x="5" y="11" width="3.5" height="6.5" rx="1.7" fill="#fff" stroke="var(--gold)" stroke-width="1"/>' +
      '<rect x="31.5" y="11" width="3.5" height="6.5" rx="1.7" fill="#fff" stroke="var(--gold)" stroke-width="1"/>' +
      '<rect x="8" y="6" width="24" height="17" rx="7.5" fill="#fff" stroke="var(--gold)" stroke-width="1.1"/>' +
      '<rect x="11.5" y="9.5" width="17" height="10.5" rx="4.5" fill="var(--ink)"/>' +
      '<circle cx="16.8" cy="14.8" r="1.9" fill="var(--gold-light)"/>' +
      '<circle cx="23.2" cy="14.8" r="1.9" fill="var(--gold-light)"/>' +
      '<path d="M17.8 17.6 Q20 19.4 22.2 17.6" stroke="var(--gold-light)" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
      '<path d="M12 24 Q20 20.6 28 24 L29.6 35 Q20 39 10.4 35 Z" fill="#fff" stroke="var(--gold)" stroke-width="1.1"/>' +
      '<path d="M11.6 29.5 Q20 32.2 28.4 29.5" stroke="var(--gold)" stroke-width="0.8" fill="none" opacity=".45"/>' +
      '</svg>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    document.body.appendChild(peekbot);

    var body = panel.querySelector('#maAiBody');
    var form = panel.querySelector('#maAiForm');
    var input = panel.querySelector('#maAiInput');

    function renderMessages() {
      body.innerHTML = '<div class="ma-ai-msg ma-ai-msg-assistant">Hi! Ask me about any fund or AMC on the platform — returns, fees, tenure, min. investment, anything we have data on.</div>' +
        messages.map(function (m, mi) {
          if (m.role !== 'assistant') {
            return '<div class="ma-ai-msg ' + (m.role === 'user' ? 'ma-ai-msg-user' : 'ma-ai-msg-error') + '">' + esc(m.text) + '</div>';
          }
          var vis = (m.visuals || []).map(function (v, vi) { return visualCompact(v, mi + ':' + vi); }).join('');
          return '<div class="ma-ai-msg ma-ai-msg-assistant' + (vis ? ' has-vis' : '') + '">' + md(m.text) + vis + '</div>';
        }).join('');
      if (sending) body.innerHTML += '<div class="ma-ai-msg ma-ai-msg-assistant ma-ai-thinking"><span></span><span></span><span></span></div>';
      body.querySelectorAll('[data-vis]').forEach(function (b) {
        b.onclick = function () {
          var p = b.getAttribute('data-vis').split(':');
          var m = messages[+p[0]];
          if (m && m.visuals && m.visuals[+p[1]]) openFull(m.visuals[+p[1]]);
        };
      });
      body.scrollTop = body.scrollHeight;
    }

    function openPanel() {
      panel.classList.add('open');
      bubble.classList.add('hide');
      peekbot.classList.add('hide');
      setTimeout(function () { input.focus(); }, 200);
    }
    function closePanel() {
      panel.classList.remove('open');
      bubble.classList.remove('hide');
      peekbot.classList.remove('hide');
    }

    bubble.onclick = openPanel;
    panel.querySelector('.ma-ai-close').onclick = closePanel;

    // Alternates the peekbot's hiding spot each lap — from the side, then
    // from the top, picked fresh right as each 9s loop restarts (see the
    // maAiPeekaboo keyframes, which read --peek-x/--peek-y) — instead of
    // popping out from the exact same place every single time. The speech
    // bubble (a child of the same animated container — see injectStyles)
    // rides along automatically and gets a fresh line of copy each lap too.
    var PEEK_DIRS = [
      { x: '-70px', y: '0px' },  // from the side
      { x: '0px', y: '-70px' }   // from the top
    ];
    var PEEK_LINES = ['Hey! I\'m here 👋', '👋 I\'m your AI, here!'];
    var peekBubble = peekbot.querySelector('#maAiPeekBubble');
    function randomizePeek() {
      var d = PEEK_DIRS[Math.floor(Math.random() * PEEK_DIRS.length)];
      peekbot.style.setProperty('--peek-x', d.x);
      peekbot.style.setProperty('--peek-y', d.y);
      peekBubble.textContent = PEEK_LINES[Math.floor(Math.random() * PEEK_LINES.length)];
    }
    randomizePeek();
    peekbot.addEventListener('animationiteration', randomizePeek);

    function actuallyAsk(question) {
      var token = window.MASession && window.MASession.getToken && window.MASession.getToken();
      if (!token) {
        pendingQuestion = question;
        window.maOpenGateModal({
          message: 'Create your free account to chat with our AI Assistant about any fund.',
          interest: 'AI assistant',
          onVerified: function (t, r, lead, close) {
            close();
            openPanel();
            var q = pendingQuestion; pendingQuestion = null;
            if (q) send(q);
          }
        });
        return;
      }
      send(question);
    }

    function send(question) {
      messages.push({ role: 'user', text: question });
      sending = true;
      renderMessages();
      var token = window.MASession.getToken();
      var payload = { action: 'askAssistant', token: token, question: question };
      var planId = currentPlanId();
      if (planId) payload.planId = planId;
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (d) {
        sending = false;
        if (d && d.ok) messages.push({ role: 'assistant', text: d.answer, visuals: Array.isArray(d.visuals) ? d.visuals : [] });
        else messages.push({ role: 'error', text: (d && d.error) || "Something went wrong — please try again." });
        renderMessages();
      }).catch(function () {
        sending = false;
        messages.push({ role: 'error', text: "Couldn't reach the assistant — please check your connection and try again." });
        renderMessages();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q || sending) return;
      input.value = '';
      actuallyAsk(q);
    });
  }

  // Built once, lazily, the first time any page is interactive — cheap
  // (a hidden button + panel) and every page gets the same widget for free.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
