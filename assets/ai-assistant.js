/* ==========================================================================
   myAlternates — site-wide AI assistant: a floating chat bubble a registered
   visitor can ask anything about any fund/AMC on the platform. Gated exactly
   like Discover/Talk-to-Expert: an anonymous visitor gets the same
   registration gate first; once verified, the question they were mid-typing
   is sent automatically so registering doesn't lose their place. On a scheme
   page, the current planId rides along so "this fund" resolves without the
   visitor having to name it.
   Every real question is a metered Anthropic API call server-side (see
   handlers-ext.js's askAssistant) — this widget itself does no AI work, it
   only talks to that one action.
   ========================================================================== */
(function () {
  var API_URL = 'https://myalternates-backend.onrender.com/';
  var messages = []; // {role: 'user'|'assistant'|'error', text}
  var pendingQuestion = null; // set while the gate modal is open, sent once verified
  var sending = false;
  var built = false;
  var panelOpen = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function currentPlanId() {
    var m = /[?&]id=(\d+)/.exec(location.search);
    return m ? Number(m[1]) : null;
  }

  function build() {
    if (built) return;
    built = true;
    var bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'ma-ai-bubble';
    bubble.setAttribute('aria-label', 'Ask myAlternates AI');
    bubble.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4.97 0-9 3.5-9 7.8 0 2.4 1.24 4.55 3.2 6-.15 1.1-.6 2.1-1.35 2.95 1.5.1 2.9-.3 4.1-1.1.66.14 1.35.15 2.05.15 4.97 0 9-3.5 9-7.8S16.97 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.6" cy="10.8" r="1" fill="currentColor"/><circle cx="12" cy="10.8" r="1" fill="currentColor"/><circle cx="15.4" cy="10.8" r="1" fill="currentColor"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'ma-ai-panel';
    panel.innerHTML =
      '<div class="ma-ai-head"><span>myAlternates Assistant</span><button type="button" class="ma-ai-close" aria-label="Close">✕</button></div>' +
      '<div class="ma-ai-body" id="maAiBody">' +
      '<div class="ma-ai-msg ma-ai-msg-assistant">Ask me about any PMS, AIF or GIFT City fund — returns, fees, tenure, min. investment, anything on the platform.</div>' +
      '</div>' +
      '<form class="ma-ai-form" id="maAiForm">' +
      '<input type="text" id="maAiInput" placeholder="Ask about a fund or AMC…" autocomplete="off">' +
      '<button type="submit" class="ma-ai-send" aria-label="Send">→</button>' +
      '</form>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    var body = panel.querySelector('#maAiBody');
    var form = panel.querySelector('#maAiForm');
    var input = panel.querySelector('#maAiInput');

    function renderMessages() {
      body.innerHTML = '<div class="ma-ai-msg ma-ai-msg-assistant">Ask me about any PMS, AIF or GIFT City fund — returns, fees, tenure, min. investment, anything on the platform.</div>' +
        messages.map(function (m) {
          var cls = m.role === 'user' ? 'ma-ai-msg-user' : m.role === 'error' ? 'ma-ai-msg-error' : 'ma-ai-msg-assistant';
          return '<div class="ma-ai-msg ' + cls + '">' + esc(m.text) + '</div>';
        }).join('');
      if (sending) body.innerHTML += '<div class="ma-ai-msg ma-ai-msg-assistant ma-ai-thinking"><span></span><span></span><span></span></div>';
      body.scrollTop = body.scrollHeight;
    }

    function openPanel() {
      panelOpen = true;
      panel.classList.add('open');
      bubble.classList.add('hide');
      setTimeout(function () { input.focus(); }, 200);
    }
    function closePanel() {
      panelOpen = false;
      panel.classList.remove('open');
      bubble.classList.remove('hide');
    }

    bubble.onclick = openPanel;
    panel.querySelector('.ma-ai-close').onclick = closePanel;

    function actuallyAsk(question) {
      var token = window.MASession && window.MASession.getToken && window.MASession.getToken();
      if (!token) {
        pendingQuestion = question;
        window.maOpenGateModal({
          message: 'Create your free account to chat with our AI assistant about any fund.',
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
