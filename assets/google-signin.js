/* "Continue with Google" for the enquiry forms.
   Prefills name + email (verified) from the Google account; the visitor still
   enters mobile + pincode. The raw ID token is sent with the lead submit and
   verified server-side. */
(function () {
  'use strict';
  var CLIENT_ID = '310843929438-4tg1dgc1gku590g0b0ue82fm4dq3202k.apps.googleusercontent.com';
  var GSI = 'https://accounts.google.com/gsi/client';
  var gsiReady = null;

  function loadGsi() {
    if (gsiReady) return gsiReady;
    gsiReady = new Promise(function (res, rej) {
      if (window.google && window.google.accounts && window.google.accounts.id) return res();
      var s = document.createElement('script');
      s.src = GSI; s.async = true; s.defer = true;
      s.onload = res; s.onerror = function () { rej(new Error('gsi load failed')); };
      document.head.appendChild(s);
    });
    return gsiReady;
  }

  function decode(jwt) {
    try {
      var b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { return {}; }
  }

  // maGoogleSignin({ mount: <el to put the button in>, onProfile: fn({name,email,credential}) })
  window.maGoogleSignin = function (opts) {
    if (!opts || !opts.mount) return;
    loadGsi().then(function () {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: function (resp) {
          if (!resp || !resp.credential) return;
          var p = decode(resp.credential);
          opts.onProfile({
            name: (p.name || '').trim(),
            email: (p.email || '').trim().toLowerCase(),
            credential: resp.credential
          });
        }
      });
      window.google.accounts.id.renderButton(opts.mount, {
        theme: 'outline', size: 'large', text: 'continue_with',
        shape: 'pill', logo_alignment: 'left', width: opts.width || 280
      });
    }).catch(function () { /* button just won't appear — form still works */ });
  };
})();
