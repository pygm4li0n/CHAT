(function() {
    const SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';
    const STORAGE_BUCKET = 'chat-images';
    const AVATAR_BUCKET = 'chat-avatars';

    // State
    const STORAGE_KEY_NAME = 'msn_chat_username';
    const CLIENT_ID_KEY = 'msn_chat_client_id';
    const ACTIVE_CHAT_KEY = 'msn_active_private_chat';
    let username = localStorage.getItem(STORAGE_KEY_NAME) || '';
    let clientId = localStorage.getItem(CLIENT_ID_KEY) || '';
    if (!clientId) {
        clientId = 'c_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem(CLIENT_ID_KEY, clientId);
    }

    let avatarCache = {};
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // DOM elements
    const publicContainer = document.getElementById('publicMessagesContainer');
    const privateContainer = document.getElementById('privateMessagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const errorToast = document.getElementById('errorToast');
    const inputAreaBar = document.getElementById('inputAreaBar');
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
    const sidebarActiveUsersCount = document.getElementById('sidebarActiveUsersCount');
    const sidebarBigAvatar = document.getElementById('sidebarBigAvatar');
    const sidebarBigName = document.getElementById('sidebarBigName');
    const sidebarBigRank = document.getElementById('sidebarBigRank');
    const sidebarChangeNameBtn = document.getElementById('sidebarChangeNameBtn');
    const cooldownIndicator = document.getElementById('cooldownIndicator');
    const modSettingsBtn = document.getElementById('modSettingsBtn');
    const modSettingsOverlay = document.getElementById('modSettingsOverlay');
    const modTokenRequirementInput = document.getElementById('modTokenRequirement');
    const modCooldownSelect = document.getElementById('modCooldownSelect');
    const modSaveSettingsBtn = document.getElementById('modSaveSettingsBtn');
    const modCloseSettingsBtn = document.getElementById('modCloseSettingsBtn');
    const phantomConnectBtn = document.getElementById('phantomConnectBtn');
    const walletAddressSpan = document.getElementById('walletAddress');
    const phantomConnectBtnOverlay = document.getElementById('phantomConnectBtnOverlay');
    const walletAddressOverlay = document.getElementById('walletAddressOverlay');
    // NEW: Mobile edit button
    const mobileEditBtn = document.getElementById('mobileEditBtn');

    let currentRequestData = null;

    // Phantom state
    let phantomWalletPublicKey = null;
    let phantomConnected = false;
    let hasTokenAccess = false;

    const MOD_WALLET = 'GKpgaSMUeUPD2AjXb9eiXsbQ1qm6YfGrYY6hHvNgqNJc';
    let isModWallet = false;
    let modTokenRequirement = 50000;
    let modCooldownSeconds = 0;
    let lastMessageTimestamp = 0;
    let cooldownInterval = null;

    const TOKEN_MINT_ADDRESS = 'HJ5trLqpexXA4WoCHVeUGCpH9Je9x9Sfi2BEz4jHpump';
    const SOLANA_RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=fa7e6515-19de-45de-a7d1-35a64a0d9a1a';
    const solanaConnection = new solanaWeb3.Connection(SOLANA_RPC_ENDPOINT);
    let tokenListContainer = null;

    function getPhantomProvider() {
        if ('phantom' in window) {
            const provider = window.phantom?.solana;
            if (provider?.isPhantom) return provider;
        }
        if (window.solana?.isPhantom) return window.solana;
        return null;
    }

    function checkIfModWallet() {
        if (phantomConnected && phantomWalletPublicKey) {
            isModWallet = phantomWalletPublicKey.toBase58() === MOD_WALLET;
            if (isModWallet) modSettingsBtn.classList.remove('hidden');
            else modSettingsBtn.classList.add('hidden');
        } else {
            isModWallet = false;
            modSettingsBtn.classList.add('hidden');
        }
    }

    function updatePhantomUI() {
        const connected = phantomConnected && phantomWalletPublicKey;
        const addr = connected ? phantomWalletPublicKey.toBase58() : '';
        const shortAddr = connected ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

        walletAddressSpan.textContent = connected ? `👛 ${shortAddr}` : '';
        phantomConnectBtn.title = connected ? 'Disconnect Phantom' : 'Connect Phantom Wallet';

        if (phantomConnectBtnOverlay) {
            walletAddressOverlay.textContent = connected ? `👛 ${shortAddr}` : '';
            phantomConnectBtnOverlay.title = connected ? 'Disconnect Phantom' : 'Connect Phantom Wallet';
            phantomConnectBtnOverlay.innerHTML = connected 
                ? `<img src="https://i.postimg.cc/kXtLPZVF/Phanyoms2.png" alt="Phantom" class="phantom-icon"> <span>Disconnect</span>`
                : `<img src="https://i.postimg.cc/kXtLPZVF/Phanyoms2.png" alt="Phantom" class="phantom-icon"> <span>Connect Phantom</span>`;
        }

        checkIfModWallet();
        updateChatAccessibility();
    }

    function createTokenListContainer() {
        if (tokenListContainer) return tokenListContainer;
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (!sidebarFooter) return null;
        tokenListContainer = document.createElement('div');
        tokenListContainer.id = 'walletTokenList';
        tokenListContainer.style.cssText = `
            max-height: 160px; overflow-y: auto; margin-top: 6px;
            font-size: 0.7rem; color: #b0c0d8; padding: 4px;
            border-top: 1px solid rgba(255,255,255,0.1);
        `;
        sidebarFooter.parentNode.insertBefore(tokenListContainer, sidebarFooter);
        return tokenListContainer;
    }

    function displayTokenBalances(tokenAccounts) {
        const container = createTokenListContainer();
        if (!container) return;

        if (!tokenAccounts || tokenAccounts.length === 0) {
            container.innerHTML = '<div style="opacity:0.6;">No SPL tokens found</div>';
            return;
        }

        let html = '<div style="font-weight:bold; margin-bottom:4px;">Token Balances:</div>';
        tokenAccounts.forEach(acc => {
            const info = acc.account.data.parsed.info;
            const mint = info.mint;
            const amount = parseFloat(info.tokenAmount.uiAmountString);
            const shortMint = mint.slice(0,4) + '...' + mint.slice(-4);
            const isTarget = mint === TOKEN_MINT_ADDRESS;
            let statusHtml = '';
            if (isTarget) {
                if (modTokenRequirement <= 0 || amount > modTokenRequirement) {
                    statusHtml = ' <span style="color:#4ade80;">✅ Verified</span>';
                } else {
                    statusHtml = ' <span style="color:#ef4444;">❌ Not Verified</span>';
                }
            }
            html += `<div style="display:flex; justify-content:space-between; gap:4px; align-items:center;">
                <span title="${mint}">${shortMint}${statusHtml}</span>
                <span>${amount.toLocaleString()}</span>
            </div>`;
        });
        container.innerHTML = html;
    }

    function updateUserRank(balance) {
        if (!sidebarBigRank) return;
        let rank = '';
        if (balance > 1000000) rank = '🐋 Whale';
        else if (balance > 500000) rank = '🦈 Shark';
        else if (balance > 100000) rank = '🐬 Dolphin';
        else if (balance > 0) rank = '🦐 Shrimp';
        
        if (rank) {
            sidebarBigRank.textContent = rank;
            sidebarBigRank.classList.remove('hidden');
        } else {
            sidebarBigRank.classList.add('hidden');
        }
    }

    async function fetchAndDisplayAllTokens() {
        if (!phantomWalletPublicKey) return;

        try {
            const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(
                phantomWalletPublicKey,
                { programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            displayTokenBalances(tokenAccounts.value);

            let targetBalance = 0;
            for (const acc of tokenAccounts.value) {
                const info = acc.account.data.parsed.info;
                if (info.mint === TOKEN_MINT_ADDRESS) {
                    targetBalance += parseFloat(info.tokenAmount.uiAmountString);
                }
            }

            updateUserRank(targetBalance);

            if (modTokenRequirement <= 0) {
                hasTokenAccess = true;
            } else if (targetBalance > modTokenRequirement) {
                hasTokenAccess = true;
                showError(`✅ You hold ${targetBalance} tokens – access granted!`);
            } else {
                hasTokenAccess = false;
                showError(`❌ You need more than ${modTokenRequirement} tokens (you have ${targetBalance}).`);
            }
            updateChatAccessibility();
        } catch (err) {
            console.error('❌ Error fetching token balances:', err);
            hasTokenAccess = false;
            updateChatAccessibility();
            const container = createTokenListContainer();
            if (container) container.innerHTML = '<div style="color:#ff6b6b;">Failed to load tokens</div>';
        }
    }

    function updateChatAccessibility() {
        let canChat = false;
        if (username) {
            if (modTokenRequirement <= 0) {
                canChat = true;
            } else {
                canChat = phantomConnected && hasTokenAccess;
            }
        }
        messageInput.disabled = !canChat;
        sendBtn.disabled = !canChat;
        document.querySelectorAll('.private-btn').forEach(btn => btn.disabled = !canChat);

        if (canChat) {
            messageInput.placeholder = 'Type a message...';
        } else {
            if (!username) messageInput.placeholder = 'Set your username first';
            else if (modTokenRequirement > 0 && !phantomConnected) messageInput.placeholder = `Connect Phantom & hold ${modTokenRequirement} tokens to chat`;
            else if (modTokenRequirement > 0 && !hasTokenAccess) messageInput.placeholder = `Insufficient tokens – need ${modTokenRequirement}`;
        }
    }

    async function connectPhantom() {
        const provider = getPhantomProvider();
        if (!provider) {
            showError('Phantom wallet not installed. Please install it from phantom.app');
            return;
        }
        try {
            const resp = await provider.connect({ onlyIfTrusted: false });
            phantomWalletPublicKey = resp.publicKey;
            phantomConnected = true;
            updatePhantomUI();
            showError('✅ Phantom connected: ' + phantomWalletPublicKey.toBase58());
            await fetchAndDisplayAllTokens();
        } catch (err) {
            console.error('Phantom connection error:', err);
            showError('Could not connect Phantom: ' + err.message);
        }
    }

    function disconnectPhantom() {
        const provider = getPhantomProvider();
        if (provider && phantomConnected) provider.disconnect().catch(console.warn);
        phantomWalletPublicKey = null;
        phantomConnected = false;
        hasTokenAccess = false;
        updatePhantomUI();
        const container = document.getElementById('walletTokenList');
        if (container) container.innerHTML = '';
        if (cooldownInterval) { clearInterval(cooldownInterval); cooldownInterval = null; }
        hideCooldown();
    }

    function togglePhantomConnection() {
        if (phantomConnected) disconnectPhantom();
        else connectPhantom();
    }

    phantomConnectBtn.addEventListener('click', togglePhantomConnection);
    if (phantomConnectBtnOverlay) phantomConnectBtnOverlay.addEventListener('click', togglePhantomConnection);

    function initPhantomAutoConnect() {
        const provider = getPhantomProvider();
        if (provider && provider.isConnected && provider.publicKey) {
            phantomWalletPublicKey = provider.publicKey;
            phantomConnected = true;
            updatePhantomUI();
            fetchAndDisplayAllTokens();
        }
    }

    // Mod settings
    modSettingsBtn.addEventListener('click', () => {
        modTokenRequirementInput.value = modTokenRequirement;
        modCooldownSelect.value = modCooldownSeconds.toString();
        modSettingsOverlay.classList.remove('hidden');
    });
    modCloseSettingsBtn.addEventListener('click', () => modSettingsOverlay.classList.add('hidden'));
    modSaveSettingsBtn.addEventListener('click', async () => {
        const newTokenReq = parseInt(modTokenRequirementInput.value);
        const newCooldown = parseInt(modCooldownSelect.value);
        if (!isNaN(newTokenReq) && newTokenReq >= 0) modTokenRequirement = newTokenReq;
        if (!isNaN(newCooldown) && [0,5,10,15].includes(newCooldown)) modCooldownSeconds = newCooldown;
        try {
            const { error } = await supabase
                .from('settings')
                .upsert({ id: 1, token_requirement: modTokenRequirement, cooldown_seconds: modCooldownSeconds });
            if (error) throw error;
            showError('✅ Mod settings updated globally!');
        } catch (err) {
            console.error('Error saving settings:', err);
            showError('Failed to save settings: ' + err.message);
        }
        modSettingsOverlay.classList.add('hidden');
        if (modCooldownSeconds === 0 && cooldownInterval) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            hideCooldown();
        }
        if (phantomConnected) fetchAndDisplayAllTokens();
        updateChatAccessibility();
    });

    async function loadSettings() {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('token_requirement, cooldown_seconds')
                .eq('id', 1)
                .single();
            if (!error && data) {
                modTokenRequirement = data.token_requirement;
                modCooldownSeconds = data.cooldown_seconds;
            }
        } catch (err) {
            console.error('Error loading settings:', err);
        }
        updateChatAccessibility();
    }

    function subscribeToSettings() {
        if (settingsChannel) supabase.removeChannel(settingsChannel);
        settingsChannel = supabase
            .channel('settings-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
                const newData = payload.new;
                if (newData && newData.id === 1) {
                    modTokenRequirement = newData.token_requirement;
                    modCooldownSeconds = newData.cooldown_seconds;
                    updateChatAccessibility();
                    if (phantomConnected) fetchAndDisplayAllTokens();
                }
            })
            .subscribe();
    }

    // Cooldown
    function showCooldown(seconds) {
        cooldownIndicator.classList.remove('hidden');
        cooldownIndicator.textContent = `⏳ Cooldown: ${seconds}s`;
    }
    function hideCooldown() {
        cooldownIndicator.classList.add('hidden');
        cooldownIndicator.textContent = '';
    }
    function startCooldown(seconds) {
        if (seconds <= 0) return;
        const endTime = Date.now() + seconds * 1000;
        lastMessageTimestamp = Date.now();
        if (cooldownInterval) clearInterval(cooldownInterval);
        cooldownInterval = setInterval(() => {
            const remaining = Math.ceil((endTime - Date.now()) / 1000);
            if (remaining <= 0) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
                hideCooldown();
            } else {
                showCooldown(remaining);
            }
        }, 250);
        showCooldown(seconds);
    }

    // ============== REST OF ORIGINAL CODE ==============
    let replyingTo = null;
    let activePrivateChat = null;
    let currentTab = 'public';
    let onlineUsers = new Map();
    let isConnected = false;
    let realtimeChannel = null, presenceChannel = null, privateRequestsChannel = null, privMsgChannel = null, reactionsChannel = null, privReactionsChannel = null, settingsChannel = null;
    let pendingPrivateRequests = new Map();
    let knownMessageIds = new Set();
    let messageReactions = {};
    let privateMessageReactions = {};
    const EMOJIS = ['❤️','😂','😮','😢','😡'];
    let pendingImageUrl = null;
    let profilePicFile = null;

    const typingUsers = new Map();
    let typingChannel = null;

    let acceptedPrivateChats;
    try {
        acceptedPrivateChats = new Set(JSON.parse(localStorage.getItem('msn_accepted_chats') || '[]'));
    } catch (e) {
        acceptedPrivateChats = new Set();
    }

    // Token Tracker
    const TOKEN_ADDRESS = 'HmJDgky11u77hpBss6D8sjNpYPD5B6fWgSVDj58jpump';
    async function updateTokenInfo() {
        const logoEl = document.getElementById('tokenLogo');
        const nameEl = document.getElementById('tokenName');
        const priceEl = document.getElementById('tokenPrice');
        const changeEl = document.getElementById('tokenChange');
        if (!priceEl || !changeEl) return;

        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`);
            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs[0];
                const price = parseFloat(pair.priceUsd);
                const change = parseFloat(pair.priceChange.h24);
                const tokenName = pair.baseToken.name || pair.baseToken.symbol || 'TOKEN';
                const logoUrl = pair.info?.imageUrl || pair.baseToken?.imageUrl || '';

                if (nameEl) nameEl.textContent = tokenName;
                if (logoEl) {
                    logoEl.src = logoUrl;
                    logoEl.style.display = logoUrl ? 'block' : 'none';
                }
                priceEl.textContent = price ? `$${price.toFixed(4)}` : '--';
                changeEl.textContent = change ? `${change.toFixed(2)}%` : '--';
                changeEl.className = 'token-change ' + (change >= 0 ? 'positive' : 'negative');
            } else {
                if (logoEl) logoEl.style.display = 'none';
                priceEl.textContent = '--';
                changeEl.textContent = '--';
                changeEl.className = 'token-change';
            }
        } catch (err) {
            console.warn('Token fetch failed:', err);
            if (logoEl) logoEl.style.display = 'none';
            priceEl.textContent = '--';
            changeEl.textContent = '--';
        }
    }
    updateTokenInfo();
    setInterval(updateTokenInfo, 60000);

    // Scroll helpers
    function scrollContainerToBottom(container) { if (container) container.scrollTop = container.scrollHeight; }
    function updateScrollButtonVisibility(container) {
        if (!scrollBottomBtn) return;
        const threshold = 80;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        scrollBottomBtn.classList.toggle('visible', !isNearBottom);
    }
    [publicContainer, privateContainer].forEach(container => {
        container.addEventListener('scroll', () => {
            if (container === publicContainer && currentTab === 'public') updateScrollButtonVisibility(container);
            else if (container === privateContainer && currentTab === 'private') updateScrollButtonVisibility(container);
        });
    });
    scrollBottomBtn.addEventListener('click', () => {
        const container = currentTab === 'public' ? publicContainer : privateContainer;
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        setTimeout(() => updateScrollButtonVisibility(container), 300);
    });

    function saveAcceptedChats() { localStorage.setItem('msn_accepted_chats', JSON.stringify([...acceptedPrivateChats])); }
    async function loadAcceptedChatsFromDB() {
        if (!username) return;
        try {
            const { data: sent } = await supabase.from('private_chat_requests').select('to_user').eq('from_user', username).eq('status', 'accepted');
            const { data: received } = await supabase.from('private_chat_requests').select('from_user').eq('to_user', username).eq('status', 'accepted');
            (sent||[]).forEach(r => acceptedPrivateChats.add(r.to_user));
            (received||[]).forEach(r => acceptedPrivateChats.add(r.from_user));
            saveAcceptedChats();
        } catch (err) { console.error('Error loading accepted chats:', err); }
    }

    // Particle animation
    const particleCanvas = document.getElementById('particleCanvas');
    const pCtx = particleCanvas.getContext('2d');
    let particles = [];
    function resizeCanvas() { particleCanvas.width = window.innerWidth; particleCanvas.height = window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * particleCanvas.width;
            this.y = Math.random() * particleCanvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.5 + 0.15;
            this.pulseSpeed = Math.random() * 0.02 + 0.005;
            this.pulseOffset = Math.random() * Math.PI * 2;
        }
        update(time) {
            this.x += this.speedX; this.y += this.speedY;
            if(this.x < -10) this.x = particleCanvas.width + 10;
            if(this.x > particleCanvas.width + 10) this.x = -10;
            if(this.y < -10) this.y = particleCanvas.height + 10;
            if(this.y > particleCanvas.height + 10) this.y = -10;
            this.currentOpacity = this.opacity + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.2;
            this.currentOpacity = Math.max(0.05, Math.min(0.8, this.currentOpacity));
        }
        draw(ctx) {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fillStyle = `rgba(180,200,255,${this.currentOpacity})`; ctx.fill();
            if(this.size > 1.2) {
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size*2.5, 0, Math.PI*2);
                ctx.fillStyle = `rgba(140,180,255,${this.currentOpacity*0.25})`; ctx.fill();
            }
        }
    }
    for(let i=0; i<80; i++) particles.push(new Particle());
    function animateParticles(ts) {
        pCtx.clearRect(0,0,particleCanvas.width,particleCanvas.height);
        particles.forEach(p => { p.update(ts); p.draw(pCtx); });
        for(let i=0; i<particles.length; i++) {
            for(let j=i+1; j<particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx*dx+dy*dy);
                if(dist < 100) {
                    const alpha = (1 - dist/100)*0.12;
                    pCtx.beginPath(); pCtx.moveTo(particles[i].x,particles[i].y); pCtx.lineTo(particles[j].x,particles[j].y);
                    pCtx.strokeStyle = `rgba(160,200,240,${alpha})`; pCtx.lineWidth = 0.5; pCtx.stroke();
                }
            }
        }
        requestAnimationFrame(animateParticles);
    }
    requestAnimationFrame(animateParticles);

    // Helper functions
    function escapeHtml(t) { const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}; return String(t).replace(/[&<>"']/g, m=>map[m]); }
    function trunc(t, l=45) { return t && t.length>l ? t.substring(0,l)+'…' : t||''; }
    function showError(msg) {
        errorToast.textContent = '⚠️ ' + msg; errorToast.classList.add('visible');
        clearTimeout(errorToast._timeout);
        errorToast._timeout = setTimeout(() => errorToast.classList.remove('visible'), 6000);
    }
    function setConnection(state) {
        isConnected = (state === 'connected');
        if(state === 'connected') {
            connDot.style.background = '#4ade80'; connDot.style.boxShadow = '0 0 8px rgba(74,222,128,0.7)';
            connText.textContent = 'Live'; connectionPill.className = 'badge-pill connected-pill';
            sidebarStatusDot.style.background = '#4ade80'; sidebarStatusDot.style.boxShadow = '0 0 8px rgba(74,222,128,0.7)';
            sidebarStatusText.textContent = 'Connected';
        } else if(state === 'disconnected') {
            connDot.style.background = '#ef4444'; connDot.style.boxShadow = '0 0 8px rgba(239,68,68,0.7)';
            connText.textContent = 'Disconnected'; connectionPill.className = 'badge-pill disconnected-pill';
            sidebarStatusDot.style.background = '#ef4444'; sidebarStatusDot.style.boxShadow = '0 0 8px rgba(239,68,68,0.7)';
            sidebarStatusText.textContent = 'Disconnected';
        } else {
            connDot.style.background = '#ffc107'; connDot.style.boxShadow = '0 0 6px rgba(255,193,7,0.5)';
            connText.textContent = 'Connecting…'; connectionPill.className = 'badge-pill';
            sidebarStatusDot.style.background = '#ffc107'; sidebarStatusDot.style.boxShadow = '0 0 6px rgba(255,193,7,0.5)';
            sidebarStatusText.textContent = 'Connecting…';
        }
    }
    function formatTime(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (msgDate.getTime() === today.getTime()) return `Today ${timeStr}`;
        else if (msgDate.getTime() === yesterday.getTime()) return `Yesterday ${timeStr}`;
        else return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    }

    // Avatar handling
    async function fetchAvatars(usernames) {
        const unique = [...new Set(usernames.filter(u => u && !avatarCache[u]))];
        if (unique.length === 0) return;
        const { data, error } = await supabase.from('profiles').select('username, avatar_url').in('username', unique);
        if (error) { console.warn('Error fetching avatars:', error); return; }
        (data||[]).forEach(p => { avatarCache[p.username] = p.avatar_url; });
    }
    function getAvatarURL(user) { return avatarCache[user] || null; }
    function renderAvatarHTML(user) {
        const url = getAvatarURL(user);
        if (url) return `<img src="${escapeHtml(url)}" alt="${escapeHtml(user)}" style="width:100%;height:100%;object-fit:cover;">`;
        return (user || '?')[0].toUpperCase();
    }

    // Image handling
    function resizeImage(file, maxDim=750) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let {width, height} = img;
                if(width <= maxDim && height <= maxDim) return resolve(file);
                const ratio = Math.min(maxDim/width, maxDim/height);
                width = Math.round(width*ratio); height = Math.round(height*ratio);
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,width,height);
                canvas.toBlob((blob) => {
                    const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/,'.jpg'), {type:'image/jpeg'});
                    resolve(resizedFile);
                }, 'image/jpeg', 0.85);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }
    async function uploadToStorage(file, bucket, maxDim=750) {
        const resized = await resizeImage(file, maxDim);
        const filename = `public/${Date.now()}_${Math.random().toString(36).substr(2,6)}.jpg`;
        const { data, error } = await supabase.storage.from(bucket).upload(filename, resized, {
            cacheControl: '3600', upsert: false, contentType: 'image/jpeg'
        });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
        return urlData.publicUrl;
    }
    async function attachChatImage(file) {
        uploadImgBtn.classList.add('uploading');
        try {
            const url = await uploadToStorage(file, STORAGE_BUCKET);
            pendingImageUrl = url;
            imagePreviewThumb.src = url;
            imagePreviewName.textContent = file.name;
            imagePreviewRow.classList.remove('hidden');
            uploadImgBtn.classList.add('has-image');
        } catch (err) { showError('Upload failed: ' + err.message); }
        finally { uploadImgBtn.classList.remove('uploading'); }
    }
    function clearAttachedImage() {
        pendingImageUrl = null;
        imagePreviewRow.classList.add('hidden');
        uploadImgBtn.classList.remove('has-image');
        fileInput.value = '';
    }

    // Reactions
    async function loadReactions(table, isPrivate) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) return;
        const target = isPrivate ? privateMessageReactions : messageReactions;
        for (const key of Object.keys(target)) delete target[key];
        (data||[]).forEach(r => {
            if (!target[r.message_id]) target[r.message_id] = {};
            if (!target[r.message_id][r.emoji]) target[r.message_id][r.emoji] = { count:0, users: new Set() };
            target[r.message_id][r.emoji].count++;
            target[r.message_id][r.emoji].users.add(r.username);
        });
        document.querySelectorAll('.msg-wrapper').forEach(w => updateReactionUI(w, isPrivate));
    }
    function subscribeReactions() {
        if (reactionsChannel) supabase.removeChannel(reactionsChannel);
        reactionsChannel = supabase.channel('pub-react')
            .on('postgres_changes', { event:'*', schema:'public', table:'message_reactions' }, () => loadReactions('message_reactions', false))
            .subscribe();
        if (privReactionsChannel) supabase.removeChannel(privReactionsChannel);
        privReactionsChannel = supabase.channel('priv-react')
            .on('postgres_changes', { event:'*', schema:'public', table:'private_message_reactions' }, () => loadReactions('private_message_reactions', true))
            .subscribe();
    }
    function updateReactionUI(wrapper, isPrivate) {
        const msgId = wrapper.getAttribute('data-msg-id');
        const bar = wrapper.querySelector('.reactions-bar');
        if (!bar) return;
        const reactions = (isPrivate ? privateMessageReactions : messageReactions)[msgId] || {};
        bar.innerHTML = EMOJIS.map(emoji => {
            const data = reactions[emoji] || { count:0, users: new Set() };
            const active = data.users.has(username) ? 'active' : '';
            return `<button class="reaction-btn ${active}" data-emoji="${emoji}">${emoji} ${data.count}</button>`;
        }).join('');
        bar.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                toggleReaction(msgId, btn.dataset.emoji, isPrivate);
            });
        });
    }
    async function toggleReaction(messageId, emoji, isPrivate) {
        const table = isPrivate ? 'private_message_reactions' : 'message_reactions';
        const { data: existing } = await supabase.from(table)
            .select('id').match({ message_id: messageId, username, emoji }).single();
        if (existing) await supabase.from(table).delete().eq('id', existing.id);
        else await supabase.from(table).insert({ message_id: messageId, username, emoji });
    }

    // Message rendering & actions
    async function scrollToMessage(msgId) {
        const container = currentTab === 'public' ? publicContainer : privateContainer;
        let target = container.querySelector(`.msg-wrapper[data-msg-id="${msgId}"]`);
        if (!target) {
            const table = currentTab === 'public' ? 'messages' : 'private_messages';
            const { data, error } = await supabase.from(table).select('*').eq('id', msgId).single();
            if (error || !data) { showError('Original message could not be loaded.'); return; }
            const user = currentTab === 'public' ? data.username : data.from_user;
            if (!getAvatarURL(user)) await fetchAvatars([user]);
            await renderMessage(data, currentTab === 'private');
            target = container.querySelector(`.msg-wrapper[data-msg-id="${msgId}"]`);
        }
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlight-flash');
            setTimeout(() => target.classList.remove('highlight-flash'), 800);
        } else {
            showError('Original message not found.');
        }
    }

    async function renderMessage(msg, isPrivate = false) {
        if(knownMessageIds.has(msg.id)) return;
        knownMessageIds.add(msg.id);
        const container = isPrivate ? privateContainer : publicContainer;
        const emptyHint = isPrivate ? privateEmptyHint : publicEmptyHint;
        if(emptyHint) emptyHint.style.display = 'none';
        const user = isPrivate ? msg.from_user : msg.username;
        if (!getAvatarURL(user)) await fetchAvatars([user]);
        const isOwn = user === username;
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper' + (isOwn ? ' own' : '');
        wrapper.setAttribute('data-msg-id', msg.id);
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        if(isPrivate) bubble.classList.add('private-msg');

        let innerHTML = '';
        if (msg.reply_to_username && (msg.reply_to_message || msg.reply_to_image_url)) {
            let imageThumb = '';
            if (msg.reply_to_image_url) {
                imageThumb = `<img src="${escapeHtml(msg.reply_to_image_url)}" alt="replied image" class="reply-image-thumb">`;
            }
            const replyText = msg.reply_to_message
                ? `"${escapeHtml(trunc(msg.reply_to_message,55))}"`
                : '🖼️ Image';
            innerHTML += `<div class="reply-ref-block" data-reply-to-id="${msg.reply_to_id || ''}">
                ${imageThumb}
                <div class="reply-text-content">
                    <span class="r-user">↳ ${escapeHtml(msg.reply_to_username)}</span>
                    <span class="r-text">${replyText}</span>
                </div>
            </div>`;
        }
        innerHTML += `<div class="msg-username"><span class="msg-avatar">${renderAvatarHTML(user)}</span> ${escapeHtml(user)}${isPrivate?' <span style="font-size:0.6rem;opacity:0.6;">🔒</span>':''} <span class="msg-time">${formatTime(msg.created_at)}</span>`;
        if (msg.edited_at) innerHTML += `<span class="msg-edited">(edited)</span>`;
        innerHTML += `</div>`;

        if (msg.is_deleted) {
            innerHTML += `<div class="msg-text deleted">Message removed</div>`;
        } else {
            if (msg.message) innerHTML += `<div class="msg-text">${escapeHtml(msg.message)}</div>`;
        }
        if (msg.image_url && !msg.is_deleted) {
            innerHTML += `<div class="msg-image-wrap" data-img-src="${escapeHtml(msg.image_url)}"><img src="${escapeHtml(msg.image_url)}" alt="shared image" loading="lazy"></div>`;
        }
        innerHTML += `<div class="msg-actions-container">`;
        innerHTML += `<button class="msg-action-btn reply-btn" data-id="${msg.id}" data-username="${escapeHtml(user)}" data-message="${escapeHtml(msg.message||'')}" data-imageurl="${msg.image_url || ''}">↩ Reply</button>`;
        if (isOwn && !msg.is_deleted) {
            innerHTML += `<button class="msg-action-btn edit-btn" data-id="${msg.id}">✎</button>`;
            innerHTML += `<button class="msg-action-btn delete-btn" data-id="${msg.id}">✕</button>`;
        }
        innerHTML += `</div>`;
        innerHTML += `<div class="reactions-bar"></div>`;

        bubble.innerHTML = innerHTML;
        wrapper.appendChild(bubble);
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        const replyBtn = bubble.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const btn = e.currentTarget;
                setReplyingTo({
                    id: btn.dataset.id,
                    username: btn.dataset.username,
                    message: btn.dataset.message,
                    imageUrl: btn.dataset.imageurl || null
                });
            });
        }
        const imgWrap = bubble.querySelector('.msg-image-wrap');
        if (imgWrap) {
            imgWrap.addEventListener('click', (e) => {
                e.stopPropagation();
                const src = imgWrap.dataset.imgSrc;
                if (src) { lightboxImg.src = src; lightboxOverlay.classList.remove('hidden'); }
            });
        }
        const replyRef = bubble.querySelector('.reply-ref-block');
        if (replyRef && msg.reply_to_id) {
            replyRef.addEventListener('click', () => scrollToMessage(msg.reply_to_id));
        }

        if (isOwn && !msg.is_deleted) {
            const editBtn = bubble.querySelector('.edit-btn');
            const deleteBtn = bubble.querySelector('.delete-btn');
            if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); startEditMessage(msg, isPrivate); });
            if (deleteBtn) deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(msg, isPrivate); });
        }
        updateReactionUI(wrapper, isPrivate);
    }

    function setReplyingTo(ref) {
        replyingTo = ref;
        const thumbEl = document.getElementById('replyPreviewThumb');
        if (ref) {
            replyIndicatorBar.classList.remove('hidden');
            replyToUserDisp.textContent = '@' + ref.username;
            let preview = trunc(ref.message, 40);
            if (ref.imageUrl) {
                preview = '🖼️ ' + preview;
                thumbEl.src = ref.imageUrl;
                thumbEl.classList.remove('hidden');
            } else {
                thumbEl.src = '';
                thumbEl.classList.add('hidden');
            }
            replyPreviewDisp.textContent = '"' + preview + '"';
            messageInput.focus();
        } else {
            replyingTo = null;
            replyIndicatorBar.classList.add('hidden');
            replyToUserDisp.textContent = '';
            replyPreviewDisp.textContent = '';
            thumbEl.src = '';
            thumbEl.classList.add('hidden');
        }
    }

    document.getElementById('replyPreviewThumb').addEventListener('click', function() {
        if (this.src && this.src !== '') {
            lightboxImg.src = this.src;
            lightboxOverlay.classList.remove('hidden');
        }
    });

    function startEditMessage(msg, isPrivate) {
        const wrapper = document.querySelector(`.msg-wrapper[data-msg-id="${msg.id}"]`);
        if (!wrapper) return;
        const bubble = wrapper.querySelector('.msg-bubble');
        const textDiv = bubble.querySelector('.msg-text');
        if (!textDiv) return;
        const currentText = msg.message || '';
        textDiv.innerHTML = `<input type="text" class="edit-input" value="${escapeHtml(currentText)}" id="editInput-${msg.id}" style="width:100%; background:#0d0d20; border:1px solid var(--accent-cyan); color:#e0e0f2; padding:4px 8px; border-radius:6px; font-size:0.85rem;">
            <div style="display:flex; gap:4px; margin-top:4px;">
                <button class="msg-action-btn save-edit" data-id="${msg.id}">Save</button>
                <button class="msg-action-btn cancel-edit" data-id="${msg.id}">Cancel</button>
            </div>`;
        const saveBtn = bubble.querySelector('.save-edit');
        const cancelBtn = bubble.querySelector('.cancel-edit');
        const input = bubble.querySelector('.edit-input');
        input.focus();
        cancelBtn.addEventListener('click', () => textDiv.innerHTML = escapeHtml(currentText));
        saveBtn.addEventListener('click', async () => {
            const newText = input.value.trim();
            if (!newText) return;
            const table = isPrivate ? 'private_messages' : 'messages';
            const { error } = await supabase.from(table).update({ message: newText, edited_at: new Date().toISOString() }).eq('id', msg.id);
            if (error) { showError('Edit failed'); return; }
            msg.message = newText;
            msg.edited_at = new Date().toISOString();
            textDiv.innerHTML = escapeHtml(newText);
            const timeSpan = bubble.querySelector('.msg-time');
            if (timeSpan) {
                let editedSpan = bubble.querySelector('.msg-edited');
                if (!editedSpan) {
                    editedSpan = document.createElement('span');
                    editedSpan.className = 'msg-edited';
                    timeSpan.parentNode.insertBefore(editedSpan, timeSpan.nextSibling);
                }
                editedSpan.textContent = '(edited)';
            }
        });
    }

    async function deleteMessage(msg, isPrivate) {
        if (!confirm('Delete this message?')) return;
        const table = isPrivate ? 'private_messages' : 'messages';
        const { error } = await supabase.from(table).update({ is_deleted: true }).eq('id', msg.id);
        if (error) { showError('Delete failed'); return; }
        msg.is_deleted = true;
        const wrapper = document.querySelector(`.msg-wrapper[data-msg-id="${msg.id}"]`);
        if (wrapper) {
            const bubble = wrapper.querySelector('.msg-bubble');
            const textDiv = bubble.querySelector('.msg-text');
            if (textDiv) textDiv.innerHTML = '<span class="msg-text deleted">Message removed</span>';
            const actions = bubble.querySelector('.msg-actions-container');
            if (actions) actions.style.display = 'none';
            const imgWrap = bubble.querySelector('.msg-image-wrap');
            if (imgWrap) imgWrap.style.display = 'none';
        }
    }

    // Typing indicators
    function startTyping() {
        if (!username || !typingChannel) return;
        const tab = currentTab === 'private' && activePrivateChat ? 'private' : 'public';
        const partner = tab === 'private' ? activePrivateChat : null;
        typingChannel.send({ type: 'broadcast', event: 'typing', payload: { username, tab, partner } }).then(() => {}).catch(console.warn);
    }
    function stopTyping() {
        if (!username || !typingChannel) return;
        typingChannel.send({ type: 'broadcast', event: 'stop_typing', payload: { username } }).then(() => {}).catch(console.warn);
    }
    messageInput.addEventListener('input', () => {
        if (messageInput.value.length > 0) startTyping();
        else stopTyping();
    });
    function handleTypingBroadcast(payload) {
        const { event, username: sender, tab, partner } = payload;
        if (sender === username) return;
        if (event === 'typing') {
            if (typingUsers.has(sender)) clearTimeout(typingUsers.get(sender).timeoutId);
            const timeoutId = setTimeout(() => { typingUsers.delete(sender); updateTypingIndicator(); }, 3000);
            typingUsers.set(sender, { tab, partner, timeoutId });
        } else if (event === 'stop_typing') {
            if (typingUsers.has(sender)) {
                clearTimeout(typingUsers.get(sender).timeoutId);
                typingUsers.delete(sender);
            }
        }
        updateTypingIndicator();
    }
    function updateTypingIndicator() {
        const typersPublic = [];
        const typersPrivate = {};
        typingUsers.forEach((data, user) => {
            if (data.tab === 'public') typersPublic.push(user);
            else if (data.tab === 'private' && data.partner === username) typersPrivate[user] = true;
        });
        let text = '';
        const dots = '<span class="typing-dots"><span></span><span></span><span></span></span>';
        if (currentTab === 'public') {
            if (typersPublic.length === 1) text = `${typersPublic[0]} is typing... ${dots}`;
            else if (typersPublic.length > 1) text = `Several people are typing... ${dots}`;
        } else if (currentTab === 'private' && activePrivateChat) {
            if (typersPrivate[activePrivateChat]) text = `${activePrivateChat} is typing... ${dots}`;
        }
        typingIndicator.innerHTML = text || '';
    }
    function setupTypingChannel() {
        if (typingChannel) supabase.removeChannel(typingChannel);
        typingChannel = supabase.channel('typing-broadcast', { config: { broadcast: { self: false } } });
        typingChannel.on('broadcast', { event: 'typing' }, (payload) => handleTypingBroadcast(payload.payload));
        typingChannel.on('broadcast', { event: 'stop_typing' }, (payload) => handleTypingBroadcast(payload.payload));
        typingChannel.subscribe();
    }

    // Presence
    function setupPresence() {
        if (presenceChannel) return;
        if (!username) return;
        const presenceKey = `${username}::${clientId}`;
        presenceChannel = supabase.channel('msn-chat-presence', { config:{ presence:{ key:presenceKey } } });
        presenceChannel
            .on('presence', { event:'sync' }, () => {
                const state = presenceChannel.presenceState();
                onlineUsers.clear();
                Object.keys(state).forEach(key => {
                    const presences = state[key];
                    if(presences && presences.length>0) {
                        const p = presences[0];
                        onlineUsers.set(key, { username: p.username||key.split('::')[0]||'Unknown', client_id:p.client_id||'', online_at:p.online_at||'' });
                    }
                });
                updateSidebarUI();
                setConnection('connected');
            })
            .on('presence', { event:'join' }, ({key, newPresences}) => {
                if(newPresences && newPresences.length>0) {
                    const p = newPresences[0];
                    onlineUsers.set(key, { username: p.username||key.split('::')[0]||'Unknown', client_id:p.client_id||'', online_at:p.online_at||'' });
                }
                updateSidebarUI();
            })
            .on('presence', { event:'leave' }, ({key}) => { onlineUsers.delete(key); updateSidebarUI(); })
            .subscribe(async (status) => {
                if(status==='SUBSCRIBED') {
                    await presenceChannel.track({ username:username, client_id:clientId, online_at:new Date().toISOString() });
                    setConnection('connected');
                }
            });
    }
    function reTrackPresence() {
        if (username && presenceChannel) {
            presenceChannel.track({ username:username, client_id:clientId, online_at:new Date().toISOString() }).catch(console.warn);
        }
    }

    // Tabs & Private Chat
    function switchTab(tabName) {
        currentTab = tabName;
        const tabs = chatTabs.querySelectorAll('.chat-tab');
        tabs.forEach(t => t.classList.remove('active'));
        const activeTab = chatTabs.querySelector(`[data-tab="${tabName}"]`);
        if(activeTab) activeTab.classList.add('active');
        if(tabName === 'public') {
            publicContainer.classList.remove('hidden');
            privateContainer.classList.add('hidden');
            privateIndicatorBar.classList.add('hidden');
            messageInput.placeholder = 'Type a message...';
            setTimeout(() => { scrollContainerToBottom(publicContainer); updateScrollButtonVisibility(publicContainer); }, 150);
        } else {
            publicContainer.classList.add('hidden');
            privateContainer.classList.remove('hidden');
            if(activePrivateChat) {
                privateIndicatorBar.classList.remove('hidden');
                privateChatUserDisp.textContent = activePrivateChat;
                messageInput.placeholder = `Private message to ${activePrivateChat}...`;
            } else {
                privateIndicatorBar.classList.add('hidden');
                messageInput.placeholder = 'Select a partner from the sidebar first.';
            }
            setTimeout(() => { scrollContainerToBottom(privateContainer); updateScrollButtonVisibility(privateContainer); }, 150);
        }
        updateTypingIndicator();
        if (messageInput.value.length > 0) startTyping();
    }
    chatTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.chat-tab');
        if(!tab) return;
        const tabName = tab.getAttribute('data-tab');
        if(tabName === 'private' && !activePrivateChat) {
            showError('Select a private chat partner from the sidebar first.');
            return;
        }
        switchTab(tabName);
    });

    function setActivePrivateChat(partnerUsername) {
        activePrivateChat = partnerUsername;
        localStorage.setItem(ACTIVE_CHAT_KEY, partnerUsername || '');
        if(partnerUsername) {
            privateIndicatorBar.classList.remove('hidden');
            privateChatUserDisp.textContent = partnerUsername;
            setReplyingTo(null);
            messageInput.placeholder = `Private message to ${partnerUsername}...`;
            // Force switch to private tab regardless of current tab
            switchTab('private');
            loadPrivateMessages(partnerUsername);
        } else {
            activePrivateChat = null;
            privateIndicatorBar.classList.add('hidden');
            privateChatUserDisp.textContent = '';
            messageInput.placeholder = 'Type a message...';
            switchTab('public');
        }
        updateSidebarUI();
        updateTypingIndicator();
        if (messageInput.value.length > 0) startTyping();
    }
    cancelPrivateBtn.addEventListener('click', () => setActivePrivateChat(null));

    async function loadPrivateMessages(partner) {
        privateContainer.innerHTML = '<div class="empty-chat-hint">Loading…</div>';
        const { data, error } = await supabase
            .from('private_messages')
            .select('*')
            .or(`and(from_user.eq.${username},to_user.eq.${partner}),and(from_user.eq.${partner},to_user.eq.${username})`)
            .order('sort_order', { ascending: true });
        if (error) { showError('Failed to load private messages'); return; }
        data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        privateContainer.innerHTML = '';
        if (data.length === 0) {
            privateContainer.innerHTML = '<div class="empty-chat-hint">No private messages with this user.</div>';
        } else {
            const users = [...new Set(data.flatMap(m => [m.from_user, m.to_user]))];
            await fetchAvatars(users);
            for (const msg of data) await renderMessage(msg, true);
        }
        loadReactions('private_message_reactions', true);
        setTimeout(() => { scrollContainerToBottom(privateContainer); updateScrollButtonVisibility(privateContainer); }, 150);
    }

    // Sidebar UI
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
        if (sidebarActiveUsersCount) sidebarActiveUsersCount.textContent = onlineUsers.size;

        sidebarUsers.querySelectorAll('.sidebar-user-item').forEach(item => {
            const userName = item.getAttribute('data-username');
            const privateBtn = item.querySelector('.private-btn');
            if(privateBtn && userName !== username) {
                privateBtn.addEventListener('click', (e) => { e.stopPropagation(); handlePrivateChatClick(userName); });
                // Add touch event for mobile
                privateBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePrivateChatClick(userName);
                });
            }
            if(userName !== username) {
                item.addEventListener('click', () => {
                    if(activePrivateChat === userName) switchTab('private');
                    else handlePrivateChatClick(userName);
                });
                // Add touch event for mobile
                item.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if(activePrivateChat === userName) switchTab('private');
                    else handlePrivateChatClick(userName);
                });
            }
        });
        updateChatAccessibility();
    }
    function buildSidebarItem(userName, isOnline, isPending, isSelf=false, isAccepted=false) {
        const avatarURL = getAvatarURL(userName);
        const avatarHTML = avatarURL
            ? `<img src="${escapeHtml(avatarURL)}" alt="${escapeHtml(userName)}">`
            : (userName.charAt(0)||'?').toUpperCase();
        let btnClass = 'private-btn', btnText = 'Request';
        if(isAccepted) { btnClass += ' accepted'; btnText = 'Chat'; }
        else if(isPending) { btnClass += ' pending'; btnText = 'Accept?'; }
        return `<div class="sidebar-user-item${isSelf?' you-tag':''}" data-username="${escapeHtml(userName)}">
            <div class="user-avatar">${avatarHTML}${isOnline?'<span class="online-indicator"></span>':''}</div>
            <div class="user-info"><div class="user-name">${escapeHtml(userName)}</div><div class="user-status-text">${isSelf?'You':'Online'}</div></div>
            ${!isSelf ? `<button class="${btnClass}">${btnText}</button>` : ''}
        </div>`;
    }

    // Private chat requests
    function showRequestOverlay(fromUser, requestId) {
        currentRequestData = { from_user: fromUser, id: requestId };
        const url = getAvatarURL(fromUser);
        requestAvatar.innerHTML = url ? `<img src="${escapeHtml(url)}">` : (fromUser[0]?.toUpperCase() || '?');
        requestName.textContent = `${fromUser} wants to chat privately`;
        requestOverlay.classList.remove('hidden');
    }
    function hideRequestOverlay() {
        requestOverlay.classList.add('hidden');
        currentRequestData = null;
    }
    requestAcceptBtn.addEventListener('click', async () => {
        if (!currentRequestData) return;
        await acceptPrivateRequest(currentRequestData.from_user, currentRequestData.id);
        hideRequestOverlay();
    });
    requestDeclineBtn.addEventListener('click', () => {
        if (!currentRequestData) return;
        supabase.from('private_chat_requests').delete().eq('id', currentRequestData.id).then(() => {
            pendingPrivateRequests.delete(currentRequestData.from_user);
            updateSidebarUI();
        });
        hideRequestOverlay();
    });

    async function handlePrivateChatClick(targetUser) {
        if(acceptedPrivateChats.has(targetUser)) {
            setActivePrivateChat(targetUser);
            return;
        }
        if(pendingPrivateRequests.has(targetUser)) {
            const req = pendingPrivateRequests.get(targetUser);
            if(req.status === 'pending' && req.from_user === targetUser) {
                showRequestOverlay(targetUser, req.id);
                return;
            }
        }
        await sendPrivateRequest(targetUser);
    }
    async function sendPrivateRequest(toUser) {
        const { data: existing } = await supabase
            .from('private_chat_requests')
            .select('id')
            .eq('from_user', username)
            .eq('to_user', toUser)
            .eq('status', 'pending')
            .maybeSingle();
        if (existing) {
            showError('📩 Request already sent');
            return;
        }
        try {
            const { error } = await supabase.from('private_chat_requests').insert({
                from_user: username,
                to_user: toUser,
                status: 'pending'
            });
            if(error) { showError('Request failed: ' + error.message); return; }
            showError('📩 Request sent to ' + toUser);
            updateSidebarUI();
        } catch(err) { showError('Error: '+err.message); }
    }
    async function acceptPrivateRequest(fromUser, requestId) {
        try {
            const { error } = await supabase.from('private_chat_requests')
                .update({status:'accepted'})
                .eq('id', requestId);
            if(error) throw error;
            pendingPrivateRequests.delete(fromUser);
            acceptedPrivateChats.add(fromUser);
            saveAcceptedChats();
            if (activePrivateChat !== fromUser) {
                setActivePrivateChat(fromUser);
            }
            updateSidebarUI();
            showError('✅ Chat with ' + fromUser + ' active!');
        } catch(err) { showError('Accept error: '+err.message); }
    }
    async function loadPendingRequests() {
        if(!username) return;
        try {
            const { data, error } = await supabase.from('private_chat_requests')
                .select('*')
                .or(`to_user.eq.${username},from_user.eq.${username}`)
                .order('created_at', {ascending:false});
            if(error) return;
            pendingPrivateRequests.clear();
            (data||[]).forEach(req => {
                if(req.status === 'pending' && req.to_user === username) {
                    pendingPrivateRequests.set(req.from_user, {status:'pending', id:req.id, from_user:req.from_user});
                }
            });
            updateSidebarUI();
        } catch(err) {
            console.error('Error loading pending requests:', err);
        }
    }
    function subscribeToPrivateRequests() {
        if(!username) return;
        if(privateRequestsChannel) supabase.removeChannel(privateRequestsChannel);
        privateRequestsChannel = supabase.channel('msn-private-requests')
            .on('postgres_changes', { event:'*', schema:'public', table:'private_chat_requests' }, (payload) => {
                const record = payload.new || payload.old;
                if(!record) return;
                if(record.to_user === username && record.status === 'pending') {
                    pendingPrivateRequests.set(record.from_user, {status:'pending', id:record.id, from_user:record.from_user});
                    updateSidebarUI();
                    fetchAvatars([record.from_user]).then(() => showRequestOverlay(record.from_user, record.id));
                    return;
                }
                if(record.status === 'accepted') {
                    const partner = record.from_user === username ? record.to_user : record.from_user;
                    if (activePrivateChat !== partner) {
                        acceptedPrivateChats.add(partner);
                        saveAcceptedChats();
                        setActivePrivateChat(partner);
                    }
                }
            }).subscribe();
    }

    // Load and send messages
    async function loadMessages() {
        setConnection('connecting');
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .order('sort_order', { ascending: false })
                .limit(80);
            if (error) throw error;
            data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            publicContainer.innerHTML = '';
            knownMessageIds.clear();
            if (data.length === 0) {
                publicContainer.innerHTML = '<div class="empty-chat-hint">No messages yet. ⚡</div>';
            } else {
                const users = [...new Set(data.map(m => m.username))];
                await fetchAvatars(users);
                for (const msg of data) await renderMessage(msg, false);
            }
            setConnection('connected');
            setTimeout(() => { scrollContainerToBottom(publicContainer); updateScrollButtonVisibility(publicContainer); }, 150);
        } catch (err) {
            showError('Load failed: ' + err.message);
            setConnection('disconnected');
        }
    }

    async function sendMessage() {
        let canSend = false;
        if (username) {
            if (modTokenRequirement <= 0) canSend = true;
            else canSend = phantomConnected && hasTokenAccess;
        }
        if (!canSend) {
            showError(modTokenRequirement <= 0 ? 'Set your username first' : `You need Phantom connected and more than ${modTokenRequirement} tokens to chat.`);
            return;
        }

        if (modCooldownSeconds > 0) {
            const now = Date.now();
            if (now - lastMessageTimestamp < modCooldownSeconds * 1000) {
                const remaining = Math.ceil((modCooldownSeconds * 1000 - (now - lastMessageTimestamp)) / 1000);
                showCooldown(remaining);
                return;
            }
        }

        const text = messageInput.value.trim();
        if (!text && !pendingImageUrl) return;
        sendBtn.disabled = true;
        const isPrivate = (currentTab === 'private' && activePrivateChat);
        if (isPrivate && !activePrivateChat) {
            showError('No private partner selected.');
            sendBtn.disabled = false;
            return;
        }

        let table = isPrivate ? 'private_messages' : 'messages';
        let payload = {
            message: text || null,
            image_url: pendingImageUrl || null,
            created_at: new Date().toISOString()
        };
        if (replyingTo?.id) {
            payload.reply_to_id = replyingTo.id;
            payload.reply_to_username = replyingTo.username;
            payload.reply_to_message = replyingTo.message || null;
            if (replyingTo.imageUrl) payload.reply_to_image_url = replyingTo.imageUrl;
        }
        if (isPrivate) {
            payload.from_user = username;
            payload.to_user = activePrivateChat;
        } else {
            payload.username = username;
        }

        try {
            const { error } = await supabase.from(table).insert([payload]);
            if (error) throw error;
            messageInput.value = '';
            setReplyingTo(null);
            clearAttachedImage();
            stopTyping();
            startCooldown(modCooldownSeconds);
        } catch (err) {
            showError('Send failed: ' + err.message);
        } finally {
            sendBtn.disabled = false;
            messageInput.focus();
        }
    }

    function subscribeToRealtime() {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        realtimeChannel = supabase.channel('public-msgs')
            .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
                renderMessage(payload.new, false);
                setConnection('connected');
                const isNearBottom = publicContainer.scrollHeight - publicContainer.scrollTop - publicContainer.clientHeight < 80;
                if (isNearBottom) scrollContainerToBottom(publicContainer);
            })
            .subscribe();

        if (privMsgChannel) supabase.removeChannel(privMsgChannel);
        privMsgChannel = supabase.channel('private-msgs')
            .on('postgres_changes', { event:'INSERT', schema:'public', table:'private_messages' }, payload => {
                const msg = payload.new;
                if (activePrivateChat && ((msg.from_user === username && msg.to_user === activePrivateChat) || (msg.from_user === activePrivateChat && msg.to_user === username))) {
                    renderMessage(msg, true);
                    const isNearBottom = privateContainer.scrollHeight - privateContainer.scrollTop - privateContainer.clientHeight < 80;
                    if (isNearBottom) scrollContainerToBottom(privateContainer);
                }
            })
            .subscribe();
    }

    async function fullReconnect() {
        refreshBtn.classList.add('spinning');
        setConnection('connecting');
        subscribeToRealtime();
        if(username) { setupPresence(); subscribeToPrivateRequests(); await loadPendingRequests(); }
        await loadMessages();
        loadReactions('message_reactions', false);
        loadReactions('private_message_reactions', true);
        subscribeReactions();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 700);
    }

    async function applyUsername(name) {
        username = name;
        localStorage.setItem(STORAGE_KEY_NAME, name);

        if(profilePicFile) {
            try {
                const url = await uploadToStorage(profilePicFile, AVATAR_BUCKET, 300);
                await supabase.from('profiles').upsert({ username: name, avatar_url: url });
                avatarCache[name] = url;
                if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
            } catch(err) { showError('Avatar upload failed: ' + err.message); }
        } else {
            const initial = (name[0]||'?').toUpperCase();
            if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = initial;
        }
        if (sidebarBigName) sidebarBigName.textContent = name;

        inputAreaBar.classList.remove('hidden');
        nameOverlay.classList.add('hidden');
        setReplyingTo(null);
        setActivePrivateChat(null);
        switchTab('public');
        await updateSidebarUI();
        setupTypingChannel();
        updateChatAccessibility();
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => { if(e.key==='Enter') sendMessage(); });
    cancelReplyBtn.addEventListener('click', () => setReplyingTo(null));
    refreshBtn.addEventListener('click', fullReconnect);
    uploadImgBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0]; if(!file) return;
        await attachChatImage(file);
        fileInput.value = '';
    });
    imagePreviewRemove.addEventListener('click', clearAttachedImage);
    [publicContainer, privateContainer].forEach(container => {
        container.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
        container.addEventListener('drop', async e => {
            e.preventDefault(); e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if(!file || !file.type.startsWith('image/')) return;
            await attachChatImage(file);
        });
    });
    document.addEventListener('paste', async e => {
        const items = e.clipboardData?.items; if(!items) return;
        for(const item of items) {
            if(item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                await attachChatImage(file);
                break;
            }
        }
    });
    lightboxOverlay.addEventListener('click', () => lightboxOverlay.classList.add('hidden'));

    profilePicPreview.addEventListener('click', () => profilePicInput.click());
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        profilePicFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => { profilePicPreview.innerHTML = `<img src="${ev.target.result}" alt="Profile">`; };
        reader.readAsDataURL(file);
    });

    nameSubmitBtn.addEventListener('click', async () => {
        const newName = nameInput.value.trim(); if(!newName) return;
        await applyUsername(newName);
        await loadMessages();
        subscribeToRealtime();
        setupPresence();
        subscribeToPrivateRequests();
        loadPendingRequests();
        loadReactions('message_reactions', false);
        loadReactions('private_message_reactions', true);
        subscribeReactions();
    });
    nameInput.addEventListener('keypress', (e) => { if(e.key==='Enter') nameSubmitBtn.click(); });

    // Sidebar and mobile edit profile buttons
    sidebarChangeNameBtn.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY_NAME);
        username = '';
        inputAreaBar.classList.add('hidden');
        nameOverlay.classList.remove('hidden');
        nameInput.value = '';
        nameInput.focus();
        setReplyingTo(null);
        setActivePrivateChat(null);
        if(presenceChannel) { presenceChannel.untrack(); supabase.removeChannel(presenceChannel); presenceChannel = null; }
        onlineUsers.clear();
        updateSidebarUI();
    });
    if (mobileEditBtn) {
        mobileEditBtn.addEventListener('click', () => {
            sidebarChangeNameBtn.click();
        });
    }

    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.getElementById('chatPanel').addEventListener('click', (e) => {
        if(window.innerWidth<=768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target!==sidebarToggle && !sidebarToggle.contains(e.target)) {
            // Don't close if request overlay is open
            if (!requestOverlay.classList.contains('hidden')) return;
            sidebar.classList.remove('open');
        }
    });

    // Init
    async function init() {
        if(window.innerWidth<=768) sidebarToggle.classList.remove('hidden');
        await loadSettings();
        subscribeToSettings();
        await loadAcceptedChatsFromDB();
        initPhantomAutoConnect();

        // Hide input area initially
        inputAreaBar.classList.add('hidden');

        if(username) {
            const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('username', username).single();
            if(profile && profile.avatar_url) {
                avatarCache[username] = profile.avatar_url;
                if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                const initial = (username[0]||'?').toUpperCase();
                if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = initial;
            }
            if (sidebarBigName) sidebarBigName.textContent = username;
            inputAreaBar.classList.remove('hidden');
            nameOverlay.classList.add('hidden');
            setReplyingTo(null);
            setActivePrivateChat(null);
            switchTab('public');
            await updateSidebarUI();

            await loadMessages();
            subscribeToRealtime();
            setupPresence();
            subscribeToPrivateRequests();
            loadPendingRequests();
            loadReactions('message_reactions', false);
            loadReactions('private_message_reactions', true);
            subscribeReactions();
            setupTypingChannel();
            updateChatAccessibility();

            const savedActiveChat = localStorage.getItem(ACTIVE_CHAT_KEY);
            if (savedActiveChat && acceptedPrivateChats.has(savedActiveChat)) {
                setActivePrivateChat(savedActiveChat);
            }
        } else {
            nameOverlay.classList.remove('hidden');
            nameInput.focus();
            subscribeToRealtime();
        }
        document.addEventListener('visibilitychange', () => {
            if(document.visibilityState==='visible' && !isConnected && username) fullReconnect();
        });
        setInterval(() => { if(!isConnected && username) fullReconnect(); }, 35000);
        window.addEventListener('resize', () => {
            if(window.innerWidth<=768) sidebarToggle.classList.remove('hidden');
            else { sidebarToggle.classList.add('hidden'); sidebar.classList.remove('open'); }
        });
    }
    init();
})();
