/* ============================================================
   app-extras.js — merged bundle
   Section 1: Token CA pill              (was token-ca.js)
   Section 2: XP badge + dual leaderboards (was xp-system.js)
   Section 3: Wallet-based daily login tracking + rank badge
              (was login-tracking.js)
   All three sections are self-contained IIFEs. No shared state.
   ============================================================ */


/* ============================================================
   SECTION 1 — TOKEN CA
   Injects a copy-able contract address pill next to the header
   token tracker. Desktop only (CSS hides on mobile).
   Requires in DOM: .header-center
   ============================================================ */
(function () {
    'use strict';

    var CA = '6imhRyMYu5xoGJ5W7yveymB5o5yfyAvXxveozWpbU5ix';
    var SHORT = CA.slice(0, 4) + '…' + CA.slice(-4);

    function injectStyles() {
        if (document.getElementById('token-ca-styles')) return;
        var style = document.createElement('style');
        style.id = 'token-ca-styles';
        style.textContent =
            '.token-ca .ca-copy{' +
                'display:inline-flex;' +
                'align-items:center;' +
                'justify-content:center;' +
                'width:1.35em;' +
                'height:1.35em;' +
                'line-height:1;' +
                'text-align:center;' +
                'flex:0 0 auto;' +
            '}';
        document.head.appendChild(style);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                ta.style.pointerEvents = 'none';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    function inject() {
        var center = document.querySelector('.header-center');
        if (!center) return;
        if (center.querySelector('.token-ca')) return;

        injectStyles();

        var el = document.createElement('div');
        el.className = 'token-ca';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('title', 'Click to copy contract address');
        el.innerHTML =
            '<span class="ca-label">CA</span>' +
            '<span class="ca-value">' + SHORT + '</span>' +
            '<span class="ca-copy">📋</span>';

        function flashCopied() {
            el.classList.add('copied');
            var icon = el.querySelector('.ca-copy');
            if (icon) icon.textContent = '✅';
            setTimeout(function () {
                el.classList.remove('copied');
                if (icon) icon.textContent = '📋';
            }, 1500);
        }

        function doCopy() {
            copyText(CA)
                .then(flashCopied)
                .catch(function (err) {
                    console.warn('[token-ca] copy failed', err);
                    try {
                        window.prompt('Copy the contract address:', CA);
                    } catch (e) {}
                });
        }

        el.addEventListener('click', doCopy);
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                doCopy();
            }
        });

        center.appendChild(el);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }

    var mo = new MutationObserver(inject);
    document.addEventListener('DOMContentLoaded', function () {
        var center = document.querySelector('.header-center');
        if (center) mo.observe(center, { childList: true });
    });
})();


/* ============================================================
   SECTION 2 — XP BADGE + DUAL LEADERBOARDS
   Requires in DOM:
     #sidebarBigLevel
     #rankingsBtn, #rankingsCloseBtn, #rankingsOverlay
     #holdersLeaderboard, #activityLeaderboard
   Optional MSN core: MSN.supabase, MSN.badge, MSN.wallet,
                      MSN.events, MSN.toast
   Exposes: window.addXP, window.MSN.rankings
   ============================================================ */
(function () {
  'use strict';

  // ── Lazy Supabase resolution ──
  function getSB() {
    if (window.MSN && window.MSN.supabase) return window.MSN.supabase;
    if (window.supabase && window.supabase.createClient) {
      window.MSN = window.MSN || {};
      window.MSN.supabase = window.supabase.createClient(
        'https://uxrpjfsouwxnlcbhjilz.supabase.co',
        'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H'
      );
      console.log('[xp] built fallback supabase client');
      return window.MSN.supabase;
    }
    return null;
  }

  function getBadge(balance) {
    if (window.MSN && window.MSN.badge && window.MSN.badge.get) {
      return window.MSN.badge.get(balance);
    }
    const n = Number(balance) || 0;
    if (n >= 1000000) return { name: 'Whale',   emoji: '🐋', min: 1000000 };
    if (n >=  250000) return { name: 'Dolphin', emoji: '🐬', min:  250000 };
    if (n >=  100000) return { name: 'Crab',    emoji: '🦀', min:  100000 };
    return { name: 'Shrimp', emoji: '🦐', min: 0 };
  }

  function badgeFromName(name) {
    if (window.MSN && window.MSN.badge && window.MSN.badge.fromName) {
      return window.MSN.badge.fromName(name);
    }
    const n = String(name || '').trim().toLowerCase();
    if (n === 'whale')   return { name: 'Whale',   emoji: '🐋' };
    if (n === 'dolphin') return { name: 'Dolphin', emoji: '🐬' };
    if (n === 'crab')    return { name: 'Crab',    emoji: '🦀' };
    return { name: 'Shrimp', emoji: '🦐' };
  }

  // ── Helpers ──
  function esc(t) {
    return String(t).replace(/[&<>"']/g, m =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m]));
  }
  function xpForLevel(L) { return L <= 1 ? 0 : 25 * (L - 1) * L; }
  function levelFromXp(xp) {
    if (!xp || xp < 50) return 1;
    return Math.max(1, Math.floor((1 + Math.sqrt(1 + (xp * 4 / 25))) / 2));
  }

  function updateLevelBadge(level, xp, inLevel, needed) {
    const el = document.getElementById('sidebarBigLevel');
    if (!el) return;
    if (!level || level < 1) { el.textContent = ''; el.classList.add('hidden'); return; }
    if (inLevel == null || needed == null) {
      const a = xpForLevel(level), b = xpForLevel(level + 1);
      inLevel = (xp || 0) - a; needed = b - a;
    }
    el.textContent = `⭐ Lv.${level}  (${inLevel}/${needed})`;
    el.classList.remove('hidden');
  }

  // ── Level badge loader ──
  let lastWallet = null;
  async function loadXp(wallet) {
    if (!wallet) { updateLevelBadge(null, 0); return; }
    const sb = getSB();
    if (!sb) return;
    try {
      const { data, error } = await sb.rpc('get_xp_by_wallet', { p_wallet: wallet });
      if (!error && data && data.length) {
        const row = Array.isArray(data) ? data[0] : data;
        updateLevelBadge(row.level || levelFromXp(row.xp || 0), row.xp, row.in_level, row.needed);
        return;
      }
    } catch {}
    try {
      const { data, error } = await sb.from('profiles').select('xp')
        .eq('wallet_address', wallet).limit(1).maybeSingle();
      if (error || !data) { updateLevelBadge(null, 0); return; }
      const xp = Number(data.xp || 0);
      updateLevelBadge(levelFromXp(xp), xp);
    } catch (e) { console.warn('[xp] load error:', e); }
  }

  // ── Open / close rankings ──
  function openRankings() {
    const overlay = document.getElementById('rankingsOverlay');
    if (!overlay) {
      console.error('[rankings] #rankingsOverlay is missing from the DOM');
      return;
    }
    overlay.classList.remove('hidden');
    console.log('[rankings] overlay opened');
    refreshBoth();
  }
  function closeRankings() {
    const overlay = document.getElementById('rankingsOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ── THE click handler — attached at load, capture-phase, works everywhere ──
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (t && t.closest) {
      if (t.closest('#rankingsBtn')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[rankings] button clicked');
        openRankings();
        return;
      }
      if (t.closest('#rankingsCloseBtn')) {
        e.preventDefault();
        e.stopPropagation();
        closeRankings();
        return;
      }
    }
    const overlay = document.getElementById('rankingsOverlay');
    if (overlay && t === overlay) closeRankings();
  }, true); // capture phase — fires before any other listener

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('rankingsOverlay');
    if (overlay && !overlay.classList.contains('hidden')) closeRankings();
  });

  // ── Avatar helpers ──
  function cacheBust(url, row) {
    if (!url) return url;
    const tag = row.xp != null ? row.xp : (row.token_balance != null ? row.token_balance : Date.now());
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(String(tag));
  }
  function avatarHTML(row) {
    let url = row.avatar_url || row.avatar || row.profile_pic || row.profile_pic_url || row.pfp || null;
    if (url && !/^https?:\/\//i.test(url) && url.indexOf('/') !== -1) {
      url = 'https://uxrpjfsouwxnlcbhjilz.supabase.co/storage/v1/object/public/' +
            url.replace(/^\/+/, '');
    }
    if (url) url = cacheBust(url, row);
    const initial = String(row.username || '?').trim().charAt(0).toUpperCase() || '?';
    if (url) return '<img class="rank-avatar" src="' + esc(url) + '" alt="" loading="lazy" data-initial="' + esc(initial) + '">';
    return '<div class="rank-avatar rank-avatar-fallback">' + esc(initial) + '</div>';
  }
  function fixBrokenAvatars(container) {
    container.querySelectorAll('img.rank-avatar').forEach(function (img) {
      img.addEventListener('error', function () {
        const d = document.createElement('div');
        d.className = 'rank-avatar rank-avatar-fallback';
        d.textContent = img.dataset.initial || '?';
        img.replaceWith(d);
      }, { once: true });
    });
  }

  // ── TOP HOLDERS ──
  async function loadHolders() {
    const el = document.getElementById('holdersLeaderboard');
    if (!el) return;
    const sb = getSB();
    if (!sb) { el.innerHTML = '<div class="rankings-empty">No connection</div>'; return; }
    try {
      const { data, error } = await sb.rpc('get_holders_leaderboard', { p_limit: 10 });
      if (error) {
        console.error('[rankings] holders RPC error:', error);
        el.innerHTML = '<div class="rankings-empty">Error loading</div>';
        return;
      }
      if (!data || !data.length) {
        el.innerHTML = '<div class="rankings-empty">No holders yet</div>';
        return;
      }
      el.innerHTML = data.map(function (row) {
        const tier = badgeFromName(row.holder_tier);
        const bal  = Number(row.token_balance || 0).toLocaleString();
        return '<div class="rank-row">' +
          avatarHTML(row) +
          '<div class="rank-info">' +
            '<div class="rank-name">' + esc(row.username || 'anon') + '</div>' +
            '<div class="rank-meta"><span class="rank-level">' + tier.emoji + ' ' + esc(tier.name.toUpperCase()) + '</span></div>' +
          '</div>' +
          '<div class="rank-stats"><span class="rank-score">' + bal + '</span></div>' +
        '</div>';
      }).join('');
      fixBrokenAvatars(el);
    } catch (e) {
      console.error('[rankings] loadHolders threw:', e);
      el.innerHTML = '<div class="rankings-empty">Error loading</div>';
    }
  }

  // ── TOP ACTIVITY ──
  async function loadActivity() {
    const el = document.getElementById('activityLeaderboard');
    if (!el) return;
    const sb = getSB();
    if (!sb) { el.innerHTML = '<div class="rankings-empty">No connection</div>'; return; }
    try {
      const { data, error } = await sb.rpc('get_activity_leaderboard', { p_limit: 50 });
      if (error) {
        console.error('[rankings] activity RPC error:', error);
        el.innerHTML = '<div class="rankings-empty">Error loading</div>';
        return;
      }
      if (!data || !data.length) {
        el.innerHTML = '<div class="rankings-empty">No activity yet</div>';
        return;
      }
      const rows = data.slice().sort(function (a, b) {
        return Number(b.xp || 0) - Number(a.xp || 0);
      });
      el.innerHTML = rows.map(function (row) {
        const xp    = Number(row.xp || 0);
        const level = Number(row.level) || levelFromXp(xp);
        const today = Number(row.xp_today || 0);
        return '<div class="rank-row">' +
          avatarHTML(row) +
          '<div class="rank-info">' +
            '<div class="rank-name">' + esc(row.username || 'anon') + '</div>' +
            '<div class="rank-meta">' +
              '<span class="rank-level">LVL ' + level + '</span>' +
              (today > 0 ? '<span class="rank-detail">+' + today + ' today</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="rank-stats"><span class="rank-score">' + xp.toLocaleString() + ' XP</span></div>' +
        '</div>';
      }).join('');
      fixBrokenAvatars(el);
    } catch (e) {
      console.error('[rankings] loadActivity threw:', e);
      el.innerHTML = '<div class="rankings-empty">Error loading</div>';
    }
  }

  function refreshBoth() {
    loadHolders();
    loadActivity();
  }

  // ── addXP ──
  window.addXP = async function (messageId) {
    const sb = getSB();
    if (!sb || !messageId) return null;
    const w = (window.MSN && window.MSN.wallet && window.MSN.wallet.get)
      ? window.MSN.wallet.get()
      : (localStorage.getItem('msn_cached_wallet') || null);
    if (!w) return null;
    try {
      const { data, error } = await sb.rpc('add_xp', { p_wallet: w, p_message_id: messageId });
      if (error || !data || data.error) return null;
      if (data.granted > 0) {
        const lvl = data.level || levelFromXp(data.xp || 0);
        updateLevelBadge(lvl, data.xp, data.in_level, data.needed);
      }
      if (data.leveled_up && window.MSN && window.MSN.toast) window.MSN.toast.level(data.level);
      return data;
    } catch (e) { console.warn('[xp] add_xp error:', e); return null; }
  };

  // ── Wallet changed ──
  if (window.MSN && window.MSN.events) {
    window.MSN.events.on('msn:wallet-changed', function (payload) {
      const address = payload && payload.address;
      if (address && address !== lastWallet) {
        lastWallet = address;
        loadXp(address);
      } else if (!address && lastWallet) {
        lastWallet = null;
        updateLevelBadge(null, 0);
      }
    });
  }

  // Boot
  setTimeout(function () {
    let w = null;
    if (window.MSN && window.MSN.wallet && window.MSN.wallet.get) {
      w = window.MSN.wallet.get();
    } else {
      w = localStorage.getItem('msn_cached_wallet') || null;
    }
    if (w) { lastWallet = w; loadXp(w); }
  }, 500);

  // Expose for manual use
  window.MSN = window.MSN || {};
  window.MSN.rankings = { open: openRankings, close: closeRankings, refresh: refreshBoth };

  console.log('[xp-system] loaded — click 🏆 or call MSN.rankings.open()');
})();


/* ============================================================
   SECTION 3 — WALLET-BASED DAILY LOGIN TRACKING + RANK BADGE
   Requires in DOM:
     #sidebarStreakDisplay, #streakFires, #streakOverflow
     #sidebarBigRank
     #modResetLoginBtn (optional — for the reset button)
   Requires global: window.supabase, solanaWeb3
   Exposes: nothing on window (self-contained)
   ============================================================ */
(function () {
    const SUPABASE_URL = 'https://uxrpjfsouwxnlcbhjilz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_cLeBoHrdvg1b7WlnyJ-oVQ_6skjHc_H';

    const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=fa7e6515-19de-45de-a7d1-35a64a0d9a1a';
    const TOKEN_MINT = 'HJ5trLqpexXA4WoCHVeUGCpH9Je9x9Sfi2BEz4jHpump';

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let lastTrackedWallet = null;
    let streakToastTimeout = null;

    // ── Wallet helpers ──
    function getWalletAddress() {
        try {
            if (window.phantom?.solana?.publicKey) return window.phantom.solana.publicKey.toBase58();
            if (window.solana?.publicKey) return window.solana.publicKey.toBase58();
        } catch (e) { /* ignore */ }
        return null;
    }

    function getCachedWallet() {
        try {
            return localStorage.getItem('msn_cached_wallet');
        } catch (e) { return null; }
    }

    // ── Dedicated streak toast ──
    function getOrCreateStreakToast() {
        let el = document.getElementById('streakToast');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'streakToast';
        el.className = 'streak-toast';
        document.body.appendChild(el);
        return el;
    }

    function showStreakToast(msg) {
        const el = getOrCreateStreakToast();
        el.textContent = msg;
        el.classList.remove('visible');
        void el.offsetWidth;
        el.classList.add('visible');
        clearTimeout(streakToastTimeout);
        streakToastTimeout = setTimeout(() => el.classList.remove('visible'), 6500);
    }

    // ── Streak: 7-fire display (desktop only) ──
    const MAX_FIRES = 7;

    function updateStreakBadge(streak) {
        const container = document.getElementById('sidebarStreakDisplay');
        const firesEl = document.getElementById('streakFires');
        const overflowEl = document.getElementById('streakOverflow');

        if (!container || !firesEl || !overflowEl) return;

        // Hide if no streak
        if (!streak || streak <= 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        const filled = Math.min(streak, MAX_FIRES);

        // Build the 7 fire slots — filled ones glow, empty ones are dimmed
        let html = '';
        for (let i = 0; i < MAX_FIRES; i++) {
            const isFilled = i < filled;
            html += `<span class="fire-slot ${isFilled ? 'fire-filled' : 'fire-empty'}">🔥</span>`;
        }
        firesEl.innerHTML = html;

        // Overflow: show `× N` when streak exceeds 7
        if (streak > MAX_FIRES) {
            overflowEl.textContent = `× ${streak}`;
            overflowEl.classList.remove('hidden');
        } else {
            overflowEl.textContent = '';
            overflowEl.classList.add('hidden');
        }
    }

    // ── Rank badge ──
    function getBadge(balance) {
        if (balance >= 1000000) return { emoji: '🐋', name: 'Whale' };
        if (balance >= 250000)  return { emoji: '🐬', name: 'Dolphin' };
        if (balance >= 100000)  return { emoji: '🦀', name: 'Crab' };
        return { emoji: '🦐', name: 'Shrimp' };
    }

    function updateRankBadge(balance) {
        const el = document.getElementById('sidebarBigRank');
        if (!el) return;
        if (balance === null || balance === undefined) {
            el.textContent = '';
            el.classList.add('hidden');
            return;
        }
        const badge = getBadge(balance);
        el.textContent = `${badge.emoji} ${badge.name}`;
        el.classList.remove('hidden');
    }

    // ── Chain balance ──
    async function fetchWalletBalance(wallet) {
        try {
            const connection = new solanaWeb3.Connection(SOLANA_RPC);
            const pubkey = new solanaWeb3.PublicKey(wallet);
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
                programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            });
            let balance = 0;
            for (const acc of tokenAccounts.value) {
                const info = acc.account.data.parsed.info;
                if (info.mint === TOKEN_MINT) {
                    balance += parseFloat(info.tokenAmount.uiAmountString);
                }
            }
            return balance;
        } catch (err) {
            console.warn('Balance fetch failed:', err);
            return null;
        }
    }

    async function loadCachedBalance(wallet) {
        try {
            const { data, error } = await sb.rpc('get_wallet_balance', { p_wallet: wallet });
            if (!error && data !== null && data !== undefined) {
                updateRankBadge(Number(data));
            }
        } catch (e) { /* ignore */ }
    }

    // ── Streak (toast only on new day) ──
    async function trackDailyLogin(wallet) {
        try {
            const { data, error } = await sb.rpc('track_daily_login_wallet', { p_wallet: wallet });
            if (error) { console.warn('Login tracking failed:', error); return; }
            if (!data || !data.streak) return;

            updateStreakBadge(data.streak);

            if (!data.already_logged) {
                const msg = data.streak === 1
                    ? `🔥 Day 1 login streak!`
                    : `🔥 Day ${data.streak} login streak!`;
                showStreakToast(msg);
            }
        } catch (err) { console.error('Login tracking error:', err); }
    }

    // ── Balance refresh ──
    async function refreshBalance(wallet) {
        const balance = await fetchWalletBalance(wallet);
        if (balance === null) return;
        updateRankBadge(balance);
        try {
            await sb.rpc('update_wallet_balance', { p_wallet: wallet, p_balance: balance });
        } catch (e) { /* ignore */ }
    }

    function clearBadges() {
        updateStreakBadge(0);
        updateRankBadge(null);
    }

    // ── Poll ──
    function checkAndTrack() {
        const wallet = getWalletAddress() || getCachedWallet();

        if (!wallet) {
            if (lastTrackedWallet) {
                lastTrackedWallet = null;
                clearBadges();
            }
            return;
        }

        if (wallet !== lastTrackedWallet) {
            lastTrackedWallet = wallet;
            loadCachedBalance(wallet);
            trackDailyLogin(wallet);
            refreshBalance(wallet);
        }
    }

    setInterval(checkAndTrack, 1500);
    setTimeout(checkAndTrack, 800);

    // ── Phantom listeners ──
    function attachPhantomListeners() {
        const provider = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
        if (!provider) return;

        provider.on?.('connect',        () => { lastTrackedWallet = null; checkAndTrack(); });
        provider.on?.('disconnect',     () => { lastTrackedWallet = null; clearBadges(); });
        provider.on?.('accountChanged', () => { lastTrackedWallet = null; clearBadges(); checkAndTrack(); });
    }
    attachPhantomListeners();

    // ── Reset button ──
    function attachResetListener() {
        const resetBtn = document.getElementById('modResetLoginBtn');
        if (!resetBtn || resetBtn.dataset.listenerAttached) return;
        resetBtn.dataset.listenerAttached = 'true';

        resetBtn.addEventListener('click', async () => {
            if (!confirm('⚠️ Reset ALL wallet streaks and cached balances to zero?')) return;
            try {
                const { error } = await sb.rpc('reset_login_tracking');
                if (error) throw error;
                showStreakToast('✅ All wallet data reset to zero.');
                lastTrackedWallet = null;
                clearBadges();
            } catch (err) {
                console.error('Reset failed:', err);
                showStreakToast('❌ Failed to reset: ' + err.message);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachResetListener);
    } else {
        attachResetListener();
    }
})();
