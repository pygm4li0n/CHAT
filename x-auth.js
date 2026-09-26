/* ═══════════════════════════════════════════════════════════
   x-auth.js
   ───────────────────────────────────────────────────────────
   • Injects an X login button:
       – Desktop: left of #phantomConnectBtn in the header
       – Mobile:  replaces #sidebarRefreshBtn in the 2×2 grid
   • Uses the SEPARATE X auth Supabase project for OAuth
   • On success, writes x_handle / x_verified / x_avatar_url /
     display_name to profiles (main app project), keyed by wallet
   • wallet-identity.js handles the rest via realtime
   Load AFTER wallet-identity.js

   v3 fixes:
   • On OAuth return, dismiss the boot loader immediately so
     the user lands back in the chat, not a fresh loading screen.
   • Cache session state on boot, so the first click fires the
     OAuth redirect without awaiting getSession() first.
   • Retry header button injection (was firing before Phantom).
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    // ── X auth project ─────────────────────────────────────
    var X_AUTH_URL = 'https://ygmahgaoblaqgmifndgo.supabase.co';
    var X_AUTH_KEY = 'sb_publishable_qV3N0q_a4Y7m_AAo6hPfKQ_V6GNgX-G';

    // ── Main app project ───────────────────────────────────
    var MAIN_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var MAIN_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    var authClient = null;
    var mainClient = null;

    /* ⚑ Cached session state — lets handleClick decide instantly
       without an await, which fixes the "first click does nothing"
       bug (awaiting getSession() consumes the user gesture before
       the OAuth redirect fires on some browsers). */
    var _sessionCache = null;
    var _sessionKnown = false;

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

    /* ─────────────────────────────────────────────────────────
       ⚑ Loader dismissal — kills the boot overlay + the
         `msn-booting` class so the app is visible right away.
         Called on OAuth return and on any SIGNED_IN event.
       ───────────────────────────────────────────────────────── */
    function dismissBootLoader() {
        try {
            document.documentElement.classList.remove('msn-booting');
            document.documentElement.classList.remove('booting');
        } catch (e) {}

        var ov = document.getElementById('msnBootOverlay');
        if (ov) {
            ov.classList.add('done');
            setTimeout(function () {
                if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
            }, 600);
        }
    }

    /* ─────────────────────────────────────────────────────────
       Styles — 44×44, matches Phantom's footprint exactly
       ───────────────────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById('x-auth-styles')) return;
        var css = [
            '.x-auth-btn{',
            '  position:relative!important;overflow:hidden!important;',
            '  width:44px!important;height:44px!important;',
            '  min-width:44px!important;min-height:44px!important;',
            '  padding:0!important;',
            '  border-radius:8px!important;',
            '  background:linear-gradient(135deg,#1d9bf0 0%,#a855f7 38%,#ff2d95 68%,#00ffc6 100%)!important;',
            '  background-size:280% 280%!important;',
            '  animation:xGs 6s ease infinite!important;',
            '  border:none!important;color:#fff!important;',
            '  display:inline-flex!important;align-items:center!important;justify-content:center!important;',
            '  box-shadow:0 6px 20px -8px rgba(168,85,247,.85),0 0 24px -10px rgba(29,155,240,.7)!important;',
            '  transition:filter .2s ease,transform .2s ease!important;',
            '  cursor:pointer!important;',
            '}',
            '.x-auth-btn::after{',
            '  content:"";position:absolute;top:-60%;left:-70%;width:38%;height:220%;',
            '  background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);',
            '  transform:rotate(20deg);animation:xSweep 3.6s ease-in-out infinite;pointer-events:none;',
            '}',
            '.x-auth-btn:hover{filter:brightness(1.18) saturate(1.25);transform:translateY(-1px) scale(1.04);}',
            '.x-auth-btn:active{transform:scale(.96);}',
            '.x-auth-btn svg{',
            '  width:24px!important;height:24px!important;',
            '  fill:#fff;position:relative;z-index:1;',
            '  filter:drop-shadow(0 1px 3px rgba(0,0,0,.35)) drop-shadow(0 0 6px rgba(255,255,255,.5));',
            '}',
            '.x-auth-btn.x-signed-in{',
            '  background:linear-gradient(135deg,#00ffc6 0%,#1d9bf0 50%,#a855f7 100%)!important;',
            '  background-size:280% 280%!important;',
            '}',
            '@keyframes xGs{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
            '@keyframes xSweep{0%,12%{left:-70%}55%,100%{left:140%}}'
        ].join('\n');
        var tag = document.createElement('style');
        tag.id = 'x-auth-styles';
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ─────────────────────────────────────────────────────────
       Button factory
       ───────────────────────────────────────────────────────── */
    var X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

    function buildButton(id) {
        var btn = document.createElement('button');
        btn.id = id;
        btn.type = 'button';
        btn.className = 'btn-icon x-auth-btn';
        btn.title = 'Sign in with X';
        btn.setAttribute('aria-label', 'Sign in with X');
        btn.innerHTML = X_SVG;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            handleClick();
        });
        return btn;
    }

    /* ─────────────────────────────────────────────────────────
       Click handler — synchronous decision from cache
       ───────────────────────────────────────────────────────── */
    function handleClick() {
        var auth = getAuth();
        if (!auth) { console.warn('[x-auth] auth client unavailable'); return; }

        // If we don't know the session state yet, ask once then act
        if (!_sessionKnown) {
            auth.auth.getSession().then(function ({ data: { session } }) {
                _sessionCache = session;
                _sessionKnown = true;
                _doClickAction(auth, session);
            });
            return;
        }

        // Cached — decide and act immediately (preserves user gesture)
        _doClickAction(auth, _sessionCache);
    }

    async function _doClickAction(auth, session) {
        // Signed in → sign out
        if (session) {
            await auth.auth.signOut();
            try { history.replaceState(null, '', location.pathname); } catch (e) {}
            _sessionCache = null;
            _sessionKnown = true;
            await clearXFromProfile();
            refreshButtons();
            return;
        }

        // Not signed in — require a wallet first
        var wallet = getWallet();
        if (!wallet) {
            alert('Connect your Phantom wallet first, then sign in with X.');
            return;
        }

        // Remember which wallet we're verifying so we know where to write on return
        try { localStorage.setItem('msn_x_pending_wallet', wallet); } catch (e) {}

        // Strip any lingering ?code= / #access_token= before redirect
        var cleanRedirect = location.origin + location.pathname;

        var { error } = await auth.auth.signInWithOAuth({
            provider: 'x',
            options: {
                redirectTo: cleanRedirect,
                scopes: 'users.read tweet.read'
            }
        });
        if (error) console.warn('[x-auth] signIn error:', error);
    }

    /* ─────────────────────────────────────────────────────────
       Force refresh helper
       ───────────────────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────────────────
       Write X identity to the main app's profiles table
       ───────────────────────────────────────────────────────── */
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

            if (error) {
                console.warn('[x-auth] profile update failed:', error.message);
                return;
            }

            console.log('[x-auth] X identity applied to', wallet);
            try { localStorage.removeItem('msn_x_pending_wallet'); } catch (e) {}

            forceIdentityRefresh(wallet);
        } catch (e) { console.warn('[x-auth] failed:', e); }
    }

    /* ─────────────────────────────────────────────────────────
       Sign-out — clears EVERY X-related column including
       display_name so the name reverts to the wallet's username
       ───────────────────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────────────────
       Button state
       ───────────────────────────────────────────────────────── */
    function markButton(btn, signedIn) {
        if (!btn) return;
        btn.classList.toggle('x-signed-in', !!signedIn);
        btn.title = signedIn ? 'Sign out of X' : 'Sign in with X';
        btn.setAttribute('aria-label', btn.title);
    }
    function refreshButtons() {
        var s = !!_sessionCache;
        markButton(document.getElementById('xConnectBtn'), s);
        markButton(document.getElementById('sidebarXBtn'), s);
    }

    /* ─────────────────────────────────────────────────────────
       Inject — desktop header (left of Phantom)
       ⚑ Retries added — Phantom button may not exist yet when
         x-auth first runs, especially on slow connections.
       ───────────────────────────────────────────────────────── */
    function injectHeaderButton() {
        if (document.getElementById('xConnectBtn')) return true;
        var phantom = document.getElementById('phantomConnectBtn');
        if (!phantom || !phantom.parentNode) return false;
        var btn = buildButton('xConnectBtn');
        phantom.parentNode.insertBefore(btn, phantom);
        return true;
    }
    function retryHeaderButton() {
        if (injectHeaderButton()) return;
        setTimeout(retryHeaderButton, 200);
        setTimeout(retryHeaderButton, 600);
        setTimeout(retryHeaderButton, 1500);
        setTimeout(retryHeaderButton, 3000);
    }

    /* ─────────────────────────────────────────────────────────
       Inject — mobile 2×2 grid (replace the ↻ button)
       ───────────────────────────────────────────────────────── */
    function injectMobileGridButton() {
        if (document.getElementById('sidebarXBtn')) return;
        var refreshBtn = document.getElementById('sidebarRefreshBtn');
        if (!refreshBtn || !refreshBtn.parentNode) return;
        var btn = buildButton('sidebarXBtn');
        refreshBtn.parentNode.replaceChild(btn, refreshBtn);
    }

    /* ─────────────────────────────────────────────────────────
       Detect OAuth return — if we came back from X, kill the
       loader as soon as possible.
       ───────────────────────────────────────────────────────── */
    function isOAuthReturn() {
        try {
            if (localStorage.getItem('msn_x_pending_wallet')) return true;
        } catch (e) {}
        var h = location.href;
        // PKCE: ?code=...&state=...
        if (/\?(.*&)?code=/.test(h)) return true;
        // Implicit: #access_token=...
        if (/#(.*&)?access_token=/.test(h)) return true;
        return false;
    }

    /* ─────────────────────────────────────────────────────────
       Boot
       ───────────────────────────────────────────────────────── */
    function boot() {
        injectStyles();

        // ⚑ If we're returning from X, dismiss the loader NOW —
        //   don't wait for loading-screen.js to finish its cycle.
        if (isOAuthReturn()) {
            dismissBootLoader();
            // Hide again shortly after in case the loader re-injects
            setTimeout(dismissBootLoader, 50);
            setTimeout(dismissBootLoader, 300);
            setTimeout(dismissBootLoader, 900);
        }

        retryHeaderButton();

        // Shim creates the grid at 600 / 2000 / 5000ms — we run after each
        setTimeout(injectMobileGridButton, 900);
        setTimeout(injectMobileGridButton, 2400);
        setTimeout(injectMobileGridButton, 5400);

        var auth = getAuth();
        if (!auth) { console.warn('[x-auth] supabase sdk missing'); return; }

        // Prime the session cache + handle OAuth return
        auth.auth.getSession().then(function ({ data: { session } }) {
            _sessionCache = session;
            _sessionKnown = true;

            refreshButtons();

            if (session) {
                // ⚑ We're signed in (typically after OAuth return) —
                //   apply X identity and dismiss the loader.
                dismissBootLoader();
                applyXToProfile(session);
            }
        });

        auth.auth.onAuthStateChange(function (event, session) {
            _sessionCache = session;
            _sessionKnown = true;

            refreshButtons();

            if (session) {
                dismissBootLoader();
                applyXToProfile(session);
            }
            if (event === 'SIGNED_OUT') {
                try { history.replaceState(null, '', location.pathname); } catch (e) {}
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    console.log('[x-auth] loaded v3');
})();
