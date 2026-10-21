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
        if (!room) {
            showError('Room not found');
            return;
        }
        activeRoomId = roomId;

        // ⚑ Show room header bar, hide main tabs
        var tabsBar = document.getElementById('chatTabs');
        if (tabsBar) tabsBar.classList.add('hidden');
        var hdrBar = document.getElementById('roomHeaderBar');
        if (hdrBar) {
            hdrBar.classList.remove('hidden');
            var nameEl = document.getElementById('roomHeaderName');
            var mintEl = document.getElementById('roomHeaderMint');
            if (nameEl) nameEl.textContent = '🏛️ ' + room.name;
            if (mintEl) mintEl.textContent =
                room.token_mint.slice(0, 6) + '…' + room.token_mint.slice(-6);
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

        // 1. Check chain balance — only if the room requires a token
        if (room.require_token_gate === false) {
            // ⚑ Gate disabled by creator — any connected wallet can enter
            console.log('[rooms] token gate disabled for room:', roomId);
        } else {
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

        // 2. Register membership
        try {
            var sb = getSB();
            await sb.rpc('join_room', { p_wallet: wallet, p_room_id: roomId });
        } catch (e) { /* non-fatal — get_room_messages will validate */ }

        // 3. Load messages
        await loadRoomMessages(roomId);

        // 4. Subscribe presence + realtime
        setupRoomPresence(roomId);
        setupRoomRealtime(roomId);

        // 5. Load room XP
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
                // Prepend older messages
                var firstChild = container.firstChild;
                container.insertBefore(holder, firstChild);
                // Preserve scroll position
                var newH = container.scrollHeight;
                container.scrollTop = newH - container._prevScrollHeight + container._prevScrollTop;
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

        // ⚑ Fetch LIVE on-chain whale balance BEFORE calling create_room.
        //   The server RPC reads profiles.token_balance which is stale
        //   until wallet reconnect. Chain value is authoritative.
        var chainBal = await fetchTokenBalance(wallet, MAIN_TOKEN_MINT);
        if (chainBal == null) {
            showError('Could not verify your whale balance — check connection and try again');
            return null;
        }

        console.log('[rooms] create_room whale check:', {
            chainBalance: chainBal,
            required: WHALE_MIN,
            pass: chainBal >= WHALE_MIN
        });

        if (chainBal < WHALE_MIN) {
            showError(
                'Only 🐋 Whale holders (' + WHALE_MIN.toLocaleString() + '+ tokens) can create rooms. ' +
                'You currently hold ' + Math.floor(chainBal).toLocaleString() + '.'
            );
            return null;
        }

        // ⚑ CRITICAL: Sync fresh chain balance to DB BEFORE calling the RPC.
        //   Without this, create_room reads stale profiles.token_balance
        //   and returns "not_whale" even when you hold 2M on-chain.
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
    function openRoomsList() {
        var overlay = document.getElementById('roomsListOverlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        renderRoomsList();
    }

    function closeRoomsList() {
        var overlay = document.getElementById('roomsListOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

       function renderRoomsList() {
        var list = document.getElementById('roomsList');
        if (!list) return;
        if (!roomsCache.length) {
            list.innerHTML = '<div class="rooms-list-empty">No rooms yet. Create the first one.</div>';
            return;
        }
               var currentWallet = getWallet();
        list.innerHTML = roomsCache.map(function (room) {
            var isCreator = currentWallet && room.creator_wallet === currentWallet;
            var gateOn = room.require_token_gate !== false;
            var gateBadge = gateOn
                ? '<span class="rooms-list-item-gate rooms-list-item-gate-on" title="Token required to join">🔒 Token</span>'
                : '<span class="rooms-list-item-gate rooms-list-item-gate-off" title="Open to all wallets">🔓 Open</span>';
            var toggleBtn = isCreator
                ? '<button class="rooms-list-item-gate-toggle" data-toggle-room="' + esc(room.id) + '" data-current="' + (gateOn ? '1' : '0') + '" type="button" title="' + (gateOn ? 'Disable token gate' : 'Enable token gate') + '">' + (gateOn ? '🔓' : '🔒') + '</button>'
                : '';
            return '<div class="rooms-list-item" data-room-id="' + esc(room.id) + '">'
                + '<div class="rooms-list-item-info">'
                +   '<div class="rooms-list-item-name">🏛️ ' + esc(room.name) + ' ' + gateBadge + '</div>'
                +   '<div class="rooms-list-item-mint">' + esc(room.token_mint.slice(0, 6)) + '…' + esc(room.token_mint.slice(-6)) + '</div>'
                + '</div>'
                + toggleBtn
                + '<button class="rooms-list-item-share" data-share-room="' + esc(room.id) + '" type="button" title="Copy share link">🔗</button>'
                + '</div>';
        }).join('');

        list.querySelectorAll('.rooms-list-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.target.closest('.rooms-list-item-share')) return;
                var id = el.getAttribute('data-room-id');
                closeRoomsList();
                if (window.MSNChat && window.MSNChat.switchTab) {
                    window.MSNChat.switchTab('room-' + id);
                }
            });
        });

               list.querySelectorAll('.rooms-list-item-share').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                copyShareLink(this.getAttribute('data-share-room'));
            });
        });

        list.querySelectorAll('.rooms-list-item-gate-toggle').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation();
                e.preventDefault();
                var roomId = this.getAttribute('data-toggle-room');
                var currentlyOn = this.getAttribute('data-current') === '1';
                var newValue = !currentlyOn;
                this.disabled = true;
                try {
                    var sb = getSB();
                    var wallet = getWallet();
                    if (!sb || !wallet) { showError('Connect wallet first'); this.disabled = false; return; }
                    var { data, error } = await sb.rpc('toggle_room_token_gate', {
                        p_wallet: wallet,
                        p_room_id: roomId,
                        p_require: newValue
                    });
                    if (error) throw error;
                    if (data && data.error) throw new Error(data.error);
                    showSuccess(newValue ? '🔒 Token gate enabled' : '🔓 Token gate disabled');
                    await loadRooms();
                    renderRoomsList();
                } catch (err) {
                    console.error('[rooms] toggle gate failed:', err);
                    showError('Toggle failed: ' + (err.message || 'unknown'));
                    this.disabled = false;
                }
            });
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

    function copyShareLink(roomId) {
        if (!roomId) return;
        var url = getShareUrl(roomId);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                showSuccess('🔗 Room link copied!');
            }).catch(function () {
                fallbackCopy(url);
            });
        } else {
            fallbackCopy(url);
        }
    }

    function fallbackCopy(text) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showSuccess('🔗 Room link copied!');
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

            // Try at various moments — wallet might not be ready yet
            setTimeout(tryActivatePendingRoom, 800);
            setTimeout(tryActivatePendingRoom, 2000);
            setTimeout(tryActivatePendingRoom, 4500);
        } catch (e) {
            console.warn('[rooms] link parse failed:', e);
        }
    }

    async function tryActivatePendingRoom() {
        if (!pendingSharedRoomId) return;

        var wallet = getWallet();
        if (!wallet) return;                    // wait for wallet

        var rooms = await loadRooms();
        renderRoomTabs();

        var room = null;
        for (var i = 0; i < rooms.length; i++) {
            if (rooms[i].id === pendingSharedRoomId) { room = rooms[i]; break; }
        }

        if (!room) {
            // Room doesn't exist (deleted or never created)
            showError('This room no longer exists');
            pendingSharedRoomId = null;
            // Clean URL so a refresh doesn't retry
            try {
                var url = new URL(window.location.href);
                url.searchParams.delete('room');
                history.replaceState(null, '', url.toString());
            } catch (e) {}
            return;
        }

        // Room exists — switch to it. activateRoom runs the token check.
        var roomId = pendingSharedRoomId;
        pendingSharedRoomId = null;

        var tabName = 'room-' + roomId;
        var tab = document.querySelector('.chat-tab[data-tab="' + tabName + '"]');
        if (tab) {
            tab.click();
        } else if (window.MSNChat && window.MSNChat.switchTab) {
            window.MSNChat.switchTab(tabName);
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
