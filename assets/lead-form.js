/* ==========================================================================
   myAlternates — shared lead form for product pages.
   Posts to the same Apps Script web app / Google Sheet as the main enquiry form.

   Usage on a page:
     <form id="leadForm" data-interest="Portfolio Management Services (PMS)"> ... </form>
   The form must contain: #lf-name #lf-email #lf-mobile #lf-cc (mobile code select)
   #lf-country (country select) #lf-pincode #lf-submit, plus a sibling
   .form-success block with #lf-ok-title / #lf-ok-body.
   ========================================================================== */
(function () {
  'use strict';

  // Same deployed Apps Script /exec as the main site's enquiry form.
  var LEADS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzHAuxW3oxq7GX2fMa5YaMJDy_8jFSLsaob7A8VOdDMx_Hb3DsBnpAguCPyAtucw0Wt/exec';

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

  function build() {
    var form = document.getElementById('leadForm');
    if (!form) return;

    var countrySel = document.getElementById('lf-country');
    var ccSel = document.getElementById('lf-cc');
    var i, opt, c;

    for (i = 0; i < COUNTRIES.length; i++) {
      c = COUNTRIES[i];
      opt = document.createElement('option');
      opt.value = c[0];
      opt.textContent = c[1];
      if (c[0] === 'IN') opt.selected = true;
      countrySel.appendChild(opt);

      opt = document.createElement('option');
      opt.value = DIAL_CODES[c[0]] || '';
      opt.textContent = c[0] + ' ' + (DIAL_CODES[c[0]] || '');
      if (c[0] === 'IN') opt.selected = true;
      ccSel.appendChild(opt);
    }

    countrySel.addEventListener('change', function () {
      var d = DIAL_CODES[this.value];
      if (d) ccSel.value = d;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var btn = document.getElementById('lf-submit');
      btn.disabled = true;
      var originalLabel = btn.textContent;
      btn.textContent = 'Sending…';

      var payload = {
        role: 'Investor',
        name: document.getElementById('lf-name').value.trim(),
        email: document.getElementById('lf-email').value.trim(),
        mobileCountryCode: ccSel.value,
        mobile: document.getElementById('lf-mobile').value.trim(),
        country: countrySel.options[countrySel.selectedIndex].textContent,
        pincode: document.getElementById('lf-pincode').value.trim(),
        city: '',
        state: '',
        interest: form.getAttribute('data-interest') || 'Not sure yet — need guidance'
      };

      send(payload).then(function (res) {
        if (res && res.ok) {
          form.style.display = 'none';
          var ok = document.querySelector('.form-success');
          if (ok) ok.classList.add('show');
        } else {
          btn.disabled = false;
          btn.textContent = originalLabel;
          alert('Sorry — we could not submit your request. Please try again, or email info@myalternates.com.'
            + (res && res.error ? '\n\n(' + res.error + ')' : ''));
        }
      });
    });
  }

  function send(payload) {
    // text/plain avoids a CORS preflight; Apps Script returns JSON for simple requests.
    return fetch(LEADS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
