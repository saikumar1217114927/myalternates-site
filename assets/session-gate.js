/* ==========================================================================
   myAlternates — shared "register to unlock" gate.
   Used by featured-schemes.js and scheme-page.js to require the same
   verified-email identity lead-form.js manages (window.MASession) before
   showing real scheme data. Load lead-form.js first.
   ========================================================================== */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Renders a compact registration prompt into `container`; calls
  // onVerified(token, result) once the visitor verifies their email.
  window.maRenderGate = function (container, message, onVerified) {
    container.innerHTML =
      '<div class="ma-gate">' +
      '<div class="ma-gate-lock">🔒</div>' +
      '<h3>Register to view this</h3>' +
      '<p>' + esc(message) + '</p>' +
      '<form class="ma-gate-form"><input type="email" placeholder="you@email.com" required>' +
      '<button type="submit" class="btn-gold">Send code</button></form>' +
      '</div>';
    var form = container.querySelector('.ma-gate-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input').value.trim();
      if (!email) return;
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      window.MASession.requestOtp(email).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Send code';
          alert((r && r.error) || 'Could not send a code — please try again.');
          return;
        }
        showOtpStep(container, email, onVerified);
      });
    });
  };

  function showOtpStep(container, email, onVerified) {
    container.innerHTML =
      '<div class="ma-gate">' +
      '<div class="ma-gate-lock">🔒</div>' +
      '<h3>Verify your email</h3>' +
      '<p>We sent a 6-digit code to <b>' + esc(email) + '</b>.</p>' +
      '<form class="ma-gate-form ma-gate-otp"><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" required>' +
      '<button type="submit" class="btn-gold">Verify</button></form>' +
      '<button type="button" class="ma-gate-link" data-resend>Resend code</button>' +
      '<div class="ma-gate-err" style="display:none;"></div>' +
      '</div>';
    var form = container.querySelector('.ma-gate-form');
    var err = container.querySelector('.ma-gate-err');
    form.querySelector('input').focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var otp = form.querySelector('input').value.trim();
      if (!/^[0-9]{6}$/.test(otp)) { err.textContent = 'Enter the 6-digit code.'; err.style.display = 'block'; return; }
      err.style.display = 'none';
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Verifying…';
      window.MASession.verifyOtp(email, otp).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Verify';
          err.textContent = (r && r.error) || 'Could not verify — please try again.';
          err.style.display = 'block';
          return;
        }
        window.MASession.saveToken(r.sessionToken);
        onVerified(r.sessionToken, r);
      });
    });
    container.querySelector('[data-resend]').onclick = function (ev) {
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      window.MASession.requestOtp(email).then(function () {
        ev.target.disabled = false; ev.target.textContent = 'Resend code';
      });
    };
  }

  function fmtMtgDate(iso) {
    var d = new Date(String(iso || '') + 'T00:00:00');
    if (isNaN(d)) return String(iso || '');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  // A registered visitor's meeting state, rendered as a single clear action —
  // no free-text box: "Add this topic" fires immediately with a fixed note
  // (opts.discussionNote) naming what they were looking at.
  window.maRenderMeetingAction = function (container, token, sess, opts) {
    opts = opts || {};
    var mtg = sess.upcomingMeeting;
    if (mtg && mtg.date) {
      container.innerHTML =
        '<div class="ma-meeting">' +
        '<div class="ma-meeting-label">Your call is scheduled</div>' +
        '<div class="ma-meeting-when">' + esc(fmtMtgDate(mtg.date)) + (mtg.time ? ' · ' + esc(mtg.time) + ' IST' : '') + '</div>' +
        '<div class="ma-meeting-actions">' +
        '<button type="button" class="btn-ghost" data-resch>Reschedule</button>' +
        (opts.discussionNote ? '<button type="button" class="btn-gold" data-disc>+ Add this topic in the meeting</button>' : '') +
        '</div>' +
        '<div class="ma-meeting-ok" style="display:none;">Added — your expert will cover this on the call.</div>' +
        '</div>';
      container.querySelector('[data-resch]').onclick = function () {
        window.MASession.openSchedule(sess, mtg.meetingId, opts.interest);
      };
      var discBtn = container.querySelector('[data-disc]');
      if (discBtn) discBtn.onclick = function (e) {
        var btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Adding…';
        window.MASession.addDiscussionNote(token, opts.discussionNote).then(function (r) {
          if (!r || !r.ok) {
            btn.disabled = false; btn.textContent = '+ Add this topic in the meeting';
            alert((r && r.error) || 'Could not add — please try again.');
            return;
          }
          container.querySelector('.ma-meeting-actions').style.display = 'none';
          container.querySelector('.ma-meeting-ok').style.display = 'block';
        });
      };
    } else {
      container.innerHTML =
        '<div class="ma-meeting"><div class="ma-meeting-label">No call scheduled yet</div>' +
        '<button type="button" class="btn-gold" data-book>Schedule a call →</button></div>';
      container.querySelector('[data-book]').onclick = function () {
        window.MASession.openSchedule(sess, '', opts.interest);
      };
    }
  };
})();
