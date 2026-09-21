/* ============================================================
   loading-screen.js — MSN Boot Sequence (minimal)
   ────────────────────────────────────────────────────────────
   Just the logo + rotating ring animation. Same on desktop,
   mobile and Phantom. No bar, no text, no corners, no dots.

   Reveal sequence:
     1. wait for 'msn:app-ready' (or fallback signal)
     2. settleApp()  → unhide input bar, force scroll to bottom
     3. dwell 800ms  → everything paints
     4. remove html.msn-booting → app fades in
     5. fade out the loader

   Load BEFORE script.js — injects itself as first body child.
   ============================================================ */
(function () {
    'use strict';

    if (document.getElementById('msnBootOverlay')) return;

    var CSS_ID = 'msn-boot-styles';
    var OVERLAY_ID = 'msnBootOverlay';
    var REVEAL_DELAY = 800;   // dwell after ready before reveal
    var FADE_DURATION = 500;
    var MAX_WAIT = 12000;     // hard timeout — never sticks

    var LOGO_URL = 'https://i.postimg.cc/fbZCV8sQ/Chat-GPT-Image-20-sept-2026-23-51-47.png';
    var LOGO_FALLBACK = 'https://i.postimg.cc/HWf8LcLQ/Proyecto-nuevo-(4)-(1).png';

    /* Warm the logo cache so it never flashes */
    (function () { var i = new Image(); i.src = LOGO_URL; })();

    /* ── CSS ─────────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById(CSS_ID)) return;
        var css = ''
        + '#msnBootOverlay{'
        +   'position:fixed;inset:0;z-index:999999;'
        +   'display:flex;align-items:center;justify-content:center;'
        +   'background:radial-gradient(circle at 50% 45%, rgba(18,26,44,0.96) 0%, rgba(2,4,10,0.995) 70%),#02040a;'
        +   'opacity:1;visibility:visible;'
        +   'transition:opacity .5s ease, visibility .5s ease;'
        +   'overflow:hidden;-webkit-user-select:none;user-select:none;'
        + '}'
        + '#msnBootOverlay::before{'
        +   'content:"";position:absolute;inset:0;pointer-events:none;'
        +   'background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,0.20) 2px 3px);'
        +   'opacity:0.28;z-index:1;'
        + '}'
        + '#msnBootOverlay::after{'
        +   'content:"";position:absolute;inset:0;pointer-events:none;'
        +   'background:radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.72) 100%);'
        +   'z-index:1;'
        + '}'
        + '#msnBootOverlay.done{opacity:0;visibility:hidden;pointer-events:none;}'

        + '.msn-boot-wrap{'
        +   'position:relative;z-index:3;'
        +   'display:flex;align-items:center;justify-content:center;'
        +   'width:100%;height:100%;'
        + '}'

        /* Rotating ring system behind the logo */
        + '.msn-boot-ring{'
        +   'position:absolute;top:50%;left:50%;'
        +   'width:260px;height:260px;max-width:72vw;max-height:72vw;'
        +   'transform:translate(-50%,-50%);border-radius:50%;'
        +   'border:1px solid rgba(0,240,255,0.14);pointer-events:none;'
        + '}'
        + '.msn-boot-ring::before{'
        +   'content:"";position:absolute;inset:-1px;border-radius:50%;'
        +   'border:2px solid transparent;'
        +   'border-top-color:var(--accent-cyan, #00f0ff);'
        +   'border-right-color:rgba(0,240,255,0.5);'
        +   'filter:drop-shadow(0 0 8px var(--accent-cyan, #00f0ff));'
        +   'animation:msnBootSpin 2.4s linear infinite;'
        + '}'
        + '.msn-boot-ring::after{'
        +   'content:"";position:absolute;inset:18px;border-radius:50%;'
        +   'border:1px dashed rgba(0,240,255,0.22);'
        +   'animation:msnBootSpinRev 9s linear infinite;'
        + '}'
        + '@keyframes msnBootSpin{to{transform:rotate(360deg);}}'
        + '@keyframes msnBootSpinRev{to{transform:rotate(-360deg);}}'

        /* Logo — pulsing glow */
        + '.msn-boot-logo{'
        +   'position:relative;z-index:2;'
        +   'max-width:240px;width:56%;height:auto;'
        +   'display:block;'
        +   'filter:drop-shadow(0 0 16px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 34px rgba(0,240,255,0.4));'
        +   'animation:msnBootPulse 2s ease-in-out infinite;'
        + '}'
        + '@keyframes msnBootPulse{'
        +   '0%,100%{'
        +     'filter:drop-shadow(0 0 16px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 34px rgba(0,240,255,0.4));'
        +     'transform:scale(1);'
        +   '}'
        +   '50%{'
        +     'filter:drop-shadow(0 0 26px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 56px rgba(0,240,255,0.65));'
        +     'transform:scale(1.04);'
        +   '}'
        + '}'

        /* Text fallback if both logo URLs fail */
        + '.msn-boot-text{'
        +   'position:relative;z-index:2;'
        +   'font-family:var(--font-mono, ui-monospace, Menlo, monospace);'
        +   'font-size:1.6rem;font-weight:900;'
        +   'letter-spacing:0.4em;text-indent:0.4em;'
        +   'color:var(--accent-cyan, #00f0ff);text-transform:uppercase;'
        +   'text-shadow:0 0 16px var(--accent-cyan, #00f0ff),0 0 34px rgba(0,240,255,0.5);'
        +   'animation:msnBootPulse 2s ease-in-out infinite;'
        + '}'

        /* ═══════════════════════════════════════════════════
           ⚑ APP REVEAL — hide every root child except the
           boot overlay while booting. When html.msn-booting
           is removed, everything fades in over .55s.
        ═══════════════════════════════════════════════════ */
        + 'body > *:not(#msnBootOverlay):not(script):not(style):not(link):not(noscript){'
        +   'transition:opacity .55s cubic-bezier(.22,.61,.36,1) !important;'
        + '}'
        + 'html.msn-booting body > *:not(#msnBootOverlay):not(script):not(style):not(link):not(noscript){'
        +   'opacity:0 !important;'
        +   'pointer-events:none !important;'
        + '}'
        + 'html.msn-booting{overflow:hidden !important;}';

        var tag = document.createElement('style');
        tag.id = CSS_ID;
        tag.textContent = css;
        (document.head || document.documentElement).appendChild(tag);
    }

    /* ── Overlay ─────────────────────────────────────────── */
    function injectOverlay() {
        if (document.getElementById(OVERLAY_ID)) return;
        injectStyles();

        var ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.setAttribute('role', 'status');
        ov.setAttribute('aria-live', 'polite');
        ov.setAttribute('aria-label', 'Loading');

        ov.innerHTML = ''
            + '<div class="msn-boot-wrap">'
            +   '<div class="msn-boot-ring"></div>'
            +   '<img class="msn-boot-logo" id="msnBootLogo" src="' + LOGO_URL + '" alt="MSN">'
            + '</div>';

        function mount() {
            if (!document.body) return;
            document.body.insertBefore(ov, document.body.firstChild);
            wireLogoFallback();
        }
        if (document.body) mount();
        else document.addEventListener('DOMContentLoaded', mount, { once: true });
    }

    function wireLogoFallback() {
        var img = document.getElementById('msnBootLogo');
        if (!img) return;
        img.addEventListener('error', function () {
            if (img.dataset.fb === '1') {
                var span = document.createElement('div');
                span.className = 'msn-boot-text';
                span.textContent = 'MSN';
                img.replaceWith(span);
                return;
            }
            img.dataset.fb = '1';
            img.src = LOGO_FALLBACK;
        });
    }

    /* ── Reveal sequence ─────────────────────────────────── */
    var done = false;

    function settleApp() {
        // Unhide the input bar if script.js left it hidden
        try {
            var ib = document.getElementById('inputAreaBar');
            if (ib && ib.classList.contains('hidden')) ib.classList.remove('hidden');
        } catch (e) {}

        // Force messages containers to the bottom so the user
        // lands on the latest message, fully rendered
        try {
            var pc = document.getElementById('publicMessagesContainer');
            if (pc && !pc.classList.contains('hidden')) pc.scrollTop = pc.scrollHeight;
            var pv = document.getElementById('privateMessagesContainer');
            if (pv && !pv.classList.contains('hidden')) pv.scrollTop = pv.scrollHeight;
        } catch (e) {}
    }

    function revealApp() {
        var root = document.documentElement;
        if (!root.classList.contains('msn-booting')) return;
        void root.offsetWidth; // force reflow so transition fires
        root.classList.remove('msn-booting');
    }

    function complete() {
        if (done) return;
        done = true;
        setTimeout(function () {
            settleApp();
            // Second settle pass one frame later — catches late scroll drift
            requestAnimationFrame(function () { settleApp(); });
            revealApp();
            setTimeout(hide, 200);
        }, REVEAL_DELAY);
    }

    function hide() {
        var ov = document.getElementById(OVERLAY_ID);
        if (!ov) return;
        ov.classList.add('done');
        setTimeout(function () {
            if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        }, FADE_DURATION + 100);
    }

    /* ── Boot ────────────────────────────────────────────── */
    injectOverlay();

    /* Hard timeout — always releases even if every signal fails */
    setTimeout(function () { complete(); }, MAX_WAIT);

    /* Preferred signal — dispatched by script.js */
    document.addEventListener('msn:app-ready', function () {
        complete();
    }, { once: true });

    /* Fallback — only fires when the name overlay shows (fresh
       session). We deliberately do NOT watch #inputAreaBar here
       because script.js unhides it BEFORE messages finish loading,
       which was causing the app to reveal too early. */
    function watchNameOverlay() {
        var nameOverlay = document.getElementById('nameOverlay');
        if (!nameOverlay) { setTimeout(watchNameOverlay, 200); return; }

        function isReady() {
            return !nameOverlay.classList.contains('hidden');
        }
        if (isReady()) { setTimeout(complete, 400); return; }

        var mo = new MutationObserver(function () {
            if (isReady()) { mo.disconnect(); setTimeout(complete, 400); }
        });
        mo.observe(nameOverlay, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchNameOverlay, { once: true });
    } else {
        watchNameOverlay();
    }
})();
