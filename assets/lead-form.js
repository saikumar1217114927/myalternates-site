/* ==========================================================================
   myAlternates — shared lead form for product pages.

   - Posts to the same Apps Script web app / Google Sheet as index.html.
   - Pincode auto-fills city/state via zipcodebase (same as index.html);
     falls back to a manual city/state row when the pincode can't be resolved.
   - Submit is optimistic: the lead POST fires immediately and the UI moves
     straight to the full-screen "schedule a call" step, so the button never
     appears to hang on the Apps Script round-trip.
   - The schedule step mirrors index.html (date scroller / time grid / mode)
     but is rendered as a full-screen page, not a small popup.

   Page contract:
     <form id="leadForm" data-interest="Portfolio Management Services (PMS)">
       #lf-name #lf-email #lf-cc #lf-mobile #lf-country #lf-pincode #lf-submit
     </form>
     <div class="form-success"> #lf-ok-title #lf-ok-body </div>
   ========================================================================== */
(function () {
  'use strict';

  var LEADS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzHAuxW3oxq7GX2fMa5YaMJDy_8jFSLsaob7A8VOdDMx_Hb3DsBnpAguCPyAtucw0Wt/exec';

  // Same location service index.html uses.
  var ZIPCODEBASE_API_KEY = 'e7760cf0-6fd0-11f1-85e2-ffa5f29d7b10';
  var ZIPCODEBASE_URL = 'https://app.zipcodebase.com/api/v1/search';

  var TIME_SLOTS = ['10:30 AM', '11:30 AM', '12:30 PM', '01:30 PM', '02:30 PM', '03:30 PM', '04:30 PM', '05:30 PM'];
  var MODES = ['Phone Call', 'Zoom Call', 'Google Meet'];

  var COUNTRIES = [
    ['AF','Afghanistan'],['AL','Albania'],['DZ','Algeria'],['AD','Andorra'],['AO','Angola'],
    ['AG','Antigua and Barbuda'],['AR','Argentina'],['AM','Armenia'],['AU','Australia'],['AT','Austria'],
    ['AZ','Azerbaijan'],['BS','Bahamas'],['BH','Bahrain'],['BD','Bangladesh'],['BB','Barbados'],
    ['BY','Belarus'],['BE','Belgium'],['BZ','Belize'],['BJ','Benin'],['BT','Bhutan'],
    ['BO','Bolivia'],['BA','Bosnia and Herzegovina'],['BW','Botswana'],['BR','Brazil'],['BN','Brunei'],
    ['BG','Bulgaria'],['BF','Burkina Faso'],['BI','Burundi'],['KH','Cambodia'],['CM','Cameroon'],
    ['CA','Canada'],['CV','Cape Verde'],['CF','Central African Republic'],['TD','Chad'],['CL','Chile'],
    ['CN','China'],['CO','Colombia'],['KM','Comoros'],['CG','Congo'],['CD','Congo (DRC)'],
    ['CR','Costa Rica'],['CI',"Côte d'Ivoire"],['HR','Croatia'],['CU','Cuba'],['CY','Cyprus'],
    ['CZ','Czech Republic'],['DK','Denmark'],['DJ','Djibouti'],['DM','Dominica'],['DO','Dominican Republic'],
    ['EC','Ecuador'],['EG','Egypt'],['SV','El Salvador'],['GQ','Equatorial Guinea'],['ER','Eritrea'],
    ['EE','Estonia'],['SZ','Eswatini'],['ET','Ethiopia'],['FJ','Fiji'],['FI','Finland'],
    ['FR','France'],['GA','Gabon'],['GM','Gambia'],['GE','Georgia'],['DE','Germany'],
    ['GH','Ghana'],['GR','Greece'],['GD','Grenada'],['GT','Guatemala'],['GN','Guinea'],
    ['GW','Guinea-Bissau'],['GY','Guyana'],['HT','Haiti'],['HN','Honduras'],['HK','Hong Kong'],
    ['HU','Hungary'],['IS','Iceland'],['IN','India'],['ID','Indonesia'],['IR','Iran'],
    ['IQ','Iraq'],['IE','Ireland'],['IL','Israel'],['IT','Italy'],['JM','Jamaica'],
    ['JP','Japan'],['JO','Jordan'],['KZ','Kazakhstan'],['KE','Kenya'],['KI','Kiribati'],
    ['KW','Kuwait'],['KG','Kyrgyzstan'],['LA','Laos'],['LV','Latvia'],['LB','Lebanon'],
    ['LS','Lesotho'],['LR','Liberia'],['LY','Libya'],['LI','Liechtenstein'],['LT','Lithuania'],
    ['LU','Luxembourg'],['MO','Macau'],['MG','Madagascar'],['MW','Malawi'],['MY','Malaysia'],
    ['MV','Maldives'],['ML','Mali'],['MT','Malta'],['MH','Marshall Islands'],['MR','Mauritania'],
    ['MU','Mauritius'],['MX','Mexico'],['FM','Micronesia'],['MD','Moldova'],['MC','Monaco'],
    ['MN','Mongolia'],['ME','Montenegro'],['MA','Morocco'],['MZ','Mozambique'],['MM','Myanmar'],
    ['NA','Namibia'],['NR','Nauru'],['NP','Nepal'],['NL','Netherlands'],['NZ','New Zealand'],
    ['NI','Nicaragua'],['NE','Niger'],['NG','Nigeria'],['KP','North Korea'],['MK','North Macedonia'],
    ['NO','Norway'],['OM','Oman'],['PK','Pakistan'],['PW','Palau'],['PS','Palestine'],
    ['PA','Panama'],['PG','Papua New Guinea'],['PY','Paraguay'],['PE','Peru'],['PH','Philippines'],
    ['PL','Poland'],['PT','Portugal'],['QA','Qatar'],['RO','Romania'],['RU','Russia'],
    ['RW','Rwanda'],['KN','Saint Kitts and Nevis'],['LC','Saint Lucia'],['VC','Saint Vincent and the Grenadines'],
    ['WS','Samoa'],['SM','San Marino'],['ST','Sao Tome and Principe'],['SA','Saudi Arabia'],['SN','Senegal'],
    ['RS','Serbia'],['SC','Seychelles'],['SL','Sierra Leone'],['SG','Singapore'],['SK','Slovakia'],
    ['SI','Slovenia'],['SB','Solomon Islands'],['SO','Somalia'],['ZA','South Africa'],['KR','South Korea'],
    ['SS','South Sudan'],['ES','Spain'],['LK','Sri Lanka'],['SD','Sudan'],['SR','Suriname'],
    ['SE','Sweden'],['CH','Switzerland'],['SY','Syria'],['TW','Taiwan'],['TJ','Tajikistan'],
    ['TZ','Tanzania'],['TH','Thailand'],['TL','Timor-Leste'],['TG','Togo'],['TO','Tonga'],
    ['TT','Trinidad and Tobago'],['TN','Tunisia'],['TR','Turkey'],['TM','Turkmenistan'],['TV','Tuvalu'],
    ['UG','Uganda'],['UA','Ukraine'],['AE','United Arab Emirates'],['GB','United Kingdom'],['US','United States'],
    ['UY','Uruguay'],['UZ','Uzbekistan'],['VU','Vanuatu'],['VA','Vatican City'],['VE','Venezuela'],
    ['VN','Vietnam'],['YE','Yemen'],['ZM','Zambia'],['ZW','Zimbabwe']
  ];

  var DIAL_CODES = {
    AF:'+93',AL:'+355',DZ:'+213',AD:'+376',AO:'+244',AG:'+1',AR:'+54',AM:'+374',AU:'+61',AT:'+43',
    AZ:'+994',BS:'+1',BH:'+973',BD:'+880',BB:'+1',BY:'+375',BE:'+32',BZ:'+501',BJ:'+229',BT:'+975',
    BO:'+591',BA:'+387',BW:'+267',BR:'+55',BN:'+673',BG:'+359',BF:'+226',BI:'+257',KH:'+855',CM:'+237',
    CA:'+1',CV:'+238',CF:'+236',TD:'+235',CL:'+56',CN:'+86',CO:'+57',KM:'+269',CG:'+242',CD:'+243',
    CR:'+506',CI:'+225',HR:'+385',CU:'+53',CY:'+357',CZ:'+420',DK:'+45',DJ:'+253',DM:'+1',DO:'+1',
    EC:'+593',EG:'+20',SV:'+503',GQ:'+240',ER:'+291',EE:'+372',SZ:'+268',ET:'+251',FJ:'+679',FI:'+358',
    FR:'+33',GA:'+241',GM:'+220',GE:'+995',DE:'+49',GH:'+233',GR:'+30',GD:'+1',GT:'+502',GN:'+224',
    GW:'+245',GY:'+592',HT:'+509',HN:'+504',HK:'+852',HU:'+36',IS:'+354',IN:'+91',ID:'+62',IR:'+98',
    IQ:'+964',IE:'+353',IL:'+972',IT:'+39',JM:'+1',JP:'+81',JO:'+962',KZ:'+7',KE:'+254',KI:'+686',
    KW:'+965',KG:'+996',LA:'+856',LV:'+371',LB:'+961',LS:'+266',LR:'+231',LY:'+218',LI:'+423',LT:'+370',
    LU:'+352',MO:'+853',MG:'+261',MW:'+265',MY:'+60',MV:'+960',ML:'+223',MT:'+356',MH:'+692',MR:'+222',
    MU:'+230',MX:'+52',FM:'+691',MD:'+373',MC:'+377',MN:'+976',ME:'+382',MA:'+212',MZ:'+258',MM:'+95',
    NA:'+264',NR:'+674',NP:'+977',NL:'+31',NZ:'+64',NI:'+505',NE:'+227',NG:'+234',KP:'+850',MK:'+389',
    NO:'+47',OM:'+968',PK:'+92',PW:'+680',PS:'+970',PA:'+507',PG:'+675',PY:'+595',PE:'+51',PH:'+63',
    PL:'+48',PT:'+351',QA:'+974',RO:'+40',RU:'+7',RW:'+250',KN:'+1',LC:'+1',VC:'+1',WS:'+685',
    SM:'+378',ST:'+239',SA:'+966',SN:'+221',RS:'+381',SC:'+248',SL:'+232',SG:'+65',SK:'+421',SI:'+386',
    SB:'+677',SO:'+252',ZA:'+27',KR:'+82',SS:'+211',ES:'+34',LK:'+94',SD:'+249',SR:'+597',SE:'+46',
    CH:'+41',SY:'+963',TW:'+886',TJ:'+992',TZ:'+255',TH:'+66',TL:'+670',TG:'+228',TO:'+676',TT:'+1',
    TN:'+216',TR:'+90',TM:'+993',TV:'+688',UG:'+256',UA:'+380',AE:'+971',GB:'+44',US:'+1',UY:'+598',
    UZ:'+998',VU:'+678',VA:'+379',VE:'+58',VN:'+84',YE:'+967',ZM:'+260',ZW:'+263'
  };

  // ---- state shared across the flow ----
  var form, countrySel, ccSel, pinInput, statusEl, manualRow, cityInput, stateInput;
  var lead = null;               // the submitted enquiry
  var submitPromise = null;      // in-flight initial POST (for the row number)
  var detected = { area: '', city: '', state: '' };
  var pinDebounce = null, pinReqId = 0;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function send(payload) {
    return fetch(LEADS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  /* ---------------- pincode lookup ---------------- */

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.className = 'field-status' + (kind ? ' ' + kind : '');
  }

  function showManual() {
    if (manualRow) { manualRow.style.display = 'grid'; cityInput.required = true; stateInput.required = true; }
  }
  function hideManual() {
    if (manualRow) { manualRow.style.display = 'none'; cityInput.required = false; stateInput.required = false; }
  }
  function clearLocation() {
    detected = { area: '', city: '', state: '' };
    if (cityInput) cityInput.value = '';
    if (stateInput) stateInput.value = '';
  }
  // zipcodebase uses the literal string "N" as a "no data" placeholder — treat
  // that (and blank / null) as no value.
  function clean(v) {
    v = (v == null ? '' : String(v)).trim();
    return (!v || v.toUpperCase() === 'N') ? '' : v;
  }

  function lookupPincode(code) {
    var country = countrySel.value || 'IN';
    var reqId = ++pinReqId;
    setStatus('Looking up pincode…', 'loading');

    fetch(ZIPCODEBASE_URL + '?codes=' + encodeURIComponent(code) + '&apikey=' + ZIPCODEBASE_API_KEY + '&country=' + encodeURIComponent(country))
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
      .then(function (data) { return (data && data.results && data.results[code]) || null; })
      .catch(function () { return null; })
      .then(function (entries) {
        if (reqId !== pinReqId) return; // superseded
        var m = (entries && entries.length) ? entries[0] : null;
        // Response shape mirrors index.html: area <- city, city <- province, state <- state_en
        var area = m ? clean(m.city) : '';
        var city = m ? clean(m.province) : '';
        var state = m ? (clean(m.state_en) || clean(m.state)) : '';

        detected.area = area;
        detected.city = city;
        detected.state = state;

        if (!city || !state) {
          // Empty / "N" / partial — fall back to manual entry, pre-filling
          // whatever we did get.
          if (cityInput) cityInput.value = city;
          if (stateInput) stateInput.value = state;
          showManual();
          setStatus((city || state)
            ? 'Please confirm your city and state below.'
            : 'Enter your city and state below.', 'warn');
          return;
        }

        if (cityInput) cityInput.value = city;
        if (stateInput) stateInput.value = state;
        hideManual();
        setStatus(city + ', ' + state, 'ok');
      });
  }

  function wirePincode() {
    // status line + manual city/state row, injected right after the pincode field
    var pinField = pinInput.closest('.field') || pinInput.parentNode;
    statusEl = el('span', 'field-status');
    statusEl.id = 'lf-status';
    pinField.appendChild(statusEl);

    var host = pinField.closest('.field-row') || pinField;
    manualRow = el('div', 'field-row lf-manual',
      '<div class="field"><label for="lf-city">City</label><input id="lf-city" type="text" placeholder="City"></div>' +
      '<div class="field"><label for="lf-state">State</label><input id="lf-state" type="text" placeholder="State"></div>');
    manualRow.style.display = 'none';
    host.parentNode.insertBefore(manualRow, host.nextSibling);
    cityInput = manualRow.querySelector('#lf-city');
    stateInput = manualRow.querySelector('#lf-state');

    pinInput.addEventListener('input', function () {
      clearTimeout(pinDebounce);
      setStatus('', '');
      var v = this.value.trim();
      if (v.length >= 3) {
        pinDebounce = setTimeout(function () { lookupPincode(v); }, 400);
      } else {
        pinReqId++;
        clearLocation();
        hideManual();
      }
    });

    countrySel.addEventListener('change', function () {
      pinReqId++;
      pinInput.value = '';
      clearLocation();
      hideManual();
      setStatus('', '');
      var d = DIAL_CODES[this.value];
      if (d) ccSel.value = d;
    });
  }

  /* ---------------- initial submit ---------------- */

  function onSubmit(e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var btn = document.getElementById('lf-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    lead = {
      role: 'Investor',
      name: document.getElementById('lf-name').value.trim(),
      email: document.getElementById('lf-email').value.trim(),
      mobileCountryCode: ccSel.value,
      mobile: document.getElementById('lf-mobile').value.trim(),
      country: countrySel.options[countrySel.selectedIndex].textContent,
      pincode: pinInput.value.trim(),
      city: (cityInput && cityInput.value.trim()) || detected.city || '',
      state: (stateInput && stateInput.value.trim()) || detected.state || '',
      interest: form.getAttribute('data-interest') || 'Not sure yet — need guidance',
      rowNumber: null
    };

    // Optimistic: fire the lead POST but DON'T wait for it — move straight to
    // the schedule step. The row number is picked up when it resolves; if the
    // user schedules first, the backend matches the lead by email/mobile.
    submitPromise = send(lead).then(function (res) {
      if (res && res.row) lead.rowNumber = res.row;
      return res;
    });

    openSchedule();
  }

  /* ---------------- full-screen schedule step ---------------- */

  var sched = null;
  var pick = { date: null, dateLabel: '', time: TIME_SLOTS[0], mode: MODES[0], page: 0 };

  function nthDay(n) {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    var c = 0;
    while (true) {
      if (d.getDay() !== 0) { if (c === n) return new Date(d); c++; }
      d.setDate(d.getDate() + 1);
    }
  }
  function datesForPage(p) {
    var size = p === 0 ? 5 : 8;
    var start = p === 0 ? 0 : 5 + (p - 1) * 8;
    var out = [];
    for (var i = 0; i < size; i++) out.push(nthDay(start + i));
    return out;
  }

  function buildSchedule() {
    sched = el('div', 'sched-page');
    sched.innerHTML =
      '<div class="sched-shell">' +
        '<div class="sched-head">' +
          '<div class="section-tag">Optional next step</div>' +
          '<h2>Book a call with an expert</h2>' +
          '<p>Pick a date, time and how you\'d like to connect. Prefer we just call you? Skip this step — your request is already in.</p>' +
        '</div>' +
        '<div class="sched-grid">' +
          '<div class="sched-side">' +
            '<h4>Your details</h4>' +
            '<div class="sched-greet">Hi, <strong data-f="name">—</strong></div>' +
            '<div class="sched-lock"><span>Email</span><strong data-f="email">—</strong></div>' +
            '<div class="sched-lock"><span>Mobile</span><strong data-f="mobile">—</strong></div>' +
            '<div class="sched-lock"><span>Interested in</span><strong data-f="interest">—</strong></div>' +
          '</div>' +
          '<div class="sched-main">' +
            '<div class="sched-block"><div class="sched-block-label">Select date</div>' +
              '<div class="date-row"><button type="button" class="date-nav" data-nav="-1" aria-label="Earlier">‹</button>' +
              '<div class="date-track"></div>' +
              '<button type="button" class="date-nav" data-nav="1" aria-label="Later">›</button></div></div>' +
            '<div class="sched-block"><div class="sched-block-label">Select time (IST)</div><div class="time-grid"></div></div>' +
            '<div class="sched-block"><div class="sched-block-label">Meeting mode</div><div class="mode-grid"></div></div>' +
            '<div class="sched-block"><div class="sched-block-label">Anything else? (optional)</div>' +
              '<textarea class="sched-note" placeholder="Type your message here…"></textarea></div>' +
          '</div>' +
        '</div>' +
        '<div class="sched-actions">' +
          '<button type="button" class="sched-skip">Skip for now</button>' +
          '<button type="button" class="sched-go">Schedule call →</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sched);

    sched.querySelectorAll('.date-nav').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = parseInt(b.getAttribute('data-nav'), 10);
        if (pick.page + dir < 0) return;
        pick.page += dir;
        renderDates();
      });
    });
    sched.querySelector('.sched-skip').addEventListener('click', function () { finish(false); });
    sched.querySelector('.sched-go').addEventListener('click', doSchedule);
  }

  function renderDates() {
    var track = sched.querySelector('.date-track');
    var dates = datesForPage(pick.page);
    track.innerHTML = '';
    dates.forEach(function (d, i) {
      var iso = d.toISOString().slice(0, 10);
      var dow = d.toLocaleDateString('en-US', { weekday: 'short' });
      var dnum = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      var chip = el('button', 'date-chip' + (iso === pick.date ? ' active' : ''),
        '<span class="dow">' + dow + '</span><span class="dnum">' + dnum + '</span>');
      chip.type = 'button';
      chip.addEventListener('click', function () {
        track.querySelectorAll('.date-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        pick.date = iso;
        pick.dateLabel = dow + ', ' + dnum;
      });
      track.appendChild(chip);
    });
    if (pick.page === 0 && !dates.some(function (d) { return d.toISOString().slice(0, 10) === pick.date; })) {
      var f = dates[0];
      pick.date = f.toISOString().slice(0, 10);
      pick.dateLabel = f.toLocaleDateString('en-US', { weekday: 'short' }) + ', ' + f.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      var first = track.querySelector('.date-chip');
      if (first) first.classList.add('active');
    }
    sched.querySelector('.date-nav[data-nav="-1"]').disabled = pick.page === 0;
  }

  function renderTimes() {
    var grid = sched.querySelector('.time-grid');
    grid.innerHTML = '';
    TIME_SLOTS.forEach(function (t, i) {
      var s = el('button', 'time-slot' + (i === 0 ? ' active' : ''), t);
      s.type = 'button';
      s.addEventListener('click', function () {
        grid.querySelectorAll('.time-slot').forEach(function (x) { x.classList.remove('active'); });
        s.classList.add('active');
        pick.time = t;
      });
      grid.appendChild(s);
    });
    pick.time = TIME_SLOTS[0];
  }

  function renderModes() {
    var grid = sched.querySelector('.mode-grid');
    grid.innerHTML = '';
    MODES.forEach(function (m, i) {
      var c = el('button', 'mode-card' + (i === 0 ? ' active' : ''), '<span>' + m + '</span>');
      c.type = 'button';
      c.addEventListener('click', function () {
        grid.querySelectorAll('.mode-card').forEach(function (x) { x.classList.remove('active'); });
        c.classList.add('active');
        pick.mode = m;
      });
      grid.appendChild(c);
    });
    pick.mode = MODES[0];
  }

  function openSchedule() {
    if (!sched) buildSchedule();
    sched.querySelector('[data-f="name"]').textContent = lead.name || '—';
    sched.querySelector('[data-f="email"]').textContent = lead.email || '—';
    sched.querySelector('[data-f="mobile"]').textContent = (lead.mobileCountryCode ? lead.mobileCountryCode + ' ' : '') + (lead.mobile || '—');
    sched.querySelector('[data-f="interest"]').textContent = lead.interest || '—';
    sched.querySelector('.sched-note').value = '';
    pick.page = 0; pick.date = null;
    renderDates(); renderTimes(); renderModes();
    var go = sched.querySelector('.sched-go');
    go.disabled = false; go.textContent = 'Schedule call →';
    sched.classList.add('show');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
  }

  function doSchedule() {
    var go = sched.querySelector('.sched-go');
    go.disabled = true;
    go.textContent = 'Scheduling…';

    Promise.resolve(submitPromise).then(function () {
      var payload = {};
      for (var k in lead) if (lead.hasOwnProperty(k)) payload[k] = lead[k];
      payload.action = 'update';
      payload.rowNumber = lead.rowNumber;
      payload.scheduleDate = pick.date || pick.dateLabel;
      payload.scheduleTime = pick.time;
      payload.meetingMode = pick.mode;
      payload.additionalInfo = sched.querySelector('.sched-note').value.trim();

      return send(payload);
    }).then(function (res) {
      if (!res || !res.ok) {
        go.disabled = false;
        go.textContent = 'Schedule call →';
        alert('Could not save your schedule — please try again.' + (res && res.error ? '\n\n(' + res.error + ')' : ''));
        return;
      }
      finish(true);
    });
  }

  function finish(scheduled) {
    if (sched) { sched.classList.remove('show'); sched.remove(); sched = null; }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    if (form) {
      form.style.display = 'none';
      var card = form.closest('.lead-card');
      if (card) card.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = 'none'; });
    }
    var ok = document.querySelector('.form-success');
    if (ok) {
      var t = document.getElementById('lf-ok-title');
      var b = document.getElementById('lf-ok-body');
      if (scheduled) {
        if (t) t.textContent = 'Call scheduled';
        if (b) b.textContent = "You're all set — we'll connect via " + pick.mode + ' on ' + pick.dateLabel + ' at ' + pick.time + ' (IST).';
      }
      ok.classList.add('show');
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ---------------- boot ---------------- */

  function build() {
    form = document.getElementById('leadForm');
    if (!form) return;
    countrySel = document.getElementById('lf-country');
    ccSel = document.getElementById('lf-cc');
    pinInput = document.getElementById('lf-pincode');

    for (var i = 0; i < COUNTRIES.length; i++) {
      var c = COUNTRIES[i], o;
      o = new Option(c[1], c[0], c[0] === 'IN', c[0] === 'IN');
      countrySel.appendChild(o);
      o = new Option(c[0] + ' ' + (DIAL_CODES[c[0]] || ''), DIAL_CODES[c[0]] || '', c[0] === 'IN', c[0] === 'IN');
      ccSel.appendChild(o);
    }

    if (pinInput) wirePincode();
    form.addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
