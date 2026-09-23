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

  // This widget's own CSS, self-injected the same way nav-search.js injects
  // its search box's styles — because this file is loaded on pages that link
  // assets/site.css (which normally carries these rules) AND on index.html,
  // which doesn't link site.css at all (it has its own inline <style> block).
  // Without this, maOpenGateModal still WORKS (the overlay element exists,
  // document.body.style.overflow still gets set to 'hidden') but renders
  // completely unstyled — position:static instead of a fixed full-screen
  // overlay, no background — so it's invisible, appended off-screen at the
  // bottom of the page, while scrolling stays silently locked: to a visitor
  // it looks exactly like nothing happened and the page just stopped
  // scrolling. index.html already defines the same --ink/--gold/... design
  // tokens site.css does, so these rules render identically either way.
  (function injectStyles() {
    if (document.getElementById('maGateStyles')) return;
    var style = document.createElement('style');
    style.id = 'maGateStyles';
    style.textContent =
      '.btn-gold{background:var(--gold); color:var(--ink) !important; padding:13px 30px; font-weight:700; font-size:14px;' +
        'border-radius:3px; letter-spacing:0.02em; display:inline-block; transition:background .2s ease, transform .2s ease;}' +
      '.btn-gold:hover{background:var(--gold-light); transform:translateY(-1px);}' +
      '.ma-gate{max-width:440px; margin:0 auto; text-align:center; background:var(--ink);' +
        'border:1px solid var(--line); border-radius:14px; padding:38px 30px; color:var(--paper);}' +
      '.ma-gate-logo{display:block; height:36px; width:auto; margin:0 auto 18px;}' +
      '.ma-gate h3{font-family:\'Fraunces\', Georgia, serif; font-weight:500; font-size:20px; color:var(--paper); margin-bottom:8px;}' +
      '.ma-gate p{font-size:14px; color:var(--muted-light); line-height:1.6; margin-bottom:22px;}' +
      '.ma-gate-form{display:flex; gap:10px;}' +
      '.ma-gate-form input{flex:1; min-width:0; padding:11px 13px; border:1px solid var(--line); border-radius:6px;' +
        'font-size:14px; font-family:inherit; color:var(--paper); background:var(--ink-2);}' +
      '.ma-gate-form input::placeholder{color:var(--muted-light);}' +
      '.ma-gate-form input:focus{outline:none; border-color:var(--gold);}' +
      '.ma-gate-form.ma-gate-otp input{text-align:center; letter-spacing:.3em; font-weight:700; font-size:17px;}' +
      '.ma-gate-form button{white-space:nowrap; border:none; border-radius:6px; cursor:pointer;}' +
      '.ma-gate-link{display:block; background:none; border:0; color:var(--muted-light); font-size:12.5px;' +
        'text-decoration:underline; cursor:pointer; margin:12px auto 0;}' +
      '.ma-gate-link-gold{display:inline-block; background:var(--gold); color:var(--ink) !important; border:0;' +
        'font-size:13px; font-weight:700; text-decoration:none; cursor:pointer; padding:9px 20px; border-radius:20px;' +
        'margin:16px auto 0; transition:background .2s ease, transform .2s ease;}' +
      '.ma-gate-link-gold:hover{background:var(--gold-light); transform:translateY(-1px);}' +
      '.ma-gate-err{color:#ff9376; font-size:13px; margin-top:12px;}' +
      '@media (max-width:480px){ .ma-gate-form{flex-direction:column;} }' +
      '.ma-gate-full{max-width:400px;}' +
      '.ma-full-form{display:flex; flex-direction:column; gap:12px; text-align:left;}' +
      '.ma-full-form input, .ma-full-form select{width:100%; box-sizing:border-box; padding:11px 13px;' +
        'border:1px solid var(--line); border-radius:6px; font-size:14px; font-family:inherit; color:var(--paper); background:var(--ink-2);}' +
      '.ma-full-form input::placeholder{color:var(--muted-light);}' +
      '.ma-full-form select{appearance:none; -webkit-appearance:none; cursor:pointer; background-color:var(--ink-2);' +
        'background-image:url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%239A9E9C"><path d="M5.5 7.5l4.5 5 4.5-5z"/></svg>\');' +
        'background-repeat:no-repeat; background-position:right 12px center; background-size:14px; padding-right:32px;}' +
      '.ma-full-form select option{color:var(--paper); background:var(--ink-2);}' +
      '.ma-full-form input:focus, .ma-full-form select:focus{outline:none; border-color:var(--gold);}' +
      '.mgf-mobile{display:flex; gap:8px;}' +
      '.mgf-mobile[hidden]{display:none;}' +
      '.mgf-cc{flex:0 0 108px;}' +
      '.mgf-mobile input{flex:1; min-width:0;}' +
      '.ma-full-form button{margin-top:4px; border:none; border-radius:6px; cursor:pointer; padding:12px; font-size:14.5px;}' +
      '.mgf-status{font-size:12px; color:var(--muted-light); margin-top:-6px;}' +
      '.mgf-status.ok{color:var(--emerald-light);}' +
      '.mgf-status.warn{color:var(--gold-light);}' +
      '@keyframes sched-in{from{opacity:0;} to{opacity:1;}}' +
      '.ma-modal-overlay{position:fixed; inset:0; z-index:2200; background:rgba(11,14,19,0.6); display:flex;' +
        'align-items:center; justify-content:center; padding:20px; animation:sched-in .2s ease;}' +
      '.ma-modal-card{position:relative; width:100%; max-width:440px; max-height:90vh; overflow-y:auto; background:var(--ink);' +
        'border-radius:18px; padding:8px; box-shadow:0 30px 70px -20px rgba(0,0,0,0.6);}' +
      '.ma-modal-card .ma-gate{border:none; box-shadow:none; margin:0; max-width:none;}' +
      '.ma-modal-close{position:absolute; top:14px; right:14px; width:32px; height:32px; border-radius:50%;' +
        'border:1px solid var(--line); background:var(--ink-2); color:var(--paper); font-size:14px; cursor:pointer;' +
        'display:flex; align-items:center; justify-content:center; z-index:1;}' +
      '.ma-modal-close:hover{border-color:var(--gold); color:var(--gold-light);}' +
      '.ma-meeting-row{display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end;}' +
      '.mmr-badge{font-size:12.5px; font-weight:500; color:var(--gold-light); white-space:nowrap;' +
        'background:rgba(201,162,75,0.14); border:1px solid rgba(201,162,75,0.32); padding:8px 14px; border-radius:999px;}' +
      '.mmr-badge b{font-weight:700; color:var(--paper); margin-left:2px;}' +
      '.mmr-btn{background:transparent; border:1px solid rgba(255,255,255,0.25); color:var(--paper); font-size:12.5px;' +
        'font-weight:600; padding:9px 16px; border-radius:9px; cursor:pointer; font-family:inherit; white-space:nowrap;' +
        'transition:border-color .15s ease, background .15s ease;}' +
      '.mmr-btn:hover{border-color:var(--gold);}' +
      '.mmr-btn-gold{background:var(--gold); color:var(--ink); border-color:var(--gold); font-weight:700;}' +
      '.mmr-btn-gold:hover{background:var(--gold-light);}' +
      '.mmr-add-wrap{position:relative; display:inline-flex;}' +
      '.mmr-add{background:var(--gold); color:var(--ink); border:none; font-weight:700; font-size:12.5px; padding:9px 16px;' +
        'border-radius:9px; cursor:pointer; font-family:inherit; white-space:nowrap;}' +
      '.mmr-add:hover{background:var(--gold-light);}' +
      '.mmr-add:disabled{opacity:.7; cursor:default;}' +
      '.mmr-tip{position:absolute; bottom:calc(100% + 9px); right:0; width:200px; background:var(--ink-2);' +
        'border:1px solid var(--line); color:var(--paper); font-size:11.5px; font-weight:400; line-height:1.5;' +
        'padding:10px 12px; border-radius:9px; text-align:left; box-shadow:0 12px 28px -10px rgba(0,0,0,0.55);' +
        'opacity:0; visibility:hidden; transform:translateY(4px); transition:opacity .15s ease, transform .15s ease;' +
        'pointer-events:none; z-index:5;}' +
      '.mmr-add-wrap:hover .mmr-tip, .mmr-add-wrap:focus-within .mmr-tip{opacity:1; visibility:visible; transform:translateY(0);}' +
      '.mmr-added{font-size:12.5px; font-weight:600; color:var(--emerald-light); white-space:nowrap;}';
    document.head.appendChild(style);
  })();

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
  // Country and mobile country-code stay fully independent (a visitor
  // abroad may still carry an Indian SIM, or the reverse) — this only warns
  // when the mobile code itself isn't India's, since that's genuinely the
  // one thing that changes what happens: DLT-templated SMS only reaches
  // Indian numbers, so anything else falls back to email-only verification.
  function wireMobileCcWarning(container) {
    var ccSel = container.querySelector('[name="mobileCc"]');
    var warn = container.querySelector('[data-cc-warn]');
    if (!ccSel || !warn) return;
    function update() {
      var iso = ccSel.options[ccSel.selectedIndex] && ccSel.options[ccSel.selectedIndex].getAttribute('data-iso');
      warn.hidden = (iso === 'IN');
    }
    ccSel.addEventListener('change', update);
    update();
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
    // No opts.message here — "Create your free account..." only makes sense
    // on the Register step; an existing user logging in doesn't need it.
    container.innerHTML =
      '<div class="ma-gate ma-gate-full">' +
      '<img class="ma-gate-logo" src="assets/logo-myalternates.png" alt="myAlternates">' +
      '<h3>Log in to continue</h3>' +
      '<form class="ma-gate-form">' +
      '<input type="text" name="contact" placeholder="Email or mobile number" required autocomplete="username">' +
      '<button type="submit" class="btn-gold">Continue →</button>' +
      '</form>' +
      '<div class="ma-gate-err" style="display:none;"></div>' +
      '<button type="button" class="ma-gate-link-gold" data-newuser>New User? Register</button>' +
      '</div>';
    var form = container.querySelector('.ma-gate-form');
    var err = container.querySelector('.ma-gate-err');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = form.contact.value.trim();
      if (!raw) return;
      err.style.display = 'none';
      var isEmail = raw.indexOf('@') > -1;
      var lead = {
        name: '', email: isEmail ? raw : '',
        mobileCountryCode: isEmail ? '' : '+91', mobile: isEmail ? '' : raw.replace(/\D+/g, ''),
        country: '', pincode: '', city: '', state: '', interest: opts.interest || ''
      };
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      window.MASession.requestOtp(lead.email, lead.mobileCountryCode, lead.mobile, true).then(function (r) {
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = 'Continue →';
          if (r && r.notFound) {
            // Just the plain message — "New here? Register" below already
            // covers switching steps, no need for a second, redundant link.
            err.textContent = "We couldn't find an account with that email or mobile. Please register using the link below.";
            err.style.display = 'block';
            return;
          }
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
      '<span class="mgf-status warn" data-cc-warn hidden>For international numbers, OTP will be sent to email.</span>' +
      '<select name="country" aria-label="Country">' + countryOptionsHtml(countries) + '</select>' +
      '<input type="text" name="pincode" placeholder="Pincode / ZIP" required>' +
      '<span class="mgf-status" data-status></span>' +
      '<div class="mgf-mobile" data-manual-location hidden>' +
      '<input type="text" name="city" placeholder="City">' +
      '<input type="text" name="state" placeholder="State">' +
      '</div>' +
      '<button type="submit" class="btn-gold">Continue →</button>' +
      '</form>' +
      '<button type="button" class="ma-gate-link" data-login>Already registered? Log in</button>' +
      '</div>';
    // Country and mobile country-code are deliberately independent — a
    // visitor might live abroad but still carry an Indian SIM (or vice
    // versa), so picking one must never silently overwrite the other.
    wireMobileCcWarning(container);
    var form = container.querySelector('.ma-full-form');
    wirePincodeLookup(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = {
        name: form.name.value.trim(), email: form.email.value.trim(),
        mobileCountryCode: form.mobileCc.value, mobile: form.mobile.value.trim(),
        country: form.country.options[form.country.selectedIndex].textContent,
        pincode: form.pincode.value.trim(),
        city: form.city.value.trim(), state: form.state.value.trim(),
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

  // Pincode -> city/state, same lookup (and same fallback) the landing
  // page's own enquiry form uses: auto-fills and hides the City/State
  // inputs when it resolves cleanly; when it doesn't (wrong/unrecognized
  // pincode), reveals those same inputs — pre-filled with whatever partial
  // match came back, if any — so the visitor can fill in or correct them
  // instead of the lookup just failing with no way forward.
  function wirePincodeLookup(form) {
    var pinInput = form.pincode, statusEl = form.querySelector('[data-status]');
    var manualRow = form.querySelector('[data-manual-location]');
    var pinDebounce = null, pinReqId = 0;
    function setStatus(text, kind) { statusEl.textContent = text || ''; statusEl.className = 'mgf-status' + (kind ? ' ' + kind : ''); }
    function showManual() { manualRow.hidden = false; }
    // Just hides the row — used after a SUCCESSFUL lookup, where city/state
    // were just filled in and must survive to the submitted payload.
    function hideManual() { manualRow.hidden = true; }
    // Hides the row AND clears stale values — used when the pincode itself is
    // changing (new keystroke, different country), so a resolved city/state
    // from a previous pincode doesn't linger and get submitted for this one.
    function resetManual() { hideManual(); form.city.value = ''; form.state.value = ''; }

    pinInput.addEventListener('input', function () {
      clearTimeout(pinDebounce);
      setStatus('', '');
      resetManual();
      var v = pinInput.value.trim();
      var country = form.country.value || 'IN';
      var ready = country === 'IN' ? v.length === 6 : v.length >= 3;
      if (!ready) { pinReqId++; return; }
      pinDebounce = setTimeout(function () {
        var reqId = ++pinReqId;
        setStatus('Looking up pincode…', 'loading');
        window.MASession.lookupPincode(v, country).then(function (loc) {
          if (reqId !== pinReqId) return; // superseded by a newer keystroke
          if (!loc.city || !loc.state) {
            form.city.value = loc.city || ''; form.state.value = loc.state || '';
            showManual();
            setStatus('Please confirm your city and state below.', 'warn');
            return;
          }
          form.city.value = loc.city; form.state.value = loc.state;
          hideManual();
          setStatus(loc.city + ', ' + loc.state, 'ok');
        });
      }, 400);
    });
    form.country.addEventListener('change', function () {
      pinReqId++; setStatus('', ''); resetManual();
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
            '<span class="mmr-add-wrap"><button type="button" class="mmr-add" data-disc>+ Add Interest</button>' +
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
            btn.disabled = false; btn.textContent = '+ Add Interest';
            alert((r && r.error) || 'Could not add — please try again.');
            return;
          }
          container.querySelector('.mmr-add-wrap').outerHTML = '<span class="mmr-added">✓ Added</span>';
        });
      };
    } else {
      // No meeting booked yet — a visitor who skipped the optional
      // scheduler at registration (openDiscoverGate/maOpenTalkToExpert)
      // still needs a way back to it here, so "Schedule a call" stays
      // alongside "+ Add Interest" (which just logs the request via
      // addInterest, independent of whether they ever book a time — shows
      // up in the admin's Recent Requests either way).
      var requested = !!(opts.discussionNote && (sess.pendingInterests || []).indexOf(opts.discussionNote) > -1);
      container.innerHTML =
        '<div class="ma-meeting-row">' +
        '<button type="button" class="mmr-btn mmr-btn-gold" data-book>Schedule a call →</button>' +
        (opts.discussionNote ?
          (requested ?
            '<span class="mmr-added">✓ Added</span>' :
            '<span class="mmr-add-wrap"><button type="button" class="mmr-add" data-interest>+ Add Interest</button>' +
            '<span class="mmr-tip">If you add this, our team will connect with you and walk you through it briefly.</span></span>')
          : '') +
        '</div>';
      container.querySelector('[data-book]').onclick = function () {
        window.MASession.openSchedule(sess, '', opts.interest);
      };
      var interestBtn = container.querySelector('[data-interest]');
      if (interestBtn) interestBtn.onclick = function (e) {
        var btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Adding…';
        window.MASession.addInterest(sess, opts.discussionNote).then(function (r) {
          if (!r || !r.ok) {
            btn.disabled = false; btn.textContent = '+ Add Interest';
            return;
          }
          container.querySelector('.mmr-add-wrap').outerHTML = '<span class="mmr-added">✓ Added</span>';
        });
      };
    }
  };

  // The modal overlay + full gate together, wherever registration is needed
  // as a popup rather than an inline section — the Discover flow and "Talk
  // to an Expert" both build the exact same modal this way.
  // gateOpts: { message, interest, onVerified(token, result, lead, close) }.
  window.maOpenGateModal = function (gateOpts) {
    // A double-click (or any caller invoking this twice before the first
    // overlay is on screen — e.g. a fast double-tap on a nav-search result)
    // would otherwise stack a second full-screen overlay on top of the
    // first. Closing the one you can see then reveals the other one still
    // covering the whole page — looks exactly like the screen is stuck.
    // One gate at a time: reuse whatever's already open instead of piling on.
    var already = document.querySelector('.ma-modal-overlay');
    if (already) return function () { already.remove(); document.body.style.overflow = ''; };

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
        // Mirror the already-logged-in branch above: a returning lead
        // logging in here may already have a call booked, and
        // verifyLeadOtp's response doesn't carry that — checkStatus gets
        // the real upcomingMeeting so this opens as "Reschedule" instead
        // of silently offering to book a second call.
        window.MASession.checkStatus(token).then(function (sess) {
          var mtg = sess && sess.ok && sess.upcomingMeeting;
          window.MASession.openSchedule(Object.assign({}, lead, r, sess && sess.ok ? sess : {}), (mtg && mtg.meetingId) || '', interest);
        });
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
  // token checks out live. It's a plain link to account.html (a full page)
  // now rather than a dropdown, so this widget only handles show/hide.
  function wireProfileIcon() {
    var wrap = document.getElementById('maProfile');
    if (!wrap) return;
    function load() {
      var token = window.MASession && window.MASession.getToken();
      if (!token) { wrap.hidden = true; return; }
      window.MASession.checkStatus(token).then(function (sess) {
        wrap.hidden = !(sess && sess.ok && sess.loggedIn);
      });
    }
    load();
    document.addEventListener('ma:scheduled', load);
  }

  // ---- account.html: the visitor's own details, as a full page ----
  // Used to be a small nav dropdown — moved to its own page because the
  // contact-edit + OTP flow below never fit that panel comfortably (and
  // deserved bigger type than a 280px popup allowed). A visitor who isn't
  // logged in yet sees the same .ma-gate.ma-gate-full login/register card
  // used site-wide right here instead of a separate empty state, and lands
  // straight on the full-size .acct-card the moment they verify.
  window.maRenderAccountPage = function (container) {
    var token = window.MASession && window.MASession.getToken();
    if (!token) { renderLoggedOut(container); return; }
    window.MASession.checkStatus(token).then(function (sess) {
      if (!sess || !sess.ok || !sess.loggedIn) { renderLoggedOut(container); return; }
      renderAccountCard(container, sess, token);
    });
  };

  function renderLoggedOut(container) {
    window.maRenderFullGate(container, {
      message: 'Log in to view and manage your account details.',
      onVerified: function (token) {
        window.MASession.checkStatus(token).then(function (sess) {
          if (sess && sess.ok) renderAccountCard(container, sess, token);
          else renderLoggedOut(container);
        });
      }
    });
  }

  function renderAccountCard(container, sess, token) {
    var expert = sess.expert;
    var firstName = (sess.name || '').trim().split(/\s+/)[0];
    var initial = esc((firstName || '?').charAt(0).toUpperCase());
    container.innerHTML =
      '<div class="acct-card">' +
      '<div class="acct-head">' +
      '<div class="acct-avatar">' + initial + '</div>' +
      '<div><div class="section-tag">Your account</div>' +
      '<div class="acct-greet">' + esc(firstName ? 'Hi, ' + firstName : 'Welcome back') + '</div></div>' +
      '</div>' +
      '<div class="acct-grid">' +
      '<div class="acct-col">' +
      '<div class="section-tag acct-section-title">Your details</div>' +
      contactRowHtml('email', sess.email) +
      contactRowHtml('mobile', (sess.mobileCountryCode ? sess.mobileCountryCode + ' ' : '') + (sess.mobile || '')) +
      '</div>' +
      (expert ? (
        '<div class="acct-col">' +
        '<div class="section-tag acct-section-title">Your expert</div>' +
        '<div class="acct-expert-row">' +
        (expert.photo
          ? '<img class="acct-expert-avatar" src="' + esc(expert.photo) + '" alt="">'
          : '<div class="acct-expert-avatar-fallback">' + esc((expert.name || '?').charAt(0)) + '</div>') +
        '<div>' +
        '<div class="acct-expert-name">' + esc(expert.name || '') + '</div>' +
        (expert.email ? '<div class="acct-expert-contact">' + esc(expert.email) + '</div>' : '') +
        (expert.mobile ? '<div class="acct-expert-contact">' + esc(expert.mobile) + '</div>' : '') +
        '</div></div></div>'
      ) : '') +
      '</div>' +
      '<button type="button" class="acct-signout" data-signout>Sign out</button>' +
      '</div>';
    container.querySelector('[data-signout]').onclick = function () {
      window.MASession.clearToken();
      location.href = './';
    };
    wireContactEdit(container, sess, token);
  }

  // The one place on the site email/mobile can be changed. Changing either
  // value requires proving you still control what's CURRENTLY on file: the
  // OTP goes to the existing email/mobile, never the new one being typed.
  // An existing mobile under a non-Indian code can't take an SMS OTP (same
  // DLT-template limit the registration OTP already works around) — the
  // mobile row warns about that before Send. The country-code dropdown on
  // the NEW mobile number is the same one the registration form itself
  // uses (countryOptionsHtml/dialCodeOptionsHtml's sibling here).
  function contactRowHtml(field, value) {
    return '<div class="acct-row" data-crow="' + field + '">' +
      '<div><div class="acct-row-label">' + (field === 'email' ? 'Email' : 'Mobile') + '</div>' +
      '<div class="acct-row-value">' + esc(value || '—') + '</div></div>' +
      '<button type="button" class="acct-edit" data-cedit="' + field + '">Edit</button></div>';
  }

  function wireContactEdit(container, sess, token) {
    container.querySelectorAll('[data-cedit]').forEach(function (b) {
      b.onclick = function () { openEditRow(container, b.getAttribute('data-cedit'), sess, token); };
    });
  }

  function rowEl(container, field) { return container.querySelector('[data-crow="' + field + '"]'); }

  function dialCodeOptions(selected) {
    var countries = (window.MASession && window.MASession.countries) || [];
    var dialCodes = (window.MASession && window.MASession.dialCodes) || {};
    return countries.map(function (c) {
      var code = dialCodes[c[0]];
      if (!code) return '';
      return '<option value="' + esc(code) + '" data-iso="' + esc(c[0]) + '"' + (code === selected ? ' selected' : '') + '>' + esc(c[0]) + ' ' + esc(code) + '</option>';
    }).join('');
  }

  // Shown above "Send code" on BOTH the email and mobile edit forms — a
  // lead editing either field could otherwise assume the code is going to
  // the NEW value they just typed. It always goes to whatever's CURRENTLY
  // on file instead (the same values requestContactChangeOtp itself sends
  // to), so this always reads sess.email/sess.mobile — never the new
  // input — and reads the same regardless of which field is being edited.
  function otpDestNote(sess) {
    var email = sess.email || '';
    var mobileCc = String(sess.mobileCountryCode || '+91').replace(/\D+/g, '');
    var mobileOk = mobileCc === '91' && sess.mobile;
    var mobile = mobileOk ? (sess.mobileCountryCode + ' ' + sess.mobile) : '';
    var dest = email && mobile
      ? 'to <b>' + esc(email) + '</b> and by SMS to <b>' + esc(mobile) + '</b>'
      : email ? 'to <b>' + esc(email) + '</b>'
      : mobile ? 'by SMS to <b>' + esc(mobile) + '</b>'
      : 'to your account';
    var intlNote = (sess.mobile && !mobileOk)
      ? ' Your mobile on file has an international code, so it can only be sent by email.'
      : '';
    return 'We’ll send a verification code ' + dest + ' — your <b>current</b>, already-verified contact, not the new value above. Nothing changes until you verify it.' + intlNote;
  }

  function openEditRow(container, field, sess, token) {
    var row = rowEl(container, field);
    var isEmail = field === 'email';
    row.classList.add('editing');
    row.innerHTML = '<div class="acct-row-label">' + (isEmail ? 'Email' : 'Mobile') + '</div>' +
      '<div class="acct-edit-row">' +
      '<div class="acct-edit-inputs">' +
      (isEmail ? '' : '<select class="acct-cc">' + dialCodeOptions(sess.mobileCountryCode || '+91') + '</select>') +
      '<input type="' + (isEmail ? 'email' : 'tel') + '" class="acct-new-val" placeholder="' + (isEmail ? 'New email address' : 'New mobile number') + '"></div>' +
      '<div class="acct-otp-note">' + otpDestNote(sess) + '</div>' +
      '<div class="acct-edit-err"></div>' +
      '<div class="acct-edit-actions"><button type="button" class="btn-gold" data-csend>Send code</button>' +
      '<button type="button" class="ma-gate-link" data-ccancel>Cancel</button></div></div>';

    var input = row.querySelector('.acct-new-val');
    var errEl = row.querySelector('.acct-edit-err');
    var ccSel = row.querySelector('.acct-cc');
    input.focus();

    function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
    row.querySelector('[data-ccancel]').onclick = function () { renderAccountCard(container, sess, token); };
    row.querySelector('[data-csend]').onclick = function () {
      var val = input.value.trim();
      if (isEmail && (!val || val.indexOf('@') < 1)) { showErr('Enter a valid email address.'); return; }
      if (!isEmail && val.replace(/\D/g, '').length < 6) { showErr('Enter a valid mobile number.'); return; }
      var newMobileCc = ccSel ? ccSel.value : '';
      var btn2 = row.querySelector('[data-csend]');
      btn2.disabled = true; btn2.textContent = 'Sending…';
      window.MASession.send({ action: 'requestContactChangeOtp', token: token, field: field, newValue: val, newMobileCc: newMobileCc })
        .then(function (r) {
          btn2.disabled = false; btn2.textContent = 'Send code';
          if (!r || !r.ok) { showErr((r && r.error) || 'Could not send a code — please try again.'); return; }
          showOtpStep(container, field, val, newMobileCc, r.sentTo, sess, token);
        });
    };
  }

  function showOtpStep(container, field, val, newMobileCc, sentTo, sess, token) {
    var row = rowEl(container, field);
    row.classList.add('editing');
    row.innerHTML = '<div class="acct-edit-row">' +
      '<div class="acct-edit-sent">Code sent to ' + esc(sentTo || 'your account') + '.</div>' +
      '<input type="text" class="acct-new-val" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" autocomplete="one-time-code">' +
      '<div class="acct-edit-err"></div>' +
      '<div class="acct-edit-actions"><button type="button" class="btn-gold" data-cverify>Verify &amp; save</button>' +
      '<button type="button" class="ma-gate-link" data-cresend>Resend</button>' +
      '<button type="button" class="ma-gate-link" data-ccancel>Cancel</button></div></div>';

    var codeInput = row.querySelector('.acct-new-val');
    var errEl = row.querySelector('.acct-edit-err');
    codeInput.focus();
    codeInput.addEventListener('input', function () { codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); });
    function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }

    row.querySelector('[data-ccancel]').onclick = function () { renderAccountCard(container, sess, token); };
    row.querySelector('[data-cresend]').onclick = function (e) {
      var b = e.currentTarget;
      b.disabled = true; b.textContent = 'Sending…';
      window.MASession.send({ action: 'requestContactChangeOtp', token: token, field: field, newValue: val, newMobileCc: newMobileCc })
        .then(function (r) {
          b.disabled = false; b.textContent = 'Resend';
          if (!r || !r.ok) { showErr((r && r.error) || 'Could not resend — please try again.'); return; }
          codeInput.value = ''; codeInput.focus();
        });
    };
    function doVerify() {
      var otp = codeInput.value.trim();
      if (!/^[0-9]{6}$/.test(otp)) { showErr('Enter the 6-digit code.'); return; }
      errEl.style.display = 'none';
      var vBtn = row.querySelector('[data-cverify]');
      vBtn.disabled = true; vBtn.textContent = 'Verifying…';
      window.MASession.send({ action: 'verifyContactChangeOtp', token: token, field: field, newValue: val, newMobileCc: newMobileCc, otp: otp })
        .then(function (r) {
          vBtn.disabled = false; vBtn.textContent = 'Verify & save';
          if (!r || !r.ok) { showErr((r && r.error) || 'Could not verify — please try again.'); return; }
          sess.email = r.email; sess.mobile = r.mobile; sess.mobileCountryCode = r.mobileCountryCode;
          renderAccountCard(container, sess, token);
        });
    }
    row.querySelector('[data-cverify]').onclick = doVerify;
    codeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doVerify(); } });
  }

  function initNavWidgets() {
    wireTalkToExpertLinks();
    wireProfileIcon();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNavWidgets);
  else initNavWidgets();
})();
