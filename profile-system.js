/* ============================================================
   profile-system.js — MSN Profile / User Identity HUD
   ────────────────────────────────────────────────────────────
   Drop-in. Load AFTER script.js + wallet-identity.js.

     <script src="profile-system.js?v=14"></script>

   v9: fixed profiles SELECT, compact fit-no-scroll layout
   ============================================================ */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) {
            return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
        });
    }
    function parseBalanceValue(v) {
        if (v == null) return 0;
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        var s = String(v).trim().toUpperCase();
        s = s.replace(/[^0-9.,KMB]/g, '').replace(/,/g, '');
        var mult = 1;
        var last = s.slice(-1);
        if (last === 'B') { mult = 1e9; s = s.slice(0, -1); }
        else if (last === 'M') { mult = 1e6; s = s.slice(0, -1); }
        else if (last === 'K') { mult = 1e3; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isFinite(n) ? n * mult : 0;
    }
    function tierFor(balance) {
        var b = parseBalanceValue(balance);
        if (b >= 1_000_000) return { name: 'Whale',   emoji: '🐋' };
        if (b >=   250_000) return { name: 'Dolphin', emoji: '🐬' };
        if (b >=   100_000) return { name: 'Crab',    emoji: '🦀' };
        return                     { name: 'Shrimp',  emoji: '🦐' };
    }
    function resolveBalance(data) {
        if (!data) return null;
        var raw =
            data.token_balance ?? data.balance ?? data.amount ??
            data.holding ?? data.holdings ?? data.tokens ?? 0;
        return parseBalanceValue(raw);
    }
    function fmtNum(n) {
        var v = Number(n) || 0;
        if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (v >= 10000)   return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return v.toLocaleString();
    }
    function fmtDate(iso) {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleDateString([], { month: 'short', year: 'numeric' }); }
        catch (e) { return '—'; }
    }
    function timeAgo(iso) {
        if (!iso) return '—';
        try {
            var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
            if (s < 60)          return 'just now';
            if (s < 3600)        return Math.floor(s / 60) + 'm ago';
            if (s < 86400)       return Math.floor(s / 3600) + 'h ago';
            if (s < 86400 * 7)   return Math.floor(s / 86400) + 'd ago';
            if (s < 86400 * 30)  return Math.floor(s / (86400 * 7)) + 'w ago';
            if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + 'mo ago';
            return Math.floor(s / (86400 * 365)) + 'y ago';
        } catch (e) { return '—'; }
    }
    function shortWallet(addr) {
        if (!addr) return '';
        return addr.slice(0, 4) + '…' + addr.slice(-4);
    }
    function levelFromXp(xp) {
        if (!xp || xp < 50) return 1;
        return Math.max(1, Math.floor((1 + Math.sqrt(1 + (xp * 4 / 25))) / 2));
    }
    function xpForLevel(L) { return L <= 1 ? 0 : 25 * (L - 1) * L; }
    function cssEscape(s) {
        if (window.CSS && CSS.escape) return CSS.escape(s);
        return String(s).replace(/"/g, '\\"');
    }
    function isWalletLike(s) {
        return typeof s === 'string' && s.length >= 32 && s.length <= 48 && !/\s/.test(s);
    }
    function getSB() {
        if (window.MSN && window.MSN.supabase) return window.MSN.supabase;
        if (window.supabase && window.supabase.createClient) {
            window.MSN = window.MSN || {};
            window.MSN.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window.MSN.supabase;
        }
        return null;
    }
    function getSelfUsername() {
        try { return localStorage.getItem('msn_chat_username') || null; } catch (e) { return null; }
    }
    function isUserOnline(username) {
        if (!username) return false;
        var item = document.querySelector('.sidebar-user-item[data-username="' + cssEscape(username) + '"]');
        return !!(item && item.querySelector('.online-indicator'));
    }
    function resolveIdentity(x) {
        if (window.MSNIdentity && window.MSNIdentity.resolve) return window.MSNIdentity.resolve(x);
        return null;
    }
    function rememberIdentity(p) {
        if (window.MSNIdentity && window.MSNIdentity.remember) {
            try { window.MSNIdentity.remember(p); } catch (e) {}
        }
    }
    function readSelfStreakFromDOM() {
        var container = document.getElementById('sidebarStreakDisplay');
        if (!container || container.classList.contains('hidden')) return 0;
        var overflow = document.getElementById('streakOverflow');
        if (overflow && !overflow.classList.contains('hidden')) {
            var m = (overflow.textContent || '').match(/(\d+)/);
            if (m) return Number(m[1]);
        }
        var fires = document.getElementById('streakFires');
        if (!fires) return 0;
        return fires.querySelectorAll('.fire-slot.fire-filled').length;
    }
    function extractUsernameFromMsgUsername(el) {
        if (!el) return null;
        var link = el.querySelector('.msn-username-link');
        if (link) return link.textContent.trim() || null;
        for (var i = 0; i < el.childNodes.length; i++) {
            var n = el.childNodes[i];
            if (n.nodeType === 3) {
                var t = String(n.nodeValue || '').trim();
                if (t) return t;
            }
        }
        return null;
    }
    function toast(msg) {
        var el = document.getElementById('errorToast');
        if (!el) { console.log('[profile]', msg); return; }
        el.classList.remove('visible'); void el.offsetWidth;
        el.textContent = msg; el.classList.add('visible');
        clearTimeout(el._msnProfileTimeout);
        el._msnProfileTimeout = setTimeout(function () { el.classList.remove('visible'); }, 5000);
    }

    /* ═══════════════════════════════════════════════════════
       CSS — COMPACT HUD v9 (fits without scrolling)
       ═══════════════════════════════════════════════════════ */
    function injectStyles() {
        var old = document.getElementById('msn-profile-styles');
        if (old) old.remove();
        var css = `
/* ═══════════════════════════════════════════════════════
   MSN PROFILE CARD — compact HUD v9
   ═══════════════════════════════════════════════════════ */

.msn-profile-overlay{
    position:fixed;
    inset:0;
    z-index:500;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:16px;
    background:radial-gradient(ellipse at center, rgba(8,14,26,.92) 0%, rgba(2,4,10,.98) 100%);
    backdrop-filter:blur(14px);
    -webkit-backdrop-filter:blur(14px);
    opacity:0;
    pointer-events:none;
    transition:opacity .3s ease;
}
.msn-profile-overlay.open{opacity:1;pointer-events:auto;}

/* ── Card — no scroll, compact ── */
.msn-profile-card{
    position:relative;
    width:100%;
    max-width:500px;
    max-height:calc(100vh - 32px);
    overflow:hidden;
    padding:22px 24px 18px;
    background:
        radial-gradient(ellipse 120% 80% at 50% 0%, rgba(0,240,255,.06) 0%, transparent 60%),
        linear-gradient(180deg, #0d1528 0%, #050810 100%);
    border-radius:20px;
    box-shadow:
        0 0 0 1px rgba(0,240,255,.45),
        0 0 0 2px rgba(0,0,0,.7),
        0 0 40px rgba(0,240,255,.18),
        0 0 110px rgba(0,240,255,.10),
        0 30px 90px rgba(0,0,0,.9),
        inset 0 1px 0 rgba(255,255,255,.05);
    transform:scale(.92) translateY(20px);
    opacity:0;
    transition:transform .4s cubic-bezier(.16,1,.3,1), opacity .3s ease;
    font-family:var(--font-main, "Segoe UI", system-ui, sans-serif);
    color:#fff;
    text-align:left;
}
.msn-profile-overlay.open .msn-profile-card{
    transform:scale(1) translateY(0);
    opacity:1;
}

/* Orbiting scanner arcs */
.msn-profile-card::after{
    content:"";
    position:absolute;
    inset:-1px;
    border-radius:21px;
    padding:1.5px;
    background:conic-gradient(from 0deg,
        transparent 0deg,
        transparent 70deg,
        #00f0ff 90deg,
        #b9f6ff 100deg,
        #00f0ff 110deg,
        transparent 130deg,
        transparent 250deg,
        #a855f7 270deg,
        #e6d4ff 280deg,
        #a855f7 290deg,
        transparent 310deg,
        transparent 360deg);
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;
            mask-composite:exclude;
    pointer-events:none;
    animation:msnBorderSpin 5s linear infinite;
    filter:drop-shadow(0 0 6px rgba(0,240,255,.7));
}
@keyframes msnBorderSpin{to{transform:rotate(360deg);}}

/* ── Close button ── */
.msn-profile-close{
    position:absolute;
    top:12px;
    right:12px;
    width:30px;
    height:30px;
    border-radius:50%;
    border:1.5px solid rgba(0,240,255,.35);
    background:rgba(10,16,30,.9);
    color:#00f0ff;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:.82rem;
    z-index:5;
    transition:transform .35s cubic-bezier(.16,1,.3,1), border-color .2s, color .2s, box-shadow .2s;
}
.msn-profile-close:hover,
.msn-profile-close:focus-visible{
    outline:none;
    border-color:#ff2d55;
    color:#ff2d55;
    transform:rotate(90deg) scale(1.1);
    box-shadow:0 0 20px rgba(255,45,85,.6);
}

/* ── HEADER ── */
.msn-profile-head{
    display:flex;
    align-items:center;
    gap:16px;
    padding-bottom:14px;
    margin-bottom:12px;
    border-bottom:1px solid rgba(0,240,255,.15);
}

/* ── Avatar ── */
.msn-profile-avatar-wrap{
    position:relative;
    width:88px;
    height:88px;
    flex:0 0 auto;
}
.msn-profile-avatar-wrap::before{
    content:"";
    position:absolute;
    inset:-5px;
    border-radius:50%;
    background:conic-gradient(from 0deg, transparent 0deg, #00f0ff 60deg, transparent 140deg, transparent 220deg, #a855f7 280deg, transparent 360deg);
    animation:msnBorderSpin 3.5s linear infinite;
    opacity:.85;
    z-index:0;
    pointer-events:none;
}
.msn-profile-avatar{
    position:relative;
    width:100%;
    height:100%;
    border-radius:50%;
    background:#050810;
    border:2px solid #00f0ff;
    overflow:hidden;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:2rem;
    font-weight:900;
    color:#fff;
    z-index:1;
    box-shadow:
        inset 0 0 30px rgba(0,0,0,.8),
        0 0 30px rgba(0,240,255,.4);
    text-shadow:0 0 16px rgba(0,240,255,.8);
}
.msn-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block;}

.msn-profile-status-dot{
    position:absolute;
    bottom:0;
    right:0;
    width:18px;
    height:18px;
    border-radius:50%;
    background:#5a6b88;
    border:3px solid #050810;
    z-index:3;
}
.msn-profile-status-dot.online{
    background:#4ade80;
    box-shadow:0 0 14px #4ade80, 0 0 28px rgba(74,222,128,.6);
}
.msn-profile-status-dot.online::before{
    content:"";
    position:absolute;
    inset:-3px;
    border-radius:50%;
    border:2px solid #4ade80;
    animation:msnPing 1.8s ease-out infinite;
    pointer-events:none;
}
@keyframes msnPing{
    0%{transform:scale(1);opacity:.9;}
    100%{transform:scale(2.2);opacity:0;}
}

/* ── Identity ── */
.msn-profile-identity{
    flex:1 1 auto;
    min-width:0;
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:6px;
}
.msn-profile-username{
    margin:0;
    font-size:1.25rem;
    font-weight:900;
    letter-spacing:.02em;
    line-height:1.15;
    color:#ffffff;
    word-break:break-word;
    display:inline-flex;
    align-items:center;
    flex-wrap:wrap;
    gap:6px;
    text-shadow:
        0 0 14px rgba(0,240,255,.45),
        0 0 32px rgba(0,240,255,.22),
        0 2px 6px rgba(0,0,0,.9);
    animation:msnNameGlow 3.2s ease-in-out infinite;
}
.msn-profile-username > span{
    text-shadow:none;
    -webkit-text-fill-color:initial;
}
@keyframes msnNameGlow{
    0%,100%{
        text-shadow:
            0 0 14px rgba(0,240,255,.45),
            0 0 32px rgba(0,240,255,.22),
            0 2px 6px rgba(0,0,0,.9);
    }
    50%{
        text-shadow:
            0 0 20px rgba(0,240,255,.75),
            0 0 46px rgba(0,240,255,.38),
            0 2px 6px rgba(0,0,0,.9);
    }
}

.msn-profile-signature{
    margin:0;
    font-size:.78rem;
    color:#b8c8e0;
    font-style:italic;
    line-height:1.35;
    word-break:break-word;
    min-height:1.1em;
    max-width:100%;
}

/* Meta pill row */
.msn-profile-meta-row{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    align-items:center;
    width:100%;
}
.msn-profile-meta{
    display:inline-flex;
    align-items:center;
    gap:5px;
    padding:4px 10px;
    font-size:.54rem;
    color:#7dd3fc;
    letter-spacing:.14em;
    text-transform:uppercase;
    font-weight:800;
    font-family:var(--font-mono, monospace);
    background:linear-gradient(180deg, rgba(0,240,255,.10) 0%, rgba(0,240,255,.03) 100%);
    border:1px solid rgba(0,240,255,.28);
    border-radius:999px;
    line-height:1;
    text-shadow:0 0 8px rgba(0,240,255,.35);
    width:fit-content;
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,.06),
        0 0 12px rgba(0,240,255,.08);
}
.msn-wallet-pill{
    display:inline-flex;
    align-items:center;
    gap:5px;
    padding:4px 10px;
    font-size:.54rem;
    color:#a7f3d0;
    letter-spacing:.12em;
    font-weight:800;
    font-family:var(--font-mono, monospace);
    background:linear-gradient(180deg, rgba(74,222,128,.10) 0%, rgba(74,222,128,.03) 100%);
    border:1px solid rgba(74,222,128,.28);
    border-radius:999px;
    line-height:1;
    text-shadow:0 0 8px rgba(74,222,128,.3);
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,.06),
        0 0 12px rgba(74,222,128,.08);
    cursor:help;
}

/* ── HUD row 1 — 4 columns ── */
.msn-profile-hud{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:0;
    padding:12px 4px;
    margin-bottom:8px;
    background:rgba(0,240,255,.04);
    border:1px solid rgba(0,240,255,.2);
    border-radius:10px;
}
.msn-profile-hud.msn-hud-3{
    grid-template-columns:repeat(3,1fr);
}
.msn-hud-stat{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:5px;
    padding:0 4px;
    position:relative;
    min-width:0;
}
.msn-hud-stat:not(:last-child)::after{
    content:"";
    position:absolute;
    right:0;
    top:24%; bottom:24%;
    width:1px;
    background:linear-gradient(180deg, transparent, rgba(0,240,255,.4), transparent);
}
.msn-hud-label{
    font-size:.5rem;
    font-weight:800;
    letter-spacing:.14em;
    text-transform:uppercase;
    color:#6a7a96;
    line-height:1;
    font-family:var(--font-mono, monospace);
}
.msn-hud-value{
    font-family:var(--font-mono, monospace);
    font-size:1.05rem;
    font-weight:900;
    color:#00f0ff;
    line-height:1;
    font-variant-numeric:tabular-nums;
    text-shadow:0 0 12px rgba(0,240,255,.7);
}

/* ── XP progress bar ── */
.msn-xp-bar{
    margin:0 0 8px;
    padding:8px 12px 9px;
    background:rgba(0,240,255,.03);
    border:1px solid rgba(0,240,255,.14);
    border-radius:8px;
}
.msn-xp-bar-track{
    position:relative;
    height:6px;
    background:rgba(0,0,0,.55);
    border-radius:999px;
    overflow:hidden;
    box-shadow:inset 0 0 6px rgba(0,0,0,.8);
}
.msn-xp-bar-fill{
    height:100%;
    border-radius:999px;
    background:linear-gradient(90deg, #00f0ff 0%, #67e8f9 50%, #a855f7 100%);
    box-shadow:
        0 0 12px rgba(0,240,255,.7),
        0 0 24px rgba(0,240,255,.35);
    transition:width .8s cubic-bezier(.16,1,.3,1);
    position:relative;
}
.msn-xp-bar-fill::after{
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
    animation:msnXpShine 2.6s linear infinite;
    border-radius:999px;
}
@keyframes msnXpShine{
    0%{transform:translateX(-100%);}
    100%{transform:translateX(200%);}
}
.msn-xp-bar-label{
    display:flex;
    justify-content:space-between;
    margin-top:5px;
    font-family:var(--font-mono, monospace);
    font-size:.5rem;
    font-weight:800;
    letter-spacing:.12em;
    color:#6a7a96;
    text-transform:uppercase;
}

/* ── Last active strip ── */
.msn-profile-strip{
    display:flex;
    align-items:center;
    gap:8px;
    padding:7px 12px;
    margin-bottom:10px;
    background:rgba(74,222,128,.05);
    border:1px solid rgba(74,222,128,.20);
    border-radius:8px;
    font-family:var(--font-mono, monospace);
    font-size:.52rem;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:#4ade80;
}
.msn-strip-dot{
    width:7px;
    height:7px;
    border-radius:50%;
    background:#4ade80;
    box-shadow:0 0 10px #4ade80, 0 0 18px rgba(74,222,128,.6);
    animation:msnStripPulse 1.6s ease-in-out infinite;
    flex-shrink:0;
}
@keyframes msnStripPulse{
    0%,100%{opacity:1;transform:scale(1);}
    50%{opacity:.5;transform:scale(.8);}
}
.msn-strip-label{
    font-weight:800;
    color:#6ee7a7;
    flex-shrink:0;
}
.msn-strip-value{
    margin-left:auto;
    font-weight:900;
    color:#a7f3d0;
    text-shadow:0 0 8px rgba(74,222,128,.4);
}

/* ── Tier badge ── */
.msn-tier-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:1.6em;
    height:1.6em;
    padding:0 .45em;
    border-radius:999px;
    background:rgba(255,255,255,.08);
    border:1.5px solid rgba(255,255,255,.25);
    font-size:.75em;
    line-height:1;
    font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif;
    animation:msnTierPulse 2.5s ease-in-out infinite;
}
.msn-tier-badge.msn-tier-whale{
    background:rgba(0,240,255,.18);
    border-color:#00f0ff;
    box-shadow:0 0 16px rgba(0,240,255,.6);
}
.msn-tier-badge.msn-tier-dolphin{
    background:rgba(168,85,247,.18);
    border-color:#a855f7;
    box-shadow:0 0 16px rgba(168,85,247,.6);
}
.msn-tier-badge.msn-tier-crab{
    background:rgba(255,138,0,.18);
    border-color:#ff8a00;
    box-shadow:0 0 16px rgba(255,138,0,.6);
}
@keyframes msnTierPulse{
    0%,100%{transform:scale(1);}
    50%{transform:scale(1.08);}
}

/* ── X badge ── */
.msn-x-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:1.6em;
    height:1.6em;
    border-radius:50%;
    background:linear-gradient(135deg, #1d9bf0 0%, #0a4a9a 100%);
    color:#fff;
    font-size:.75em;
    font-weight:900;
    line-height:1;
    font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif;
    box-shadow:0 0 14px rgba(29,155,240,.8);
    flex-shrink:0;
}

/* ── Section label ── */
.msn-profile-section-label{
    font-size:.52rem;
    font-weight:800;
    letter-spacing:.2em;
    text-transform:uppercase;
    color:#6a7a96;
    margin:0 0 8px 2px;
    display:flex;
    align-items:center;
    gap:10px;
    font-family:var(--font-mono, monospace);
}
.msn-profile-section-label::before{
    content:"◆";
    color:#00f0ff;
    font-size:.65rem;
}
.msn-profile-section-label::after{
    content:"";
    flex:1;
    height:1px;
    background:linear-gradient(90deg, rgba(0,240,255,.3), transparent);
}

/* ── Achievements — compact row of 6 ── */
.msn-achievements-grid{
    display:grid;
    grid-template-columns:repeat(6,minmax(0,1fr));
    gap:6px;
    margin:0 0 12px;
    width:100%;
    box-sizing:border-box;
}
.msn-ach-slot{
    aspect-ratio:1/1;
    border-radius:7px;
    background:#0a1220;
    border:1px solid rgba(0,240,255,.15);
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:.95rem;
    line-height:1;
    transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;
    min-width:0;
    overflow:hidden;
    opacity:0;
    transform:translateY(6px) scale(.9);
    animation:msnAchIn .45s cubic-bezier(.16,1,.3,1) forwards;
}
.msn-ach-slot:nth-child(1){animation-delay:.20s;}
.msn-ach-slot:nth-child(2){animation-delay:.26s;}
.msn-ach-slot:nth-child(3){animation-delay:.32s;}
.msn-ach-slot:nth-child(4){animation-delay:.38s;}
.msn-ach-slot:nth-child(5){animation-delay:.44s;}
.msn-ach-slot:nth-child(6){animation-delay:.50s;}
@keyframes msnAchIn{
    to{opacity:1;transform:translateY(0) scale(1);}
}
.msn-ach-slot.unlocked{
    border-color:#00f0ff;
    background:rgba(0,240,255,.1);
    box-shadow:0 0 14px rgba(0,240,255,.4);
}
.msn-ach-slot.empty{
    opacity:.3;
    border-style:dashed;
    font-size:.75rem;
    color:#6a7a96;
}
.msn-ach-slot:hover{
    transform:translateY(-3px) scale(1.05);
    border-color:#00f0ff;
    box-shadow:0 0 18px rgba(0,240,255,.5);
}

/* ── Actions ── */
.msn-profile-actions{
    display:flex;
    gap:8px;
}
.msn-action-btn{
    flex:1;
    padding:11px 12px;
    border-radius:9px;
    font-weight:900;
    font-size:.72rem;
    letter-spacing:.08em;
    text-transform:uppercase;
    cursor:pointer;
    border:1.5px solid rgba(0,240,255,.3);
    background:#0a1220;
    color:#fff;
    transition:all .22s ease;
    font-family:var(--font-mono, monospace);
}
.msn-action-btn:hover{
    border-color:#00f0ff;
    color:#00f0ff;
    box-shadow:0 0 18px rgba(0,240,255,.4);
    transform:translateY(-2px);
}
.msn-action-btn:active{transform:translateY(0) scale(.97);}
.msn-action-btn.primary{
    background:linear-gradient(135deg, #00f0ff 0%, #00b8d4 100%);
    color:#001018;
    border-color:#00f0ff;
    box-shadow:0 0 30px rgba(0,240,255,.5);
    text-shadow:0 1px 0 rgba(255,255,255,.4);
}
.msn-action-btn.primary:hover{
    color:#001018;
    filter:brightness(1.1);
    box-shadow:0 0 44px rgba(0,240,255,.8);
}

/* ── Loader ── */
.msn-profile-loader{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:14px;
    padding:50px 10px;
    color:#00f0ff;
    font-family:var(--font-mono, monospace);
    font-size:.68rem;
    letter-spacing:.22em;
    text-transform:uppercase;
    text-shadow:0 0 10px rgba(0,240,255,.6);
}
.msn-profile-loader-dots{
    display:inline-flex;
    gap:8px;
}
.msn-profile-loader-dots span{
    width:9px;
    height:9px;
    border-radius:50%;
    background:#00f0ff;
    animation:msnLoaderPulse 1.3s ease-in-out infinite;
    box-shadow:0 0 10px #00f0ff;
}
.msn-profile-loader-dots span:nth-child(2){animation-delay:.15s;}
.msn-profile-loader-dots span:nth-child(3){animation-delay:.3s;}
@keyframes msnLoaderPulse{
    0%,100%{opacity:.25;transform:translateY(0) scale(.85);}
    50%{opacity:1;transform:translateY(-5px) scale(1.15);}
}

.msn-profile-empty{
    padding:50px 16px;
    text-align:center;
    color:#6a7a96;
    font-family:var(--font-mono, monospace);
    font-size:.68rem;
    letter-spacing:.2em;
    text-transform:uppercase;
}

/* ── Username clickable affordance ── */
.msg-username .msn-username-link{
    cursor:pointer;
    transition:color .2s ease, text-shadow .2s ease;
}
.msg-username:hover .msn-username-link{
    color:#00f0ff;
    text-shadow:0 0 12px rgba(0,240,255,.8);
}
.msg-username .msg-avatar{cursor:pointer;}

/* ── Mobile ── */
@media (max-width:480px){
    .msn-profile-overlay{padding:10px;}
    .msn-profile-card{
        max-width:100%;
        padding:20px 18px 16px;
        border-radius:18px;
    }
    .msn-profile-head{gap:14px;padding-bottom:12px;margin-bottom:10px;}
    .msn-profile-avatar-wrap{width:78px;height:78px;}
    .msn-profile-avatar{font-size:1.75rem;}
    .msn-profile-status-dot{width:16px;height:16px;border-width:3px;}
    .msn-profile-username{font-size:1.1rem;gap:5px;}
    .msn-profile-signature{font-size:.72rem;}
    .msn-profile-meta{font-size:.5rem;padding:3px 8px;}
    .msn-wallet-pill{font-size:.5rem;padding:3px 8px;}
    .msn-profile-hud{padding:10px 3px;margin-bottom:7px;}
    .msn-hud-value{font-size:.95rem;}
    .msn-hud-label{font-size:.46rem;}
    .msn-xp-bar{padding:7px 10px 8px;margin-bottom:7px;}
    .msn-profile-strip{padding:6px 10px;margin-bottom:8px;font-size:.5rem;}
    .msn-tier-badge{min-width:1.5em;height:1.5em;font-size:.72em;}
    .msn-x-badge{width:1.5em;height:1.5em;font-size:.72em;}
    .msn-ach-slot{font-size:.85rem;border-radius:6px;}
    .msn-achievements-grid{gap:5px;margin-bottom:10px;}
    .msn-action-btn{padding:10px 8px;font-size:.66rem;letter-spacing:.05em;}
}

@media (prefers-reduced-motion: reduce){
    .msn-profile-card,
    .msn-profile-card::after,
    .msn-profile-avatar-wrap::before,
    .msn-profile-status-dot.online::before,
    .msn-profile-username,
    .msn-ach-slot,
    .msn-profile-loader-dots span,
    .msn-tier-badge,
    .msn-xp-bar-fill::after,
    .msn-strip-dot{
        animation:none !important;
    }
    .msn-profile-card{transition:none !important;}
    .msn-ach-slot{opacity:1 !important;transform:none !important;}
}
`;
        var tag = document.createElement('style');
        tag.id = 'msn-profile-styles';
        tag.setAttribute('data-version', '9');
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ── Overlay markup ───────────────────────────────────── */
    var overlay, bodyEl;
    function injectOverlay() {
        if (document.getElementById('msnProfileOverlay')) return;
        overlay = document.createElement('div');
        overlay.id = 'msnProfileOverlay';
        overlay.className = 'msn-profile-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = ''
            + '<div class="msn-profile-card" id="msnProfileCard">'
            +   '<button class="msn-profile-close" id="msnProfileClose" aria-label="Close">✕</button>'
            +   '<div id="msnProfileBody"></div>'
            + '</div>';
        document.body.appendChild(overlay);
        bodyEl = document.getElementById('msnProfileBody');

        document.getElementById('msnProfileClose').addEventListener('click', closeProfile);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeProfile();
        });
    }

    function decorateOneUsername(el) {
        if (!el || el.getAttribute('data-msn-pu') === '1') return;
        for (var i = 0; i < el.childNodes.length; i++) {
            var n = el.childNodes[i];
            if (n.nodeType !== 3) continue;
            var raw = String(n.nodeValue || '');
            var trimmed = raw.trim();
            if (!trimmed) continue;
            var leadIdx = raw.indexOf(trimmed);
            var before = raw.slice(0, leadIdx);
            var after  = raw.slice(leadIdx + trimmed.length);
            var frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            var span = document.createElement('span');
            span.className = 'msn-username-link';
            span.textContent = trimmed;
            frag.appendChild(span);
            if (after) frag.appendChild(document.createTextNode(after));
            el.replaceChild(frag, n);
            el.setAttribute('data-msn-pu', '1');
            return;
        }
        el.setAttribute('data-msn-pu', '1');
    }
    function decorateUsernames(root) {
        if (!root) return;
        if (root.nodeType === 1) {
            if (root.matches && root.matches('.msg-username')) decorateOneUsername(root);
            if (root.querySelectorAll) {
                var list = root.querySelectorAll('.msg-username:not([data-msn-pu])');
                for (var i = 0; i < list.length; i++) decorateOneUsername(list[i]);
            }
        }
    }
    function setupUsernameObserver() {
        if (!('MutationObserver' in window)) return;
        var containers = [
            document.getElementById('publicMessagesContainer'),
            document.getElementById('privateMessagesContainer')
        ];
        var mo = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var added = muts[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType === 1) decorateUsernames(node);
                }
            }
        });
        containers.forEach(function (c) { if (c) mo.observe(c, { childList: true, subtree: true }); });
    }

    /* ═══════════════════════════════════════════════════════
       ⚑ FIXED: fetchProfileData
       - REMOVED `created_at` from profiles SELECT (column may
         not exist → broke the entire query → not-found)
       - All optional queries use timeout so nothing stalls
       - `created_at` for the "Joined" pill comes ONLY from
         messages.created_at (which always exists)
       ═══════════════════════════════════════════════════════ */
    var _profileCache = new Map();
    var _PROFILE_CACHE_MS = 30000;

    function _cacheKey(username, wallet) {
        return (wallet ? 'w:' + wallet : 'u:' + (username || '')).toLowerCase();
    }
    function _timeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); })
        ]);
    }

    async function fetchProfileData(username, isSelf, wallet) {
        var sb = getSB();
        if (!sb) return { error: 'no-supabase' };

        var key = _cacheKey(username, wallet);
        var hit = _profileCache.get(key);
        if (hit && (Date.now() - hit.t) < _PROFILE_CACHE_MS) {
            return Object.assign({}, hit.data);
        }

        var out = {
            username: username, display_name: username, avatar_url: null,
            x_verified: false, x_handle: null, signature: '', xp: 0, level: 1,
            xp_in_level: 0, xp_needed: 100,
            messages_count: 0, current_streak: 0, created_at: null,
            last_active_at: null,
            wallet_address: wallet || null, token_balance: null,
            reactions_given: 0, private_chats: 0,
            rank: null, rank_total: null,
            achievements: [], hasProfile: false
        };

        // ⚑ SAFE select — only columns that definitely exist
        var richSel = 'username, display_name, avatar_url, x_handle, x_verified, x_avatar_url, wallet_address, xp, messages_count, token_balance, updated_at';
        var minSel  = 'username, avatar_url, wallet_address, xp, token_balance';

        // ── 1. Profile lookup ──
        var profile = null;
        if (wallet) {
            try {
                var r0 = await sb.from('profiles').select(richSel).eq('wallet_address', wallet).maybeSingle();
                if (!r0.error && r0.data) profile = r0.data;
            } catch (e) {}
        }
        if (!profile) {
            try {
                var r1 = await sb.from('profiles').select(richSel).eq('username', username).maybeSingle();
                if (!r1.error && r1.data) profile = r1.data;
            } catch (e) {}
        }
        if (!profile) {
            try {
                var r2 = await sb.from('profiles').select(minSel).eq('username', username).maybeSingle();
                if (!r2.error && r2.data) profile = r2.data;
            } catch (e) {}
        }

        if (profile) {
            out.hasProfile = true;
            out.avatar_url = profile.avatar_url || null;
            out.wallet_address = profile.wallet_address || out.wallet_address;
            out.x_handle = profile.x_handle || null;
            out.xp = Number(profile.xp || 0);
            out.level = levelFromXp(out.xp);
            out.messages_count = Number(profile.messages_count || 0);
            out.token_balance = profile.token_balance ?? null;
            rememberIdentity(profile);
        }

        // ── 2. Balance cache ──
        if (out.token_balance == null && username) {
            try {
                var cached = window.userBalances && window.userBalances[username];
                if (cached != null) out.token_balance = cached;
            } catch (e) {}
        }

        // ── 3. Identity resolve ──
        var resolved = resolveIdentity(out.wallet_address || username);
        if (resolved) {
            if (resolved.displayName) out.display_name = resolved.displayName;
            if (resolved.avatar)      out.avatar_url    = resolved.avatar;
            out.x_verified = !!resolved.x_verified;
            if (resolved.x_handle)    out.x_handle      = resolved.x_handle;
        } else if (profile) {
            out.display_name = profile.display_name
                || (profile.x_verified && profile.x_handle ? '@' + profile.x_handle : null)
                || profile.username || username;
            if (profile.x_verified && profile.x_avatar_url) out.avatar_url = profile.x_avatar_url;
            else if (!out.avatar_url && profile.x_avatar_url) out.avatar_url = profile.x_avatar_url;
            out.x_verified = !!profile.x_verified;
        }

        // ── 4. XP progress ──
        var a = xpForLevel(out.level), b = xpForLevel(out.level + 1);
        out.xp_in_level = out.xp - a;
        out.xp_needed   = b - a;

        // ── 5. Parallel queries — ALL with timeouts so nothing blocks ──
        var tasks = [];

        tasks.push(_timeout(
            sb.from('user_achievements')
                .select('achievement_code, unlocked_at')
                .eq('username', username)
                .order('unlocked_at', { ascending: false })
                .limit(6)
                .then(function (res) {
                    if (!res.error && Array.isArray(res.data)) out.achievements = res.data;
                }).catch(function () {}),
            3500
        ));

        // First message date — source of "Joined" pill
        tasks.push(_timeout(
            sb.from('messages')
                .select('created_at')
                .eq('username', username)
                .order('created_at', { ascending: true })
                .limit(1)
                .then(function (res) {
                    if (res && res.data && res.data[0] && res.data[0].created_at) {
                        out.created_at = res.data[0].created_at;
                    }
                }).catch(function () {}),
            3500
        ));

        // Last active
        tasks.push(_timeout(
            sb.from('messages')
                .select('created_at')
                .eq('username', username)
                .order('created_at', { ascending: false })
                .limit(1)
                .then(function (res) {
                    if (res && res.data && res.data[0] && res.data[0].created_at) {
                        out.last_active_at = res.data[0].created_at;
                    }
                }).catch(function () {}),
            3500
        ));

        // Message count (only if we don't already have it)
        if (!out.messages_count) {
            tasks.push(_timeout(
                sb.from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('username', username)
                    .then(function (res) {
                        if (res && typeof res.count === 'number') out.messages_count = res.count;
                    }).catch(function () {}),
                3500
            ));
        }

        // Streak
        if (out.wallet_address && !isSelf) {
            tasks.push(_timeout(
                sb.rpc('get_streak_by_wallet', { p_wallet: out.wallet_address })
                    .then(function (res) {
                        if (res && !res.error && typeof res.data === 'number') out.current_streak = res.data;
                    }).catch(function () {}),
                3500
            ));
        }

        // Reactions given
        tasks.push(_timeout(
            sb.from('message_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('username', username)
                .then(function (res) {
                    if (res && typeof res.count === 'number') out.reactions_given = res.count;
                }).catch(function () {}),
            3500
        ));

        // Private messages
        tasks.push(_timeout(
            sb.from('private_messages')
                .select('*', { count: 'exact', head: true })
                .or('from_user.eq.' + username + ',to_user.eq.' + username)
                .then(function (res) {
                    if (res && typeof res.count === 'number') out.private_chats = res.count;
                }).catch(function () {}),
            3500
        ));

        // Rank
        tasks.push(_timeout(
            sb.rpc('get_activity_leaderboard', { p_limit: 100 })
                .then(function (res) {
                    if (res && !res.error && Array.isArray(res.data)) {
                        out.rank_total = res.data.length;
                        for (var i = 0; i < res.data.length; i++) {
                            var row = res.data[i];
                            if (!row) continue;
                            if ((row.username && row.username === username) ||
                                (row.wallet_address && out.wallet_address && row.wallet_address === out.wallet_address)) {
                                out.rank = i + 1;
                                break;
                            }
                        }
                    }
                }).catch(function () {}),
            3500
        ));

        await Promise.all(tasks);

        if (isSelf) out.current_streak = readSelfStreakFromDOM();

        // Fallback for "joined" pill
        if (!out.created_at && out.last_active_at) out.created_at = out.last_active_at;
        if (!out.created_at && profile && profile.updated_at) out.created_at = profile.updated_at;

        // Only "not-found" if we have NOTHING at all
        if (!out.hasProfile && !out.created_at && !out.messages_count) {
            return { error: 'not-found' };
        }

        _profileCache.set(key, { t: Date.now(), data: out });
        return out;
    }

    function avatarHTML(data) {
        var url  = data.avatar_url;
        var name = data.display_name || data.username || '?';
        var r = resolveIdentity(data.wallet_address || data.username);
        if (r) {
            if (r.avatar)      url  = r.avatar;
            if (r.displayName) name = r.displayName;
        }
        if (url) return '<img src="' + esc(url) + '" alt="">';
        return esc((name.charAt(0) || '?').toUpperCase());
    }

    function renderLoading() {
        bodyEl.innerHTML = ''
            + '<div class="msn-profile-loader">'
            +   '<span class="msn-profile-loader-dots"><span></span><span></span><span></span></span>'
            +   '<span>Loading…</span>'
            + '</div>';
    }
    function renderError(msg) {
        bodyEl.innerHTML = '<div class="msn-profile-empty">⚠ ' + esc(msg || 'Profile unavailable') + '</div>';
    }

    function renderXpBar(data) {
        var inLv = Number(data.xp_in_level || 0);
        var need = Number(data.xp_needed || 100) || 100;
        var pct  = Math.min(100, Math.max(0, (inLv / need) * 100));
        return ''
            + '<div class="msn-xp-bar" title="' + inLv + ' / ' + need + ' XP to next level">'
            +   '<div class="msn-xp-bar-track">'
            +     '<div class="msn-xp-bar-fill" style="width:' + pct.toFixed(1) + '%"></div>'
            +   '</div>'
            +   '<div class="msn-xp-bar-label">'
            +     '<span>LV ' + (data.level || 1) + '</span>'
            +     '<span>' + inLv + ' / ' + need + ' XP</span>'
            +   '</div>'
            + '</div>';
    }

    function renderCard(data, isSelf) {
        var xp        = Number(data.xp || 0);
        var level     = Number(data.level || levelFromXp(xp));
        var streak    = Number(data.current_streak || 0);
        var msgs      = Number(data.messages_count || 0);
        var reactions = Number(data.reactions_given || 0);
        var privMsgs  = Number(data.private_chats || 0);
        var rank      = data.rank;
        var rankTotal = data.rank_total;
        var online    = isSelf ? true : isUserOnline(data.username);
        var shownName = data.display_name || data.username || 'anon';

        var xBadge = data.x_verified
            ? '<span class="msn-x-badge" title="Verified on X" aria-label="Verified on X">𝕏</span>'
            : '';

        var tierBadge = '';
        var tier = tierFor(resolveBalance(data));
        if (tier) {
            tierBadge = '<span class="msn-tier-badge msn-tier-' + tier.name.toLowerCase() + '"'
                + ' title="' + tier.name + '" aria-label="' + tier.name + '">'
                + tier.emoji + '</span>';
        }

        var rankText;
        if (rank != null) {
            rankText = '#' + rank;
            if (rankTotal) rankText += '/' + rankTotal;
        } else if (data.wallet_address) {
            rankText = '—';
        } else {
            rankText = 'N/A';
        }

        var metaPills = '<div class="msn-profile-meta">◉ Joined ' + esc(fmtDate(data.created_at)) + '</div>';
        var walletPill = '';
        if (data.wallet_address) {
            walletPill = '<span class="msn-wallet-pill" title="' + esc(data.wallet_address) + '">'
                + '👛 ' + esc(shortWallet(data.wallet_address)) + '</span>';
        } else if (data.x_handle) {
            walletPill = '<span class="msn-wallet-pill">@' + esc(data.x_handle) + '</span>';
        }
        if (walletPill) metaPills += walletPill;

        var achHTML = '';
        if (data.achievements && data.achievements.length) {
            achHTML = data.achievements.map(function (a) {
                return '<div class="msn-ach-slot unlocked" title="' + esc(a.achievement_code) + '">🏆</div>';
            }).join('');
            for (var i = data.achievements.length; i < 6; i++) {
                achHTML += '<div class="msn-ach-slot empty" title="Locked">·</div>';
            }
        } else {
            for (var j = 0; j < 6; j++) {
                achHTML += '<div class="msn-ach-slot empty" title="Coming soon">·</div>';
            }
        }

        var actionsHTML = '';
        if (isSelf) {
            actionsHTML = '<button class="msn-action-btn" data-msn-profile-action="edit">⚙ Edit Profile</button>';
        } else {
            actionsHTML = ''
                + '<button class="msn-action-btn" data-msn-profile-action="friend">+ Friend</button>'
                + '<button class="msn-action-btn primary" data-msn-profile-action="message">▶ Message</button>';
        }

        // ⚑ Streak only shows if there IS a streak
        var showStreakRow = streak > 0;

        bodyEl.innerHTML = ''
            + '<div class="msn-profile-head">'
            +   '<div class="msn-profile-avatar-wrap">'
            +     '<div class="msn-profile-avatar">' + avatarHTML(data) + '</div>'
            +     '<span class="msn-profile-status-dot' + (online ? ' online' : '') + '" '
            +         'title="' + (online ? 'Online' : 'Offline') + '"></span>'
            +   '</div>'
            +   '<div class="msn-profile-identity">'
            +     '<h2 class="msn-profile-username">' + esc(shownName) + tierBadge + xBadge + '</h2>'
            +     '<p class="msn-profile-signature">' + (data.signature ? esc(data.signature) : '') + '</p>'
            +     '<div class="msn-profile-meta-row">' + metaPills + '</div>'
            +   '</div>'
            + '</div>'

            /* HUD row 1: Level / XP / Messages / Rank */
            + '<div class="msn-profile-hud">'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Level</span><span class="msn-hud-value">' + level + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">XP</span><span class="msn-hud-value">' + esc(fmtNum(xp)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Msgs</span><span class="msn-hud-value">' + esc(fmtNum(msgs)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Rank</span><span class="msn-hud-value">' + esc(rankText) + '</span></div>'
            + '</div>'

            /* XP progress bar */
            + renderXpBar(data)

            /* HUD row 2: Reactions / Private / Streak */
            + '<div class="msn-profile-hud msn-hud-3">'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Reactions</span><span class="msn-hud-value">' + esc(fmtNum(reactions)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Private</span><span class="msn-hud-value">' + esc(fmtNum(privMsgs)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Streak</span><span class="msn-hud-value">' + (showStreakRow ? '🔥 ' + streak : '—') + '</span></div>'
            + '</div>'

            /* Last active */
            + '<div class="msn-profile-strip">'
            +   '<span class="msn-strip-dot"></span>'
            +   '<span class="msn-strip-label">LAST ACTIVE</span>'
            +   '<span class="msn-strip-value">' + esc(timeAgo(data.last_active_at || data.created_at)) + '</span>'
            + '</div>'

            + '<div class="msn-profile-section-label">Achievements</div>'
            + '<div class="msn-achievements-grid">' + achHTML + '</div>'
            + '<div class="msn-profile-actions">' + actionsHTML + '</div>';

        var actions = bodyEl.querySelector('.msn-profile-actions');
        if (actions) {
            actions.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-msn-profile-action]');
                if (!btn) return;
                e.preventDefault(); e.stopPropagation();
                var act = btn.getAttribute('data-msn-profile-action');
                if (act === 'message')   triggerPrivateChat(data.username);
                else if (act === 'friend') addFriend(data.username);
                else if (act === 'edit')   editProfile();
            });
        }
    }

    function editProfile() {
        closeProfile();
        var btn = document.getElementById('sidebarChangeNameBtn');
        if (btn) btn.click();
    }
    function triggerPrivateChat(targetUser) {
        if (!targetUser) return;
        var item = document.querySelector('.sidebar-user-item[data-username="' + cssEscape(targetUser) + '"]');
        if (item) { closeProfile(); item.click(); return; }
        directPrivateRequest(targetUser);
    }
    async function directPrivateRequest(targetUser) {
        var sb = getSB();
        var me = getSelfUsername();
        if (!sb || !me) { toast('Set your username first'); return; }
        if (me === targetUser) { toast("That's you"); return; }
        try {
            var ex = await sb.from('private_chat_requests').select('id').eq('from_user', me).eq('to_user', targetUser).eq('status', 'pending').maybeSingle();
            if (ex && ex.data) { toast('📩 Request already sent'); return; }
            var ins = await sb.from('private_chat_requests').insert({ from_user: me, to_user: targetUser, status: 'pending' });
            if (ins.error) { toast('Request failed'); return; }
            toast('📩 Request sent to ' + targetUser);
            closeProfile();
        } catch (e) { toast('Could not send request'); }
    }
    async function addFriend(targetUser) {
        var sb = getSB();
        var me = getSelfUsername();
        if (!sb || !me) { toast('Set your username first'); return; }
        if (me === targetUser) { toast("That's you"); return; }
        try {
            var ins = await sb.from('friends').insert({ user_a: me, user_b: targetUser, status: 'pending' });
            if (ins.error) throw ins.error;
            toast('Friend request sent to ' + targetUser);
        } catch (e) {
            console.warn('[profile] addFriend failed:', e);
            toast('Friend requests coming soon');
        }
    }

    var currentToken = 0;
    var currentUsernameOpen = null;

    async function openProfile(usernameOrWallet) {
        if (!usernameOrWallet) return;
        injectOverlay();
        var token = ++currentToken;
        currentUsernameOpen = usernameOrWallet;
        overlay.classList.add('open');
        renderLoading();
        var me = getSelfUsername();
        var isWallet = isWalletLike(usernameOrWallet);
        var isSelf = !isWallet && (usernameOrWallet === me);
        var wallet = isWallet ? usernameOrWallet : null;
        if (!wallet) {
            var r = resolveIdentity(usernameOrWallet);
            if (r && r.wallet) wallet = r.wallet;
        }
        var data = await fetchProfileData(usernameOrWallet, isSelf, wallet);
        if (token !== currentToken) return;
        if (data.error === 'no-supabase')      { renderError('Connection unavailable'); return; }
        if (data.error === 'not-found')        { renderError('Profile not found'); return; }
        renderCard(data, isSelf);
    }
    function closeProfile() {
        if (overlay) overlay.classList.remove('open');
        currentToken++;
        currentUsernameOpen = null;
        _profileCache.clear();
    }

    document.addEventListener('msn:identity-changed', function (e) {
        if (!overlay || !overlay.classList.contains('open')) return;
        if (!currentUsernameOpen) return;
        var changedWallet = e.detail && e.detail.wallet;
        if (!changedWallet) return;
        var openWallet = isWalletLike(currentUsernameOpen)
            ? currentUsernameOpen
            : (resolveIdentity(currentUsernameOpen) || {}).wallet;
        if (openWallet && openWallet === changedWallet) openProfile(currentUsernameOpen);
    });

    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var unameEl = t.closest('.msg-username');
        if (unameEl) {
            if (t.closest('.msg-actions-container, .msg-time, .user-badge, .msg-edited, .reply-ref-block')) return;
            var wrap = unameEl.closest('.msg-wrapper');
            var wallet = wrap && wrap.getAttribute('data-wallet');
            var uname = extractUsernameFromMsgUsername(unameEl);
            var target = wallet || uname;
            if (target) { e.preventDefault(); e.stopPropagation(); openProfile(target); return; }
        }
        var sideAvatar = t.closest('.sidebar-user-item .user-avatar');
        if (sideAvatar) {
            var sideItem = sideAvatar.closest('.sidebar-user-item');
            var sideWallet = sideItem && sideItem.getAttribute('data-wallet');
            var sideName = sideItem && sideItem.getAttribute('data-username');
            var sideTarget = sideWallet || sideName;
            if (sideTarget) { e.preventDefault(); e.stopPropagation(); openProfile(sideTarget); return; }
        }
        var bigAvatar = t.closest('.sidebar-user-profile-big .big-avatar');
        if (bigAvatar && !t.closest('button, .edit-profile-btn, #sidebarChangeNameBtn')) {
            var isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (!isMobile) {
                var me = getSelfUsername();
                if (me) { e.preventDefault(); e.stopPropagation(); openProfile(me); return; }
            }
        }
        var rankRow = t.closest('#rankingsOverlay .rank-row');
        if (rankRow && t.closest('.rank-avatar, .rank-name, .rank-avatar-fallback')) {
            var rankWallet = rankRow.getAttribute('data-wallet');
            var nameEl = rankRow.querySelector('.rank-name');
            var rankName = nameEl && nameEl.textContent.trim();
            var rankTarget = rankWallet || rankName;
            if (rankTarget) { e.preventDefault(); e.stopPropagation(); openProfile(rankTarget); return; }
        }
    }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
            e.preventDefault();
            closeProfile();
        }
    });

    window.MSN = window.MSN || {};
    window.MSN.profile = {
        open: openProfile,
        close: closeProfile,
        refresh: function () {
            var me = getSelfUsername();
            if (me) openProfile(me);
        }
    };

    function boot() {
        injectStyles();
        injectOverlay();
        decorateUsernames(document.getElementById('publicMessagesContainer'));
        decorateUsernames(document.getElementById('privateMessagesContainer'));
        setupUsernameObserver();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    console.log('[profile-system] loaded v9 — compact + fixed SELECT + timeout guards');
})();
