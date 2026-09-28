/* ═══════════════════════════════════════════════════════════
   rank-badge-fix.js — v4 CLEAN
   Reads the actual rendered balance, handles strings/commas/K/M/B,
   rewrites the tier badge from it. Runs on every mutation.
   Only touches the HOLDERS column (activity shows XP, not tier).
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var TIERS = [
        { name: 'Whale',   emoji: '🐋', min: 1_000_000 },
        { name: 'Dolphin', emoji: '🐬', min:   250_000 },
        { name: 'Crab',    emoji: '🦀', min:   100_000 },
        { name: 'Shrimp',  emoji: '🦐', min:         0 }
    ];

    // Robust parse — handles "150,000", "$150,000.50", "1.5M", "320K", numbers
    function parseBalance(text) {
        if (text == null) return 0;
        if (typeof text === 'number') return isFinite(text) ? text : 0;
        var s = String(text).trim().toUpperCase();
        // keep digits, dots, commas, K/M/B
        s = s.replace(/[^0-9.,KMB]/g, '').replace(/,/g, '');
        var mult = 1;
        var last = s.slice(-1);
        if (last === 'B') { mult = 1e9; s = s.slice(0, -1); }
        else if (last === 'M') { mult = 1e6; s = s.slice(0, -1); }
        else if (last === 'K') { mult = 1e3; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isFinite(n) ? n * mult : 0;
    }

    function tierFor(balance) {
        for (var i = 0; i < TIERS.length; i++) {
            if (balance >= TIERS[i].min) return TIERS[i];
        }
        return TIERS[TIERS.length - 1];
    }

    function fixRow(row) {
        if (!row) return;

        var scoreEl = row.querySelector('.rank-score');
        var levelEl = row.querySelector('.rank-level');
        if (!scoreEl || !levelEl) return;

        var balance = parseBalance(scoreEl.textContent);
        var tier    = tierFor(balance);
        var wanted  = tier.emoji + ' ' + tier.name.toUpperCase();

        if (levelEl.textContent.trim() !== wanted) {
            levelEl.textContent = wanted;
            levelEl.setAttribute('data-tier', tier.name.toLowerCase());
        }
    }

    function getHoldersRows() {
        // Primary target
        var holders = document.getElementById('holdersLeaderboard');
        if (holders) return holders.querySelectorAll('.rank-row');

        // Fallback — first column of rankings
        var firstCol = document.querySelector(
            '#rankingsOverlay .rankings-column:nth-child(1) .rankings-list'
        );
        if (firstCol) return firstCol.querySelectorAll('.rank-row');

        return [];
    }

    function fixAll() {
        getHoldersRows().forEach(fixRow);
    }

    function watch() {
        var overlay = document.getElementById('rankingsOverlay');
        if (!overlay) { setTimeout(watch, 300); return; }

        // Fix immediately if rows already exist
        fixAll();

        // Re-fix on any DOM change inside rankings
        var mo = new MutationObserver(function () {
            if (!overlay.classList.contains('hidden')) fixAll();
        });
        mo.observe(overlay, { childList: true, subtree: true, characterData: true });

        // Re-fix when overlay opens
        var overlayWatch = new MutationObserver(function () {
            if (!overlay.classList.contains('hidden')) {
                fixAll();
                setTimeout(fixAll, 80);
                setTimeout(fixAll, 300);
                setTimeout(fixAll, 900);
            }
        });
        overlayWatch.observe(overlay, { attributes: true, attributeFilter: ['class'] });

        // Re-fix on rankings button click
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('#rankingsBtn')) {
                setTimeout(fixAll, 60);
                setTimeout(fixAll, 250);
                setTimeout(fixAll, 700);
                setTimeout(fixAll, 1500);
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watch);
    } else {
        watch();
    }

    window.fixRankBadges = fixAll;
    console.log('[rank-badge-fix] v4 clean loaded');
})();
