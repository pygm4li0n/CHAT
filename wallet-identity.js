/* ═══════════════════════════════════════════════════════════
   wallet-identity.js — v4
   ───────────────────────────────────────────────────────────
   Wallet is the source of truth. Username is a display label.
   X-verified identity (display_name / x_handle / x_avatar_url)
   wins everywhere: chat, sidebar, profile card, rankings.

   v4 fixes
   ────────
   • propagateProfile writes DB username to msn_chat_username,
     NOT the display label — was making own messages (and
     stickers) render as if from another user.
   • displayNameFor / avatarFor: X-verified → X-only.
     No wallet-stage fallback → no X-avatar/wallet-avatar flicker.
   • rememberProfile uses !== undefined guards so
     {x_verified: undefined} never wipes a valid true.
   • enrichRow: RPC value wins; cache only fills gaps;
     X-verified identity always overrides.
   • ensureOwnClass: forces .own on any .msg-wrapper whose
     data-wallet matches the connected wallet.
   • Real-time propagation updates chat, sidebar, ranks.
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

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
       IDENTITY RESOLUTION
       X-verified → X name + X avatar are the ONLY valid values.
       Non-X → display_name || username; avatar_url || x_avatar_url.
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
        // X-verified: X image is the ONLY source. No wallet-stage fallback,
        // so the old uploaded avatar can never briefly replace the X one.
        if (profile.x_verified) return profile.x_avatar_url || null;
        return profile.avatar_url || profile.x_avatar_url || null;
    }

    /* ═══════════════════════════════════════════════════════
       CACHE — MERGE, don't wipe
       Only overwrite a field when the incoming value is not
       undefined. `'key' in p` is true for `{key: undefined}`,
       which used to blank valid X verification fields.
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
       DOM PROPAGATION — rankings rows
       ═══════════════════════════════════════════════════════ */
    function updateRankRowsFor(wallet, profile) {
        if (!wallet) return;
        var label = displayNameFor(profile);
        var avatar = avatarFor(profile);
        document.querySelectorAll('.rank-row[data-wallet="' + CSS.escape(wallet) + '"]')
            .forEach(function (row) {
                var nameEl = row.querySelector('.rank-name');
                if (nameEl && isValidLabel(label)) nameEl.textContent = label;
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
            });
    }

    /* ═══════════════════════════════════════════════════════
       WALLET-BASED OWNERSHIP ENFORCEMENT
       If a message wrapper carries the connected wallet in
       data-wallet but isn't marked .own, add the class.
       Fixes alignment for messages sent before X verification
       changed the local "username" value.
       ═══════════════════════════════════════════════════════ */
    function ensureOwnClass(root) {
        var w = myWallet();
        if (!w) return;
        (root || document).querySelectorAll(
            '.msg-wrapper[data-wallet="' + CSS.escape(w) + '"]:not(.own)'
        ).forEach(function (el) { el.classList.add('own'); });
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
       Writes DB username (not display label) to localStorage so
       script.js and stickers.js never store the X display name
       as the sender of a message.
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
                // ⚑ Always store the DB username — this is the sender
                //   identifier script.js and stickers.js use when
                //   composing a message payload. Storing the display
                //   label here made new messages compare as "not mine".
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
       ROW ENRICHMENT — RPC wins, cache fills gaps, X wins
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
                })
            .subscribe();
        window.MSN = window.MSN || {};
        window.MSN._profileChannel = channel;
    }

    async function fetchProfile(wallet, force) {
        if (!wallet) return null;
        if (!force && byWallet[wallet] && byWallet[wallet].username) {
            return byWallet[wallet];
        }
        var sb = getSB();
        if (!sb) return null;
        var { data, error } = await sb.from('profiles')
            .select('wallet_address, username, display_name, avatar_url, x_handle, x_verified, x_avatar_url')
            .eq('wallet_address', wallet).maybeSingle();
        if (error || !data) return null;
        rememberProfile(data);
        return data;
    }

    async function fetchProfilesFor(wallets) {
        var sb = getSB();
        if (!sb || !wallets || !wallets.length) return [];
        var unique = Array.from(new Set(wallets.filter(Boolean)));
        var { data } = await sb.from('profiles')
            .select('wallet_address, username, display_name, avatar_url, x_handle, x_verified, x_avatar_url')
            .in('wallet_address', unique);
        (data || []).forEach(rememberProfile);
        return data || [];
    }

    /* ═══════════════════════════════════════════════════════
       DOM OBSERVERS
       ═══════════════════════════════════════════════════════ */
    function tagMessageWrappers() {
        ['publicMessagesContainer', 'privateMessagesContainer'].forEach(function (id) {
            var root = document.getElementById(id);
            if (!root) return;
            var mo = new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        var wrap = node.classList && node.classList.contains('msg-wrapper')
                            ? node : node.querySelector && node.querySelector('.msg-wrapper');
                        if (!wrap) return;

                        // Force .own if data-wallet matches the connected wallet
                        ensureOwnClass(wrap.parentNode || root);

                        if (wrap.dataset.wallet) {
                            var p0 = byWallet[wrap.dataset.wallet];
                            if (p0) updateMessagesFor(wrap.dataset.wallet, p0);
                            return;
                        }
                        var unameEl = wrap.querySelector('.msg-username');
                        if (!unameEl) return;
                        var link = unameEl.querySelector('.msn-username-link');
                        var name = (link ? link.textContent : unameEl.textContent || '').trim().split(/\s+/)[0];
                        var wallet = byUsername[name];
                        if (wallet) {
                            wrap.dataset.wallet = wallet;
                            var p = byWallet[wallet];
                            if (p) updateMessagesFor(wallet, p);
                        }
                    });
                });
            });
            mo.observe(root, { childList: true, subtree: true });
        });
    }

    async function seedFromDOM() {
        var names = new Set();
        document.querySelectorAll('.msg-username, .sidebar-user-item[data-username]').forEach(function (el) {
            var link = el.querySelector && el.querySelector('.msn-username-link');
            var name = (link ? link.textContent : el.textContent || '').trim().split(/\s+/)[0];
            if (name && name !== 'anon') names.add(name);
        });
        if (!names.size) { ensureOwnClass(); return; }
        var sb = getSB();
        if (!sb) { ensureOwnClass(); return; }
        var { data } = await sb.from('profiles')
            .select('wallet_address, username, display_name, avatar_url, x_handle, x_verified, x_avatar_url')
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
        ensureOwnClass:       ensureOwnClass
    };

    function boot() {
        subscribeProfiles();
        tagMessageWrappers();
        setTimeout(seedFromDOM, 1200);
        setTimeout(seedFromDOM, 3000);
        // Safety net — if the DOM settles with a message that should be .own,
        // make sure it gets fixed. Runs once more 6s in.
        setTimeout(ensureOwnClass, 6000);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    console.log('[wallet-identity] loaded v4');
})();
