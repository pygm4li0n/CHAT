/* ═══════════════════════════════════════════════════════════
   rooms.js — Custom token-gated community rooms
   Additive. Does not touch public/private/whale paths.
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.MSNRooms) return;

    var RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=fa7e6515-19de-45de-a7d1-35a64a0d9a1a';
        var SPL_TOKEN_PROGRAM   = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    var TOKEN_2022_PROGRAM  = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

    // ⚑ Main whale token + threshold — must match server-side create_room RPC
    var MAIN_TOKEN_MINT = 'EJjqCJRYs19QDtQRM7QD5vwbdf1XfEysyF5nL1kNpump';
    var WHALE_MIN       = 1000000;

    var roomsCache          = [];
    var activeRoomId        = null;
    var roomPresenceChannel = null;
    var roomMsgChannel      = null;
    var roomMsgStore        = {};       // { msgId: { emoji: { count, users:Set } } }
    var knownRoomMsgIds     = new Set();
    var oldestRoomSort      = null;
    var roomOnlineUsers     = new Map();
    var roomListChannel     = null;
    var _isBootingRooms     = false;
      var pendingSharedRoomId = null;

    // ═══════════════════════════════════════════════════════
    //  TOKEN INFO — DexScreener lookup with 1h cache
    //  Powers card logos, symbol pills, room header, watermark.
    // ═══════════════════════════════════════════════════════
    var tokenInfoCache = new Map();      // mint → { imageUrl, symbol, name, priceUsd, fetchedAt }
    var TOKEN_INFO_TTL = 60 * 60 * 1000;

    async function fetchTokenInfo(mint) {
        if (!mint) return null;

        var cached = tokenInfoCache.get(mint);
        if (cached && (Date.now() - cached.fetchedAt) < TOKEN_INFO_TTL) return cached;

        try {
            var res  = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + mint);
            var json = await res.json();
            var pair = json && json.pairs && json.pairs[0];

            var info = {
                imageUrl:  pair && ((pair.info && pair.info.imageUrl) || (pair.baseToken && pair.baseToken.imageUrl)) || null,
                symbol:    (pair && pair.baseToken && pair.baseToken.symbol) || null,
                name:      (pair && pair.baseToken && pair.baseToken.name)   || null,
                priceUsd:  (pair && pair.priceUsd) || null,
                change24h: (pair && pair.priceChange && pair.priceChange.h24) || null,
                fetchedAt: Date.now()
            };
            tokenInfoCache.set(mint, info);
            return info;
        } catch (e) {
            console.warn('[rooms] token info fetch failed:', mint, e);
            tokenInfoCache.set(mint, { imageUrl: null, symbol: null, fetchedAt: Date.now() });
            return null;
        }
    }

    async function prefetchTokenInfo(mints) {
        var toFetch = (mints || []).filter(function (m) {
            var c = tokenInfoCache.get(m);
            return m && (!c || (Date.now() - c.fetchedAt) >= TOKEN_INFO_TTL);
        });
        if (!toFetch.length) return;

        // 4 at a time to stay under DexScreener's rate limit
        for (var i = 0; i < toFetch.length; i += 4) {
            await Promise.all(toFetch.slice(i, i + 4).map(fetchTokenInfo));
        }
    }

       var _solConnRooms = null;
    function getRoomsConnection() {
        if (_solConnRooms) return _solConnRooms;
        if (!window.solanaWeb3) return null;
        _solConnRooms = new window.solanaWeb3.Connection(RPC_ENDPOINT);
        return _solConnRooms;
    }

    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════
    function getSB() { return window.MSN && window.MSN.supabase; }
    function getWallet() { return window.MSNChat && window.MSNChat.getWalletAddress ? window.MSNChat.getWalletAddress() : null; }
    function getUsername() { return window.MSNChat && window.MSNChat.getSelfUsername ? window.MSNChat.getSelfUsername() : ''; }
        function isRoomCreator(room, wallet) {
        if (!wallet || !room) return false;
        var w = String(wallet).trim();
        if (!w) return false;
        var wLower = w.toLowerCase();
        var candidates = [
            room.creator_wallet,
            room.creator,
            room.created_by,
            room.owner_wallet,
            room.wallet_address
        ];
        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            if (c && String(c).trim().toLowerCase() === wLower) return true;
        }
                return false;
    }

    var MOD_WALLET_ADDR = '4XAqQmEcJW37ZUqDwwAWhuPy7xfQpTJTLoEUwmi51yuj';
    function isModWallet(wallet) {
        var w = wallet || getWallet();
        if (!w) return false;
        return String(w).toLowerCase() === MOD_WALLET_ADDR.toLowerCase();
    }
    function canModifyRoom(room, wallet) {
        return isRoomCreator(room, wallet) || isModWallet(wallet);
    }

        // ── SVG icon set — crisp, no emoji ──
    var ICONS = {
        copy:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        check:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
        trash:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
        lock:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        unlock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
        arrow:  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
        lockSm:   '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"/></svg>',
        unlockSm: '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5h2a3 3 0 1 1 6 0v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5z"/></svg>'
    };

    function formatPrice(p) {
        if (p == null) return null;
        var n = parseFloat(p);
        if (!isFinite(n) || n <= 0) return null;
        if (n >= 1000)   return '$' + n.toFixed(0);
        if (n >= 1)      return '$' + n.toFixed(2);
        if (n >= 0.01)   return '$' + n.toFixed(4);
        if (n >= 0.0001) return '$' + n.toFixed(6);
        return '$' + n.toExponential(2);
    }

    function formatChange(c) {
        if (c == null) return null;
        var n = parseFloat(c);
        if (!isFinite(n)) return null;
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m];
        });
    }
    function cssEscape(s) {
        if (window.CSS && CSS.escape) return CSS.escape(s);
        return String(s).replace(/"/g, '\\"');
    }
    function showError(m) { if (window.MSNChat && window.MSNChat.showError) window.MSNChat.showError(m); else console.error('[rooms]', m); }
    function showSuccess(m) { if (window.MSNChat && window.MSNChat.showSuccess) window.MSNChat.showSuccess(m); else console.log('[rooms]', m); }

    // ═══════════════════════════════════════════════════════
    //  TOKEN BALANCE CHECK — any mint
    // ═══════════════════════════════════════════════════════
        async function fetchTokenBalance(wallet, mint) {
        if (!wallet || !mint) return null;

        var conn = getRoomsConnection();
        if (!conn) {
            console.warn('[rooms] solanaWeb3 not ready');
            return null;
        }

        try {
            var pk = new window.solanaWeb3.PublicKey(wallet);
            var programs = [
                new window.solanaWeb3.PublicKey(SPL_TOKEN_PROGRAM),
                new window.solanaWeb3.PublicKey(TOKEN_2022_PROGRAM)
            ];
            var results = await Promise.allSettled(programs.map(function (prog) {
                return conn.getParsedTokenAccountsByOwner(
                    pk, { programId: prog }, 'confirmed'
                );
            }));
            var balance = 0;
            results.forEach(function (r) {
                if (r.status === 'fulfilled' && r.value && r.value.value) {
                    r.value.value.forEach(function (acc) {
                        var info = acc.account.data.parsed.info;
                        if (info.mint === mint) {
                            balance += parseFloat(info.tokenAmount.uiAmountString || '0');
                        }
                    });
                }
            });
            return balance;
        } catch (e) {
            console.warn('[rooms] balance fetch failed:', e);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ROOM LIST
    // ═══════════════════════════════════════════════════════
    async function loadRooms() {
        var sb = getSB();
        if (!sb) return [];
        try {
            var { data, error } = await sb.rpc('get_rooms');
            if (error) throw error;
            roomsCache = data || [];
            return roomsCache;
        } catch (e) {
            console.warn('[rooms] load failed:', e);
            return [];
        }
    }

      function renderRoomTabs() {
        // ⚑ Rooms no longer appear in the main Public/Private/Whale tab bar.
        //   Navigation happens through the Communities modal only.
        //   This function is kept as a no-op so other code that calls it
        //   doesn't break — it now only cleans up any legacy room-tabs
        //   that were rendered by an older version.
        var tabs = document.getElementById('chatTabs');
        if (tabs) {
            tabs.querySelectorAll('.chat-tab.room-tab').forEach(function (t) { t.remove(); });
        }
    }

    function findRoomById(id) {
        for (var i = 0; i < roomsCache.length; i++) {
            if (roomsCache[i].id === id) return roomsCache[i];
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════
    //  ACTIVATE ROOM (called by script.js switchTab)
    // ═══════════════════════════════════════════════════════
                async function activateRoom(roomId) {
        var room = findRoomById(roomId);
        if (!room) { showError('Room not found'); return; }
        activeRoomId = roomId;

                // ── Show room header, hide main tabs ──
        var tabsBar = document.getElementById('chatTabs');
        if (tabsBar) tabsBar.classList.add('hidden');
        var hdrBar = document.getElementById('roomHeaderBar');
        if (hdrBar) {
            hdrBar.classList.remove('hidden');

            // Epic one-line: [logo] Name · CA · $price Δ%
            var info = hdrBar.querySelector('.room-header-info');
            if (info) {
                var mintShort = room.token_mint.slice(0, 4) + '…' + room.token_mint.slice(-4);
                info.innerHTML =
                    '<img class="room-header-token-logo" id="roomHeaderTokenLogo" src="" alt="" style="display:none;">' +
                    '<span class="room-header-name" id="roomHeaderName">' + esc(room.name) + '</span>' +
                    '<span class="room-header-sep">·</span>' +
                    '<span class="room-header-mint" id="roomHeaderMint" title="' + esc(room.token_mint) + '">' + esc(mintShort) + '</span>' +
                    '<span class="room-header-price-wrap" id="roomHeaderPriceWrap" style="display:none;">' +
                        '<span class="room-header-price" id="roomHeaderPrice"></span>' +
                        '<span class="room-header-change" id="roomHeaderChange"></span>' +
                    '</span>';
            }

            fetchTokenInfo(room.token_mint).then(function (tinfo) {
                if (!tinfo) return;

                var logoEl = document.getElementById('roomHeaderTokenLogo');
                if (logoEl && tinfo.imageUrl) {
                    logoEl.src = tinfo.imageUrl;
                    logoEl.style.display = 'block';
                    logoEl.onerror = function () { logoEl.style.display = 'none'; };
                }

                var wrapEl   = document.getElementById('roomHeaderPriceWrap');
                var priceEl  = document.getElementById('roomHeaderPrice');
                var changeEl = document.getElementById('roomHeaderChange');

                var priceStr  = formatPrice(tinfo.priceUsd);
                var changeStr = formatChange(tinfo.change24h);

                if (wrapEl && (priceStr || changeStr)) {
                    wrapEl.style.display = 'inline-flex';
                    if (priceEl && priceStr) priceEl.textContent = priceStr;
                    if (changeEl && changeStr) {
                        changeEl.textContent = changeStr;
                        changeEl.className = 'room-header-change ' +
                            (parseFloat(tinfo.change24h) >= 0 ? 'rh-change-pos' : 'rh-change-neg');
                    }
                }
            });
        }

        var container = document.getElementById('roomMessagesContainer');
        if (!container) return;

        var wallet = getWallet();
        if (!wallet) {
            container.innerHTML = '<div class="empty-chat-hint">Connect your Phantom wallet to enter this room.</div>';
            return;
        }

        container.innerHTML = '';
        if (window.MSNChat && window.MSNChat.showMsgLoader) {
            window.MSNChat.showMsgLoader(container, 'Checking token balance');
        }

        // ── Token gate ──
        if (room.require_token_gate !== false) {
            var bal = await fetchTokenBalance(wallet, room.token_mint);
            if (bal == null) {
                container.innerHTML = '<div class="empty-chat-hint">Could not verify token balance — try again.</div>';
                return;
            }
            if (bal <= 0) {
                container.innerHTML = '<div class="empty-chat-hint">🚫 You need to hold this room\'s token to enter.<br><br><span style="font-size:0.7em;opacity:0.6">Mint: ' + esc(room.token_mint.slice(0, 8)) + '…' + esc(room.token_mint.slice(-8)) + '</span></div>';
                showError('You don\'t hold this room\'s token');
                return;
            }
        }

        // ── Token watermark inside the chat container ──
        try {
            var tinfo = await fetchTokenInfo(room.token_mint);
            if (tinfo && tinfo.imageUrl) {
                container.style.setProperty('--room-watermark', 'url("' + tinfo.imageUrl + '")');
            } else {
                container.style.removeProperty('--room-watermark');
            }
        } catch (e) { /* non-fatal */ }

        // ── Register membership ──
        try {
            var sb = getSB();
            await sb.rpc('join_room', { p_wallet: wallet, p_room_id: roomId });
        } catch (e) { /* non-fatal */ }

        await loadRoomMessages(roomId);
        setupRoomPresence(roomId);
        setupRoomRealtime(roomId);
        loadRoomXp(roomId);
    }
    // ═══════════════════════════════════════════════════════
    //  MESSAGE LOADING
    // ═══════════════════════════════════════════════════════
    async function loadRoomMessages(roomId, beforeSort) {
        var sb = getSB();
        var wallet = getWallet();
        var container = document.getElementById('roomMessagesContainer');
        if (!sb || !wallet || !container) return;

        try {
            var params = { p_wallet: wallet, p_room_id: roomId, p_limit: 50 };
            if (beforeSort) params.p_before_sort = beforeSort;

            var { data, error } = await sb.rpc('get_room_messages', params);
            if (error) throw error;

            if (!beforeSort) {
                container.innerHTML = '';
                knownRoomMsgIds.clear();
            }

            var rows = (data || []).slice().sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            });

            if (rows.length === 0 && !beforeSort) {
                container.innerHTML = '<div class="empty-chat-hint">No messages yet — be the first to speak.</div>';
                return;
            }

            if (rows.length > 0) oldestRoomSort = rows[0].sort_order;

            var holder = document.createElement('div');
            holder.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

            for (var i = 0; i < rows.length; i++) {
                var msg = rows[i];
                if (knownRoomMsgIds.has(msg.id)) continue;
                knownRoomMsgIds.add(msg.id);
                var node = await window.MSNChat.buildMessageNode(msg, false, false, true);
                holder.appendChild(node);
            }

            if (!beforeSort) {
                container.innerHTML = '';
                while (holder.firstChild) container.appendChild(holder.firstChild);
                container.scrollTop = container.scrollHeight;
                        } else {
                // Prepend older messages — capture scroll BEFORE insert
                var firstChild = container.firstChild;
                var prevScrollHeight = container.scrollHeight;
                var prevScrollTop    = container.scrollTop;
                container.insertBefore(holder, firstChild);
                container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
            }

            // Reactions
            loadRoomReactions(roomId);
        } catch (err) {
            console.error('[rooms] load failed:', err);
            if (/not_member/.test(err.message || '')) {
                container.innerHTML = '<div class="empty-chat-hint">🚫 You are not a member of this room.</div>';
            } else {
                container.innerHTML = '<div class="empty-chat-hint">Failed to load messages.</div>';
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  SENDING
    // ═══════════════════════════════════════════════════════
        async function sendMessage() {
        if (!activeRoomId) return;
        var wallet = getWallet();
        var username = getUsername();
        if (!wallet) { showError('Connect Phantom first'); return; }
        if (!username) { showError('Set your username first'); return; }

        // ⚑ Enforce shared cooldown — same timer as public/whale chat
        if (window.MSNChat && window.MSNChat.isCooldownActive && window.MSNChat.isCooldownActive()) {
            showError('Cooldown active — wait a moment');
            return;
        }

        var room = findRoomById(activeRoomId);
        if (!room) return;

                // Chain check before send — only if the room requires a token
        if (room.require_token_gate !== false) {
            var bal = await fetchTokenBalance(wallet, room.token_mint);
            if (bal == null || bal <= 0) {
                showError('You no longer hold this room\'s token');
                return;
            }
        }

        var inp = document.getElementById('messageInput');
        var text = (inp.value || '').trim();
        if (!text && !window.MSNChat.getReplyingTo()) return;

        var sb = getSB();
        if (!sb) { showError('No connection'); return; }

        var reply = window.MSNChat.getReplyingTo ? window.MSNChat.getReplyingTo() : null;
        var params = {
            p_wallet: wallet,
            p_username: username,
            p_room_id: activeRoomId,
            p_message: text || null,
            p_image_url: null
        };
        if (reply && reply.id) {
            params.p_reply_to_id = reply.id;
            params.p_reply_to_username = reply.username;
            params.p_reply_to_message = reply.message || null;
            params.p_reply_to_image_url = reply.imageUrl || null;
        }

        var sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            var { data, error } = await sb.rpc('post_room_message', params);
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);

            // Clear input + reply state
            inp.value = '';
            if (window.MSNChat.clearReplyingTo) window.MSNChat.clearReplyingTo();
            if (window.MSNChat.startCooldown) window.MSNChat.startCooldown();

            // Optimistic render — API returned the inserted message
            if (data && data.message) {
                var inserted = typeof data.message === 'string'
                    ? JSON.parse(data.message)
                    : data.message;
                if (!knownRoomMsgIds.has(inserted.id)) {
                    knownRoomMsgIds.add(inserted.id);
                    var container = document.getElementById('roomMessagesContainer');
                    var node = await window.MSNChat.buildMessageNode(inserted, false, false, true);
                    if (container) {
                        // Remove empty hint if present
                        var hint = container.querySelector('.empty-chat-hint');
                        if (hint) hint.remove();
                        container.appendChild(node);
                        container.scrollTop = container.scrollHeight;
                    }
                }
            }

            // Refresh room XP display
            loadRoomXp(activeRoomId);
        } catch (err) {
            console.error('[rooms] send failed:', err);
            if (/not_member/.test(err.message || '')) {
                showError('You are not a member of this room');
            } else if (/empty_message/.test(err.message || '')) {
                showError('Message cannot be empty');
            } else {
                showError('Send failed: ' + (err.message || 'unknown'));
            }
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            inp.focus();
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PRESENCE — per-room
    // ═══════════════════════════════════════════════════════
    function setupRoomPresence(roomId) {
        var sb = getSB();
        if (!sb) return;

        if (roomPresenceChannel) {
            try { roomPresenceChannel.untrack(); } catch (e) {}
            sb.removeChannel(roomPresenceChannel);
            roomPresenceChannel = null;
        }
        roomOnlineUsers.clear();

        var username = getUsername();
        var wallet = getWallet();
        if (!username || !wallet) return;

        var clientId = localStorage.getItem('msn_chat_client_id') || 'c_' + Math.random().toString(36).slice(2);
        var presenceKey = username + '::' + clientId + '::' + roomId;

        roomPresenceChannel = sb.channel('msn-room-presence-' + roomId, {
            config: { presence: { key: presenceKey } }
        });

        roomPresenceChannel
            .on('presence', { event: 'sync' }, function () {
                var state = roomPresenceChannel.presenceState();
                roomOnlineUsers.clear();
                Object.keys(state).forEach(function (key) {
                    var list = state[key];
                    if (!list || !list.length) return;
                    var p = list[0];
                    if (!p.username) return;
                    // Dedupe by username
                    var exists = false;
                    roomOnlineUsers.forEach(function (u) {
                        if (u.username === p.username) exists = true;
                    });
                    if (!exists) {
                        roomOnlineUsers.set(key, {
                            username: p.username,
                            wallet: p.wallet || '',
                            online_at: p.online_at || ''
                        });
                    }
                });
                renderRoomSidebar();
            })
            .subscribe(function (status) {
                if (status === 'SUBSCRIBED') {
                    roomPresenceChannel.track({
                        username: username,
                        wallet: wallet,
                        room_id: roomId,
                        online_at: new Date().toISOString()
                    });
                }
            });
    }

    function renderRoomSidebar() {
        if (!activeRoomId) return;
        var sidebarUsers = document.getElementById('sidebarUsers');
        var countEl = document.getElementById('sidebarActiveUsersCount');
        if (!sidebarUsers) return;

        var html = '';
        var me = getUsername();
        var count = 0;

        // Self first (if online)
                roomOnlineUsers.forEach(function (u) {
            count++;
            // ⚑ Look up the full profile by wallet so avatarFor() gets the
            //   fields it expects (avatar_url, x_avatar_url, x_verified)
            var _profile = null;
            if (window.MSNIdentity && window.MSNIdentity.byWallet && u.wallet) {
                _profile = window.MSNIdentity.byWallet()[u.wallet];
            }
            var avatarURL = (_profile && window.MSNIdentity && window.MSNIdentity.avatarFor)
                ? window.MSNIdentity.avatarFor(_profile)
                : null;
            var displayName = window.MSNIdentity && window.MSNIdentity.labelForUsername
                ? window.MSNIdentity.labelForUsername(u.username)
                : u.username;
            var isSelf = u.username === me;
            var avatarHTML = avatarURL
                ? '<img src="' + esc(avatarURL) + '" alt="">'
                : (displayName.charAt(0) || '?').toUpperCase();

            html += '<div class="sidebar-user-item' + (isSelf ? ' you-tag' : '') + '" data-username="' + esc(u.username) + '"' + (u.wallet ? ' data-wallet="' + esc(u.wallet) + '"' : '') + '>'
                + '<div class="user-avatar">' + avatarHTML + '<span class="online-indicator"></span></div>'
                + '<div class="user-info"><div class="user-name">' + esc(displayName) + '</div><div class="user-status-text">' + (isSelf ? 'You' : 'In room') + '</div></div>'
                + '</div>';
        });

        sidebarUsers.innerHTML = html || '<div class="no-users-sidebar">No one else in this room</div>';
        if (countEl) countEl.textContent = count;
        var onlineNum = document.getElementById('onlineCountNumber');
        if (onlineNum) onlineNum.textContent = count;
    }

    // ═══════════════════════════════════════════════════════
    //  REALTIME
    // ═══════════════════════════════════════════════════════
    function setupRoomRealtime(roomId) {
        var sb = getSB();
        if (!sb) return;

        if (roomMsgChannel) {
            sb.removeChannel(roomMsgChannel);
            roomMsgChannel = null;
        }

        roomMsgChannel = sb.channel('msn-room-msgs-' + roomId)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'room_messages',
                filter: 'room_id=eq.' + roomId
            }, async function (payload) {
                var msg = payload.new;
                if (!msg || !msg.id) return;
                if (knownRoomMsgIds.has(msg.id)) return;
                // Skip own messages — we already rendered optimistically
                if (msg.wallet_address === getWallet()) return;

                knownRoomMsgIds.add(msg.id);
                var container = document.getElementById('roomMessagesContainer');
                if (!container || activeRoomId !== roomId) return;
                var hint = container.querySelector('.empty-chat-hint');
                if (hint) hint.remove();
                var node = await window.MSNChat.buildMessageNode(msg, false, false, true);
                container.appendChild(node);
                container.scrollTop = container.scrollHeight;
            })
            .subscribe();
    }

       function subscribeToRoomList() {
        var sb = getSB();
        if (!sb) return;
        if (roomListChannel) sb.removeChannel(roomListChannel);
        roomListChannel = sb.channel('msn-rooms-list')
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'rooms'
            }, async function () {
                await loadRooms();
                renderRoomTabs();
                // Refresh the open overlay so new rooms appear immediately
                var overlay = document.getElementById('roomsListOverlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    renderRoomsList();
                }
            })
            .subscribe();
    }

    // ═══════════════════════════════════════════════════════
    //  XP / RANK
    // ═══════════════════════════════════════════════════════
    async function loadRoomXp(roomId) {
        var sb = getSB();
        var wallet = getWallet();
        if (!sb || !wallet) return;
        try {
            var { data } = await sb.rpc('get_room_xp', { p_wallet: wallet, p_room_id: roomId });
            if (!data) return;
            var levelEl = document.getElementById('sidebarBigLevel');
            if (levelEl) {
                var xp = data.xp || 0;
                var level = data.level || 1;
                var today = data.xp_today || 0;
                levelEl.textContent = today > 0
                    ? '⭐ Lv.' + level + ' · ' + xp + ' XP · +' + today + ' today'
                    : '⭐ Lv.' + level + ' · ' + xp + ' XP';
                levelEl.classList.remove('hidden');
            }
        } catch (e) { /* non-fatal */ }
    }

    // ═══════════════════════════════════════════════════════
    //  REACTIONS (basic — not wired to UI yet in v1)
    // ═══════════════════════════════════════════════════════
    function loadRoomReactions(roomId) {
        // Reserved for v2 — v1 ships without room reactions
    }

    // ═══════════════════════════════════════════════════════
    //  ROOM CREATION
    // ═══════════════════════════════════════════════════════
           async function createRoom(tokenMint, name, requireGate) {
        var sb = getSB();
        var wallet = getWallet();
        var username = getUsername();
        if (!sb || !wallet) { showError('Connect wallet first'); return null; }
        if (!username) { showError('Set your username first'); return null; }
        if (typeof requireGate !== 'boolean') requireGate = true;

        tokenMint = (tokenMint || '').trim();
        if (!tokenMint || tokenMint.length < 32) {
            showError('Enter a valid token mint address');
            return null;
        }

                // ⚑ Mod wallet bypasses the client-side whale check entirely.
        //   Server-side create_room also bypasses it — this is the
        //   client gate that would otherwise fire before the RPC.
        var MOD_WALLET = '4XAqQmEcJW37ZUqDwwAWhuPy7xfQpTJTLoEUwmi51yuj';
        var isMod = wallet && wallet.toLowerCase() === MOD_WALLET.toLowerCase();

        var chainBal = await fetchTokenBalance(wallet, MAIN_TOKEN_MINT);

        console.log('[rooms] create_room whale check:', {
            isMod:        isMod,
            chainBalance: chainBal,
            required:     WHALE_MIN,
            pass:         isMod || (chainBal != null && chainBal >= WHALE_MIN)
        });

        if (!isMod) {
            if (chainBal == null) {
                showError('Could not verify your whale balance — check connection and try again');
                return null;
            }
            if (chainBal < WHALE_MIN) {
                showError(
                    'Only 🐋 Whale holders (' + WHALE_MIN.toLocaleString() + '+ tokens) can create rooms. ' +
                    'You currently hold ' + Math.floor(chainBal).toLocaleString() + '.'
                );
                return null;
            }
        }

               // ⚑ CRITICAL: Sync fresh chain balance to DB BEFORE calling the RPC.
        //   Without this, create_room reads stale profiles.token_balance
        //   and returns "not_whale" even when you hold 2M on-chain.
        //   (Skipped for mod — they bypass the whale check server-side too.)
        if (!isMod && chainBal != null) {
            try {
                await sb.rpc('update_wallet_balance', {
                    p_wallet: wallet,
                    p_balance: chainBal
                });
                if (window.userBalances) window.userBalances[username] = chainBal;
                console.log('[rooms] synced chain balance to DB:', chainBal);
            } catch (e) {
                console.warn('[rooms] balance sync failed — RPC may still use stale DB:', e);
            }
        }

        try {
            var { data, error } = await sb.rpc('create_room', {
                p_wallet: wallet,
                p_token_mint: tokenMint,
                p_name: (name || 'Community').trim(),
                p_require_token_gate: requireGate
            });
            if (error) throw error;
            if (data.error === 'not_whale') {
                showError(
                    'Whale check failed on server — the DB balance sync may not have committed. ' +
                    'Refresh the page and try again.'
                );
                return null;
            }
            if (data.error === 'token_already_has_room') {
                showError('A room already exists for this token');
                return null;
            }
            if (data.error === 'daily_limit_reached') {
                showError('You can only create 1 room per 24 hours');
                return null;
            }
            if (data.error) {
                showError('Create failed: ' + data.error);
                return null;
            }

            showSuccess('Room created!');
            await loadRooms();
            renderRoomTabs();
            return data.room_id;
        } catch (err) {
            console.error('[rooms] create failed:', err);
            showError('Create failed: ' + (err.message || 'unknown'));
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  UI — Modals
    // ═══════════════════════════════════════════════════════
       var _roomsWalletPoll = null;
    function openRoomsList() {
        var overlay = document.getElementById('roomsListOverlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        renderRoomsList();

        // Re-render while open if wallet connects/disconnects — so the
        // creator-only buttons (delete/gate) appear or disappear correctly.
        var lastWallet = getWallet();
        if (_roomsWalletPoll) clearInterval(_roomsWalletPoll);
        _roomsWalletPoll = setInterval(function () {
            if (!overlay || overlay.classList.contains('hidden')) {
                clearInterval(_roomsWalletPoll);
                _roomsWalletPoll = null;
                return;
            }
            var w = getWallet();
            if (w !== lastWallet) {
                lastWallet = w;
                renderRoomsList();
            }
        }, 1500);
    }

    function closeRoomsList() {
        var overlay = document.getElementById('roomsListOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

          function formatCreatedAt(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            var diff = Math.floor((Date.now() - d.getTime()) / 1000);
            if (diff < 60) return 'just now';
            if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            if (diff < 86400 * 7) return Math.floor(diff / 86400) + 'd ago';
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch (e) { return '—'; }
    }

    function shortAddr(addr) {
        if (!addr) return '—';
        return addr.slice(0, 4) + '…' + addr.slice(-4);
    }

               // ── Epic clean card ──
        function buildRoomCard(room, currentWallet, activeId) {
        var canModify = canModifyRoom(room, currentWallet);
        var gateOn    = room.require_token_gate !== false;
        var isActive  = activeId && activeId === room.id;
        var info      = tokenInfoCache.get(room.token_mint) || null;

        var logoHtml = info && info.imageUrl
            ? '<img src="' + esc(info.imageUrl) + '" alt="" onerror="this.replaceWith(document.createTextNode(\'?\'));">'
            : '?';

        var badgeHtml = '<span class="rl-gate-badge ' + (gateOn ? 'rl-gate-on' : 'rl-gate-off') + '" title="'
            + (gateOn ? 'Token gated' : 'Open to all') + '">'
            + (gateOn ? ICONS.lockSm : ICONS.unlockSm) + '</span>';

        var symbolHtml = info && info.symbol
            ? '<span class="rl-symbol">$' + esc(info.symbol) + '</span>'
            : '';

        var priceStr  = formatPrice(info && info.priceUsd);
        var changeStr = formatChange(info && info.change24h);
        var changeCls = '';
        if (info && info.change24h != null) {
            changeCls = parseFloat(info.change24h) >= 0 ? 'rl-change-pos' : 'rl-change-neg';
        }

        var metaParts = [];
        if (priceStr)  metaParts.push('<span class="rl-price">' + esc(priceStr) + '</span>');
        if (changeStr) metaParts.push('<span class="rl-change ' + changeCls + '">' + esc(changeStr) + '</span>');
        metaParts.push('<span class="rl-mint" title="' + esc(room.token_mint) + '">'
            + esc(room.token_mint.slice(0, 5) + '…' + room.token_mint.slice(-5)) + '</span>');
        metaParts.push('<span class="rl-time">' + esc(formatCreatedAt(room.created_at)) + '</span>');
        var metaHtml = metaParts.join('<span class="rl-sep">·</span>');

        var actions = '<div class="rl-actions">';
        actions += '<button type="button" class="rl-btn-primary" data-enter-room="' + esc(room.id) + '">Enter ' + ICONS.arrow + '</button>';
        actions += '<button type="button" class="rl-btn-ghost" data-share-room="' + esc(room.id) + '" title="Copy link" aria-label="Copy room link">' + ICONS.copy + '</button>';
                if (canModify) {
            actions += '<button type="button" class="rl-btn-ghost" data-toggle-room="' + esc(room.id) + '" data-current="' + (gateOn ? '1' : '0') + '" title="' + (gateOn ? 'Disable token gate' : 'Enable token gate') + '" aria-label="Toggle token gate">' + (gateOn ? ICONS.lock : ICONS.unlock) + '</button>';
            actions += '<button type="button" class="rl-btn-danger" data-delete-room="' + esc(room.id) + '" data-room-name="' + esc(room.name) + '" title="Delete room" aria-label="Delete room">' + ICONS.trash + '</button>';
        }
        actions += '</div>';

        return '<div class="rooms-list-item' + (isActive ? ' is-active' : '') + '" data-room-id="' + esc(room.id) + '">'
            + '<div class="rl-thumb">' + logoHtml + badgeHtml + '</div>'
            + '<div class="rl-info">'
            +   '<div class="rl-title-row">'
            +     '<span class="rl-name">' + esc(room.name) + '</span>'
            +     symbolHtml
            +   '</div>'
            +   '<div class="rl-meta-row">' + metaHtml + '</div>'
            + '</div>'
            + actions
            + '</div>';
    }

    function attachRoomListListeners(list) {
        list.querySelectorAll('.rooms-list-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.target.closest('button')) return;
                var id = el.getAttribute('data-room-id');
                if (!id) return;
                closeRoomsList();
                if (window.MSNChat && window.MSNChat.switchTab) window.MSNChat.switchTab('room-' + id);
            });
        });

        list.querySelectorAll('[data-enter-room]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation(); e.preventDefault();
                var id = this.getAttribute('data-enter-room');
                closeRoomsList();
                if (window.MSNChat && window.MSNChat.switchTab) window.MSNChat.switchTab('room-' + id);
            });
        });

                list.querySelectorAll('[data-share-room]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation(); e.preventDefault();
                copyShareLink(this.getAttribute('data-share-room'), this);
            });
        });

        list.querySelectorAll('[data-toggle-room]').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation(); e.preventDefault();
                var roomId      = this.getAttribute('data-toggle-room');
                var currentlyOn = this.getAttribute('data-current') === '1';
                var newValue    = !currentlyOn;
                                this.disabled   = true;
                var origHtml    = this.innerHTML;
                this.innerHTML = '…';
                try {
                    var sb = getSB();
                    var wallet = getWallet();
                    if (!sb || !wallet) { showError('Connect wallet first'); this.innerHTML = origHtml; this.disabled = false; return; }
                    var { data, error } = await sb.rpc('toggle_room_token_gate', {
                        p_wallet: wallet, p_room_id: roomId, p_require: newValue
                    });
                    if (error) throw error;
                    if (data && data.error) throw new Error(data.error);
                    showSuccess(newValue ? '🔒 Token gate enabled' : '🔓 Token gate disabled');
                    await loadRooms();
                    renderRoomsList();
                } catch (err) {
                    console.error('[rooms] toggle gate failed:', err);
                    showError('Toggle failed: ' + (err.message || 'unknown'));
                    this.innerHTML = origHtml;
                    this.disabled = false;
                }
            });
        });

        list.querySelectorAll('[data-delete-room]').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation(); e.preventDefault();
                var roomId   = this.getAttribute('data-delete-room');
                var roomName = this.getAttribute('data-room-name') || 'this room';
                if (!confirm('Delete "' + roomName + '"?\n\nAll messages will be permanently removed. This cannot be undone.')) return;

                                this.disabled   = true;
                var origHtml    = this.innerHTML;
                this.innerHTML = '…';
                try {
                    var sb = getSB();
                    var wallet = getWallet();
                                       if (!sb || !wallet) { showError('Connect wallet first'); this.innerHTML = origHtml; this.disabled = false; return; }
                    var { data, error } = await sb.rpc('delete_room', {
                        p_wallet: wallet, p_room_id: roomId
                    });
                    if (error) throw error;
                    if (data && data.error) {
                        if (data.error === 'not_creator')          showError('Only the creator or a mod can delete this room');
                        else if (data.error === 'room_not_found')  showError('Room not found — refreshing');
                        else                                       showError('Delete failed: ' + data.error);
                        await loadRooms(); renderRoomsList();
                        return;
                    }
                                       showSuccess('🗑 Room deleted');
                    if (activeRoomId === roomId) {
                        if (window.MSNChat && window.MSNChat.switchTab) window.MSNChat.switchTab('public');
                    }
                    await loadRooms();
                    renderRoomsList();
                } catch (err) {
                    console.error('[rooms] delete failed:', err);
                    showError('Delete failed: ' + (err.message || 'unknown'));
                    this.innerHTML = origHtml;
                    this.disabled = false;
                }
            });
        });
    }

    async function renderRoomsList() {
        var list = document.getElementById('roomsList');
        if (!list) return;

        if (!roomsCache.length) {
            list.innerHTML = '<div class="rooms-list-empty">No rooms yet.<br>Tap <strong>+ Create New Room</strong> below to found one.</div>';
            return;
        }

        var currentWallet = getWallet();

        // ── Pass 1 — instant render (logos show "?" until pass 2) ──
        list.innerHTML = roomsCache.map(function (room) {
            return buildRoomCard(room, currentWallet, activeRoomId);
        }).join('');

        attachRoomListListeners(list);

        // ── Pass 2 — fetch token info, patch cards in place ──
        var mints = roomsCache.map(function (r) { return r.token_mint; });
        await prefetchTokenInfo(mints);

        roomsCache.forEach(function (room) {
            var card = list.querySelector('.rooms-list-item[data-room-id="' + CSS.escape(room.id) + '"]');
            if (!card) return;

            var info = tokenInfoCache.get(room.token_mint);
            if (!info) return;

                                  if (info.imageUrl) {
                var thumbEl = card.querySelector('.rl-thumb');
                if (thumbEl) {
                    var badgeEl = thumbEl.querySelector('.rl-gate-badge');
                    thumbEl.innerHTML = '<img src="' + esc(info.imageUrl) + '" alt="" onerror="this.replaceWith(document.createTextNode(\'?\'));">'
                        + (badgeEl ? badgeEl.outerHTML : '');
                }
            }
            if (info.symbol) {
                var symEl = card.querySelector('.rl-symbol');
                if (symEl) { symEl.textContent = '$' + info.symbol; }
                else {
                    var titleRow = card.querySelector('.rl-title-row');
                    if (titleRow) {
                        var newSym = document.createElement('span');
                        newSym.className = 'rl-symbol';
                        newSym.textContent = '$' + info.symbol;
                        titleRow.appendChild(newSym);
                    }
                }
            }
            // Inject price + change if they arrived late
            var metaRow = card.querySelector('.rl-meta-row');
            if (metaRow && !metaRow.querySelector('.rl-price')) {
                var priceStr  = formatPrice(info.priceUsd);
                var changeStr = formatChange(info.change24h);
                if (priceStr || changeStr) {
                    var frag = document.createDocumentFragment();
                    if (priceStr) {
                        var pEl = document.createElement('span');
                        pEl.className = 'rl-price';
                        pEl.textContent = priceStr;
                        frag.appendChild(pEl);
                    }
                    if (changeStr) {
                        var sep1 = document.createElement('span');
                        sep1.className = 'rl-sep';
                        sep1.textContent = '·';
                        frag.appendChild(sep1);
                        var cEl = document.createElement('span');
                        cEl.className = 'rl-change ' + (parseFloat(info.change24h) >= 0 ? 'rl-change-pos' : 'rl-change-neg');
                        cEl.textContent = changeStr;
                        frag.appendChild(cEl);
                    }
                    var sep2 = document.createElement('span');
                    sep2.className = 'rl-sep';
                    sep2.textContent = '·';
                    frag.appendChild(sep2);
                    metaRow.insertBefore(frag, metaRow.firstChild);
                }
            }
        });
    }

    function openCreateRoom() {
        var overlay = document.getElementById('roomCreateOverlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        var mint = document.getElementById('roomTokenInput');
        var name = document.getElementById('roomNameInput');
        if (mint) mint.value = '';
        if (name) name.value = '';
        if (mint) mint.focus();
    }

    function closeCreateRoom() {
        var overlay = document.getElementById('roomCreateOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

        async function handleCreateSubmit() {
        var mintEl = document.getElementById('roomTokenInput');
        var nameEl = document.getElementById('roomNameInput');
        var gateEl = document.getElementById('roomRequireGate');
        var btn = document.getElementById('roomCreateBtn');
        if (!mintEl) return;
        var mint = mintEl.value.trim();
        var name = nameEl ? nameEl.value.trim() : 'Community';
        var requireGate = gateEl ? gateEl.checked : true;
        if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
        var roomId = await createRoom(mint, name, requireGate);
        if (btn) { btn.disabled = false; btn.textContent = 'CREATE'; }
        if (roomId) {
            closeCreateRoom();
            if (window.MSNChat && window.MSNChat.switchTab) {
                window.MSNChat.switchTab('room-' + roomId);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  BOOT
    // ═══════════════════════════════════════════════════════
        // ── SHARE LINK SYSTEM ─────────────────────────────────────
    function getShareUrl(roomId) {
        try {
            var url = new URL(window.location.href);
            url.searchParams.set('room', roomId);
            url.hash = '';
            return url.toString();
        } catch (e) {
            return window.location.origin + window.location.pathname + '?room=' + encodeURIComponent(roomId);
        }
    }

           function copyShareLink(roomId, btnEl) {
        if (!roomId) return;
        var url = getShareUrl(roomId);

        var flash = function () {
            if (btnEl) {
                var orig = btnEl.innerHTML;
                btnEl.classList.add('copied');
                btnEl.innerHTML = ICONS.check;
                clearTimeout(btnEl._copyTimer);
                btnEl._copyTimer = setTimeout(function () {
                    btnEl.classList.remove('copied');
                    btnEl.innerHTML = orig;
                }, 1500);
            }
            showSuccess('🔗 Room link copied!');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(flash).catch(function () {
                fallbackCopy(url, flash);
            });
        } else {
            fallbackCopy(url, flash);
        }
    }

    function fallbackCopy(text, callback) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (callback) callback();
            else showSuccess('🔗 Room link copied!');
        } catch (e) {
            showError('Could not copy — copy manually: ' + text);
        }
    }

       function checkSharedRoomLink() {
        try {
            var params = new URLSearchParams(window.location.search);
            var roomId = params.get('room');
            if (!roomId) return;
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) {
                console.warn('[rooms] invalid room id in URL:', roomId);
                return;
            }
            pendingSharedRoomId = roomId;
            console.log('[rooms] shared room link detected:', roomId);

            // ── Aggressive retry — trusted reconnect can take up to ~16s ──
            [500, 1500, 3000, 5000, 8000, 12000, 18000, 25000].forEach(function (ms) {
                setTimeout(tryActivatePendingRoom, ms);
            });

            // ── Polling fallback — 1.5s interval, up to 45s total ──
            var pollStart = Date.now();
            var pollInterval = setInterval(function () {
                if (!pendingSharedRoomId) { clearInterval(pollInterval); return; }
                if (Date.now() - pollStart > 45000) {
                    console.warn('[rooms] giving up on shared room after 45s');
                    pendingSharedRoomId = null;
                    clearInterval(pollInterval);
                    return;
                }
                tryActivatePendingRoom();
            }, 1500);
        } catch (e) {
            console.warn('[rooms] link parse failed:', e);
        }
    }

    async function tryActivatePendingRoom() {
        if (!pendingSharedRoomId) return;
        if (window._pendingRoomActivating) return;   // debounce overlapping attempts

        window._pendingRoomActivating = true;
        try {
            var wallet = getWallet();
            if (!wallet) return;                     // poll will retry once wallet connects

            var rooms = await loadRooms();
            renderRoomTabs();

            var room = null;
            for (var i = 0; i < rooms.length; i++) {
                if (rooms[i].id === pendingSharedRoomId) { room = rooms[i]; break; }
            }

            if (!room) {
                console.log('[rooms] pending room not found yet, will retry:', pendingSharedRoomId);
                return;                              // poll will retry
            }

            // Found it — activate
            var roomId = pendingSharedRoomId;
            pendingSharedRoomId = null;

            // Clean the URL so a refresh doesn't re-trigger
            try {
                var url = new URL(window.location.href);
                url.searchParams.delete('room');
                history.replaceState(null, '', url.toString());
            } catch (e) {}

            console.log('[rooms] activating shared room:', roomId);
            if (window.MSNChat && window.MSNChat.switchTab) {
                window.MSNChat.switchTab('room-' + roomId);
            }
        } finally {
            window._pendingRoomActivating = false;
        }
    }

        var _hasBoundListeners = false;

    async function boot() {
        if (_isBootingRooms) return;
        _isBootingRooms = true;

        await loadRooms();
        renderRoomTabs();
        subscribeToRoomList();

        // ⚑ Bind every listener ONLY ONCE across repeated boot() calls
        if (!_hasBoundListeners) {
            _hasBoundListeners = true;

        // Bind "Communities" button (desktop right sidebar)
        var roomBtn = document.getElementById('roomsBtn');
        if (roomBtn) {
            roomBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openRoomsList();
            });
        }

                // Bind room header "Back" button
        var backBtn = document.getElementById('roomBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                if (window.MSNChat && window.MSNChat.switchTab) {
                    window.MSNChat.switchTab('public');
                }
            });
        }

        // Bind modal buttons
        var closeList = document.getElementById('roomsListCloseBtn');
        if (closeList) closeList.addEventListener('click', closeRoomsList);

        var createNew = document.getElementById('roomCreateNewBtn');
        if (createNew) createNew.addEventListener('click', function () {
            closeRoomsList();
            openCreateRoom();
        });

        var createCancel = document.getElementById('roomCancelBtn');
        if (createCancel) createCancel.addEventListener('click', closeCreateRoom);

        var createSubmit = document.getElementById('roomCreateBtn');
        if (createSubmit) createSubmit.addEventListener('click', handleCreateSubmit);

        // Escape closes modals
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            closeRoomsList();
            closeCreateRoom();
        });

                             // ⚑ Check for a shared room link (?room=<uuid>) in the URL
        checkSharedRoomLink();

        // ⚑ Retry pending activation when wallet becomes available
        window.addEventListener('msn:wallet-connected', tryActivatePendingRoom);
        document.addEventListener('msn:app-ready', tryActivatePendingRoom);

        } // end _hasBoundListeners block

        _isBootingRooms = false;
    }
       // ═══════════════════════════════════════════════════════
    //  DEACTIVATE — call when leaving a room tab
    // ═══════════════════════════════════════════════════════
              function deactivateRoom() {
        var sb = getSB();

        // Clear the token watermark so it doesn't leak into Public chat
        var rc = document.getElementById('roomMessagesContainer');
        if (rc) rc.style.removeProperty('--room-watermark');

        if (roomPresenceChannel) {
            try { roomPresenceChannel.untrack(); } catch (e) {}
            if (sb) sb.removeChannel(roomPresenceChannel);
            roomPresenceChannel = null;
        }
        if (roomMsgChannel) {
            if (sb) sb.removeChannel(roomMsgChannel);
            roomMsgChannel = null;
        }
        roomOnlineUsers.clear();
        activeRoomId = null;

        // ⚑ Hide the room container so its error messages don't bleed
        //   into Public / Private / Whale tabs
        var rc = document.getElementById('roomMessagesContainer');
        if (rc) rc.classList.add('hidden');

        // ⚑ Restore the normal tab bar and hide the room header bar
        var tabs = document.getElementById('chatTabs');
        if (tabs) tabs.classList.remove('hidden');
        var hdr = document.getElementById('roomHeaderBar');
        if (hdr) hdr.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════
       window.MSNRooms = {
        load: loadRooms,
        renderTabs: renderRoomTabs,
        onActivate: activateRoom,
        onDeactivate: deactivateRoom,
        sendMessage: sendMessage,
        renderSidebar: renderRoomSidebar,
        getActiveRoom: function () { return activeRoomId; },
        openList: openRoomsList,
        openCreate: openCreateRoom
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    document.addEventListener('msn:app-ready', boot);
    console.log('[rooms] loaded v1');
})();
