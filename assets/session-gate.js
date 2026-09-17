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

  // Country <option>s + a matching mobile dial-code <select>, built off the
  // same list lead-form.js exposes on window.MASession — one source of
  // truth for ~190 countries instead of a second copy here. Defaults both
  // to India and keeps them in sync (picking a country updates the dial
  // code, and vice versa) the same way the enquiry form's own fields do.
  function countryOptionsHtml(countries) {
    return countries.map(function (c) {
      return '<option value="' + esc(c[0]) + '"' + (c[0] === 'IN' ? ' selected' : '') + '>' + esc(c[1]) + '</option>';
    }).join('');
  }
  function dialCodeOptionsHtml(countries, dialCodes) {
    return countries.map(function (c) {
      var code = dialCodes[c[0]] || '';
      if (!code) return '';
      return '<option value="' + esc(code) + '" data-iso="' + esc(c[0]) + '"' + (c[0] === 'IN' ? ' selected' : '') + '>' +
        esc(c[0]) + ' ' + esc(code) + '</option>';
    }).join('');
  }
  function wireCountryDialSync(container) {
    var countrySel = container.querySelector('[name="country"]');
    var ccSel = container.querySelector('[name="mobileCc"]');
    countrySel.addEventListener('change', function () {
      for (var i = 0; i < ccSel.options.length; i++) {
        if (ccSel.options[i].getAttribute('data-iso') === countrySel.value) { ccSel.selectedIndex = i; break; }
      }
    });
    ccSel.addEventListener('change', function () {
      var iso = ccSel.options[ccSel.selectedIndex].getAttribute('data-iso');
      if (iso) countrySel.value = iso;
    });
  }

  // Entry point wherever a visitor needs to register/log in before seeing
  // gated content — the Discover flow, "Talk to an Expert" for an anonymous
  // visitor, and scheme.html's direct-link fallback. Defaults to the light
  // Login step (existing users are the common case reopening the site); a
  // link switches to the full Register step for someone genuinely new.
  // opts: { message, interest, onVerified(token, result) }.
  window.maRenderFullGate = function (container, opts) {
    opts = opts || {};
    renderLoginStep(container, opts);
  };

  // Existing-user path: just an identifier (either channel), no re-typing
  // name/pincode/etc. they already gave us. requestLeadOtp/verifyLeadOtp
  // both tolerate email OR mobile being blank, so whichever the visitor
  // typed here is all that's ever sent.
  function renderLoginStep(container, opts) {
    container.innerHTML =
      '<div class="ma-gate ma-gate-full">' +
      '<img class="ma-gate-logo" src="assets/logo-myalternates.png" alt="myAlternates">' +
      '<h3>Log in to continue</h3>' +
      (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') +
      '<form class="ma-gate-form">' +
      '<input type="text" name="contact" placeholder="Email or mobile number" required autocomplete="username">' +
      '<button type="submit" class="btn-gold">Continue →</button>' +
      '</form>' +
      '<button type="button" class="ma-gate-link" data-newuser>New here? Register</button>' +
      '</div>';
    var form = container.querySelector('.ma-gate-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = form.contact.value.trim();
      if (!raw) return;
      var isEmail = raw.indexOf('@') > -1;
      var lead = {
        name: '', email: isEmail ? raw : '',
        mobileCountryCode: isEmail ? '' : '+91', mobile: isEmail ? '' : raw.replace(/\D+/g, ''),
        country: '', pincode: '', city: '', state: '', interest: opts.interest || ''
      };
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      window.MASession.requestOtp(lead.email, lead.mobileCountryCode, lead.mobile).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Continue →';
          alert((r && r.error) || 'Could not send a code — please try again.');
          return;
        }
        showFullOtpStep(container, lead, opts.onVerified);
      });
    });
    container.querySelector('[data-newuser]').onclick = function () { renderRegisterStep(container, opts); };
  }

  // New-visitor path: the full form (name, email, mobile, country,
  // pincode) — same fields the enquiry form itself captures.
  function renderRegisterStep(container, opts) {
    var countries = (window.MASession && window.MASession.countries) || [];
    var dialCodes = (window.MASession && window.MASession.dialCodes) || {};
    container.innerHTML =
      '<div class="ma-gate ma-gate-full">' +
      '<img class="ma-gate-logo" src="assets/logo-myalternates.png" alt="myAlternates">' +
      '<h3>Register to continue</h3>' +
      (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') +
      '<form class="ma-full-form">' +
      '<input type="text" name="name" placeholder="Full name" required>' +
      '<input type="email" name="email" placeholder="you@email.com" required>' +
      '<div class="mgf-mobile">' +
      '<select class="mgf-cc" name="mobileCc" aria-label="Mobile country code">' + dialCodeOptionsHtml(countries, dialCodes) + '</select>' +
      '<input type="tel" name="mobile" placeholder="Mobile number" pattern="[0-9]{6,14}" required>' +
      '</div>' +
      '<select name="country" aria-label="Country">' + countryOptionsHtml(countries) + '</select>' +
      '<input type="text" name="pincode" placeholder="Pincode / ZIP" required>' +
      '<span class="mgf-status" data-status></span>' +
      '<button type="submit" class="btn-gold">Continue →</button>' +
      '</form>' +
      '<button type="button" class="ma-gate-link" data-login>Already registered? Log in</button>' +
      '</div>';
    wireCountryDialSync(container);
    var form = container.querySelector('.ma-full-form');
    var detectedLocation = { city: '', state: '' };
    wirePincodeLookup(form, detectedLocation);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = {
        name: form.name.value.trim(), email: form.email.value.trim(),
        mobileCountryCode: form.mobileCc.value, mobile: form.mobile.value.trim(),
        country: form.country.options[form.country.selectedIndex].textContent,
        pincode: form.pincode.value.trim(),
        city: detectedLocation.city, state: detectedLocation.state,
        interest: opts.interest || ''
      };
      if (!lead.name || !lead.email || !lead.mobile || !lead.pincode) return;
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      window.MASession.requestOtp(lead.email, lead.mobileCountryCode, lead.mobile).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Continue →';
          alert((r && r.error) || 'Could not send a code — please try again.');
          return;
        }
        showFullOtpStep(container, lead, opts.onVerified);
      });
    });
    container.querySelector('[data-login]').onclick = function () { renderLoginStep(container, opts); };
  }

  // Pincode -> city/state, same lookup the enquiry form uses. Display-only:
  // nothing is ever shown to type into — until it resolves, the status line
  // stays silent (or shows "Looking up…"); once resolved it just states the
  // city/state as text. A pincode ZipCodeBase can't place submits with
  // city/state blank rather than asking the visitor to fill them in by hand.
  function wirePincodeLookup(form, detected) {
    var pinInput = form.pincode, statusEl = form.querySelector('[data-status]');
    var pinDebounce = null, pinReqId = 0;
    function setStatus(text, kind) { statusEl.textContent = text || ''; statusEl.className = 'mgf-status' + (kind ? ' ' + kind : ''); }

    pinInput.addEventListener('input', function () {
      clearTimeout(pinDebounce);
      setStatus('', '');
      detected.city = ''; detected.state = '';
      var v = pinInput.value.trim();
      var country = form.country.value || 'IN';
      var ready = country === 'IN' ? v.length === 6 : v.length >= 3;
      if (!ready) { pinReqId++; return; }
      pinDebounce = setTimeout(function () {
        var reqId = ++pinReqId;
        setStatus('Looking up pincode…', 'loading');
        window.MASession.lookupPincode(v, country).then(function (loc) {
          if (reqId !== pinReqId) return; // superseded by a newer keystroke
          if (!loc.city || !loc.state) { setStatus('', ''); return; } // stays silent — nothing to show yet
          detected.city = loc.city; detected.state = loc.state;
          setStatus(loc.city + ', ' + loc.state, 'ok');
        });
      }, 400);
    });
    form.country.addEventListener('change', function () {
      pinReqId++; detected.city = ''; detected.state = ''; setStatus('', '');
    });
  }

  // One code, sent on both email and SMS at once (requestLeadOtp on the
  // backend) — the visitor enters whichever arrives first, no need to pick
  // a channel up front or switch between them.
  function showFullOtpStep(container, lead, onVerified) {
    var mobileLabel = (lead.mobileCountryCode || '') + ' ' + (lead.mobile || '');
    // The Login step only ever collects one of email/mobile — only mention
    // whichever channel(s) a code was actually sent to.
    var both = lead.email && lead.mobile;
    var dest = both
      ? 'to <b>' + esc(lead.email) + '</b> and by SMS to <b>' + esc(mobileLabel) + '</b>'
      : lead.email ? 'to <b>' + esc(lead.email) + '</b>' : 'by SMS to <b>' + esc(mobileLabel) + '</b>';
    container.innerHTML =
      '<div class="ma-gate ma-gate-full">' +
      '<img class="ma-gate-logo" src="assets/logo-myalternates.png" alt="myAlternates">' +
      '<h3>Verify your details</h3>' +
      '<p>We sent a 6-digit code ' + dest + (both ? ' — enter whichever arrives first.' : '.') + '</p>' +
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
      window.MASession.verifyOtp(lead.email, lead.mobileCountryCode, lead.mobile, otp, lead).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Verify';
          err.textContent = (r && r.error) || 'Could not verify — please try again.';
          err.style.display = 'block';
          return;
        }
        window.MASession.saveToken(r.sessionToken);
        // verifyLeadOtp's own response doesn't echo back email/mobile — it
        // only has the lead's id/name — so callers that need the full
        // identity (e.g. opening the scheduler right after) get the
        // just-submitted form values passed along too.
        onVerified(r.sessionToken, r, lead);
      });
    });
    container.querySelector('[data-resend]').onclick = function (ev) {
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      window.MASession.requestOtp(lead.email, lead.mobileCountryCode, lead.mobile).then(function () {
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

  // The modal overlay + full gate together, wherever registration is needed
  // as a popup rather than an inline section — the Discover flow and "Talk
  // to an Expert" both build the exact same modal this way.
  // gateOpts: { message, interest, onVerified(token, result, lead, close) }.
  window.maOpenGateModal = function (gateOpts) {
    var overlay = document.createElement('div');
    overlay.className = 'ma-modal-overlay';
    overlay.innerHTML = '<div class="ma-modal-card"><button type="button" class="ma-modal-close" aria-label="Close">✕</button><div class="ma-modal-body"></div></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    function close() { overlay.remove(); document.body.style.overflow = ''; }
    overlay.querySelector('.ma-modal-close').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    window.maRenderFullGate(overlay.querySelector('.ma-modal-body'), {
      message: gateOpts.message,
      interest: gateOpts.interest,
      onVerified: function (token, r, lead) { gateOpts.onVerified(token, r, lead, close); }
    });
    return close;
  };

  // "Talk to an Expert" — an already-registered visitor goes straight to the
  // scheduler (reschedule if they already have a call, else book one); an
  // anonymous visitor sees the same registration popup Discover uses first,
  // then lands in the scheduler right after verifying.
  window.maOpenTalkToExpert = function (interest) {
    var token = window.MASession && window.MASession.getToken();
    if (token) {
      window.MASession.checkStatus(token).then(function (sess) {
        if (!sess || !sess.ok) return;
        window.MASession.openSchedule(sess, (sess.upcomingMeeting && sess.upcomingMeeting.meetingId) || '', interest);
      });
      return;
    }
    window.maOpenGateModal({
      message: 'Create your free account and we\'ll set up a call with a myAlternates investment expert.',
      interest: interest,
      onVerified: function (token, r, lead, close) {
        close();
        window.MASession.openSchedule(Object.assign({}, lead, r), '', interest);
      }
    });
  };

  // Every "Talk to an Expert" link (nav + hero CTAs) reads "Reschedule"
  // instead once the visitor has an upcoming call — until then it's left
  // exactly as authored. Applies to every data-ma-talk element on the page
  // uniformly (not just the hero), so pms.html and aif.html both get this
  // for free without a page-specific widget for each.
  function applyTalkToExpertLabels(links, scheduled) {
    links.forEach(function (el) {
      if (!el.hasAttribute('data-ma-talk-orig')) el.setAttribute('data-ma-talk-orig', el.textContent);
      var orig = el.getAttribute('data-ma-talk-orig');
      el.textContent = scheduled ? ('Reschedule' + (/→\s*$/.test(orig) ? ' →' : '')) : orig;
    });
  }
  function refreshTalkToExpertState(links) {
    var token = window.MASession && window.MASession.getToken();
    if (!token) { applyTalkToExpertLabels(links, false); return; }
    window.MASession.checkStatus(token).then(function (sess) {
      applyTalkToExpertLabels(links, !!(sess && sess.ok && sess.loggedIn && sess.upcomingMeeting && sess.upcomingMeeting.date));
    });
  }

  // Auto-wire every "Talk to an Expert" link marked up with data-ma-talk="
  // <interest>" (nav + hero CTAs on pms.html/aif.html) to the flow above,
  // instead of just following its href="#schemes" fallback. Uses .onclick
  // (a plain property, not addEventListener) so nothing can double-fire.
  // Exposed as window.maWireTalkToExpertLinks so a page-specific widget
  // that injects its OWN data-ma-talk element later (e.g. featured-
  // schemes.js's schemes-header CTA, built async after its own fetch) can
  // re-run this once that element actually exists in the DOM — the initial
  // pass here only ever sees what's already on the page at load time.
  function wireTalkToExpertLinks() {
    var links = document.querySelectorAll('[data-ma-talk]');
    if (!links.length) return;
    links.forEach(function (el) {
      el.onclick = function (e) {
        e.preventDefault();
        window.maOpenTalkToExpert(el.getAttribute('data-ma-talk'));
      };
    });
    refreshTalkToExpertState(links);
    document.addEventListener('ma:scheduled', function () { refreshTalkToExpertState(links); });
  }
  window.maWireTalkToExpertLinks = wireTalkToExpertLinks;

  // Registered-visitor profile icon (id="maProfile") next to the Talk to an
  // Expert CTA — hidden for an anonymous visitor, shown once a session
  // token checks out live. Its panel shows the visitor's own registered
  // details and, if one's assigned and opted into lead-facing display,
  // their expert's photo + contact info.
  function wireProfileWidget() {
    var wrap = document.getElementById('maProfile');
    var btn = document.getElementById('maProfileBtn');
    var panel = document.getElementById('maProfilePanel');
    if (!wrap || !btn || !panel) return;

    function renderPanel(sess) {
      var expert = sess.expert;
      panel.innerHTML =
        '<div class="npp-section">' +
        '<div class="npp-label">Your details</div>' +
        '<div class="npp-name">' + esc(sess.name || 'Registered visitor') + '</div>' +
        (sess.email ? '<div class="npp-row">' + esc(sess.email) + '</div>' : '') +
        (sess.mobile ? '<div class="npp-row">' + esc(sess.mobileCountryCode || '') + ' ' + esc(sess.mobile) + '</div>' : '') +
        '</div>' +
        (expert ? (
          '<div class="npp-section npp-expert">' +
          '<div class="npp-label">Your expert</div>' +
          '<div class="npp-expert-row">' +
          (expert.photo
            ? '<img class="npp-avatar" src="' + esc(expert.photo) + '" alt="">'
            : '<div class="npp-avatar-fallback">' + esc((expert.name || '?').charAt(0)) + '</div>') +
          '<div>' +
          '<div class="npp-name">' + esc(expert.name || '') + '</div>' +
          (expert.email ? '<div class="npp-row">' + esc(expert.email) + '</div>' : '') +
          (expert.mobile ? '<div class="npp-row">' + esc(expert.mobile) + '</div>' : '') +
          '</div></div></div>'
        ) : '') +
        '<button type="button" class="npp-signout" data-signout>Sign out</button>';
      panel.querySelector('[data-signout]').onclick = function () {
        window.MASession.clearToken();
        location.reload();
      };
    }

    function load() {
      var token = window.MASession && window.MASession.getToken();
      if (!token) { wrap.hidden = true; panel.hidden = true; return; }
      window.MASession.checkStatus(token).then(function (sess) {
        if (!sess || !sess.ok || !sess.loggedIn) { wrap.hidden = true; panel.hidden = true; return; }
        wrap.hidden = false;
        renderPanel(sess);
      });
    }
    load();
    document.addEventListener('ma:scheduled', load);

    btn.onclick = function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
    };
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) panel.hidden = true;
    });
  }

  function initNavWidgets() {
    wireTalkToExpertLinks();
    wireProfileWidget();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNavWidgets);
  else initNavWidgets();
})();
