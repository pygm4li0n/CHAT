/* ═══════════════════════════════════════════════════════════
   rank-badge-fix.js — Safety net only.
   The renderer (script.js Section 2) now derives emoji + name
   from the same balance, so mismatches shouldn't happen.
   This file just sanity-checks and corrects any stale rows
   that were rendered before the fix, or from cached markup.
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var TIER_ORDER = [
        { name: 'Whale',   emoji: '🐋', min: 1_000_000 },
        { name: 'Dolphin', emoji: '🐬', min:   250_000 },
        { name: 'Crab',    emoji: '🦀', min:   100_000 },
        { name: 'Shrimp',  emoji: '🦐', min:         0 }
    ];

    var TIER_BY_NAME = {
        whale:   TIER_ORDER[0],
        dolphin: TIER_ORDER[1],
        crab:    TIER_ORDER[2],
        shrimp:  TIER_ORDER[3]
    };

    var EMOJI_ANY_RE = /[🐋🐬🦀🦐]/u;
    var EMOJI_RUN_RE = /[🐋🐬🦀🦐]+/g;

    function tierFromBalance(text) {
        var raw = String(text || '').replace(/[^0-9.,KMB]/gi, '').replace(/,/g, '');
        var mult = 1;
        if (/B$/i.test(raw)) { mult = 1e9; raw = raw.slice(0, -1); }
        else if (/M$/i.test(raw)) { mult = 1e6; raw = raw.slice(0, -1); }
        else if (/K$/i.test(raw)) { mult = 1e3; raw = raw.slice(0, -1); }
        var n = parseFloat(raw);
        if (!isFinite(n)) n = 0;
        n *= mult;
        for (var i = 0; i < TIER_ORDER.length; i++) {
            if (n >= TIER_ORDER[i].min) return TIER_ORDER[i];
        }
        return TIER_ORDER[TIER_ORDER.length - 1];
    }

    function tierFromLabel(text) {
        var t = String(text || '').toLowerCase();
        var keys = ['whale', 'dolphin', 'crab', 'shrimp'];
        for (var i = 0; i < keys.length; i++) {
            if (new RegExp('\\b' + keys[i] + '\\b', 'i').test(t)) return TIER_BY_NAME[keys[i]];
        }
        return null;
    }

    function fixRow(row) {
        var scoreEl = row.querySelector('.rank-score');
        var correct = null;

        // 1. Prefer the balance — it's what the user actually sees
        if (scoreEl) correct = tierFromBalance(scoreEl.textContent);
        // 2. Fall back to the label only if there's no score
        if (!correct) correct = tierFromLabel(row.textContent);
        if (!correct) return;

        // Fix the rank-level span
        var levelEl = row.querySelector('.rank-level');
        if (levelEl) {
            var current = levelEl.textContent || '';
            var wanted  = correct.emoji + ' ' + correct.name.toUpperCase();
            if (current.replace(/\s+/g, ' ').trim() !== wanted) {
                levelEl.textContent = wanted;
                levelEl.setAttribute('data-tier', correct.name.toLowerCase());
            }
        }

        // Fix any stray emoji runs elsewhere in the row (defensive)
        var walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
            var t = node.nodeValue || '';
            if (!EMOJI_ANY_RE.test(t)) continue;
            if (node.parentNode && node.parentNode.classList &&
                node.parentNode.classList.contains('rank-level')) continue;
            var fixed = t.replace(EMOJI_RUN_RE, correct.emoji);
            if (fixed !== t) node.nodeValue = fixed;
        }
    }

    function fixAll() {
        document
            .querySelectorAll('#rankingsOverlay .rank-row')
            .forEach(fixRow);
    }

    // Trigger on rankings button + on overlay open
    function wireTrigger() {
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('#rankingsBtn')) {
                setTimeout(fixAll, 50);
                setTimeout(fixAll, 250);
                setTimeout(fixAll, 800);
            }
        }, true);
    }

    function watchRows() {
        var overlay = document.getElementById('rankingsOverlay');
        if (!overlay) { setTimeout(watchRows, 400); return; }
        var mo = new MutationObserver(function () {
            if (!overlay.classList.contains('hidden')) fixAll();
        });
        mo.observe(overlay, { childList: true, subtree: true });
    }

    function boot() {
        wireTrigger();
        watchRows();
        fixAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.fixRankBadges = fixAll;
    console.log('[rank-badge-fix] v2 loaded — balance-first');
})();
