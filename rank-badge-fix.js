/* ═══════════════════════════════════════════════════════════
   rank-badge-fix.js — v5 (non-destructive)
   • Never overwrites a tier that already exists unless it's Shrimp
   • First-token parser — ignores trailing text like "(12%)" or "/ 1M"
   • Only touches the HOLDERS column
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var TIERS = [
        { name: 'Whale',   emoji: '🐋', min: 1_000_000 },
        { name: 'Dolphin', emoji: '🐬', min:   250_000 },
        { name: 'Crab',    emoji: '🦀', min:   100_000 },
        { name: 'Shrimp',  emoji: '🦐', min:         0 }
    ];

    // Reads the FIRST numeric token only. "200,000 (12%)" → 200000.
    // "200K / 1M" → 200000. "Loading…" → 0.
    function parseBalance(text) {
        if (text == null) return 0;
        if (typeof text === 'number') return isFinite(text) ? text : 0;
        var m = String(text).match(/([\d.,]+)\s*([KMB])?/i);
        if (!m) return 0;
        var n = parseFloat(m[1].replace(/,/g, ''));
        if (!isFinite(n)) return 0;
        var s = (m[2] || '').toUpperCase();
        if (s === 'B') n *= 1e9;
        else if (s === 'M') n *= 1e6;
        else if (s === 'K') n *= 1e3;
        return n;
    }

    function tierFor(balance) {
        for (var i = 0; i < TIERS.length; i++) {
            if (balance >= TIERS[i].min) return TIERS[i];
        }
        return TIERS[TIERS.length - 1];
    }

    function fixRow(row) {
        if (!row) return;
        if (row.classList.contains('is-placeholder')) return;

        var scoreEl = row.querySelector('.rank-score');
        var levelEl = row.querySelector('.rank-level');
        if (!scoreEl || !levelEl) return;

        // ⚑ Don't touch a tier that was already set to a real value.
        //   loadHolders() is the source of truth — this file only
        //   fills in gaps, it never overwrites.
        var existing = (levelEl.getAttribute('data-tier') || '').toLowerCase();
        if (existing && existing !== 'shrimp') return;

        var balance = parseBalance(scoreEl.textContent);
        if (!balance) return;                       // 0 → leave as-is

        var tier   = tierFor(balance);
        var wanted = tier.emoji + ' ' + tier.name.toUpperCase();

        if (levelEl.textContent.trim() !== wanted) {
            levelEl.textContent = wanted;
            levelEl.setAttribute('data-tier', tier.name.toLowerCase());
        }
    }

    function getHoldersRows() {
        var holders = document.getElementById('holdersLeaderboard');
        if (holders) return holders.querySelectorAll('.rank-row');
        return [];
    }

    function fixAll() {
        getHoldersRows().forEach(fixRow);
    }

    function watch() {
        var overlay = document.getElementById('rankingsOverlay');
        if (!overlay) { setTimeout(watch, 300); return; }

        fixAll();

        var mo = new MutationObserver(function () {
            if (!overlay.classList.contains('hidden')) fixAll();
        });
        // No characterData — prevents loops from our own writes
        mo.observe(overlay, { childList: true, subtree: true });

        document.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('#rankingsBtn')) {
                setTimeout(fixAll, 120);
                setTimeout(fixAll, 500);
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watch);
    } else {
        watch();
    }

    window.fixRankBadges = fixAll;
    console.log('[rank-badge-fix] v5 non-destructive loaded');
})();
