/* rankings-slots.js — v2 — pads rankings to 10 rows.
   Disconnects observer before mutation to prevent self-triggering. */
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

    var overlayEl = null;
    var observer  = null;
    var scheduled = null;

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

        list.classList.toggle('is-scrollable', list.scrollHeight > list.clientHeight + 2);
    }

    function doRefresh() {
        if (observer) observer.disconnect();   // ⚑ stop observing our own writes
        try {
            document.querySelectorAll('#rankingsOverlay .rankings-list')
                .forEach(refreshList);
        } finally {
            if (observer && overlayEl) {
                observer.observe(overlayEl, { childList: true, subtree: true });
            }
        }
    }

    function scheduleRefresh() {
        if (scheduled) return;
        scheduled = requestAnimationFrame(function () {
            scheduled = null;
            doRefresh();
        });
    }

    overlayEl = document.getElementById('rankingsOverlay');

    if (overlayEl) {
        observer = new MutationObserver(scheduleRefresh);
        observer.observe(overlayEl, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', doRefresh);
    } else {
        doRefresh();
    }

    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.refreshRankingsSlots = doRefresh;
})();
