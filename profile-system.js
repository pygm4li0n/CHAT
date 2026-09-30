/* ============================================================
   profile-system.js — MSN Profile / User Identity HUD
   ────────────────────────────────────────────────────────────
   Drop-in. Load AFTER script.js + wallet-identity.js.

     <script src="profile-system.js?v=17"></script>

   v12: bigger name, streak fire, no rank, last-active on top
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
       CSS — EPIC HERO v12
       ═══════════════════════════════════════════════════════ */
    function injectStyles() {
        var old = document.getElementById('msn-profile-styles');
        if (old) old.remove();
        var css = `
/* ═══════════════════════════════════════════════════════
   MSN PROFILE CARD — epic hero v12
   ═══════════════════════════════════════════════════════ */

.msn-profile-overlay{
    position:fixed;
    inset:0;
    z-index:500;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:
        radial-gradient(ellipse 70% 50% at 50% 40%,
            var(--accent-glow, rgba(0,240,255,.08)) 0%,
            transparent 60%),
        radial-gradient(ellipse at center,
            var(--overlay-bg-1, rgba(8,14,26,.94)) 0%,
            var(--overlay-bg-2, rgba(2,4,10,.985)) 100%);
    backdrop-filter:blur(20px) saturate(1.2);
    -webkit-backdrop-filter:blur(20px) saturate(1.2);
    opacity:0;
    pointer-events:none;
    transition:opacity .3s ease;
}
.msn-profile-overlay.open{opacity:1;pointer-events:auto;}

/* ── Card ── */
.msn-profile-card{
    position:relative;
    width:100%;
    max-width:540px;
    max-height:calc(100vh - 40px);
    overflow:hidden;
    padding:0;
    background:
        radial-gradient(ellipse 100% 60% at 50% 0%,
            var(--card-glow, rgba(0,240,255,.10)) 0%,
            transparent 55%),
        linear-gradient(180deg,
            var(--bg-panel, #0c1526) 0%,
            var(--bg-deep, #050810) 100%);
    border-radius:24px;
    box-shadow:
        0 0 0 1px var(--card-outline, rgba(0,240,255,.35)),
        0 0 0 2px var(--card-outline-outer, rgba(0,0,0,.6)),
        0 0 80px var(--card-bloom, rgba(0,240,255,.14)),
        0 40px 100px rgba(0,0,0,.9),
        inset 0 1px 0 var(--card-inner-highlight, rgba(255,255,255,.05));
    transform:scale(.9) translateY(30px);
    opacity:0;
    transition:transform .5s cubic-bezier(.16,1,.3,1), opacity .3s ease;
    font-family:var(--font-main, "Segoe UI", system-ui, sans-serif);
    color:var(--text-primary, #fff);
    text-align:left;
}

/* Scanner border */
.msn-profile-card::after{
    content:"";
    position:absolute;
    inset:0;
    border-radius:24px;
    padding:1.5px;
    background:conic-gradient(from 0deg,
        transparent 0deg,
        transparent 70deg,
        var(--accent-cyan, #00f0ff) 90deg,
        var(--accent-cyan-bright, #b9f6ff) 100deg,
        var(--accent-cyan, #00f0ff) 110deg,
        transparent 130deg,
        transparent 250deg,
        var(--accent-purple, #a855f7) 270deg,
        var(--accent-purple-bright, #e6d4ff) 280deg,
        var(--accent-purple, #a855f7) 290deg,
        transparent 310deg,
        transparent 360deg);
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;
            mask-composite:exclude;
    pointer-events:none;
    animation:msnBorderSpin 6s linear infinite;
    filter:drop-shadow(0 0 8px var(--accent-cyan, rgba(0,240,255,.6)));
    z-index:2;
}
@keyframes msnBorderSpin{to{transform:rotate(360deg);}}

.msn-profile-overlay.open .msn-profile-card{
    transform:scale(1) translateY(0);
    opacity:1;
}

.msn-card-inner{
    position:relative;
    padding:0;
    z-index:1;
}

/* Close button */
.msn-profile-close{
    position:absolute;
    top:14px;
    right:14px;
    width:32px;
    height:32px;
    border-radius:50%;
    border:1px solid var(--border-default, rgba(255,255,255,.12));
    background:var(--bg-elevated, rgba(10,16,30,.7));
    backdrop-filter:blur(8px);
    color:var(--text-muted, #7d8ba6);
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:.85rem;
    z-index:5;
    transition:transform .35s cubic-bezier(.16,1,.3,1), border-color .2s, color .2s, background .2s;
}
.msn-profile-close:hover,
.msn-profile-close:focus-visible{
    outline:none;
    border-color:rgba(255,45,85,.6);
    color:#ff2d55;
    background:rgba(255,45,85,.1);
    transform:rotate(90deg) scale(1.08);
}

/* ═══════════════════════════════════════════════════════
   LAST ACTIVE — top strip
   ═══════════════════════════════════════════════════════ */
.msn-la-top{
    display:flex;
    align-items:center;
    gap:9px;
    padding:11px 24px;
    background:
        linear-gradient(180deg,
            var(--accent-green-glow-soft, rgba(74,222,128,.06)) 0%,
            transparent 100%);
    border-bottom:1px solid var(--border-subtle, rgba(74,222,128,.10));
    font-family:var(--font-mono, monospace);
    font-size:.56rem;
    letter-spacing:.16em;
    text-transform:uppercase;
}
.msn-la-dot{
    width:7px;
    height:7px;
    border-radius:50%;
    background:var(--status-online, #4ade80);
    box-shadow:0 0 10px var(--status-online, #4ade80),
               0 0 18px var(--status-online-glow, rgba(74,222,128,.5));
    animation:msnStripPulse 1.6s ease-in-out infinite;
    flex-shrink:0;
}
@keyframes msnStripPulse{
    0%,100%{opacity:1;transform:scale(1);}
    50%{opacity:.55;transform:scale(.85);}
}
.msn-la-label{
    font-weight:800;
    color:var(--accent-green-mid, #6ee7a7);
}
.msn-la-val{
    margin-left:auto;
    font-weight:900;
    color:var(--accent-green, #a7f3d0);
    text-shadow:0 0 10px var(--accent-green-shadow, rgba(74,222,128,.4));
    letter-spacing:.1em;
}

/* ═══════════════════════════════════════════════════════
   HERO — asymmetric avatar + identity
   ═══════════════════════════════════════════════════════ */
.msn-hero{
    display:grid;
    grid-template-columns:120px 1fr;
    gap:22px;
    align-items:center;
    padding:24px 24px 22px;
    position:relative;
}

/* Avatar */
.msn-avatar-wrap{
    position:relative;
    width:120px;
    height:120px;
    flex-shrink:0;
}
.msn-avatar-wrap::before{
    content:"";
    position:absolute;
    inset:-12px;
    border-radius:50%;
    background:radial-gradient(circle,
        var(--accent-glow, rgba(0,240,255,.20)) 0%,
        var(--accent-glow-soft, rgba(0,240,255,.06)) 40%,
        transparent 70%);
    animation:msnAvatarHalo 4s ease-in-out infinite;
    pointer-events:none;
}
@keyframes msnAvatarHalo{
    0%,100%{transform:scale(1);opacity:.85;}
    50%{transform:scale(1.08);opacity:1;}
}
.msn-avatar-ring{
    position:absolute;
    inset:-4px;
    border-radius:50%;
    background:conic-gradient(from 0deg,
        transparent 0deg,
        var(--accent-cyan, #00f0ff) 60deg,
        transparent 140deg,
        transparent 220deg,
        var(--accent-purple, #a855f7) 280deg,
        transparent 360deg);
    animation:msnBorderSpin 4s linear infinite;
    z-index:0;
    pointer-events:none;
}
.msn-avatar-ring::after{
    content:"";
    position:absolute;
    inset:3px;
    border-radius:50%;
    background:var(--bg-deep, #050810);
}
.msn-avatar{
    position:absolute;
    inset:0;
    border-radius:50%;
    overflow:hidden;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:2.4rem;
    font-weight:900;
    color:var(--text-primary, #fff);
    z-index:2;
    background:var(--bg-deep, #050810);
    box-shadow:
        inset 0 0 40px rgba(0,0,0,.9),
        0 8px 30px rgba(0,0,0,.6);
    text-shadow:0 0 20px var(--accent-cyan, rgba(0,240,255,.9));
}
.msn-avatar img{width:100%;height:100%;object-fit:cover;display:block;}

.msn-status-dot{
    position:absolute;
    right:2px;
    bottom:2px;
    width:22px;
    height:22px;
    border-radius:50%;
    background:var(--status-offline, #5a6b88);
    border:4px solid var(--bg-panel, #0c1526);
    z-index:3;
    transition:background .25s, box-shadow .25s;
}
.msn-status-dot.online{
    background:var(--status-online, #4ade80);
    box-shadow:0 0 16px var(--status-online, #4ade80),
               0 0 32px var(--status-online-glow, rgba(74,222,128,.5));
}
.msn-status-dot.online::before{
    content:"";
    position:absolute;
    inset:-4px;
    border-radius:50%;
    border:2px solid var(--status-online, #4ade80);
    animation:msnPing 1.8s ease-out infinite;
    pointer-events:none;
}
@keyframes msnPing{
    0%{transform:scale(1);opacity:.9;}
    100%{transform:scale(2.3);opacity:0;}
}

/* Identity column */
.msn-hero-info{
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:8px;
    min-width:0;
}

/* ⚑ Name — bigger, bolder, better adapted */
.msn-hero-name-row{
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:9px;
    min-width:0;
    width:100%;
}
.msn-hero-name{
    margin:0;
    font-size:1.85rem;
    font-weight:900;
    letter-spacing:-.025em;
    line-height:1.1;
    color:var(--text-primary, #fff);
    word-break:break-word;
    text-shadow:
        0 0 24px var(--accent-glow, rgba(0,240,255,.5)),
        0 0 48px var(--accent-glow-soft, rgba(0,240,255,.22)),
        0 2px 8px rgba(0,0,0,.9);
    animation:msnNameGlow 3.2s ease-in-out infinite;
}
@keyframes msnNameGlow{
    0%,100%{
        text-shadow:
            0 0 24px var(--accent-glow, rgba(0,240,255,.5)),
            0 0 48px var(--accent-glow-soft, rgba(0,240,255,.22)),
            0 2px 8px rgba(0,0,0,.9);
    }
    50%{
        text-shadow:
            0 0 32px var(--accent-glow, rgba(0,240,255,.8)),
            0 0 60px var(--accent-glow-soft, rgba(0,240,255,.35)),
            0 2px 8px rgba(0,0,0,.9);
    }
}

/* Tier badge */
.msn-tier-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:1.9em;
    height:1.9em;
    padding:0 .55em;
    border-radius:999px;
    background:var(--bg-elevated, rgba(255,255,255,.06));
    border:1.5px solid var(--border-default, rgba(255,255,255,.18));
    font-size:.72em;
    line-height:1;
    font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;
    box-shadow:
        inset 0 1px 0 var(--card-inner-highlight, rgba(255,255,255,.08)),
        0 0 12px rgba(0,0,0,.4);
}
.msn-tier-badge.msn-tier-whale{
    background:linear-gradient(135deg,
        var(--accent-glow, rgba(0,240,255,.2)) 0%,
        var(--accent-glow-soft, rgba(0,240,255,.05)) 100%);
    border-color:var(--accent-cyan, rgba(0,240,255,.6));
    box-shadow:0 0 20px var(--accent-cyan-glow, rgba(0,240,255,.5));
}
.msn-tier-badge.msn-tier-dolphin{
    background:linear-gradient(135deg,
        var(--accent-purple-glow, rgba(168,85,247,.2)) 0%,
        var(--accent-purple-glow-soft, rgba(168,85,247,.05)) 100%);
    border-color:var(--accent-purple, rgba(168,85,247,.6));
    box-shadow:0 0 20px var(--accent-purple-glow, rgba(168,85,247,.5));
}
.msn-tier-badge.msn-tier-crab{
    background:linear-gradient(135deg,
        var(--accent-orange-glow, rgba(255,138,0,.2)) 0%,
        var(--accent-orange-glow-soft, rgba(255,138,0,.05)) 100%);
    border-color:var(--accent-orange, rgba(255,138,0,.6));
    box-shadow:0 0 20px var(--accent-orange-glow, rgba(255,138,0,.5));
}

/* X badge */
.msn-x-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:1.9em;
    height:1.9em;
    border-radius:50%;
    background:linear-gradient(135deg, #1d9bf0 0%, #0a4a9a 100%);
    color:#fff;
    font-size:.72em;
    font-weight:900;
    line-height:1;
    font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;
    box-shadow:
        0 0 16px rgba(29,155,240,.7),
        inset 0 1px 0 rgba(255,255,255,.3);
    flex-shrink:0;
}

.msn-hero-sig{
    margin:0;
    font-size:.85rem;
    color:var(--text-secondary, #8fa2be);
    line-height:1.4;
    word-break:break-word;
    max-width:100%;
    min-height:1em;
}

/* Pill row */
.msn-hero-pills{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    align-items:center;
    margin-top:4px;
}

/* Copyable wallet */
.msn-wallet-btn{
    display:inline-flex;
    align-items:center;
    gap:7px;
    padding:6px 11px;
    font-size:.62rem;
    color:var(--accent-green, #a7f3d0);
    letter-spacing:.06em;
    font-weight:800;
    font-family:var(--font-mono, monospace);
    background:linear-gradient(180deg,
        var(--accent-green-glow, rgba(74,222,128,.10)) 0%,
        var(--accent-green-glow-soft, rgba(74,222,128,.02)) 100%);
    border:1px solid var(--accent-green-border, rgba(74,222,128,.28));
    border-radius:8px;
    line-height:1;
    cursor:pointer;
    transition:all .18s ease;
    position:relative;
}
.msn-wallet-btn:hover{
    border-color:var(--accent-green, rgba(74,222,128,.6));
    background:linear-gradient(180deg,
        var(--accent-green-glow-hover, rgba(74,222,128,.18)) 0%,
        var(--accent-green-glow-soft, rgba(74,222,128,.05)) 100%);
    box-shadow:0 0 16px var(--accent-green-shadow, rgba(74,222,128,.3));
    color:var(--accent-green-bright, #c6f9d8);
}
.msn-wallet-btn:active{transform:scale(.97);}
.msn-wallet-icon{font-size:.85rem;line-height:1;opacity:.9;}
.msn-wallet-label{line-height:1;}
.msn-wallet-copy{
    font-size:.75rem;
    line-height:1;
    opacity:.7;
    margin-left:2px;
    transition:opacity .18s;
}
.msn-wallet-btn:hover .msn-wallet-copy{opacity:1;}
.msn-wallet-btn.msn-copied{
    background:linear-gradient(180deg,
        var(--accent-green-glow-strong, rgba(74,222,128,.28)) 0%,
        var(--accent-green-glow, rgba(74,222,128,.10)) 100%);
    border-color:var(--accent-green, rgba(74,222,128,.9));
    box-shadow:0 0 24px var(--accent-green-shadow-strong, rgba(74,222,128,.6));
}

/* Joined pill */
.msn-joined-pill{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:6px 11px;
    font-size:.6rem;
    color:var(--accent-cyan, #7dd3fc);
    letter-spacing:.12em;
    text-transform:uppercase;
    font-weight:800;
    font-family:var(--font-mono, monospace);
    background:linear-gradient(180deg,
        var(--accent-glow-soft, rgba(0,240,255,.08)) 0%,
        var(--accent-glow-faint, rgba(0,240,255,.02)) 100%);
    border:1px solid var(--border-glow, rgba(0,240,255,.22));
    border-radius:8px;
    line-height:1;
    white-space:nowrap;
}

/* ═══════════════════════════════════════════════════════
   STATS — 5 columns
   ═══════════════════════════════════════════════════════ */
.msn-stats{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:1px;
    margin:0 24px 18px;
    background:var(--border-subtle, rgba(0,240,255,.08));
    border:1px solid var(--border-subtle-strong, rgba(0,240,255,.14));
    border-radius:14px;
    overflow:hidden;
}
.msn-stat{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:6px;
    padding:14px 4px;
    background:linear-gradient(180deg,
        var(--accent-glow-faint, rgba(0,240,255,.03)) 0%,
        var(--accent-glow-trace, rgba(0,240,255,.005)) 100%);
    transition:background .2s ease;
    min-width:0;
}
.msn-stat:hover{
    background:linear-gradient(180deg,
        var(--accent-glow-soft, rgba(0,240,255,.09)) 0%,
        var(--accent-glow-faint, rgba(0,240,255,.02)) 100%);
}
.msn-stat-lbl{
    font-size:.46rem;
    font-weight:800;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--text-muted, #6a7a96);
    line-height:1;
    font-family:var(--font-mono, monospace);
}
.msn-stat-val{
    font-family:var(--font-mono, monospace);
    font-size:1.15rem;
    font-weight:900;
    color:var(--accent-cyan, #00f0ff);
    line-height:1;
    font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;
    text-shadow:0 0 14px var(--accent-cyan-shadow, rgba(0,240,255,.6));
    display:flex;
    align-items:baseline;
    gap:2px;
}
.msn-stat-val .msn-stat-sub{
    font-size:.6em;
    color:var(--text-muted, #6a7a96);
    font-weight:800;
    text-shadow:none;
}

/* ⚑ Streak — fire + number */
.msn-stat.msn-stat-fire .msn-stat-val{
    color:var(--accent-orange, #ffb066);
    text-shadow:0 0 14px var(--accent-orange-glow, rgba(255,140,0,.6));
}
.msn-stat.msn-stat-fire .msn-stat-val .msn-fire-icon{
    font-size:.85em;
    filter:drop-shadow(0 0 6px rgba(255,140,0,.9));
    animation:msnFireBounce 1.6s ease-in-out infinite;
}
@keyframes msnFireBounce{
    0%,100%{transform:scale(1) translateY(0);}
    50%{transform:scale(1.15) translateY(-2px);}
}

/* ═══════════════════════════════════════════════════════
   ACHIEVEMENTS
   ═══════════════════════════════════════════════════════ */
.msn-ach-header{
    display:flex;
    align-items:center;
    gap:10px;
    margin:0 24px 8px;
}
.msn-ach-header-label{
    font-size:.52rem;
    font-weight:800;
    letter-spacing:.2em;
    text-transform:uppercase;
    color:var(--text-muted, #6a7a96);
    font-family:var(--font-mono, monospace);
    display:flex;
    align-items:center;
    gap:6px;
    flex-shrink:0;
}
.msn-ach-header-label::before{
    content:"◆";
    color:var(--accent-cyan, #00f0ff);
    font-size:.7rem;
}
.msn-ach-header::after{
    content:"";
    flex:1;
    height:1px;
    background:linear-gradient(90deg, var(--border-glow, rgba(0,240,255,.25)), transparent);
}
.msn-ach-count{
    font-size:.5rem;
    color:var(--text-muted, #6a7a96);
    font-family:var(--font-mono, monospace);
    font-weight:800;
    letter-spacing:.08em;
    flex-shrink:0;
}

.msn-achievements{
    display:grid;
    grid-template-columns:repeat(6,minmax(0,1fr));
    gap:7px;
    margin:0 24px 18px;
    width:auto;
}
.msn-ach{
    aspect-ratio:1/1;
    border-radius:9px;
    background:var(--bg-elevated, rgba(255,255,255,.02));
    border:1px solid var(--border-subtle, rgba(0,240,255,.10));
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:1.05rem;
    line-height:1;
    transition:all .22s ease;
    min-width:0;
    overflow:hidden;
    opacity:0;
    transform:translateY(5px) scale(.92);
    animation:msnAchIn .5s cubic-bezier(.16,1,.3,1) forwards;
}
.msn-ach:nth-child(1){animation-delay:.24s;}
.msn-ach:nth-child(2){animation-delay:.30s;}
.msn-ach:nth-child(3){animation-delay:.36s;}
.msn-ach:nth-child(4){animation-delay:.42s;}
.msn-ach:nth-child(5){animation-delay:.48s;}
.msn-ach:nth-child(6){animation-delay:.54s;}
@keyframes msnAchIn{
    to{opacity:1;transform:translateY(0) scale(1);}
}
.msn-ach.unlocked{
    border-color:var(--accent-cyan-glow, rgba(0,240,255,.5));
    background:linear-gradient(180deg,
        var(--accent-glow-soft, rgba(0,240,255,.12)) 0%,
        var(--accent-glow-faint, rgba(0,240,255,.03)) 100%);
    box-shadow:
        0 0 16px var(--accent-cyan-glow, rgba(0,240,255,.35)),
        inset 0 1px 0 var(--card-inner-highlight, rgba(255,255,255,.08));
}
.msn-ach.locked{
    opacity:.22;
    border-style:dashed;
}
.msn-ach.locked::before{
    content:"·";
    color:var(--text-muted, #64748b);
    font-size:1.2rem;
    font-weight:900;
}
.msn-ach:hover{
    transform:translateY(-3px) scale(1.06);
    border-color:var(--accent-cyan, rgba(0,240,255,.7));
    box-shadow:0 0 22px var(--accent-cyan-glow, rgba(0,240,255,.5));
}

/* ═══════════════════════════════════════════════════════
   ACTIONS
   ═══════════════════════════════════════════════════════ */
.msn-actions{
    display:flex;
    gap:10px;
    padding:0 24px 20px;
}
.msn-act-btn{
    flex:1;
    padding:13px 16px;
    border-radius:11px;
    font-weight:900;
    font-size:.72rem;
    letter-spacing:.1em;
    text-transform:uppercase;
    cursor:pointer;
    border:1px solid var(--border-glow-soft, rgba(0,240,255,.18));
    background:linear-gradient(180deg,
        var(--accent-glow-soft, rgba(0,240,255,.05)) 0%,
        var(--accent-glow-faint, rgba(0,240,255,.01)) 100%);
    color:var(--text-primary, #e0f4ff);
    transition:all .2s ease;
    font-family:var(--font-mono, monospace);
}
.msn-act-btn:hover{
    border-color:var(--accent-cyan, rgba(0,240,255,.5));
    background:linear-gradient(180deg,
        var(--accent-glow, rgba(0,240,255,.12)) 0%,
        var(--accent-glow-faint, rgba(0,240,255,.03)) 100%);
    color:var(--accent-cyan, #00f0ff);
    box-shadow:0 0 20px var(--accent-cyan-glow, rgba(0,240,255,.25));
    transform:translateY(-1px);
}
.msn-act-btn:active{transform:translateY(0) scale(.98);}
.msn-act-btn.primary{
    background:linear-gradient(180deg,
        var(--accent-cyan, #00f0ff) 0%,
        var(--accent-cyan-deep, #00b8d4) 100%);
    color:var(--accent-ink, #001018);
    border-color:var(--accent-cyan, #00f0ff);
    box-shadow:
        0 0 30px var(--accent-cyan-shadow, rgba(0,240,255,.4)),
        inset 0 1px 0 rgba(255,255,255,.5),
        inset 0 -1px 0 rgba(0,0,0,.15);
    text-shadow:0 1px 0 rgba(255,255,255,.35);
}
.msn-act-btn.primary:hover{
    filter:brightness(1.08);
    box-shadow:
        0 0 44px var(--accent-cyan-shadow, rgba(0,240,255,.7)),
        inset 0 1px 0 rgba(255,255,255,.6),
        inset 0 -1px 0 rgba(0,0,0,.15);
}

/* ═══════════════════════════════════════════════════════
   LOADER + EMPTY
   ═══════════════════════════════════════════════════════ */
.msn-profile-loader{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:16px;
    padding:80px 10px;
    color:var(--accent-cyan, #00f0ff);
    font-family:var(--font-mono, monospace);
    font-size:.68rem;
    letter-spacing:.24em;
    text-transform:uppercase;
    text-shadow:0 0 12px var(--accent-cyan-shadow, rgba(0,240,255,.6));
}
.msn-loader-dots{
    display:inline-flex;
    gap:8px;
}
.msn-loader-dots span{
    width:10px;
    height:10px;
    border-radius:50%;
    background:var(--accent-cyan, #00f0ff);
    animation:msnLoaderPulse 1.3s ease-in-out infinite;
    box-shadow:0 0 12px var(--accent-cyan, #00f0ff);
}
.msn-loader-dots span:nth-child(2){animation-delay:.15s;}
.msn-loader-dots span:nth-child(3){animation-delay:.3s;}
@keyframes msnLoaderPulse{
    0%,100%{opacity:.25;transform:translateY(0) scale(.85);}
    50%{opacity:1;transform:translateY(-5px) scale(1.15);}
}

.msn-profile-empty{
    padding:60px 16px;
    text-align:center;
    color:var(--text-muted, #6a7a96);
    font-family:var(--font-mono, monospace);
    font-size:.68rem;
    letter-spacing:.22em;
    text-transform:uppercase;
}

/* ── Username affordance ── */
.msg-username .msn-username-link{
    cursor:pointer;
    transition:color .2s ease, text-shadow .2s ease;
}
.msg-username:hover .msn-username-link{
    color:var(--accent-cyan, #00f0ff);
    text-shadow:0 0 12px var(--accent-cyan-shadow, rgba(0,240,255,.8));
}
.msg-username .msg-avatar{cursor:pointer;}

/* ── Mobile ── */
@media (max-width:520px){
    .msn-profile-overlay{padding:12px;}
    .msn-profile-card{border-radius:20px;}
    .msn-profile-card::after{border-radius:20px;}
    .msn-la-top{padding:9px 18px;font-size:.5rem;}

    .msn-hero{
        grid-template-columns:88px 1fr;
        gap:16px;
        padding:18px 18px 16px;
    }
    .msn-avatar-wrap{width:88px;height:88px;}
    .msn-avatar{font-size:1.75rem;}
    .msn-status-dot{width:18px;height:18px;border-width:3px;}
    .msn-hero-name{font-size:1.4rem;letter-spacing:-.02em;}
    .msn-hero-sig{font-size:.72rem;}
    .msn-tier-badge{min-width:1.7em;height:1.7em;font-size:.68em;}
    .msn-x-badge{width:1.7em;height:1.7em;font-size:.68em;}
    .msn-wallet-btn{font-size:.54rem;padding:5px 9px;gap:5px;}
    .msn-joined-pill{font-size:.52rem;padding:5px 9px;}

    .msn-stats{margin:0 18px 14px;}
    .msn-stat{padding:11px 3px;gap:5px;}
    .msn-stat-lbl{font-size:.42rem;letter-spacing:.1em;}
    .msn-stat-val{font-size:.95rem;}

    .msn-ach-header{margin:0 18px 6px;}
    .msn-achievements{gap:5px;margin:0 18px 14px;}
    .msn-ach{font-size:.9rem;border-radius:7px;}

    .msn-actions{padding:0 18px 16px;gap:8px;}
    .msn-act-btn{padding:11px 10px;font-size:.66rem;letter-spacing:.06em;}
}

@media (max-width:380px){
    .msn-hero{grid-template-columns:76px 1fr;gap:12px;padding:16px 14px 14px;}
    .msn-avatar-wrap{width:76px;height:76px;}
    .msn-avatar{font-size:1.5rem;}
    .msn-hero-name{font-size:1.2rem;}
    .msn-stats{grid-template-columns:repeat(3,1fr);margin:0 14px 12px;}
    .msn-ach-header{margin:0 14px 6px;}
    .msn-achievements{margin:0 14px 12px;}
    .msn-actions{padding:0 14px 14px;}
}

@media (prefers-reduced-motion: reduce){
    .msn-profile-card,
    .msn-profile-card::after,
    .msn-avatar-wrap::before,
    .msn-avatar-ring,
    .msn-status-dot.online::before,
    .msn-hero-name,
    .msn-ach,
    .msn-loader-dots span,
    .msn-la-dot,
    .msn-fire-icon{
        animation:none !important;
    }
    .msn-profile-card{transition:none !important;}
    .msn-ach{opacity:1 !important;transform:none !important;}
}
`;
        var tag = document.createElement('style');
        tag.id = 'msn-profile-styles';
        tag.setAttribute('data-version', '12');
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ── Overlay ─────────────────────────────────────────── */
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

    /* ── Wallet copy handler ── */
    function setupWalletCopy() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.msn-wallet-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            var addr = btn.getAttribute('data-wallet');
            if (!addr) return;

            var finish = function () {
                btn.classList.add('msn-copied');
                var copyIcon = btn.querySelector('.msn-wallet-copy');
                if (!copyIcon) return;
                var prev = copyIcon.textContent;
                copyIcon.textContent = '✓';
                setTimeout(function () {
                    btn.classList.remove('msn-copied');
                    copyIcon.textContent = prev;
                }, 1300);
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(addr).then(finish).catch(function () {
                    try {
                        var ta = document.createElement('textarea');
                        ta.value = addr;
                        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        finish();
                    } catch (err) {}
                });
            } else {
                try {
                    var ta = document.createElement('textarea');
                    ta.value = addr;
                    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    finish();
                } catch (err) {}
            }
        }, true);
    }

    /* ═══════════════════════════════════════════════════════
       Profile fetch — parallel + 30s cache · rank removed
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
            messages_count: 0, current_streak: 0, created_at: null,
            last_active_at: null,
            wallet_address: wallet || null, token_balance: null,
            reactions_given: 0, private_chats: 0,
            achievements: [], hasProfile: false
        };

        var richSel = 'username, display_name, avatar_url, x_handle, x_verified, x_avatar_url, wallet_address, xp, messages_count, token_balance, updated_at';
        var minSel  = 'username, avatar_url, wallet_address, xp, token_balance';

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

        if (out.token_balance == null && username) {
            try {
                var cached = window.userBalances && window.userBalances[username];
                if (cached != null) out.token_balance = cached;
            } catch (e) {}
        }

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

        if (out.wallet_address && !isSelf) {
            tasks.push(_timeout(
                sb.rpc('get_streak_by_wallet', { p_wallet: out.wallet_address })
                    .then(function (res) {
                        if (res && !res.error && typeof res.data === 'number') out.current_streak = res.data;
                    }).catch(function () {}),
                3500
            ));
        }

        tasks.push(_timeout(
            sb.from('message_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('username', username)
                .then(function (res) {
                    if (res && typeof res.count === 'number') out.reactions_given = res.count;
                }).catch(function () {}),
            3500
        ));

        tasks.push(_timeout(
            sb.from('private_messages')
                .select('*', { count: 'exact', head: true })
                .or('from_user.eq.' + username + ',to_user.eq.' + username)
                .then(function (res) {
                    if (res && typeof res.count === 'number') out.private_chats = res.count;
                }).catch(function () {}),
            3500
        ));

        await Promise.all(tasks);

        if (isSelf) out.current_streak = readSelfStreakFromDOM();

        if (!out.created_at && out.last_active_at) out.created_at = out.last_active_at;
        if (!out.created_at && profile && profile.updated_at) out.created_at = profile.updated_at;

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
            + '<div class="msn-card-inner">'
            +   '<div class="msn-profile-loader">'
            +     '<span class="msn-loader-dots"><span></span><span></span><span></span></span>'
            +     '<span>Loading…</span>'
            +   '</div>'
            + '</div>';
    }
    function renderError(msg) {
        bodyEl.innerHTML = '<div class="msn-card-inner">'
            + '<div class="msn-profile-empty">⚠ ' + esc(msg || 'Profile unavailable') + '</div>'
            + '</div>';
    }

    function renderCard(data, isSelf) {
        var xp        = Number(data.xp || 0);
        var level     = Number(data.level || levelFromXp(xp));
        var streak    = Number(data.current_streak || 0);
        var msgs      = Number(data.messages_count || 0);
        var reactions = Number(data.reactions_given || 0);
        var privMsgs  = Number(data.private_chats || 0);
        var online    = isSelf ? true : isUserOnline(data.username);
        var shownName = data.display_name || data.username || 'anon';

        var xBadge = data.x_verified
            ? '<span class="msn-x-badge" title="Verified on X">𝕏</span>'
            : '';

        var tierBadge = '';
        var tier = tierFor(resolveBalance(data));
        if (tier) {
            tierBadge = '<span class="msn-tier-badge msn-tier-' + tier.name.toLowerCase() + '"'
                + ' title="' + tier.name + '">' + tier.emoji + '</span>';
        }

        var walletBtn = '';
        if (data.wallet_address) {
            walletBtn = '<button class="msn-wallet-btn" type="button" '
                + 'data-wallet="' + esc(data.wallet_address) + '" '
                + 'title="Click to copy full address">'
                + '<span class="msn-wallet-icon">👛</span>'
                + '<span class="msn-wallet-label">' + esc(shortWallet(data.wallet_address)) + '</span>'
                + '<span class="msn-wallet-copy">📋</span>'
                + '</button>';
        } else if (data.x_handle) {
            walletBtn = '<span class="msn-joined-pill">@' + esc(data.x_handle) + '</span>';
        }

        var joinedPill = '<span class="msn-joined-pill">◉ Joined ' + esc(fmtDate(data.created_at)) + '</span>';

        var achHTML = '';
        var unlocked = 0;
        if (data.achievements && data.achievements.length) {
            unlocked = data.achievements.length;
            achHTML = data.achievements.map(function (a) {
                return '<div class="msn-ach unlocked" title="' + esc(a.achievement_code) + '">🏆</div>';
            }).join('');
            for (var i = data.achievements.length; i < 6; i++) {
                achHTML += '<div class="msn-ach locked" title="Locked"></div>';
            }
        } else {
            for (var j = 0; j < 6; j++) {
                achHTML += '<div class="msn-ach locked" title="Coming soon"></div>';
            }
        }

        var actionsHTML = '';
        if (isSelf) {
            actionsHTML = '<button class="msn-act-btn" data-msn-profile-action="edit">⚙ Edit Profile</button>';
        } else {
            actionsHTML = ''
                + '<button class="msn-act-btn" data-msn-profile-action="friend">+ Add Friend</button>'
                + '<button class="msn-act-btn primary" data-msn-profile-action="message">▶ Message</button>';
        }

        var streakClass = streak > 0 ? ' msn-stat-fire' : '';
        var streakVal   = streak > 0
            ? '<span class="msn-fire-icon">🔥</span>' + streak
            : '—';

        bodyEl.innerHTML = ''
            + '<div class="msn-card-inner">'

            /* ── Last Active — top strip ── */
            + '<div class="msn-la-top">'
            +   '<span class="msn-la-dot"></span>'
            +   '<span class="msn-la-label">Last Active</span>'
            +   '<span class="msn-la-val">' + esc(timeAgo(data.last_active_at || data.created_at)) + '</span>'
            + '</div>'

            /* ── Hero — avatar + name ── */
            + '<div class="msn-hero">'
            +   '<div class="msn-avatar-wrap">'
            +     '<div class="msn-avatar-ring"></div>'
            +     '<div class="msn-avatar">' + avatarHTML(data) + '</div>'
            +     '<span class="msn-status-dot' + (online ? ' online' : '') + '"></span>'
            +   '</div>'
            +   '<div class="msn-hero-info">'
            +     '<div class="msn-hero-name-row">'
            +       '<h2 class="msn-hero-name">' + esc(shownName) + '</h2>'
            +       tierBadge + xBadge
            +     '</div>'
            +     '<p class="msn-hero-sig">' + (data.signature ? esc(data.signature) : '') + '</p>'
            +     '<div class="msn-hero-pills">' + walletBtn + joinedPill + '</div>'
            +   '</div>'
            + '</div>'

            /* ── Stats — Level / Streak / Messages / Reactions / Private ── */
            + '<div class="msn-stats">'
            +   '<div class="msn-stat"><span class="msn-stat-lbl">Level</span><span class="msn-stat-val">' + level + '</span></div>'
            +   '<div class="msn-stat' + streakClass + '"><span class="msn-stat-lbl">Streak</span><span class="msn-stat-val">' + streakVal + '</span></div>'
            +   '<div class="msn-stat"><span class="msn-stat-lbl">Messages</span><span class="msn-stat-val">' + esc(fmtNum(msgs)) + '</span></div>'
            +   '<div class="msn-stat"><span class="msn-stat-lbl">Reactions</span><span class="msn-stat-val">' + esc(fmtNum(reactions)) + '</span></div>'
            +   '<div class="msn-stat"><span class="msn-stat-lbl">Private</span><span class="msn-stat-val">' + esc(fmtNum(privMsgs)) + '</span></div>'
            + '</div>'

            /* ── Achievements ── */
            + '<div class="msn-ach-header">'
            +   '<span class="msn-ach-header-label">Achievements</span>'
            +   '<span class="msn-ach-count">' + unlocked + ' / 6</span>'
            + '</div>'
            + '<div class="msn-achievements">' + achHTML + '</div>'

            /* ── Actions ── */
            + '<div class="msn-actions">' + actionsHTML + '</div>'

            + '</div>';

        var actions = bodyEl.querySelector('.msn-actions');
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
        setupWalletCopy();
        decorateUsernames(document.getElementById('publicMessagesContainer'));
        decorateUsernames(document.getElementById('privateMessagesContainer'));
        setupUsernameObserver();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    console.log('[profile-system] loaded v12 — epic hero, fire streak, no rank, top last-active');
})();
