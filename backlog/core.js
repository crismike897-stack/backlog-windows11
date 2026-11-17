/* Backlog core: settings, library, scene rotation, transitions, the clock corner and burn-in care.
   Plain script (Steam loads the page in its own browser with no build step). Scenes register with BACKLOG.scene(). */
(function () {
  'use strict';

  // ------------------------------------------------------------------ settings
  var DEFAULTS = {
    scenes: 'all',            // 'all' or a list of scene ids, in order
    shuffle: true,
    minutesPerScene: 5,
    transition: 'tv',         // tv | fade | glitch | cut
    clock: { hour12: true, seconds: false, show: 'all' }, // show: 'all' | 'clock' (time and date only) | 'none'
    overlay: { clock: 'auto' }, // 'never' hides the clock corner in every scene
    oled: { pixelShift: true, shiftPx: 10, dim: 1, nightDim: { from: 23, to: 7, level: 0.6 }, blackAfterMinutes: 0, blackClock: true },
    library: { recentDays: 0, minMinutes: 0, exclude: [] },
    featured: [],             // names: only these step into the spotlight and make Mosaic's pictures (empty: any game)
    sceneOptions: {},
    name: ''
  };

  function merge(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      var b = base[k], o = over[k];
      out[k] = (b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b) && !Array.isArray(o)) ? merge(b, o) : o;
    });
    return out;
  }

  var params = new URLSearchParams(location.search);
  var config = merge(DEFAULTS, window.BACKLOG_CONFIG || {});
  if (params.get('minutes')) config.minutesPerScene = parseFloat(params.get('minutes'));
  if (params.get('transition')) config.transition = params.get('transition');
  // ?featured=Name|Name: the favorites for this run, first one first (previews and recordings).
  if (params.get('featured')) config.featured = params.get('featured').split('|');

  // ------------------------------------------------------------------ time (a fixed or sped-up clock for previews and tests)
  var SPEED = parseFloat(params.get('speed') || '1') || 1;
  var FIXED = params.get('t') ? new Date(isNaN(+params.get('t')) ? params.get('t') : +params.get('t')).getTime() : null;
  var bootReal = Date.now();
  // ?t= starts the clock at that time and lets it run; add &freeze to hold it still (for screenshots).
  var FREEZE = params.has('freeze');
  function nowMs() { return (FIXED != null ? FIXED : bootReal) + (FREEZE ? 0 : Date.now() - bootReal); }
  function now() { return new Date(nowMs()); }

  // ------------------------------------------------------------------ text helpers
  // Never let generated text put a C straight before a P (spaces and punctuation between count as straight).
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function fmtTime(d) {
    d = d || now();
    var h = d.getHours(), ampm = h < 12 ? 'AM' : 'PM';
    var hh = config.clock.hour12 ? ((h % 12) || 12) : h;
    return { h: config.clock.hour12 ? String(hh) : pad(hh), m: pad(d.getMinutes()), s: pad(d.getSeconds()), ampm: config.clock.hour12 ? ampm : '', text: (config.clock.hour12 ? hh : pad(hh)) + ':' + pad(d.getMinutes()) };
  }
  function fmtDate(d) { d = d || now(); return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }
  function hours(min) { var h = (min || 0) / 60; return h >= 100 ? Math.round(h) : h >= 10 ? Math.round(h) : Math.round(h * 10) / 10; }
  function ago(sec) {
    if (!sec) return 'NEVER';
    var d = (nowMs() / 1000 - sec);
    var m = Math.max(1, Math.round(d / 60)), h = Math.round(d / 3600);
    if (d < 3600) return m === 1 ? '1 MINUTE AGO' : m + ' MINUTES AGO';
    if (d < 86400) return h === 1 ? '1 HOUR AGO' : h + ' HOURS AGO';
    var days = Math.round(d / 86400);
    if (days === 1) return 'YESTERDAY';
    if (days < 60) return days + ' DAYS AGO';
    if (days < 548) return Math.round(days / 30.4) + ' MONTHS AGO';
    var years = Math.round(days / 365);
    return years === 1 ? '1 YEAR AGO' : years + ' YEARS AGO';
  }

  // Seeded random numbers, so a scene can be repeatable (mulberry32).
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    var f = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = function (n) { return Math.floor(f() * n); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.range = function (a, b) { return a + f() * (b - a); };
    f.shuffle = function (arr) { arr = arr.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(f() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    f.text = function (len, alphabet) { alphabet = alphabet || 'ABDEFGHJKLMNRSTUVWXYZ0123456789'; var s = ''; for (var i = 0; i < len; i++) s += alphabet[Math.floor(f() * alphabet.length)]; return s; };
    f.hex = function (len) { var s = ''; for (var i = 0; i < len; i++) s += '0123456789ABCDEF'[Math.floor(f() * 16)]; return s; };
    return f;
  }
  var seed = parseInt(params.get('seed') || '', 10) || (Date.now() & 0xffffffff);
  var R = rng(seed);

  function hashHue(str) { var h = 0; str = String(str); for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 360; }

  // ------------------------------------------------------------------ library
  // library/library.js (written by the sync tool) sets window.BACKLOG_LIBRARY. Without it, a demo library stands in.
  function demoArt(game, kind) {
    var c = document.createElement('canvas');
    var W = kind === 'cover' ? 600 : kind === 'logo' ? 800 : 1920, H = kind === 'cover' ? 900 : kind === 'logo' ? 300 : 620;
    c.width = W; c.height = H;
    var g = c.getContext('2d'), r = rng(hashHue(game.name) + 7), hue = game.hue;
    if (kind !== 'logo') {
      var grd = g.createLinearGradient(0, 0, W * .3, H);
      grd.addColorStop(0, 'hsl(' + hue + ',60%,22%)'); grd.addColorStop(1, 'hsl(' + ((hue + 40) % 360) + ',70%,8%)');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      for (var i = 0; i < 26; i++) {
        g.globalAlpha = r.range(.05, .35);
        g.fillStyle = 'hsl(' + ((hue + r.range(-30, 60)) | 0) + ',80%,' + (r.range(30, 70) | 0) + '%)';
        g.beginPath(); g.arc(r() * W, r() * H, r.range(10, W / 3), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    if (kind !== 'hero') {
      g.fillStyle = kind === 'logo' ? '#fff' : 'rgba(255,255,255,.92)';
      g.font = '700 ' + (kind === 'logo' ? 96 : 72) + 'px "Barlow Condensed", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var words = game.name.toUpperCase().split(' ');
      words.forEach(function (w, i) { g.fillText(w, W / 2, (kind === 'logo' ? H / 2 : H * .72) + (i - (words.length - 1) / 2) * (kind === 'logo' ? 92 : 76)); });
    }
    return c.toDataURL('image/' + (kind === 'logo' ? 'png' : 'jpeg'), .85);
  }

  // name, hue, days since played, hours, achievements [unlocked, total] (null: the game has none on record)
  var DEMO = [
    ['Lantern Drift', 34, 2, 212, [33, 76]], ['Saltmarsh Run', 200, 1, 64, [42, 42]], ['Ninth Orbit', 280, 4, 141, [18, 50]], ['Glass Harbor', 160, 9, 38, null],
    ['Ironvale', 15, 13, 96, [7, 31]], ['Pale Signal', 320, 20, 22, null], ['Moth & Lamp', 50, 31, 12, [3, 24]], ['Velvet Static', 300, 44, 57, [51, 60]],
    ['Kestrel Line', 120, 63, 8, null], ['Hollow Tide', 190, 90, 31, [12, 40]], ['Copperfield Nights', 20, 120, 5, [1, 18]], ['Dust Choir', 260, 150, 17, null]
  ];
  function demoLibrary() {
    var t = nowMs() / 1000;
    return {
      demo: true, user: { name: '' },
      games: DEMO.map(function (d, i) {
        var g = { appid: 'demo' + i, name: d[0], hue: d[1], lastPlayed: t - d[2] * 86400 + 3600 * i, playtime: d[3] * 60, color: 'hsl(' + d[1] + ',75%,58%)' };
        if (d[4]) g.achievements = { unlocked: d[4][0], total: d[4][1] };
        var cache = {};
        g.art = function (kind) { return cache[kind] || (cache[kind] = demoArt(g, kind)); };
        return g;
      }),
      screenshots: []
    };
  }

  // Games Steam doesn't know about (console games, other launchers), from config.extraGames:
  // { name, hours, lastPlayed: 'YYYY-MM-DD', cover, hero, logo } with art paths relative to the backlog folder.
  function extraGames() {
    return (config.extraGames || []).filter(function (g) { return g && g.name; }).map(function (g, i) {
      var t = g.lastPlayed ? Date.parse(g.lastPlayed) : NaN;
      return { appid: 'extra' + i, name: g.name, playtime: Math.round((g.hours || 0) * 60), lastPlayed: isNaN(t) ? 0 : Math.round(t / 1000),
        cover: g.cover || null, hero: g.hero || null, logo: g.logo || null, header: g.header || null, extra: true };
    });
  }

  // One game, several entries (the same game added twice, an emulator copy and a mod build): show it once.
  // Entries with the same name always join; config.library.merge joins differently named ones, e.g.
  // [['Bloodborne', 'Bloodborne Enhanced']] (the first name is the one shown). Hours add up, the latest play wins,
  // and each kind of art comes from the first entry that has it.
  function combine(games) {
    var key = function (n) { return String(n || '').toLowerCase().replace(/[™®]/g, '').replace(/\s+/g, ' ').trim(); };
    var alias = {};
    (config.library.merge || []).forEach(function (set) { set.forEach(function (n) { alias[key(n)] = set[0]; }); });
    var out = [], byKey = {};
    games.forEach(function (g) {
      var shown = alias[key(g.name)] || g.name, k = key(shown), m = byKey[k];
      if (!m) { m = byKey[k] = merge(g, { name: shown }); out.push(m); return; }
      m.playtime = (m.playtime || 0) + (g.playtime || 0);
      if ((g.lastPlayed || 0) > (m.lastPlayed || 0)) m.lastPlayed = g.lastPlayed;
      ['cover', 'hero', 'logo', 'header', 'icon', 'achievements'].forEach(function (a) { if (!m[a] && g[a]) m[a] = g[a]; });
    });
    return out;
  }

  function loadLibrary() {
    var src = params.get('lib') === 'demo' ? null : window.BACKLOG_LIBRARY;
    var extras = params.get('lib') === 'demo' ? [] : extraGames();
    if ((!src || !src.games || !src.games.length) && extras.length) src = { games: [], screenshots: [] };
    if (!src || !src.games || !src.games.length) return demoLibrary();
    src = merge(src, { games: combine(src.games.concat(extras)) });
    var ex = (config.library.exclude || []).map(String);
    var cutoff = config.library.recentDays ? nowMs() / 1000 - config.library.recentDays * 86400 : 0;
    var games = src.games.filter(function (g) {
      if (ex.indexOf(String(g.appid)) >= 0 || ex.indexOf(g.name) >= 0) return false;
      if ((g.playtime || 0) < (config.library.minMinutes || 0)) return false;
      if (cutoff && (g.lastPlayed || 0) < cutoff) return false;
      return true;
    }).map(function (g) {
      g = merge({ hue: hashHue(g.name), playtime: 0, lastPlayed: 0 }, g);
      g.name = String(g.name).replace(/\s*[™®©]\s*/g, ' ').replace(/\s+/g, ' ').trim(); // "DARK SOULS™ III" reads as "DARK SOULS III"
      if (!g.color) g.color = 'hsl(' + g.hue + ',75%,58%)';
      // Art paths are relative to this folder. A missing kind falls back to the closest one that exists.
      g.art = function (kind) {
        var order = { cover: ['cover', 'hero', 'header'], hero: ['hero', 'header', 'cover'], logo: ['logo'], header: ['header', 'hero', 'cover'], icon: ['icon', 'logo'] }[kind] || [kind];
        for (var i = 0; i < order.length; i++) if (g[order[i]]) return g[order[i]];
        return null;
      };
      return g;
    });
    if (!games.length) return demoLibrary();
    return { demo: false, user: src.user || {}, games: games, screenshots: src.screenshots || [], generated: src.generated };
  }
  var LIB = loadLibrary();
  var byRecent = LIB.games.slice().sort(function (a, b) { return (b.lastPlayed || 0) - (a.lastPlayed || 0); });
  var byPlaytime = LIB.games.slice().sort(function (a, b) { return (b.playtime || 0) - (a.playtime || 0); });
  // config.featured: the whole library still fills the scenes, but only these games take the spotlight, in this order
  // first. Names match whole (case and ™ ignored), then by containing. Empty when unset or nothing matches.
  var featured = (function () {
    var norm = function (s) { return String(s).replace(/\s*[™®©]\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); };
    var out = [];
    (config.featured || []).forEach(function (n) {
      var w = norm(n), g = LIB.games.filter(function (x) { return norm(x.name) === w; })[0] ||
        LIB.games.filter(function (x) { return norm(x.name).indexOf(w) >= 0; })[0];
      if (g && out.indexOf(g) < 0) out.push(g);
    });
    return out;
  })();

  // Average color of an image, for glows. Falls back to the game's own color if the canvas is blocked.
  var colorCache = {};
  function artColor(game, kind) {
    var url = game.art(kind || 'hero');
    var key = url || game.appid;
    if (colorCache[key]) return colorCache[key];
    colorCache[key] = new Promise(function (resolve) {
      if (!url) return resolve(game.color);
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 24; c.height = 24;
          var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 24, 24);
          var d = g.getImageData(0, 0, 24, 24).data, r = 0, gg = 0, b = 0, n = 0;
          for (var i = 0; i < d.length; i += 4) {
            var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
            var w = (mx - mn) / 255 + .05; // favor saturated pixels so the glow isn't mud
            r += d[i] * w; gg += d[i + 1] * w; b += d[i + 2] * w; n += w;
          }
          resolve('rgb(' + Math.round(r / n) + ',' + Math.round(gg / n) + ',' + Math.round(b / n) + ')');
        } catch (e) { resolve(game.color); }
      };
      im.onerror = function () { resolve(game.color); };
      im.src = url;
    });
    return colorCache[key];
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var im = new Image(); im.decoding = 'async';
      im.onload = function () { resolve(im); }; im.onerror = function () { resolve(null); };
      im.src = url;
    });
  }

  // ------------------------------------------------------------------ DOM helpers
  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function css(id, text) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s);
  }

  // ------------------------------------------------------------------ battery (works where the browser offers it, e.g. a Steam Deck)
  var battery = null;
  if (navigator.getBattery) navigator.getBattery().then(function (b) { battery = b; }).catch(function () {});
  function batteryInfo() { return battery ? { level: battery.level, charging: battery.charging } : null; }

  // ------------------------------------------------------------------ palette
  // core.css holds the palette; this reads it back once so canvas and WebGL scenes use the same values.
  var theme = null;
  function readTheme() {
    var cs = getComputedStyle(document.body), v = function (k) { return cs.getPropertyValue('--bl-' + k).trim(); };
    var rgbList = function (s) { return s.split(',').map(function (n) { return +n; }); };
    var rgb = rgbList(v('accent-rgb')), srgb = rgbList(v('second-rgb'));
    theme = {
      accent: v('accent'), accentRgb: rgb, hi: v('accent-hi'), lo: v('accent-lo'),
      second: v('second'), secondRgb: srgb, bloom: v('bloom'), ink: v('ink'), dim: v('dim'), faint: v('faint'),
      glow: v('glow'), bg: v('bg'),
      hue: hueOf(rgb),
      rgba: function (a) { return 'rgba(' + rgb.join(',') + ',' + a + ')'; },
      secondRgba: function (a) { return 'rgba(' + srgb.join(',') + ',' + a + ')'; }
    };
    return theme;
  }
  function hueOf(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((h * 60) + 360) % 360;
  }

  // The house section head: a small block in the second color, a condensed label and a dim mono note in one row.
  // sizeU is the label's size.
  function head(parent, label, note, sizeU) {
    var s = sizeU || 24, row = el('div', 'bl-h-head', parent);
    var mk = el('span', 'bl-h-mk', row); mk.style.width = mk.style.height = 'calc(' + (s * .5).toFixed(1) + ' * var(--u))';
    mk.style.marginBottom = 'calc(' + (s * .12).toFixed(1) + ' * var(--u))';
    var l = el('span', 'bl-h-lab', row, label); l.style.fontSize = 'calc(' + s + ' * var(--u))';
    var n = null;
    if (note != null) { n = el('span', 'bl-h-mono', row, note); n.style.fontSize = 'calc(' + (s * .66).toFixed(1) + ' * var(--u))'; n.style.paddingBottom = 'calc(' + (s * .1).toFixed(1) + ' * var(--u))'; }
    row._label = l; row._note = n;
    return row;
  }

  // The clock corner the cover scenes share: a soft dark scrim in the lower left and, on it, a museum placard in
  // sentence case: the time, the date, a short rule, then how many games and hours the library holds. Figures sit
  // in fixed cells so nothing jumps when a 1 becomes a 2. config.clock.show picks how much of it there is: 'all',
  // 'clock' (the time and date, without the library line) or 'none' (no corner; overlay.clock 'never' means the
  // same). opts: parent (the scene's root).
  // Returns { box, minute(tm, date), tick(t), rect(marginU) }: call tick(t) every frame (it updates the time when
  // the minute turns and keeps up the slow wander, so nothing bright sits still); rect() is the corner's screen
  // box plus a margin (40 units), { l, t, r, b }, for keeping captions clear of it.
  var DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function clockShow() {
    var s = config.clock.show;
    if (config.overlay.clock === 'never' || s === 'none' || s === false) return 'none';
    return s === 'clock' ? 'clock' : 'all';
  }
  function clockShown() { return clockShow() !== 'none'; }
  function clockCorner(opts) {
    opts = opts || {};
    var parent = opts.parent, withLibrary = clockShow() === 'all';
    var n = LIB.games.length, total = 0;
    LIB.games.forEach(function (g) { total += g.playtime || 0; });
    var hrs = Math.round(total / 60), games = n + (n === 1 ? ' game' : ' games');
    // Each figure in its own fixed cell (em of the parent's size), so the line never shifts.
    function figs(box, text, dw, cw) {
      box.textContent = '';
      for (var i = 0; i < text.length; i++) { var c = text[i]; el('span', 'bl-cc-fig', box, c).style.width = (c === ':' ? cw : dw) + 'em'; }
    }
    el('div', 'bl-cc-scrim', parent);
    var box = el('div', 'bl-cc bl-cc-label', parent);
    var lTime = el('div', 'bl-cc-lb-time', box), lFig = el('span', null, lTime), lAp = el('span', 'bl-cc-lb-ap', lTime);
    var lDate = el('div', 'bl-cc-lb-date', box);
    if (withLibrary) {
      el('div', 'bl-cc-lb-rule', box);
      el('div', 'bl-cc-lb-line', box, hrs > 0 ? games + ', ' + hrs.toLocaleString('en-US') + (hrs === 1 ? ' hour played' : ' hours played') : games + ' in your library');
    }
    var ui = { box: box };
    ui.minute = function (tm, d) {
      figs(lFig, tm.text, .74, .3); lAp.textContent = tm.ampm;
      lDate.textContent = DAYS_LONG[d.getDay()] + ', ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    };

    var lastKey = '';
    function update() { var tm = fmtTime(), k = tm.text + tm.ampm; if (k !== lastKey) { lastKey = k; ui.minute(tm, now()); } }
    update(); // filled in from the start, so rect() is the real size before the first frame
    ui.tick = function (t) {
      update();
      // A slow wander so the big numerals never sit on the same pixels.
      box.style.transform = 'translate(' + (Math.sin(t / 89) * 34 * ctx.u).toFixed(1) + 'px,' + (Math.sin(t / 61 + 1) * -22 * ctx.u).toFixed(1) + 'px)';
    };
    ui.rect = function (marginU) {
      var r = box.getBoundingClientRect(), m = (marginU == null ? 40 : marginU) * ctx.u;
      return { l: r.left - m, t: r.top - m, r: r.right + m, b: r.bottom + m };
    };
    return ui;
  }

  // A game's achievements, small: "33 / 76 ACHIEVEMENTS" and a thin accent bar, or a check and "ALL 42 ACHIEVEMENTS"
  // when every one is unlocked. null when the game has no achievements on record (non-Steam games, some demos).
  // Secondary by design: mono, dim, under the hours and last played. opts: sizeU (text size, 15), barU (bar length,
  // 120), px (true inside a stage that is already scaled to design pixels, as some scenes are).
  function achievement(game) {
    var a = game && game.achievements, t = a && +a.total, n = a ? Math.max(0, Math.min(t, +a.unlocked || 0)) : 0;
    return t > 0 ? { unlocked: n, total: t, all: n >= t, share: n / t } : null;
  }
  function achieve(parent, game, opts) {
    opts = opts || {};
    var a = achievement(game);
    if (!a) return null;
    var un = function (n) { return opts.px ? n + 'px' : 'calc(' + n + ' * var(--u))'; }, s = opts.sizeU || 15;
    var row = el('div', 'bl-h-ach' + (a.all ? ' all' : ''), parent);
    row.style.gap = un(s * .7); row.style.fontSize = un(s);
    if (a.all) {
      var ok = el('span', 'bl-h-ach-ok', row); ok.style.width = un(s * .42); ok.style.height = un(s * .78); ok.style.borderWidth = '0 ' + un(Math.max(2, s * .16)) + ' ' + un(Math.max(2, s * .16)) + ' 0';
      el('span', 'bl-h-mono', row, 'ALL ' + a.total + ' ACHIEVEMENTS');
    } else {
      el('span', 'bl-h-mono', row, a.unlocked + ' / ' + a.total + ' ACHIEVEMENTS');
      var bar = el('span', 'bl-h-ach-bar', row); bar.style.width = un(opts.barU || 120); bar.style.height = un(Math.max(2, s * .2));
      el('i', null, bar).style.transform = 'scaleX(' + Math.max(.02, a.share).toFixed(3) + ')';
    }
    return row;
  }

  // ------------------------------------------------------------------ scenes
  var registry = {}, order = [];
  function scene(def) { registry[def.id] = def; order.push(def.id); }

  var stage, overlay, shift, veil;
  var current = null, currentDef = null, sceneStart = 0, lastFrame = 0, sceneT = 0;
  var playlist = [], playIndex = -1, locked = params.get('scene');

  function available(def) {
    if (def.needs === 'screenshots' && !(LIB.screenshots && LIB.screenshots.length)) return false;
    if (def.needs === 'library' && LIB.demo && def.realOnly) return false;
    return true;
  }
  function buildPlaylist() {
    var ids = config.scenes === 'all' ? order.slice() : config.scenes.filter(function (id) { return registry[id]; });
    ids = ids.filter(function (id) { return available(registry[id]); });
    if (config.shuffle) {
      var last = playlist[playlist.length - 1] || store('last');
      ids = R.shuffle(ids);
      if (ids.length > 1 && ids[0] === last) ids.push(ids.shift());
    }
    return ids;
  }

  var ctx = {
    get w() { return stage.clientWidth; }, get h() { return stage.clientHeight; },
    get u() { return Math.min(stage.clientWidth / 1920, stage.clientHeight / 1080); },
    config: config, params: params, lib: LIB, demo: LIB.demo,
    games: LIB.games, recent: byRecent, top: byPlaytime, shots: LIB.screenshots, featured: featured,
    now: now, nowMs: nowMs, fmtTime: fmtTime, fmtDate: fmtDate, hours: hours, ago: ago, pad: pad,
    rng: rng, R: R, hashHue: hashHue, artColor: artColor, loadImage: loadImage,
    el: el, css: css, battery: batteryInfo, speed: SPEED, store: function (k, v) { return store(k, v); },
    options: function (id) { return config.sceneOptions[id] || {}; },
    idleSince: function () { return idleStart; },   // ms (ctx.nowMs clock) when the screensaver started
    seed: seed,
    get theme() { return theme || readTheme(); },  // { accent, accentRgb, hi, lo, second, ink, dim, hue, rgba(a) ... }
    head: head,  // head(parent, label, note, sizeU)
    // clockCorner({ parent }), the cover scenes' clock; clockShown(): false when it is switched off
    clockCorner: clockCorner, clockShown: clockShown,
    achievement: achievement, achieve: achieve
  };

  function mount(id) {
    var def = registry[id];
    if (current) { try { current.unmount && current.unmount(); } catch (e) { console.error(e); } }
    stage.innerHTML = '';
    var root = el('div', 'bl-scene bl-' + id, stage);
    currentDef = def; current = null;
    try { current = def.mount(root, ctx) || {}; }
    catch (e) { console.error('scene ' + id + ' failed', e); current = null; return false; }
    sceneStart = performance.now(); sceneT = 0;
    document.body.setAttribute('data-scene', id);
    store('last', id);
    return true;
  }

  function next() {
    if (locked && registry[locked]) return mount(locked);
    for (var tries = 0; tries < 30; tries++) {
      playIndex++;
      if (playIndex >= playlist.length) { playlist = buildPlaylist(); playIndex = 0; }
      if (!playlist.length) return;
      if (mount(playlist[playIndex])) return;
    }
  }

  function swap() {
    var kind = config.transition;
    if (kind === 'cut') return next();
    if (kind === 'tv') return tvSwap();
    veil.className = kind === 'glitch' ? 'glitch on' : 'on';
    setTimeout(function () { next(); requestAnimationFrame(function () { veil.className = kind === 'glitch' ? 'glitch' : ''; }); }, kind === 'glitch' ? 160 : 950);
  }

  // 'tv': fold the picture to a line (.34 s), shrink the line to a point and blink out (.3 s), a beat of black while
  // the next scene mounts, then the line draws back out (.2 s) and the picture opens from it (.4 s). About 1.3 s.
  var tvLine = null, tvBusy = false, tvAnims = [];
  function tvSwap(firstOpen) {
    if (tvBusy) return;
    tvBusy = true;
    if (!tvLine) tvLine = el('div', 'bl-tv', document.body);
    var picture = [stage, overlay];
    var fold = 'cubic-bezier(.6,0,.9,.4)', open = 'cubic-bezier(.15,.7,.25,1)';
    function play(node, frames, ms, easing, delay, keep) {
      var a = node.animate(frames, { duration: ms, easing: easing || 'linear', delay: delay || 0, fill: keep === true ? 'forwards' : (keep || 'none') });
      tvAnims.push(a);
      return a;
    }
    function opening() {
      var held = tvAnims; tvAnims = [];
      play(tvLine, [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: .85, transform: 'scaleX(.06)', offset: .2 }, { opacity: .9, transform: 'scaleX(1)' }], 200, open, 0, true);
      picture.forEach(function (p) {
        play(p, [{ transform: 'scaleY(.004)', opacity: 0 }, { transform: 'scaleY(.004)', opacity: 1, offset: .05 }, { transform: 'scaleY(1)', opacity: 1 }], 400, open, 170, 'backwards');
      });
      held.forEach(function (a) { try { a.cancel(); } catch (e) { /* done */ } });
      play(tvLine, [{ opacity: .9 }, { opacity: 0 }], 260, 'ease-out', 260, true).onfinish = function () {
        tvAnims.forEach(function (a) { try { a.cancel(); } catch (e) { /* done */ } }); tvAnims = []; tvBusy = false;
      };
    }
    if (firstOpen) {
      picture.forEach(function (p) { play(p, [{ transform: 'scaleY(.004)', opacity: 0 }, { transform: 'scaleY(.004)', opacity: 0 }], 1, 'linear', 0, true); });
      next();
      setTimeout(opening, 120);
      return;
    }
    picture.forEach(function (p) {
      play(p, [{ transform: 'scaleY(1)', filter: 'brightness(1)', opacity: 1 }, { transform: 'scaleY(.02)', filter: 'brightness(1.4)', opacity: 1, offset: .8 }, { transform: 'scaleY(.004)', filter: 'brightness(1.4)', opacity: 0 }], 340, fold, 0, true);
    });
    play(tvLine, [{ opacity: 0, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)', offset: .55 }, { opacity: .9, transform: 'scaleX(1)' }], 340, 'linear', 0, true);
    setTimeout(function () {
      // the line pulls in to a point and blinks out
      play(tvLine, [{ opacity: .9, transform: 'scaleX(1)' }, { opacity: .95, transform: 'scaleX(.015)', offset: .78 }, { opacity: 0, transform: 'scaleX(.004)' }], 300, 'cubic-bezier(.5,0,.8,.5)', 0, true);
      setTimeout(function () {
        next();
        requestAnimationFrame(function () { setTimeout(opening, 60); });
      }, 320);
    }, 340);
  }

  var idleStart = nowMs();

  // ------------------------------------------------------------------ burn-in care
  var shiftAt = 0, shiftStep = 0;
  function pixelShift(ms) {
    if (!config.oled.pixelShift || (currentDef && currentDef.noShift)) { shift.style.transform = ''; return; }
    if (ms - shiftAt < 60000) return;
    shiftAt = ms; shiftStep++;
    var a = shiftStep * 2.399963, r = config.oled.shiftPx * Math.sqrt((shiftStep % 7 + 1) / 7); // a slow sunflower orbit, never the same spot twice in a row
    shift.style.transform = 'translate(' + (Math.cos(a) * r).toFixed(1) + 'px,' + (Math.sin(a) * r).toFixed(1) + 'px)';
  }
  // After config.oled.blackAfterMinutes the picture fades to black for good (the panel rests); a faint clock may wander.
  var blackOn = false, blackClockEl = null;
  function blackTick(ms) {
    var after = config.oled.blackAfterMinutes;
    if (!after || blackOn || (nowMs() - idleStart) < after * 60000) return;
    blackOn = true;
    veil.className = 'on rest';
    if (config.oled.blackClock) blackClockEl = el('div', 'bl-black-clock', document.body);
    setTimeout(function () { if (current && current.unmount) try { current.unmount(); } catch (e) {} current = null; stage.innerHTML = ''; }, 1500);
  }
  function blackClockTick() {
    if (!blackClockEl) return;
    var t = fmtTime();
    blackClockEl.textContent = t.text + (t.ampm ? ' ' + t.ampm : '');
    if (Math.floor(nowMs() / 1000) % 20 === 0) {
      blackClockEl.style.left = (8 + Math.random() * 70) + 'vw';
      blackClockEl.style.top = (8 + Math.random() * 78) + 'vh';
    }
  }

  // Remembered between launches where the browser keeps storage (a Steam Deck does; best effort elsewhere).
  // With no-memory (previews that must start identically, such as clock-picker.html) or no storage, it remembers for
  // this run only, so a scene still takes turns instead of repeating its first pick.
  var memory = {};
  function store(key, value) {
    var k = 'backlog:' + key;
    if (!params.has('no-memory')) {
      try {
        if (value === undefined) { var v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); }
        localStorage.setItem(k, JSON.stringify(value)); return;
      } catch (e) { /* storage blocked: fall through to this run's memory */ }
    }
    if (value === undefined) return k in memory ? JSON.parse(memory[k]) : null;
    memory[k] = JSON.stringify(value);
  }

  function dimTick() {
    var nd = config.oled.nightDim, h = now().getHours(), level = config.oled.dim;
    if (nd && nd.level != null && (nd.from > nd.to ? (h >= nd.from || h < nd.to) : (h >= nd.from && h < nd.to))) level = Math.min(level, nd.level);
    document.body.classList.toggle('bl-dim', level < 1);
    document.body.style.setProperty('--bl-dim', level);
  }

  // ------------------------------------------------------------------ loop
  var lastSec = -1;
  function frame(ms) {
    var dt = Math.min(0.1, (ms - (lastFrame || ms)) / 1000) * SPEED;
    lastFrame = ms; sceneT += dt;
    if (current && current.frame) {
      try { current.frame(sceneT, dt); } catch (e) { console.error(e); current = null; swap(); }
    }
    var sec = Math.floor(ms / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      pixelShift(ms); if (sec % 30 === 0) dimTick();
      blackTick(ms); blackClockTick();
      if (blackOn) { requestAnimationFrame(frame); return; }
      var len = (currentDef && currentDef.minutes) || config.minutesPerScene;
      if (!locked && sceneT > len * 60) swap();
    }
    requestAnimationFrame(frame);
  }

  function start() {
    stage = document.getElementById('stage'); overlay = document.getElementById('overlay');
    shift = document.getElementById('shift'); veil = document.getElementById('veil');
    window.addEventListener('resize', function () { if (current && current.resize) try { current.resize(); } catch (e) { console.error(e); } });
    readTheme();
    dimTick();
    var go = function () { if (config.transition === 'tv') tvSwap(true); else next(); requestAnimationFrame(frame); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    // Previews can step scenes with the arrow keys (in Steam any input ends the screensaver anyway).
    window.addEventListener('keydown', function (e) {
      if (!params.has('preview')) return;
      if (e.key === 'ArrowRight') { locked = null; swap(); }
    });
  }

  window.BACKLOG = { scene: scene, start: start, ctx: ctx, registry: registry, next: function () { locked = null; swap(); }, show: function (id) { locked = id; mount(id); } };
})();
