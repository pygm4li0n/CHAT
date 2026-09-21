/* ============================================================
   loading-screen.js — MSN Boot Sequence
   ────────────────────────────────────────────────────────────
   DESKTOP (≥769px) → full boot UI (bar, status, dots, corners)
   MOBILE / PHANTOM → clean animated logo only

   App reveal — html.msn-booting hides every root child except
   the boot overlay. When ready, the class is removed and the
   app fades in while the loader fades out (overlapping beats).

   Ready signal — first one wins:
     • 'msn:app-ready' event (dispatched by script.js)
     • #inputAreaBar loses .hidden  (cached session)
     • #nameOverlay loses .hidden   (fresh session)
     • 8s hard timeout (never sticks)

   Load BEFORE script.js — injects itself as the first body child.
   ============================================================ */
(function () {
    'use strict';

    if (document.getElementById('msnBootOverlay')) return;

    var CSS_ID = 'msn-boot-styles';
    var OVERLAY_ID = 'msnBootOverlay';
    var REVEAL_DELAY = 350;
    var FADE_DURATION = 500;
    var MAX_WAIT = 8000;

    var LOGO_URL = 'https://i.postimg.cc/fbZCV8sQ/Chat-GPT-Image-20-sept-2026-23-51-47.png';

    function isCompact() {
        try {
            if (window.innerWidth <= 768) return true;
            var ua = (navigator.userAgent || '').toLowerCase();
            if (/phantom/.test(ua)) return true;
            if (/android|iphone|ipad|ipod/.test(ua) && /mobile/.test(ua)) return true;
            if (navigator.maxTouchPoints > 0 && window.innerWidth <= 900) return true;
        } catch (e) {}
        return false;
    }
    var COMPACT = isCompact();

    /* ── CSS ─────────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById(CSS_ID)) return;
        var css = ''
        + '#msnBootOverlay{'
        +   'position:fixed;inset:0;z-index:999999;'
        +   'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        +   'background:radial-gradient(circle at 50% 40%, rgba(20,30,50,0.95) 0%, rgba(2,4,10,0.995) 70%),#02040a;'
        +   'font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);'
        +   'color:var(--accent-cyan, #00f0ff);'
        +   'opacity:1;visibility:visible;'
        +   'transition:opacity .5s ease, visibility .5s ease;'
        +   'overflow:hidden;-webkit-user-select:none;user-select:none;'
        + '}'
        + '#msnBootOverlay::before{'
        +   'content:"";position:absolute;inset:0;pointer-events:none;'
        +   'background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,0.20) 2px 3px);'
        +   'opacity:0.45;z-index:1;'
        + '}'
        + '#msnBootOverlay::after{'
        +   'content:"";position:absolute;inset:0;pointer-events:none;'
        +   'background:radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.70) 100%);'
        +   'z-index:1;'
        + '}'
        + '#msnBootOverlay.done{opacity:0;visibility:hidden;pointer-events:none;}'

        + '.msn-boot-corner{'
        +   'position:absolute;width:42px;height:42px;'
        +   'border:2px solid var(--accent-cyan, #00f0ff);'
        +   'opacity:0.55;pointer-events:none;z-index:2;'
        +   'filter:drop-shadow(0 0 8px var(--accent-cyan, #00f0ff));'
        + '}'
        + '.msn-boot-corner.tl{top:22px;left:22px;border-right:none;border-bottom:none;}'
        + '.msn-boot-corner.tr{top:22px;right:22px;border-left:none;border-bottom:none;}'
        + '.msn-boot-corner.bl{bottom:22px;left:22px;border-right:none;border-top:none;}'
        + '.msn-boot-corner.br{bottom:22px;right:22px;border-left:none;border-top:none;}'

        + '.msn-boot-inner{'
        +   'position:relative;z-index:3;display:flex;flex-direction:column;'
        +   'align-items:center;gap:22px;max-width:400px;width:88%;'
        +   'padding:0 16px;text-align:center;'
        + '}'

        + '.msn-boot-logo-wrap{'
        +   'position:relative;display:flex;align-items:center;justify-content:center;'
        +   'width:100%;'
        + '}'
        + '.msn-boot-logo{'
        +   'max-width:180px;width:58%;height:auto;'
        +   'filter:drop-shadow(0 0 14px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 30px rgba(0,240,255,0.35));'
        +   'animation:msnBootPulse 2.2s ease-in-out infinite;'
        + '}'

        + '.msn-boot-ring{'
        +   'position:absolute;top:50%;left:50%;width:220px;height:220px;'
        +   'transform:translate(-50%,-50%);border-radius:50%;'
        +   'border:1px solid rgba(0,240,255,0.18);pointer-events:none;'
        + '}'
        + '.msn-boot-ring::before{'
        +   'content:"";position:absolute;inset:-1px;border-radius:50%;'
        +   'border:2px solid transparent;'
        +   'border-top-color:var(--accent-cyan, #00f0ff);'
        +   'border-right-color:rgba(0,240,255,0.5);'
        +   'filter:drop-shadow(0 0 8px var(--accent-cyan, #00f0ff));'
        +   'animation:msnBootSpin 2.6s linear infinite;'
        + '}'
        + '.msn-boot-ring::after{'
        +   'content:"";position:absolute;inset:14px;border-radius:50%;'
        +   'border:1px dashed rgba(0,240,255,0.22);'
        +   'animation:msnBootSpinRev 8s linear infinite;'
        + '}'
        + '@keyframes msnBootSpin{to{transform:rotate(360deg);}}'
        + '@keyframes msnBootSpinRev{to{transform:rotate(-360deg);}}'

        + '@keyframes msnBootPulse{'
        +   '0%,100%{filter:drop-shadow(0 0 14px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 30px rgba(0,240,255,0.35));transform:scale(1);}'
        +   '50%{filter:drop-shadow(0 0 24px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 52px rgba(0,240,255,0.55));transform:scale(1.03);}'
        + '}'

        + '.msn-boot-sub{'
        +   'font-size:0.6rem;letter-spacing:0.42em;text-transform:uppercase;'
        +   'color:var(--text-muted, #64748b);opacity:0.85;'
        +   'text-indent:0.42em;font-weight:700;'
        + '}'

        + '.msn-boot-bar{'
        +   'position:relative;width:100%;height:3px;'
        +   'background:rgba(255,255,255,0.06);'
        +   'border:1px solid rgba(0,240,255,0.25);'
        +   'border-radius:2px;overflow:hidden;'
        + '}'
        + '.msn-boot-bar-fill{'
        +   'position:absolute;top:0;left:0;bottom:0;width:0%;'
        +   'background:linear-gradient(90deg, transparent 0%, var(--accent-cyan, #00f0ff) 40%, var(--accent-cyan, #00f0ff) 100%);'
        +   'box-shadow:0 0 12px var(--accent-cyan, #00f0ff), 0 0 24px rgba(0,240,255,0.6);'
        +   'transition:width .4s cubic-bezier(.22,.61,.36,1);'
        + '}'
        + '.msn-boot-bar-fill::after{'
        +   'content:"";position:absolute;right:0;top:-4px;bottom:-4px;width:18px;'
        +   'background:linear-gradient(90deg, transparent, var(--accent-cyan, #00f0ff));'
        +   'filter:blur(3px);opacity:0.85;'
        + '}'

        + '.msn-boot-status{'
        +   'display:flex;align-items:center;justify-content:space-between;'
        +   'width:100%;font-size:0.62rem;letter-spacing:0.24em;text-transform:uppercase;'
        +   'font-weight:700;gap:12px;'
        + '}'
        + '.msn-boot-label{'
        +   'color:var(--accent-cyan, #00f0ff);text-shadow:0 0 8px var(--accent-cyan, #00f0ff);'
        +   'flex:1 1 auto;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
        + '}'
        + '.msn-boot-label::after{'
        +   'content:"▋";margin-left:6px;opacity:0.6;'
        +   'animation:msnBootBlink 1s steps(2,start) infinite;'
        +   'font-size:0.75em;vertical-align:middle;'
        + '}'
        + '@keyframes msnBootBlink{'
        +   '0%,50%{opacity:0.6;}'
        +   '51%,100%{opacity:0;}'
        + '}'
        + '.msn-boot-pct{'
        +   'color:var(--text-secondary, #94a3b8);'
        +   'font-variant-numeric:tabular-nums;font-weight:800;'
        +   'flex:0 0 auto;min-width:3.5em;text-align:right;'
        + '}'

        + '.msn-boot-dots{'
        +   'display:flex;gap:6px;align-items:center;justify-content:center;'
        + '}'
        + '.msn-boot-dots span{'
        +   'width:6px;height:6px;border-radius:50%;'
        +   'background:var(--text-muted, #64748b);opacity:0.3;'
        +   'transition:all .3s ease;'
        + '}'
        + '.msn-boot-dots span.active{'
        +   'background:var(--accent-cyan, #00f0ff);opacity:1;'
        +   'box-shadow:0 0 8px var(--accent-cyan, #00f0ff), 0 0 16px rgba(0,240,255,0.5);'
        +   'transform:scale(1.25);'
        + '}'
        + '.msn-boot-dots span.done{'
        +   'background:var(--accent-cyan, #00f0ff);opacity:0.7;'
        + '}'

        + '.msn-boot-hint{'
        +   'position:absolute;bottom:32px;left:50%;transform:translateX(-50%);'
        +   'font-size:0.5rem;letter-spacing:0.4em;text-transform:uppercase;'
        +   'color:var(--text-muted, #64748b);opacity:0.5;'
        +   'z-index:3;font-weight:700;text-indent:0.4em;'
        + '}'

        /* ══ COMPACT MODE — logo only ══ */
        + '.msn-boot-compact .msn-boot-corner,'
        + '.msn-boot-compact .msn-boot-bar,'
        + '.msn-boot-compact .msn-boot-status,'
        + '.msn-boot-compact .msn-boot-dots,'
        + '.msn-boot-compact .msn-boot-sub,'
        + '.msn-boot-compact .msn-boot-hint{'
        +   'display:none !important;'
        + '}'
        + '.msn-boot-compact .msn-boot-inner{'
        +   'gap:0;max-width:none;width:auto;padding:0;'
        + '}'
        + '.msn-boot-compact .msn-boot-logo{'
        +   'max-width:200px;width:60vw;'
        +   'animation:msnBootPulseCompact 2s ease-in-out infinite;'
        + '}'
        + '.msn-boot-compact .msn-boot-ring{'
        +   'width:260px;height:260px;max-width:80vw;max-height:80vh;'
        + '}'
        + '@keyframes msnBootPulseCompact{'
        +   '0%,100%{filter:drop-shadow(0 0 16px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 34px rgba(0,240,255,0.45));transform:scale(1);}'
        +   '50%{filter:drop-shadow(0 0 28px var(--accent-cyan, #00f0ff)) drop-shadow(0 0 60px rgba(0,240,255,0.65));transform:scale(1.05);}'
        + '}'
        + '#msnBootOverlay.msn-boot-compact::before{opacity:0.35;}'

        /* ═══════════════════════════════════════════════════
           ⚑ APP REVEAL — hide everything but the boot overlay
           while booting. When .msn-booting is removed from
           <html>, every root child fades in over 0.55s.
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

    /* ── Overlay markup ──────────────────────────────────── */
    function injectOverlay() {
        if (document.getElementById(OVERLAY_ID)) return;
        injectStyles();
        var ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.setAttribute('role', 'status');
        ov.setAttribute('aria-live', 'polite');
        ov.setAttribute('aria-label', 'Loading');
        if (COMPACT) ov.classList.add('msn-boot-compact');

        var desktopOnly = ''
            + '<div class="msn-boot-sub">Boot Sequence Initiated</div>'
            + '<div class="msn-boot-bar"><span class="msn-boot-bar-fill" id="msnBootBarFill"></span></div>'
            + '<div class="msn-boot-status">'
            +   '<span class="msn-boot-label" id="msnBootLabel">Initializing</span>'
            +   '<span class="msn-boot-pct" id="msnBootPct">0%</span>'
            + '</div>'
            + '<div class="msn-boot-dots" id="msnBootDots">'
            +   '<span data-s="0"></span>'
            +   '<span data-s="1"></span>'
            +   '<span data-s="2"></span>'
            +   '<span data-s="3"></span>'
            +   '<span data-s="4"></span>'
            + '</div>';

        ov.innerHTML = ''
            + '<span class="msn-boot-corner tl"></span>'
            + '<span class="msn-boot-corner tr"></span>'
            + '<span class="msn-boot-corner bl"></span>'
            + '<span class="msn-boot-corner br"></span>'
            + '<div class="msn-boot-inner">'
            +   '<div class="msn-boot-logo-wrap">'
            +       '<div class="msn-boot-ring"></div>'
            +       '<img class="msn-boot-logo" src="' + LOGO_URL + '" alt="MSN">'
            +   '</div>'
            +   (COMPACT ? '' : desktopOnly)
            + '</div>'
            + (COMPACT ? '' : '<div class="msn-boot-hint">Meme Social Network // v.1</div>');

        if (document.body) {
            document.body.insertBefore(ov, document.body.firstChild);
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                if (document.body) document.body.insertBefore(ov, document.body.firstChild);
            }, { once: true });
        }
    }

    /* ── Progress ────────────────────────────────────────── */
    var stages = [
        { pct: 20,  label: 'Booting core' },
        { pct: 45,  label: 'Loading profile' },
        { pct: 70,  label: 'Fetching messages' },
        { pct: 90,  label: 'Syncing presence' },
        { pct: 100, label: 'Ready' }
    ];
    var currentStage = 0;
    var done = false;

    function applyStage(idx) {
        if (COMPACT) return;
        var s = stages[idx];
        var fill = document.getElementById('msnBootBarFill');
        var label = document.getElementById('msnBootLabel');
        var pct = document.getElementById('msnBootPct');
        var dots = document.getElementById('msnBootDots');
        if (fill) fill.style.width = s.pct + '%';
        if (label) label.textContent = s.label;
        if (pct) pct.textContent = s.pct + '%';
        if (dots) {
            var items = dots.querySelectorAll('span');
            for (var i = 0; i < items.length; i++) {
                items[i].classList.toggle('active', i === idx);
                items[i].classList.toggle('done', i < idx);
            }
        }
    }

    function setStage(idx) {
        if (done) return;
        if (idx <= currentStage) return;
        currentStage = Math.min(idx, stages.length - 1);
        applyStage(currentStage);
    }

    function revealApp() {
        var root = document.documentElement;
        if (!root.classList.contains('msn-booting')) return;
        void root.offsetWidth; // force reflow so opacity transition fires
        root.classList.remove('msn-booting');
    }

    function complete() {
        if (done) return;
        done = true;
        currentStage = stages.length - 1;
        applyStage(currentStage);
        setTimeout(function () {
            revealApp();
            setTimeout(hide, 180);
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

    var softTimers = [];
    if (!COMPACT) {
        softTimers = [
            setTimeout(function () { setStage(1); }, 400),
            setTimeout(function () { setStage(2); }, 1200),
            setTimeout(function () { setStage(3); }, 2400),
            setTimeout(function () { setStage(4); complete(); }, MAX_WAIT)
        ];
    } else {
        softTimers = [ setTimeout(function () { complete(); }, MAX_WAIT) ];
    }

    /* ── Ready signals ───────────────────────────────────── */
    function clearSoft() {
        for (var i = 0; i < softTimers.length; i++) clearTimeout(softTimers[i]);
    }

    document.addEventListener('msn:app-ready', function () {
        clearSoft();
        setStage(4);
        complete();
    }, { once: true });

    function watchReadySignals() {
        var inputBar = document.getElementById('inputAreaBar');
        var nameOverlay = document.getElementById('nameOverlay');
        if (!inputBar && !nameOverlay) {
            setTimeout(watchReadySignals, 200);
            return;
        }

        function isReady() {
            var a = inputBar && !inputBar.classList.contains('hidden');
            var b = nameOverlay && !nameOverlay.classList.contains('hidden');
            return a || b;
        }

        function fire() {
            clearSoft();
            setStage(4);
            setTimeout(complete, COMPACT ? 250 : 600);
        }

        if (isReady()) { fire(); return; }

        var mo = new MutationObserver(function () {
            if (isReady()) { mo.disconnect(); fire(); }
        });
        if (inputBar) mo.observe(inputBar, { attributes: true, attributeFilter: ['class'] });
        if (nameOverlay) mo.observe(nameOverlay, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchReadySignals, { once: true });
    } else {
        watchReadySignals();
    }
})();
