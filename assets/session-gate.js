/* ==========================================================================
   myAlternates — shared full registration gate + meeting-status widget.
   The schemes list itself is public; featured-schemes.js only calls
   maRenderFullGate when an anonymous visitor clicks "Discover" (in a
   modal), and scheme-page.js calls it as a fallback for a direct/shared
   scheme.html link with no session yet. Both register the same identity
   lead-form.js manages (window.MASession) — load lead-form.js first.
   ========================================================================== */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Full registration form (name, email, mobile, pincode) — a visitor fills
  // this once, verifies the emailed code, and is registered with the same
  // identity the enquiry form creates. Used wherever a visitor needs to
  // register before seeing gated content (currently: the Discover flow).
  // opts: { message, interest, onVerified(token, result) }.
  window.maRenderFullGate = function (container, opts) {
    opts = opts || {};
    container.innerHTML =
      '<div class="ma-gate ma-gate-full">' +
      '<div class="ma-gate-lock">🔒</div>' +
      '<h3>Register to continue</h3>' +
      (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') +
      '<form class="ma-full-form">' +
      '<input type="text" name="name" placeholder="Full name" required>' +
      '<input type="email" name="email" placeholder="you@email.com" required>' +
      '<div class="mgf-mobile"><span class="mgf-cc">+91</span><input type="tel" name="mobile" placeholder="Mobile number" pattern="[0-9]{6,14}" required></div>' +
      '<input type="text" name="pincode" placeholder="Pincode / ZIP" required>' +
      '<button type="submit" class="btn-gold">Continue →</button>' +
      '</form>' +
      '</div>';
    var form = container.querySelector('.ma-full-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = {
        name: form.name.value.trim(), email: form.email.value.trim(),
        mobileCountryCode: '+91', mobile: form.mobile.value.trim(),
        pincode: form.pincode.value.trim(), interest: opts.interest || ''
      };
      if (!lead.name || !lead.email || !lead.mobile || !lead.pincode) return;
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      window.MASession.requestOtp(lead.email).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Continue →';
          alert((r && r.error) || 'Could not send a code — please try again.');
          return;
        }
        showFullOtpStep(container, lead, opts.onVerified);
      });
    });
  };

  function showFullOtpStep(container, lead, onVerified) {
    container.innerHTML =
      '<div class="ma-gate ma-gate-full">' +
      '<div class="ma-gate-lock">🔒</div>' +
      '<h3>Verify your email</h3>' +
      '<p>We sent a 6-digit code to <b>' + esc(lead.email) + '</b>.</p>' +
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
      window.MASession.verifyOtp(lead.email, otp, lead).then(function (r) {
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
      window.MASession.requestOtp(lead.email).then(function () {
        ev.target.disabled = false; ev.target.textContent = 'Resend code';
      });
    };
  }

  function fmtMtgDate(iso) {
    var d = new Date(String(iso || '') + 'T00:00:00');
    if (isNaN(d)) return String(iso || '');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  // A registered visitor's meeting state — one compact horizontal row
  // (date/time, then Reschedule, then a small "+ Add topic" with a hover
  // tooltip explaining what it does) sitting level with the scheme name,
  // not a tall stacked card. No free-text box: "Add topic" fires
  // immediately with a fixed note (opts.discussionNote) naming what they
  // were looking at.
  window.maRenderMeetingAction = function (container, token, sess, opts) {
    opts = opts || {};
    var mtg = sess.upcomingMeeting;
    if (mtg && mtg.date) {
      // Already asked to discuss this exact topic at this meeting? The note
      // text is stamped and appended server-side, so a substring match holds
      // across refreshes — don't let "+ Add topic" re-enable (and risk a
      // duplicate note) until the meeting itself is over and a new one
      // starts (a fresh meeting carries no notes yet).
      var alreadyAdded = !!(opts.discussionNote && mtg.notes && mtg.notes.indexOf(opts.discussionNote) > -1);
      container.innerHTML =
        '<div class="ma-meeting-row">' +
        '<span class="mmr-badge">Upcoming meeting scheduled on <b>' + esc(fmtMtgDate(mtg.date)) + (mtg.time ? ' · ' + esc(mtg.time) + ' IST' : '') + '</b></span>' +
        '<button type="button" class="mmr-btn" data-resch>Reschedule</button>' +
        (opts.discussionNote ?
          (alreadyAdded ?
            '<span class="mmr-added">✓ Added</span>' :
            '<span class="mmr-add-wrap"><button type="button" class="mmr-add" data-disc>+ Add topic</button>' +
            '<span class="mmr-tip">If you add this, it\'ll be discussed with your expert in the upcoming meeting.</span></span>')
          : '') +
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
            btn.disabled = false; btn.textContent = '+ Add topic';
            alert((r && r.error) || 'Could not add — please try again.');
            return;
          }
          container.querySelector('.mmr-add-wrap').outerHTML = '<span class="mmr-added">✓ Added</span>';
        });
      };
    } else {
      container.innerHTML =
        '<div class="ma-meeting-row"><button type="button" class="mmr-btn mmr-btn-gold" data-book>Schedule a call →</button></div>';
      container.querySelector('[data-book]').onclick = function () {
        window.MASession.openSchedule(sess, '', opts.interest);
      };
    }
  };
})();
