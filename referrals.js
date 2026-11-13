/* ============================================================
   referrals.js — Referral link capture + one-time XP bonus
   ────────────────────────────────────────────────────────────
   • Captures ?ref=<wallet> from URL → localStorage (30-day TTL)
   • Claims on wallet connect + profile creation (retries)
   • One-time +50 XP to referrer via claim_referral RPC
   • 🎁 button in sidebar copies the user's referral link
   Load AFTER script.js (needs window.MSN.supabase)
   ============================================================ */
(function () {
    'use strict';
    if (window.MSNReferrals) return;

    var SB_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SB_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    var LS_KEY = 'msn_referrer_wallet';
    var LS_TS  = 'msn_referrer_ts';
    var TTL_MS = 30 * 24 * 60 * 60 * 1000;
    var BONUS_XP = 50;

    /* ── helpers ── */
    function getSB() {
        if (window.MSN && window.MSN.supabase) return window.MSN.supabase;
        if (window.supabase && window.supabase.createClient) {
            window.MSN = window.MSN || {};
            window.MSN.supabase = window.supabase.createClient(SB_URL, SB_KEY);
            return window.MSN.supabase;
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
    function isValidWallet(s) {
        return typeof s === 'string' && s.length >= 32 && s.length <= 48 && !/\s/.test(s);
    }
    function toast(msg) {
        var el = document.getElementById('errorToast');
        if (!el) { console.log('[referrals]', msg); return; }
        el.classList.remove('visible');
        void el.offsetWidth;
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(el._msnRefTimeout);
        el._msnRefTimeout = setTimeout(function () { el.classList.remove('visible'); }, 5000);
    }

    /* ── 1. Capture ?ref=<wallet> from URL ── */
    function captureRefFromURL() {
        try {
            var params = new URLSearchParams(window.location.search);
            var ref = params.get('ref');
            if (!ref || !isValidWallet(ref)) return;

            var me = getWallet();
            if (me && me === ref) return;   // self — skip

            localStorage.setItem(LS_KEY, ref);
            localStorage.setItem(LS_TS, String(Date.now()));
            console.log('[referrals] captured referrer:', ref.slice(0, 8) + '…');

            // Clean ?ref from URL (keep other params like ?room=)
            params.delete('ref');
            var newUrl = window.location.pathname +
                (params.toString() ? '?' + params.toString() : '') +
                window.location.hash;
            history.replaceState(null, '', newUrl);
        } catch (e) {
            console.warn('[referrals] capture failed:', e);
        }
    }

    function getStoredReferrer() {
        try {
            var ref = localStorage.getItem(LS_KEY);
            var ts  = parseInt(localStorage.getItem(LS_TS) || '0', 10);
            if (!ref) return null;
            if (Date.now() - ts > TTL_MS) {
                localStorage.removeItem(LS_KEY);
                localStorage.removeItem(LS_TS);
                return null;
            }
            return ref;
        } catch (e) { return null; }
    }
    function clearStoredReferrer() {
        try {
            localStorage.removeItem(LS_KEY);
            localStorage.removeItem(LS_TS);
        } catch (e) {}
    }

    /* ── 2. Claim referral (retries until success or terminal reason) ── */
    async function tryClaim() {
        var sb = getSB();
        var wallet = getWallet();
        if (!sb || !wallet) return;

        var ref = getStoredReferrer();
        if (!ref) return;
        if (ref === wallet) { clearStoredReferrer(); return; }

        try {
            var res = await sb.rpc('claim_referral', {
                p_wallet:     wallet,
                p_ref_wallet: ref
            });
            if (res.error) throw res.error;

            var d = res.data || {};
            console.log('[referrals] claim result:', d);

            if (d.ok) {
                clearStoredReferrer();
                toast('🎁 Referral claimed — your inviter earned +' + d.bonus + ' XP');
                return;
            }

            // Terminal failures — stop retrying
            if (d.reason === 'already_referred' ||
                d.reason === 'referrer_not_found' ||
                d.reason === 'self_referral') {
                clearStoredReferrer();
                return;
            }

            // 'wallet_not_profiled' — profile not created yet, retry later
            // 'missing_params'     — transient, retry later
        } catch (e) {
            console.warn('[referrals] claim failed:', e);
        }
    }

    /* ── 3. UI — 🎁 button in the sidebar ── */
    function injectReferButton() {
        if (document.getElementById('referralBtn')) return;
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) { setTimeout(injectReferButton, 500); return; }

        var btn = document.createElement('button');
        btn.id = 'referralBtn';
        btn.className = 'btn-icon referral-btn';
        btn.type = 'button';
        btn.title = 'Copy your referral link';
        btn.textContent = '🎁';
        btn.addEventListener('click', copyReferralLink);

        // Place above the sidebar footer (bottom-anchored, always visible)
        var footer = sidebar.querySelector('.sidebar-footer');
        if (footer && footer.parentNode) {
            footer.parentNode.insertBefore(btn, footer);
        } else {
            sidebar.appendChild(btn);
        }
    }

    async function copyReferralLink(e) {
        if (e) e.stopPropagation();

        var wallet = getWallet();
        if (!wallet) { toast('Connect your Phantom wallet first'); return; }

        var url = window.location.origin + window.location.pathname + '?ref=' + wallet;
        var self = document.getElementById('referralBtn');

        var flash = function () {
            if (!self) return;
            self.classList.add('copied');
            self.textContent = '✓';
            setTimeout(function () {
                self.classList.remove('copied');
                self.textContent = '🎁';
            }, 1500);
        };

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                flash();
                toast('🔗 Referral link copied — share it to earn XP');
                return;
            }
            throw new Error('clipboard unavailable');
        } catch (err) {
            try {
                var ta = document.createElement('textarea');
                ta.value = url;
                ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                flash();
                toast('🔗 Referral link copied — share it to earn XP');
            } catch (e2) {
                window.prompt('Copy your referral link:', url);
            }
        }
    }

    /* ── 4. Wallet-connect hook ── */
    window.addEventListener('msn:wallet-connected', function () {
        // Give script.js a moment to finish creating the profile row
        setTimeout(tryClaim, 1500);
    });

    /* ── 5. Boot ── */
    function boot() {
        captureRefFromURL();
        injectReferButton();

        // Retry claim if the profile takes a while to appear
        setTimeout(tryClaim, 3000);
        setTimeout(tryClaim, 6000);
        setTimeout(tryClaim, 12000);
        setTimeout(tryClaim, 20000);

        // Late button injection retries
        setTimeout(injectReferButton, 1500);
        setTimeout(injectReferButton, 4000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.MSNReferrals = {
        getReferrer:   getStoredReferrer,
        clearReferrer: clearStoredReferrer,
        copyLink:      copyReferralLink,
        tryClaim:      tryClaim
    };

    console.log('[referrals] loaded — bonus:', BONUS_XP, 'XP per referral');
})();
