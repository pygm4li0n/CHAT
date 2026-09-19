/* ============================================================
   profile-system.js — MSN Profile / User Identity HUD
   ────────────────────────────────────────────────────────────
   Drop-in. Load AFTER app-extras.js.

     <script src="profile-system.js"></script>

   • Reuses window.MSN.supabase (or builds a fallback client)
   • Reads self identity from localStorage (no closure access)
   • Self streak is read from the live tracking DOM (#sidebarStreakDisplay)
   • Detects online status from the sidebar DOM
   • Renders one reusable card for "Me" or "Other user"
   • Clickable usernames with hover underline + "VIEW PROFILE" hint
   ============================================================ */
(function () {
    'use strict';

    /* ── Supabase constants ───────────────────────────────── */
    var SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    /* ── Tiny helpers ─────────────────────────────────────── */
    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) {
            return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
        });
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
    function xpForLevel(L) { return L <= 1 ? 0 : 25 * (L - 1) * L; }
    function levelFromXp(xp) {
        if (!xp || xp < 50) return 1;
        return Math.max(1, Math.floor((1 + Math.sqrt(1 + (xp * 4 / 25))) / 2));
    }
    function cssEscape(s) {
        if (window.CSS && CSS.escape) return CSS.escape(s);
        return String(s).replace(/"/g, '\\"');
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
        var item = document.querySelector(
            '.sidebar-user-item[data-username="' + cssEscape(username) + '"]'
        );
        return !!(item && item.querySelector('.online-indicator'));
    }

    /* ── Read live streak from the tracking system's DOM ────
       app-extras.js Section 3 owns the streak. It renders
       #sidebarStreakDisplay / #streakFires / #streakOverflow.
       We read that DOM instead of profiles.current_streak,
       which is empty because tracking is wallet-based. */
    function readSelfStreakFromDOM() {
        var container = document.getElementById('sidebarStreakDisplay');
        if (!container || container.classList.contains('hidden')) return 0;

        // Overflow "× N" when streak > 7
        var overflow = document.getElementById('streakOverflow');
        if (overflow && !overflow.classList.contains('hidden')) {
            var txt = overflow.textContent || '';
            var m = txt.match(/(\d+)/);
            if (m) return Number(m[1]);
        }

        // Otherwise count filled fire slots (max 7)
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

    /* ── Toast ─────────────────────────────────────────────── */
    function toast(msg) {
        var el = document.getElementById('errorToast');
        if (!el) { console.log('[profile]', msg); return; }
        el.classList.remove('visible');
        void el.offsetWidth;
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(el._msnProfileTimeout);
        el._msnProfileTimeout = setTimeout(function () { el.classList.remove('visible'); }, 5000);
    }

    /* ── CSS ──────────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById('msn-profile-styles')) return;
        var css = ''
        + '.msn-profile-overlay{'
        +   'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;'
        +   'padding:20px;background:rgba(5,8,16,.82);'
        +   'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);'
        +   'opacity:0;pointer-events:none;transition:opacity .28s ease;'
        + '}'
        + '.msn-profile-overlay.open{opacity:1;pointer-events:auto;}'
        + '.msn-profile-card{'
        +   'position:relative;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;overflow-x:hidden;'
        +   'padding:24px 22px 18px;'
        +   'background:linear-gradient(180deg,rgba(20,26,40,.97) 0%,rgba(10,14,24,.985) 100%);'
        +   'border:1px solid var(--border-default,#233261);border-radius:var(--radius-xl,22px);'
        +   'box-shadow:0 0 0 1px rgba(255,255,255,.04),0 24px 60px rgba(0,0,0,.8),'
        +               '0 0 40px var(--accent-cyan,rgba(0,240,255,.14));'
        +   'transform:scale(.94) translateY(10px);opacity:0;'
        +   'transition:transform .34s cubic-bezier(.16,1,.3,1),opacity .28s ease;'
        +   'font-family:var(--font-main,"Segoe UI",system-ui,sans-serif);'
        +   'color:var(--text-primary,#fff);text-align:left;'
        + '}'
        + '.msn-profile-overlay.open .msn-profile-card{transform:scale(1) translateY(0);opacity:1;}'
        + '.msn-profile-card::-webkit-scrollbar{width:6px;}'
        + '.msn-profile-card::-webkit-scrollbar-track{background:transparent;}'
        + '.msn-profile-card::-webkit-scrollbar-thumb{background:var(--border-default,#233261);border-radius:3px;}'
        + '.msn-profile-card::before{'
        +   'content:"";position:absolute;top:0;left:15%;right:15%;height:1px;'
        +   'background:linear-gradient(90deg,transparent,var(--accent-cyan,#00f0ff),transparent);'
        +   'opacity:.75;pointer-events:none;'
        + '}'

        /* Close button */
        + '.msn-profile-close{'
        +   'position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;'
        +   'border:1px solid var(--border-default,#233261);background:var(--bg-input,#111827);'
        +   'color:var(--text-secondary,#94a3b8);cursor:pointer;display:flex;align-items:center;'
        +   'justify-content:center;font-size:.85rem;transition:all .22s ease;z-index:3;'
        + '}'
        + '.msn-profile-close:hover{'
        +   'border-color:var(--accent-red,#ff5c7c);color:var(--accent-red,#ff5c7c);'
        +   'transform:rotate(90deg);box-shadow:0 0 12px rgba(255,92,124,.4);'
        + '}'

        /* Avatar block */
        + '.msn-profile-avatar-wrap{position:relative;width:92px;height:92px;margin:4px auto 12px;}'
        + '.msn-profile-avatar{'
        +   'width:100%;height:100%;border-radius:50%;background:var(--bg-elevated,#151b2d);'
        +   'border:2px solid var(--accent-cyan,#00f0ff);overflow:hidden;display:flex;'
        +   'align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:#fff;'
        +   'box-shadow:0 0 0 4px rgba(0,240,255,.05),0 0 22px var(--accent-cyan,rgba(0,240,255,.35));'
        + '}'
        + '.msn-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block;}'
        + '.msn-profile-status-dot{'
        +   'position:absolute;bottom:3px;right:3px;width:15px;height:15px;border-radius:50%;'
        +   'background:var(--text-muted,#64748b);border:3px solid var(--bg-panel,#111827);'
        +   'transition:background .25s ease,box-shadow .25s ease;'
        + '}'
        + '.msn-profile-status-dot.online{background:#4ade80;box-shadow:0 0 8px #4ade80,0 0 18px rgba(74,222,128,.55);}'

        /* Identity block */
        + '.msn-profile-username{'
        +   'text-align:center;font-size:1.25rem;font-weight:800;letter-spacing:.02em;'
        +   'margin:0 0 4px;color:var(--text-primary,#fff);'
        +   'text-shadow:0 0 12px var(--accent-cyan,rgba(0,240,255,.35));word-break:break-word;'
        + '}'
        + '.msn-profile-signature{'
        +   'text-align:center;font-size:.82rem;color:var(--text-secondary,#94a3b8);'
        +   'font-style:italic;margin:0 0 6px;line-height:1.4;word-break:break-word;min-height:1.15em;'
        + '}'
        + '.msn-profile-meta{'
        +   'text-align:center;font-size:.64rem;color:var(--text-muted,#64748b);'
        +   'letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin:0 0 18px;'
        + '}'

        /* HUD stats — 3 columns (Level / XP / Messages) */
        + '.msn-profile-hud{'
        +   'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;'
        +   'padding:12px 8px;margin-bottom:14px;'
        +   'background:linear-gradient(180deg,rgba(255,255,255,.03) 0%,rgba(0,0,0,.15) 100%),var(--bg-input,#111827);'
        +   'border:1px solid var(--border-default,#233261);border-radius:var(--radius-md,10px);'
        +   'box-shadow:inset 0 1px 0 rgba(255,255,255,.04),inset 0 -1px 0 rgba(0,0,0,.4);'
        + '}'
        + '.msn-hud-stat{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 2px;position:relative;}'
        + '.msn-hud-stat:not(:last-child)::after{'
        +   'content:"";position:absolute;right:-3px;top:18%;bottom:18%;width:1px;'
        +   'background:linear-gradient(180deg,transparent,var(--border-default,#233261),transparent);'
        + '}'
        + '.msn-hud-label{'
        +   'font-size:.56rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;'
        +   'color:var(--text-muted,#64748b);line-height:1;'
        + '}'
        + '.msn-hud-value{'
        +   'font-family:var(--font-mono,monospace);font-size:1.05rem;font-weight:800;'
        +   'color:var(--accent-cyan,#00f0ff);line-height:1;font-variant-numeric:tabular-nums;'
        +   'text-shadow:0 0 10px var(--accent-cyan,rgba(0,240,255,.4));'
        + '}'

        /* Streak row — fires + count */
        + '.msn-streak-row{'
        +   'display:flex;align-items:center;justify-content:space-between;gap:12px;'
        +   'padding:10px 12px;margin-bottom:16px;'
        +   'background:linear-gradient(180deg,rgba(249,115,22,.08) 0%,rgba(249,115,22,.02) 100%);'
        +   'border:1px solid var(--border-default,#233261);border-radius:var(--radius-md,10px);'
        +   'box-shadow:inset 0 1px 0 rgba(255,255,255,.03);'
        + '}'
        + '.msn-streak-label{'
        +   'font-size:.6rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;'
        +   'color:var(--text-muted,#64748b);flex-shrink:0;'
        + '}'
        + '.msn-streak-fires{display:flex;align-items:center;gap:3px;flex:1;justify-content:center;}'
        + '.msn-fire{font-size:1rem;line-height:1;display:inline-block;transition:all .3s ease;}'
        + '.msn-fire.filled{'
        +   'filter:drop-shadow(0 0 5px rgba(249,115,22,.9)) drop-shadow(0 0 10px rgba(255,165,0,.4));'
        +   'animation:msnFireFlicker 1.8s ease-in-out infinite;'
        + '}'
        + '.msn-fire.empty{filter:grayscale(100%) brightness(.4);opacity:.22;}'
        + '@keyframes msnFireFlicker{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}'
        + '.msn-streak-count{'
        +   'font-family:var(--font-mono,monospace);font-size:1rem;font-weight:800;'
        +   'color:var(--accent-orange,#f97316);min-width:2.4em;text-align:right;'
        +   'text-shadow:0 0 10px rgba(249,115,22,.7);'
        +   'font-variant-numeric:tabular-nums;flex-shrink:0;'
        + '}'

        /* Achievements */
        + '.msn-profile-section-label{'
        +   'font-size:.6rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;'
        +   'color:var(--text-muted,#64748b);margin:0 0 8px 2px;'
        + '}'
        + '.msn-achievements-grid{'
        +   'display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:0 0 18px;'
        +   'width:100%;box-sizing:border-box;'
        + '}'
        + '.msn-ach-slot{'
        +   'aspect-ratio:1/1;border-radius:8px;background:var(--bg-input,#111827);'
        +   'border:1px solid var(--border-default,#233261);display:flex;align-items:center;'
        +   'justify-content:center;font-size:1.05rem;line-height:1;'
        +   'transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;cursor:default;'
        +   'min-width:0;overflow:hidden;'
        + '}'
        + '.msn-ach-slot.unlocked{'
        +   'border-color:var(--accent-cyan,#00f0ff);'
        +   'box-shadow:0 0 10px var(--accent-cyan,rgba(0,240,255,.35));'
        + '}'
        + '.msn-ach-slot.locked{opacity:.32;filter:grayscale(100%);}'
        + '.msn-ach-slot.empty{opacity:.3;border-style:dashed;font-size:.85rem;color:var(--text-muted,#64748b);}'
        + '.msn-ach-slot:hover{transform:translateY(-2px);}'

        /* Action buttons */
        + '.msn-profile-actions{display:flex;gap:10px;margin-top:2px;}'
        + '.msn-action-btn{'
        +   'flex:1;padding:12px 14px;border-radius:var(--radius-md,10px);'
        +   'font-weight:700;font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;'
        +   'cursor:pointer;border:1px solid var(--border-default,#233261);'
        +   'background:var(--bg-elevated,#151b2d);color:var(--text-primary,#fff);'
        +   'transition:all .22s ease;font-family:inherit;'
        + '}'
        + '.msn-action-btn:hover{'
        +   'border-color:var(--accent-cyan,#00f0ff);color:var(--accent-cyan,#00f0ff);'
        +   'box-shadow:0 0 12px var(--accent-cyan,rgba(0,240,255,.3));transform:translateY(-1px);'
        + '}'
        + '.msn-action-btn.primary{'
        +   'background:var(--accent-cyan,#00f0ff);color:#0a0e1a;border-color:var(--accent-cyan,#00f0ff);'
        +   'box-shadow:0 0 16px var(--accent-cyan,rgba(0,240,255,.45));'
        + '}'
        + '.msn-action-btn.primary:hover{color:#0a0e1a;filter:brightness(1.08);}'

        /* Loader / error */
        + '.msn-profile-loader{'
        +   'display:flex;align-items:center;justify-content:center;gap:10px;'
        +   'padding:60px 10px;color:var(--text-muted,#64748b);'
        +   'font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.22em;'
        +   'text-transform:uppercase;'
        + '}'
        + '.msn-profile-loader-dots{display:inline-flex;gap:6px;}'
        + '.msn-profile-loader-dots span{'
        +   'width:8px;height:8px;border-radius:50%;background:currentColor;'
        +   'animation:msnProfilePulse 1.3s ease-in-out infinite;'
        + '}'
        + '.msn-profile-loader-dots span:nth-child(2){animation-delay:.18s;}'
        + '.msn-profile-loader-dots span:nth-child(3){animation-delay:.36s;}'
        + '@keyframes msnProfilePulse{'
        +   '0%,100%{opacity:.28;transform:translateY(0) scale(.85);}'
        +   '50%{opacity:1;transform:translateY(-4px) scale(1);}'
        + '}'
        + '.msn-profile-empty{'
        +   'padding:50px 16px;text-align:center;color:var(--text-muted,#64748b);'
        +   'font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.18em;'
        +   'text-transform:uppercase;'
        + '}'

        /* ── Message username: clickable affordance ── */
        + '.msg-username .msn-username-link{'
        +   'cursor:pointer;position:relative;display:inline-block;'
        +   'transition:color .2s ease,text-shadow .2s ease;'
        + '}'
        + '.msg-username .msn-username-link::after{'
        +   'content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;'
        +   'background:currentColor;opacity:0;'
        +   'transform:scaleX(.55);transform-origin:left center;'
        +   'transition:opacity .2s ease,transform .25s ease;'
        +   'pointer-events:none;'
        + '}'
        + '.msg-username:hover .msn-username-link{'
        +   'color:var(--accent-cyan,#00f0ff);'
        +   'text-shadow:0 0 10px var(--accent-cyan,rgba(0,240,255,.55));'
        + '}'
        + '.msg-username:hover .msn-username-link::after{'
        +   'opacity:.9;transform:scaleX(1);'
        + '}'
        + '.msg-username .msg-avatar{cursor:pointer;}'

        /* ── "VIEW PROFILE" hover hint ── */
        + '.msg-username,.sidebar-user-profile-big{position:relative;}'
        + '.msg-username::before,'
        + '.sidebar-user-item::before,'
        + '.sidebar-user-profile-big::before{'
        +   'content:"VIEW PROFILE";'
        +   'position:absolute;bottom:calc(100% + 6px);left:0;'
        +   'padding:3px 9px;border-radius:4px;'
        +   'background:var(--bg-input,#111827);'
        +   'border:1px solid var(--accent-cyan,#00f0ff);'
        +   'color:var(--accent-cyan,#00f0ff);'
        +   'font-family:var(--font-mono,monospace);'
        +   'font-size:0.55rem;font-weight:800;letter-spacing:0.14em;'
        +   'white-space:nowrap;line-height:1;'
        +   'opacity:0;pointer-events:none;'
        +   'transform:translateY(4px);'
        +   'transition:opacity .18s ease,transform .18s ease;'
        +   'z-index:30;'
        +   'text-shadow:0 0 6px var(--accent-cyan,#00f0ff);'
        +   'box-shadow:0 0 12px rgba(0,240,255,.3),0 4px 12px rgba(0,0,0,.5);'
        + '}'
        + '.msg-username:has(.msg-avatar:hover)::before,'
        + '.msg-username:has(.msn-username-link:hover)::before,'
        + '.sidebar-user-item:has(.user-avatar:hover)::before,'
        + '.sidebar-user-profile-big:has(.big-avatar:hover)::before,'
        + '.sidebar-user-profile-big:has(.big-name:hover)::before{'
        +   'opacity:1;transform:translateY(0);'
        + '}'

        /* Mobile */
        + '@media (max-width:480px){'
        +   '.msn-profile-overlay{padding:12px;}'
        +   '.msn-profile-card{max-width:100%;padding:20px 14px 14px;border-radius:16px;max-height:92vh;}'
        +   '.msn-profile-avatar-wrap{width:78px;height:78px;margin-bottom:10px;}'
        +   '.msn-profile-avatar{font-size:1.7rem;}'
        +   '.msn-profile-username{font-size:1.1rem;}'
        +   '.msn-profile-hud{gap:4px;padding:10px 4px;margin-bottom:12px;}'
        +   '.msn-hud-value{font-size:.94rem;}'
        +   '.msn-hud-label{font-size:.5rem;letter-spacing:.1em;}'
        +   '.msn-streak-row{padding:9px 10px;margin-bottom:14px;gap:8px;}'
        +   '.msn-fire{font-size:.9rem;}'
        +   '.msn-streak-count{font-size:.92rem;}'
        +   '.msn-achievements-grid{grid-template-columns:repeat(6,1fr);gap:6px;}'
        +   '.msn-ach-slot{font-size:.92rem;border-radius:6px;}'
        +   '.msn-action-btn{padding:11px 10px;font-size:.7rem;}'
        +   '.msg-username::before,'
        +   '.sidebar-user-item::before,'
        +   '.sidebar-user-profile-big::before{display:none;}'
        + '}';
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

    /* ── Wrap raw username text in a clickable span ───────── */
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
        containers.forEach(function (c) {
            if (c) mo.observe(c, { childList: true, subtree: true });
        });
    }

    /* ── Data fetch ───────────────────────────────────────── */
    async function fetchProfileData(username, isSelf) {
        var sb = getSB();
        if (!sb) return { error: 'no-supabase' };

        var out = {
            username: username,
            avatar_url: null,
            signature: '',
            xp: 0,
            level: 1,
            messages_count: 0,
            current_streak: 0,
            created_at: null
        };

        var richSel = 'username, avatar_url, xp, level, messages_count, '
                    + 'current_streak, signature, created_at';
        var minSel  = 'username, avatar_url, xp';

        var profile = null;
        try {
            var r1 = await sb.from('profiles').select(richSel).eq('username', username).maybeSingle();
            if (!r1.error && r1.data) profile = r1.data;
        } catch (e) { /* fall through */ }

        if (!profile) {
            try {
                var r2 = await sb.from('profiles').select(minSel).eq('username', username).maybeSingle();
                if (!r2.error && r2.data) profile = r2.data;
            } catch (e) { /* ignore */ }
        }

        if (!profile) return { error: 'not-found' };

        out.avatar_url     = profile.avatar_url || null;
        out.signature      = profile.signature || '';
        out.xp             = Number(profile.xp || 0);
        out.level          = Number(profile.level || levelFromXp(out.xp));
        out.messages_count = Number(profile.messages_count || 0);
        out.created_at     = profile.created_at || null;

        // Streak: for SELF read live value from the tracking DOM.
        // For OTHERS, fall back to the profiles column (may be 0).
        if (isSelf) {
            out.current_streak = readSelfStreakFromDOM();
        } else {
            out.current_streak = Number(profile.current_streak || 0);
        }

        // Derive messages count from messages table if column empty
        if (!out.messages_count) {
            try {
                var mc = await sb.from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('username', username);
                if (typeof mc.count === 'number') out.messages_count = mc.count;
            } catch (e) { /* ignore */ }
        }

        // Achievements (if table exists)
        try {
            var ac = await sb.from('user_achievements')
                .select('achievement_code, unlocked_at')
                .eq('username', username)
                .order('unlocked_at', { ascending: false })
                .limit(6);
            if (!ac.error && Array.isArray(ac.data)) out.achievements = ac.data;
        } catch (e) { /* ignore */ }

        return out;
    }

    /* ── Rendering ────────────────────────────────────────── */
    function avatarHTML(data) {
        if (data.avatar_url) {
            return '<img src="' + esc(data.avatar_url) + '" alt="">';
        }
        return esc((data.username || '?').charAt(0).toUpperCase() || '?');
    }

    function renderLoading() {
        bodyEl.innerHTML = ''
            + '<div class="msn-profile-loader">'
            +   '<span class="msn-profile-loader-dots"><span></span><span></span><span></span></span>'
            +   '<span>Loading profile</span>'
            + '</div>';
    }
    function renderError(msg) {
        bodyEl.innerHTML = '<div class="msn-profile-empty">' + esc(msg || 'Profile unavailable') + '</div>';
    }

    function renderFireRow(streak) {
        var MAX = 7;
        var filled = Math.min(streak, MAX);
        var fires = '';
        for (var i = 0; i < MAX; i++) {
            fires += '<span class="msn-fire ' + (i < filled ? 'filled' : 'empty') + '">🔥</span>';
        }
        var count = '🔥 ' + streak; // always visible, even at 0/1
        return ''
            + '<div class="msn-streak-row">'
            +   '<span class="msn-streak-label">Streak</span>'
            +   '<span class="msn-streak-fires">' + fires + '</span>'
            +   '<span class="msn-streak-count">' + count + '</span>'
            + '</div>';
    }

    function renderCard(data, isSelf) {
        var xp = Number(data.xp || 0);
        var level = Number(data.level || levelFromXp(xp));
        var streak = Number(data.current_streak || 0);
        var msgs = Number(data.messages_count || 0);

        var online = isSelf ? true : isUserOnline(data.username);

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
            actionsHTML = ''
                + '<button class="msn-action-btn" data-msn-profile-action="edit">Edit Profile</button>';
        } else {
            actionsHTML = ''
                + '<button class="msn-action-btn" data-msn-profile-action="friend">+ Add Friend</button>'
                + '<button class="msn-action-btn primary" data-msn-profile-action="message">Message</button>';
        }

        bodyEl.innerHTML = ''
            + '<div class="msn-profile-avatar-wrap">'
            +   '<div class="msn-profile-avatar">' + avatarHTML(data) + '</div>'
            +   '<span class="msn-profile-status-dot' + (online ? ' online' : '') + '" '
            +       'title="' + (online ? 'Online' : 'Offline') + '"></span>'
            + '</div>'
            + '<h2 class="msn-profile-username">' + esc(data.username) + '</h2>'
            + '<p class="msn-profile-signature">' + (data.signature ? esc(data.signature) : '') + '</p>'
            + '<div class="msn-profile-meta">◆ Joined ' + esc(fmtDate(data.created_at)) + '</div>'

            // HUD — 3 stats: Level / XP / Messages
            + '<div class="msn-profile-hud">'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Level</span><span class="msn-hud-value">' + level + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">XP</span><span class="msn-hud-value">' + esc(fmtNum(xp)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Messages</span><span class="msn-hud-value">' + esc(fmtNum(msgs)) + '</span></div>'
            + '</div>'

            // Streak row — fires + count
            + renderFireRow(streak)

            + '<div class="msn-profile-section-label">Achievements</div>'
            + '<div class="msn-achievements-grid">' + achHTML + '</div>'

            + '<div class="msn-profile-actions">' + actionsHTML + '</div>';

        var actions = bodyEl.querySelector('.msn-profile-actions');
        if (actions) {
            actions.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-msn-profile-action]');
                if (!btn) return;
                e.preventDefault();
                e.stopPropagation();
                var act = btn.getAttribute('data-msn-profile-action');
                if (act === 'message')  triggerPrivateChat(data.username);
                else if (act === 'friend') addFriend(data.username);
                else if (act === 'edit')   editProfile();
            });
        }
    }

    /* ── Actions ──────────────────────────────────────────── */
    function editProfile() {
        closeProfile();
        var btn = document.getElementById('sidebarChangeNameBtn');
        if (btn) btn.click();
    }

    function triggerPrivateChat(targetUser) {
        if (!targetUser) return;
        var item = document.querySelector(
            '.sidebar-user-item[data-username="' + cssEscape(targetUser) + '"]'
        );
        if (item) {
            closeProfile();
            item.click();
            return;
        }
        directPrivateRequest(targetUser);
    }

    async function directPrivateRequest(targetUser) {
        var sb = getSB();
        var me = getSelfUsername();
        if (!sb || !me) { toast('Set your username first'); return; }
        if (me === targetUser) { toast("That's you"); return; }
        try {
            var ex = await sb.from('private_chat_requests')
                .select('id').eq('from_user', me).eq('to_user', targetUser)
                .eq('status', 'pending').maybeSingle();
            if (ex && ex.data) { toast('📩 Request already sent'); return; }
            var ins = await sb.from('private_chat_requests').insert({
                from_user: me, to_user: targetUser, status: 'pending'
            });
            if (ins.error) { toast('Request failed'); return; }
            toast('📩 Request sent to ' + targetUser);
            closeProfile();
        } catch (e) {
            toast('Could not send request');
        }
    }

    async function addFriend(targetUser) {
        var sb = getSB();
        var me = getSelfUsername();
        if (!sb || !me) { toast('Set your username first'); return; }
        if (me === targetUser) { toast("That's you"); return; }
        try {
            var ins = await sb.from('friends').insert({
                user_a: me, user_b: targetUser, status: 'pending'
            });
            if (ins.error) throw ins.error;
            toast('Friend request sent to ' + targetUser);
        } catch (e) {
            console.warn('[profile] addFriend failed:', e);
            toast('Friend requests coming soon');
        }
    }

    /* ── Open / close ─────────────────────────────────────── */
    var currentToken = 0;
    async function openProfile(username) {
        if (!username) return;
        injectOverlay();
        var token = ++currentToken;

        overlay.classList.add('open');
        renderLoading();

        var me = getSelfUsername();
        var isSelf = (username === me);

        var data = await fetchProfileData(username, isSelf);
        if (token !== currentToken) return;

        if (data.error === 'no-supabase')      { renderError('Connection unavailable'); return; }
        if (data.error === 'not-found')        { renderError('Profile not found'); return; }

        renderCard(data, isSelf);
    }

    function closeProfile() {
        if (overlay) overlay.classList.remove('open');
        currentToken++;
    }

    /* ── Trigger wiring ───────────────────────────────────── */
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        var unameEl = t.closest('.msg-username');
        if (unameEl) {
            if (t.closest('.msg-actions-container, .msg-time, .user-badge, .msg-edited, .reply-ref-block')) return;
            var uname = extractUsernameFromMsgUsername(unameEl);
            if (uname) { e.preventDefault(); e.stopPropagation(); openProfile(uname); return; }
        }

        var sideAvatar = t.closest('.sidebar-user-item .user-avatar');
        if (sideAvatar) {
            var sideItem = sideAvatar.closest('.sidebar-user-item');
            var sideName = sideItem && sideItem.getAttribute('data-username');
            if (sideName) { e.preventDefault(); e.stopPropagation(); openProfile(sideName); return; }
        }

        var bigAvatar = t.closest('.sidebar-user-profile-big .big-avatar, .sidebar-user-profile-big .big-name');
        if (bigAvatar) {
            var me = getSelfUsername();
            if (me) { e.preventDefault(); e.stopPropagation(); openProfile(me); return; }
        }

        var rankRow = t.closest('#rankingsOverlay .rank-row');
        if (rankRow && t.closest('.rank-avatar, .rank-name')) {
            var nameEl = rankRow.querySelector('.rank-name');
            if (nameEl) {
                e.preventDefault(); e.stopPropagation();
                openProfile(nameEl.textContent.trim());
                return;
            }
        }
    }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
            e.preventDefault();
            closeProfile();
        }
    });

    /* ── Public API ───────────────────────────────────────── */
    window.MSN = window.MSN || {};
    window.MSN.profile = {
        open: openProfile,
        close: closeProfile,
        refresh: function () {
            var me = getSelfUsername();
            if (me) openProfile(me);
        }
    };

    /* ── Boot ─────────────────────────────────────────────── */
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

    console.log('[profile-system] loaded — click any avatar or username');
})();
