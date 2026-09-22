/* ============================================================
   stickers.js — MSN Sticker Pack  ·  v6
   ────────────────────────────────────────────────────────────
     <script src="stickers.js?v=7"></script>

   • ✨ button left of the image button
   • Picker is position:fixed on <body> — no clipping possible
   • 4×4 grid of clean rounded-square thumbnails
   • Empty slots show a placeholder — grid is always 16 cells
   • Click a sticker → sends instantly + jumps to bottom
   • Sticker messages render without bubble
   ============================================================ */
(function () {
    'use strict';
    if (window.MSNStickers) return;

    var SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    /* ══════════════════════════════════════════════════════
       STICKER PACK — add as many as you want.
       The grid is always 4×4 (16 slots). Extras fill in
       order; empty slots show a placeholder.
       ══════════════════════════════════════════════════════ */
    var STICKERS = [
        { key: 'meme1', url: 'https://i.postimg.cc/yNHdMQMf/Chat-GPT-Image-21-sept-2026-09-05-17-p-m-(1).png' }
    ];

    var GRID_SLOTS = 16;   // 4 × 4

    var MARKER_RE = /^__sticker:([a-zA-Z0-9_\-]+)__$/;
    var DATA_ATTR = 'data-sticker-rendered';

    /* ── helpers ─────────────────────────────────────────── */
    function getSB() {
        if (window.MSN && window.MSN.supabase) return window.MSN.supabase;
        if (window.supabase && window.supabase.createClient) {
            window.MSN = window.MSN || {};
            window.MSN.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window.MSN.supabase;
        }
        return null;
    }
    function getSelfUsername() {
        try { return localStorage.getItem('msn_chat_username') || null; } catch (e) { return null; }
    }
    function getWalletAddress() {
        try {
            var p = window.phantom && window.phantom.solana;
            if (p && p.publicKey) return p.publicKey.toBase58();
            var s = window.solana;
            if (s && s.publicKey) return s.publicKey.toBase58();
        } catch (e) {}
        try { return localStorage.getItem('msn_cached_wallet') || null; } catch (e) { return null; }
    }
    function currentTab() {
        var active = document.querySelector('.chat-tab.active');
        return (active && active.getAttribute('data-tab')) || 'public';
    }
    function activePrivatePartner() {
        try { return localStorage.getItem('msn_active_private_chat') || null; } catch (e) { return null; }
    }
    function isCooldownActive() {
        var el = document.getElementById('cooldownIndicator');
        return !!(el && !el.classList.contains('hidden'));
    }
    function toast(msg) {
        var el = document.getElementById('errorToast');
        if (!el) { console.log('[stickers]', msg); return; }
        el.classList.remove('visible');
        void el.offsetWidth;
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(el._msnStickerTimeout);
        el._msnStickerTimeout = setTimeout(function () { el.classList.remove('visible'); }, 5000);
    }
    function escAttr(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m];
        });
    }
    function keyFromText(t) {
        if (!t) return null;
        var m = String(t).match(MARKER_RE);
        return m ? m[1] : null;
    }
    function urlFromKey(k) {
        for (var i = 0; i < STICKERS.length; i++) {
            if (STICKERS[i].key === k) return STICKERS[i].url;
        }
        return null;
    }

    /* ── transform rendered message into sticker ─────────── */
    function transformMessage(wrapper) {
        if (!wrapper || wrapper.getAttribute(DATA_ATTR) === '1') return;
        var bubble = wrapper.querySelector('.msg-bubble');
        if (!bubble) return;

        var textEl = bubble.querySelector('.msg-text');
        if (textEl) {
            var key = keyFromText(textEl.textContent);
            if (key) {
                var url = urlFromKey(key);
                if (url) {
                    wrapper.classList.add('sticker-msg');
                    var imgWrap = document.createElement('div');
                    imgWrap.className = 'msg-image-wrap sticker-wrap';
                    imgWrap.setAttribute('data-img-src', url);
                    imgWrap.innerHTML = '<img src="' + escAttr(url) + '" alt="sticker" loading="lazy">';
                    imgWrap.addEventListener('click', function (e) {
                        e.stopPropagation();
                        var src = imgWrap.getAttribute('data-img-src');
                        var lbi = document.getElementById('lightboxImg');
                        var lbo = document.getElementById('lightboxOverlay');
                        if (src && lbi && lbo) {
                            lbi.src = src;
                            lbo.classList.remove('hidden');
                        }
                    });
                    textEl.replaceWith(imgWrap);
                    var editBtn = bubble.querySelector('.edit-btn');
                    if (editBtn) editBtn.style.display = 'none';
                }
            }
        }

        var rText = bubble.querySelector('.reply-ref-block .r-text');
        if (rText && rText.textContent.indexOf('__sticker:') !== -1) {
            rText.textContent = '"🖼️ Sticker"';
        }

        wrapper.setAttribute(DATA_ATTR, '1');
    }

    function scanContainer(root) {
        if (!root) return;
        var list = root.querySelectorAll('.msg-wrapper:not([' + DATA_ATTR + '])');
        for (var i = 0; i < list.length; i++) transformMessage(list[i]);
    }

    function setupObserver() {
        if (!('MutationObserver' in window)) return;
        var containers = [
            document.getElementById('publicMessagesContainer'),
            document.getElementById('privateMessagesContainer')
        ];
        var mo = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var added = muts[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains('msg-wrapper')) {
                        transformMessage(node);
                    } else if (node.querySelectorAll) {
                        var inner = node.querySelectorAll('.msg-wrapper:not([' + DATA_ATTR + '])');
                        for (var k = 0; k < inner.length; k++) transformMessage(inner[k]);
                    }
                }
            }
        });
        containers.forEach(function (c) {
            if (c) mo.observe(c, { childList: true, subtree: true });
        });
        containers.forEach(scanContainer);
    }

    function watchReplyPreview() {
        var el = document.getElementById('replyPreviewDisp');
        if (!el) { setTimeout(watchReplyPreview, 500); return; }
        var fix = function () {
            var t = el.textContent || '';
            if (t.indexOf('__sticker:') !== -1) el.textContent = '"🖼️ Sticker"';
        };
        var mo = new MutationObserver(fix);
        mo.observe(el, { childList: true, characterData: true, subtree: true });
    }

    /* ── CSS ─────────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById('msn-sticker-styles')) return;
        var css = [
            '.btn-upload-img.sticker-btn { font-size: 1.1rem; }',

            '.sticker-picker {',
            '  position: fixed !important;',
            '  z-index: 999999 !important;',
            '  padding: 12px !important;',
            '  background: linear-gradient(180deg, rgba(20,26,40,.99) 0%, rgba(10,14,24,.995) 100%) !important;',
            '  border: 1px solid var(--border-default, #233261) !important;',
            '  border-radius: 16px !important;',
            '  box-shadow: 0 12px 40px rgba(0,0,0,.8), 0 0 24px var(--accent-cyan, rgba(0,240,255,.2)) !important;',
            '  width: 336px !important;',
            '  max-height: 400px !important;',
            '  overflow-y: auto !important;',
            '  overflow-x: hidden !important;',
            '  box-sizing: border-box !important;',
            '  animation: stickerPickerIn .22s cubic-bezier(.16,1,.3,1);',
            '  will-change: transform, opacity;',
            '}',
            '.sticker-picker::after {',
            '  content: "";',
            '  position: absolute;',
            '  left: var(--caret-x, 20px);',
            '  bottom: -7px;',
            '  width: 12px; height: 12px;',
            '  background: rgba(10,14,24,.995);',
            '  border-right: 1px solid var(--border-default, #233261);',
            '  border-bottom: 1px solid var(--border-default, #233261);',
            '  transform: rotate(45deg);',
            '  pointer-events: none;',
            '}',
            '@keyframes stickerPickerIn {',
            '  from { opacity: 0; transform: translateY(8px) scale(.94); }',
            '  to   { opacity: 1; transform: translateY(0) scale(1); }',
            '}',

            '.sticker-picker-grid {',
            '  display: grid !important;',
            '  grid-template-columns: repeat(4, 1fr) !important;',
            '  grid-template-rows: repeat(4, 1fr) !important;',
            '  gap: 8px !important;',
            '}',

            '.sticker-item {',
            '  aspect-ratio: 1 / 1;',
            '  padding: 4px;',
            '  border-radius: 12px;',
            '  background: rgba(255,255,255,.035);',
            '  border: 1px solid rgba(35,50,97,.6);',
            '  cursor: pointer;',
            '  display: flex; align-items: center; justify-content: center;',
            '  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, background .16s ease;',
            '  overflow: hidden; min-width: 0; box-sizing: border-box;',
            '}',
            '.sticker-item img {',
            '  width: 100%; height: 100%;',
            '  object-fit: contain;',
            '  display: block; pointer-events: none;',
            '  transition: transform .16s ease;',
            '  border-radius: 8px;',
            '}',
            '.sticker-item:hover {',
            '  border-color: var(--accent-cyan, #00f0ff);',
            '  background: rgba(0,240,255,.07);',
            '  box-shadow: 0 0 14px var(--accent-cyan, rgba(0,240,255,.45));',
            '  transform: translateY(-2px);',
            '}',
            '.sticker-item:hover img { transform: scale(1.06); }',
            '.sticker-item:active { transform: scale(.94); }',

            '.sticker-item.sticker-empty {',
            '  border-style: dashed !important;',
            '  border-color: rgba(35,50,97,.45) !important;',
            '  background: rgba(255,255,255,.015) !important;',
            '  cursor: default;',
            '  pointer-events: none;',
            '  opacity: .55;',
            '}',
            '.sticker-item.sticker-empty::before {',
            '  content: "·";',
            '  color: var(--text-muted, #64748b);',
            '  font-size: 1.4rem;',
            '  font-weight: 900;',
            '  line-height: 1;',
            '  opacity: .6;',
            '}',

            '.msg-wrapper.sticker-msg .msg-bubble {',
            '  background: transparent !important;',
            '  border: none !important;',
            '  box-shadow: none !important;',
            '  padding: 0 !important;',
            '  backdrop-filter: none !important;',
            '  -webkit-backdrop-filter: none !important;',
            '}',
            '.msg-wrapper.sticker-msg .msg-bubble::before,',
            '.msg-wrapper.sticker-msg .msg-bubble::after { content: none !important; display: none !important; }',
            '.msg-wrapper.sticker-msg .msg-image-wrap {',
            '  margin-top: 4px;',
            '  max-width: 260px;',
            '  border-radius: 10px;',
            '  background: transparent; border: none; box-shadow: none;',
            '  cursor: pointer;',
            '  transition: transform .2s ease;',
            '}',
            '.msg-wrapper.sticker-msg .msg-image-wrap img {',
            '  width: 100%; height: auto; max-height: 260px;',
            '  object-fit: contain; display: block;',
            '  filter: drop-shadow(0 4px 12px rgba(0,0,0,.5));',
            '}',
            '.msg-wrapper.sticker-msg .msg-image-wrap:hover { box-shadow: none; transform: translateY(-2px); }',

            '@media (max-width: 480px) {',
            '  .sticker-picker { width: 280px !important; max-height: 340px !important; padding: 10px !important; }',
            '  .sticker-picker-grid { gap: 6px !important; }',
            '  .sticker-item { padding: 3px; border-radius: 10px; }',
            '  .msg-wrapper.sticker-msg .msg-image-wrap { max-width: 190px; }',
            '  .msg-wrapper.sticker-msg .msg-image-wrap img { max-height: 190px; }',
            '}'
        ].join('\n');
        var tag = document.createElement('style');
        tag.id = 'msn-sticker-styles';
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ── button + picker injection ───────────────────────── */
    var pickerEl = null;

    function injectButtonAndPicker() {
        if (document.getElementById('stickerBtn')) return;
        var inputRow = document.querySelector('.input-row-wrap');
        if (!inputRow) return;

        var btn = document.createElement('button');
        btn.className = 'btn-upload-img sticker-btn';
        btn.id = 'stickerBtn';
        btn.type = 'button';
        btn.title = 'Send sticker';
        btn.textContent = '✨';

        var uploadBtn = document.getElementById('uploadImgBtn');
        if (uploadBtn && uploadBtn.parentNode === inputRow) {
            inputRow.insertBefore(btn, uploadBtn);
        } else {
            var sendBtn = document.getElementById('sendBtn');
            if (sendBtn && sendBtn.parentNode === inputRow) inputRow.insertBefore(btn, sendBtn);
            else inputRow.appendChild(btn);
        }

        pickerEl = document.createElement('div');
        pickerEl.id = 'stickerPicker';
        pickerEl.className = 'sticker-picker';
        pickerEl.style.display = 'none';
        pickerEl.innerHTML = '<div class="sticker-picker-grid" id="stickerPickerGrid"></div>';
        document.body.appendChild(pickerEl);

        btn.addEventListener('click', function (e) { e.stopPropagation(); togglePicker(); });
        pickerEl.addEventListener('click', function (e) {
            var item = e.target.closest('.sticker-item:not(.sticker-empty)');
            if (!item) return;
            e.stopPropagation();
            sendSticker(item.getAttribute('data-key'));
        });
        document.addEventListener('click', function (e) {
            if (!pickerEl || pickerEl.style.display === 'none') return;
            if (e.target.closest('#stickerPicker') || e.target.closest('#stickerBtn')) return;
            closePicker();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closePicker();
        });

        window.addEventListener('resize', function () {
            if (pickerEl && pickerEl.style.display !== 'none') positionPicker();
        });
        window.addEventListener('scroll', function () {
            if (pickerEl && pickerEl.style.display !== 'none') positionPicker();
        }, true);
    }

    function positionPicker() {
        if (!pickerEl) return;
        var btn = document.getElementById('stickerBtn');
        if (!btn) return;

        var btnRect = btn.getBoundingClientRect();
        var pickerWidth = pickerEl.offsetWidth || 336;
        var pickerHeight = pickerEl.offsetHeight || 380;

        var margin = 8;
        var vw = window.innerWidth;

        var left = btnRect.left + btnRect.width / 2 - pickerWidth / 2;
        var top = btnRect.top - pickerHeight - 12;

        if (left < margin) left = margin;
        if (left + pickerWidth > vw - margin) left = vw - pickerWidth - margin;

        if (top < margin) top = btnRect.bottom + 12;

        pickerEl.style.left = left + 'px';
        pickerEl.style.top = top + 'px';

        var caretX = btnRect.left + btnRect.width / 2 - left - 6;
        if (caretX < 12) caretX = 12;
        if (caretX > pickerWidth - 24) caretX = pickerWidth - 24;
        pickerEl.style.setProperty('--caret-x', caretX + 'px');
    }

    function renderPicker() {
        var grid = document.getElementById('stickerPickerGrid');
        if (!grid) return;

        var cells = [];
        var i;
        for (i = 0; i < STICKERS.length && i < GRID_SLOTS; i++) {
            var s = STICKERS[i];
            cells.push(
                '<button type="button" class="sticker-item" data-key="' + escAttr(s.key) + '" title="' + escAttr(s.key) + '">' +
                  '<img src="' + escAttr(s.url) + '" alt="' + escAttr(s.key) + '" loading="lazy">' +
                '</button>'
            );
        }
        for (; i < GRID_SLOTS; i++) {
            cells.push('<div class="sticker-item sticker-empty" aria-hidden="true"></div>');
        }
        grid.innerHTML = cells.join('');
    }

    function openPicker() {
        if (!pickerEl) return;
        renderPicker();
        pickerEl.style.display = 'block';
        void pickerEl.offsetWidth;
        positionPicker();
    }
    function closePicker() {
        if (pickerEl) pickerEl.style.display = 'none';
    }
    function togglePicker() {
        if (!pickerEl) return;
        if (pickerEl.style.display === 'none') openPicker(); else closePicker();
    }

    /* ── send ────────────────────────────────────────────── */
    async function sendSticker(key) {
        if (!key) return;

        if (typeof window.MSNStickers.canSend === 'function') {
            try {
                var allowed = await window.MSNStickers.canSend(key);
                if (!allowed) return;
            } catch (e) {}
        }

        var sb = getSB();
        if (!sb) { toast('Not connected'); return; }

        var me = getSelfUsername();
        if (!me) { toast('Set your username first'); return; }
        if (isCooldownActive()) { toast('Cooldown active — wait a moment'); return; }

        var tab = currentTab();
        var isPrivate = (tab === 'private');
        var partner = isPrivate ? activePrivatePartner() : null;
        if (isPrivate && !partner) { toast('No private partner selected.'); return; }

        var table = isPrivate ? 'private_messages' : 'messages';
        var payload = {
            message: '__sticker:' + key + '__',
            image_url: null,
            created_at: new Date().toISOString()
        };
        if (isPrivate) { payload.from_user = me; payload.to_user = partner; }
        else { payload.username = me; }

        try {
            var res = await sb.from(table).insert([payload]).select().single();
            if (res.error) throw res.error;

            // ⚑ Local echo — render immediately in sender's own chat
            try {
                document.dispatchEvent(new CustomEvent('msn:render-local-message', {
                    detail: { message: res.data, isPrivate: isPrivate }
                }));
            } catch (e) { /* ignore */ }

            if (window.addXP && res.data && res.data.id) {
                try { window.addXP(res.data.id); } catch (e) {}
            }
            if (!isPrivate) {
                var wallet = getWalletAddress();
                if (wallet) {
                    try { await sb.rpc('increment_messages_count', { p_wallet: wallet }); }
                    catch (e) {}
                }
            }
            closePicker();
        } catch (err) {
            toast('Sticker failed: ' + (err.message || err));
        }
    }

    /* ── boot ────────────────────────────────────────────── */
    function boot() {
        injectStyles();
        injectButtonAndPicker();
        setupObserver();
        watchReplyPreview();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    setTimeout(injectButtonAndPicker, 800);
    setTimeout(injectButtonAndPicker, 2000);

    window.MSNStickers = {
        send: sendSticker,
        stickers: STICKERS,
        open: openPicker,
        close: closePicker,
        canSend: null,
        refresh: function () {
            scanContainer(document.getElementById('publicMessagesContainer'));
            scanContainer(document.getElementById('privateMessagesContainer'));
        }
    };

    console.log('[stickers] v6 loaded — ' + STICKERS.length + ' sticker(s), ' + GRID_SLOTS + ' slots');
})();
