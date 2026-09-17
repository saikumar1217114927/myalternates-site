/* ==========================================================================
   myAlternates — "your call is scheduled" info line, shown opposite the
   "Explore PMS Schemes" heading (in the schemes section built by
   featured-schemes.js) once a registered visitor has an upcoming call.
   That section renders async — after its own schemes fetch — so this
   doesn't run on script load; featured-schemes.js calls
   window.maInitHeroMeetingInfo() itself once #heroMeetingInfo actually
   exists in the DOM. The hero CTA text swap ("Talk to an expert" ->
   "Reschedule") is handled generically by session-gate.js for every
   data-ma-talk element on the page — this file only owns this one line.
   ========================================================================== */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtWhen(iso) {
    var d = new Date(String(iso || '') + 'T00:00:00');
    if (isNaN(d)) return String(iso || '');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  function render(info, sess) {
    var mtg = sess.upcomingMeeting;
    if (!mtg || !mtg.date) { info.innerHTML = ''; return; } // no call yet

    var interest = 'Portfolio Management Services (PMS)'; // this widget is PMS-only
    var already = MASession.hasFlaggedInterest(interest);
    info.innerHTML =
      '<span class="hmi-when">📅 Your call: <b>' + esc(fmtWhen(mtg.date)) + (mtg.time ? ' · ' + esc(mtg.time) : '') + '</b></span>' +
      (already
        ? '<span class="hmi-added">✓ ' + esc(interest) + ' added</span>'
        : '<button type="button" class="hmi-add" id="hmiAdd">+ Add ' + esc(interest) + '</button>');

    var addBtn = info.querySelector('#hmiAdd');
    if (addBtn) addBtn.onclick = function () {
      addBtn.disabled = true; addBtn.textContent = 'Adding…';
      MASession.addInterest(sess, interest).then(function (r) {
        if (r && r.ok && r.found) {
          info.querySelector('#hmiAdd').outerHTML = '<span class="hmi-added">✓ ' + esc(interest) + ' added</span>';
        } else {
          addBtn.disabled = false; addBtn.textContent = '+ Add ' + esc(interest);
        }
      });
    };
  }

  function load() {
    var info = document.getElementById('heroMeetingInfo');
    if (!info || !window.MASession) return;
    var token = MASession.getToken();
    if (!token) return;
    MASession.checkStatus(token).then(function (r) {
      if (r && r.ok && r.loggedIn) render(info, r);
    });
  }

  window.maInitHeroMeetingInfo = load;
  document.addEventListener('ma:scheduled', function (e) {
    if (e.detail && e.detail.scheduled) load();
  });
})();
