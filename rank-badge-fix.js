/* ============================================================
   RANK BADGE FIX — swaps wrong emoji for the row's correct one
   ------------------------------------------------------------
   If a row says "Crab" but shows a shrimp, this replaces the
   shrimp with 🦀.
     • Reads the text label first (Crab / Shrimp / Whale / Dolphin)
     • Falls back to the balance score only if no label is found
     • ONLY edits existing emoji runs inside text nodes
     • Never prepends, never appends, never removes text
     • Never touches child elements, images, or pseudo-elements
   Only touches the rankings overlay.
============================================================ */
(function () {
    'use strict';

    /* name → emoji (longest keys first — avoids "whale" matching inside another word) */
    var NAME_TO_EMOJI = [
        { key: 'dolphin', emoji: '🐬' },
        { key: 'shrimp',  emoji: '🦐' },
        { key: 'whale',   emoji: '🐋' },
        { key: 'crab',    emoji: '🦀' }
    ];

    /* A run of one or more rank emojis, plus any whitespace around them */
    var EMOJI_RUN_RE = /(?:[🐋🐬🦀🦐]\s*)+/g;

    /* ── Balance → emoji (fallback) ── */
    function getBadge(balance) {
        if (balance >= 1000000) return '🐋';
        if (balance >= 250000)  return '🐬';
        if (balance >= 100000)  return '🦀';
        return '🦐';
    }

    function parseBalance(text) {
        if (!text) return 0;
        var s = String(text).trim().toUpperCase();
        s = s.replace(/[^0-9.,KMB]/g, '');
        s = s.replace(/,/g, '');
        var mult = 1;
        if (s.endsWith('B')) { mult = 1e9; s = s.slice(0, -1); }
        else if (s.endsWith('M')) { mult = 1e6; s = s.slice(0, -1); }
        else if (s.endsWith('K')) { mult = 1e3; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isFinite(n) ? n * mult : 0;
    }

    /* ── Emoji from a text label (Whale / Dolphin / Crab / Shrimp) ── */
    function emojiFromText(text) {
        if (!text) return null;
        var lower = String(text).toLowerCase();
        for (var i = 0; i < NAME_TO_EMOJI.length; i++) {
            if (lower.indexOf(NAME_TO_EMOJI[i].key) !== -1) {
                return NAME_TO_EMOJI[i].emoji;
            }
        }
        return null;
    }

    /* ── Determine the correct emoji for a row ── */
    function correctEmojiForRow(row) {
        /* 1) Prefer the text label */
        var fromLabel = emojiFromText(row.textContent || '');
        if (fromLabel) return fromLabel;

        /* 2) Fall back to the balance score */
        var scoreEl = row.querySelector('.rank-score');
        if (scoreEl) return getBadge(parseBalance(scoreEl.textContent));

        return null;
    }

    /* ── Fix a single row: replace wrong emoji runs IN PLACE ── */
    function fixRow(row) {
        var correct = correctEmojiForRow(row);
        if (!correct) return;

        var walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
            var t = node.nodeValue || '';
            if (!/[🐋🐬🦀🦐]/.test(t)) continue;         /* nothing to fix here */
            var fixed = t.replace(EMOJI_RUN_RE, correct + ' ');
            if (fixed !== t) node.nodeValue = fixed;
        }
    }

    function fixAll() {
        document
            .querySelectorAll(
                '#rankingsOverlay .rank-row, ' +
                '#holdersLeaderboard .rank-row, ' +
                '#activityLeaderboard .rank-row'
            )
            .forEach(fixRow);
    }

    /* ── Watch the overlay ── */
    function attachObserver() {
        var overlay = document.getElementById('rankingsOverlay');
        if (!overlay) return;

        var observer = new MutationObserver(function (mutations) {
            /* Only react to real DOM changes (rows added), not our own edits */
            var meaningful = mutations.some(function (m) {
                return m.type === 'childList' && m.addedNodes.length > 0;
            });
            if (meaningful) {
                fixAll();
                requestAnimationFrame(fixAll);
                setTimeout(fixAll, 150);
                setTimeout(fixAll, 500);
            }
        });

        observer.observe(overlay, { childList: true, subtree: true });

        if (!overlay.classList.contains('hidden')) fixAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachObserver);
    } else {
        attachObserver();
    }

    /* ── Slow safety net ── */
    setInterval(function () {
        var o = document.getElementById('rankingsOverlay');
        if (o && !o.classList.contains('hidden')) fixAll();
    }, 1200);

    /* Expose for manual debugging */
    window.fixRankBadges = fixAll;
    console.log('[rank-badge-fix] loaded — call window.fixRankBadges() to force a pass');
})();
