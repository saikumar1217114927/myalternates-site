/* ==========================================================================
   myAlternates — nav search: a live, site-wide scheme search sitting in the
   header's empty middle (between the logo and the nav links). Self-contained
   (injects its own markup + styles, the same approach nav.js uses) so it
   works identically whether the page links assets/site.css or — like
   index.html — carries its own inline <style> block.

   Typing >=2 letters queries searchPublicSchemes (across every product, not
   just the current page's), and the results dropdown shows each scheme's
   name + AMC alongside a PMS/AIF/GIFT City tag. Picking one goes to
   scheme.html — through the same registration gate the "Discover" button
   uses, when that's available on the page (a couple of the lighter
   calculator/about pages don't load session-gate.js, so this degrades to a
   plain, ungated link there).
   ========================================================================== */
(function () {
  'use strict';

  var API_URL = 'https://myalternates-backend.onrender.com/';
  var PRODUCT_LABEL = { PMS: 'PMS', AIF: 'AIF', GIFT_IFSC: 'GIFT City', SIF: 'SIF' };
  var PRODUCT_INTEREST = {
    PMS: 'Portfolio Management Services (PMS)',
    AIF: 'Alternative Investment Fund (AIF)',
    GIFT_IFSC: 'GIFT City products',
    SIF: 'Specialized Investment Fund (SIF)'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.nav-search-wrap{position:relative; flex:0 1 380px; min-width:180px; margin:0 28px;' +
        'opacity:0; transform:scale(.92); transition:opacity .35s ease, transform .35s cubic-bezier(.22,1,.36,1);}' +
      '.nav-search-wrap.is-in{opacity:1; transform:scale(1);}' +
      '.nav-search{display:flex; align-items:center; gap:10px; height:42px; padding:0 16px;' +
        'background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); border-radius:999px;' +
        'transition:border-color .2s ease, background .2s ease, box-shadow .2s ease;}' +
      '.nav-search:focus-within{border-color:#C9A24B; background:rgba(255,255,255,0.09); box-shadow:0 0 0 3px rgba(201,162,75,0.16);}' +
      '.nav-search svg{width:16px; height:16px; flex:none; fill:none; stroke:#9A9E9C; stroke-width:1.8; stroke-linecap:round;}' +
      '.nav-search input{border:none; outline:none; background:transparent; font-family:inherit; font-size:13.5px; color:#F7F4ED; width:100%; height:100%;}' +
      '.nav-search input::placeholder{color:#9A9E9C;}' +
      '.nav-search-clear{background:none; border:none; color:#9A9E9C; font-size:12px; cursor:pointer; padding:2px 4px; flex:none; line-height:1; font-family:inherit;}' +
      '.nav-search-clear:hover{color:#F7F4ED;}' +
      '.nav-search-results{position:absolute; top:calc(100% + 10px); left:0; right:0;' +
        'background:#12161D; border:1px solid #2A3140; border-radius:14px; box-shadow:0 24px 48px -16px rgba(0,0,0,0.55);' +
        'padding:6px; max-height:360px; overflow-y:auto; z-index:200; pointer-events:none;' +
        'opacity:0; transform:translateY(-6px) scale(.98); transform-origin:top center;' +
        'transition:opacity .16s ease, transform .16s ease;}' +
      '.nav-search-results.is-open{opacity:1; transform:translateY(0) scale(1); pointer-events:auto;}' +
      '.nsr-row{display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;' +
        'background:none; border:none; border-radius:9px; padding:10px 12px; cursor:pointer; text-align:left;' +
        'font-family:inherit; transition:background .12s ease;}' +
      '.nsr-row:hover, .nsr-row:focus{background:rgba(255,255,255,0.07); outline:none;}' +
      '.nsr-name{display:flex; flex-direction:column; gap:2px; min-width:0; color:#F7F4ED; font-size:13.5px; font-weight:600;}' +
      '.nsr-amc{color:#9A9E9C; font-size:11.5px; font-weight:500;}' +
      '.nsr-tag{flex:none; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;' +
        'color:#0B0E13; background:#C9A24B; padding:3px 9px; border-radius:999px;}' +
      '.nsr-empty{color:#9A9E9C; font-size:13px; padding:16px 12px; text-align:center;}' +
      '@media (max-width:980px){.nav-search-wrap{display:none;}}';
    document.head.appendChild(style);
  }

  function init() {
    var header = document.querySelector('header.nav');
    if (!header) return;
    var inner = header.querySelector('.nav-inner');
    var links = header.querySelector('nav.links');
    if (!inner || !links || inner.querySelector('#navSearchWrap')) return;

    injectStyles();

    var wrap = document.createElement('div');
    wrap.className = 'nav-search-wrap';
    wrap.id = 'navSearchWrap';
    wrap.innerHTML =
      '<div class="nav-search">' +
        '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6"></circle><line x1="14" y1="14" x2="18" y2="18"></line></svg>' +
        '<input type="text" id="navSearchInput" placeholder="Search schemes…" autocomplete="off" aria-label="Search schemes">' +
        '<button type="button" class="nav-search-clear" id="navSearchClear" aria-label="Clear search" hidden>✕</button>' +
      '</div>' +
      '<div class="nav-search-results" id="navSearchResults" hidden></div>';
    inner.insertBefore(wrap, links);

    // A small "opening" reveal once the header itself has settled — the
    // beautiful/polished feel the box was asked for, not just a static box.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { wrap.classList.add('is-in'); });
    });

    var input = wrap.querySelector('#navSearchInput');
    var clearBtn = wrap.querySelector('#navSearchClear');
    var results = wrap.querySelector('#navSearchResults');
    var timer = null;

    function openResults() {
      results.hidden = false;
      requestAnimationFrame(function () { results.classList.add('is-open'); });
    }
    function closeResults() {
      if (results.hidden) return;
      results.classList.remove('is-open');
      setTimeout(function () { if (!results.classList.contains('is-open')) results.hidden = true; }, 160);
    }

    function goToScheme(planId, productCode) {
      var url = 'scheme?id=' + encodeURIComponent(planId);
      var token = window.MASession && window.MASession.getToken && window.MASession.getToken();
      if (token || !window.maOpenGateModal) { location.href = url; return; }
      var interest = PRODUCT_INTEREST[productCode] || 'Investing with myAlternates';
      window.maOpenGateModal({
        message: 'Create your free account to see this scheme’s live returns and full profile.',
        interest: interest,
        // Same optional-scheduler moment as the schemes list's own Discover
        // flow (featured-schemes.js) and the dedicated "Talk to an Expert"
        // CTA — offered once, right after registering, not buried in the
        // scheme page itself. ma:scheduled fires on close either way
        // (booked or skipped), so navigation waits for that.
        onVerified: function (token, r, lead, close) {
          close();
          document.addEventListener('ma:scheduled', function goNext() {
            document.removeEventListener('ma:scheduled', goNext);
            location.href = url;
          }, { once: true });
          window.MASession.openSchedule(Object.assign({}, lead, r), '', interest);
        }
      });
    }

    function render(list, q) {
      if (!list.length) {
        results.innerHTML = '<div class="nsr-empty">No schemes match “' + esc(q) + '”.</div>';
        openResults();
        return;
      }
      results.innerHTML = list.map(function (s) {
        var label = PRODUCT_LABEL[s.productCode] || s.productCode || s.productName || '';
        return '<button type="button" class="nsr-row" data-plan="' + esc(s.planId) + '" data-product="' + esc(s.productCode) + '">' +
          '<span class="nsr-name">' + esc(s.schemeName) + '<span class="nsr-amc">' + esc(s.amcName) + '</span></span>' +
          (label ? '<span class="nsr-tag">' + esc(label) + '</span>' : '') +
          '</button>';
      }).join('');
      results.querySelectorAll('.nsr-row').forEach(function (btn) {
        btn.onclick = function () { goToScheme(btn.dataset.plan, btn.dataset.product); };
      });
      openResults();
    }

    function search(q) {
      fetch(API_URL + '?action=searchPublicSchemes&q=' + encodeURIComponent(q) + '&limit=8')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (input.value.trim() !== q) return; // a newer keystroke has already moved on
          render((d && d.ok && d.schemes) || [], q);
        })
        .catch(function () {});
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearBtn.hidden = !q;
      clearTimeout(timer);
      if (q.length < 2) { closeResults(); return; }
      timer = setTimeout(function () { search(q); }, 250);
    });
    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2 && results.innerHTML) openResults();
    });
    clearBtn.onclick = function () {
      input.value = ''; clearBtn.hidden = true; closeResults(); input.focus();
    };
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closeResults();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; clearBtn.hidden = true; closeResults(); input.blur(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
