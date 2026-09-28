/* ═══════════════════════════════════════════════════════════
   link-guard.js — Blocks any URL that isn't an X/Twitter post
   Client-side: intercepts Send + Enter before script.js fires.
   Server-side: matching trigger in Supabase is the real gate.
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* Any http://... , www.... , or bare domain.tld */
    var ANY_URL_RE =
        /(?:\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|xyz|app|dev|co|me|gg|link|site|online|tech|pro|info|biz|us|uk|tv|fm|cc|to|ws|ai|so|run|fun|xyz)(?:\/[^\s<>"']*)?)/gi;

    /* X/Twitter status URL — the ONLY thing allowed */
    var X_POST_RE =
        /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\/\s]+\/status\/\d+/i;

    function firstDisallowed(text) {
        var t = String(text || '');
        var matches = t.match(ANY_URL_RE);
        if (!matches) return null;
        for (var i = 0; i < matches.length; i++) {
            // Strip trailing punctuation that isn't part of the URL
            var u = matches[i].replace(/[),.;!?]+$/, '');
            if (X_POST_RE.test(u)) continue;
            return u;
        }
        return null;
    }

    function toast(msg) {
        var el = document.getElementById('errorToast');
        if (!el) return;
        el.classList.remove('visible');
        void el.offsetWidth;
        el.textContent = '⚠️ ' + msg;
        el.classList.add('visible');
        clearTimeout(el._lgT);
        el._lgT = setTimeout(function () { el.classList.remove('visible'); }, 3500);
    }

    function guard(e) {
        var inp = document.getElementById('messageInput');
        if (!inp) return;
        var bad = firstDisallowed(inp.value);
        if (!bad) return;
        // Block send + let script.js's handler know nothing happened
        e.stopImmediatePropagation();
        e.preventDefault();
        toast('Links not allowed — only X posts');
    }

    function boot() {
        // Capture phase — runs before script.js's sendMessage
        document.addEventListener('click', function (e) {
            if (e.target && e.target.closest && e.target.closest('#sendBtn')) {
                guard(e);
            }
        }, true);

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var inp = document.getElementById('messageInput');
            if (!inp || document.activeElement !== inp) return;
            guard(e);
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.MSNLinkGuard = { firstDisallowed: firstDisallowed };
    console.log('[link-guard] loaded');
})();
