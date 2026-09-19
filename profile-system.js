/* ============================================================
   profile-system.js — MSN Profile / User Identity HUD
   ────────────────────────────────────────────────────────────
   Drop-in. Load AFTER app-extras.js.

     <script src="profile-system.js"></script>

   • Reuses window.MSN.supabase (or builds a fallback client)
   • Reads self identity from localStorage (no closure access)
   • Detects online status from the sidebar DOM
   • Renders one reusable card for "Me" or "Other user"
   • Degrades gracefully if new columns/tables don't exist yet
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
    function getSelfWallet() {
        try { return localStorage.getItem('msn_cached_wallet') || null; } catch (e) { return null; }
    }
    function getCurrentTheme() {
        try { return localStorage.getItem('msn_theme') || 'original'; } catch (e) { return 'original'; }
    }
    function isUserOnline(username) {
        if (!username) return false;
        var item = document.querySelector(
            '.sidebar-user-item[data-username="' + cssEscape(username) + '"]'
        );
        return !!(item && item.querySelector('.online-indicator'));
    }
    function extractUsernameFromMsgUsername(el) {
        if (!el) return null;
        for (var i = 0; i < el.childNodes.length; i++) {
            var n = el.childNodes[i];
            if (n.nodeType === 3) {
                var t = String(n.nodeValue || '').trim();
                if (t) return t;
            }
        }
        return null;
    }

    /* ── Toast (piggy-backs on existing #errorToast element) ── */
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
        +   'position:relative;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;overflow-x:hidden;'
        +   'padding:26px 24px 20px;'
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
        +   'position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:8px;'
        +   'border:1px solid var(--border-default,#233261);background:var(--bg-input,#111827);'
        +   'color:var(--text-secondary,#94a3b8);cursor:pointer;display:flex;align-items:center;'
        +   'justify-content:center;font-size:.9rem;transition:all .22s ease;z-index:3;'
        + '}'
        + '.msn-profile-close:hover{'
        +   'border-color:var(--accent-red,#ff5c7c);color:var(--accent-red,#ff5c7c);'
        +   'transform:rotate(90deg);box-shadow:0 0 12px rgba(255,92,124,.4);'
        + '}'

        /* Avatar block */
        + '.msn-profile-avatar-wrap{position:relative;width:104px;height:104px;margin:6px auto 14px;}'
        + '.msn-profile-avatar{'
        +   'width:100%;height:100%;border-radius:50%;background:var(--bg-elevated,#151b2d);'
        +   'border:2px solid var(--accent-cyan,#00f0ff);overflow:hidden;display:flex;'
        +   'align-items:center;justify-content:center;font-size:2.2rem;font-weight:800;color:#fff;'
        +   'box-shadow:0 0 0 4px rgba(0,240,255,.05),0 0 24px var(--accent-cyan,rgba(0,240,255,.35));'
        + '}'
        + '.msn-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block;}'
        + '.msn-profile-status-dot{'
        +   'position:absolute;bottom:4px;right:4px;width:16px;height:16px;border-radius:50%;'
        +   'background:var(--text-muted,#64748b);border:3px solid var(--bg-panel,#111827);'
        +   'transition:background .25s ease,box-shadow .25s ease;'
        + '}'
        + '.msn-profile-status-dot.online{background:#4ade80;box-shadow:0 0 8px #4ade80,0 0 18px rgba(74,222,128,.55);}'

        /* Identity block */
        + '.msn-profile-username{'
        +   'text-align:center;font-size:1.35rem;font-weight:800;letter-spacing:.02em;'
        +   'margin:0 0 4px;color:var(--text-primary,#fff);'
        +   'text-shadow:0 0 12px var(--accent-cyan,rgba(0,240,255,.35));word-break:break-word;'
        + '}'
        + '.msn-profile-signature{'
        +   'text-align:center;font-size:.85rem;color:var(--text-secondary,#94a3b8);'
        +   'font-style:italic;margin:0 0 8px;line-height:1.4;word-break:break-word;'
        + '}'
        + '.msn-profile-meta{'
        +   'text-align:center;font-size:.68rem;color:var(--text-muted,#64748b);'
        +   'letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin:0 0 20px;'
        + '}'

        /* HUD stats */
        + '.msn-profile-hud{'
        +   'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;'
        +   'padding:12px 8px;margin-bottom:18px;'
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
        +   'font-size:.58rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;'
        +   'color:var(--text-muted,#64748b);line-height:1;'
        + '}'
        + '.msn-hud-value{'
        +   'font-family:var(--font-mono,monospace);font-size:1.12rem;font-weight:800;'
        +   'color:var(--accent-cyan,#00f0ff);line-height:1;font-variant-numeric:tabular-nums;'
        +   'text-shadow:0 0 10px var(--accent-cyan,rgba(0,240,255,.4));'
        + '}'

        /* Detail rows */
        + '.msn-profile-details{display:grid;gap:0;margin:0 0 18px;}'
        + '.msn-detail-row{'
        +   'display:flex;justify-content:space-between;align-items:center;'
        +   'padding:8px 4px;border-bottom:1px solid var(--border-subtle,#1a2942);font-size:.82rem;'
        + '}'
        + '.msn-detail-row:last-child{border-bottom:none;}'
        + '.msn-detail-key{'
        +   'color:var(--text-muted,#64748b);font-size:.68rem;letter-spacing:.1em;'
        +   'text-transform:uppercase;font-weight:700;'
        + '}'
        + '.msn-detail-val{'
        +   'color:var(--text-primary,#fff);font-weight:700;'
        +   'font-family:var(--font-mono,monospace);font-size:.82rem;'
        + '}'

        /* Achievements */
        + '.msn-profile-section-label{'
        +   'font-size:.62rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;'
        +   'color:var(--text-muted,#64748b);margin:0 0 8px 2px;'
        + '}'
        + '.msn-achievements-row{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;}'
        + '.msn-ach-slot{'
        +   'width:42px;height:42px;border-radius:8px;background:var(--bg-input,#111827);'
        +   'border:1px solid var(--border-default,#233261);display:flex;align-items:center;'
        +   'justify-content:center;font-size:1.15rem;line-height:1;'
        +   'transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;cursor:default;'
        + '}'
        + '.msn-ach-slot.unlocked{'
        +   'border-color:var(--accent-cyan,#00f0ff);'
        +   'box-shadow:0 0 10px var(--accent-cyan,rgba(0,240,255,.35));'
        + '}'
        + '.msn-ach-slot.locked{opacity:.32;filter:grayscale(100%);}'
        + '.msn-ach-slot.empty{opacity:.3;border-style:dashed;font-size:.85rem;color:var(--text-muted,#64748b);}'
        + '.msn-ach-slot:hover{transform:translateY(-2px);}'

        /* Action buttons */
        + '.msn-profile-actions{display:flex;gap:10px;margin-top:4px;}'
        + '.msn-action-btn{'
        +   'flex:1;padding:12px 14px;border-radius:var(--radius-md,10px);'
        +   'font-weight:700;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;'
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

        /* Mobile */
        + '@media (max-width:480px){'
        +   '.msn-profile-overlay{padding:12px;}'
        +   '.msn-profile-card{max-width:100%;padding:22px 16px 16px;border-radius:16px;max-height:92vh;}'
        +   '.msn-profile-avatar-wrap{width:84px;height:84px;}'
        +   '.msn-profile-avatar{font-size:1.85rem;}'
        +   '.msn-profile-username{font-size:1.15rem;}'
        +   '.msn-profile-hud{gap:4px;padding:10px 4px;}'
        +   '.msn-hud-value{font-size:.98rem;}'
        +   '.msn-hud-label{font-size:.52rem;letter-spacing:.1em;}'
        +   '.msn-ach-slot{width:38px;height:38px;font-size:1rem;}'
        +   '.msn-action-btn{padding:11px 10px;font-size:.72rem;}'
        + '}';
        var tag = document.createElement('style');
        tag.id = 'msn-profile-styles';
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ── Overlay markup ───────────────────────────────────── */
    var overlay, card, bodyEl;
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
        card = document.getElementById('msnProfileCard');
        bodyEl = document.getElementById('msnProfileBody');

        document.getElementById('msnProfileClose').addEventListener('click', closeProfile);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeProfile();
        });
    }

    /* ── Data fetch ───────────────────────────────────────── */
    async function fetchProfileData(username) {
        var sb = getSB();
        if (!sb) return { error: 'no-supabase' };

        var out = {
            username: username,
            avatar_url: null,
            signature: '',
            xp: 0,
            level: 1,
            messages_count: 0,
            active_days: 0,
            current_streak: 0,
            longest_streak: 0,
            skin: getCurrentTheme(),
            created_at: null,
            wallet_address: null,
            friends_count: 0,
            achievements: []
        };

        // Try rich select first; fall back to minimal if columns missing
        var richSel = 'username, avatar_url, wallet_address, xp, level, messages_count, '
                    + 'active_days, current_streak, longest_streak, signature, skin, created_at';
        var minSel  = 'username, avatar_url, wallet_address, xp';

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
        out.wallet_address = profile.wallet_address || null;
        out.signature      = profile.signature || '';
        out.xp             = Number(profile.xp || 0);
        out.level          = Number(profile.level || levelFromXp(out.xp));
        out.messages_count = Number(profile.messages_count || 0);
        out.active_days    = Number(profile.active_days || 0);
        out.current_streak = Number(profile.current_streak || 0);
        out.longest_streak = Number(profile.longest_streak || 0);
        out.skin           = profile.skin || getCurrentTheme();
        out.created_at     = profile.created_at || null;

        // Derive messages count if column empty
        if (!out.messages_count) {
            try {
                var mc = await sb.from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('username', username);
                if (typeof mc.count === 'number') out.messages_count = mc.count;
            } catch (e) { /* ignore */ }
        }

        // Friends count (if table exists)
        try {
            var fc = await sb.from('friends')
                .select('*', { count: 'exact', head: true })
                .or('and(user_a.eq.' + username + ',status.eq.accepted),'
                  + 'and(user_b.eq.' + username + ',status.eq.accepted)');
            if (typeof fc.count === 'number') out.friends_count = fc.count;
        } catch (e) { /* ignore */ }

        // Achievements (if table exists)
        try {
            var ac = await sb.from('user_achievements')
                .select('achievement_code, unlocked_at')
                .eq('username', username)
                .order('unlocked_at', { ascending: false })
                .limit(8);
            if (!ac.error && Array.isArray(ac.data)) out.achievements = ac.data;
        } catch (e) { /* ignore */ }

        return out;
    }

    /* ── Rendering ────────────────────────────────────────── */
    function avatarHTML(data) {
        if (data.avatar_url) {
            return '<img src="' + esc(data.avatar_url) + '" alt="" '
                 + 'onerror="this.replaceWith(document.createTextNode('
                 + "('' + (this.alt || '?'))[0] ? '" + esc((data.username || '?')[0] || '?') + "' : '?'))\""
                 + '>';
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

    function renderCard(data, isSelf) {
        var xp = Number(data.xp || 0);
        var level = Number(data.level || levelFromXp(xp));
        var inLevel = xp - xpForLevel(level);
        var needForNext = xpForLevel(level + 1) - xpForLevel(level);
        var streak = Number(data.current_streak || 0);
        var msgs = Number(data.messages_count || 0);

        var online = isSelf ? true : isUserOnline(data.username);

        var achHTML = '';
        if (data.achievements && data.achievements.length) {
            achHTML = data.achievements.map(function (a) {
                return '<div class="msn-ach-slot unlocked" title="' + esc(a.achievement_code) + '">🏆</div>';
            }).join('');
            if (data.achievements.length < 6) {
                for (var i = data.achievements.length; i < 6; i++) {
                    achHTML += '<div class="msn-ach-slot empty" title="Locked">·</div>';
                }
            }
        } else {
            for (var j = 0; j < 6; j++) {
                achHTML += '<div class="msn-ach-slot empty" title="Coming soon">·</div>';
            }
        }

        var actionsHTML = '';
        if (isSelf) {
            actionsHTML = ''
                + '<button class="msn-action-btn" data-msn-profile-action="edit">Edit Profile</button>'
                + '<button class="msn-action-btn primary" data-msn-profile-action="skins">Change Skin</button>';
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
            + '<p class="msn-profile-signature">' + (data.signature ? esc(data.signature) : '&nbsp;') + '</p>'
            + '<div class="msn-profile-meta">'
            +   (isSelf ? '◆ You ' : '◆ Member ') + 'since ' + esc(fmtDate(data.created_at))
            + '</div>'

            + '<div class="msn-profile-hud">'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Level</span><span class="msn-hud-value">' + level + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">XP</span><span class="msn-hud-value">' + esc(fmtNum(xp)) + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Streak</span><span class="msn-hud-value">' + streak + '</span></div>'
            +   '<div class="msn-hud-stat"><span class="msn-hud-label">Messages</span><span class="msn-hud-value">' + esc(fmtNum(msgs)) + '</span></div>'
            + '</div>'

            + '<div class="msn-profile-details">'
            +   row('Progress', esc(inLevel) + ' / ' + esc(needForNext) + ' XP')
            +   row('Active Days', esc(fmtNum(data.active_days || 0)))
            +   row('Longest Streak', esc(fmtNum(data.longest_streak || 0)))
            +   row('Friends', esc(fmtNum(data.friends_count || 0)))
            +   row('Skin', esc((data.skin || getCurrentTheme()).toUpperCase()))
            + '</div>'

            + '<div class="msn-profile-section-label">Achievements</div>'
            + '<div class="msn-achievements-row">' + achHTML + '</div>'

            + '<div class="msn-profile-actions">' + actionsHTML + '</div>';

        // Action wiring
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
                else if (act === 'skins')  openSkins();
            });
        }
    }

    function row(key, val) {
        return '<div class="msn-detail-row">'
             +   '<span class="msn-detail-key">' + key + '</span>'
             +   '<span class="msn-detail-val">' + val + '</span>'
             + '</div>';
    }

    /* ── Actions ──────────────────────────────────────────── */
    function editProfile() {
        closeProfile();
        var btn = document.getElementById('sidebarChangeNameBtn');
        if (btn) btn.click();
    }

    function openSkins() {
        closeProfile();
        var btn = document.getElementById('headerThemeBtn') || document.getElementById('sidebarThemeBtn');
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

        var data = await fetchProfileData(username);
        if (token !== currentToken) return; // superseded by newer request

        if (data.error === 'no-supabase')      { renderError('Connection unavailable'); return; }
        if (data.error === 'not-found')        { renderError('Profile not found'); return; }

        renderCard(data, isSelf);
    }

    function closeProfile() {
        if (overlay) overlay.classList.remove('open');
        currentToken++; // invalidate in-flight fetches
    }

    /* ── Trigger wiring (capture-phase, delegated) ────────── */
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        // 1. Avatar or username inside a chat message
        var unameEl = t.closest('.msg-username');
        if (unameEl) {
            if (t.closest('.msg-actions-container, .msg-time, .user-badge, .msg-edited, .reply-ref-block')) return;
            var uname = extractUsernameFromMsgUsername(unameEl);
            if (uname) { e.preventDefault(); e.stopPropagation(); openProfile(uname); return; }
        }

        // 2. Sidebar user avatar (not the whole row — row opens private chat)
        var sideAvatar = t.closest('.sidebar-user-item .user-avatar');
        if (sideAvatar) {
            var sideItem = sideAvatar.closest('.sidebar-user-item');
            var sideName = sideItem && sideItem.getAttribute('data-username');
            if (sideName) { e.preventDefault(); e.stopPropagation(); openProfile(sideName); return; }
        }

        // 3. Own big avatar in sidebar → opens My Profile
        var bigAvatar = t.closest('.sidebar-user-profile-big .big-avatar, .sidebar-user-profile-big .big-name');
        if (bigAvatar) {
            var me = getSelfUsername();
            if (me) { e.preventDefault(); e.stopPropagation(); openProfile(me); return; }
        }

        // 4. Rankings rows
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

    // ESC to close
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
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { injectStyles(); injectOverlay(); });
    } else {
        injectStyles();
        injectOverlay();
    }

    console.log('[profile-system] loaded — click any avatar or username');
})();
