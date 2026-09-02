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

  var LEADS_WEBHOOK_URL = 'https://myalternates-backend.onrender.com/';

  // styles for the returning-visitor card (self-contained, no site.css edit)
  (function () {
    var s = document.createElement('style');
    s.textContent =
      '.lead-returning{padding:6px 2px}' +
      '.lead-returning .lr-title{font-family:inherit;font-size:20px;font-weight:700;margin-bottom:6px}' +
      '.lead-returning .lr-sub{color:#5b6270;font-size:14px;line-height:1.55;margin-bottom:16px}' +
      '.lead-returning .lr-ask{background:#f6f4ee;border:1px solid #e6e1d3;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.5}' +
      '.lead-returning .lr-actions{display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}' +
      '.lead-returning .btn-gold{background:#c9a24b;color:#1a1400;border:0;border-radius:8px;padding:10px 18px;font-weight:700;font-size:14px;cursor:pointer}' +
      '.lead-returning .btn-gold:disabled{opacity:.6;cursor:default}' +
      '.lead-returning .lr-link{background:none;border:0;color:#6b7280;font-size:13px;cursor:pointer;text-decoration:underline}' +
      '.lead-returning .lr-done{background:#eef7f0;border:1px solid #cbe6d3;border-radius:10px;padding:14px 16px;font-size:14px;color:#1f6f43;line-height:1.5}' +
      '.lead-returning .lr-book{margin-top:16px}' +
      '.lead-returning .lr-body{margin-top:8px}' +
      '.lead-returning .lr-meeting{background:#f6f4ee;border:1px solid #e6e1d3;border-radius:10px;padding:14px 16px;margin-bottom:14px}' +
      '.lead-returning .lr-mlabel{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a7c58;font-weight:700}' +
      '.lead-returning .lr-mwhen{font-size:16px;font-weight:700;margin:4px 0}' +
      '.lead-returning .lr-mmode{font-size:13px;color:#5b6270;margin-bottom:8px}' +
      '.lf-known{background:#f6f4ee;border:1px solid #e6e1d3;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:13.5px;line-height:1.5}' +
      '.lf-known-actions{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}' +
      '.lf-known .btn-gold{background:#c9a24b;color:#1a1400;border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer}' +
      '.lf-known .lr-link{background:none;border:0;color:#6b7280;font-size:13px;cursor:pointer;text-decoration:underline}';
    document.head.appendChild(s);
  })();

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

  // ---- returning-visitor identity (shared with index.html's tracking) ----
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  function getVid() {
    var v = ls('maVid');
    if (!v) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      ls('maVid', v);
    }
    return v;
  }
  function storedLead() { try { return JSON.parse(ls('maLead') || 'null'); } catch (e) { return null; } }
  function rememberLead(o) { ls('maLead', JSON.stringify({ leadId: o.leadId, name: o.name, email: o.email })); }
  function flaggedInterests() { try { return JSON.parse(ls('maInterests') || '[]'); } catch (e) { return []; } }
  function rememberFlag(x) { var a = flaggedInterests(); if (a.indexOf(x) < 0) { a.push(x); ls('maInterests', JSON.stringify(a)); } }
  function firstUtm() {
    try { var s = JSON.parse(ls('maUtm') || 'null'); if (s && s.source) return s; } catch (e) {}
    var q = new URLSearchParams(location.search);
    var u = { source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '' };
    if (u.source || u.medium || u.campaign) ls('maUtm', JSON.stringify(u));
    return u;
  }

  // page-view beacon — every product page, same shape as index.html's
  (function trackPageView() {
    var s = storedLead();
    var body = JSON.stringify({
      action: 'track', vid: getVid(), leadId: (s && s.leadId) || '',
      path: location.pathname, title: document.title, ref: document.referrer,
      utm: firstUtm(), ua: navigator.userAgent
    });
    try { if (navigator.sendBeacon && navigator.sendBeacon(LEADS_WEBHOOK_URL, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return; } catch (e) {}
    try { fetch(LEADS_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true }); } catch (e) {}
  })();
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

    return fetch(ZIPCODEBASE_URL + '?codes=' + encodeURIComponent(code) + '&apikey=' + ZIPCODEBASE_API_KEY + '&country=' + encodeURIComponent(country))
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
    });
  }

  /* ---------------- country <-> dial code ---------------- */
  // Two-way sync: either field drives the other. Each only reacts to real
  // user input (never a programmatic change), so whatever gets auto-selected
  // stays fully editable — the lead can override it afterwards.
  function wireCountryCode() {
    function ccOptionForIso(iso) {
      for (var i = 0; i < ccSel.options.length; i++) {
        if (ccSel.options[i].getAttribute('data-iso') === iso) return ccSel.options[i];
      }
      return null;
    }
    function resetPincode() {
      pinReqId++;
      if (pinInput) pinInput.value = '';
      clearLocation();
      hideManual();
      setStatus('', '');
    }

    // Country -> dial code (exact per-country option, not just the first
    // option that shares the code).
    countrySel.addEventListener('change', function () {
      var o = ccOptionForIso(this.value);
      if (o) ccSel.selectedIndex = o.index;
    });

    // Dial code -> country.
    ccSel.addEventListener('change', function () {
      var opt = ccSel.options[ccSel.selectedIndex];
      var iso = opt && opt.getAttribute('data-iso');
      if (!iso || iso === countrySel.value) return;
      countrySel.value = iso;
      resetPincode();
    });
  }

  /* ---------------- initial submit ---------------- */

  function onSubmit(e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var btn = document.getElementById('lf-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    function proceed() {
      lead = {
        role: 'Investor',
        name: document.getElementById('lf-name').value.trim(),
        email: document.getElementById('lf-email').value.trim(),
        mobileCountryCode: ccSel.value,
        mobile: document.getElementById('lf-mobile').value.trim(),
        country: countrySel.options[countrySel.selectedIndex].textContent,
        pincode: pinInput ? pinInput.value.trim() : '',
        city: (cityInput && cityInput.value.trim()) || detected.city || '',
        state: (stateInput && stateInput.value.trim()) || detected.state || '',
        interest: form.getAttribute('data-interest') || 'Not sure yet — need guidance',
        visitorId: getVid(),
        path: location.pathname,
        rowNumber: null
      };

      submitPromise = send(lead).then(function (res) {
        if (res && res.row) lead.rowNumber = res.row;
        if (res && res.leadId) { lead.leadId = res.leadId; rememberLead({ leadId: res.leadId, name: lead.name, email: lead.email }); }
        return res;
      });

      openSchedule();
    }

    // A fast submitter can beat the 400ms debounced pincode lookup — wait for it
    // so city/state are captured.
    var pin = pinInput ? pinInput.value.trim() : '';
    if (pin && !detected.city && !(cityInput && cityInput.value.trim())) {
      Promise.resolve(lookupPincode(pin)).then(proceed, proceed);
    } else {
      proceed();
    }
  }

  /* ---------------- full-screen schedule step ---------------- */

  var sched = null;
  var PAGE_SIZE = 5;
  var pick = { date: null, dateLabel: '', time: TIME_SLOTS[0], mode: MODES[0], page: 0 };

  // Animated "advisor on a call" scene — no photo, pure SVG/CSS.
  var EC_SCENE =
    '<svg class="ec-svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="ecGlow" cx="30%" cy="62%" r="72%">' +
        '<stop offset="0" stop-color="#C9A24B" stop-opacity=".30"/>' +
        '<stop offset="1" stop-color="#C9A24B" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="320" height="200" fill="#12161D"/>' +
      '<circle cx="92" cy="150" r="120" fill="url(#ecGlow)"/>' +
      '<g class="ec-person">' +
        '<path d="M18 200 C38 138 150 138 170 200 Z" fill="#242c39"/>' +
        '<circle cx="94" cy="96" r="38" fill="#33404f"/>' +
        '<path d="M56 92 A38 38 0 0 1 132 92" fill="none" stroke="#C9A24B" stroke-width="5" stroke-linecap="round"/>' +
        '<rect x="127" y="90" width="9" height="20" rx="4" fill="#C9A24B"/>' +
        '<path d="M132 108 q-6 16 -22 18" fill="none" stroke="#C9A24B" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="110" cy="126" r="3" fill="#E9D19E"/>' +
      '</g>' +
      '<g class="ec-talk">' +
        '<circle cx="119" cy="126" r="2.6" fill="#4FA98C"/>' +
        '<circle cx="128" cy="126" r="2.6" fill="#4FA98C"/>' +
        '<circle cx="137" cy="126" r="2.6" fill="#4FA98C"/>' +
      '</g>' +
      '<g class="ec-card">' +
        '<rect x="176" y="40" width="120" height="94" rx="10" fill="#1B212B" stroke="#2A3140"/>' +
        '<rect x="188" y="52" width="54" height="6" rx="3" fill="#3a4454"/>' +
        '<rect x="188" y="64" width="34" height="5" rx="2.5" fill="#2f3947"/>' +
        '<rect class="ec-b ec-b1" x="190" y="90" width="12" height="34" rx="2" fill="#4FA98C"/>' +
        '<rect class="ec-b ec-b2" x="208" y="90" width="12" height="34" rx="2" fill="#4FA98C"/>' +
        '<rect class="ec-b ec-b3" x="226" y="90" width="12" height="34" rx="2" fill="#C9A24B"/>' +
        '<rect class="ec-b ec-b4" x="244" y="90" width="12" height="34" rx="2" fill="#C9A24B"/>' +
        '<rect class="ec-b ec-b5" x="262" y="90" width="12" height="34" rx="2" fill="#E9D19E"/>' +
        '<path class="ec-line" d="M190 118 L212 108 L234 101 L256 88 L278 78" fill="none" stroke="#E9D19E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="150" stroke-dashoffset="150"/>' +
      '</g>' +
    '</svg>';

  // The next 10 bookable days starting tomorrow, Sundays skipped — built once.
  // (Today is never offered — an advisor can't be lined up within hours.)
  var VALID_DAYS = (function (count) {
    var out = [], d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    while (out.length < count) {
      if (d.getDay() !== 0) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  })(10);

  function buildSchedule() {
    sched = el('div', 'sched-page');
    sched.innerHTML =
      '<div class="sched-shell">' +
        '<button type="button" class="sched-close" aria-label="Close">✕</button>' +
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
            '<div class="expert-call" aria-hidden="true">' +
              '<div class="ec-frame">' +
                EC_SCENE +
                '<span class="ec-live"><i></i>Live</span>' +
                '<div class="ec-bars"><span></span><span></span><span></span><span></span><span></span></div>' +
              '</div>' +
              '<div class="ec-cap">An advisor walks you through it live — how the strategy works, what it costs, and what fits your goals.</div>' +
            '</div>' +
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
        var next = pick.page + dir;
        if (next < 0 || next >= datePageCount()) return;
        pick.page = next;
        renderDates();
      });
    });
    sched.querySelector('.sched-close').addEventListener('click', function () { finish(false); });
    sched.querySelector('.sched-skip').addEventListener('click', function () { finish(false); });
    sched.querySelector('.sched-go').addEventListener('click', doSchedule);
  }

  function datePageCount() { return Math.ceil(VALID_DAYS.length / PAGE_SIZE); }

  function renderDates() {
    var track = sched.querySelector('.date-track');
    track.innerHTML = '';
    // default selection = the first available day
    if (!pick.date) {
      var f = VALID_DAYS[0];
      pick.date = isoLocal(f);
      pick.dateLabel = f.toLocaleDateString('en-US', { weekday: 'short' }) + ', ' + f.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    }
    VALID_DAYS.slice(pick.page * PAGE_SIZE, pick.page * PAGE_SIZE + PAGE_SIZE).forEach(function (d) {
      var iso = isoLocal(d);
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
    sched.querySelector('.date-nav[data-nav="-1"]').disabled = pick.page === 0;
    sched.querySelector('.date-nav[data-nav="1"]').disabled = pick.page >= datePageCount() - 1;
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
    pick.date = null; pick.page = 0;
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

    var wasReschedule = !!(lead && lead.rescheduleMeetingId);
    // remove the returning-visitor / known-contact panels so no stale meeting shows
    var lr = document.querySelector('.lead-returning'); if (lr) lr.remove();
    var lk = document.querySelector('.lf-known'); if (lk) lk.remove();

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
        if (t) t.textContent = wasReschedule ? 'Call rescheduled' : 'Call scheduled';
        if (b) b.textContent = "You're all set — we'll connect via " + pick.mode + ' on ' + pick.dateLabel + ' at ' + pick.time + ' (IST).';
      }
      ok.classList.add('show');
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ---------------- boot ---------------- */

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(iso) {
    var d = new Date(String(iso || '') + 'T00:00:00');
    if (isNaN(d)) return String(iso || '');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  // local calendar date (not toISOString — that shifts to UTC / a day early for IST)
  function isoLocal(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* -------- returning visitor: skip the form, show their call / offer interest -------- */
  function showReturning(stored) {
    var interest = (form.getAttribute('data-interest') || '').trim();
    var host = form.closest('.lead-card') || form.parentNode;
    form.style.display = 'none';
    if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = 'none'; });

    var first = (stored.name || '').trim().split(/\s+/)[0];
    var box = el('div', 'lead-returning');
    box.innerHTML =
      '<div class="lr-title">Welcome back' + (first ? ', ' + escHtml(first) : '') + '</div>' +
      '<div class="lr-body"><p class="lr-sub">Checking your details…</p></div>';
    host.appendChild(box);

    send({ action: 'getLeadPublic', leadId: stored.leadId, email: stored.email, vid: getVid() })
      .then(function (r) { renderReturning(box.querySelector('.lr-body'), stored, interest, (r && r.found) ? r.upcomingMeeting : null); })
      .catch(function () { renderReturning(box.querySelector('.lr-body'), stored, interest, null); });
  }

  function renderReturning(bodyEl, stored, interest, mtg) {
    var hasMtg = !!(mtg && mtg.date);
    var already = interest && flaggedInterests().indexOf(interest) >= 0;
    var html = '';

    if (hasMtg) {
      html += '<div class="lr-meeting">' +
        '<div class="lr-mlabel">Your call is scheduled</div>' +
        '<div class="lr-mwhen">' + escHtml(fmtDate(mtg.date)) + (mtg.time ? ' · ' + escHtml(mtg.time) + ' IST' : '') + '</div>' +
        (mtg.mode ? '<div class="lr-mmode">' + escHtml(mtg.mode) + '</div>' : '') +
        '<button type="button" class="lr-link" data-resch>Reschedule this call</button>' +
        '</div>';
    } else {
      html += '<p class="lr-sub">You\'ve already reached out — no need to fill the form again.</p>';
    }

    if (interest) {
      html += already
        ? '<div class="lr-done">Your expert already has <b>' + escHtml(interest) + '</b> on the list.</div>'
        : '<div class="lr-ask">Want your expert to cover <b>' + escHtml(interest) + '</b> ' + (hasMtg ? 'in this call' : 'when you speak') + ' too?' +
          '<div class="lr-actions"><button type="button" class="btn-gold" data-yes>Yes, add it</button>' +
          '<button type="button" class="lr-link" data-no>Not now</button></div></div>';
    }
    if (!hasMtg) html += '<div class="lr-book"><button type="button" class="lr-link" data-book>Book a call →</button></div>';
    bodyEl.innerHTML = html;

    var ask = bodyEl.querySelector('.lr-ask');
    var yes = bodyEl.querySelector('[data-yes]');
    if (yes) yes.onclick = function () {
      yes.disabled = true; yes.textContent = 'Adding…';
      send({ action: 'addInterest', leadId: stored.leadId, email: stored.email, vid: getVid(), interest: interest, path: location.pathname })
        .then(function (r) {
          if (r && r.ok && r.found) { rememberFlag(interest); if (ask) ask.innerHTML = '<div class="lr-done">Added — your expert will cover <b>' + escHtml(interest) + '</b> as well.</div>'; }
          else { yes.disabled = false; yes.textContent = 'Yes, add it'; }
        });
    };
    var no = bodyEl.querySelector('[data-no]');
    if (no) no.onclick = function () { if (ask) ask.style.display = 'none'; };

    function openBooking(rescheduleId) {
      lead = {
        role: 'Investor', name: stored.name || '', email: stored.email || '',
        mobileCountryCode: '', mobile: '', interest: interest || '',
        leadId: stored.leadId, visitorId: getVid(), path: location.pathname,
        rescheduleMeetingId: rescheduleId || '', rowNumber: null
      };
      submitPromise = Promise.resolve();
      openSchedule();
    }
    var book = bodyEl.querySelector('[data-book]');
    if (book) book.onclick = function () { openBooking(''); };
    var resch = bodyEl.querySelector('[data-resch]');
    if (resch) resch.onclick = function () { openBooking(mtg.meetingId); };
  }

  function build() {
    form = document.getElementById('leadForm');
    if (!form) return;

    var stored = storedLead();
    if (stored && stored.leadId) { showReturning(stored); return; }

    countrySel = document.getElementById('lf-country');
    ccSel = document.getElementById('lf-cc');
    pinInput = document.getElementById('lf-pincode');

    for (var i = 0; i < COUNTRIES.length; i++) {
      var c = COUNTRIES[i], o;
      o = new Option(c[1], c[0], c[0] === 'IN', c[0] === 'IN');
      countrySel.appendChild(o);
      o = new Option(c[0] + ' ' + (DIAL_CODES[c[0]] || ''), DIAL_CODES[c[0]] || '', c[0] === 'IN', c[0] === 'IN');
      o.setAttribute('data-iso', c[0]);
      ccSel.appendChild(o);
    }

    if (pinInput) wirePincode();
    wireCountryCode();
    wireKnownContact();
    form.addEventListener('submit', onSubmit);
  }

  /* -------- new device: recognise by email / mobile, surface their call -------- */
  function wireKnownContact() {
    var emailEl = document.getElementById('lf-email');
    var mobileEl = document.getElementById('lf-mobile');
    if (!emailEl) return;
    var checked = '';
    function check() {
      var email = emailEl.value.trim();
      var mobile = mobileEl ? mobileEl.value.trim() : '';
      var key = email + '|' + mobile;
      if (key === checked) return;
      if (!(email && email.indexOf('@') > 0) && mobile.length < 6) return;
      checked = key;
      send({ action: 'getLeadPublic', email: email, mobile: mobile, mobileCountryCode: ccSel ? ccSel.value : '', vid: getVid() })
        .then(function (r) {
          if (!r || !r.found) return;
          rememberLead({ leadId: r.leadId, name: r.name || '', email: email });
          if (r.upcomingMeeting && r.upcomingMeeting.date) showKnownBanner(r);
        });
    }
    emailEl.addEventListener('blur', check);
    if (mobileEl) mobileEl.addEventListener('blur', check);
  }

  function showKnownBanner(r) {
    if (document.querySelector('.lf-known')) return;
    var m = r.upcomingMeeting;
    var host = form.closest('.lead-card') || form.parentNode;
    var b = el('div', 'lf-known');
    b.innerHTML =
      '<div><b>We found your details.</b> You have a call scheduled for <b>' +
        escHtml(fmtDate(m.date)) + (m.time ? ' · ' + escHtml(m.time) + ' IST' : '') + '</b>' +
        (m.mode ? ' (' + escHtml(m.mode) + ')' : '') + '.</div>' +
      '<div class="lf-known-actions">' +
        '<button type="button" class="lr-link" data-keep>That\'s fine</button>' +
        '<button type="button" class="btn-gold" data-resch>Reschedule</button></div>';
    host.insertBefore(b, form);
    b.querySelector('[data-keep]').onclick = function () { b.remove(); };
    b.querySelector('[data-resch]').onclick = function () {
      var mobileEl = document.getElementById('lf-mobile');
      lead = {
        role: 'Investor', name: r.name || '', email: document.getElementById('lf-email').value.trim(),
        mobileCountryCode: ccSel ? ccSel.value : '', mobile: mobileEl ? mobileEl.value.trim() : '',
        interest: form.getAttribute('data-interest') || '', leadId: r.leadId, visitorId: getVid(),
        path: location.pathname, rescheduleMeetingId: m.meetingId, rowNumber: null
      };
      submitPromise = Promise.resolve();
      openSchedule();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
