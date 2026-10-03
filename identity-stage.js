/* ═══════════════════════════════════════════════════════
   IDENTITY STAGE — guest mode + join button polish
   Self-contained. No edits to script.js required.
   ═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    window.__msnIsGuest = false;

    function guestToast() {
        var toast = document.getElementById('errorToast');
        if (!toast) return;
        toast.textContent = '👀 Guest mode — connect Phantom to chat';
        toast.classList.add('visible');
        clearTimeout(toast._guestTimeout);
        toast._guestTimeout = setTimeout(function () {
            toast.classList.remove('visible');
        }, 4000);
    }

    function enterGuestMode() {
        window.__msnIsGuest = true;
        var overlay = document.getElementById('nameOverlay');
        if (overlay) overlay.classList.add('hidden');
        var bar = document.getElementById('inputAreaBar');
        if (bar) bar.classList.remove('hidden');
        guestToast();
    }

    // ── Wire up the guest button ──
    function wireGuestButton() {
        var btn = document.getElementById('guestBtn');
        if (!btn || btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            enterGuestMode();
        });
    }

    // ── Block send attempts while guest ──
    document.addEventListener('click', function (e) {
        if (!window.__msnIsGuest) return;
        if (e.target && e.target.closest && e.target.closest('#sendBtn')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            guestToast();
        }
    }, true);

    document.addEventListener('keydown', function (e) {
        if (!window.__msnIsGuest) return;
        if (e.key !== 'Enter' && e.key !== 'NumpadEnter') return;
        var inp = document.getElementById('messageInput');
        if (document.activeElement !== inp) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        guestToast();
    }, true);

    // ── Guest placeholder ──
    function applyGuestPlaceholder() {
        if (!window.__msnIsGuest) return;
        var inp = document.getElementById('messageInput');
        if (inp && !inp.disabled) inp.placeholder = '👀 Guest mode — connect Phantom to chat';
    }
    setInterval(applyGuestPlaceholder, 1200);

    // ── Clear guest flag after a successful join ──
    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        if (!e.target.closest('#nameSubmitBtn')) return;
        // script.js's handler runs on the same click; give it a beat
        setTimeout(function () {
            if (localStorage.getItem('msn_chat_username')) {
                window.__msnIsGuest = false;
            }
        }, 600);
    }, true);

    // ── Boot ──
    function boot() {
        wireGuestButton();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    // If script.js rebuilds the overlay at any point, re-wire
    var overlay = document.getElementById('nameOverlay');
    if (overlay) {
        new MutationObserver(wireGuestButton).observe(overlay, { childList: true, subtree: true });
    }
})();
