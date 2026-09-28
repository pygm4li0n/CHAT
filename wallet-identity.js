/* ═══════════════════════════════════════════════════════════
   wallet-identity.js — v7
   ───────────────────────────────────────────────────────────
   Wallet is the source of truth. Username is a display label.
   X-verified identity wins everywhere: chat, sidebar, profile,
   rankings.

   v7 changes
   ──────────
   • Persists byWallet → localStorage on every remember()
   • Synchronously hydrates byWallet at module init, BEFORE
     script.js / profile-system.js run
   • Sets window.__msnIdentityReady so a boot gate can release
   • Everything else identical to v6

   Requires load order:
     wallet-identity.js  ←  you are here (must be FIRST)
     script.js
     profile-system.js
     x-auth.js
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';
    var PROFILE_COLS =
        'wallet_address, username, display_name, avatar_url, ' +
        'x_handle, x_verified, x_avatar_url';

    var CACHE_KEY = 'msn_identity_cache';

    function getSB() {
        if (window.MSN && window.MSN.supabase) return window.MSN.supabase;
        if (window.supabase && window.supabase.createClient) {
            window.MSN = window.MSN || {};
            window.MSN.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window.MSN.supabase;
        }
        return null;
    }
    function esc(t) {
        return String(t == null ? '' : t)
            .replace(/[&<>"']/g, function (m) {
                return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m];
            });
    }
    function isWalletLike(s) {
        return typeof s === 'string'
            && s.length >= 32 && s.length <= 48
            && !/\s/.test(s);
    }
    function myWallet() {
        try { return localStorage.getItem('msn_cached_wallet') || null; } catch (e) { return null; }
    }
    function myStoredUsername() {
        try { return (localStorage.getItem('msn_chat_username') || '').trim(); } catch (e) { return ''; }
    }

    var byWallet = Object.create(null);
    var byUsername = Object.create(null);

    /* ═══════════════════════════════════════════════════════
       PERSISTENCE — snapshot the cache to localStorage so the
       next boot can paint verified names/avatars immediately.
       ═══════════════════════════════════════════════════════ */
    var _hydrating    = false;
    var _persistTimer = null;

       function persistNow() {
        try {
            var snap = {};
            var now  = Date.now();
            for (var w in byWallet) {
                var p = byWallet[w];
                if (!p) continue;
                snap[w] = {
                    wallet_address: w,
                    username:       p.username     || null,
                    display_name:   p.display_name || null,
                    avatar_url:     p.avatar_url   || null,
                    x_handle:       p.x_handle     || null,
                    x_verified:     !!p.x_verified,
                    x_avatar_url:   p.x_avatar_url || null,
                    cached_at:      now
                };
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
        } catch (e) { /* quota / disabled storage — ignore */ }
    }
    function schedulePersist() {
        if (_hydrating) return;                 // don't echo the hydrate pass
        clearTimeout(_persistTimer);
        _persistTimer = setTimeout(persistNow, 200);
    }

    /* ═══════════════════════════════════════════════════════
       IDENTITY RESOLUTION
       ═══════════════════════════════════════════════════════ */
    function displayNameFor(profile) {
        if (!profile) return null;
        if (profile.x_verified) {
            return profile.display_name
                || (profile.x_handle ? '@' + profile.x_handle : null)
                || profile.username
                || null;
        }
        return profile.display_name || profile.username || null;
    }
    function avatarFor(profile) {
        if (!profile) return null;
        if (profile.x_verified) return profile.x_avatar_url || null;
        return profile.avatar_url || profile.x_avatar_url || null;
    }

    function rememberProfile(p) {
        if (!p || !p.wallet_address) return;
        var prev = byWallet[p.wallet_address] || {};
        // ⚑ Treat null AND undefined the same — never wipe a good cached
        //   value with a partial update. Only overwrite when the incoming
        //   field actually has content.
        var next = {
            username:     (p.username     != null) ? p.username     : prev.username,
            display_name: (p.display_name != null) ? p.display_name : prev.display_name,
            avatar_url:   (p.avatar_url   != null) ? p.avatar_url   : prev.avatar_url,
            x_handle:     (p.x_handle     != null) ? p.x_handle     : prev.x_handle,
            x_verified:   (p.x_verified   != null) ? !!p.x_verified : prev.x_verified,
            x_avatar_url: (p.x_avatar_url != null) ? p.x_avatar_url : prev.x_avatar_url
        };
        byWallet[p.wallet_address] = next;
        if (p.username) byUsername[p.username] = p.wallet_address;
        schedulePersist();

        var changed =
            prev.username     !== next.username     ||
            prev.display_name !== next.display_name ||
            prev.avatar_url   !== next.avatar_url   ||
            prev.x_handle     !== next.x_handle     ||
            prev.x_verified   !== next.x_verified   ||
            prev.x_avatar_url !== next.x_avatar_url;

        if (changed && !_hydrating) {
            try {
                document.dispatchEvent(new CustomEvent('msn:identity-changed', {
                    detail: { wallet: p.wallet_address, profile: next }
                }));
            } catch (e) {}
        }
    }

    function resolve(x) {
        if (!x || typeof x !== 'string') return null;
        var wallet = null;
        if (isWalletLike(x)) wallet = x;
        else if (byUsername[x]) wallet = byUsername[x];
        if (!wallet || !byWallet[wallet]) return null;
        var p = byWallet[wallet];
        return {
            wallet:      wallet,
            username:    p.username || null,
            displayName: displayNameFor(p) || p.username || null,
            avatar:      avatarFor(p),
            x_verified:  !!p.x_verified
        };
    }

    function labelForWallet(wallet) {
        if (!wallet) return null;
        return displayNameFor(byWallet[wallet]);
    }
    function labelForUsername(username) {
        var w = byUsername[username];
        return w ? labelForWallet(w) : username;
    }
    function isValidLabel(label) { return !!label && label !== 'anon'; }

    /* ═══════════════════════════════════════════════════════
       Every label the connected user could appear under
       ═══════════════════════════════════════════════════════ */
    function myLabels() {
        var labels = new Set();
        var u = myStoredUsername().toLowerCase();
        if (u) labels.add(u);
        var w = myWallet();
        if (w) {
            var p = byWallet[w];
            if (p) {
                var n1 = displayNameFor(p);
                if (n1) labels.add(String(n1).trim().toLowerCase());
                if (p.username) labels.add(String(p.username).trim().toLowerCase());
                if (p.x_handle) labels.add('@' + String(p.x_handle).trim().toLowerCase());
            }
        }
        return labels;
    }

    /* ═══════════════════════════════════════════════════════
       DOM PROPAGATION — chat
       ═══════════════════════════════════════════════════════ */
    function updateMessagesFor(wallet, profile) {
        if (!wallet) return;
        var label = displayNameFor(profile);
        var avatar = avatarFor(profile);
        document.querySelectorAll('.msg-wrapper[data-wallet="' + CSS.escape(wallet) + '"]')
            .forEach(function (w) {
                var unameEl = w.querySelector('.msg-username');
                if (unameEl && isValidLabel(label)) {
                    for (var i = 0; i < unameEl.childNodes.length; i++) {
                        var n = unameEl.childNodes[i];
                        if (n.nodeType === 3 && n.nodeValue.trim()) {
                            n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), label);
                            break;
                        }
                    }
                    var link = unameEl.querySelector('.msn-username-link');
                    if (link) link.textContent = label;
                }
                if (avatar) {
                    var avatarEl = w.querySelector('.msg-avatar');
                    if (avatarEl) {
                        var img = avatarEl.querySelector('img');
                        if (!img) avatarEl.innerHTML = '<img src="' + esc(avatar) + '" alt="">';
                        else img.src = avatar;
                    }
                }
            });
    }

    /* ═══════════════════════════════════════════════════════
       DOM PROPAGATION — sidebar
       ═══════════════════════════════════════════════════════ */
    function updateSidebarFor(wallet, profile) {
        if (!wallet) return;
        var label = displayNameFor(profile);
        var avatar = avatarFor(profile);
        document.querySelectorAll('.sidebar-user-item[data-wallet="' + CSS.escape(wallet) + '"]')
            .forEach(function (item) {
                if (isValidLabel(label)) item.setAttribute('data-username', label);
                var nameEl = item.querySelector('.user-name');
                if (nameEl && isValidLabel(label)) {
                    for (var i = 0; i < nameEl.childNodes.length; i++) {
                        var n = nameEl.childNodes[i];
                        if (n.nodeType === 3 && n.nodeValue.trim()) {
                            n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), label);
                            break;
                        }
                    }
                }
                if (avatar) {
                    var av = item.querySelector('.user-avatar');
                    if (av) {
                        var img = av.querySelector('img');
                        if (!img) av.insertAdjacentHTML('afterbegin', '<img src="' + esc(avatar) + '" alt="">');
                        else img.src = avatar;
                    }
                }
            });
    }

    /* ═══════════════════════════════════════════════════════
       DOM PROPAGATION — rankings
       ═══════════════════════════════════════════════════════ */
    function applyProfileToRankRow(row, p) {
        if (!row || !p) return;
        var nameEl = row.querySelector('.rank-name');
        var label = displayNameFor(p);
        if (nameEl && isValidLabel(label)) nameEl.textContent = label;

        var avatar = avatarFor(p);
        if (avatar) {
            var av = row.querySelector('.rank-avatar');
            if (av) {
                if (av.tagName === 'IMG') {
                    av.src = avatar;
                } else {
                    var img = document.createElement('img');
                    img.className = 'rank-avatar';
                    img.src = avatar;
                    img.alt = '';
                    img.loading = 'lazy';
                    av.replaceWith(img);
                }
            }
        }
        row.setAttribute('data-x-verified', p.x_verified ? '1' : '0');
    }

    function updateRankRowsFor(wallet, profile) {
        if (!wallet) return;
        document.querySelectorAll('.rank-row[data-wallet="' + CSS.escape(wallet) + '"]')
            .forEach(function (row) { applyProfileToRankRow(row, profile); });
    }

    /* ═══════════════════════════════════════════════════════
       OWNERSHIP — wallet first, then label match
       ═══════════════════════════════════════════════════════ */
    function extractUsernameFromNode(nameEl) {
        if (!nameEl) return '';
        var link = nameEl.querySelector('.msn-username-link');
        if (link) return link.textContent.trim();
        for (var i = 0; i < nameEl.childNodes.length; i++) {
            var n = nameEl.childNodes[i];
            if (n.nodeType === 3 && n.nodeValue.trim()) return n.nodeValue.trim();
        }
        return '';
    }

    function ensureOwnClass(root) {
        var w = myWallet();
        var scope = root || document;

        // If no wallet yet, fall back to label match only
        var labels = myLabels();

        scope.querySelectorAll('.msg-wrapper').forEach(function (el) {
            if (el.classList.contains('own')) return;

            // 1. Wallet match — bulletproof
            if (w) {
                var elWallet = el.getAttribute('data-wallet');
                if (elWallet && elWallet === w) {
                    el.classList.add('own');
                    return;
                }
            }

            // 2. Label match — visible name is a known label
            var nameEl = el.querySelector('.msg-username');
            if (!nameEl) return;
            var visible = extractUsernameFromNode(nameEl).trim().toLowerCase();
            if (!visible) return;

            if (labels.has(visible)) {
                el.classList.add('own');
                return;
            }

            // 3. Resolve visible name to a wallet and compare
            var r = resolve(visible);
            if (r && w && r.wallet === w) {
                el.classList.add('own');
                return;
            }

            // 4. Case-insensitive scan of byUsername
            if (w) {
                for (var uname in byUsername) {
                    if (String(uname).toLowerCase() === visible) {
                        if (byUsername[uname] === w) el.classList.add('own');
                        return;
                    }
                }
            }
        });
    }

    /* ═══════════════════════════════════════════════════════
       SIDEBAR — exactly one entry for the connected wallet
       ═══════════════════════════════════════════════════════ */
    function ensureSingleSelf() {
        var sidebarUsers = document.getElementById('sidebarUsers');
        if (!sidebarUsers) return;

        var w = myWallet();
        var labels = myLabels();

        var matches = [];
        sidebarUsers.querySelectorAll('.sidebar-user-item').forEach(function (item) {
            var itemWallet = item.getAttribute('data-wallet') || '';
            var itemName = (item.getAttribute('data-username') || '').trim().toLowerCase();

            var isSelf = false;
            if (w && itemWallet && itemWallet === w) isSelf = true;
            else if (labels.has(itemName)) isSelf = true;

            if (isSelf) matches.push(item);
        });

        if (matches.length <= 1) return;

        // Prefer the row that already carries .you-tag (the app's own render)
        var keeper = null;
        for (var i = 0; i < matches.length; i++) {
            if (matches[i].classList.contains('you-tag')) { keeper = matches[i]; break; }
        }
        if (!keeper) keeper = matches[0];

        for (var j = 0; j < matches.length; j++) {
            if (matches[j] !== keeper) matches[j].remove();
        }
    }

    function updateSelfBlock(profile) {
        if (!profile) return;
        var label = displayNameFor(profile);
        var avatar = avatarFor(profile);
        var bigName = document.getElementById('sidebarBigName');
        var bigAv = document.getElementById('sidebarBigAvatar');
        if (bigName && isValidLabel(label)) bigName.textContent = label;
        if (bigAv && avatar) bigAv.innerHTML = '<img src="' + esc(avatar) + '" alt="">';
    }

    /* ═══════════════════════════════════════════════════════
       MASTER PROPAGATE
       ═══════════════════════════════════════════════════════ */
    function propagateProfile(wallet, profile) {
        rememberProfile(profile);

        updateMessagesFor(wallet, profile);
        updateSidebarFor(wallet, profile);
        updateRankRowsFor(wallet, profile);
        ensureOwnClass();
        ensureSingleSelf();

        try {
            var cached = localStorage.getItem('msn_cached_wallet');
            if (cached && cached === wallet) {
                if (profile.username) {
                    localStorage.setItem('msn_chat_username', profile.username);
                    localStorage.setItem('msn_last_username', profile.username);
                }
                updateSelfBlock(profile);
            }
        } catch (e) {}

        try {
            document.dispatchEvent(new CustomEvent('msn:identity-changed', {
                detail: { wallet: wallet, profile: byWallet[wallet] || null }
            }));
        } catch (e) {}
    }

    /* ═══════════════════════════════════════════════════════
       ENRICHMENT
       ═══════════════════════════════════════════════════════ */
    function enrichRow(row) {
        if (!row) return row;
        var wallet = row.wallet_address;
        if (!wallet && row.username && byUsername[row.username]) {
            wallet = byUsername[row.username];
        }
        if (!wallet) return row;
        var p = byWallet[wallet];
        if (!p) return row;

        var out = {};
        for (var k in row) {
            if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
        }

        if (p.x_verified) {
            var xName = displayNameFor(p);
            if (xName) out.username = xName;
            if (p.x_avatar_url) out.avatar_url = p.x_avatar_url;
        } else {
            if (out.username == null && p.username) out.username = p.username;
            if (out.avatar_url == null && p.avatar_url) out.avatar_url = p.avatar_url;
        }

        if (out.wallet_address == null) out.wallet_address = wallet;
        out.x_verified = !!p.x_verified;
        return out;
    }
    function enrichRows(rows) {
        if (!rows || !rows.length) return rows || [];
        return rows.map(enrichRow);
    }

    /* ═══════════════════════════════════════════════════════
       SUPABASE FETCHERS
       ═══════════════════════════════════════════════════════ */
    async function fetchFreshProfile(wallet) {
        var sb = getSB();
        if (!sb || !wallet) return null;
        var { data } = await sb.from('profiles')
            .select(PROFILE_COLS)
            .eq('wallet_address', wallet).maybeSingle();
        if (data) { rememberProfile(data); return data; }
        return null;
    }

    async function fetchProfile(wallet, force) {
        if (!wallet) return null;
        if (!force && byWallet[wallet] && byWallet[wallet].username) {
            return byWallet[wallet];
        }
        return fetchFreshProfile(wallet);
    }

    async function fetchProfilesFor(wallets) {
        var sb = getSB();
        if (!sb || !wallets || !wallets.length) return [];
        var unique = Array.from(new Set(wallets.filter(Boolean)));
        var { data } = await sb.from('profiles')
            .select(PROFILE_COLS)
            .in('wallet_address', unique);
        (data || []).forEach(rememberProfile);
        return data || [];
    }

    /* ═══════════════════════════════════════════════════════
       RANKINGS REFRESH
       ═══════════════════════════════════════════════════════ */
    var _rankRefreshTimer = null;
    function scheduleRankRefresh() {
        clearTimeout(_rankRefreshTimer);
        _rankRefreshTimer = setTimeout(refreshRankProfiles, 120);
    }

    async function refreshRankProfiles() {
        var sb = getSB();
        if (!sb) return;
        var overlay = document.getElementById('rankingsOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;

        var wallets = new Set();
        overlay.querySelectorAll('.rank-row[data-wallet]').forEach(function (r) {
            var w = r.getAttribute('data-wallet');
            if (w) wallets.add(w);
        });
        if (!wallets.size) return;

        var list = Array.from(wallets);
        for (var i = 0; i < list.length; i += 20) {
            var slice = list.slice(i, i + 20);
            var { data } = await sb.from('profiles')
                .select(PROFILE_COLS)
                .in('wallet_address', slice);
            (data || []).forEach(function (p) {
                rememberProfile(p);
                overlay.querySelectorAll('.rank-row[data-wallet="' + CSS.escape(p.wallet_address) + '"]')
                    .forEach(function (row) { applyProfileToRankRow(row, p); });
            });
        }
    }

    function watchRankingsOverlay() {
        var overlay = document.getElementById('rankingsOverlay');
        if (!overlay) { setTimeout(watchRankingsOverlay, 400); return; }

        var wasHidden = overlay.classList.contains('hidden');

        var mo = new MutationObserver(function () {
            var isHidden = overlay.classList.contains('hidden');
            if (wasHidden && !isHidden) {
                scheduleRankRefresh();
                setTimeout(scheduleRankRefresh, 400);
            }
            wasHidden = isHidden;
        });
        mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });

        var listMo = new MutationObserver(function () {
            if (overlay.classList.contains('hidden')) return;
            scheduleRankRefresh();
        });
        listMo.observe(overlay, { childList: true, subtree: true });
    }

    /* ═══════════════════════════════════════════════════════
       PRELOAD SELF
       ═══════════════════════════════════════════════════════ */
    async function preloadSelfProfile() {
        var w = myWallet();
        if (!w) return;
        var p = await fetchFreshProfile(w);
        if (!p) return;
        propagateProfile(w, p);
        ensureOwnClass();
        ensureSingleSelf();
    }

    /* ═══════════════════════════════════════════════════════
       RENAME
       ═══════════════════════════════════════════════════════ */
    async function setUsernameForWallet(wallet, newName) {
        var sb = getSB();
        if (!sb || !wallet || !newName) return { error: 'bad_input' };

        var { data: conflict } = await sb.from('profiles')
            .select('wallet_address').eq('username', newName).maybeSingle();

        if (conflict && conflict.wallet_address && conflict.wallet_address !== wallet) {
            return { error: 'username_taken' };
        }

        var { data: updated, error: updateErr } = await sb.from('profiles')
            .update({ username: newName, updated_at: new Date().toISOString() })
            .eq('wallet_address', wallet)
            .select()
            .maybeSingle();

        if (updateErr) return { error: updateErr.message };

        if (!updated) {
            var { data: inserted, error: insertErr } = await sb.from('profiles')
                .insert({ wallet_address: wallet, username: newName })
                .select()
                .single();
            if (insertErr) return { error: insertErr.message };
            updated = inserted;
        }

        propagateProfile(wallet, updated);
        return { data: updated };
    }

    /* ═══════════════════════════════════════════════════════
       REALTIME PROFILES
       ═══════════════════════════════════════════════════════ */
    function subscribeProfiles() {
        var sb = getSB();
        if (!sb) return;
        if (window.MSN && window.MSN._profileChannel) {
            sb.removeChannel(window.MSN._profileChannel);
        }
        var channel = sb.channel('msn-profiles')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                function (payload) {
                    var row = payload.new || payload.old;
                    if (!row || !row.wallet_address) return;

                    if (row.username === undefined || row.username === null) {
                        fetchProfile(row.wallet_address, true).then(function (full) {
                            if (full) propagateProfile(row.wallet_address, full);
                        });
                        return;
                    }
                    var prev = byWallet[row.wallet_address];
                    var changed = !prev
                        || prev.display_name !== row.display_name
                        || prev.avatar_url   !== row.avatar_url
                        || prev.x_handle     !== row.x_handle
                        || prev.x_verified   !== row.x_verified
                        || prev.x_avatar_url !== row.x_avatar_url;

                    if (changed) {
                        propagateProfile(row.wallet_address, row);
                    }
                    scheduleRankRefresh();
                })
            .subscribe();
        window.MSN = window.MSN || {};
        window.MSN._profileChannel = channel;
    }

    var _pendingWallets = new Set();
    var _pendingFlush = null;

    function _flushWalletBatch() {
        _pendingFlush = null;
        var list = Array.from(_pendingWallets);
        _pendingWallets.clear();
        if (!list.length) return;
        fetchProfilesFor(list).then(function (rows) {
            rows.forEach(function (p) {
                updateMessagesFor(p.wallet_address, p);
            });
        });
    }

    function processWrapper(wrap) {
        if (!wrap) return;

        var wallet = wrap.dataset.wallet;
        if (!wallet) {
            var nameEl = wrap.querySelector('.msg-username');
            var name = extractUsernameFromNode(nameEl);
            if (name && byUsername[name]) wallet = byUsername[name];
        }

        if (wallet) {
            var p = byWallet[wallet];
            if (p) updateMessagesFor(wallet, p);
            else {
                _pendingWallets.add(wallet);
                if (!_pendingFlush) _pendingFlush = setTimeout(_flushWalletBatch, 30);
            }
        }

        var parent = wrap.parentNode;
        if (parent) ensureOwnClass(parent);
    }

    function tagMessageWrappers() {
        ['publicMessagesContainer', 'privateMessagesContainer'].forEach(function (id) {
            var root = document.getElementById(id);
            if (!root) return;
            var mo = new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        if (node.classList && node.classList.contains('msg-wrapper')) {
                            processWrapper(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('.msg-wrapper').forEach(processWrapper);
                        }
                    });
                });
                ensureOwnClass(root);
            });
            mo.observe(root, { childList: true, subtree: true });
        });
    }

    /* ═══════════════════════════════════════════════════════
       SIDEBAR OBSERVER — dedup on every render
       ═══════════════════════════════════════════════════════ */
    function watchSidebar() {
        var users = document.getElementById('sidebarUsers');
        if (!users) { setTimeout(watchSidebar, 500); return; }
        var mo = new MutationObserver(function () {
            ensureSingleSelf();
        });
        mo.observe(users, { childList: true, subtree: false });
    }

    /* ═══════════════════════════════════════════════════════
       DOM SEED
       ═══════════════════════════════════════════════════════ */
    async function seedFromDOM() {
        var names = new Set();
        document.querySelectorAll('.msg-username, .sidebar-user-item[data-username]')
            .forEach(function (el) {
                var name = extractUsernameFromNode(el);
                if (name && name !== 'anon') names.add(name);
            });
        if (!names.size) { ensureOwnClass(); ensureSingleSelf(); return; }
        var sb = getSB();
        if (!sb) { ensureOwnClass(); ensureSingleSelf(); return; }
        var { data } = await sb.from('profiles')
            .select(PROFILE_COLS)
            .in('username', Array.from(names));
        (data || []).forEach(function (p) {
            rememberProfile(p);
            document.querySelectorAll('.msg-wrapper, .sidebar-user-item').forEach(function (el) {
                var txt = (el.textContent || '').trim();
                if (txt.indexOf(p.username) === 0 && !el.dataset.wallet) {
                    el.dataset.wallet = p.wallet_address;
                }
            });
            updateMessagesFor(p.wallet_address, p);
            updateSidebarFor(p.wallet_address, p);
        });
        ensureOwnClass();
        ensureSingleSelf();
    }

    /* ═══════════════════════════════════════════════════════
       PUBLIC API
       ═══════════════════════════════════════════════════════ */
    window.MSNIdentity = {
        labelForWallet:       labelForWallet,
        labelForUsername:     labelForUsername,
        fetchProfile:         fetchProfile,
        fetchProfilesFor:     fetchProfilesFor,
        setUsernameForWallet: setUsernameForWallet,
        propagateProfile:     propagateProfile,
        byWallet:             function () { return byWallet; },
        byUsername:           function () { return byUsername; },

        resolve:              resolve,
        remember:             rememberProfile,
        enrichRow:            enrichRow,
        enrichRows:           enrichRows,
        displayNameFor:       displayNameFor,
        avatarFor:            avatarFor,
        ensureOwnClass:       ensureOwnClass,
        ensureSingleSelf:     ensureSingleSelf,
        refreshRankProfiles:  refreshRankProfiles,

        // v7: debug + manual controls
        persistNow:           persistNow,
        clearCache:           function () {
            try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
        }
    };

    /* ═══════════════════════════════════════════════════════
       BOOT
       ═══════════════════════════════════════════════════════ */
    function boot() {
        subscribeProfiles();
        tagMessageWrappers();
        watchRankingsOverlay();
        watchSidebar();

        preloadSelfProfile();
        setTimeout(preloadSelfProfile, 800);
        setTimeout(preloadSelfProfile, 2500);

        setTimeout(seedFromDOM, 1200);
        setTimeout(seedFromDOM, 3000);
        setTimeout(seedFromDOM, 5500);

        // Safety net — runs 30s after boot, then stops.
        var _safetyTicks = 0;
        var _safetyTimer = setInterval(function () {
            ensureOwnClass();
            ensureSingleSelf();
            if (++_safetyTicks >= 15) clearInterval(_safetyTimer);
        }, 2000);

        document.addEventListener('msn:app-ready', function () {
            _safetyTicks = 0;
            if (!_safetyTimer) {
                _safetyTimer = setInterval(function () {
                    ensureOwnClass();
                    ensureSingleSelf();
                    if (++_safetyTicks >= 15) {
                        clearInterval(_safetyTimer);
                        _safetyTimer = null;
                    }
                }, 2000);
            }
        }, { once: true });
    }

    /* ═══════════════════════════════════════════════════════
       SYNCHRONOUS HYDRATE — runs BEFORE boot()
       Pulls the last session's identity from localStorage so
       script.js's first resolve() already sees X data.
       ═══════════════════════════════════════════════════════ */
        (function hydrateFromStorage() {
        _hydrating = true;
        var hydratedCount = 0;
        var skippedCount  = 0;
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                var snap = JSON.parse(raw);
                var now  = Date.now();
                // ⚑ Skip entries older than 5 minutes — they're likely stale.
                //   script.js's first render will pick up the fresh fetch.
                var MAX_AGE_MS = 5 * 60 * 1000;
                for (var w in snap) {
                    var p = snap[w];
                    if (!p) continue;
                    if (p.cached_at && (now - p.cached_at) > MAX_AGE_MS) {
                        skippedCount++;
                        continue;
                    }
                    rememberProfile(p);
                    hydratedCount++;
                }
                console.log('[wallet-identity] hydrated', hydratedCount,
                    'profiles from cache (skipped', skippedCount, 'stale)');
            }
        } catch (e) {
            console.warn('[wallet-identity] hydrate failed:', e);
        }
        _hydrating = false;
        window.__msnIdentityReady = true;
    })();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    console.log('[wallet-identity] loaded v7 (persist + hydrate)');
})();
