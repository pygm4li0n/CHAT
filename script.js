(function() {
    const SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';
    const STORAGE_BUCKET = 'chat-images';
    const AVATAR_BUCKET = 'chat-avatars';

    // State – updated keys for MSN
    const STORAGE_KEY_NAME = 'msn_chat_username';
    const CLIENT_ID_KEY = 'msn_chat_client_id';
    let username = localStorage.getItem(STORAGE_KEY_NAME) || '';
    let clientId = localStorage.getItem(CLIENT_ID_KEY) || '';
    if (!clientId) {
        clientId = 'c_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem(CLIENT_ID_KEY, clientId);
    }

    let avatarCache = {};
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // DOM refs – include the new sidebar elements
    const publicContainer = document.getElementById('publicMessagesContainer');
    const privateContainer = document.getElementById('privateMessagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const errorToast = document.getElementById('errorToast');
    const inputAreaBar = document.getElementById('inputAreaBar');
    const userPill = document.getElementById('userPill');
    const displayNamePill = document.getElementById('displayNamePill');
    const headerAvatar = document.getElementById('headerAvatar');
    const changeNameBtn = document.getElementById('changeNameBtn');
    const nameOverlay = document.getElementById('nameOverlay');
    const nameInput = document.getElementById('nameInput');
    const nameSubmitBtn = document.getElementById('nameSubmitBtn');
    const profilePicPreview = document.getElementById('profilePicPreview');
    const profilePicInput = document.getElementById('profilePicInput');
    const refreshBtn = document.getElementById('refreshBtn');
    const connectionPill = document.getElementById('connectionPill');
    const connDot = document.getElementById('connDot');
    const connText = document.getElementById('connText');
    const sidebarUsers = document.getElementById('sidebarUsers');
    const sidebarStatusDot = document.getElementById('sidebarStatusDot');
    const sidebarStatusText = document.getElementById('sidebarStatusText');
    const replyIndicatorBar = document.getElementById('replyIndicatorBar');
    const replyToUserDisp = document.getElementById('replyToUserDisp');
    const replyPreviewDisp = document.getElementById('replyPreviewDisp');
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');
    const privateIndicatorBar = document.getElementById('privateIndicatorBar');
    const privateChatUserDisp = document.getElementById('privateChatUserDisp');
    const cancelPrivateBtn = document.getElementById('cancelPrivateBtn');
    const uploadImgBtn = document.getElementById('uploadImgBtn');
    const fileInput = document.getElementById('fileInput');
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImg = document.getElementById('lightboxImg');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const publicEmptyHint = document.getElementById('publicEmptyHint');
    const privateEmptyHint = document.getElementById('privateEmptyHint');
    const onlineCountNumber = document.getElementById('onlineCountNumber');
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');
    const imagePreviewRow = document.getElementById('imagePreviewRow');
    const imagePreviewThumb = document.getElementById('imagePreviewThumb');
    const imagePreviewName = document.getElementById('imagePreviewName');
    const imagePreviewRemove = document.getElementById('imagePreviewRemove');
    const chatTabs = document.getElementById('chatTabs');
    const typingIndicator = document.getElementById('typingIndicator');
    const requestOverlay = document.getElementById('requestOverlay');
    const requestAvatar = document.getElementById('requestAvatar');
    const requestName = document.getElementById('requestName');
    const requestAcceptBtn = document.getElementById('requestAcceptBtn');
    const requestDeclineBtn = document.getElementById('requestDeclineBtn');
    // NEW elements for MSN sidebar
    const sidebarActiveUsersCount = document.getElementById('sidebarActiveUsersCount');
    const sidebarBigAvatar = document.getElementById('sidebarBigAvatar');
    const sidebarBigName = document.getElementById('sidebarBigName');
    let currentRequestData = null;

    // ... (rest of the variables – same as before)

    let replyingTo = null;
    let activePrivateChat = null;
    let currentTab = 'public';
    let onlineUsers = new Map();
    let isConnected = false;
    let realtimeChannel = null, presenceChannel = null, privateRequestsChannel = null, privMsgChannel = null, reactionsChannel = null, privReactionsChannel = null;
    let pendingPrivateRequests = new Map();
    let knownMessageIds = new Set();
    let messageReactions = {};
    let privateMessageReactions = {};
    const EMOJIS = ['❤️','😂','😮','😢','😡'];
    let pendingImageUrl = null;
    let profilePicFile = null;

    const typingUsers = new Map();
    let typingChannel = null;

    let acceptedPrivateChats = new Set(JSON.parse(localStorage.getItem('msn_accepted_chats') || '[]'));

    function saveAcceptedChats() {
        localStorage.setItem('msn_accepted_chats', JSON.stringify([...acceptedPrivateChats]));
    }

    // ... All other functions are identical, EXCEPT:

    // 1. In setupPresence(), change channel name to 'msn-chat-presence'
    function setupPresence() {
        if (presenceChannel) return;
        if (!username) return;
        const presenceKey = `${username}::${clientId}`;
        presenceChannel = supabase.channel('msn-chat-presence', { config:{ presence:{ key:presenceKey } } });
        // ... rest unchanged
    }

    // 2. In subscribeToPrivateRequests(), change channel name to 'msn-private-requests'
    function subscribeToPrivateRequests() {
        if(!username) return;
        if(privateRequestsChannel) supabase.removeChannel(privateRequestsChannel);
        privateRequestsChannel = supabase.channel('msn-private-requests')
            .on('postgres_changes', { event:'*', schema:'public', table:'private_chat_requests' }, (payload) => {
                // ... unchanged
            }).subscribe();
    }

    // 3. In updateSidebarUI(), after setting innerHTML and online counts, also update the new badge:
    async function updateSidebarUI() {
        const usersToFetch = [];
        if (username) usersToFetch.push(username);
        onlineUsers.forEach(u => usersToFetch.push(u.username));
        await fetchAvatars(usersToFetch);

        let html = '';
        const rendered = new Set();
        if(username && !rendered.has(username)) {
            html += buildSidebarItem(username, true, false, true);
            rendered.add(username);
        }
        onlineUsers.forEach((user) => {
            if(!rendered.has(user.username) && user.username !== username) {
                rendered.add(user.username);
                let isPending = pendingPrivateRequests.has(user.username) &&
                    pendingPrivateRequests.get(user.username).status === 'pending' &&
                    pendingPrivateRequests.get(user.username).from_user === user.username;
                let isAccepted = acceptedPrivateChats.has(user.username);
                html += buildSidebarItem(user.username, true, isPending, false, isAccepted);
            }
        });
        sidebarUsers.innerHTML = html || '<div class="no-users-sidebar">No one else online</div>';
        onlineCountNumber.textContent = onlineUsers.size;
        // Update the new badge in the sidebar section label
        if (sidebarActiveUsersCount) {
            sidebarActiveUsersCount.textContent = onlineUsers.size;
        }
    }

    // 4. In applyUsername(), also update the big sidebar profile:
    async function applyUsername(name) {
        username = name;
        localStorage.setItem(STORAGE_KEY_NAME, name);
        displayNamePill.textContent = name;

        if(profilePicFile) {
            try {
                const url = await uploadToStorage(profilePicFile, AVATAR_BUCKET, 300);
                await supabase.from('profiles').upsert({ username: name, avatar_url: url });
                avatarCache[name] = url;
                headerAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
                // Also update the big sidebar avatar
                if (sidebarBigAvatar) {
                    sidebarBigAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
                }
            } catch(err) { showError('Avatar upload failed: ' + err.message); }
        } else {
            const initial = (name[0]||'?').toUpperCase();
            headerAvatar.innerHTML = initial;
            if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = initial;
        }
        if (sidebarBigName) sidebarBigName.textContent = name;

        userPill.style.display = 'flex';
        inputAreaBar.style.display = 'flex';
        nameOverlay.classList.add('hidden');
        setReplyingTo(null);
        setActivePrivateChat(null);
        switchTab('public');
        await updateSidebarUI();
        setupTypingChannel();
    }

    // 5. In init(), when loading existing user, also set the big sidebar profile:
    async function init() {
        if(window.innerWidth<=768) sidebarToggle.classList.remove('hidden');
        await loadAcceptedChatsFromDB();
        if(username) {
            const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('username', username).single();
            if(profile && profile.avatar_url) {
                avatarCache[username] = profile.avatar_url;
                headerAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`;
                if (sidebarBigAvatar) {
                    sidebarBigAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`;
                }
            } else {
                const initial = (username[0]||'?').toUpperCase();
                headerAvatar.innerHTML = initial;
                if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = initial;
            }
            displayNamePill.textContent = username;
            if (sidebarBigName) sidebarBigName.textContent = username;
            // ... rest unchanged
        }
        // ... rest unchanged
    }

    // Everything else stays exactly the same
    // (Paste the rest of your original working code here)
