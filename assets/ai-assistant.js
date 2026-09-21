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
  var API_URL = 'https://myalternates-backend.onrender.com/';
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

  (function injectStyles() {
    if (document.getElementById('maAiStyles')) return;
    var style = document.createElement('style');
    style.id = 'maAiStyles';
    style.textContent =
      '.ma-ai-bubble{position:fixed; right:26px; bottom:26px; z-index:70; width:62px; height:62px; border-radius:50%;' +
        'background:var(--ink); background-image:linear-gradient(135deg,#171B24,var(--ink)); color:var(--gold-light);' +
        'border:1.5px solid rgba(201,162,75,0.55); box-shadow:0 16px 36px -8px rgba(11,14,19,0.55); cursor:pointer;' +
        'display:flex; align-items:center; justify-content:center; transition:transform .18s ease, opacity .18s ease;}' +
      '.ma-ai-bubble::before{content:\'\'; position:absolute; inset:-6px; border-radius:50%; border:1.5px solid var(--gold);' +
        'opacity:.55; animation:maAiRing 2.6s ease-out infinite;}' +
      '.ma-ai-bubble svg{width:28px; height:28px; position:relative;}' +
      '.ma-ai-bubble:hover{transform:translateY(-2px);}' +
      '.ma-ai-bubble.hide{opacity:0; pointer-events:none; transform:scale(.7);}' +
      '@keyframes maAiRing{0%{transform:scale(1); opacity:.55;} 100%{transform:scale(1.35); opacity:0;}}' +
      '.ma-ai-panel{position:fixed; right:26px; bottom:26px; z-index:71; width:min(420px, calc(100vw - 32px));' +
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
      // Simple, ongoing attention-grabber: a little illustrated bot tucked
      // directly behind the launcher (lower z-index, same spot — fully
      // hidden at rest) peeks out every so often, holds a moment, then
      // ducks back out of sight. One continuous CSS loop, no per-cycle DOM
      // work — the peek direction (side vs. top) is randomized each lap by
      // toggling the --peek-x/--peek-y custom properties on the
      // 'animationiteration' event (see build()), not by juggling separate
      // keyframe sets. Hidden (and paused) while the chat panel is open.
      '.ma-ai-peekbot{position:fixed; right:40px; bottom:34px; z-index:69; width:34px; height:34px;' +
        '--peek-x:-70px; --peek-y:0px; transform:translate(0,0) scale(.5); opacity:0; pointer-events:none;' +
        'animation:maAiPeekaboo 9s ease-in-out infinite; transition:opacity .18s ease;}' +
      '.ma-ai-peekbot svg{width:100%; height:100%; display:block;}' +
      '.ma-ai-peekbot.hide{opacity:0 !important; animation-play-state:paused;}' +
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
        messages.map(function (m) {
          var cls = m.role === 'user' ? 'ma-ai-msg-user' : m.role === 'error' ? 'ma-ai-msg-error' : 'ma-ai-msg-assistant';
          return '<div class="ma-ai-msg ' + cls + '">' + esc(m.text) + '</div>';
        }).join('');
      if (sending) body.innerHTML += '<div class="ma-ai-msg ma-ai-msg-assistant ma-ai-thinking"><span></span><span></span><span></span></div>';
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
    // popping out from the exact same place every single time.
    var PEEK_DIRS = [
      { x: '-70px', y: '0px' },  // from the side
      { x: '0px', y: '-70px' }   // from the top
    ];
    function randomizePeekDir() {
      var d = PEEK_DIRS[Math.floor(Math.random() * PEEK_DIRS.length)];
      peekbot.style.setProperty('--peek-x', d.x);
      peekbot.style.setProperty('--peek-y', d.y);
    }
    randomizePeekDir();
    peekbot.addEventListener('animationiteration', randomizePeekDir);

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
        if (d && d.ok) messages.push({ role: 'assistant', text: d.answer });
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
