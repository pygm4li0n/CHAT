(function() {
    const SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';
    const STORAGE_BUCKET = 'chat-images';
    const AVATAR_BUCKET = 'chat-avatars';

    // ═══════════════════════════════════════════════════════════
    //  ⚑ PHANTOM / MOBILE VISUAL FIXES + RIGHT SIDEBAR — injected once
    // ═══════════════════════════════════════════════════════════
    (function injectPhantomFixes() {
        if (document.querySelector('style[data-msn-phantom-fixes]')) return;
        const css = `
            /* ── Phantom connect button ── */
            .btn-icon.phantom-btn,
            #phantomConnectBtn {
                width: 44px !important;
                height: 44px !important;
                position: relative;
                flex-shrink: 0 !important;
                transition: background 0.25s, border-color 0.25s, box-shadow 0.25s;
            }
            .btn-icon.phantom-btn img,
            #phantomConnectBtn img {
                width: 24px !important;
                height: 24px !important;
                filter: drop-shadow(0 0 4px rgba(153, 69, 255, 0.5));
            }
            .btn-icon.phantom-btn.connected,
            #phantomConnectBtn.connected {
                background: linear-gradient(180deg, #2ecc71 0%, #1a9e52 100%) !important;
                border-color: #4ade80 !important;
                box-shadow:
                    0 0 14px rgba(46, 204, 113, 0.7),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
            }
            .btn-icon.phantom-btn.connected img,
            #phantomConnectBtn.connected img {
                filter: brightness(1.2) drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
            }
            .btn-icon.phantom-btn.connected::after,
            #phantomConnectBtn.connected::after {
                content: '';
                position: absolute;
                top: -3px; right: -3px;
                width: 11px; height: 11px;
                border-radius: 50%;
                background: #4ade80;
                border: 2px solid var(--bg-panel, #01091A);
                box-shadow: 0 0 8px #4ade80;
                animation: phantomDotPulse 2s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes phantomDotPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50%      { opacity: 0.55; transform: scale(0.82); }
            }

            /* ═══════════════════════════════════════════════════════════
               ⚑ HEADER LAYOUT — desktop + mobile
            ═══════════════════════════════════════════════════════════ */
            #connectionPill,
            #onlineCountBadge {
                display: none !important;
            }
            .header-right {
                justify-content: flex-end !important;
                align-items: center !important;
            }
            .header-right #walletAddress {
                order: 1;
                min-width: 0;
                max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                text-align: right;
                margin-right: 4px;
            }
            .header-right #phantomConnectBtn {
                order: 2;
                flex-shrink: 0 !important;
            }
            .header-right #refreshBtn {
                order: 3;
                flex-shrink: 0 !important;
            }
            .header-right #mobileEditBtn {
                order: 4;
            }
            .header-right #rankingsBtn {
                order: 5;
            }
            .header-right #modSettingsBtn {
                order: 6;
            }
            .header-right #headerThemeBtn {
                order: 7;
            }
            .header-right #walletAddress:empty {
                display: none !important;
            }

            /* ── Rankings trophy button ── */
            /* ⚑ Exclude the right-sidebar card so it can stretch like the others */
            .rankings-btn:not(.msn-rs-card),
            #rankingsBtn:not(.msn-rs-card) {
                width: 44px !important;
                height: 44px !important;
                font-size: 1.3rem !important;
            }
            @media (max-width: 768px) {
                .rankings-btn:not(.msn-rs-card),
                #rankingsBtn:not(.msn-rs-card) {
                    width: 46px !important;
                    height: 46px !important;
                    font-size: 1.45rem !important;
                    display: flex !important;
                }
            }

            /* ── Sidebar theme button — mobile only (theme-aware) ── */
            .sidebar-theme-btn { display: none; }
            @media (max-width: 768px) {
                .sidebar-theme-btn {
                    display: flex !important;
                    width: 46px !important;
                    height: 46px !important;
                    margin: 10px 12px !important;
                    font-size: 1.45rem !important;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-elevated, #1e2221) !important;
                    border: 1px solid var(--border-default, #454B4B) !important;
                    color: var(--text-primary, #fff) !important;
                    border-radius: var(--radius-sm, 4px) !important;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.25) !important;
                    cursor: pointer;
                    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
                    align-self: flex-start;
                }
                .sidebar-theme-btn:hover {
                    border-color: var(--accent-cyan, #01E1EA) !important;
                    box-shadow: 0 0 14px var(--border-glow, rgba(1, 225, 234, 0.45)) !important;
                    background: var(--bg-hover, #2a2f2e) !important;
                }
            }

            /* ── Rank + XP badges ── */
            .big-rank {
                display: inline-block !important;
                font-size: 0.72rem !important;
                padding: 3px 10px !important;
                margin-top: 5px !important;
                border-radius: 4px !important;
                background: linear-gradient(135deg, #C9A84E 0%, #A88A3A 100%) !important;
                color: #1a0f00 !important;
                font-weight: 800 !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                box-shadow: 0 0 10px rgba(201, 168, 78, 0.4) !important;
                border: none !important;
            }
            .big-rank.hidden { display: none !important; }
            .big-level {
                display: inline-block !important;
                font-size: 0.72rem !important;
                padding: 3px 9px !important;
                margin-top: 5px !important;
                border-radius: 4px !important;
                background: rgba(1, 225, 234, 0.12) !important;
                color: #01E1EA !important;
                border: 1px solid #01E1EA !important;
                font-weight: 700 !important;
                letter-spacing: 0.04em !important;
                box-shadow: 0 0 8px rgba(1, 225, 234, 0.3) !important;
                text-shadow: 0 0 6px rgba(1, 225, 234, 0.5) !important;
            }
            .big-level.hidden { display: none !important; }

            @media (max-width: 768px) {
                .header-right .btn-icon {
                    width: 40px !important;
                    height: 40px !important;
                    font-size: 1.15rem !important;
                }
                .header-right .btn-icon img {
                    width: 22px !important;
                    height: 22px !important;
                }
            }

            /* ── Message loading state ── */
            .messages-container {
                position: relative;
            }
            .msn-msg-loader {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                z-index: 5;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            .msn-msg-loader.msn-show { opacity: 1; }
            .msn-msg-loader-inner {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                color: var(--text-muted, #426080);
                font-family: var(--font-mono, monospace);
                font-size: 0.68rem;
                letter-spacing: 0.22em;
                text-transform: uppercase;
            }
            .msn-loader-dots {
                display: inline-flex;
                align-items: center;
                gap: 7px;
            }
            .msn-loader-dots span {
                width: 9px;
                height: 9px;
                border-radius: 50%;
                background: currentColor;
                animation: msnLoaderPulse 1.3s ease-in-out infinite;
                box-shadow: 0 0 6px currentColor;
            }
            .msn-loader-dots span:nth-child(2) { animation-delay: 0.18s; }
            .msn-loader-dots span:nth-child(3) { animation-delay: 0.36s; }
            @keyframes msnLoaderPulse {
                0%, 100% { opacity: 0.28; transform: translateY(0) scale(0.85); }
                50%      { opacity: 1;    transform: translateY(-4px) scale(1); }
            }

            /* ── Pinned announcement (theme-aware) ── */
            .mod-message-box {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 8px !important;
                align-self: center !important;
                width: auto !important;
                max-width: min(85%, 560px);
                margin: 10px 16px !important;
                padding: 8px 14px !important;
                border-radius: 16px 16px 16px 4px;
                background: var(--bg-elevated, rgba(0, 0, 0, 0.4));
                border: 1px solid var(--accent-yellow, rgba(234, 179, 8, 0.5));
                box-shadow:
                    0 2px 12px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.06);
                flex-shrink: 0 !important;
                z-index: 5;
                position: relative;
                font-family: var(--font-mono, monospace);
                pointer-events: auto;
            }
            .mod-message-box.hidden { display: none !important; }
            .mod-message-box .mod-badge {
                background: var(--accent-yellow, #eab308);
                color: #1a0f00;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 0.55rem;
                font-weight: 900;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                flex-shrink: 0;
                border: none;
                box-shadow: 0 0 8px var(--glow-yellow, rgba(234, 179, 8, 0.55));
                line-height: 1.2;
                white-space: nowrap;
            }
            .mod-message-box .mod-message-text {
                color: var(--text-primary, #fff);
                font-size: 0.82rem;
                line-height: 1.45;
                white-space: normal !important;
                overflow: visible !important;
                text-overflow: clip !important;
                overflow-wrap: anywhere;
                word-break: break-word;
                flex: 1;
                min-width: 0;
                text-align: left;
                letter-spacing: 0.01em;
            }
            .mod-message-box .mod-message-text a {
                color: var(--accent-cyan, #01E1EA);
                text-decoration: underline;
                text-underline-offset: 2px;
            }
            @media (max-width: 768px) {
                .mod-message-box {
                    max-width: calc(100% - 24px) !important;
                    margin: 8px 12px !important;
                    padding: 7px 12px !important;
                    border-radius: 14px 14px 14px 4px;
                    gap: 7px !important;
                }
                .mod-message-box .mod-badge {
                    font-size: 0.5rem;
                    padding: 2px 6px;
                    letter-spacing: 0.08em;
                }
                .mod-message-box .mod-message-text {
                    font-size: 0.78rem;
                    line-height: 1.4;
                }
            }

            /* ═══════════════════════════════════════════════════════════
               ⚑ CHAT + RIGHT SIDEBAR — DESKTOP ONLY
            ═══════════════════════════════════════════════════════════ */
            @media (min-width: 769px) {

                .chat-panel {
                    padding-right: 280px !important;
                    position: relative !important;
                    flex: 1 1 auto !important;
                    max-width: none !important;
                    border-radius: 0 !important;
                }

                .chat-header-bar {
                    width: calc(100% + 280px) !important;
                    position: relative !important;
                    z-index: 10 !important;
                }

                .messages-container::-webkit-scrollbar { width: 10px; }
                .messages-container::-webkit-scrollbar-track { background: transparent; }
                .messages-container::-webkit-scrollbar-thumb {
                    background: var(--border-default, #1a3a5c);
                    border-radius: 5px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                .messages-container::-webkit-scrollbar-thumb:hover {
                    background: var(--accent-cyan, #01E1EA);
                    background-clip: padding-box;
                }

                /* ── RIGHT SIDEBAR — vertical stack of action cards ── */
                .msn-right-sidebar {
                    position: absolute !important;
                    top: var(--header-height, 70px) !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    width: 280px !important;
                    background: linear-gradient(180deg,
                        var(--bg-panel, #01091A) 0%,
                        var(--bg-deep, #050914) 100%) !important;
                    border-left: 1px solid var(--border-subtle, rgba(255,255,255,0.06)) !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 0 !important;
                    padding: 16px 14px !important;
                    overflow: hidden !important;
                    z-index: 5 !important;
                    font-family: var(--font-mono, monospace) !important;
                }
                .msn-right-sidebar .msn-rs-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    flex: 1 1 auto;
                    min-height: 0;
                }
                                .msn-right-sidebar .msn-rs-actions {
                    display: grid;
                    grid-template-columns: 1fr;
                    grid-auto-rows: minmax(90px, 1fr);
                    gap: 12px;
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .msn-right-sidebar .msn-rs-actions::-webkit-scrollbar { width: 6px; }
                .msn-right-sidebar .msn-rs-actions::-webkit-scrollbar-track { background: transparent; }
                .msn-right-sidebar .msn-rs-actions::-webkit-scrollbar-thumb {
                    background: var(--border-default, #1a3a5c);
                    border-radius: 3px;
                }
                .msn-right-sidebar .msn-rs-actions .btn-icon,
                .msn-right-sidebar .msn-rs-actions .header-theme-btn,
                .msn-right-sidebar .msn-rs-actions .rankings-btn {
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 90px !important;
                    padding: 14px 10px !important;
                    font-size: 2rem !important;
                    border-radius: 10px !important;
                    background: var(--bg-elevated, rgba(255,255,255,0.03)) !important;
                    border: 1px solid var(--border-subtle, rgba(255,255,255,0.08)) !important;
                    color: var(--text-primary, #fff) !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 8px !important;
                    cursor: pointer !important;
                    transition: background 0.18s ease,
                                border-color 0.18s ease,
                                box-shadow 0.18s ease,
                                color 0.18s ease,
                                transform 0.18s ease !important;
                }
                .msn-right-sidebar .msn-rs-actions .msn-rs-card-label {
                    font-family: var(--font-mono, monospace);
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    color: inherit;
                    opacity: 0.75;
                    line-height: 1;
                    pointer-events: none;
                    user-select: none;
                    transition: opacity 0.18s ease;
                }
                .msn-right-sidebar .msn-rs-actions .btn-icon:hover,
                .msn-right-sidebar .msn-rs-actions .header-theme-btn:hover,
                .msn-right-sidebar .msn-rs-actions .rankings-btn:hover {
                    border-color: var(--accent-cyan, #01E1EA) !important;
                    color: var(--accent-cyan, #01E1EA) !important;
                    box-shadow: 0 0 16px var(--border-glow, rgba(1, 225, 234, 0.35)) !important;
                    background: var(--bg-hover, rgba(255,255,255,0.06)) !important;
                    transform: translateY(-2px) !important;
                }
                .msn-right-sidebar .msn-rs-actions .btn-icon:hover .msn-rs-card-label {
                    opacity: 1;
                }
                .msn-right-sidebar .msn-rs-actions .btn-icon img {
                    width: 36px !important;
                    height: 36px !important;
                    object-fit: contain !important;
                }
                .msn-right-sidebar .msn-rs-actions .btn-icon.hidden {
                    display: none !important;
                }
                /* ⚑ MOD card is mod-wallet only — hard-hide on .hidden */
                .msn-right-sidebar .msn-rs-actions #modSettingsBtn.hidden,
                .msn-right-sidebar .msn-rs-actions #modSettingsBtn[style*="display: none"] {
                    display: none !important;
                }

                .messages-container {
                    padding: 12px 14px !important;
                    gap: 10px !important;
                }
                .input-area-bar {
                    padding: 8px 12px 10px !important;
                }
                .mod-message-box {
                    max-width: min(90%, 500px) !important;
                }
            }
        `;
        const tag = document.createElement('style');
        tag.setAttribute('data-msn-phantom-fixes', '1');
        tag.textContent = css;
        document.head.appendChild(tag);
    })();

    // State
    const STORAGE_KEY_NAME = 'msn_chat_username';
    const LAST_USERNAME_KEY = 'msn_last_username';
    const CLIENT_ID_KEY = 'msn_chat_client_id';
    const ACTIVE_CHAT_KEY = 'msn_active_private_chat';
    let username = localStorage.getItem(STORAGE_KEY_NAME) || '';
    let clientId = localStorage.getItem(CLIENT_ID_KEY) || '';
    if (!clientId) {
        clientId = 'c_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem(CLIENT_ID_KEY, clientId);
    }

    // Phantom state
    let phantomWalletPublicKey = null;
    let phantomConnected = false;
    let hasTokenAccess = false;

    let avatarCache = {};
    let userBalances = {};
    let currentAvatarUrl = null;
    let modAnnouncement = '';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    function getWalletAddress() {
        try {
            return phantomWalletPublicKey ? phantomWalletPublicKey.toBase58() : null;
        } catch (e) { return null; }
    }

    function updateAppHeight() {
        const vv = window.visualViewport;
        const h = vv ? vv.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', h + 'px');
    }
    updateAppHeight();
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateAppHeight);
        window.visualViewport.addEventListener('scroll', updateAppHeight);
    }
    window.addEventListener('resize', updateAppHeight);
    window.addEventListener('orientationchange', () => setTimeout(updateAppHeight, 100));
    [50, 200, 500, 1200, 2500].forEach(ms => setTimeout(updateAppHeight, ms));

    const sidebarWalletAddress = document.getElementById('sidebarWalletAddress');
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
    const mobileEditBtn = document.getElementById('mobileEditBtn');
    const modMessageBox = document.getElementById('modMessageBox');
    const modMessageText = document.getElementById('modMessageText');
    const modAnnouncementSection = document.getElementById('modAnnouncementSection');
    const modAnnouncementInput = document.getElementById('modAnnouncementInput');
    const modPostAnnouncementBtn = document.getElementById('modPostAnnouncementBtn');

    if (!document.getElementById('sidebarBigLevel')) console.warn('[msn] sidebarBigLevel missing');
    if (!document.getElementById('sidebarBigRank'))  console.warn('[msn] sidebarBigRank missing');
    if (!document.getElementById('rankingsBtn'))      console.warn('[msn] rankingsBtn missing');
    if (!document.getElementById('sidebarThemeBtn'))  console.warn('[msn] sidebarThemeBtn missing');

    let currentRequestData = null;

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

    // ============================================================
    // ⚑ OVERLAY MESSAGING
    // ============================================================
    function ensureOverlayMessageEl() {
        if (!nameOverlay) return null;
        let el = document.getElementById('nameOverlayMessage');
        if (!el) {
            const card = nameOverlay.querySelector('.overlay-card');
            if (!card) return null;
            el = document.createElement('div');
            el.id = 'nameOverlayMessage';
            el.style.cssText = [
                'display:none',
                'margin:10px 0 0',
                'padding:9px 12px',
                'border-radius:5px',
                'font-size:0.8rem',
                'text-align:center',
                'font-family:var(--font-mono, monospace)',
                'border:1px solid',
                'line-height:1.4',
                'word-break:break-word'
            ].join(';');
            const joinBtn = document.getElementById('nameSubmitBtn');
            if (joinBtn && joinBtn.parentNode === card) {
                card.insertBefore(el, joinBtn);
            } else {
                card.appendChild(el);
            }
        }
        return el;
    }

    function showOverlayMessage(msg, type) {
        if (!nameOverlay || nameOverlay.classList.contains('hidden')) return;
        const el = ensureOverlayMessageEl();
        if (!el) return;
        el.textContent = msg;
        if (type === 'success') {
            el.style.background = 'rgba(74, 222, 128, 0.12)';
            el.style.borderColor = '#4ade80';
            el.style.color = '#4ade80';
        } else if (type === 'error') {
            el.style.background = 'rgba(239, 68, 68, 0.12)';
            el.style.borderColor = '#ef4444';
            el.style.color = '#ef4444';
        } else {
            el.style.background = 'rgba(255, 193, 7, 0.12)';
            el.style.borderColor = '#ffc107';
            el.style.color = '#ffc107';
        }
        el.style.display = 'block';
        clearTimeout(el._timeout);
        if (type !== 'error') {
            el._timeout = setTimeout(() => { el.style.display = 'none'; }, 5000);
        }
    }

    function hideOverlayMessage() {
        const el = document.getElementById('nameOverlayMessage');
        if (el) {
            el.style.display = 'none';
            clearTimeout(el._timeout);
        }
    }

    // ============================================================
    // TWITTER EMBED
    // ============================================================
    let twttrReadyPromise = null;
    function waitForTwttr() {
        if (twttrReadyPromise) return twttrReadyPromise;
        twttrReadyPromise = new Promise((resolve) => {
            if (window.twttr && window.twttr.widgets) return resolve(window.twttr);
            const check = () => {
                if (window.twttr && window.twttr.widgets) resolve(window.twttr);
                else setTimeout(check, 50);
            };
            check();
        });
        return twttrReadyPromise;
    }
    waitForTwttr();

    const tweetQueue = [];
    let tweetQueueRunning = false;

    async function processTweetQueue() {
        if (tweetQueueRunning) return;
        tweetQueueRunning = true;
        while (tweetQueue.length > 0) {
            const block = tweetQueue.shift();
            if (!block || !block.isConnected) continue;
            try {
                const twttr = await waitForTwttr();
                twttr.widgets.load(block.parentNode);
            } catch (err) {
                console.warn('Twitter widget failed:', err);
            }
            await new Promise(r => setTimeout(r, 400));
            if (autoScroll) {
                const c = currentTab === 'private' ? privateContainer : publicContainer;
                c.scrollTop = c.scrollHeight;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        tweetQueueRunning = false;
    }

    let tweetObserver = null;
    function setupTweetObserver() {
        if (tweetObserver || !('IntersectionObserver' in window)) return;
        tweetObserver = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting);
            visible.sort((a, b) => {
                const ra = a.boundingClientRect;
                const rb = b.boundingClientRect;
                const vh = window.innerHeight;
                return Math.abs((ra.top + ra.bottom)/2 - vh/2)
                     - Math.abs((rb.top + rb.bottom)/2 - vh/2);
            });
            for (const entry of visible) {
                const block = entry.target;
                if (block.dataset.queued) continue;
                block.dataset.queued = '1';
                tweetObserver.unobserve(block);
                tweetQueue.push(block);
            }
            processTweetQueue();
        }, { rootMargin: '0px', threshold: 0 });
    }

    function observeTweetsInWrapper(wrapper) {
        if (!tweetObserver) return;
        const tweetBlocks = wrapper.querySelectorAll('.twitter-tweet');
        tweetBlocks.forEach(block => {
            if (block.dataset.observed) return;
            block.dataset.observed = '1';
            tweetObserver.observe(block);
        });
    }

    function getPhantomProvider() {
        if ('phantom' in window) {
            const provider = window.phantom?.solana;
            if (provider?.isPhantom) return provider;
        }
        if (window.solana?.isPhantom) return window.solana;
        return null;
    }

        function checkIfModWallet() {
        // Mod only when: connected AND wallet matches MOD_WALLET
        if (phantomConnected && phantomWalletPublicKey) {
            try {
                isModWallet = phantomWalletPublicKey.toBase58() === MOD_WALLET;
            } catch (e) {
                isModWallet = false;
            }
        } else {
            isModWallet = false;
        }

        // Show ONLY for the mod wallet — force-hide everywhere else.
        if (isModWallet) {
            modSettingsBtn.classList.remove('hidden');
            modSettingsBtn.style.removeProperty('display');
        } else {
            modSettingsBtn.classList.add('hidden');
            // Inline !important beats ANY stylesheet rule, !important or not.
            modSettingsBtn.style.setProperty('display', 'none', 'important');
        }

        if (modAnnouncementSection) {
            modAnnouncementSection.classList.toggle('hidden', !isModWallet);
        }
    }

    function updatePhantomUI() {
        const connected = !!(phantomConnected && phantomWalletPublicKey);
        const addr = connected ? phantomWalletPublicKey.toBase58() : '';
        const shortAddr = connected ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

        walletAddressSpan.textContent = connected ? `👛 ${shortAddr}` : '';
        phantomConnectBtn.title = connected ? 'Disconnect Phantom' : 'Connect Phantom Wallet';
        phantomConnectBtn.classList.toggle('connected', connected);

        if (sidebarWalletAddress) {
            sidebarWalletAddress.textContent = connected ? `👛 ${shortAddr}` : '';
        }

        if (phantomConnectBtnOverlay) {
            walletAddressOverlay.textContent = connected ? `👛 ${shortAddr}` : '';
            phantomConnectBtnOverlay.title = connected ? 'Disconnect Phantom' : 'Connect Phantom Wallet';
            phantomConnectBtnOverlay.classList.toggle('connected', connected);
            phantomConnectBtnOverlay.disabled = false;
            phantomConnectBtnOverlay.innerHTML = connected
                ? `<img src="https://i.postimg.cc/kXtLPZVF/Phanyoms2.png" alt="Phantom" class="phantom-icon"> <span>Disconnect</span>`
                : `<img src="https://i.postimg.cc/kXtLPZVF/Phanyoms2.png" alt="Phantom" class="phantom-icon"> <span>Connect Phantom</span>`;
        }

        try {
            if (connected) localStorage.setItem('msn_cached_wallet', addr);
            else localStorage.removeItem('msn_cached_wallet');
        } catch (e) { /* ignore */ }

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

    function getBadge(balance) {
        if (balance >= 1000000) return { emoji: '🐋', name: 'Whale' };
        if (balance >= 250000) return { emoji: '🐬', name: 'Dolphin' };
        if (balance >= 100000) return { emoji: '🦀', name: 'Crab' };
        return { emoji: '🦐', name: 'Shrimp' };
    }
    function getBadgeForUser(user) {
        const bal = userBalances[user];
        if (bal === null || bal === undefined) return null;
        return getBadge(bal);
    }

    function updateUserRank(balance) {
        if (!sidebarBigRank) return;
        const bal = Number(balance);
        if (!isFinite(bal) || bal <= 0) {
            sidebarBigRank.textContent = '';
            sidebarBigRank.classList.add('hidden');
            return;
        }
        const badge = getBadge(bal);
        if (!badge) {
            sidebarBigRank.textContent = '';
            sidebarBigRank.classList.add('hidden');
            return;
        }
        sidebarBigRank.textContent = `${badge.emoji} ${badge.name}`;
        sidebarBigRank.classList.remove('hidden');
    }

    async function upsertProfile({ username: uname, avatar_url, token_balance }) {
        const wallet = getWalletAddress();
        if (!wallet) {
            return { data: null, error: { message: 'no_wallet' } };
        }
        try {
            const payload = { wallet_address: wallet };
            if (uname !== undefined) payload.username = uname;
            if (avatar_url !== undefined) payload.avatar_url = avatar_url;
            if (token_balance !== undefined) payload.token_balance = token_balance;
            return await supabase.from('profiles').upsert(payload, { onConflict: 'wallet_address' });
        } catch (err) {
            console.warn('upsertProfile failed:', err);
            return { data: null, error: err };
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

            await upsertProfile({
                username: username,
                token_balance: targetBalance
            });
            userBalances[username] = targetBalance;

            if (modTokenRequirement <= 0) {
                hasTokenAccess = true;
            } else if (targetBalance > modTokenRequirement) {
                hasTokenAccess = true;
                showSuccess(`You hold ${targetBalance.toLocaleString()} tokens — access granted!`);
            } else {
                hasTokenAccess = false;
                showError(`You need more than ${modTokenRequirement.toLocaleString()} tokens (you have ${targetBalance.toLocaleString()}).`);
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
            if (modTokenRequirement <= 0) canChat = true;
            else canChat = phantomConnected && hasTokenAccess;
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
            return false;
        }

        if (phantomConnectBtnOverlay) {
            phantomConnectBtnOverlay.disabled = true;
            phantomConnectBtnOverlay.innerHTML =
                `<img src="https://i.postimg.cc/kXtLPZVF/Phanyoms2.png" alt="Phantom" class="phantom-icon"> <span>Connecting…</span>`;
        }
        showOverlayMessage('Waiting for Phantom approval…', 'info');

        try {
            const resp = await provider.connect({ onlyIfTrusted: true });
            phantomWalletPublicKey = resp.publicKey;
            phantomConnected = true;
            updatePhantomUI();
            fetchAndDisplayAllTokens();
            const addr = phantomWalletPublicKey.toBase58();
            showSuccess(`Phantom connected: ${addr.slice(0,4)}…${addr.slice(-4)}`);
            return true;
        } catch (silentErr) { /* fall through */ }

        try {
            const resp = await provider.connect({ onlyIfTrusted: false });
            phantomWalletPublicKey = resp.publicKey;
            phantomConnected = true;
            updatePhantomUI();
            const addr = phantomWalletPublicKey.toBase58();
            showSuccess(`Phantom connected: ${addr.slice(0,4)}…${addr.slice(-4)}`);
            await fetchAndDisplayAllTokens();
            return true;
        } catch (err) {
            console.error('Phantom connection error:', err);
            if (phantomConnectBtnOverlay) phantomConnectBtnOverlay.disabled = false;
            updatePhantomUI();

            const raw = String((err && err.message) || err || '').trim();
            let friendly = raw;
            if (/user rejected|rejected by user|cancell?ed|declined/i.test(raw)) {
                friendly = 'Connection cancelled';
            } else if (!raw) {
                friendly = 'Could not connect Phantom';
            }
            showError(friendly);
            return false;
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
        showOverlayMessage('Phantom disconnected', 'info');
    }
    function togglePhantomConnection() {
        if (phantomConnected) disconnectPhantom(); else connectPhantom();
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

    modSettingsBtn.addEventListener('click', () => {
        modTokenRequirementInput.value = modTokenRequirement;
        modCooldownSelect.value = modCooldownSeconds.toString();
        if (modAnnouncementInput) modAnnouncementInput.value = modAnnouncement || '';
        if (modAnnouncementSection) modAnnouncementSection.classList.toggle('hidden', !isModWallet);
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
            showSuccess('Mod settings updated globally!');
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

    async function postModAnnouncement(message) {
        try {
            const { error } = await supabase.from('settings').upsert({ id: 1, mod_announcement: message }, { onConflict: 'id' });
            if (error) throw error;
            modAnnouncement = message;
            showSuccess('Announcement posted!');
        } catch (err) {
            console.error('Error posting announcement:', err);
            showError('Failed to post announcement: ' + err.message);
        }
    }
    modPostAnnouncementBtn.addEventListener('click', async () => {
        const msg = modAnnouncementInput.value.trim();
        if (!msg) { showError('Please enter an announcement.'); return; }
        await postModAnnouncement(msg);
        modAnnouncementInput.value = '';
    });

    async function loadSettings() {
        try {
            const { data, error } = await supabase.from('settings')
                .select('token_requirement, cooldown_seconds, mod_announcement')
                .eq('id', 1).single();
            if (!error && data) {
                modTokenRequirement = data.token_requirement;
                modCooldownSeconds = data.cooldown_seconds;
                modAnnouncement = data.mod_announcement || '';
                updateModAnnouncementDisplay(modAnnouncement);
            }
        } catch (err) { console.error('Error loading settings:', err); }
        updateChatAccessibility();
    }

    function subscribeToSettings() {
        if (settingsChannel) supabase.removeChannel(settingsChannel);
        settingsChannel = supabase.channel('settings-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
                const newData = payload.new;
                if (newData && newData.id === 1) {
                    modTokenRequirement = newData.token_requirement;
                    modCooldownSeconds = newData.cooldown_seconds;
                    modAnnouncement = newData.mod_announcement || '';
                    updateModAnnouncementDisplay(modAnnouncement);
                    updateChatAccessibility();
                    if (phantomConnected) fetchAndDisplayAllTokens();
                }
            }).subscribe();
    }

    function linkifyText(text) {
        let escaped = escapeHtml(text);
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        return escaped.replace(urlRegex, url => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#ff9999; text-decoration:underline;">${url}</a>`;
        });
    }

    function updateModAnnouncementDisplay(message) {
        if (!modMessageBox || !modMessageText) return;
        const trimmed = message ? message.trim() : '';
        if (trimmed === '') {
            modMessageBox.classList.add('hidden');
            modMessageText.innerHTML = '';
            return;
        }
        modMessageBox.classList.remove('hidden');
        modMessageText.innerHTML = linkifyText(trimmed);
    }

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
    let lastLoadedPrivatePartner = null;
    let acceptedPrivateChats;
    try {
        acceptedPrivateChats = new Set(JSON.parse(localStorage.getItem('msn_accepted_chats') || '[]'));
    } catch (e) {
        acceptedPrivateChats = new Set();
    }

    const TOKEN_ADDRESS = 'HmJDgky11u77hpBss6D8sjNpYPD5B6fWgSVDj58jpump';
    async function updateTokenInfo() {
        const trackers = document.querySelectorAll('.token-tracker');
        if (!trackers.length) return;
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`);
            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs[0];
                const price = parseFloat(pair.priceUsd);
                const change = parseFloat(pair.priceChange.h24);
                const tokenName = pair.baseToken.name || pair.baseToken.symbol || 'TOKEN';
                const logoUrl = pair.info?.imageUrl || pair.baseToken?.imageUrl || '';
                trackers.forEach(tracker => {
                    const logoEl = tracker.querySelector('.token-logo');
                    const nameEl = tracker.querySelector('.token-name');
                    const priceEl = tracker.querySelector('.token-price');
                    const changeEl = tracker.querySelector('.token-change');
                    if (nameEl) nameEl.textContent = tokenName;
                    if (logoEl) { logoEl.src = logoUrl; logoEl.style.display = logoUrl ? 'block' : 'none'; }
                    if (priceEl) priceEl.textContent = price ? `$${price.toFixed(4)}` : '--';
                    if (changeEl) {
                        changeEl.textContent = change ? `${change.toFixed(2)}%` : '--';
                        changeEl.className = 'token-change ' + (change >= 0 ? 'positive' : 'negative');
                    }
                });
            } else {
                trackers.forEach(tracker => {
                    const logoEl = tracker.querySelector('.token-logo');
                    const priceEl = tracker.querySelector('.token-price');
                    const changeEl = tracker.querySelector('.token-change');
                    if (logoEl) logoEl.style.display = 'none';
                    if (priceEl) priceEl.textContent = '--';
                    if (changeEl) { changeEl.textContent = '--'; changeEl.className = 'token-change'; }
                });
            }
        } catch (err) {
            console.warn('Token fetch failed:', err);
            trackers.forEach(tracker => {
                const logoEl = tracker.querySelector('.token-logo');
                const priceEl = tracker.querySelector('.token-price');
                const changeEl = tracker.querySelector('.token-change');
                if (logoEl) logoEl.style.display = 'none';
                if (priceEl) priceEl.textContent = '--';
                if (changeEl) { changeEl.textContent = '--'; changeEl.className = 'token-change'; }
            });
        }
    }
    updateTokenInfo();
    setInterval(updateTokenInfo, 60000);

    function scrollContainerToBottom(container) { if (container) container.scrollTop = container.scrollHeight; }

    let autoScroll = true;

    function disableAutoScroll() {
        if (autoScroll) autoScroll = false;
    }

    const lastScrollPos = { public: 0, private: 0 };

    function attachAutoScrollListeners() {
        const pairs = [
            [publicContainer, 'public'],
            [privateContainer, 'private']
        ];
        pairs.forEach(([container, key]) => {
            container.addEventListener('touchstart',  disableAutoScroll, { passive: true });
            container.addEventListener('pointerdown', disableAutoScroll, { passive: true });
            container.addEventListener('touchmove',   disableAutoScroll, { passive: true });
            container.addEventListener('touchcancel', disableAutoScroll, { passive: true });
            container.addEventListener('wheel',       disableAutoScroll, { passive: true });
            container.addEventListener('keydown',     disableAutoScroll, { passive: true });

            container.addEventListener('scroll', () => {
                const st = container.scrollTop;
                const prev = lastScrollPos[key];
                if (st < prev - 4) {
                    disableAutoScroll();
                }
                lastScrollPos[key] = st;
            }, { passive: true });
        });
    }
    attachAutoScrollListeners();

    function startAutoScrollLoop() {
        const tick = () => {
            if (autoScroll) {
                const c = currentTab === 'private' ? privateContainer : publicContainer;
                const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 2;
                if (!atBottom) c.scrollTop = c.scrollHeight;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
    startAutoScrollLoop();

    function pinToBottom(container, durationMs = 4000) {
        if (container && autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
    }

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
        autoScroll = true;
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        setTimeout(() => updateScrollButtonVisibility(container), 300);
    });

    function saveAcceptedChats() { localStorage.setItem('msn_accepted_chats', JSON.stringify([...acceptedPrivateChats])); }

    async function loadAcceptedChatsFromDB() {
        if (!username) return;
        try {
            const { data: sent } = await supabase.from('private_chat_requests')
                .select('to_user').eq('from_user', username).eq('status', 'accepted');
            const { data: received } = await supabase.from('private_chat_requests')
                .select('from_user').eq('to_user', username).eq('status', 'accepted');
            (sent || []).forEach(r => r.to_user && acceptedPrivateChats.add(r.to_user));
            (received || []).forEach(r => r.from_user && acceptedPrivateChats.add(r.from_user));

            const { data: msgSent } = await supabase.from('private_messages')
                .select('to_user').eq('from_user', username).limit(500);
            const { data: msgReceived } = await supabase.from('private_messages')
                .select('from_user').eq('to_user', username).limit(500);
            (msgSent || []).forEach(r => r.to_user && acceptedPrivateChats.add(r.to_user));
            (msgReceived || []).forEach(r => r.from_user && acceptedPrivateChats.add(r.from_user));

            saveAcceptedChats();
        } catch (err) { console.error('Error loading accepted chats:', err); }
    }

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

    function escapeHtml(t) { const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}; return String(t).replace(/[&<>"']/g, m=>map[m]); }
    function trunc(t, l=45) { return t && t.length>l ? t.substring(0,l)+'…' : t||''; }

    function showError(msg) {
        errorToast.textContent = '⚠️ ' + msg;
        errorToast.classList.add('visible');
        clearTimeout(errorToast._timeout);
        errorToast._timeout = setTimeout(() => errorToast.classList.remove('visible'), 8000);
        if (nameOverlay && !nameOverlay.classList.contains('hidden')) {
            showOverlayMessage(msg, 'error');
        }
    }

    function showSuccess(msg) {
        const clean = String(msg).replace(/^✅\s*/, '').replace(/^⚠️\s*/, '');
        errorToast.textContent = '✅ ' + clean;
        errorToast.classList.add('visible');
        clearTimeout(errorToast._timeout);
        errorToast._timeout = setTimeout(() => errorToast.classList.remove('visible'), 5000);
        if (nameOverlay && !nameOverlay.classList.contains('hidden')) {
            showOverlayMessage(clean, 'success');
        }
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

    async function fetchAvatars(usernames) {
        const unique = [...new Set(usernames.filter(u => u && (!avatarCache[u] || !(u in userBalances))))];
        if (unique.length === 0) return;
        const { data, error } = await supabase.from('profiles')
            .select('username, avatar_url, token_balance, wallet_address')
            .in('username', unique);
        if (error) { console.warn('Error fetching profiles:', error); return; }
        (data || []).forEach(p => {
            const hasWallet = p.wallet_address && String(p.wallet_address).length > 0;
            const exists    = p.username in avatarCache;
            if (hasWallet || !exists) {
                avatarCache[p.username] = p.avatar_url;
                userBalances[p.username] = hasWallet ? (p.token_balance || 0) : null;
            }
        });
    }
    function getAvatarURL(user) { return avatarCache[user] || null; }
    function renderAvatarHTML(user) {
        const url = getAvatarURL(user);
        if (url) return `<img src="${escapeHtml(url)}" alt="${escapeHtml(user)}" style="width:100%;height:100%;object-fit:cover;">`;
        return (user || '?')[0].toUpperCase();
    }

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

    async function scrollToMessage(msgId) {
        const container = currentTab === 'public' ? publicContainer : privateContainer;
        let target = container.querySelector(`.msg-wrapper[data-msg-id="${msgId}"]`);
        if (!target) {
            const table = currentTab === 'public' ? 'messages' : 'private_messages';
            const { data, error } = await supabase.from(table).select('*').eq('id', msgId).single();
            if (error || !data) { showError('Original message could not be loaded.'); return; }
            const user = currentTab === 'public' ? data.username : data.from_user;
            if (!getAvatarURL(user)) await fetchAvatars([user]);
            await renderMessage(data, currentTab === 'private', false);
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

    function renderMessageContent(text) {
        if (!text) return '';
        const xUrlRegex = /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([^\/\s]+\/status\/\d+)/gi;
        const matches = [...text.matchAll(xUrlRegex)];
        const cleanText = text.replace(xUrlRegex, '').trim();
        let html = '';
        if (cleanText) {
            html += `<div class="msg-text">${escapeHtml(cleanText)}</div>`;
        }
        for (const match of matches) {
            const url = match[0];
            html += `<blockquote class="twitter-tweet"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></blockquote>`;
        }
        return html;
    }

    async function buildMessageNode(msg, isPrivate) {
        const user = isPrivate ? msg.from_user : msg.username;
        if (!getAvatarURL(user)) await fetchAvatars([user]);
        const isOwn = user === username;

        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper' + (isOwn ? ' own' : '');
        wrapper.setAttribute('data-msg-id', msg.id);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        if (isPrivate) bubble.classList.add('private-msg');

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

        const badge = getBadgeForUser(user);
        const badgeHtml = badge ? `<span class="user-badge" title="${badge.name}">${badge.emoji}</span>` : '';

        innerHTML += `<div class="msg-username"><span class="msg-avatar">${renderAvatarHTML(user)}</span> ${escapeHtml(user)} ${badgeHtml}${isPrivate?' <span style="font-size:0.6rem;opacity:0.6;">🔒</span>':''} <span class="msg-time">${formatTime(msg.created_at)}</span>`;
        if (msg.edited_at) innerHTML += `<span class="msg-edited">(edited)</span>`;
        innerHTML += `</div>`;

        if (msg.is_deleted) {
            innerHTML += `<div class="msg-text deleted">Message removed</div>`;
        } else {
            if (msg.message) innerHTML += renderMessageContent(msg.message);
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

        observeTweetsInWrapper(wrapper);

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

        return wrapper;
    }

    // ⚑ Loader lives INSIDE the messages container → centered in the chat area
    function showMsgLoader(container, label) {
        if (!container) return;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        let loader = container.querySelector('.msn-msg-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'msn-msg-loader';
            loader.innerHTML = `
                <div class="msn-msg-loader-inner">
                    <div class="msn-loader-dots"><span></span><span></span><span></span></div>
                    <div class="msn-msg-loader-label">${escapeHtml(label || 'Loading')}</div>
                </div>
            `;
            container.appendChild(loader);
        } else {
            const lbl = loader.querySelector('.msn-msg-loader-label');
            if (lbl) lbl.textContent = label || 'Loading';
        }
        loader.classList.add('msn-show');
    }

    function hideMsgLoader(container) {
        if (!container) return;
        const loader = container.querySelector('.msn-msg-loader');
        if (loader) loader.classList.remove('msn-show');
    }

    async function renderMessage(msg, isPrivate = false, shouldScroll = true) {
        if(knownMessageIds.has(msg.id)) return;
        knownMessageIds.add(msg.id);
        const container = isPrivate ? privateContainer : publicContainer;
        const emptyHint = isPrivate ? privateEmptyHint : publicEmptyHint;
        if(emptyHint) emptyHint.style.display = 'none';
        const wrapper = await buildMessageNode(msg, isPrivate);
        container.appendChild(wrapper);
        if (shouldScroll) container.scrollTop = container.scrollHeight;
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
            textDiv.innerHTML = renderMessageContent(newText);
            observeTweetsInWrapper(wrapper);
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
            const count = typersPublic.length;
            if (count === 1) text = `${escapeHtml(typersPublic[0])} is typing... ${dots}`;
            else if (count === 2) text = `${escapeHtml(typersPublic[0])} and ${escapeHtml(typersPublic[1])} are typing... ${dots}`;
            else if (count > 2) text = `2 or more are typing... ${dots}`;
        } else if (currentTab === 'private' && activePrivateChat) {
            if (typersPrivate[activePrivateChat]) text = `${escapeHtml(activePrivateChat)} is typing... ${dots}`;
        }
        if (!text) {
            typingIndicator.classList.add('hidden');
            typingIndicator.innerHTML = '';
            return;
        }
        typingIndicator.classList.remove('hidden');
        typingIndicator.innerHTML = text;
    }
    function setupTypingChannel() {
        if (typingChannel) supabase.removeChannel(typingChannel);
        typingChannel = supabase.channel('typing-broadcast', { config: { broadcast: { self: false } } });
        typingChannel.on('broadcast', { event: 'typing' }, (payload) => handleTypingBroadcast(payload.payload));
        typingChannel.on('broadcast', { event: 'stop_typing' }, (payload) => handleTypingBroadcast(payload.payload));
        typingChannel.subscribe();
    }

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
            autoScroll = true;
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
            autoScroll = true;
            setTimeout(() => { scrollContainerToBottom(privateContainer); updateScrollButtonVisibility(privateContainer); }, 150);
        }
        updateTypingIndicator();
        if (messageInput.value.length > 0) startTyping();
    }

    chatTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.chat-tab');
        if (!tab) return;
        const tabName = tab.getAttribute('data-tab');

        if (tabName === 'private') {
            if (!activePrivateChat) {
                const saved = localStorage.getItem(ACTIVE_CHAT_KEY);
                if (saved) {
                    activePrivateChat = saved;
                    acceptedPrivateChats.add(saved);
                    saveAcceptedChats();
                    privateIndicatorBar.classList.remove('hidden');
                    privateChatUserDisp.textContent = saved;
                    messageInput.placeholder = `Private message to ${saved}...`;
                } else {
                    showError('Select a private chat partner from the sidebar first.');
                    return;
                }
            }
            switchTab('private');
            if (lastLoadedPrivatePartner !== activePrivateChat) {
                loadPrivateMessages(activePrivateChat);
            }
            return;
        }

        switchTab(tabName);
    });

    function setActivePrivateChat(partnerUsername) {
        const isSamePartner = (partnerUsername === activePrivateChat);
        activePrivateChat = partnerUsername;
        localStorage.setItem(ACTIVE_CHAT_KEY, partnerUsername || '');
        if (partnerUsername) {
            acceptedPrivateChats.add(partnerUsername);
            saveAcceptedChats();
            privateIndicatorBar.classList.remove('hidden');
            privateChatUserDisp.textContent = partnerUsername;
            setReplyingTo(null);
            messageInput.placeholder = `Private message to ${partnerUsername}...`;
            switchTab('private');

            const alreadyRendered = privateContainer.querySelectorAll('.msg-wrapper').length > 0;
            if (!isSamePartner || lastLoadedPrivatePartner !== partnerUsername || !alreadyRendered) {
                loadPrivateMessages(partnerUsername);
            }
        } else {
            activePrivateChat = null;
            lastLoadedPrivatePartner = null;
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
        if (!username || !partner) return;
        privateContainer.innerHTML = '';
        showMsgLoader(privateContainer, 'Loading conversation');

        try {
            const [{ data: a, error: e1 }, { data: b, error: e2 }] = await Promise.all([
                supabase.from('private_messages').select('*')
                    .eq('from_user', username).eq('to_user', partner),
                supabase.from('private_messages').select('*')
                    .eq('from_user', partner).eq('to_user', username)
            ]);
            if (e1 || e2) {
                console.warn('loadPrivateMessages error:', e1 || e2);
                privateContainer.innerHTML = '<div class="empty-chat-hint">Failed to load messages</div>';
                return;
            }
            const data = [...(a || []), ...(b || [])];
            const seen = new Set();
            const unique = data.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });
            unique.sort((x, y) => {
                const tx = x.sort_order != null ? x.sort_order : new Date(x.created_at || 0).getTime();
                const ty = y.sort_order != null ? y.sort_order : new Date(y.created_at || 0).getTime();
                return tx - ty;
            });

            for (const msg of unique) knownMessageIds.delete(msg.id);

            lastLoadedPrivatePartner = partner;

            const holder = document.createElement('div');
            holder.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

            if (unique.length === 0) {
                holder.innerHTML = '<div class="empty-chat-hint">No private messages with this user.</div>';
            } else {
                const users = [...new Set(unique.flatMap(m => [m.from_user, m.to_user]).filter(Boolean))];
                await fetchAvatars(users);
                for (const msg of unique) {
                    const node = await buildMessageNode(msg, true);
                    holder.appendChild(node);
                }
            }

            privateContainer.innerHTML = '';
            while (holder.firstChild) privateContainer.appendChild(holder.firstChild);

            privateContainer.scrollTop = privateContainer.scrollHeight;
            requestAnimationFrame(() => {
                privateContainer.scrollTop = privateContainer.scrollHeight;
            });

            loadReactions('private_message_reactions', true);
        } catch (err) {
            console.error('loadPrivateMessages failed:', err);
            privateContainer.innerHTML = '<div class="empty-chat-hint">Error loading private messages</div>';
        }
    }

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

        const badge = getBadgeForUser(userName);
        const badgeHtml = badge ? `<span class="user-badge small" title="${badge.name}">${badge.emoji}</span>` : '';

        return `<div class="sidebar-user-item${isSelf?' you-tag':''}" data-username="${escapeHtml(userName)}">
            <div class="user-avatar">${avatarHTML}${isOnline?'<span class="online-indicator"></span>':''}</div>
            <div class="user-info"><div class="user-name">${escapeHtml(userName)} ${badgeHtml}</div><div class="user-status-text">${isSelf?'You':'Online'}</div></div>
            ${!isSelf ? `<button class="${btnClass}">${btnText}</button>` : ''}
        </div>`;
    }

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
        if(acceptedPrivateChats.has(targetUser)) { setActivePrivateChat(targetUser); return; }
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
            .select('id').eq('from_user', username).eq('to_user', toUser).eq('status', 'pending').maybeSingle();
        if (existing) { showError('📩 Request already sent'); return; }
        try {
            const { error } = await supabase.from('private_chat_requests').insert({
                from_user: username, to_user: toUser, status: 'pending'
            });
            if(error) { showError('Request failed: ' + error.message); return; }
            showError('📩 Request sent to ' + toUser);
            updateSidebarUI();
        } catch(err) { showError('Error: '+err.message); }
    }
    async function acceptPrivateRequest(fromUser, requestId) {
        try {
            const { error } = await supabase.from('private_chat_requests').update({status:'accepted'}).eq('id', requestId);
            if(error) throw error;
            pendingPrivateRequests.delete(fromUser);
            acceptedPrivateChats.add(fromUser);
            saveAcceptedChats();
            if (activePrivateChat !== fromUser) setActivePrivateChat(fromUser);
            updateSidebarUI();
            showSuccess('Chat with ' + fromUser + ' active!');
        } catch(err) { showError('Accept error: '+err.message); }
    }
    async function loadPendingRequests() {
        if(!username) return;
        try {
            const { data, error } = await supabase.from('private_chat_requests')
                .select('*').or(`to_user.eq.${username},from_user.eq.${username}`).order('created_at', {ascending:false});
            if(error) return;
            pendingPrivateRequests.clear();
            (data||[]).forEach(req => {
                if(req.status === 'pending' && req.to_user === username) {
                    pendingPrivateRequests.set(req.from_user, {status:'pending', id:req.id, from_user:req.from_user});
                }
            });
            updateSidebarUI();
        } catch(err) { console.error('Error loading pending requests:', err); }
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

    async function loadMessages() {
        setConnection('connecting');
        publicContainer.innerHTML = '';
        showMsgLoader(publicContainer, 'Loading messages');

        try {
            const { data, error } = await supabase
                .from('message_feed')
                .select('*').order('sort_order', { ascending: false }).range(0, 29);
            if (error) throw error;

            data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            knownMessageIds.clear();

            data.forEach(msg => {
                if (msg.avatar_url) avatarCache[msg.username] = msg.avatar_url;
                if (msg.wallet_address) userBalances[msg.username] = msg.token_balance || 0;
            });

            const holder = document.createElement('div');
            holder.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

            if (data.length === 0) {
                holder.innerHTML = '<div class="empty-chat-hint">No messages yet. ⚡</div>';
            } else {
                for (const msg of data) {
                    const node = await buildMessageNode(msg, false);
                    holder.appendChild(node);
                }
            }

            publicContainer.innerHTML = '';
            while (holder.firstChild) publicContainer.appendChild(holder.firstChild);

            autoScroll = true;
            publicContainer.scrollTop = publicContainer.scrollHeight;
            requestAnimationFrame(() => {
                publicContainer.scrollTop = publicContainer.scrollHeight;
                updateScrollButtonVisibility(publicContainer);
                pinToBottom(publicContainer, 4000);
            });

            setConnection('connected');
        } catch (err) {
            publicContainer.innerHTML = '';
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
            const { data: inserted, error } = await supabase.from(table).insert([payload]).select().single();
            if (error) throw error;
            messageInput.value = '';
            setReplyingTo(null);
            clearAttachedImage();
            stopTyping();
            startCooldown(modCooldownSeconds);
            if (window.addXP && inserted?.id) window.addXP(inserted.id);
            autoScroll = true;
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
                const wasAuto = autoScroll;
                renderMessage(payload.new, false, wasAuto);
                setConnection('connected');
                if (wasAuto) scrollContainerToBottom(publicContainer);
            })
            .subscribe();
        if (privMsgChannel) supabase.removeChannel(privMsgChannel);
        privMsgChannel = supabase.channel('private-msgs')
            .on('postgres_changes', { event:'INSERT', schema:'public', table:'private_messages' }, payload => {
                const msg = payload.new;
                if (activePrivateChat && ((msg.from_user === username && msg.to_user === activePrivateChat) || (msg.from_user === activePrivateChat && msg.to_user === username))) {
                    const wasAuto = autoScroll;
                    renderMessage(msg, true, wasAuto);
                    if (wasAuto) scrollContainerToBottom(privateContainer);
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
        const wallet = getWalletAddress();
        if (!wallet) {
            showError('Connect Phantom before saving your profile.');
            return false;
        }

        username = name;
        localStorage.setItem(STORAGE_KEY_NAME, name);
        localStorage.setItem(LAST_USERNAME_KEY, name);

        let avatarUrlToUse = currentAvatarUrl;
        if (profilePicFile) {
            try {
                avatarUrlToUse = await uploadToStorage(profilePicFile, AVATAR_BUCKET, 300);
                currentAvatarUrl = avatarUrlToUse;
            } catch (err) { showError('Avatar upload failed: ' + err.message); }
        }

        const { error: upsertErr } = await upsertProfile({
            username: name,
            avatar_url: avatarUrlToUse
        });

        if (upsertErr) {
            console.error('Profile save failed:', upsertErr);
            showError('Profile save failed: ' + (upsertErr.message || 'unknown'));
            return false;
        }

        avatarCache[name] = avatarUrlToUse;
        if (sidebarBigAvatar) {
            if (avatarUrlToUse) sidebarBigAvatar.innerHTML = `<img src="${avatarUrlToUse}" style="width:100%;height:100%;object-fit:cover;">`;
            else sidebarBigAvatar.innerHTML = (name[0]||'?').toUpperCase();
        }
        if (sidebarBigName) sidebarBigName.textContent = name;

        inputAreaBar.classList.remove('hidden');
        nameOverlay.classList.add('hidden');
        hideOverlayMessage();
        setReplyingTo(null);
        setActivePrivateChat(null);
        switchTab('public');
        await updateSidebarUI();
        setupTypingChannel();
        updateChatAccessibility();

        try { window.dispatchEvent(new Event('msn:wallet-connected')); } catch (e) {}
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  ⚑ RIGHT SIDEBAR — desktop-only utility column
    //  Vertical stack of action cards: SKINS / RANK / MOD
    // ═══════════════════════════════════════════════════════════
    const _rsMoved = [];

    function buildRightSidebar() {
        if (document.getElementById('msnRightSidebar')) return;
        const chatPanel = document.getElementById('chatPanel');
        if (!chatPanel) return;

        const right = document.createElement('aside');
        right.id = 'msnRightSidebar';
        right.className = 'msn-right-sidebar';

        const s2 = document.createElement('div');
        s2.className = 'msn-rs-section';
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'msn-rs-actions';
        s2.appendChild(actionsWrap);
        right.appendChild(s2);

        chatPanel.appendChild(right);

        // ⚑ chatTabs stays in the chat panel — NOT moved here.
        const moves = [
            { el: document.getElementById('headerThemeBtn'), into: actionsWrap, label: 'SKINS' },
            { el: document.getElementById('rankingsBtn'),    into: actionsWrap, label: 'RANK'  },
            { el: document.getElementById('modSettingsBtn'), into: actionsWrap, label: 'MOD'   },
        ];

        moves.forEach(({ el, into, label }) => {
            if (!el || !into) return;

            _rsMoved.push({
                el,
                parent: el.parentNode,
                next: el.nextSibling
            });

            if (label && !el.querySelector('.msn-rs-card-label')) {
                const lbl = document.createElement('span');
                lbl.className = 'msn-rs-card-label';
                lbl.textContent = label;
                el.appendChild(lbl);
            }

            el.classList.add('msn-rs-card');

            into.appendChild(el);
        });
    }

    function destroyRightSidebar() {
        const right = document.getElementById('msnRightSidebar');
        if (!right) return;

        _rsMoved.forEach(({ el, parent, next }) => {
            if (!parent) return;

            const lbl = el.querySelector('.msn-rs-card-label');
            if (lbl) lbl.remove();
            el.classList.remove('msn-rs-card');

            try {
                if (next && next.parentNode === parent) {
                    parent.insertBefore(el, next);
                } else {
                    parent.appendChild(el);
                }
            } catch (e) {
                parent.appendChild(el);
            }
        });

        _rsMoved.length = 0;
        right.remove();
    }

    function syncRightSidebar() {
        const isDesktop = window.innerWidth >= 769;
        const exists = !!document.getElementById('msnRightSidebar');
        if (isDesktop && !exists) buildRightSidebar();
        else if (!isDesktop && exists) destroyRightSidebar();
    }

    let _lastDesktop = window.innerWidth >= 769;
    window.addEventListener('resize', () => {
        const nowDesktop = window.innerWidth >= 769;
        if (nowDesktop !== _lastDesktop) {
            _lastDesktop = nowDesktop;
            syncRightSidebar();
        }
    });

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
        const newName = nameInput.value.trim();
        if (!newName) return;

        if (!phantomConnected || !phantomWalletPublicKey) {
            showError('Please connect Phantom before saving your profile.');
            return;
        }

        const saved = await applyUsername(newName);
        if (!saved) return;

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

    sidebarChangeNameBtn.addEventListener('click', () => {
        if (!phantomConnected || !phantomWalletPublicKey) {
            showError('Connect Phantom first to edit your profile.');
            return;
        }

        const prevName = username;
        const prevAvatar = getAvatarURL(prevName) || null;
        currentAvatarUrl = prevAvatar;

        localStorage.removeItem(STORAGE_KEY_NAME);
        username = '';
        inputAreaBar.classList.add('hidden');
        nameOverlay.classList.remove('hidden');
        hideOverlayMessage();
        nameInput.value = prevName || '';
        nameInput.focus();

        if (prevAvatar) profilePicPreview.innerHTML = `<img src="${prevAvatar}" alt="Profile">`;
        else profilePicPreview.innerHTML = '<span>📷</span>';
        profilePicFile = null;

        setReplyingTo(null);
        setActivePrivateChat(null);
        if(presenceChannel) { presenceChannel.untrack(); supabase.removeChannel(presenceChannel); presenceChannel = null; }
        onlineUsers.clear();
        updateSidebarUI();
    });
    if (mobileEditBtn) {
        mobileEditBtn.addEventListener('click', () => { sidebarChangeNameBtn.click(); });
    }

    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.getElementById('chatPanel').addEventListener('click', (e) => {
        if(window.innerWidth<=768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target!==sidebarToggle && !sidebarToggle.contains(e.target)) {
            if (!requestOverlay.classList.contains('hidden')) return;
            sidebar.classList.remove('open');
        }
    });

    async function init() {
        if (window.innerWidth <= 768) sidebarToggle.classList.remove('hidden');

        // ⚑ Build right sidebar on desktop
        syncRightSidebar();

        // ⚑ Ensure MOD card is hidden by default (only mod wallet will reveal it)
        checkIfModWallet();

        const provider = getPhantomProvider();
        if (provider) {
            // ⚑ Re-evaluate mod status whenever the wallet changes
            try {
                provider.on?.('disconnect',     () => { checkIfModWallet(); });
                provider.on?.('accountChanged', () => { checkIfModWallet(); });
                provider.on?.('connect',        () => { checkIfModWallet(); });
            } catch (e) { /* ignore */ }

            if (provider.isConnected && provider.publicKey) {
                phantomWalletPublicKey = provider.publicKey;
                phantomConnected = true;
                updatePhantomUI();
                fetchAndDisplayAllTokens();
            } else {
                provider.connect({ onlyIfTrusted: true })
                    .then(resp => {
                        phantomWalletPublicKey = resp.publicKey;
                        phantomConnected = true;
                        updatePhantomUI();
                        fetchAndDisplayAllTokens();
                    })
                    .catch(() => { /* not trusted */ });
            }
        }

        setupTweetObserver();

        await loadSettings();
        subscribeToSettings();

        inputAreaBar.classList.add('hidden');

        if(username) {
            let profile = null;
            const walletForRead = getWalletAddress();
            if (walletForRead) {
                const { data } = await supabase.from('profiles')
                    .select('avatar_url, token_balance, wallet_address, username')
                    .eq('wallet_address', walletForRead)
                    .maybeSingle();
                profile = data;
                if (profile?.username && profile.username !== username) {
                    username = profile.username;
                    localStorage.setItem(STORAGE_KEY_NAME, username);
                }
            } else {
                const { data } = await supabase.from('profiles')
                    .select('avatar_url, token_balance, wallet_address')
                    .eq('username', username)
                    .maybeSingle();
                profile = data;
            }

            await loadAcceptedChatsFromDB();

            if(profile && profile.avatar_url) {
                avatarCache[username] = profile.avatar_url;
                currentAvatarUrl = profile.avatar_url;
                if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                if (sidebarBigAvatar) sidebarBigAvatar.innerHTML = (username[0]||'?').toUpperCase();
            }
            if (profile && profile.wallet_address) {
                userBalances[username] = profile.token_balance || 0;
                updateUserRank(userBalances[username]);
            } else {
                userBalances[username] = null;
                updateUserRank(null);
            }
            if (sidebarBigName) sidebarBigName.textContent = username;
            inputAreaBar.classList.remove('hidden');
            nameOverlay.classList.add('hidden');
            setReplyingTo(null);

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
                activePrivateChat = savedActiveChat;
                privateIndicatorBar.classList.remove('hidden');
                privateChatUserDisp.textContent = savedActiveChat;
                messageInput.placeholder = 'Type a message...';
            }

            // ⚑ Boot sequence complete — release the loading screen
            try { document.dispatchEvent(new CustomEvent('msn:app-ready')); } catch (e) {}
        } else {
            const lastUsername = localStorage.getItem(LAST_USERNAME_KEY);
            const walletForLast = getWalletAddress();
            let lastProfile = null;

            if (walletForLast) {
                const { data } = await supabase.from('profiles')
                    .select('avatar_url, username')
                    .eq('wallet_address', walletForLast)
                    .maybeSingle();
                lastProfile = data;
                if (lastProfile?.username) {
                    nameInput.value = lastProfile.username;
                } else if (lastUsername) {
                    nameInput.value = lastUsername;
                }
            } else if (lastUsername) {
                nameInput.value = lastUsername;
                const { data } = await supabase.from('profiles')
                    .select('avatar_url')
                    .eq('username', lastUsername)
                    .maybeSingle();
                lastProfile = data;
            }

            if (lastProfile && lastProfile.avatar_url) {
                currentAvatarUrl = lastProfile.avatar_url;
                profilePicPreview.innerHTML = `<img src="${lastProfile.avatar_url}" alt="Profile">`;
            } else {
                currentAvatarUrl = null;
                profilePicPreview.innerHTML = '<span>📷</span>';
            }
            nameOverlay.classList.remove('hidden');
            hideOverlayMessage();
            nameInput.focus();
            subscribeToRealtime();

            // ⚑ Boot sequence complete — release the loading screen
            try { document.dispatchEvent(new CustomEvent('msn:app-ready')); } catch (e) {}
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
