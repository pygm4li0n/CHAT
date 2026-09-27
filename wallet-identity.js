/* ═══════════════════════════════════════════════════════════
   wallet-identity.js — v5
   ───────────────────────────────────────────────────────────
   Wallet is the source of truth. Username is a display label.
   X-verified identity (display_name / x_handle / x_avatar_url)
   wins everywhere: chat, sidebar, profile card, rankings.

   v5 fixes
   ────────
   • Preloads the connected user's full profile at boot so ranks,
     messages and sidebar have X data before anything renders.
   • Watches the rankings overlay — on open, batch-fetches fresh
     profiles for every data-wallet on screen, then re-enriches
     the rows with X names and X avatars.
   • Message wrappers: aggressive .own enforcement (mutation +
     interval + username-match fallback) so sent stickers and
     text never render on the left after refresh.
   • rememberProfile: !== undefined guards.
   • displayNameFor / avatarFor: X-verified → X-only, no flicker.
   • enrichRow: RPC wins; cache fills gaps; X wins over both.
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    var PROFILE_COLS =
        'wallet_address, username, display_name, avatar_url, ' +
        'x_handle, x_verified, x_avatar_url';

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

    var byWallet = Object.create(null);
    var byUsername = Object.create(null);

    /* ═══════════════════════════════════════════════════════
       IDENTITY RESOLUTION — X wins when verified
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

    /* ═══════════════════════════════════════════════════════
       CACHE — merge only, never blank
       ═══════════════════════════════════════════════════════ */
    function rememberProfile(p) {
        if (!p || !p.wallet_address) return;
        var prev = byWallet[p.wallet_address] || {};
        byWallet[p.wallet_address] = {
            username:     (p.username     !== undefined) ? p.username     : prev.username,
            display_name: (p.display_name !== undefined) ? p.display_name : prev.display_name,
            avatar_url:   (p.avatar_url   !== undefined) ? p.avatar_url   : prev.avatar_url,
            x_handle:     (p.x_handle     !== undefined) ? p.x_handle     : prev.x_handle,
            x_verified:   (p.x_verified   !== undefined) ? !!p.x_verified : prev.x_verified,
            x_avatar_url: (p.x_avatar_url !== undefined) ? p.x_avatar_url : prev.x_avatar_url
        };
        if (p.username) byUsername[p.username] = p.wallet_address;
    }

    /* ═══════════════════════════════════════════════════════
       CANONICAL RESOLVER
       ═══════════════════════════════════════════════════════ */
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
       DOM PROPAGATION — ranking rows
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
       OWNERSHIP — ensure .own on any message that is mine
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
        if (!w) return;
        var scope = root || document;
        // 1. Wallet match
        scope.querySelectorAll('.msg-wrapper[data-wallet="' + CSS.escape(w) + '"]:not(.own)')
            .forEach(function (el) { el.classList.add('own'); });

        // 2. Username match (fallback — older messages may lack data-wallet)
        var myName = '';
        try { myName = (localStorage.getItem('msn_chat_username') || '').trim(); } catch (e) {}
        if (!myName) return;
        scope.querySelectorAll('.msg-wrapper:not(.own)').forEach(function (el) {
            var nameEl = el.querySelector('.msg-username');
            if (!nameEl) return;
            if (extractUsernameFromNode(nameEl) === myName) {
                el.classList.add('own');
            }
        });
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
       Stores DB username in localStorage — never the display
       label — so script.js and stickers.js compose payloads
       with the correct sender key.
       ═══════════════════════════════════════════════════════ */
    function propagateProfile(wallet, profile) {
        rememberProfile(profile);

        updateMessagesFor(wallet, profile);
        updateSidebarFor(wallet, profile);
        updateRankRowsFor(wallet, profile);
        ensureOwnClass();

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
       ENRICHMENT — RPC wins, cache fills gaps, X wins over both
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
       RANKINGS REFRESH — pull fresh profiles, re-enrich rows
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
                // Just opened — refresh twice to catch both fast and slow renders
                scheduleRankRefresh();
                setTimeout(scheduleRankRefresh, 400);
            }
            wasHidden = isHidden;
        });
        mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });

        // Also observe row insertion (rows are injected after open)
        var listMo = new MutationObserver(function () {
            if (overlay.classList.contains('hidden')) return;
            scheduleRankRefresh();
        });
        listMo.observe(overlay, { childList: true, subtree: true });
    }

    /* ═══════════════════════════════════════════════════════
       PRELOAD SELF — populate cache with full profile at boot
       ═══════════════════════════════════════════════════════ */
    async function preloadSelfProfile() {
        var w = myWallet();
        if (!w) return;
        var p = await fetchFreshProfile(w);
        if (!p) return;
        propagateProfile(w, p);
        try {
            var meName = p.username;
            if (meName) {
                localStorage.setItem('msn_chat_username', meName);
                localStorage.setItem('msn_last_username', meName);
            }
        } catch (e) {}
        ensureOwnClass();
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
                    propagateProfile(row.wallet_address, row);
                    // If any rank row is currently on screen, refresh it too
                    scheduleRankRefresh();
                })
            .subscribe();
        window.MSN = window.MSN || {};
        window.MSN._profileChannel = channel;
    }

    /* ═══════════════════════════════════════════════════════
       DOM OBSERVERS — messages
       ═══════════════════════════════════════════════════════ */
    function processWrapper(wrap) {
        if (!wrap) return;

        var wallet = wrap.dataset.wallet;
        if (!wallet) {
            // Try to infer wallet from the username
            var nameEl = wrap.querySelector('.msg-username');
            var name = extractUsernameFromNode(nameEl);
            if (name && byUsername[name]) wallet = byUsername[name];
        }

        if (wallet) {
            var p = byWallet[wallet];
            if (p) {
                updateMessagesFor(wallet, p);
            } else {
                fetchFreshProfile(wallet).then(function (fresh) {
                    if (fresh) updateMessagesFor(wallet, fresh);
                });
            }
        }

        // Ownership enforcement on the wrapper's parent
        var parent = wrap.parentNode;
        if (parent) {
            ensureOwnClass(parent);
        }
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
                // After any batch, enforce ownership across the whole container
                ensureOwnClass(root);
            });
            mo.observe(root, { childList: true, subtree: true });
        });
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
        if (!names.size) { ensureOwnClass(); return; }
        var sb = getSB();
        if (!sb) { ensureOwnClass(); return; }
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
        refreshRankProfiles:  refreshRankProfiles
    };

    /* ═══════════════════════════════════════════════════════
       BOOT
       ═══════════════════════════════════════════════════════ */
    function boot() {
        subscribeProfiles();
        tagMessageWrappers();
        watchRankingsOverlay();

        // Preload self profile as soon as we know the wallet
        preloadSelfProfile();
        setTimeout(preloadSelfProfile, 800);
        setTimeout(preloadSelfProfile, 2500);

        // Seed from DOM a few times — catches early renders
        setTimeout(seedFromDOM, 1200);
        setTimeout(seedFromDOM, 3000);
        setTimeout(seedFromDOM, 5500);

        // Ownership safety net — wallets may connect after boot
        setInterval(ensureOwnClass, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    console.log('[wallet-identity] loaded v5');
})();
