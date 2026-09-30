/* ============================================================
   profile-system.js — MSN Profile / User Identity HUD
   ────────────────────────────────────────────────────────────
   Drop-in. Load AFTER script.js + wallet-identity.js.

     <script src="profile-system.js?v=10"></script>

   v6: simplified + still animated. Cleaner HUD, smoother vibes.
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
    function levelFromXp(xp) {
        if (!xp || xp < 50) return 1;
        return Math.max(1, Math.floor((1 + Math.sqrt(1 + (xp * 4 / 25))) / 2));
    }
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
       CSS — SIMPLIFIED ANIMATED HUD v6
       ═══════════════════════════════════════════════════════ */
    function injectStyles() {
        if (document.getElementById('msn-profile-styles')) return;
        var css = `
/* ═══════════════════════════════════════════════════════
   MSN PROFILE CARD — clean HUD
   ═══════════════════════════════════════════════════════ */

.msn-profile-overlay{
    position:fixed;
    inset:0;
    z-index:500;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:radial-gradient(ellipse at center, rgba(8,14,26,.92) 0%, rgba(2,4,10,.98) 100%);
    backdrop-filter:blur(14px);
    -webkit-backdrop-filter:blur(14px);
    opacity:0;
    pointer-events:none;
    transition:opacity .3s ease;
}
.msn-profile-overlay.open{opacity:1;pointer-events:auto;}

/* ── Card ── */
.msn-profile-card{
    position:relative;
    width:100%;
    max-width:500px;
    max-height:92vh;
    overflow-y:auto;
    overflow-x:hidden;
    padding:36px 28px 24px;
    background:linear-gradient(180deg, #0d1528 0%, #050810 100%);
    border-radius:22px;
    box-shadow:
        0 0 0 1px rgba(0,240,255,.25),
        0 0 60px rgba(0,240,255,.18),
        0 30px 90px rgba(0,0,0,.9);
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
.msn-profile-card::-webkit-scrollbar{width:6px;}
.msn-profile-card::-webkit-scrollbar-thumb{
    background:rgba(0,240,255,.4);
    border-radius:3px;
}

/* Animated gradient border */
.msn-profile-card::after{
    content:"";
    position:absolute;
    inset:-1px;
    border-radius:23px;
    padding:1.5px;
    background:conic-gradient(from 0deg, #00f0ff, #a855f7, #ec4899, #00f0ff);
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;
            mask-composite:exclude;
    pointer-events:none;
    animation:msnBorderSpin 6s linear infinite;
    opacity:.9;
}
@keyframes msnBorderSpin{to{transform:rotate(360deg);}}

/* ── Close button ── */
.msn-profile-close{
    position:absolute;
    top:14px;
    right:14px;
    width:34px;
    height:34px;
    border-radius:50%;
    border:1.5px solid rgba(0,240,255,.35);
    background:rgba(10,16,30,.9);
    color:#00f0ff;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:.9rem;
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
    gap:22px;
    padding-bottom:22px;
    margin-bottom:20px;
    border-bottom:1px solid rgba(0,240,255,.15);
}

/* ── Avatar ── */
.msn-profile-avatar-wrap{
    position:relative;
    width:132px;
    height:132px;
    flex:0 0 auto;
}
.msn-profile-avatar-wrap::before{
    content:"";
    position:absolute;
    inset:-6px;
    border-radius:50%;
    background:conic-gradient(from 0deg, transparent 0deg, #00f0ff 60deg, transparent 140deg, transparent 220deg, #a855f7 280deg, transparent 360deg);
    animation:msnBorderSpin 3.5s linear infinite;
    opacity:.8;
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
    font-size:2.8rem;
    font-weight:900;
    color:#fff;
    z-index:1;
    box-shadow:
        inset 0 0 30px rgba(0,0,0,.8),
        0 0 30px rgba(0,240,255,.4);
    text-shadow:0 0 16px rgba(0,240,255,.8);
}
.msn-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block;}

/* Online dot */
.msn-profile-status-dot{
    position:absolute;
    bottom:4px;
    right:4px;
    width:22px;
    height:22px;
    border-radius:50%;
    background:#5a6b88;
    border:3px solid #050810;
    z-index:3;
    transition:background .25s, box-shadow .25s;
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
    gap:8px;
}
.msn-profile-username{
    margin:0;
    font-size:1.6rem;
    font-weight:900;
    letter-spacing:.02em;
    line-height:1.15;
    color:#fff;
    word-break:break-word;
    text-shadow:0 0 20px rgba(0,240,255,.4), 0 2px 6px rgba(0,0,0,.9);
    background:linear-gradient(90deg, #fff 0%, #fff 45%, #00f0ff 50%, #fff 55%, #fff 100%);
    background-size:200% 100%;
    -webkit-background-clip:text;
            background-clip:text;
    -webkit-text-fill-color:transparent;
    animation:msnNameShine 3.5s linear infinite;
}
@keyframes msnNameShine{
    0%{background-position:200% 0;}
    100%{background-position:-200% 0;}
}
.msn-profile-signature{
    margin:0;
    font-size:.88rem;
    color:#b8c8e0;
    font-style:italic;
    line-height:1.5;
    word-break:break-word;
    min-height:1.2em;
    max-width:100%;
}
.msn-profile-meta{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:5px 11px;
    font-size:.6rem;
    color:#00f0ff;
    letter-spacing:.16em;
    text-transform:uppercase;
    font-weight:800;
    font-family:var(--font-mono, monospace);
    background:rgba(0,240,255,.06);
    border:1px solid rgba(0,240,255,.3);
    border-radius:6px;
    line-height:1;
    text-shadow:0 0 6px rgba(0,240,255,.5);
}

/* ── X badge ── */
.msn-x-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:1.15em;
    height:1.15em;
    margin-left:.4em;
    border-radius:50%;
    background:linear-gradient(135deg, #1d9bf0 0%, #0a4a9a 100%);
    color:#fff;
    font-size:.6em;
    font-weight:900;
    line-height:1;
    box-shadow:0 0 14px rgba(29,155,240,.8);
    vertical-align:middle;
    transform:translateY(-3px);
}

/* ── Tier badge ── */
.msn-tier-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:1.4em;
    height:1.4em;
    padding:0 .5em;
    margin-left:.4em;
    border-radius:999px;
    background:rgba(255,255,255,.08);
    border:1.5px solid rgba(255,255,255,.25);
    font-size:.7em;
    line-height:1;
    vertical-align:middle;
    transform:translateY(-3px);
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
    0%,100%{transform:translateY(-3px) scale(1);}
    50%{transform:translateY(-3px) scale(1.08);}
}

/* ── HUD ── */
.msn-profile-hud{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:10px;
    padding:16px 8px;
    margin-bottom:18px;
    background:rgba(0,240,255,.04);
    border:1px solid rgba(0,240,255,.2);
    border-radius:12px;
}
.msn-hud-stat{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:6px;
    padding:4px 2px;
    position:relative;
}
.msn-hud-stat:not(:last-child)::after{
    content:"";
    position:absolute;
    right:-5px;
    top:25%; bottom:25%;
    width:1px;
    background:linear-gradient(180deg, transparent, rgba(0,240,255,.4), transparent);
}
.msn-hud-label{
    font-size:.58rem;
    font-weight:800;
    letter-spacing:.18em;
    text-transform:uppercase;
    color:#6a7a96;
    line-height:1;
    font-family:var(--font-mono, monospace);
}
.msn-hud-value{
    font-family:var(--font-mono, monospace);
    font-size:1.35rem;
    font-weight:900;
    color:#00f0ff;
    line-height:1;
    font-variant-numeric:tabular-nums;
    text-shadow:0 0 12px rgba(0,240,255,.7);
}

/* ── Streak row ── */
.msn-streak-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    padding:14px 16px;
    margin-bottom:20px;
    background:rgba(255,106,0,.08);
    border:1px solid rgba(255,106,0,.35);
    border-radius:12px;
}
.msn-streak-label{
    font-size:.6rem;
    font-weight:800;
    letter-spacing:.2em;
    text-transform:uppercase;
    color:#ffb066;
    flex-shrink:0;
    font-family:var(--font-mono, monospace);
}
.msn-streak-fires{
    display:flex;
    align-items:center;
    gap:5px;
    flex:1;
    justify-content:center;
}
.msn-fire{
    font-size:1.2rem;
    line-height:1;
    display:inline-block;
}
.msn-fire.filled{
    filter:drop-shadow(0 0 6px rgba(255,140,0,.9));
    animation:msnFireBounce 1.6s ease-in-out infinite;
}
.msn-fire.empty{
    filter:grayscale(100%) brightness(.4);
    opacity:.25;
}
.msn-fire:nth-child(1).filled{animation-delay:0s;}
.msn-fire:nth-child(2).filled{animation-delay:.1s;}
.msn-fire:nth-child(3).filled{animation-delay:.2s;}
.msn-fire:nth-child(4).filled{animation-delay:.3s;}
.msn-fire:nth-child(5).filled{animation-delay:.4s;}
.msn-fire:nth-child(6).filled{animation-delay:.5s;}
.msn-fire:nth-child(7).filled{animation-delay:.6s;}
@keyframes msnFireBounce{
    0%,100%{transform:scale(1) translateY(0);}
    50%{transform:scale(1.15) translateY(-2px);}
}
.msn-streak-count{
    font-family:var(--font-mono, monospace);
    font-size:1.1rem;
    font-weight:900;
    color:#ffb066;
    min-width:2.6em;
    text-align:right;
    text-shadow:0 0 12px rgba(255,140,0,.8);
    font-variant-numeric:tabular-nums;
    flex-shrink:0;
}

/* ── Section label ── */
.msn-profile-section-label{
    font-size:.6rem;
    font-weight:800;
    letter-spacing:.22em;
    text-transform:uppercase;
    color:#6a7a96;
    margin:0 0 10px 2px;
    display:flex;
    align-items:center;
    gap:10px;
    font-family:var(--font-mono, monospace);
}
.msn-profile-section-label::before{
    content:"◆";
    color:#00f0ff;
    font-size:.7rem;
}
.msn-profile-section-label::after{
    content:"";
    flex:1;
    height:1px;
    background:linear-gradient(90deg, rgba(0,240,255,.3), transparent);
}

/* ── Achievements ── */
.msn-achievements-grid{
    display:grid;
    grid-template-columns:repeat(6,1fr);
    gap:8px;
    margin:0 0 22px;
    width:100%;
    box-sizing:border-box;
}
.msn-ach-slot{
    aspect-ratio:1/1;
    border-radius:9px;
    background:#0a1220;
    border:1px solid rgba(0,240,255,.15);
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:1.1rem;
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
    font-size:.85rem;
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
    gap:10px;
    margin-top:4px;
}
.msn-action-btn{
    flex:1;
    padding:14px 16px;
    border-radius:10px;
    font-weight:900;
    font-size:.78rem;
    letter-spacing:.1em;
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
    gap:18px;
    padding:70px 10px;
    color:#00f0ff;
    font-family:var(--font-mono, monospace);
    font-size:.72rem;
    letter-spacing:.24em;
    text-transform:uppercase;
    text-shadow:0 0 10px rgba(0,240,255,.6);
}
.msn-profile-loader-dots{
    display:inline-flex;
    gap:8px;
}
.msn-profile-loader-dots span{
    width:10px;
    height:10px;
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
    padding:70px 16px;
    text-align:center;
    color:#6a7a96;
    font-family:var(--font-mono, monospace);
    font-size:.72rem;
    letter-spacing:.22em;
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
    .msn-profile-overlay{padding:12px;}
    .msn-profile-card{
        max-width:100%;
        padding:26px 18px 18px;
        border-radius:20px;
        max-height:94vh;
    }
    .msn-profile-head{
        gap:16px;
        padding-bottom:16px;
        margin-bottom:14px;
    }
    .msn-profile-avatar-wrap{width:96px;height:96px;}
    .msn-profile-avatar{font-size:2.1rem;}
    .msn-profile-status-dot{width:18px;height:18px;border-width:3px;}
    .msn-profile-username{font-size:1.25rem;}
    .msn-profile-signature{font-size:.78rem;}
    .msn-profile-meta{font-size:.54rem;letter-spacing:.12em;padding:4px 9px;}
    .msn-profile-hud{gap:8px;padding:12px 4px;margin-bottom:14px;}
    .msn-hud-value{font-size:1.05rem;}
    .msn-hud-label{font-size:.5rem;letter-spacing:.12em;}
    .msn-streak-row{padding:11px 12px;margin-bottom:16px;gap:8px;}
    .msn-fire{font-size:1rem;}
    .msn-streak-count{font-size:.95rem;}
    .msn-achievements-grid{gap:6px;}
    .msn-ach-slot{font-size:.95rem;border-radius:7px;}
    .msn-action-btn{padding:12px 10px;font-size:.7rem;letter-spacing:.06em;}
    .msn-x-badge{width:1.05em;height:1.05em;font-size:.58em;}
}

@media (prefers-reduced-motion: reduce){
    .msn-profile-card,
    .msn-profile-card::after,
    .msn-profile-avatar-wrap::before,
    .msn-profile-status-dot.online::before,
    .msn-profile-username,
    .msn-fire.filled,
    .msn-ach-slot,
    .msn-profile-loader-dots span,
    .msn-tier-badge{
        animation:none !important;
    }
    .msn-profile-card{transition:none !important;}
    .msn-ach-slot{opacity:1 !important;transform:none !important;}
}
`;
        var tag = document.createElement('style');
        tag.id = 'msn-profile-styles';
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

    async function fetchProfileData(username, isSelf, wallet) {
        var sb = getSB();
        if (!sb) return { error: 'no-supabase' };
        var out = {
            username: username, display_name: username, avatar_url: null,
            x_verified: false, signature: '', xp: 0, level: 1,
            messages_count: 0, current_streak: 0, created_at: null,
            wallet_address: wallet || null, token_balance: null,
            achievements: [], hasProfile: false
        };
        var richSel = 'username, display_name, avatar_url, x_handle, x_verified, x_avatar_url, wallet_address, xp, messages_count, token_balance, updated_at';
        var minSel  = 'username, avatar_url, wallet_address, xp, token_balance';
        var profile = null;
        if (wallet) {
            try { var r0 = await sb.from('profiles').select(richSel).eq('wallet_address', wallet).maybeSingle();
                if (!r0.error && r0.data) profile = r0.data; } catch (e) {}
        }
        if (!profile) {
            try { var r1 = await sb.from('profiles').select(richSel).eq('username', username).maybeSingle();
                if (!r1.error && r1.data) profile = r1.data; } catch (e) {}
        }
        if (!profile) {
            try { var r2 = await sb.from('profiles').select(minSel).eq('username', username).maybeSingle();
                if (!r2.error && r2.data) profile = r2.data; } catch (e) {}
        }
        if (profile) {
            out.hasProfile = true;
            out.avatar_url = profile.avatar_url || null;
            out.wallet_address = profile.wallet_address || out.wallet_address;
            out.xp = Number(profile.xp || 0);
            out.level = levelFromXp(out.xp);
            out.messages_count = Number(profile.messages_count || 0);
            out.token_balance = profile.token_balance ?? null;
            rememberIdentity(profile);
        }
        if (out.token_balance == null && username) {
            try {
                var cached = window.userBalances && window.userBalances[username];
                if (cached != null) out.token_balance = cached;
            } catch (e) {}
        }
        var resolved = resolveIdentity(out.wallet_address || username);
        if (resolved) {
            if (resolved.displayName) out.display_name = resolved.displayName;
            if (resolved.avatar)      out.avatar_url   = resolved.avatar;
            out.x_verified = !!resolved.x_verified;
        } else if (profile) {
            out.display_name = profile.display_name
                || (profile.x_verified && profile.x_handle ? '@' + profile.x_handle : null)
                || profile.username || username;
            if (profile.x_verified && profile.x_avatar_url) out.avatar_url = profile.x_avatar_url;
            else if (!out.avatar_url && profile.x_avatar_url) out.avatar_url = profile.x_avatar_url;
            out.x_verified = !!profile.x_verified;
        }
        if (!isSelf && !out.messages_count) {
            try {
                var mc = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('username', username);
                if (typeof mc.count === 'number') out.messages_count = mc.count;
            } catch (e) {}
        }
        try {
            var fm = await sb.from('messages').select('created_at').eq('username', username).order('created_at', { ascending: true }).limit(1);
            if (fm.data && fm.data[0] && fm.data[0].created_at) out.created_at = fm.data[0].created_at;
        } catch (e) {}
        if (!out.created_at && profile && profile.updated_at) out.created_at = profile.updated_at;
        if (!out.hasProfile && !out.created_at) return { error: 'not-found' };
        if (isSelf) {
            out.current_streak = readSelfStreakFromDOM();
        } else if (out.wallet_address) {
            try {
                var sr = await sb.rpc('get_streak_by_wallet', { p_wallet: out.wallet_address });
                if (!sr.error && typeof sr.data === 'number') out.current_streak = sr.data;
            } catch (e) {}
        }
        try {
            var ac = await sb.from('user_achievements').select('achievement_code, unlocked_at')
                .eq('username', username).order('unlocked_at', { ascending: false }).limit(6);
            if (!ac.error && Array.isArray(ac.data)) out.achievements = ac.data;
        } catch (e) {}
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
    function renderFireRow(streak) {
        var MAX = 7;
        var filled = Math.min(streak, MAX);
        var fires = '';
        for (var i = 0; i < MAX; i++) {
            fires += '<span class="msn-fire ' + (i < filled ? 'filled' : 'empty') + '">🔥</span>';
        }
        return ''
            + '<div class="msn-streak-row">'
            +   '<span class="msn-streak-label">🔥 Streak</span>'
            +   '<span class="msn-streak-fires">' + fires + '</span>'
            +   '<span class="msn-streak-count">X' + streak + '</span>'
            + '</div>';
    }
    function renderCard(data, isSelf) {
        var xp = Number(data.xp || 0);
        var level = Number(data.level || levelFromXp(xp));
        var streak = Number(data.current_streak || 0);
        var msgs = Number(data.messages_count || 0);
        var online = isSelf ? true : isUserOnline(data.username);
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
                + '<button class="msn-action-btn" data-msn-profile-action="friend">+ Add Friend</button>'
                + '<button class="msn-action-btn primary" data-msn-profile-action="message">▶ Message</button>';
        }
        var showStreakRow = isSelf || streak > 0;
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
            +     '<div class="msn-profile-meta">◉ Joined ' + esc(fmtDate(data.created_at)) + '</div>'
            +   '</div>'
            + '</div>'
            + '<div class="msn-profile-hud">'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Level</span><span class="msn-hud-value">' + level + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">XP</span><span class="msn-hud-value">' + esc(fmtNum(xp)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Messages</span><span class="msn-hud-value">' + esc(fmtNum(msgs)) + '</span></div>'
            + '</div>'
            + (showStreakRow ? renderFireRow(streak) : '')
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
                if (act === 'message')  triggerPrivateChat(data.username);
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

    console.log('[profile-system] loaded v6 — simplified + animated');
})();
