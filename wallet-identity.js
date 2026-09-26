/* ═══════════════════════════════════════════════════════════
   wallet-identity.js
   ───────────────────────────────────────────────────────────
   • Wallet is the source of truth. Username is a display label.
   • Rename → UPDATE profiles WHERE wallet_address = X
   • Realtime profile changes propagate to messages + sidebar.
   • Presence is deduped by wallet.
   • X auth ready: write x_handle/x_verified/x_avatar_url.
   Load AFTER script.js.

   v2 fixes:
   • rememberProfile MERGES instead of overwriting — survives
     partial realtime payloads that omit `username`.
   • displayNameFor no longer invents "anon".
   • subscribeProfiles fetches the full row when the realtime
     payload is partial, so propagation never writes a blank.
   • updateMessagesFor / updateSidebarFor hard-guard against
     writing "anon" or empty labels over existing text.
   • setUsernameForWallet no longer uses a non-existent `id` col;
     keys purely on wallet_address (the PK in this schema).
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

    var byWallet = Object.create(null);
    var byUsername = Object.create(null);

    /* ─────────────────────────────────────────────────────────
       Display resolution — never invent a name
       ───────────────────────────────────────────────────────── */
    function displayNameFor(profile) {
        if (!profile) return null;
        return profile.display_name
            || (profile.x_verified && profile.x_handle ? '@' + profile.x_handle : null)
            || profile.username
            || null;
    }
    function avatarFor(profile) {
        if (!profile) return null;
        return profile.avatar_url || profile.x_avatar_url || null;
    }

    /* ─────────────────────────────────────────────────────────
       Cache — MERGE incoming fields, never blank existing ones
       ───────────────────────────────────────────────────────── */
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

    function labelForWallet(wallet) {
        if (!wallet) return null;
        return displayNameFor(byWallet[wallet]);
    }
    function labelForUsername(username) {
        var w = byUsername[username];
        return w ? labelForWallet(w) : username;
    }

    /* ─────────────────────────────────────────────────────────
       DOM propagation — guarded against empty / "anon" writes
       ───────────────────────────────────────────────────────── */
    function isValidLabel(label) {
        return !!label && label !== 'anon';
    }

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
    }

    /* ─────────────────────────────────────────────────────────
       Rename — keyed purely on wallet_address (PK in this schema)
       ───────────────────────────────────────────────────────── */
    async function setUsernameForWallet(wallet, newName) {
        var sb = getSB();
        if (!sb || !wallet || !newName) return { error: 'bad_input' };

        // 1. Conflict check — another wallet already owns this name?
        var { data: conflict } = await sb.from('profiles')
            .select('wallet_address').eq('username', newName).maybeSingle();

        if (conflict && conflict.wallet_address && conflict.wallet_address !== wallet) {
            return { error: 'username_taken' };
        }

        // 2. UPDATE by wallet_address (the anchor)
        var { data: updated, error: updateErr } = await sb.from('profiles')
            .update({
                username:   newName,
                updated_at: new Date().toISOString()
            })
            .eq('wallet_address', wallet)
            .select()
            .maybeSingle();

        if (updateErr) return { error: updateErr.message };

        // 3. No row for this wallet yet → insert a fresh profile
        if (!updated) {
            var { data: inserted, error: insertErr } = await sb.from('profiles')
                .insert({
                    wallet_address: wallet,
                    username:       newName
                })
                .select()
                .single();
            if (insertErr) return { error: insertErr.message };
            updated = inserted;
        }

        propagateProfile(wallet, updated);
        return { data: updated };
    }

    /* ─────────────────────────────────────────────────────────
       Realtime — fetch full row when payload is partial
       ───────────────────────────────────────────────────────── */
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

                    // Partial payload (missing username)? Fetch the full row.
                    if (row.username === undefined || row.username === null) {
                        fetchProfile(row.wallet_address, /* force */ true).then(function (full) {
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

    /* ─────────────────────────────────────────────────────────
       Fetch helpers
       ───────────────────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────────────────
       Retro-tag existing DOM
       ───────────────────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────────────────
       Public API
       ───────────────────────────────────────────────────────── */
    window.MSNIdentity = {
        labelForWallet:       labelForWallet,
        labelForUsername:     labelForUsername,
        fetchProfile:         fetchProfile,
        fetchProfilesFor:     fetchProfilesFor,
        setUsernameForWallet: setUsernameForWallet,
        propagateProfile:     propagateProfile,
        byWallet:             function () { return byWallet; },
        byUsername:           function () { return byUsername; }
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
    console.log('[wallet-identity] loaded');
})();
