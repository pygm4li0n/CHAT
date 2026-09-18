// xp-system.js — XP badge + dual leaderboards. Bulletproof version.
// Lazy-resolves everything at call time so load order can't break it.
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
    // Inline fallback if core isn't loaded
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
