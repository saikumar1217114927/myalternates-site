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
      '.lead-returning .lr-notyou{margin-top:18px;padding-top:14px;border-top:1px solid #eee}' +
      '.lead-returning .lr-notyou .lr-link{color:#8a8f99;font-size:12.5px}' +
      '.expert-call .ec-avatar{width:120px;height:120px;border-radius:50%;overflow:hidden;margin:0 auto 12px;background:#12161d;border:3px solid #e6e1d3}' +
      '.expert-call .ec-avatar img{width:100%;height:100%;object-fit:cover;object-position:center 25%;display:block}' +
      '.expert-call .ec-cap{text-align:center}' +
      '.lead-returning .lr-body{margin-top:8px}' +
      '.lead-returning .lr-meeting{background:#f6f4ee;border:1px solid #e6e1d3;border-radius:10px;padding:14px 16px;margin-bottom:14px}' +
      '.lead-returning .lr-mlabel{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a7c58;font-weight:700}' +
      '.lead-returning .lr-mwhen{font-size:16px;font-weight:700;margin:4px 0}' +
      '.lead-returning .lr-mmode{font-size:13px;color:#5b6270;margin-bottom:8px}' +
      '.lf-known{background:#f6f4ee;border:1px solid #e6e1d3;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:13.5px;line-height:1.5}' +
      '.lf-known-actions{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}' +
      '.lf-known .btn-gold{background:#c9a24b;color:#1a1400;border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer}' +
      '.lf-known .lr-link{background:none;border:0;color:#6b7280;font-size:13px;cursor:pointer;text-decoration:underline}' +
      '.lf-google{margin-bottom:6px}' +
      '.lf-google .lf-gbtn{display:flex;justify-content:center;min-height:40px}' +
      '.lf-google .lf-gnote{background:#eef7f0;border:1px solid #cbe6d3;border-radius:10px;padding:10px 14px;font-size:13px;color:#1f6f43;line-height:1.5}' +
      '.lf-google .lf-gnote .lr-link{background:none;border:0;color:#1f6f43;font-size:12.5px;cursor:pointer;text-decoration:underline}' +
      '.lf-google .lf-gor{display:flex;align-items:center;gap:12px;color:#8a8f99;font-size:12px;margin:14px 0 4px}' +
      '.lf-google .lf-gor::before,.lf-google .lf-gor::after{content:"";flex:1;height:1px;background:#e6e1d3}' +
      '.sched-free-note{display:inline-flex;align-items:center;gap:8px;margin-top:14px;background:#eef7f0;border:1px solid #cbe6d3;color:#1f6f43;font-size:13.5px;font-weight:600;line-height:1.4;padding:9px 16px;border-radius:999px}' +
      '.sched-free-note b{font-weight:800}' +
      '@media (max-width:560px){.sched-free-note{white-space:normal;border-radius:12px}}' +
      '.lf-otp .lr-sub{color:#5b6270;font-size:14px;line-height:1.55;margin-bottom:16px}' +
      '.lf-otp input.lf-otp-code{font-size:22px;letter-spacing:.35em;text-align:center;font-weight:700;padding:12px 14px;width:100%;border:1px solid #d8d2c2;border-radius:8px;box-sizing:border-box}' +
      '.lf-otp .lf-otp-err{color:#a3402f;font-size:13px;margin-top:8px;display:none}' +
      '.lf-otp .lr-actions{margin-top:14px}' +
      '.lr-contact{margin-top:18px;padding-top:14px;border-top:1px solid #eee}' +
      '.lr-contact-title{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a7c58;font-weight:700;margin-bottom:10px}' +
      '.lr-crow{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13.5px}' +
      '.lr-crow + .lr-crow{border-top:1px solid #f1eee5}' +
      '.lr-clabel{color:#8a8f99;width:56px;flex:none}' +
      '.lr-cval{flex:1;font-weight:600;color:#1a1a1a;overflow-wrap:anywhere}' +
      '.lr-cedit{display:flex;flex-direction:column;gap:8px;width:100%;padding:6px 0}' +
      '.lr-cedit-row{display:flex;gap:8px}' +
      '.lr-cedit input, .lr-cedit select{font-size:14px;padding:9px 10px;border:1px solid #d8d2c2;border-radius:8px;box-sizing:border-box}' +
      '.lr-cedit input{flex:1;min-width:0}' +
      '.lr-cedit select{flex:none;width:92px}' +
      '.lr-cc-warn{color:#8a6d1f;font-size:12px;background:#fbf3e0;border:1px solid #ecdca8;border-radius:6px;padding:6px 9px;line-height:1.4}' +
      '.lr-cedit-err{color:#a3402f;font-size:12.5px;display:none}' +
      '.lr-cedit-sent{color:#1f6f43;font-size:12.5px}' +
      '.lr-cedit .btn-gold{padding:8px 14px;font-size:13px}';
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
  var googleCred = '';           // Google ID token, if the visitor signed in
  var expert = null;             // assigned user's { name, photo } if they opted to show it

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
  function rememberLead(o) {
    // A different leadId than whatever was remembered before means this
    // isn't the same lead record any more — e.g. an admin deleted the old
    // one and this visitor just re-registered from scratch. Locally-cached
    // per-lead state (which interests were already flagged) belongs to the
    // OLD record, which no longer exists, so it must not carry over —
    // otherwise "Yes, add it" never re-fires for the new lead because the
    // client still thinks it's already done.
    try {
      var prev = JSON.parse(ls('maLead') || 'null');
      if (prev && prev.leadId && o.leadId && prev.leadId !== o.leadId) localStorage.removeItem('maInterests');
    } catch (e) {}
    ls('maLead', JSON.stringify({
      leadId: o.leadId, name: o.name, email: o.email,
      mobile: o.mobile || '', mobileCountryCode: o.mobileCountryCode || ''
    }));
  }
  // Long-lived "logged in" session — set only once email (or Google) is
  // verified. Deliberately never expires; a returning visitor is recognized
  // and skips the form entirely until they explicitly sign out.
  function getSessionToken() { return ls('maLeadSession') || ''; }
  function saveSessionToken(t) { if (t) ls('maLeadSession', t); }
  function clearSession() {
    try {
      localStorage.removeItem('maLeadSession'); localStorage.removeItem('maLead'); localStorage.removeItem('maInterests');
    } catch (e) {}
  }
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
      // pathname alone drops ?id=<planId> on scheme.html — with it gone,
      // the backoffice/AI can only ever say "visited /scheme", never which
      // fund. The query string is kept (not just the id param) so any
      // future page needing its own params gets this for free too.
      path: location.pathname + location.search, title: document.title, ref: document.referrer,
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

  // The raw lookup, no DOM side effects — resolves { area, city, state }
  // (each '' if not found). Exposed on window.MASession too, so another
  // registration form on the page (the Discover-flow gate) can drive the
  // same "confirm manually if not found" UI without a second ZipCodeBase
  // key/URL living in two files.
  function fetchPincodeLocation(code, country) {
    return fetch(ZIPCODEBASE_URL + '?codes=' + encodeURIComponent(code) + '&apikey=' + ZIPCODEBASE_API_KEY + '&country=' + encodeURIComponent(country || 'IN'))
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
      .then(function (data) { return (data && data.results && data.results[code]) || null; })
      .catch(function () { return null; })
      .then(function (entries) {
        var m = (entries && entries.length) ? entries[0] : null;
        // Response shape mirrors index.html: area <- city, city <- province, state <- state_en
        return {
          area: m ? clean(m.city) : '',
          city: m ? clean(m.province) : '',
          state: m ? (clean(m.state_en) || clean(m.state)) : ''
        };
      });
  }

  function lookupPincode(code) {
    var country = countrySel.value || 'IN';
    var reqId = ++pinReqId;
    setStatus('Looking up pincode…', 'loading');

    return fetchPincodeLocation(code, country).then(function (loc) {
      if (reqId !== pinReqId) return; // superseded
      detected.area = loc.area;
      detected.city = loc.city;
      detected.state = loc.state;

      if (!loc.city || !loc.state) {
        // Empty / "N" / partial — fall back to manual entry, pre-filling
        // whatever we did get.
        if (cityInput) cityInput.value = loc.city;
        if (stateInput) stateInput.value = loc.state;
        showManual();
        setStatus((loc.city || loc.state)
          ? 'Please confirm your city and state below.'
          : 'Enter your city and state below.', 'warn');
        return;
      }

      if (cityInput) cityInput.value = loc.city;
      if (stateInput) stateInput.value = loc.state;
      hideManual();
      setStatus(loc.city + ', ' + loc.state, 'ok');
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
      // For India, wait for all 6 digits — looking up a 3-5 digit prefix
      // mid-type (e.g. a natural pause after "560") always fails (it isn't a
      // real pincode), which used to flash the "confirm manually" fields
      // while the user was still typing. Other countries' postal codes vary
      // in length, so keep the looser 3+ threshold for them.
      var ready = (countrySel.value || 'IN') === 'IN' ? v.length === 6 : v.length >= 3;
      if (ready) {
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

  function buildLeadObj() {
    return {
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
  }

  function afterVerified(res) {
    if (res && res.row) lead.rowNumber = res.row;
    if (res && res.leadId) {
      lead.leadId = res.leadId;
      rememberLead({ leadId: res.leadId, name: lead.name, email: lead.email, mobile: lead.mobile, mobileCountryCode: lead.mobileCountryCode });
    }
    if (res && res.sessionToken) saveSessionToken(res.sessionToken);
    if (res && res.expert) { expert = res.expert; if (sched && sched.classList.contains('show')) renderExpertCall(); }
    return res;
  }

  var submitBtnLabel = '';   // captured once so any "Sending…"/"Verifying…" state can restore it exactly

  function onSubmit(e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var btn = document.getElementById('lf-submit');
    if (!submitBtnLabel) submitBtnLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = googleCred ? 'Submitting…' : 'Sending code…';

    function proceed() {
      lead = buildLeadObj();

      // "Continue with Google" already proves the email — skip the OTP step
      // and go straight through, same as before.
      if (googleCred) {
        lead.googleCredential = googleCred;
        submitPromise = send(lead).then(afterVerified);
        openSchedule();
        return;
      }

      // Everyone else verifies their email first — the lead is only created
      // once the code is confirmed (see verifyLeadEmailOtp on the backend).
      requestOtpThenVerify();
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

  /* ---------------- email OTP step (skipped when signed in with Google) ---------------- */

  function requestOtpThenVerify() {
    send({ action: 'requestLeadEmailOtp', email: lead.email, vid: lead.visitorId }).then(function (res) {
      var btn = document.getElementById('lf-submit');
      if (!res || !res.ok) {
        if (btn) { btn.disabled = false; btn.textContent = submitBtnLabel || 'Submit'; }
        alert((res && res.error) || 'Could not send a verification code — please try again.');
        return;
      }
      showOtpPanel();
    });
  }

  function showOtpPanel() {
    var host = form.closest('.lead-card') || form.parentNode;
    form.style.display = 'none';
    if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = 'none'; });

    var box = el('div', 'lf-otp lead-returning');
    box.innerHTML =
      '<div class="lr-title">Verify your email</div>' +
      '<p class="lr-sub">We sent a 6-digit code to <b>' + escHtml(lead.email) + '</b>. Enter it below to confirm your enquiry.</p>' +
      '<input type="text" class="lf-otp-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" autocomplete="one-time-code">' +
      '<div class="lf-otp-err"></div>' +
      '<div class="lr-actions">' +
        '<button type="button" class="btn-gold" data-verify>Verify &amp; continue</button>' +
        '<button type="button" class="lr-link" data-resend>Resend code</button>' +
        '<button type="button" class="lr-link" data-changeemail>Use a different email</button>' +
      '</div>';
    host.appendChild(box);

    var codeInput = box.querySelector('.lf-otp-code');
    var errEl = box.querySelector('.lf-otp-err');
    var verifyBtn = box.querySelector('[data-verify]');
    codeInput.focus();

    function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }

    function doVerify() {
      var otp = codeInput.value.trim();
      if (!/^[0-9]{6}$/.test(otp)) { showErr('Enter the 6-digit code.'); return; }
      errEl.style.display = 'none';
      verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying…';
      var payload = {};
      for (var k in lead) if (lead.hasOwnProperty(k)) payload[k] = lead[k];
      payload.action = 'verifyLeadEmailOtp';
      payload.otp = otp;
      send(payload).then(function (res) {
        verifyBtn.disabled = false; verifyBtn.textContent = 'Verify & continue';
        if (!res || !res.ok) { showErr((res && res.error) || 'Could not verify — please try again.'); return; }
        submitPromise = Promise.resolve(afterVerified(res));
        box.remove();
        if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = ''; });
        openSchedule();
      });
    }
    verifyBtn.onclick = doVerify;
    codeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doVerify(); } });
    codeInput.addEventListener('input', function () { codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); });

    box.querySelector('[data-resend]').onclick = function (ev) {
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      send({ action: 'requestLeadEmailOtp', email: lead.email, vid: lead.visitorId }).then(function (res) {
        ev.target.disabled = false; ev.target.textContent = 'Resend code';
        if (!res || !res.ok) { showErr((res && res.error) || 'Could not resend — please try again.'); return; }
        codeInput.value = ''; codeInput.focus();
      });
    };
    box.querySelector('[data-changeemail]').onclick = function () {
      box.remove();
      var btn = document.getElementById('lf-submit');
      if (btn) { btn.disabled = false; btn.textContent = 'Request a callback'; }
      form.style.display = '';
      if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = ''; });
      document.getElementById('lf-email').focus();
    };
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
          '<div class="sched-free-note">🎁 <b>Free</b> &middot; No commitment call &mdash; we\'re just here to help you figure things out.</div>' +
        '</div>' +
        '<div class="sched-grid">' +
          '<div class="sched-side">' +
            '<h4>Your details</h4>' +
            '<div class="sched-greet">Hi, <strong data-f="name">—</strong></div>' +
            '<div class="sched-lock"><span>Email</span><strong data-f="email">—</strong></div>' +
            '<div class="sched-lock"><span>Mobile</span><strong data-f="mobile">—</strong></div>' +
            '<div class="sched-lock"><span>Interested in</span><strong data-f="interest">—</strong></div>' +
            '<div class="expert-call" aria-hidden="true"></div>' +
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

  // Map any stored meeting-mode string ("Zoom Call", "google meet", "Phone", …) to one of MODES.
  function modeCard(mode) {
    var s = String(mode || '').toLowerCase();
    if (s.indexOf('zoom') > -1) return 'Zoom Call';
    if (s.indexOf('google') > -1 || s.indexOf('meet') > -1) return 'Google Meet';
    return 'Phone Call';
  }
  function renderModes() {
    var grid = sched.querySelector('.mode-grid');
    grid.innerHTML = '';
    var want = (lead && lead.rescheduleMeetingId) ? modeCard(lead.mode) : MODES[0];
    MODES.forEach(function (m) {
      var c = el('button', 'mode-card' + (m === want ? ' active' : ''), '<span>' + m + '</span>');
      c.type = 'button';
      c.addEventListener('click', function () {
        grid.querySelectorAll('.mode-card').forEach(function (x) { x.classList.remove('active'); });
        c.classList.add('active');
        pick.mode = m;
      });
      grid.appendChild(c);
    });
    pick.mode = want;
  }

  function renderExpertCall() {
    var box = sched.querySelector('.expert-call');
    if (!box) return;
    if (expert && expert.photo) {
      box.innerHTML =
        '<div class="ec-avatar"><img src="' + escHtml(expert.photo) + '" alt=""></div>' +
        '<div class="ec-cap"><b>' + escHtml(expert.name || 'Your expert') + '</b> will connect with you at the scheduled time — walking you through how it works, what it costs, and what fits your goals.</div>';
    } else {
      box.innerHTML =
        '<div class="ec-frame">' + EC_SCENE +
          '<span class="ec-live"><i></i>Live</span>' +
          '<div class="ec-bars"><span></span><span></span><span></span><span></span><span></span></div>' +
        '</div>' +
        '<div class="ec-cap">An expert walks you through it live — how the strategy works, what it costs, and what fits your goals.</div>';
    }
  }

  function openSchedule() {
    if (!sched) buildSchedule();
    renderExpertCall();
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
    // Lets a page-specific meeting-status UI (e.g. scheme.html's top block,
    // rendered by session-gate.js) refresh itself after a schedule/reschedule
    // completes elsewhere on the page — works whether or not this page even
    // has a #leadForm / .form-success to show its own confirmation in.
    document.dispatchEvent(new CustomEvent('ma:scheduled', { detail: { scheduled: !!scheduled } }));
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

  /* -------- returning visitor: if we already know this person, skip the form --------
     - upcoming call  → show it + reschedule
     - no call        → "welcome back, book a call" (prefilled, no retyping)
     - "Not you?"     → falls back to the blank form                                 */
  function checkReturning(stored) {
    var interest = (form.getAttribute('data-interest') || '').trim();
    send({ action: 'getLeadPublic', leadId: stored.leadId, email: stored.email, vid: getVid() })
      .then(function (r) {
        if (!r || !r.found) return;             // stale / deleted lead → leave the form
        if (r.expert) expert = r.expert;
        var host = form.closest('.lead-card') || form.parentNode;
        form.style.display = 'none';
        if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = 'none'; });
        var first = (stored.name || r.name || '').trim().split(/\s+/)[0];
        var box = el('div', 'lead-returning');
        box.innerHTML =
          '<div class="lr-title">Welcome back' + (first ? ', ' + escHtml(first) : '') + '</div>' +
          '<div class="lr-body"></div>';
        host.appendChild(box);
        renderReturning(box.querySelector('.lr-body'), stored, interest, r.upcomingMeeting || null, r.pendingInterests || [], function backToForm() {
          box.remove();
          form.style.display = '';
          if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = ''; });
        });
      })
      .catch(function () { /* leave the normal form in place */ });
  }

  function renderReturning(bodyEl, stored, interest, mtg, pendingInterests, backToForm) {
    // Server truth (getLeadPublic's pendingInterests), not a permanent local
    // flag — once this topic gets discussed and a new call is booked, it
    // drops off the list and the "want your expert to cover X" ask returns.
    var already = interest && (pendingInterests || []).indexOf(interest) >= 0;
    var html;
    if (mtg && mtg.date) {
      html = '<div class="lr-meeting">' +
        '<div class="lr-mlabel">Your call is scheduled</div>' +
        '<div class="lr-mwhen">' + escHtml(fmtDate(mtg.date)) + (mtg.time ? ' · ' + escHtml(mtg.time) + ' IST' : '') + '</div>' +
        (mtg.mode ? '<div class="lr-mmode">' + escHtml(mtg.mode) + '</div>' : '') +
        '<button type="button" class="lr-link" data-resch>Reschedule this call</button>' +
        '</div>';
    } else {
      html = '<p class="lr-sub">Good to see you again — no need to fill the form. Just pick a time and your expert will call you.</p>' +
        '<div class="lr-book"><button type="button" class="btn-gold" data-book>Book a call →</button></div>';
    }

    if (interest) {
      html += already
        ? '<div class="lr-done">Your expert already has <b>' + escHtml(interest) + '</b> on the list.</div>'
        : '<div class="lr-ask">Want your expert to cover <b>' + escHtml(interest) + '</b> ' +
          (mtg && mtg.date ? 'in this call too?' : 'when they call?') +
          '<div class="lr-actions"><button type="button" class="btn-gold" data-yes>Yes, add it</button>' +
          '<button type="button" class="lr-link" data-no>Not now</button></div></div>';
    }
    html += '<div class="lr-notyou"><button type="button" class="lr-link" data-notyou>Not you? Start a fresh enquiry</button></div>';
    bodyEl.innerHTML = html;

    var nu = bodyEl.querySelector('[data-notyou]');
    if (nu && typeof backToForm === 'function') nu.onclick = backToForm;

    var ask = bodyEl.querySelector('.lr-ask');
    var yes = bodyEl.querySelector('[data-yes]');
    if (yes) yes.onclick = function () {
      yes.disabled = true; yes.textContent = 'Adding…';
      send({ action: 'addInterest', leadId: stored.leadId, email: stored.email, vid: getVid(), interest: interest, path: location.pathname })
        .then(function (r) {
          if (r && r.ok && r.found) { if (ask) ask.innerHTML = '<div class="lr-done">Added — your expert will cover <b>' + escHtml(interest) + '</b> as well.</div>'; }
          else { yes.disabled = false; yes.textContent = 'Yes, add it'; }
        });
    };
    var no = bodyEl.querySelector('[data-no]');
    if (no) no.onclick = function () { if (ask) ask.style.display = 'none'; };

    function openBooking(rescheduleId) {
      lead = {
        role: 'Investor', name: stored.name || '', email: stored.email || '',
        mobileCountryCode: stored.mobileCountryCode || '', mobile: stored.mobile || '', interest: interest || '',
        leadId: stored.leadId, visitorId: getVid(), path: location.pathname,
        rescheduleMeetingId: rescheduleId || '', mode: (mtg && mtg.mode) || '', rowNumber: null
      };
      submitPromise = Promise.resolve();
      openSchedule();
    }
    var resch = bodyEl.querySelector('[data-resch]');
    if (resch) resch.onclick = function () { openBooking(mtg.meetingId); };
    var bookBtn = bodyEl.querySelector('[data-book]');
    if (bookBtn) bookBtn.onclick = function () { openBooking(''); };
  }

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
      o.setAttribute('data-iso', c[0]);
      ccSel.appendChild(o);
    }

    if (pinInput) wirePincode();
    wireCountryCode();
    wireKnownContact();
    wireGoogle();
    form.addEventListener('submit', onSubmit);

    // A verified (OTP or Google) session always wins — it's a real, checked
    // identity, not just a locally-remembered guess. Falls back to the older
    // unverified "recognize by localStorage" flow for visitors who never went
    // through verification (e.g. they submitted before this existed).
    var token = getSessionToken();
    if (token) {
      checkSession(token);
    } else {
      var stored = storedLead();
      if (stored && stored.leadId) checkReturning(stored);
    }
  }

  /* -------- verified session: skip the form entirely, show call state -------- */
  function checkSession(token) {
    send({ action: 'getLeadSessionStatus', token: token }).then(function (r) {
      if (!r || !r.ok || !r.loggedIn) {
        clearSession();
        var stored = storedLead();
        if (stored && stored.leadId) checkReturning(stored);
        return;
      }
      if (r.expert) expert = r.expert;
      rememberLead({ leadId: r.leadId, name: r.name, email: r.email, mobile: r.mobile, mobileCountryCode: r.mobileCountryCode });
      showSessionPanel(r, token);
    }).catch(function () { /* leave the normal form in place */ });
  }

  function showSessionPanel(sess, token) {
    var interest = (form.getAttribute('data-interest') || '').trim();
    var host = form.closest('.lead-card') || form.parentNode;
    form.style.display = 'none';
    if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = 'none'; });
    var first = (sess.name || '').trim().split(/\s+/)[0];
    var box = el('div', 'lead-returning');
    box.innerHTML = '<div class="lr-title">Welcome back' + (first ? ', ' + escHtml(first) : '') + '</div><div class="lr-body"></div>';
    host.appendChild(box);
    renderSessionBody(box.querySelector('.lr-body'), sess, token, interest, function backToForm() {
      clearSession();
      box.remove();
      form.style.display = '';
      if (host) host.querySelectorAll('h3, .sub').forEach(function (n) { n.style.display = ''; });
    });
  }

  function renderSessionBody(bodyEl, sess, token, interest, signOut) {
    // Server truth (getLeadSessionStatus's pendingInterests), not a permanent
    // local flag — once this topic gets discussed and a new call is booked,
    // it drops off the list and the "want your expert to cover X" ask returns.
    var already = interest && (sess.pendingInterests || []).indexOf(interest) >= 0;
    var mtg = sess.upcomingMeeting;
    var html;
    if (mtg && mtg.date) {
      // Has an upcoming (not-yet-elapsed) call. Once the call's date passes,
      // the backend's activeMeetingForLead stops returning it, and a fresh
      // checkSession() (next page load) drops back to "Schedule a call".
      html = '<div class="lr-meeting">' +
        '<div class="lr-mlabel">Your call is scheduled</div>' +
        '<div class="lr-mwhen">' + escHtml(fmtDate(mtg.date)) + (mtg.time ? ' · ' + escHtml(mtg.time) + ' IST' : '') + '</div>' +
        (mtg.mode ? '<div class="lr-mmode">' + escHtml(mtg.mode) + '</div>' : '') +
        '<button type="button" class="lr-link" data-resch>Reschedule this call</button>' +
        '</div>';
    } else {
      html = '<p class="lr-sub">Good to see you again — no need to fill the form. Just pick a time and your expert will call you.</p>' +
        '<div class="lr-book"><button type="button" class="btn-gold" data-book>Schedule a call →</button></div>';
    }

    if (interest) {
      html += already
        ? '<div class="lr-done">Your expert already has <b>' + escHtml(interest) + '</b> on the list.</div>'
        : '<div class="lr-ask">Want your expert to cover <b>' + escHtml(interest) + '</b> ' +
          (mtg && mtg.date ? 'in this call too?' : 'when they call?') +
          '<div class="lr-actions"><button type="button" class="btn-gold" data-yes>Yes, add it</button>' +
          '<button type="button" class="lr-link" data-no>Not now</button></div></div>';
    }
    html += '<div class="lr-contact" data-contact-host></div>';
    html += '<div class="lr-notyou"><button type="button" class="lr-link" data-notyou>Not you? Sign out</button></div>';
    bodyEl.innerHTML = html;

    renderContactEditor(bodyEl.querySelector('[data-contact-host]'), sess, token);

    var nu = bodyEl.querySelector('[data-notyou]');
    if (nu) nu.onclick = signOut;

    var ask = bodyEl.querySelector('.lr-ask');
    var yes = bodyEl.querySelector('[data-yes]');
    if (yes) yes.onclick = function () {
      yes.disabled = true; yes.textContent = 'Adding…';
      send({ action: 'addInterest', leadId: sess.leadId, email: sess.email, vid: getVid(), interest: interest, path: location.pathname })
        .then(function (r) {
          if (r && r.ok && r.found) { if (ask) ask.innerHTML = '<div class="lr-done">Added — your expert will cover <b>' + escHtml(interest) + '</b> as well.</div>'; }
          else { yes.disabled = false; yes.textContent = 'Yes, add it'; }
        });
    };
    var no = bodyEl.querySelector('[data-no]');
    if (no) no.onclick = function () { if (ask) ask.style.display = 'none'; };

    function openBooking(rescheduleId) {
      lead = {
        role: 'Investor', name: sess.name || '', email: sess.email || '',
        mobileCountryCode: sess.mobileCountryCode || '', mobile: sess.mobile || '', interest: interest || '',
        leadId: sess.leadId, visitorId: getVid(), path: location.pathname,
        rescheduleMeetingId: rescheduleId || '', mode: (mtg && mtg.mode) || '', rowNumber: null
      };
      submitPromise = Promise.resolve();
      openSchedule();
    }
    var resch = bodyEl.querySelector('[data-resch]');
    if (resch) resch.onclick = function () { openBooking(mtg.meetingId); };
    var bookBtn = bodyEl.querySelector('[data-book]');
    if (bookBtn) bookBtn.onclick = function () { openBooking(''); };
  }

  /* -------- Self-service email/mobile edit, inside the "Welcome back"
     panel. Changing either one requires proving you still control what's
     CURRENTLY on file — the OTP always goes to the existing email/mobile,
     never the new value being typed — so a bare edit form can't be used to
     hijack someone else's contact. If the existing mobile carries a
     non-Indian code, only email can carry that code (same DLT-template
     limit the registration OTP already works around); the mobile edit row
     warns about this before Send, same wording as the registration form's
     own country-code note. -------- */
  function renderContactEditor(host, sess, token) {
    if (!host) return;
    host.innerHTML =
      '<div class="lr-contact-title">Your details</div>' +
      '<div class="lr-crow" data-crow="email"><span class="lr-clabel">Email</span>' +
      '<span class="lr-cval">' + escHtml(sess.email || '—') + '</span>' +
      '<button type="button" class="lr-link" data-cedit="email">Edit</button></div>' +
      '<div class="lr-crow" data-crow="mobile"><span class="lr-clabel">Mobile</span>' +
      '<span class="lr-cval">' + escHtml((sess.mobileCountryCode ? sess.mobileCountryCode + ' ' : '') + (sess.mobile || '—')) + '</span>' +
      '<button type="button" class="lr-link" data-cedit="mobile">Edit</button></div>';

    host.querySelectorAll('[data-cedit]').forEach(function (btn) {
      btn.onclick = function () { openEditRow(btn.getAttribute('data-cedit')); };
    });

    function rowEl(field) { return host.querySelector('[data-crow="' + field + '"]'); }

    function dialCodeOptions(selected) {
      return COUNTRIES.map(function (c) {
        var code = DIAL_CODES[c[0]];
        if (!code) return '';
        return '<option value="' + code + '" data-iso="' + c[0] + '"' + (code === selected ? ' selected' : '') + '>' + c[0] + ' ' + code + '</option>';
      }).join('');
    }

    function openEditRow(field) {
      var row = rowEl(field);
      var isEmail = field === 'email';
      row.innerHTML = '<div class="lr-cedit">' +
        '<div class="lr-cedit-row">' +
        (isEmail ? '' : '<select class="lr-cc">' + dialCodeOptions(sess.mobileCountryCode || '+91') + '</select>') +
        '<input type="' + (isEmail ? 'email' : 'tel') + '" class="lr-cnew" placeholder="' + (isEmail ? 'New email address' : 'New mobile number') + '"></div>' +
        (isEmail ? '' : '<div class="lr-cc-warn" data-cc-warn hidden>Your mobile on file has an international code, so we can’t SMS a code to verify this change — it’ll be sent to your email instead.</div>') +
        '<div class="lr-cedit-err"></div>' +
        '<div class="lr-actions"><button type="button" class="btn-gold" data-csend>Send code</button>' +
        '<button type="button" class="lr-link" data-ccancel>Cancel</button></div></div>';

      var input = row.querySelector('.lr-cnew');
      var errEl = row.querySelector('.lr-cedit-err');
      var ccSel = row.querySelector('.lr-cc');
      input.focus();

      // The warning is about whose SMS support decides where the code
      // actually goes — that's the EXISTING mobile's country, not whichever
      // one they're picking for the new number.
      var warnEl = row.querySelector('[data-cc-warn]');
      if (warnEl) warnEl.hidden = (String(sess.mobileCountryCode || '+91').replace(/\D+/g, '') === '91');

      function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }

      row.querySelector('[data-ccancel]').onclick = function () { renderContactEditor(host, sess, token); };
      row.querySelector('[data-csend]').onclick = function () {
        var val = input.value.trim();
        if (isEmail && (!val || val.indexOf('@') < 1)) { showErr('Enter a valid email address.'); return; }
        if (!isEmail && val.replace(/\D/g, '').length < 6) { showErr('Enter a valid mobile number.'); return; }
        var newMobileCc = ccSel ? ccSel.value : '';
        var btn = row.querySelector('[data-csend]');
        btn.disabled = true; btn.textContent = 'Sending…';
        send({ action: 'requestContactChangeOtp', token: token, vid: getVid(), field: field, newValue: val, newMobileCc: newMobileCc })
          .then(function (r) {
            btn.disabled = false; btn.textContent = 'Send code';
            if (!r || !r.ok) { showErr((r && r.error) || 'Could not send a code — please try again.'); return; }
            showOtpStep(field, val, newMobileCc, r.sentTo);
          });
      };
    }

    function showOtpStep(field, val, newMobileCc, sentTo) {
      var row = rowEl(field);
      row.innerHTML = '<div class="lr-cedit">' +
        '<div class="lr-cedit-sent">Code sent to ' + escHtml(sentTo || 'your account') + '.</div>' +
        '<div class="lr-cedit-row"><input type="text" class="lr-cnew" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" autocomplete="one-time-code"></div>' +
        '<div class="lr-cedit-err"></div>' +
        '<div class="lr-actions"><button type="button" class="btn-gold" data-cverify>Verify &amp; save</button>' +
        '<button type="button" class="lr-link" data-cresend>Resend code</button>' +
        '<button type="button" class="lr-link" data-ccancel>Cancel</button></div></div>';

      var codeInput = row.querySelector('.lr-cnew');
      var errEl = row.querySelector('.lr-cedit-err');
      codeInput.focus();
      codeInput.addEventListener('input', function () { codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); });

      function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }

      row.querySelector('[data-ccancel]').onclick = function () { renderContactEditor(host, sess, token); };
      row.querySelector('[data-cresend]').onclick = function (e) {
        var b = e.currentTarget;
        b.disabled = true; b.textContent = 'Sending…';
        send({ action: 'requestContactChangeOtp', token: token, vid: getVid(), field: field, newValue: val, newMobileCc: newMobileCc })
          .then(function (r) {
            b.disabled = false; b.textContent = 'Resend code';
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
        send({ action: 'verifyContactChangeOtp', token: token, field: field, newValue: val, newMobileCc: newMobileCc, otp: otp })
          .then(function (r) {
            vBtn.disabled = false; vBtn.textContent = 'Verify & save';
            if (!r || !r.ok) { showErr((r && r.error) || 'Could not verify — please try again.'); return; }
            sess.email = r.email; sess.mobile = r.mobile; sess.mobileCountryCode = r.mobileCountryCode;
            rememberLead({ leadId: sess.leadId, name: sess.name, email: sess.email, mobile: sess.mobile, mobileCountryCode: sess.mobileCountryCode });
            renderContactEditor(host, sess, token);
          });
      }
      row.querySelector('[data-cverify]').onclick = doVerify;
      codeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doVerify(); } });
    }
  }

  /* -------- Continue with Google: prefill name + verified email -------- */
  function wireGoogle() {
    if (typeof window.maGoogleSignin !== 'function') return;
    var nameEl = document.getElementById('lf-name');
    var emailEl = document.getElementById('lf-email');
    if (!nameEl || !emailEl) return;

    var wrap = el('div', 'lf-google');
    wrap.innerHTML = '<div class="lf-gbtn"></div>' +
      '<div class="lf-gnote" style="display:none;"></div>' +
      '<div class="lf-gor"><span>or enter your details</span></div>';
    form.insertBefore(wrap, form.firstChild);
    var note = wrap.querySelector('.lf-gnote');

    window.maGoogleSignin({
      mount: wrap.querySelector('.lf-gbtn'),
      onProfile: function (pr) {
        googleCred = pr.credential;
        if (pr.name) { nameEl.value = pr.name; nameEl.readOnly = true; }
        emailEl.value = pr.email; emailEl.readOnly = true;
        wrap.querySelector('.lf-gbtn').style.display = 'none';
        note.style.display = '';
        note.innerHTML = '✓ Signed in as <b>' + escHtml(pr.email) + '</b> · ' +
          '<button type="button" class="lr-link" data-gclear>use a different email</button>';
        note.querySelector('[data-gclear]').onclick = function () {
          googleCred = '';
          nameEl.readOnly = false; emailEl.readOnly = false; emailEl.value = '';
          note.style.display = 'none';
          wrap.querySelector('.lf-gbtn').style.display = '';
        };
      }
    });
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
          if (r.expert) expert = r.expert;
          rememberLead({ leadId: r.leadId, name: r.name || '', email: email, mobile: mobile, mobileCountryCode: ccSel ? ccSel.value : '' });
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
        path: location.pathname, rescheduleMeetingId: m.meetingId, mode: m.mode || '', rowNumber: null
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

  /* -------- shared session API for other scripts on the page --------
     featured-schemes.js / scheme-page.js gate real scheme data behind
     registration and need the same identity this form already manages —
     one localStorage key, one backend session, so registering anywhere on
     the site logs a visitor in everywhere. */
  window.MASession = {
    getToken: getSessionToken,
    saveToken: saveSessionToken,
    clearToken: clearSession,
    send: send,
    // The same [ISO, name] country list and ISO->dial-code map this form's
    // own Country/Mobile-code selects use — exposed so another registration
    // form on the page (the Discover-flow gate) can build identical selects
    // without keeping a second copy of ~190 countries in sync.
    countries: COUNTRIES,
    dialCodes: DIAL_CODES,
    // (pincode, countryIso) -> Promise<{area, city, state}> — city/state are
    // '' when the lookup didn't find them, so the caller shows manual entry.
    lookupPincode: fetchPincodeLocation,
    checkStatus: function (token) { return send({ action: 'getLeadSessionStatus', token: token }); },
    // Same "Yes, add it" action the enquiry form's own returning-visitor
    // panel uses — exposed so another widget on the page (e.g. the hero's
    // compact meeting status) can offer it without duplicating the logic.
    // Whether it's already flagged is server truth (checkStatus's
    // pendingInterests), not tracked locally — see hero-meeting.js.
    addInterest: function (sess, interest, path) {
      return send({ action: 'addInterest', leadId: sess.leadId, email: sess.email, vid: getVid(), interest: interest, path: path || location.pathname });
    },
    addDiscussionNote: function (token, note) { return send({ action: 'addMeetingDiscussionNote', token: token, note: note }); },
    // One code, sent on whichever of email/SMS applies — the Register step
    // (session-gate.js's maRenderFullGate) always has both, so it always
    // asks for both; the visitor can enter whichever arrives first.
    // requireExisting: true (the Login step) makes the backend check the
    // email/mobile actually belongs to a lead first — no code goes out, and
    // nothing gets created, for one that isn't on file yet.
    requestOtp: function (email, mobileCc, mobile, requireExisting) {
      var payload = { action: 'requestLeadOtp', email: email, mobileCountryCode: mobileCc, mobile: mobile, vid: getVid() };
      if (requireExisting) payload.requireExisting = true;
      return send(payload);
    },
    // `extra` carries whatever the caller's own form collected (name,
    // pincode, interest, ...) — verifyLeadOtp accepts the same fields
    // leadSubmit does, so a lighter gate elsewhere on the site (e.g. the
    // Discover flow) can register with more than just an email.
    verifyOtp: function (email, mobileCc, mobile, otp, extra) {
      var payload = {
        action: 'verifyLeadOtp', email: email, mobileCountryCode: mobileCc, mobile: mobile, otp: otp,
        visitorId: getVid(), path: location.pathname, role: 'Investor'
      };
      if (extra) for (var k in extra) if (extra.hasOwnProperty(k) && extra[k] !== undefined) payload[k] = extra[k];
      return send(payload);
    },
    // Opens the exact same full-screen scheduler the enquiry form uses, from
    // a button anywhere else on the page. Completion still lands on the
    // page's own #leadForm / .form-success (both module-level vars already
    // point at them once build() has run), so the confirmation shows in the
    // normal enquiry section even though the trigger was elsewhere.
    openSchedule: function (sess, rescheduleMeetingId, interest) {
      lead = {
        role: 'Investor', name: sess.name || '', email: sess.email || '',
        mobileCountryCode: sess.mobileCountryCode || '', mobile: sess.mobile || '',
        interest: interest || (form ? form.getAttribute('data-interest') : '') || '',
        leadId: sess.leadId, visitorId: getVid(), path: location.pathname,
        rescheduleMeetingId: rescheduleMeetingId || '', mode: (sess.upcomingMeeting && sess.upcomingMeeting.mode) || '', rowNumber: null
      };
      // sess (from getLeadSessionStatus / verifyLeadEmailOtp) carries the
      // assigned expert's {name, photo} — without this, renderExpertCall()
      // finds the module-level `expert` still empty and the scheduler shows
      // no mapped-user avatar on pages that open it via this entry point
      // (e.g. scheme.html's meeting-action panel) instead of the enquiry
      // form's own submit flow.
      if (sess.expert) expert = sess.expert;
      submitPromise = Promise.resolve();
      openSchedule();
    }
  };
})();
