/* ==========================================================================
   myAlternates — compact "your call is scheduled" state in the hero.
   Once a registered visitor has an upcoming call, the page's own hero CTA
   ("Talk to an expert →") becomes "Reschedule →" and a small line under it
   shows the date/time plus a one-click "add this interest".
   ========================================================================== */
(function () {
  var ctaBtn = document.getElementById('heroTalkBtn');
  var info = document.getElementById('heroMeetingInfo');
  if (!ctaBtn || !info || !window.MASession) return;

  var token = MASession.getToken();
  if (!token) return;

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

  function render(sess) {
    var mtg = sess.upcomingMeeting;
    if (!mtg || !mtg.date) return; // no call yet — leave the normal CTA as-is

    var interest = 'Portfolio Management Services (PMS)'; // this widget is PMS-only

    ctaBtn.textContent = 'Reschedule →';
    ctaBtn.removeAttribute('href');
    ctaBtn.setAttribute('role', 'button');
    ctaBtn.style.cursor = 'pointer';
    ctaBtn.onclick = function (e) {
      e.preventDefault();
      MASession.openSchedule(sess, mtg.meetingId, interest);
    };

    var already = interest && MASession.hasFlaggedInterest(interest);
    info.innerHTML =
      '<span class="hmi-when">📅 Your call: <b>' + esc(fmtWhen(mtg.date)) + (mtg.time ? ' · ' + esc(mtg.time) : '') + '</b></span>' +
      (interest ? (already
        ? '<span class="hmi-added">✓ ' + esc(interest) + ' added</span>'
        : '<button type="button" class="hmi-add" id="hmiAdd">+ Add ' + esc(interest) + '</button>') : '');

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
    MASession.checkStatus(token).then(function (r) {
      if (r && r.ok && r.loggedIn) render(r);
    });
  }
  load();
  document.addEventListener('ma:scheduled', function (e) {
    if (e.detail && e.detail.scheduled) load();
  });
})();
