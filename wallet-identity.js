/* ═══════════════════════════════════════════════════════════
   wallet-identity.js — v3
   ───────────────────────────────────────────────────────────
   Wallet is the source of truth. Username is a display label.
   X-verified identity (display_name / x_handle / x_avatar_url)
   wins everywhere: chat, sidebar, profile card, rankings.

   v3 additions
   ────────────
   • MSNIdentity.resolve(nameOrWallet)
       → { wallet, username, displayName, avatar, x_verified }
   • MSNIdentity.remember(profileRow)    → cache only, no DOM
   • MSNIdentity.enrichRow / enrichRows  → apply to rank rows
   • propagateProfile also updates .rank-row[data-wallet]
   • Dispatches 'msn:identity-changed' on every propagation

   v2 fixes retained
   ─────────────────
   • rememberProfile MERGES — survives partial realtime payloads.
   • displayNameFor never invents "anon".
   • subscribeProfiles refetches the full row on partial payloads.
   • updateMessagesFor / updateSidebarFor hard-guard against
     writing "anon" over existing labels.
   • setUsernameForWallet keys purely on wallet_address.
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
    /* Solana base58 addresses: 32–48 chars, no whitespace. */
    function isWalletLike(s) {
        return typeof s === 'string'
            && s.length >= 32 && s.length <= 48
            && !/\s/.test(s);
    }

    var byWallet = Object.create(null);
    var byUsername = Object.create(null);

    function displayNameFor(profile) {
        if (!profile) return null;
        if (profile.x_verified) {
            if (profile.display_name) return profile.display_name;
            if (profile.x_handle) return '@' + profile.x_handle;
        }
        return profile.display_name || profile.username || null;
    }
    function avatarFor(profile) {
        if (!profile) return null;
        if (profile.x_verified && profile.x_avatar_url) return profile.x_avatar_url;
        return profile.avatar_url || profile.x_avatar_url || null;
    }

    function rememberProfile(p) {
        if (!p || !p.wallet_address) return;
        var prev = byWallet[p.wallet_address] || {};
        byWallet[p.wallet_address] = {
            username:     ('username'     in p) ? p.username     : prev.username,
            display_name: ('display_name' in p) ? p.display_name : prev.display_name,
            avatar_url:   ('avatar_url'   in p) ? p.avatar_url   : prev.avatar_url,
            x_handle:     ('x_handle'     in p) ? p.x_handle     : prev.x_handle,
            x_verified:   ('x_verified'   in p) ? !!p.x_verified : prev.x_verified,
            x_avatar_url: ('x_avatar_url' in p) ? p.x_avatar_url : prev.x_avatar_url
        };
        if (p.username) byUsername[p.username] = p.wallet_address;
    }

    /* ═════════════════════════════════════════════════════════
       CANONICAL RESOLVER — single source of truth.
       ═════════════════════════════════════════════════════════ */
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

    /* ⚑ NEW — rankings rows (name + avatar, live) */
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

    function updateSelfBlock(profile) {
        if (!profile) return;
        var label = displayNameFor(profile);
        var avatar = avatarFor(profile);
        var bigName = document.getElementById('sidebarBigName');
        var bigAv = document.getElementById('sidebarBigAvatar');
        if (bigName && isValidLabel(label)) bigName.textContent = label;
        if (bigAv && avatar) bigAv.innerHTML = '<img src="' + esc(avatar) + '" alt="">';
    }

    function propagateProfile(wallet, profile) {
        rememberProfile(profile);

        updateMessagesFor(wallet, profile);
        updateSidebarFor(wallet, profile);
        updateRankRowsFor(wallet, profile);

        try {
            var cached = localStorage.getItem('msn_cached_wallet');
            if (cached && cached === wallet) {
                var label = displayNameFor(profile);
                if (isValidLabel(label)) {
                    localStorage.setItem('msn_chat_username', label);
                    localStorage.setItem('msn_last_username', label);
                }
                updateSelfBlock(profile);
            }
        } catch (e) {}

        /* ⚑ Broadcast: profile card, ranks, anything else can listen */
        try {
            document.dispatchEvent(new CustomEvent('msn:identity-changed', {
                detail: { wallet: wallet, profile: byWallet[wallet] || null }
            }));
        } catch (e) {}
    }

    /* ═════════════════════════════════════════════════════════
       ROW ENRICHMENT — apply identity to arbitrary row objects.
       ═════════════════════════════════════════════════════════ */
    function enrichRow(row) {
        if (!row) return row;
        var wallet = row.wallet_address;
        if (!wallet && row.username && byUsername[row.username]) {
            wallet = byUsername[row.username];
        }
        if (!wallet) return row;
        var p = byWallet[wallet];
        if (!p) return row;

        var dn = displayNameFor(p);
        var av = avatarFor(p);

        var out = {};
        for (var k in row) {
            if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
        }
        if (dn) out.username = dn;
        if (av) out.avatar_url = av;
        out.wallet_address = wallet;
        out.x_verified = !!p.x_verified;
        return out;
    }
    function enrichRows(rows) {
        if (!rows || !rows.length) return rows || [];
        return rows.map(enrichRow);
    }

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
                        if (!wrap || wrap.dataset.wallet) return;
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
        if (!names.size) return;
        var sb = getSB();
        if (!sb) return;
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
    }

    window.MSNIdentity = {
        /* v2 — unchanged */
        labelForWallet:       labelForWallet,
        labelForUsername:     labelForUsername,
        fetchProfile:         fetchProfile,
        fetchProfilesFor:     fetchProfilesFor,
        setUsernameForWallet: setUsernameForWallet,
        propagateProfile:     propagateProfile,
        byWallet:             function () { return byWallet; },
        byUsername:           function () { return byUsername; },

        /* v3 — new */
        resolve:              resolve,
        remember:             rememberProfile,
        enrichRow:            enrichRow,
        enrichRows:           enrichRows,
        displayNameFor:       displayNameFor,
        avatarFor:            avatarFor
    };

    function boot() {
        subscribeProfiles();
        tagMessageWrappers();
        setTimeout(seedFromDOM, 1200);
        setTimeout(seedFromDOM, 3000);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    console.log('[wallet-identity] loaded v3');
})();
