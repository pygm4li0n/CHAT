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
    function isValidCode(s) {
        return typeof s === 'string' && /^[A-Z0-9]{6}$/i.test(String(s).trim());
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
            if (!ref) return;
            ref = String(ref).trim();
            if (!isValidWallet(ref) && !isValidCode(ref)) return;

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

        // ⚑ Resolve code to wallet
        var refWallet = ref;
        if (!isValidWallet(ref) && isValidCode(ref)) {
            try {
                var r = await sb.rpc('resolve_referral_code', { p_code: ref });
                if (r.error) throw r.error;
                refWallet = r.data || null;
            } catch (e) {
                console.warn('[referrals] code resolve failed:', e);
                return;
            }
            if (!refWallet) {
                clearStoredReferrer();
                toast('❌ Referral code not found');
                return;
            }
        }

        try {
            var res = await sb.rpc('claim_referral', {
                p_wallet:     wallet,
                p_ref_wallet: refWallet
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
        btn.className = 'referral-btn';
        btn.type = 'button';
        btn.title = 'Referral Code';
        btn.innerHTML = '<span class="ref-icon">🎁</span><span class="ref-text" id="refBtnText">REFERRAL CODE</span>';
        btn.addEventListener('click', openReferralModal);

        // Place above the sidebar footer (bottom-anchored, always visible)
        var footer = sidebar.querySelector('.sidebar-footer');
        if (footer && footer.parentNode) {
            footer.parentNode.insertBefore(btn, footer);
        } else {
            sidebar.appendChild(btn);
        }
    }

        async function copyReferralCode(e) {
        if (e) e.stopPropagation();

        var el = document.getElementById('referralCodeDisplay');
        var code = el ? el.textContent.trim() : '';
        if (!code || code === '······') {
            toast('Code loading...');
            return;
        }

        var self = document.getElementById('referralCopyBtn');

        var flash = function () {
            if (!self) return;
            var orig = self.textContent;
            self.textContent = '✓ Copied!';
            setTimeout(function () {
                self.textContent = orig;
            }, 1500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(code);
                flash();
                toast('🎁 Code copied: ' + code);
                return;
            } catch (err) {}
        }
        
        try {
            var ta = document.createElement('textarea');
            ta.value = code;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            flash();
            toast('🎁 Code copied: ' + code);
        } catch (e2) {
            window.prompt('Copy your referral code:', code);
        }
    }

    /* ═══════════════════════════════════════════════════════
       REFERRAL MODAL — stats + share actions
       ═══════════════════════════════════════════════════════ */
    function injectModal() {
        if (document.getElementById('referralModal')) return;

        var modal = document.createElement('div');
        modal.id = 'referralModal';
        modal.className = 'referral-modal hidden';
        modal.innerHTML =
            '<div class="referral-modal-card">' +
                '<button class="referral-modal-close" id="referralModalClose" aria-label="Close">✕</button>' +
                '<div class="referral-modal-header">' +
                    '<div class="referral-modal-icon">🎁</div>' +
                    '<div>' +
                        '<h3 class="referral-modal-title">Your Referral Link</h3>' +
                        '<p class="referral-modal-subtitle">Earn +50 XP for every new wallet</p>' +
                    '</div>' +
                '</div>' +
                '<div class="referral-stats">' +
                    '<div class="referral-stat">' +
                        '<span class="referral-stat-value" id="referralCount">—</span>' +
                        '<span class="referral-stat-label">Referred</span>' +
                    '</div>' +
                    '<div class="referral-stat">' +
                        '<span class="referral-stat-value" id="referralXP">—</span>' +
                        '<span class="referral-stat-label">XP Earned</span>' +
                    '</div>' +
                    '<div class="referral-stat">' +
                        '<span class="referral-stat-value">+50</span>' +
                        '<span class="referral-stat-label">Per Signup</span>' +
                    '</div>' +
                '</div>' +
                '<label class="referral-link-label">Your code</label>' +
                '<div class="referral-code-box">' +
                    '<span class="referral-code-display" id="referralCodeDisplay">······</span>' +
                '</div>' +
                '<div class="referral-actions">' +
                    '<button class="referral-action-btn primary" id="referralCopyBtn">📋 Copy Code</button>' +
                    '<button class="referral-action-btn ghost" id="referralDownloadBtn">🖼 Download Card</button>' +
                '</div>' +
                '<div class="referral-redeem">' +
                    '<label class="referral-link-label" for="referralRedeemInput">Have a code?</label>' +
                    '<div class="referral-redeem-row">' +
                        '<input type="text" class="referral-redeem-input" id="referralRedeemInput" placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters">' +
                        '<button class="referral-redeem-btn" id="referralRedeemBtn">Claim</button>' +
                    '</div>' +
                '</div>' +
                '<p class="referral-hint">Share the code — it\'s easier!</p>' +
            '</div>';

        document.body.appendChild(modal);

        // Wire up
        document.getElementById('referralModalClose').addEventListener('click', closeReferralModal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeReferralModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeReferralModal();
        });

        document.getElementById('referralCopyBtn').addEventListener('click', function (e) {
            e.stopPropagation();
            copyReferralCode(e);
        });
        document.getElementById('referralRedeemBtn').addEventListener('click', function (e) {
            e.stopPropagation();
            redeemReferralCode();
        });
        document.getElementById('referralRedeemInput').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                redeemReferralCode();
            }
        });

        document.getElementById('referralDownloadBtn').addEventListener('click', function (e) {
            e.stopPropagation();
            downloadReferralCard(e);
        });
    }

    function openReferralModal(e) {
        if (e) e.stopPropagation();
        var wallet = getWallet();
        if (!wallet) { toast('Connect your Phantom wallet first'); return; }

        injectModal();
        var modal = document.getElementById('referralModal');
        if (!modal) return;

        document.getElementById('referralCount').textContent = '—';
        document.getElementById('referralXP').textContent = '—';

        modal.classList.remove('hidden');
        loadReferralStats();
        loadMyCode();
    }

    async function loadMyCode() {
        var sb = getSB();
        var wallet = getWallet();
        if (!sb || !wallet) return;

        var el = document.getElementById('referralCodeDisplay');
        if (!el) return;

        try {
            var r = await sb.rpc('get_my_referral_code', { p_wallet: wallet });
            if (r.error) throw r.error;
            var code = r.data;
            if (code) {
                el.textContent = code;
                var btnText = document.getElementById('refBtnText');
                if (btnText) btnText.textContent = 'CODE: ' + code;
            } else {
                el.textContent = '······';
            }
        } catch (err) {
            console.warn('[referrals] code load failed:', err);
            el.textContent = '······';
        }
    }

    function closeReferralModal() {
        var modal = document.getElementById('referralModal');
        if (modal) modal.classList.add('hidden');
    }

    async function loadReferralStats() {
        var sb = getSB();
        var wallet = getWallet();
        if (!sb || !wallet) return;

        try {
            var res = await sb.rpc('get_referral_stats', { p_wallet: wallet });
            if (res.error) throw res.error;
            var d = res.data || {};
            var countEl = document.getElementById('referralCount');
            var xpEl = document.getElementById('referralXP');
            if (countEl) countEl.textContent = d.count ?? 0;
            if (xpEl) xpEl.textContent = '+' + (d.xp_from_refs ?? 0);
        } catch (err) {
            console.warn('[referrals] stats failed:', err);
            var countEl = document.getElementById('referralCount');
            var xpEl = document.getElementById('referralXP');
            if (countEl) countEl.textContent = '0';
            if (xpEl) xpEl.textContent = '+0';
        }
    }

       async function redeemReferralCode() {
        var wallet = getWallet();
        if (!wallet) { toast('Connect your Phantom wallet first'); return; }

        var inp = document.getElementById('referralRedeemInput');
        var btn = document.getElementById('referralRedeemBtn');
        if (!inp) return;

        var code = String(inp.value || '').trim().toUpperCase();
        if (!code) { toast('Enter a code'); return; }
        if (!isValidCode(code)) { toast('Codes are 6 characters (A-Z, 0-9)'); return; }

        var sb = getSB();
        if (!sb) { toast('No connection'); return; }

        if (btn) { btn.disabled = true; btn.textContent = '…'; }

        try {
            var r = await sb.rpc('resolve_referral_code', { p_code: code });
            if (r.error) throw r.error;
            var refWallet = r.data;
            if (!refWallet) { toast('❌ Code not found'); return; }
            if (refWallet === wallet) { toast('You can\'t refer yourself'); return; }

            var c = await sb.rpc('claim_referral', { p_wallet: wallet, p_ref_wallet: refWallet });
            if (c.error) throw c.error;

            var d = c.data || {};
            if (d.ok) {
                toast('🎁 Referral claimed — inviter earned +' + (d.bonus || 50) + ' XP');
                inp.value = '';
                clearStoredReferrer();
                loadReferralStats();
                return;
            }

            if (d.reason === 'already_referred')       toast('You were already referred');
            else if (d.reason === 'self_referral')     toast('You can\'t refer yourself');
            else if (d.reason === 'referrer_not_found') toast('❌ Code not found');
            else if (d.reason === 'wallet_not_profiled') toast('Create your profile first');
            else                                        toast('Claim failed: ' + (d.reason || 'unknown'));

        } catch (err) {
            console.warn('[referrals] redeem failed:', err);
            toast('Claim failed — try again');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Claim'; }
        }
    }
    /* ═══════════════════════════════════════════════════════
       CANVAS CARD — 1200×630 PNG, ready for X
       ═══════════════════════════════════════════════════════ */
    async function downloadReferralCard(e) {
        if (e) e.stopPropagation();
        var wallet = getWallet();
        if (!wallet) { toast('Connect your wallet first'); return; }

        var countEl = document.getElementById('referralCount');
        var xpEl    = document.getElementById('referralXP');
        var count   = parseInt(countEl ? countEl.textContent : '0', 10) || 0;
        var xp      = parseInt((xpEl ? xpEl.textContent : '0').replace('+', ''), 10) || 0;

        var btn = document.getElementById('referralDownloadBtn');
        var origHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '…'; }

        try {
            var canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 630;
            var ctx = canvas.getContext('2d');

            // ── Background gradient ──
            var bg = ctx.createLinearGradient(0, 0, 1200, 630);
            bg.addColorStop(0, '#0a0e1a');
            bg.addColorStop(0.5, '#050914');
            bg.addColorStop(1, '#0a0e1a');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 1200, 630);

            // ── Accent glow ──
            var glow = ctx.createRadialGradient(600, 315, 50, 600, 315, 700);
            glow.addColorStop(0, 'rgba(0, 240, 255, 0.18)');
            glow.addColorStop(1, 'rgba(0, 240, 255, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, 1200, 630);

            // ── Border frame ──
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
            ctx.lineWidth = 3;
            ctx.strokeRect(28, 28, 1144, 574);

            // ── Corner accents ──
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 5;
            var c = 40;
            // top-left
            ctx.beginPath(); ctx.moveTo(28, 28 + c); ctx.lineTo(28, 28); ctx.lineTo(28 + c, 28); ctx.stroke();
            // top-right
            ctx.beginPath(); ctx.moveTo(1172 - c, 28); ctx.lineTo(1172, 28); ctx.lineTo(1172, 28 + c); ctx.stroke();
            // bottom-left
            ctx.beginPath(); ctx.moveTo(28, 602 - c); ctx.lineTo(28, 602); ctx.lineTo(28 + c, 602); ctx.stroke();
            // bottom-right
            ctx.beginPath(); ctx.moveTo(1172 - c, 602); ctx.lineTo(1172, 602); ctx.lineTo(1172, 602 - c); ctx.stroke();

            // ── Logo (try, fallback silently) ──
            try {
                var logo = await new Promise(function (resolve) {
                    var img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = function () { resolve(img); };
                    img.onerror = function () { resolve(null); };
                    img.src = 'https://i.postimg.cc/HWf8LcLQ/Proyecto-nuevo-(4)-(1).png';
                    setTimeout(function () { resolve(null); }, 2000);
                });
                if (logo && logo.naturalWidth > 0) {
                    var logoH = 100;
                    var logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
                    ctx.drawImage(logo, 600 - logoW / 2, 55, logoW, logoH);
                }
            } catch (e2) { /* logo failed, continue without */ }

            // ── Title ──
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 64px "Segoe UI", "Inter", system-ui, sans-serif';
            ctx.fillText('JOIN MEME SOCIAL', 600, 250);
            ctx.fillText('NETWORK', 600, 315);

            // ── Subtitle ──
            ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
            ctx.font = '600 26px "Segoe UI", "Inter", system-ui, sans-serif';
            ctx.fillText('TOKEN-GATED ROOMS · WHALE CHAT · LIVE RANKINGS', 600, 380);

            // ── Referral counter (if any) ──
            if (count > 0) {
                ctx.fillStyle = 'rgba(74, 222, 128, 0.95)';
                ctx.font = 'bold 30px "Segoe UI", "Inter", system-ui, sans-serif';
                ctx.fillText('🚀  ' + count + ' WARRIOR' + (count === 1 ? '' : 'S') + ' REFERRED', 600, 435);
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.font = '600 22px "Segoe UI", "Inter", system-ui, sans-serif';
                ctx.fillText('BE THE FIRST TO JOIN', 600, 435);
            }

            // ── CTA ──
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.font = '500 22px "Segoe UI", "Inter", system-ui, sans-serif';
            ctx.fillText('Click the link in the post to join ↓', 600, 490);

            // ── Code ──
            try {
                var sb = getSB();
                var codeRes = await sb.rpc('get_my_referral_code', { p_wallet: wallet });
                var myCode = (!codeRes.error && codeRes.data) ? codeRes.data : null;
                if (myCode) {
                    ctx.fillStyle = '#00f0ff';
                    ctx.font = 'bold 42px "Courier New", monospace';
                    ctx.fillText('CODE: ' + myCode, 600, 540);
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.font = '500 16px "Courier New", monospace';
                    ctx.fillText('or visit ' + window.location.origin + '?ref=' + myCode, 600, 578);
                } else {
                    ctx.fillStyle = '#00f0ff';
                    ctx.font = 'bold 26px "Courier New", monospace';
                    ctx.fillText('REF: ' + wallet.slice(0, 6) + '…' + wallet.slice(-6), 600, 545);
                }
            } catch (e) {
                ctx.fillStyle = '#00f0ff';
                ctx.font = 'bold 26px "Courier New", monospace';
                ctx.fillText('REF: ' + wallet.slice(0, 6) + '…' + wallet.slice(-6), 600, 545);
            }

            // ── Download ──
            var dataUrl = canvas.toDataURL('image/png');
            var link = document.createElement('a');
            link.download = 'msn-referral-' + wallet.slice(0, 6) + '.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast('🖼 Card downloaded — attach it to your tweet');

        } catch (err) {
            console.error('[referrals] card failed:', err);
            toast('Card failed to generate — try again');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
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
        injectModal();
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
        copyCode:      copyReferralCode,
        tryClaim:      tryClaim,
        open:          openReferralModal,
        close:         closeReferralModal,
        stats:         loadReferralStats,
        downloadCard:  downloadReferralCard,
        redeemCode:    redeemReferralCode,
        loadMyCode:    loadMyCode
    };

    console.log('[referrals] loaded — bonus:', BONUS_XP, 'XP per referral');
})();
