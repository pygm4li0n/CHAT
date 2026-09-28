/* ═══════════════════════════════════════════════════════════
   mod-panel.js — Tabbed control panel v2
   Self-contained. Intercepts the existing #modSettingsBtn.
   Requires: window.MSN.supabase (created by script.js)
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var OVERLAY_ID = 'modPanelV2';
    var TRIGGER_ID = 'modSettingsBtn';
    var sb = null;

    var cfg = {
        maxMessageLength: 500,
        allowImages:      true,
        allowDMs:         true,
        allowReactions:   true,
        bannedWallets:    [],
        mutedWallets:     {},
        wordFilter:       []
    };

    /* ── Helpers ─────────────────────────────────────────── */
    function getSB() {
        if (sb) return sb;
        if (window.MSN && window.MSN.supabase) return (sb = window.MSN.supabase);
        if (window.supabase && window.supabase.createClient) {
            window.MSN = window.MSN || {};
            return (sb = window.MSN.supabase = window.supabase.createClient(
                'https://uxrpjfsouwxnlcbhjilz.supabase.co',
                'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H'
            ));
        }
        return null;
    }
    function esc(t) {
        return String(t == null ? '' : t)
            .replace(/[&<>"']/g, function (m) {
                return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m];
            });
    }
    function wallet() {
        try { return localStorage.getItem('msn_cached_wallet') || ''; } catch (e) { return ''; }
    }
    function shortWallet(w) {
        w = String(w || '').trim();
        return w.length > 12 ? w.slice(0, 4) + '…' + w.slice(-4) : w;
    }
    function $(id) { return document.getElementById(id); }
    function setStatus(txt, state) {
        var el = $('modSaveStatus');
        if (!el) return;
        el.textContent = txt || '';
        el.classList.remove('ok', 'err');
        if (state) el.classList.add(state);
        if (txt) {
            clearTimeout(el._t);
            el._t = setTimeout(function () {
                el.textContent = '';
                el.classList.remove('ok', 'err');
            }, 4000);
        }
    }

    /* ── Overlay HTML ────────────────────────────────────── */
    function buildHTML() {
        return ''
        + '<div class="mod-card">'
        +   '<header class="mod-head">'
        +     '<span class="mod-badge">MOD</span>'
        +     '<h3>Control Panel</h3>'
        +     '<button class="mod-close" id="modPanelClose" aria-label="Close">✕</button>'
        +   '</header>'
        +   '<nav class="mod-tabs">'
        +     '<button class="mod-tab active" data-tab="chat">⚙️ Chat</button>'
        +     '<button class="mod-tab" data-tab="moderation">🛡️ Moderation</button>'
        +     '<button class="mod-tab" data-tab="announce">📢 Announce</button>'
        +     '<button class="mod-tab" data-tab="danger">💀 Danger</button>'
        +   '</nav>'
        +   '<div class="mod-body">'

        /* ── CHAT ── */
        +     '<section class="mod-pane active" data-pane="chat">'
        +       '<div class="mod-field">'
        +         '<label for="mpTokenReq">Token gate (min holdings to chat)</label>'
        +         '<input type="number" id="mpTokenReq" min="0" step="1000" placeholder="0">'
        +         '<span class="mod-hint">Set 0 for open chat</span>'
        +       '</div>'
        +       '<div class="mod-field">'
        +         '<label for="mpCooldown">Cooldown between messages</label>'
        +         '<select id="mpCooldown">'
        +           '<option value="0">Off</option>'
        +           '<option value="5">5 seconds</option>'
        +           '<option value="10">10 seconds</option>'
        +           '<option value="15">15 seconds</option>'
        +           '<option value="30">30 seconds</option>'
        +           '<option value="60">60 seconds</option>'
        +         '</select>'
        +       '</div>'
        +       '<div class="mod-field">'
        +         '<label for="mpMaxLen">Max message length</label>'
        +         '<input type="number" id="mpMaxLen" min="50" max="2000" step="50" placeholder="500">'
        +       '</div>'
        +       '<div class="mod-toggles">'
        +         '<label class="mod-toggle"><input type="checkbox" id="mpAllowImages" checked><span class="mod-toggle-track"></span><span>Allow image uploads</span></label>'
        +         '<label class="mod-toggle"><input type="checkbox" id="mpAllowDMs" checked><span class="mod-toggle-track"></span><span>Allow private DMs</span></label>'
        +         '<label class="mod-toggle"><input type="checkbox" id="mpAllowReactions" checked><span class="mod-toggle-track"></span><span>Allow reactions</span></label>'
        +       '</div>'
        +     '</section>'

        /* ── MODERATION ── */
        +     '<section class="mod-pane" data-pane="moderation">'
        +       '<div class="mod-field">'
        +         '<label>Banned wallets</label>'
        +         '<div class="mod-add-row">'
        +           '<input type="text" id="mpBanInput" placeholder="Paste wallet address…" autocomplete="off">'
        +           '<button class="mod-add-btn" id="mpBanAdd" type="button">Ban</button>'
        +         '</div>'
        +         '<div class="mod-list" id="mpBanList" data-empty="No wallets banned"></div>'
        +       '</div>'
        +       '<div class="mod-field">'
        +         '<label>Muted wallets (24h)</label>'
        +         '<div class="mod-add-row">'
        +           '<input type="text" id="mpMuteInput" placeholder="Paste wallet address…" autocomplete="off">'
        +           '<button class="mod-add-btn" id="mpMuteAdd" type="button">Mute</button>'
        +         '</div>'
        +         '<div class="mod-list" id="mpMuteList" data-empty="No wallets muted"></div>'
        +       '</div>'
        +       '<div class="mod-field">'
        +         '<label for="mpWordFilter">Word filter</label>'
        +         '<input type="text" id="mpWordFilter" placeholder="word1, word2, word3" autocomplete="off">'
        +         '<span class="mod-hint">Comma-separated. Blocked client-side.</span>'
        +       '</div>'
        +     '</section>'

        /* ── ANNOUNCE ── */
        +     '<section class="mod-pane" data-pane="announce">'
        +       '<div class="mod-field">'
        +         '<label>Active announcement</label>'
        +         '<div class="mod-announce-preview" id="mpAnnouncePreview">'
        +           '<span class="mod-announce-empty">No announcement pinned</span>'
        +         '</div>'
        +       '</div>'
        +       '<div class="mod-field">'
        +         '<label for="mpAnnounceInput">Post new announcement</label>'
        +         '<textarea id="mpAnnounceInput" rows="3" maxlength="300" placeholder="Type your announcement…"></textarea>'
        +         '<div class="mod-inline-actions">'
        +           '<button class="mod-inline-btn" id="mpAnnouncePost" type="button">📢 Post</button>'
        +           '<button class="mod-inline-btn ghost" id="mpAnnounceClear" type="button">Clear</button>'
        +         '</div>'
        +       '</div>'
        +     '</section>'

        /* ── DANGER ── */
        +     '<section class="mod-pane" data-pane="danger">'
        +       '<div class="mod-danger-intro">⚠️ Every action below requires typing the confirm word. They cannot be undone.</div>'
        +       '<div class="mod-danger-card">'
        +         '<div class="mod-danger-info"><strong>Reset all login streaks</strong><span>Wipes every wallet\'s streak to zero.</span></div>'
        +         '<button class="mod-danger-btn" data-danger="RESET" data-label="Reset All Login Streaks" type="button">Reset</button>'
        +       '</div>'
        +       '<div class="mod-danger-card">'
        +         '<div class="mod-danger-info"><strong>Clear all reactions</strong><span>Deletes every 👍 👎 ❤️ 😨 on every message.</span></div>'
        +         '<button class="mod-danger-btn" data-danger="REACTIONS" data-label="Clear All Reactions" type="button">Clear</button>'
        +       '</div>'
        +       '<div class="mod-danger-card">'
        +         '<div class="mod-danger-info"><strong>Reset all XP + levels</strong><span>Wipes XP and level history for every wallet.</span></div>'
        +         '<button class="mod-danger-btn" data-danger="XP" data-label="Reset All XP" type="button">Reset</button>'
        +       '</div>'
        +       '<div class="mod-danger-card">'
        +         '<div class="mod-danger-info"><strong>Wipe all mod settings</strong><span>Restores defaults — token gate, cooldown, lists.</span></div>'
        +         '<button class="mod-danger-btn" data-danger="SETTINGS" data-label="Wipe All Settings" type="button">Wipe</button>'
        +       '</div>'
        +     '</section>'

        +   '</div>'
        +   '<footer class="mod-foot">'
        +     '<span class="mod-save-status" id="modSaveStatus"></span>'
        +     '<button class="mod-save-btn" id="modPanelSave" type="button">Save Changes</button>'
        +   '</footer>'
        + '</div>';
    }

    function inject() {
        if (document.getElementById(OVERLAY_ID)) return;
        var ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.className = 'hidden';
        ov.innerHTML = buildHTML();
        document.body.appendChild(ov);
    }

    /* ── Open / close ─────────────────────────────────────── */
    function open() {
        inject();
        var ov = $('OVERLAY_ID'.replace('OVERLAY_ID', OVERLAY_ID));
        if (!ov) return;
        ov.classList.remove('hidden');
        load();
    }
    function close() {
        var ov = document.getElementById(OVERLAY_ID);
        if (ov) ov.classList.add('hidden');
    }

    /* ── Tabs ─────────────────────────────────────────────── */
    function wireTabs() {
        var root = document.getElementById(OVERLAY_ID);
        if (!root || root.dataset.tabsWired) return;
        root.dataset.tabsWired = '1';

        root.querySelectorAll('.mod-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                var name = tab.getAttribute('data-tab');
                root.querySelectorAll('.mod-tab').forEach(function (t) {
                    t.classList.toggle('active', t === tab);
                });
                root.querySelectorAll('.mod-pane').forEach(function (p) {
                    p.classList.toggle('active', p.getAttribute('data-pane') === name);
                });
            });
        });

        $('modPanelClose').addEventListener('click', close);
        root.addEventListener('click', function (e) {
            if (e.target === root) close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !root.classList.contains('hidden')) close();
        });
    }

    /* ── Ban / mute lists ─────────────────────────────────── */
    function renderBanList() {
        var box = $('mpBanList');
        if (!box) return;
        if (!cfg.bannedWallets.length) { box.innerHTML = ''; return; }
        box.innerHTML = cfg.bannedWallets.map(function (w) {
            return '<div class="mod-list-row">'
                + '<code title="' + esc(w) + '">' + esc(shortWallet(w)) + '</code>'
                + '<button class="mod-list-remove" data-list="ban" data-wallet="' + esc(w) + '" type="button" title="Remove">✕</button>'
                + '</div>';
        }).join('');
    }
    function renderMuteList() {
        var box = $('mpMuteList');
        if (!box) return;
        var now = Date.now();
        var entries = Object.keys(cfg.mutedWallets).filter(function (w) {
            return cfg.mutedWallets[w] > now;
        });
        if (!entries.length) { box.innerHTML = ''; return; }
        box.innerHTML = entries.map(function (w) {
            var hrs = Math.max(1, Math.round((cfg.mutedWallets[w] - now) / 3600000));
            return '<div class="mod-list-row">'
                + '<code title="' + esc(w) + '">' + esc(shortWallet(w)) + ' · ' + hrs + 'h</code>'
                + '<button class="mod-list-remove" data-list="mute" data-wallet="' + esc(w) + '" type="button" title="Unmute">✕</button>'
                + '</div>';
        }).join('');
    }
    function wireLists() {
        var root = document.getElementById(OVERLAY_ID);
        if (!root || root.dataset.listsWired) return;
        root.dataset.listsWired = '1';

        $('mpBanAdd').addEventListener('click', function () {
            var w = ($('mpBanInput').value || '').trim();
            if (!w) return;
            if (cfg.bannedWallets.indexOf(w) === -1) cfg.bannedWallets.push(w);
            $('mpBanInput').value = '';
            renderBanList();
        });
        $('mpMuteAdd').addEventListener('click', function () {
            var w = ($('mpMuteInput').value || '').trim();
            if (!w) return;
            cfg.mutedWallets[w] = Date.now() + 24 * 3600 * 1000;
            $('mpMuteInput').value = '';
            renderMuteList();
        });
        root.addEventListener('click', function (e) {
            var btn = e.target.closest('.mod-list-remove');
            if (!btn) return;
            var list = btn.getAttribute('data-list');
            var w = btn.getAttribute('data-wallet');
            if (list === 'ban') cfg.bannedWallets = cfg.bannedWallets.filter(function (x) { return x !== w; });
            if (list === 'mute') delete cfg.mutedWallets[w];
            renderBanList();
            renderMuteList();
        });
    }

    /* ── Announcement ─────────────────────────────────────── */
    function renderAnnouncePreview(text) {
        var box = $('mpAnnouncePreview');
        if (!box) return;
        var t = (text || '').trim();
        if (!t) box.innerHTML = '<span class="mod-announce-empty">No announcement pinned</span>';
        else box.textContent = t;
    }
    function wireAnnounce() {
        var root = document.getElementById(OVERLAY_ID);
        if (!root || root.dataset.announceWired) return;
        root.dataset.announceWired = '1';

        var inp = $('mpAnnounceInput');
        var t;
        inp.addEventListener('input', function () {
            clearTimeout(t);
            t = setTimeout(function () { renderAnnouncePreview(inp.value); }, 250);
        });

        $('mpAnnouncePost').addEventListener('click', function () {
            var msg = (inp.value || '').trim();
            if (!msg) { setStatus('Enter a message', 'err'); return; }
            var s = getSB();
            if (!s) { setStatus('No connection', 'err'); return; }
            s.rpc('save_mod_settings', { p_wallet: wallet(), p_mod_announcement: msg })
                .then(function (res) {
                    if (res.error) throw res.error;
                    renderAnnouncePreview(msg);
                    inp.value = '';
                    setStatus('Announcement posted', 'ok');
                })
                .catch(function () { setStatus('Post failed', 'err'); });
        });

        $('mpAnnounceClear').addEventListener('click', function () {
            var s = getSB();
            if (!s) return;
            s.rpc('save_mod_settings', { p_wallet: wallet(), p_mod_announcement: '' })
                .then(function (res) {
                    if (res.error) throw res.error;
                    inp.value = '';
                    renderAnnouncePreview('');
                    setStatus('Announcement cleared', 'ok');
                })
                .catch(function () { setStatus('Clear failed', 'err'); });
        });
    }

    /* ── Danger zone ──────────────────────────────────────── */
    function runDanger(code) {
        var s = getSB();
        if (!s) { setStatus('No connection', 'err'); return; }
        var rpc = null;
        if (code === 'RESET')     rpc = s.rpc('reset_login_tracking',  { p_wallet: wallet() });
        if (code === 'REACTIONS') rpc = s.rpc('clear_all_reactions',   { p_wallet: wallet() });
        if (code === 'XP')        rpc = s.rpc('reset_all_xp',          { p_wallet: wallet() });
        if (code === 'SETTINGS')  rpc = s.rpc('wipe_mod_settings',     { p_wallet: wallet() });
        if (!rpc) { setStatus('Unknown action', 'err'); return; }
        rpc.then(function (res) {
            if (res && res.error) throw res.error;
            setStatus('Action completed', 'ok');
        }).catch(function (err) {
            console.warn('[mod-panel] danger failed:', err);
            setStatus('Action failed — RPC missing?', 'err');
        });
    }
    function openConfirm(code, label) {
        var root = document.getElementById(OVERLAY_ID);
        if (!root) return;
        var card = root.querySelector('.mod-card');
        var ov = document.createElement('div');
        ov.className = 'mod-confirm';
        ov.innerHTML =
            '<div class="mod-confirm-box">'
            + '<h4>⚠️ Confirm</h4>'
            + '<p>You are about to run <strong>' + esc(label) + '</strong>.<br>'
            + 'Type <strong>' + esc(code) + '</strong> below to unlock.</p>'
            + '<input type="text" id="modConfirmInput" autocomplete="off" autocapitalize="characters" placeholder="TYPE HERE">'
            + '<div class="mod-confirm-actions">'
            +   '<button class="mod-confirm-cancel" type="button">Cancel</button>'
            +   '<button class="mod-confirm-go" type="button" disabled>Execute</button>'
            + '</div></div>';
        card.appendChild(ov);

        var input = ov.querySelector('#modConfirmInput');
        var goBtn = ov.querySelector('.mod-confirm-go');
        var cancelBtn = ov.querySelector('.mod-confirm-cancel');
        input.focus();

        input.addEventListener('input', function () {
            goBtn.disabled = input.value.trim().toUpperCase() !== code;
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !goBtn.disabled) goBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        });
        cancelBtn.addEventListener('click', function () { ov.remove(); });
        goBtn.addEventListener('click', function () {
            ov.remove();
            runDanger(code);
        });
    }
    function wireDanger() {
        var root = document.getElementById(OVERLAY_ID);
        if (!root || root.dataset.dangerWired) return;
        root.dataset.dangerWired = '1';

        root.querySelectorAll('.mod-danger-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openConfirm(btn.getAttribute('data-danger'), btn.getAttribute('data-label'));
            });
        });
    }

    /* ── Load / save ──────────────────────────────────────── */
    function load() {
        var s = getSB();
        if (!s) return;
        s.from('settings').select('*').eq('id', 1).maybeSingle().then(function (res) {
            if (res.error || !res.data) return;
            var d = res.data;
            if (d.token_requirement   != null) $('mpTokenReq').value      = d.token_requirement;
            if (d.cooldown_seconds    != null) $('mpCooldown').value      = d.cooldown_seconds;
            if (d.mod_announcement    != null) { $('mpAnnounceInput').value = d.mod_announcement || ''; renderAnnouncePreview(d.mod_announcement || ''); }
            if (d.max_message_length  != null) cfg.maxMessageLength       = d.max_message_length;
            if (d.allow_images        != null) cfg.allowImages            = !!d.allow_images;
            if (d.allow_dms           != null) cfg.allowDMs               = !!d.allow_dms;
            if (d.allow_reactions     != null) cfg.allowReactions         = !!d.allow_reactions;
            if (Array.isArray(d.banned_wallets)) cfg.bannedWallets        = d.banned_wallets.slice();
            if (d.muted_wallets && typeof d.muted_wallets === 'object') cfg.mutedWallets = Object.assign({}, d.muted_wallets);
            if (Array.isArray(d.word_filter))   cfg.wordFilter            = d.word_filter.slice();

            $('mpMaxLen').value             = cfg.maxMessageLength;
            $('mpAllowImages').checked      = cfg.allowImages;
            $('mpAllowDMs').checked         = cfg.allowDMs;
            $('mpAllowReactions').checked   = cfg.allowReactions;
            $('mpWordFilter').value         = cfg.wordFilter.join(', ');
            renderBanList();
            renderMuteList();
        });
    }

    function save() {
        var s = getSB();
        if (!s) { setStatus('No connection', 'err'); return; }

        cfg.maxMessageLength = Math.min(2000, Math.max(50, Number($('mpMaxLen').value) || 500));
        cfg.allowImages      = !!$('mpAllowImages').checked;
        cfg.allowDMs         = !!$('mpAllowDMs').checked;
        cfg.allowReactions   = !!$('mpAllowReactions').checked;
        cfg.wordFilter       = ($('mpWordFilter').value || '')
            .split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);

        var tokenReq  = Number($('mpTokenReq').value) || 0;
        var cooldown  = Number($('mpCooldown').value) || 0;
        var announce  = $('mpAnnounceInput').value || '';

        setStatus('Saving…');

        // Route through the RPC — same pattern as the legacy panel.
        s.rpc('save_mod_settings_v2', {
            p_wallet:             wallet(),
            p_token_requirement:  tokenReq,
            p_cooldown_seconds:   cooldown,
            p_mod_announcement:   announce,
            p_max_message_length: cfg.maxMessageLength,
            p_allow_images:       cfg.allowImages,
            p_allow_dms:          cfg.allowDMs,
            p_allow_reactions:    cfg.allowReactions,
            p_banned_wallets:     cfg.bannedWallets,
            p_muted_wallets:      cfg.mutedWallets,
            p_word_filter:        cfg.wordFilter
        }).then(function (res) {
            if (res.error) {
                console.error('[mod-panel] save_mod_settings_v2 failed:', res.error);
                // Fallback: old RPC only (3 fields) — in case migration wasn't run
                s.rpc('save_mod_settings', {
                    p_wallet:            wallet(),
                    p_token_requirement: tokenReq,
                    p_cooldown_seconds:  cooldown
                }).then(function (r2) {
                    if (r2.error) {
                        setStatus('Save failed: ' + (res.error.message || 'unknown'), 'err');
                    } else {
                        setStatus('Saved (basic only — run migration)', 'err');
                    }
                });
                return;
            }
            setStatus('Saved', 'ok');
        }).catch(function (err) {
            console.error('[mod-panel] save threw:', err);
            setStatus('Save failed', 'err');
        });
    }

    function wireSave() {
        var root = document.getElementById(OVERLAY_ID);
        if (!root || root.dataset.saveWired) return;
        root.dataset.saveWired = '1';
        $('modPanelSave').addEventListener('click', save);
    }

    /* ── Intercept the existing mod button ───────────────── */
    function hookTrigger() {
        var btn = document.getElementById(TRIGGER_ID);
        if (!btn) { setTimeout(hookTrigger, 300); return; }
        if (btn.dataset.mpV2Hooked) return;
        btn.dataset.mpV2Hooked = '1';

        btn.addEventListener('click', function (e) {
            // Capture phase — stop script.js's own handler from running
            e.stopImmediatePropagation();
            e.preventDefault();
            open();
        }, true);
    }

    /* ── Boot ─────────────────────────────────────────────── */
    function boot() {
        inject();
        wireTabs();
        wireLists();
        wireAnnounce();
        wireDanger();
        wireSave();
        hookTrigger();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    // Re-hook in case the button is rebuilt (mobile shim, wallet swap, etc.)
    setTimeout(hookTrigger, 800);
    setTimeout(hookTrigger, 2500);

    console.log('[mod-panel] v2 loaded');
})();
