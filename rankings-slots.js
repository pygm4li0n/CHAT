/* rankings-slots.js — pads every rankings list to 10 uniform slots */
(function () {
    'use strict';

    var MIN_ROWS = 10;
    var PLACEHOLDER_HTML =
        '<div class="rank-avatar-fallback" aria-hidden="true">–</div>' +
        '<div class="rank-info">' +
            '<span class="rank-name">—</span>' +
            '<div class="rank-meta"><span class="rank-detail">AWAITING DATA</span></div>' +
        '</div>' +
        '<div class="rank-stats"><span class="rank-score">—</span></div>';

    function refreshList(list) {
        list.querySelectorAll('.rank-row.is-placeholder').forEach(function (n) { n.remove(); });

        var real = list.querySelectorAll('.rank-row:not(.is-placeholder)').length;
        if (real > 0 && real < MIN_ROWS) {
            var frag = document.createDocumentFragment();
            for (var i = real; i < MIN_ROWS; i++) {
                var row = document.createElement('div');
                row.className = 'rank-row is-placeholder';
                row.setAttribute('aria-hidden', 'true');
                row.innerHTML = PLACEHOLDER_HTML;
                frag.appendChild(row);
            }
            list.appendChild(frag);
        }

        list.classList.toggle(
            'is-scrollable',
            list.scrollHeight > list.clientHeight + 2
        );
    }

    function refreshAll() {
        document.querySelectorAll('#rankingsOverlay .rankings-list')
            .forEach(refreshList);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refreshAll);
    } else {
        refreshAll();
    }

    window.addEventListener('resize', refreshAll, { passive: true });

    var overlay = document.getElementById('rankingsOverlay');
    if (overlay) {
        new MutationObserver(refreshAll)
            .observe(overlay, { childList: true, subtree: true });
    }

    window.refreshRankingsSlots = refreshAll;
})();
