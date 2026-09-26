/* ═══════════════════════════════════════════════════════════
   x-auth.js — v6
   ───────────────────────────────────────────────────────────
   • Injects an X login button:
       – Desktop: left of #phantomConnectBtn, with a
         VERIFY / VERIFIED label to its left
       – Mobile:  replaces #sidebarRefreshBtn in the 2×2 grid
   • Uses the SEPARATE X auth Supabase project for OAuth
   • On success, writes x_handle / x_verified / x_avatar_url /
     display_name to profiles (main app project), keyed by wallet
   • wallet-identity.js handles the rest via realtime
   Load AFTER wallet-identity.js

   v6 fixes:
   • OAuth-return flow no longer reveals a half-built app.
     – Loader VISUALS are hidden immediately (no spinner).
     – `msn-booting` STAYS on <html> so the app itself is
       still invisible.
     – We release the boot gate only when script.js fires
       `msn:app-ready` (or after 1.6s max as a safety net).
     Result: no loading screen, no empty layout, no flicker.
   • Pending-OAuth flag is timestamped with a 3-minute TTL,
     so a stuck flag can never permanently hide the loader.
   • Everything else from v5 preserved.
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var X_AUTH_URL = 'https://ygmahgaoblaqgmifndgo.supabase.co';
    var X_AUTH_KEY = 'sb_publishable_qV3N0q_a4Y7m_AAo6hPfKQ_V6GNgX-G';

    var MAIN_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var MAIN_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    var authClient = null;
    var mainClient = null;
    var _sessionCache = null;
    var _sessionKnown = false;

    /* ═══════════════════════════════════════════════════════
       OAuth pending flag — timestamped + 3-min TTL
       Survives the redirect. Cannot get stuck.
       ═══════════════════════════════════════════════════════ */
    var OAUTH_FLAG_TTL_MS = 3 * 60 * 1000;

    function markOAuthPending() {
        try {
            sessionStorage.setItem('msn_x_oauth_pending', JSON.stringify({
                started: Date.now()
            }));
        } catch (e) {}
    }
    function clearOAuthPending() {
        try { sessionStorage.removeItem('msn_x_oauth_pending'); } catch (e) {}
    }
    function isOAuthPending() {
        try {
            var raw = sessionStorage.getItem('msn_x_oauth_pending');
            if (!raw) return false;

            // Legacy bare-flag from older builds — treat as stale
            if (raw === '1') {
                sessionStorage.removeItem('msn_x_oauth_pending');
                return false;
            }

            var data = JSON.parse(raw);
            if (!data || typeof data.started !== 'number') {
                sessionStorage.removeItem('msn_x_oauth_pending');
                return false;
            }

            var age = Date.now() - data.started;
            if (age > OAUTH_FLAG_TTL_MS || age < 0) {
                sessionStorage.removeItem('msn_x_oauth_pending');
                return false;
            }

            return true;
        } catch (e) { return false; }
    }

    function getAuth() {
        if (authClient) return authClient;
        if (!window.supabase || !window.supabase.createClient) return null;
        authClient = window.supabase.createClient(X_AUTH_URL, X_AUTH_KEY, {
            auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
        });
        return authClient;
    }
    function getMain() {
        if (mainClient) return mainClient;
        if (window.MSN && window.MSN.supabase) return (mainClient = window.MSN.supabase);
        if (window.supabase && window.supabase.createClient) {
            mainClient = window.supabase.createClient(MAIN_URL, MAIN_KEY);
            window.MSN = window.MSN || {};
            window.MSN.supabase = mainClient;
            return mainClient;
        }
        return null;
    }
    function getWallet() {
        try {
            var p = window.phantom && window.phantom.solana;
            if (p && p.publicKey) return p.publicKey.toBase58();
            var s = window.solana;
            if (s && s.publicKey) return s.publicKey.toBase58();
        } catch (e) {}
        try { return localStorage.getItem('msn_cached_wallet') || null; } catch (e) { return null; }
    }

    /* ═══════════════════════════════════════════════════════
       Boot-gate control for OAuth return
       ═══════════════════════════════════════════════════════ */

    /* Hide just the loader's visuals — spinner, ring, glow — but
       leave `msn-booting` in place so the app stays invisible. */
    function suppressLoaderVisualOnly() {
        if (document.getElementById('x-return-hide-loader-visual')) return;
        var s = document.createElement('style');
        s.id = 'x-return-hide-loader-visual';
        s.textContent =
            '#msnBootOverlay{' +
            '  opacity:0 !important;' +
            '  pointer-events:none !important;' +
            '  transition:none !important;' +
            '}';
        (document.head || document.documentElement).appendChild(s);
    }

    /* Remove the boot gate — reveals the (fully built) app. */
    function releaseBootGate() {
        try {
            document.documentElement.classList.remove('msn-booting');
            document.documentElement.classList.remove('booting');
        } catch (e) {}

        var ov = document.getElementById('msnBootOverlay');
        if (ov) {
            ov.classList.add('done');
            ov.style.display = 'none';
            ov.style.opacity = '0';
            ov.style.visibility = 'hidden';
            ov.style.pointerEvents = 'none';
            setTimeout(function () {
                if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
            }, 300);
        }
    }

    /* ─────────────────────────────────────────────────────────
       Styles
       ⚑ Default: GRAY + static
       ⚑ .x-signed-in: COLOR gradient + sweep + white icon
       ───────────────────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById('x-auth-styles')) return;
        var css = [
            '.x-auth-wrap{',
            '  display:inline-flex!important;align-items:center!important;',
            '  gap:6px!important;flex-shrink:0!important;',
            '}',

            '.x-auth-label{',
            '  font-family:var(--font-mono,ui-monospace,monospace)!important;',
            '  font-size:0.62rem!important;',
            '  font-weight:900!important;',
            '  letter-spacing:0.14em!important;',
            '  text-transform:uppercase!important;',
            '  color:#8a8a95!important;',
            '  white-space:nowrap!important;',
            '  user-select:none!important;',
            '  -webkit-user-select:none!important;',
            '  transition:color .2s ease,text-shadow .2s ease!important;',
            '  pointer-events:none!important;',
            '}',
            '.x-auth-label.x-verified{',
            '  color:#1d9bf0!important;',
            '  text-shadow:0 0 10px rgba(29,155,240,.6)!important;',
            '}',

            /* Base = GRAY, static */
            '.x-auth-btn{',
            '  position:relative!important;overflow:hidden!important;',
            '  width:44px!important;height:44px!important;',
            '  min-width:44px!important;min-height:44px!important;',
            '  padding:0!important;',
            '  border-radius:8px!important;',
            '  background:linear-gradient(135deg,#3a3a42 0%,#26262c 100%)!important;',
            '  border:1px solid rgba(255,255,255,0.08)!important;',
            '  color:#8a8a95!important;',
            '  display:inline-flex!important;align-items:center!important;justify-content:center!important;',
            '  box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 1px 4px rgba(0,0,0,.4)!important;',
            '  transition:filter .2s ease,transform .2s ease,background .2s ease,box-shadow .2s ease!important;',
            '  cursor:pointer!important;',
            '}',
            '.x-auth-btn svg{',
            '  width:24px!important;height:24px!important;',
            '  fill:#8a8a95!important;',
            '  filter:none!important;',
            '  position:relative!important;z-index:1!important;',
            '  transition:fill .25s ease,filter .25s ease!important;',
            '}',
            '.x-auth-btn::after{',
            '  content:""!important;position:absolute!important;',
            '  top:-60%!important;left:-70%!important;width:38%!important;height:220%!important;',
            '  background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent)!important;',
            '  transform:rotate(20deg)!important;',
            '  animation:none!important;',
            '  pointer-events:none!important;',
            '  display:none!important;',
            '}',
            '.x-auth-btn:hover{',
            '  background:linear-gradient(135deg,#4a4a52 0%,#333339 100%)!important;',
            '  filter:brightness(1.1)!important;',
            '  transform:translateY(-1px)!important;',
            '}',
            '.x-auth-btn:active{transform:scale(.96)!important;}',

            /* VERIFIED = COLOR gradient + animation */
            '.x-auth-btn.x-signed-in{',
            '  background:linear-gradient(135deg,#1d9bf0 0%,#a855f7 38%,#ff2d95 68%,#00ffc6 100%)!important;',
            '  background-size:280% 280%!important;',
            '  animation:xGs 6s ease infinite!important;',
            '  border:none!important;',
            '  color:#fff!important;',
            '  box-shadow:0 6px 20px -8px rgba(168,85,247,.85),0 0 24px -10px rgba(29,155,240,.7)!important;',
            '}',
            '.x-auth-btn.x-signed-in::after{',
            '  content:""!important;display:block!important;',
            '  position:absolute!important;',
            '  top:-60%!important;left:-70%!important;width:38%!important;height:220%!important;',
            '  background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent)!important;',
            '  transform:rotate(20deg)!important;',
            '  animation:xSweep 3.6s ease-in-out infinite!important;',
            '  pointer-events:none!important;',
            '}',
            '.x-auth-btn.x-signed-in svg{',
            '  fill:#fff!important;',
            '  filter:drop-shadow(0 1px 3px rgba(0,0,0,.35)) drop-shadow(0 0 6px rgba(255,255,255,.5))!important;',
            '}',
            '.x-auth-btn.x-signed-in:hover{',
            '  filter:brightness(1.18) saturate(1.25)!important;',
            '  transform:translateY(-1px) scale(1.04)!important;',
            '}',
            '.x-auth-btn.x-signed-in:active{transform:scale(.96)!important;}',

            '@keyframes xGs{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
            '@keyframes xSweep{0%,12%{left:-70%}55%,100%{left:140%}}',

            '@media (max-width: 768px){ .x-auth-label{display:none!important;} }'
        ].join('\n');
        var tag = document.createElement('style');
        tag.id = 'x-auth-styles';
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    var X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

    function buildButton(id) {
        var btn = document.createElement('button');
        btn.id = id;
        btn.type = 'button';
        btn.className = 'btn-icon x-auth-btn';
        btn.title = 'Verify with X';
        btn.setAttribute('aria-label', 'Verify with X');
        btn.innerHTML = X_SVG;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            handleClick();
        });
        return btn;
    }

    function handleClick() {
        var auth = getAuth();
        if (!auth) { console.warn('[x-auth] auth client unavailable'); return; }

        if (!_sessionKnown) {
            auth.auth.getSession().then(function ({ data: { session } }) {
                _sessionCache = session;
                _sessionKnown = true;
                _doClickAction(auth, session);
            });
            return;
        }
        _doClickAction(auth, _sessionCache);
    }

    async function _doClickAction(auth, session) {
        if (session) {
            await auth.auth.signOut();
            try { history.replaceState(null, '', location.pathname); } catch (e) {}
            _sessionCache = null;
            _sessionKnown = true;
            await clearXFromProfile();
            refreshButtons();
            return;
        }

        var wallet = getWallet();
        if (!wallet) {
            alert('Connect your Phantom wallet first, then verify with X.');
            return;
        }

        try { localStorage.setItem('msn_x_pending_wallet', wallet); } catch (e) {}

        markOAuthPending();

        var cleanRedirect = location.origin + location.pathname;
        var { error } = await auth.auth.signInWithOAuth({
            provider: 'x',
            options: { redirectTo: cleanRedirect, scopes: 'users.read tweet.read' }
        });
        if (error) {
            clearOAuthPending();
            console.warn('[x-auth] signIn error:', error);
        }
    }

    function forceIdentityRefresh(wallet) {
        if (!wallet) return;
        if (!window.MSNIdentity || !window.MSNIdentity.fetchProfile) return;
        var doRefresh = function () {
            window.MSNIdentity.fetchProfile(wallet, true).then(function (p) {
                if (p && window.MSNIdentity.propagateProfile) {
                    window.MSNIdentity.propagateProfile(wallet, p);
                }
            });
        };
        doRefresh();
        setTimeout(doRefresh, 700);
        setTimeout(doRefresh, 1500);
    }

    async function applyXToProfile(session) {
        var main = getMain();
        if (!main || !session) return;

        var m = session.user.user_metadata || {};
        var avatar = m.avatar_url || m.picture || m.profile_image_url || m.profile_image_url_https || m.avatar || '';
        if (avatar) avatar = avatar.replace('_normal', '_400x400');
        var handle = m.user_name || m.preferred_username || m.username || '';
        var displayName = m.name || m.full_name || m.display_name || handle || '';

        var wallet = getWallet();
        try {
            var pending = localStorage.getItem('msn_x_pending_wallet');
            if (!wallet && pending) wallet = pending;
        } catch (e) {}

        if (!wallet) { console.warn('[x-auth] no wallet to attach X identity'); return; }

        try {
            var { error } = await main.from('profiles').update({
                x_handle:     handle || null,
                x_verified:   true,
                x_avatar_url: avatar || null,
                display_name: displayName || null,
                updated_at:   new Date().toISOString()
            }).eq('wallet_address', wallet);

            if (error) { console.warn('[x-auth] profile update failed:', error.message); return; }

            console.log('[x-auth] X identity applied to', wallet);
            try { localStorage.removeItem('msn_x_pending_wallet'); } catch (e) {}

            forceIdentityRefresh(wallet);
        } catch (e) { console.warn('[x-auth] failed:', e); }
    }

    async function clearXFromProfile() {
        var main = getMain();
        var wallet = getWallet();
        if (!main || !wallet) return;
        try {
            await main.from('profiles').update({
                x_handle:     null,
                x_verified:   false,
                x_avatar_url: null,
                display_name: null,
                updated_at:   new Date().toISOString()
            }).eq('wallet_address', wallet);
            console.log('[x-auth] X identity cleared for', wallet);
            forceIdentityRefresh(wallet);
        } catch (e) { console.warn('[x-auth] clear failed:', e); }
    }

    function markButton(btn, signedIn) {
        if (!btn) return;
        btn.classList.toggle('x-signed-in', !!signedIn);
        var t = signedIn ? 'Verified via X — click to sign out' : 'Verify with X';
        btn.title = t;
        btn.setAttribute('aria-label', t);
    }
    function updateLabel(signedIn) {
        var label = document.getElementById('xAuthLabel');
        if (!label) return;
        label.textContent = signedIn ? 'VERIFIED' : 'VERIFY';
        label.classList.toggle('x-verified', !!signedIn);
    }
    function refreshButtons() {
        var s = !!_sessionCache;
        markButton(document.getElementById('xConnectBtn'), s);
        markButton(document.getElementById('sidebarXBtn'), s);
        updateLabel(s);
    }

    function injectHeaderButton() {
        if (document.getElementById('xConnectBtn')) return true;
        var phantom = document.getElementById('phantomConnectBtn');
        if (!phantom || !phantom.parentNode) return false;

        var wrap = document.createElement('span');
        wrap.id = 'xAuthWrap';
        wrap.className = 'x-auth-wrap';

        var label = document.createElement('span');
        label.id = 'xAuthLabel';
        label.className = 'x-auth-label';
        label.textContent = 'VERIFY';

        var btn = buildButton('xConnectBtn');
        wrap.appendChild(label);
        wrap.appendChild(btn);
        phantom.parentNode.insertBefore(wrap, phantom);

        markButton(btn, !!_sessionCache);
        updateLabel(!!_sessionCache);
        return true;
    }
    function retryHeaderButton() {
        if (injectHeaderButton()) return;
        setTimeout(retryHeaderButton, 200);
        setTimeout(retryHeaderButton, 600);
        setTimeout(retryHeaderButton, 1500);
        setTimeout(retryHeaderButton, 3000);
    }

    function injectMobileGridButton() {
        if (document.getElementById('sidebarXBtn')) return;
        var refreshBtn = document.getElementById('sidebarRefreshBtn');
        if (!refreshBtn || !refreshBtn.parentNode) return;
        var btn = buildButton('sidebarXBtn');
        refreshBtn.parentNode.replaceChild(btn, refreshBtn);
        markButton(btn, !!_sessionCache);
    }

    /* ═══════════════════════════════════════════════════════
       Boot
       ═══════════════════════════════════════════════════════ */
    function boot() {
        injectStyles();

        var returningFromOAuth = isOAuthPending();

        if (returningFromOAuth) {
            // ─────────────────────────────────────────────
            // OAuth return:
            //   1. Hide the loader's VISUALS immediately
            //   2. Keep `msn-booting` on <html> so the app
            //      stays hidden behind the boot gate
            //   3. Release when script.js fires `msn:app-ready`
            //      or after 1.6s (whichever comes first)
            // ─────────────────────────────────────────────
            suppressLoaderVisualOnly();

            var released = false;
            var release = function () {
                if (released) return;
                released = true;
                releaseBootGate();
            };

            // Preferred: script.js tells us it's done
            document.addEventListener('msn:app-ready', release, { once: true });

            // Safety net — never let the gate stay up forever
            setTimeout(release, 1600);

            // If script.js already announced ready (cached boot),
            // release on the next frame
            if (window.__msnAppReady === true) {
                requestAnimationFrame(release);
            }
        }

        retryHeaderButton();
        setTimeout(injectMobileGridButton, 900);
        setTimeout(injectMobileGridButton, 2400);
        setTimeout(injectMobileGridButton, 5400);

        var auth = getAuth();
        if (!auth) { console.warn('[x-auth] supabase sdk missing'); return; }

        auth.auth.getSession().then(function ({ data: { session } }) {
            _sessionCache = session;
            _sessionKnown = true;
            refreshButtons();

            if (session) {
                applyXToProfile(session);
                if (returningFromOAuth) {
                    setTimeout(clearOAuthPending, 1500);
                }
            } else {
                if (returningFromOAuth) clearOAuthPending();
            }
        });

        auth.auth.onAuthStateChange(function (event, session) {
            _sessionCache = session;
            _sessionKnown = true;
            refreshButtons();

            if (session) {
                applyXToProfile(session);
                if (event === 'SIGNED_IN' && returningFromOAuth) {
                    setTimeout(clearOAuthPending, 1500);
                }
            }
            if (event === 'SIGNED_OUT') {
                try { history.replaceState(null, '', location.pathname); } catch (e) {}
                clearOAuthPending();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    console.log('[x-auth] loaded v6');
})();
