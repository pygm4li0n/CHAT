/* ═══════════════════════════════════════════════════════
   IDENTITY STAGE — guest flow + open-on-demand
   App boots into the chat. Guest sees everything.
   Input becomes a "Connect to chat" CTA.
   ═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var OVERLAY = 'nameOverlay';
    var prompted = false;   // guard so we don't re-open after close

    function hasIdentity() {
        try {
            return !!localStorage.getItem('msn_chat_username');
        } catch (e) { return false; }
    }

    function isGuest() {
        return document.body.classList.contains('msn-guest');
    }

    function enterGuestMode() {
        document.body.classList.add('msn-guest');

        var inp = document.getElementById('messageInput');
        if (inp) {
            inp.value = '';
            inp.readOnly = true;
            inp.placeholder = '🔒 Click here to connect & chat';
        }

        var overlay = document.getElementById(OVERLAY);
        if (overlay) overlay.classList.add('hidden');

        var bar = document.getElementById('inputAreaBar');
        if (bar) bar.classList.remove('hidden');
    }

    function exitGuestMode() {
        document.body.classList.remove('msn-guest');
        var inp = document.getElementById('messageInput');
        if (inp) {
            inp.readOnly = false;
            inp.placeholder = 'Type a message...';
        }
    }

    function openIdentityOverlay() {
        var overlay = document.getElementById(OVERLAY);
        if (!overlay) return;

        // Reposition over everything
        overlay.classList.remove('hidden');

        // Focus the name input
        setTimeout(function () {
            var n = document.getElementById('nameInput');
            if (n) n.focus();
        }, 120);
    }

    function wireGuestInput() {
        var inp = document.getElementById('messageInput');
        if (!inp || inp.dataset.guestWired) return;
        inp.dataset.guestWired = '1';

        // Block typing but allow click-through to open overlay
        inp.addEventListener('beforeinput', function (e) {
            if (!isGuest()) return;
            e.preventDefault();
            openIdentityOverlay();
        }, true);

        inp.addEventListener('keydown', function (e) {
            if (!isGuest()) return;
            if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopImmediatePropagation();
                openIdentityOverlay();
            }
        }, true);

        inp.addEventListener('click', function () {
            if (isGuest()) openIdentityOverlay();
        });

        inp.addEventListener('focus', function () {
            if (isGuest()) { inp.blur(); openIdentityOverlay(); }
        });

        // Block sends while guest
        var sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', function (e) {
                if (isGuest()) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    openIdentityOverlay();
                }
            }, true);
        }
    }

    // Watch for the overlay — script.js might show it on boot.
    // We swallow that if the user hasn't tried to join yet.
    function watchOverlay() {
        var overlay = document.getElementById(OVERLAY);
        if (!overlay) { setTimeout(watchOverlay, 300); return; }

        var mo = new MutationObserver(function () {
            var visible = !overlay.classList.contains('hidden');
            if (!visible) return;

            // If we're in guest mode and the user hasn't manually opened it, hide it
            if (isGuest() && !prompted) {
                overlay.classList.add('hidden');
            }
        });
        mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    // When user successfully joins, exit guest mode
    function watchJoin() {
        var btn = document.getElementById('nameSubmitBtn');
        if (!btn || btn.dataset.joinWired) return;
        btn.dataset.joinWired = '1';
        btn.addEventListener('click', function () {
            prompted = true;
            setTimeout(function () {
                if (hasIdentity()) exitGuestMode();
            }, 800);
        }, true);
    }

    function boot() {
        watchOverlay();
        watchJoin();

        if (!hasIdentity()) {
            // Guest flow
            enterGuestMode();
            wireGuestInput();

            // Ensure input stays wired even if script.js rebuilds it
            setInterval(function () {
                if (!isGuest()) return;
                var inp = document.getElementById('messageInput');
                if (inp && inp.placeholder !== '🔒 Click here to connect & chat') {
                    enterGuestMode();
                }
            }, 1500);
        } else {
            // Has identity — normal flow
            exitGuestMode();
        }

        // Re-check on wallet connect (script.js sets the username)
        setInterval(function () {
            if (hasIdentity() && isGuest()) exitGuestMode();
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
