/* ==========================================================================
   myAlternates — "your call is scheduled" info, shown either side of the
   Talk to an expert/Reschedule button opposite the "Explore <Product>
   Schemes" heading (in the schemes section built by featured-schemes.js)
   once a registered visitor has an upcoming call: the date pill in
   #heroMeetingWhen, and the "+ Add Topic" control in #heroMeetingAdd, so the
   button sits visually between them. That section renders async — after its
   own schemes fetch — so this doesn't run on script load; featured-schemes.js
   calls window.maInitHeroMeetingInfo(interest) itself once those elements
   actually exist in the DOM, passing the page's own interest label (PMS/
   AIF/GIFT City products — this file is shared across all three, not
   PMS-only). The CTA text swap ("Talk to an expert" -> "Reschedule") is
   handled generically by session-gate.js for every data-ma-talk element on
   the page — this file only owns these two pieces.
   ========================================================================== */
(function () {
  var lastInterest = 'Portfolio Management Services (PMS)'; // remembered for the ma:scheduled re-render below

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

  function render(whenEl, addEl, sess, interest) {
    var mtg = sess.upcomingMeeting;
    if (!mtg || !mtg.date) { whenEl.innerHTML = ''; addEl.innerHTML = ''; return; } // no call yet

    whenEl.innerHTML =
      '<span class="hmi-when">📅 Your call: <b>' + esc(fmtWhen(mtg.date)) + (mtg.time ? ' · ' + esc(mtg.time) : '') + '</b></span>';

    var already = MASession.hasFlaggedInterest(interest);
    addEl.innerHTML = already
      ? '<span class="hmi-added">✓ ' + esc(interest) + ' added</span>'
      : '<button type="button" class="hmi-add" id="hmiAdd" title="If you select this, it will be discussed in your next meeting.">+ Add Topic</button>';

    var addBtn = addEl.querySelector('#hmiAdd');
    if (addBtn) addBtn.onclick = function () {
      addBtn.disabled = true; addBtn.textContent = 'Adding…';
      MASession.addInterest(sess, interest).then(function (r) {
        if (r && r.ok && r.found) {
          addEl.innerHTML = '<span class="hmi-added">✓ ' + esc(interest) + ' added</span>';
        } else {
          addBtn.disabled = false; addBtn.textContent = '+ Add Topic';
        }
      });
    };
  }

  function load(interest) {
    if (interest) lastInterest = interest;
    var whenEl = document.getElementById('heroMeetingWhen');
    var addEl = document.getElementById('heroMeetingAdd');
    if (!whenEl || !addEl || !window.MASession) return;
    var token = MASession.getToken();
    if (!token) return;
    MASession.checkStatus(token).then(function (r) {
      if (r && r.ok && r.loggedIn) render(whenEl, addEl, r, lastInterest);
    });
  }

  window.maInitHeroMeetingInfo = load;
  document.addEventListener('ma:scheduled', function (e) {
    if (e.detail && e.detail.scheduled) load();
  });
})();
