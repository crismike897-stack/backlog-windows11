/* Mosaic: a sibling of Drift. Hundreds of small covers from the library compose one big picture, the hero art of
   a featured game: each tile is the cover whose own color best matches its patch of the picture. The camera holds
   far enough back for the picture to read, then slowly pushes in toward the featured game's own cover until every
   tile reads as a cover, the caption sets beside it in the wall's title-card style, and the camera pulls back out
   while the tiles turn over into the next game's picture. The wall's clock sits in the dark corner.
   One 2D canvas: every cover is drawn once, small, into an atlas; a frame is one drawImage per visible tile.
   Options (config.sceneOptions.mosaic): clock (true), cycle (seconds per picture, 36), look ('classic', 'crisp' or
   'fine'; also ?mosaic-look=). Crisp: each cover is color-corrected to its patch of the picture instead of being
   washed with it, covers are also chosen by their own light and dark, and repeat less. Fine: crisp, with more,
   smaller tiles. */
BACKLOG.scene({
  id: 'mosaic', name: 'Mosaic', overlay: 'none',
  mount: function (root, ctx) {
    var opt = ctx.options('mosaic');
    var showClock = opt.clock !== false && ctx.config.overlay.clock === 'auto';
    var CYCLE = Math.max(24, +ctx.params.get('mosaic-cycle') || (opt.cycle == null ? 36 : +opt.cycle)); // ?mosaic-cycle= overrides it
    // ?mosaic-quick=N,S, for recording a short clip: after the first picture, the next N pictures each stay S seconds and the
    // camera stays back, so the tiles turn from picture to picture in a quick run; then the cycle goes on as usual.
    var QUICK = String(ctx.params.get('mosaic-quick') || '').split(','), QN = +QUICK[0] || 0, QS = +QUICK[1] || 3.6, nth = -1;
    function quickNow() { return nth >= 1 && nth <= QN; }
    function cycleLen() { return quickNow() ? QS : CYCLE; }
    var LOOK = String(ctx.params.get('mosaic-look') || opt.look || 'fine');
    var CRISP = LOOK !== 'classic', FINE = LOOK === 'fine';
    var FLAT = 0.42, OVER = 0.3, KCOR = 0.9; // how far a cover's own contrast is held back, the artwork laid over, the color correction
    var games = ctx.games, n = games.length;
    var store = ctx.store || function () { return null; };
    var el = ctx.el;
    function since(sec) { var d = (ctx.nowMs() / 1000 - sec) / 86400; return d >= 730 ? Math.floor(d / 365.25) + ' YEARS AGO' : d >= 365 ? 'A YEAR AGO' : ctx.ago(sec); }

    ctx.css('bl-mosaic-css', [
      '.bl-mosaic{background:#060708}',
      '.bl-mosaic-cv{position:absolute;left:0;top:0;opacity:0;transition:opacity 2.4s ease}',
      '.bl-mosaic-cv.on{opacity:1}',
      /* The camera's darkness: grows as the camera pushes in, so the neighbours fall back around the featured cover. */
      '.bl-mosaic-pool{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;opacity:0;will-change:transform,opacity}',
      '.bl-mosaic-fog{position:absolute;inset:0;pointer-events:none;background:',
      'linear-gradient(180deg,rgba(6,7,8,.8) 0,rgba(6,7,8,.42) 12%,rgba(6,7,8,.12) 28%,rgba(6,7,8,0) 40%,rgba(6,7,8,0) 70%,rgba(6,7,8,.28) 88%,rgba(6,7,8,.6) 100%),',
      'radial-gradient(ellipse 75% 85% at 52% 50%,rgba(0,0,0,0) 44%,rgba(0,0,0,.2) 66%,rgba(0,0,0,.52) 88%,rgba(0,0,0,.7) 100%)}',
      '.bl-mosaic-haze{position:absolute;inset:0;pointer-events:none;background:',
      'radial-gradient(ellipse 85% 46% at 58% 0%,rgba(var(--bl-accent-rgb),.12),rgba(var(--bl-accent-rgb),.04) 60%,rgba(var(--bl-accent-rgb),0) 100%),',
      'linear-gradient(0deg,rgba(var(--bl-accent-rgb),.06),rgba(var(--bl-accent-rgb),0) 22%)}',
      '.bl-mosaic-cap{position:absolute;left:0;top:0;width:max-content;max-width:calc(760*var(--u));opacity:0;transition:opacity 1.2s ease;pointer-events:none;will-change:transform}',
      '.bl-mosaic-cap.on{opacity:1}',
      '.bl-mosaic-cap::before{content:"";position:absolute;inset:-40% -18%;z-index:-1;background:radial-gradient(closest-side,rgba(4,5,6,.95),rgba(4,5,6,.84) 50%,rgba(4,5,6,.5) 75%,rgba(4,5,6,0))}',
      '.bl-mosaic-cap.right{text-align:right}',
      '.bl-mosaic-cap.right .bl-h-head{justify-content:flex-end}',
      '.bl-mosaic-cap .bl-h-rule{transform-origin:0 50%;transform:scaleX(0);transition:transform 1.1s cubic-bezier(.2,.8,.2,1) .2s}',
      '.bl-mosaic-cap .bl-h-rule.b{transition-delay:.34s}',
      '.bl-mosaic-cap.right .bl-h-rule{transform-origin:100% 50%}',
      '.bl-mosaic-cap.on .bl-h-rule{transform:none}',
      '.bl-mosaic-cap .bl-h-head{margin-bottom:calc(12*var(--u))}',
      '.bl-mosaic-cname{padding:calc(10*var(--u)) 0 calc(10*var(--u));font-size:calc(66*var(--u))}',
      '.bl-mosaic-cname.long{font-size:calc(52*var(--u))}.bl-mosaic-cname.longer{font-size:calc(42*var(--u))}',
      '.bl-mosaic-cline{white-space:nowrap;margin-top:calc(14*var(--u));font-size:calc(31*var(--u))}',
      /* achievements: one small dim line with a thin accent bar, or a small mark when every one is done */
      '.bl-mosaic-ach{margin-top:calc(14*var(--u))}.bl-mosaic-ach:empty{display:none}',
      '.bl-mosaic-cap.right .bl-h-ach{justify-content:flex-end}',
      '.bl-mosaic-achrow{display:flex;align-items:center;gap:calc(14*var(--u));font-size:calc(16*var(--u));white-space:nowrap}',
      '.bl-mosaic-cap.right .bl-mosaic-achrow{justify-content:flex-end}',
      '.bl-mosaic-bar{position:relative;flex:none;width:calc(150*var(--u));height:max(2px,calc(3*var(--u)));background:var(--bl-faint)}',
      '.bl-mosaic-bar i{position:absolute;left:0;top:0;bottom:0;background:var(--bl-accent);box-shadow:0 0 calc(6*var(--u)) rgba(var(--bl-accent-rgb),.6)}',
      '.bl-mosaic-done{flex:none;width:calc(10*var(--u));height:calc(10*var(--u));background:var(--bl-accent);transform:rotate(45deg);box-shadow:0 0 calc(8*var(--u)) rgba(var(--bl-accent-rgb),.6)}'
    ].join(''));
    root.classList.add('bl-mosaic');

    var cv = el('canvas', 'bl-mosaic-cv', root);
    var g2 = cv.getContext('2d', { alpha: false });
    var pool = el('div', 'bl-mosaic-pool', root);
    el('div', 'bl-mosaic-fog', root);
    el('div', 'bl-mosaic-haze', root);
    var cap = el('div', 'bl-mosaic-cap bl-cap', root);
    var capHead = ctx.head(cap, 'IN THE SPOTLIGHT', '', 22);
    el('div', 'bl-h-rule', cap);
    var capName = el('div', 'bl-mosaic-cname bl-cap-name', cap);
    el('div', 'bl-h-rule b', cap);
    var capLine = el('div', 'bl-mosaic-cline bl-cap-line', cap);
    var capAch = el('div', 'bl-mosaic-ach', cap); // small: achievements, under the hours
    // The clock corner is core's (ctx.clockCorner); its style is config.clock.style or this scene's clockStyle.
    var clockUi = showClock ? ctx.clockCorner({ parent: root, title: 'MOSAIC // ' + n + (n === 1 ? ' TITLE' : ' TITLES') }) : null;
    var rankOf = {}; ctx.top.forEach(function (g, i) { rankOf[g.appid] = i + 1; });

    // ---------------------------------------------------------------- the tiles in the atlas
    // At most 240 games go in (the most played first, so a huge library keeps its favorites); the rest still feature.
    var dead = false;
    var pal = ctx.top.slice(0, 240);
    var palIdx = {}; pal.forEach(function (g, i) { palIdx[g.appid] = i; });
    var P = pal.length;
    var atlas = null, AW = 0, AH = 0, ACOLS = 1, avg = new Float32Array(P * 3);
    var sub = new Float32Array(P * 6); // crisp: each cover's light and dark, as six patches (2 x 3) around its average
    function parseColor(c) {
      var t = document.createElement('canvas').getContext('2d');
      t.fillStyle = '#000'; t.fillStyle = c; var s = t.fillStyle;
      if (s[0] === '#') return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
      var m = s.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]];
    }
    function nameTile(a, g, x, y, w, h) {
      var gr = a.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, 'hsl(' + g.hue + ',35%,22%)'); gr.addColorStop(1, 'hsl(' + ((g.hue + 30) % 360) + ',40%,8%)');
      a.fillStyle = gr; a.fillRect(x, y, w, h);
      // the name in type, a few words a line, at the foot of the tile like the wall's
      var fs = Math.max(8, Math.round(w * 0.17)), words = String(g.name).toUpperCase().split(/\s+/), lines = [], cur = '';
      a.font = '700 ' + fs + 'px "Barlow Condensed", sans-serif';
      words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (a.measureText(t).width > w * 0.8 && cur) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      lines = lines.slice(-4);
      a.fillStyle = ctx.theme ? ctx.theme.accent : '#f2a516'; a.textBaseline = 'alphabetic';
      lines.forEach(function (l, k) { a.fillText(l, x + w * 0.1, y + h * 0.88 - (lines.length - 1 - k) * fs * 1.05); });
    }
    function buildAtlas(tw, th) {
      ACOLS = Math.ceil(Math.sqrt(P * th / tw));
      var arows = Math.ceil(P / ACOLS);
      AW = tw; AH = th;
      atlas = document.createElement('canvas');
      atlas.width = ACOLS * tw; atlas.height = arows * th;
      var a = atlas.getContext('2d', { willReadFrequently: true });
      a.imageSmoothingQuality = 'high';
      return Promise.all(pal.map(function (g, i) {
        var x = (i % ACOLS) * tw, y = Math.floor(i / ACOLS) * th;
        return ctx.loadImage(g.art('cover')).then(function (im) {
          if (dead) return;
          if (!im) { nameTile(a, g, x, y, tw, th); return; }
          var s = Math.max(tw / im.naturalWidth, th / im.naturalHeight), sw = tw / s, sh = th / s;
          a.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, tw, th);
        });
      })).then(function () {
        // Each cover's average color, read once. A blocked canvas falls back to the game's own color.
        try {
          var d = a.getImageData(0, 0, atlas.width, atlas.height).data, W = atlas.width, step = Math.max(2, Math.round(tw / 12));
          pal.forEach(function (g, i) {
            var x0 = (i % ACOLS) * tw, y0 = Math.floor(i / ACOLS) * th, r = 0, gg = 0, b = 0, c = 0;
            var bl = [0, 0, 0, 0, 0, 0], bc = [0, 0, 0, 0, 0, 0];
            for (var y = y0 + step / 2; y < y0 + th; y += step) for (var x = x0 + step / 2; x < x0 + tw; x += step) {
              var o = ((y | 0) * W + (x | 0)) * 4; r += d[o]; gg += d[o + 1]; b += d[o + 2]; c++;
              var bi = Math.min(1, ((x - x0) / tw * 2) | 0) + 2 * Math.min(2, ((y - y0) / th * 3) | 0);
              bl[bi] += d[o] * .3 + d[o + 1] * .59 + d[o + 2] * .11; bc[bi]++;
            }
            avg[i * 3] = r / c; avg[i * 3 + 1] = gg / c; avg[i * 3 + 2] = b / c;
            var la = (r * .3 + gg * .59 + b * .11) / c;
            for (var m = 0; m < 6; m++) sub[i * 6 + m] = bc[m] ? bl[m] / bc[m] - la : 0;
          });
        } catch (e) {
          pal.forEach(function (g, i) { var c = parseColor(g.color); avg[i * 3] = c[0] * .5; avg[i * 3 + 1] = c[1] * .5; avg[i * 3 + 2] = c[2] * .5; });
        }
      });
    }

    // ---------------------------------------------------------------- geometry
    var W = 0, H = 0, dpr = 1, cols = 0, rows = 0, TW = 0, TH = 0, GAP = 0, MX = 0, MY = 0, ZMAX = 3;
    function layout() {
      W = ctx.w; H = ctx.h; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      // About 300 tiles on a Deck, 450 at 1080p, a little more on ultrawide; never above 600.
      var target = Math.min(600, Math.max(260, W * H / 4600));
      if (FINE) target = Math.min(1000, target * 1.7);
      cols = Math.round(Math.sqrt(target * 1.5 * W / H));
      TW = W / cols; TH = TW * 1.5; GAP = Math.max(1, TW * 0.06);
      cols += 4; rows = Math.ceil(H / TH) + 4;            // a margin of tiles so the slow pan never shows an edge
      MX = (W - cols * TW) / 2; MY = (H - rows * TH) / 2;  // mosaic origin in screen px at zoom 1
      ZMAX = Math.max(2.6, Math.min(FINE ? 6.5 : 4.6, H * 0.34 / TH));  // close enough that the featured cover is a third of the screen
    }

    // ---------------------------------------------------------------- pictures
    // A picture: the featured game, its hero image, each cell's target color and chosen tile, the focal cell.
    var cells = null;  // per cell: [prevTile, curTile, flipDelay]
    var pic = null, prevPic = null;
    function heroOf(g) { return g.hero || g.art('hero'); }
    // config.featured (core's ctx.featured): only those games make pictures. Otherwise any game with a wide image.
    var picks = ctx.featured && ctx.featured.length ? ctx.featured : games;
    var feat = picks.filter(function (g) { return g.hero; });
    if (!feat.length) feat = picks.slice();
    // Featured games (sceneOptions.mosaic.featured or config.featured: names, or ?mosaic-game= for one, or several joined with |): these build
    // the pictures first, in order, before the rest take their turn.
    var want = (ctx.params.get('mosaic-game') ? ctx.params.get('mosaic-game').split('|') : (opt.featured || ctx.config.featured || [])).map(function (n) { return String(n).replace(/\s*[™®©]\s*/g, ' ').trim().toLowerCase(); });
    var queue = want.map(function (n) { return feat.filter(function (g) { return g.name.toLowerCase() === n; })[0] || feat.filter(function (g) { return g.name.toLowerCase().indexOf(n) >= 0; })[0]; }).filter(Boolean);
    function pickFeatured() {
      if (queue.length) { var q = queue.shift(); if (!(pic && q === pic.game)) return q; }
      var lit = store('mosaic-lit') || {};
      var best = null, bs = Infinity;
      feat.forEach(function (g) {
        if (pic && g === pic.game && feat.length > 1) return;
        var s = (lit[g.appid] || 0) + (rankOf[g.appid] || 999) * 1000 + ctx.R() * 5000; // the longest unseen first, the most played breaking ties
        if (s < bs) { bs = s; best = g; }
      });
      lit[best.appid] = ctx.nowMs();
      var ids = Object.keys(lit); if (ids.length > 400) ids.sort(function (a, b) { return lit[a] - lit[b]; }).slice(0, ids.length - 400).forEach(function (id) { delete lit[id]; });
      store('mosaic-lit', lit);
      return best;
    }
    // The part of the wide image a picture is made from: the middle, at the mosaic's shape. Always the whole picture:
    // framing tighter on a figure helped portraits but cropped art that is a pattern.
    function cropOf(img) {
      var ar = (cols * TW) / (rows * TH), iw = img.naturalWidth, ih = img.naturalHeight, sw = iw, sh = iw / ar;
      if (sh > ih) { sh = ih; sw = ih * ar; }
      return [(iw - sw) / 2, (ih - sh) * 0.4, sw, sh];
    }
    function targetsFor(img, g, p) {
      // The picture's color in each cell: drawn small (4x4 samples a cell) and averaged. Null if the canvas is blocked.
      var N = cols * rows, out = new Float32Array(N * 3);
      if (p) p.sub = null;
      if (img) {
        try {
          var k = CRISP ? 6 : 4, ps = CRISP && p ? new Float32Array(N * 6) : null, c = document.createElement('canvas'); c.width = cols * k; c.height = rows * k;
          var a = c.getContext('2d', { willReadFrequently: true }); a.imageSmoothingQuality = 'high';
          var bx = cropOf(img, p);
          a.drawImage(img, bx[0], bx[1], bx[2], bx[3], 0, 0, c.width, c.height);
          var d = a.getImageData(0, 0, c.width, c.height).data;
          for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
            var r = 0, gg = 0, b = 0, bl = [0, 0, 0, 0, 0, 0];
            for (var y = 0; y < k; y++) for (var x = 0; x < k; x++) {
              var o = ((j * k + y) * c.width + i * k + x) * 4; r += d[o]; gg += d[o + 1]; b += d[o + 2];
              if (ps) bl[((x * 2 / k) | 0) + 2 * ((y * 3 / k) | 0)] += d[o] * .3 + d[o + 1] * .59 + d[o + 2] * .11;
            }
            var q = (j * cols + i) * 3, kk = k * k; out[q] = r / kk; out[q + 1] = gg / kk; out[q + 2] = b / kk;
            if (ps) { var la = (r * .3 + gg * .59 + b * .11) / kk; for (var m = 0; m < 6; m++) ps[(j * cols + i) * 6 + m] = bl[m] / (kk / 6) - la; }
          }
          if (ps) { stretch(out, ps); p.sub = ps; }
          return out;
        } catch (e) { /* fall through to the game's own color */ }
      }
      // No readable picture: a soft field of the game's color, darker toward the edges.
      var base = parseColor(g.color);
      for (var jj = 0; jj < rows; jj++) for (var ii = 0; ii < cols; ii++) {
        var dx = ii / cols - .5, dy = jj / rows - .5, f = Math.max(.15, .8 - Math.hypot(dx * 1.2, dy * 1.6) * 1.4);
        var qq = (jj * cols + ii) * 3; out[qq] = base[0] * f; out[qq + 1] = base[1] * f; out[qq + 2] = base[2] * f;
      }
      return out;
    }
    // Crisp: a dark or flat picture is opened up a little (its darks and lights pulled apart, its color lifted), so it
    // reads from across a room. The veil in dress() still holds a bright one down for OLED screens.
    function stretch(T, ps) {
      var N = T.length / 3, L = new Float32Array(N), q;
      for (q = 0; q < N; q++) L[q] = T[q * 3] * .3 + T[q * 3 + 1] * .59 + T[q * 3 + 2] * .11;
      var srt = Array.prototype.slice.call(L).sort(function (a, b) { return a - b; });
      var lo = srt[(N * 0.04) | 0], hi = srt[(N * 0.96) | 0];
      if (hi - lo < 12) return;
      var gain = Math.min(1.9, 200 / (hi - lo));
      for (q = 0; q < N; q++) {
        var l = L[q], nlum = Math.max(2, l + ((10 + (l - lo) * gain) - l) * 0.65), sc = nlum / Math.max(1, l);
        for (var c = 0; c < 3; c++) { var v = T[q * 3 + c] * sc; T[q * 3 + c] = Math.max(0, Math.min(255, nlum + (v - nlum) * 1.15)); }
        for (var m = 0; m < 6; m++) ps[q * 6 + m] *= sc;
      }
    }
    function assign(p) {
      // Each cell takes the cover closest in color; a cover may repeat but never beside itself, and heavy use costs.
      var N = cols * rows, tiles = new Int16Array(N), use = new Float32Array(P), T = p.targets;
      var order = ctx.R.shuffle(Array.from({ length: N }, function (v, i) { return i; }));
      var spread = Math.max(1, N / P);
      tiles.fill(-1);
      order.forEach(function (q) {
        var i = q % cols, j = (q / cols) | 0, r = T[q * 3], gg = T[q * 3 + 1], b = T[q * 3 + 2], nb = {};
        // Crisp: no repeat within two tiles, heavy use costs more (the color is corrected anyway, so variety wins), and
        // a cover whose own light and dark fit the patch is preferred.
        var rad = CRISP && P > 30 ? 2 : 1, uw = CRISP ? 2600 : 900, S = CRISP ? p.sub : null;
        for (var a = -rad; a <= rad; a++) for (var c = -rad; c <= rad; c++) {
          var ii = i + a, jj = j + c; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
          var v = tiles[jj * cols + ii]; if (v >= 0) nb[v] = 1;
        }
        var best = 0, bs = Infinity;
        for (var k = 0; k < P; k++) {
          var dr = avg[k * 3] - r, dg = avg[k * 3 + 1] - gg, db = avg[k * 3 + 2] - b;
          var s = dr * dr * .3 + dg * dg * .59 + db * db * .11 + (nb[k] && P > 9 ? 1e6 : 0) + Math.max(0, use[k] - spread) * uw;
          if (S) { var e = 0; for (var m = 0; m < 6; m++) { var dv = sub[k * 6 + m] - S[q * 6 + m]; e += dv * dv; } s += e * 0.22; }
          if (s < bs) { bs = s; best = k; }
        }
        tiles[q] = best; use[best]++;
      });
      // The featured game's own cover sits at the focal cell, where the camera will arrive.
      var fi = palIdx[p.game.appid];
      if (fi != null) tiles[p.focal] = fi;
      p.tiles = tiles;
    }
    function focalCell() {
      // Somewhere in the middle band, clear of the clock's corner and with room for the caption to the right.
      var i = Math.round(cols * ctx.R.range(0.36, 0.56)), j = Math.round(rows * ctx.R.range(0.34, 0.6));
      return j * cols + i;
    }
    function dress(p) {
      // A bright picture is held down so no big light area sits on an OLED screen.
      var L = 0, T = p.targets; for (var q = 0; q < T.length; q += 3) L += T[q] * .3 + T[q + 1] * .59 + T[q + 2] * .11;
      L /= T.length / 3; p.veil = 0.14 + Math.max(0, L - 95) / 255 * 0.7;
      p.tintCv = document.createElement('canvas'); p.tintCv.width = cols; p.tintCv.height = rows;
      var tg = p.tintCv.getContext('2d'), id = tg.createImageData(cols, rows);
      for (var q2 = 0; q2 < cols * rows; q2++) { id.data[q2 * 4] = T[q2 * 3]; id.data[q2 * 4 + 1] = T[q2 * 3 + 1]; id.data[q2 * 4 + 2] = T[q2 * 3 + 2]; id.data[q2 * 4 + 3] = 255; }
      tg.putImageData(id, 0, 0);
    }
    function prepare() {
      var g = pickFeatured();
      return ctx.loadImage(heroOf(g)).then(function (img) {
        var p = { game: g, img: img, focal: focalCell(), full: null, cv: null };
        p.targets = targetsFor(img, g, p);
        dress(p);
        assign(p);
        if (CRISP) renderPic(p);
        return ctx.loadImage(g.art('cover')).then(function (full) { p.full = full; return p; });
      });
    }

    // ---------------------------------------------------------------- the cycle
    var nextPic = null, preparing = false, cycleAt = -1, tNow = 0, ready = false;
    function startCycle(p, t) {
      if (prevPic && prevPic !== p && prevPic !== pic && prevPic.cv) { spareCv = prevPic.cv; prevPic.cv = null; }
      prevPic = pic; pic = p; cycleAt = t; nextPic = null; preparing = false; nth++;
      var N = cols * rows;
      if (!cells || cells.length !== N) cells = new Array(N);
      // The turn sweeps across the picture from the side the camera came from, with a little scatter.
      var fx = (p.focal % cols) / cols, dir = fx > 0.5 ? -1 : 1;
      for (var q = 0; q < N; q++) {
        var i = q % cols, j = (q / cols) | 0, x = dir > 0 ? i / cols : 1 - i / cols;
        var prev = cells[q] ? cells[q][1] : -1;
        cells[q] = [prev, p.tiles[q], 0.3 + (x * 0.8 + (j / rows) * 0.2) * 3 + ctx.R() * 0.7];
      }
      flipEnd = 0; for (var q3 = 0; q3 < N; q3++) flipEnd = Math.max(flipEnd, cells[q3][2] + 0.75);
      cap.classList.remove('on'); capSide = 0; capW = 0;
      setCaption(p.game);
      // The wall's pool, sized from the focal cover at full zoom: clear over it, its color spilling, then the dark.
      var R = Math.max(TH * ZMAX * 8, Math.hypot(W, H) * 1.05), k = TH * ZMAX / R;
      pool.style.width = pool.style.height = 2 * R + 'px';
      pool.style.margin = -R + 'px 0 0 ' + -R + 'px';
      pool.style.background = poolBg(p.game.color, k);
      ctx.artColor(p.game, 'cover').then(function (c) { if (pic === p) pool.style.background = poolBg(c, k); });
    }
    function clockBox() { return clockUi ? clockUi.rect() : null; }
    // The wall's caption placement: beside the cover (the roomier side, never over the clock); with no room either side,
    // above it, kept on screen.
    function placeCap(rl, rr, rt, rb) {
      var m = 52 * ctx.u, hgt = cap.offsetHeight;
      if (!capW) capW = cap.offsetWidth;
      if (!capSide) {
        var cb = clockBox(), roomR = W - rr - m, roomL = rl - m;
        capSide = roomR >= capW || roomR >= roomL ? 1 : -1;
        if (capSide === -1 && cb && rl - m - capW < cb.r && rb > cb.t) capSide = 1;
        cap.classList.toggle('right', capSide === -1);
      }
      var x = capSide === 1 ? rr + m : rl - m - capW;
      var y = rb - hgt - (rb - rt) * 0.06;
      if (x + capW > W - m * .5 || x < m * .5) {
        x = Math.min(Math.max(m, (rl + rr) / 2 - capW / 2), W - m - capW);
        y = rt - hgt - m * .6;
        if (y < m) y = rb + m * .6;
      }
      y = Math.max(m * .5, Math.min(H - hgt - m * .5, y));
      cap.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    }
    function setCaption(g) {
      capName.textContent = g.name;
      capName.className = 'bl-mosaic-cname bl-cap-name' + (g.name.length > 30 ? ' longer' : g.name.length > 18 ? ' long' : '');
      var rk = rankOf[g.appid];
      capHead._note.textContent = rk ? 'No.' + ctx.pad(rk, 3) + ' OF ' + n : '';
      var bits = [];
      if (g.playtime && +ctx.hours(g.playtime) > 0) bits.push(ctx.hours(g.playtime) + ' ' + (ctx.hours(g.playtime) === 1 ? 'HOUR' : 'HOURS'));
      if (g.lastPlayed) bits.push('LAST PLAYED ' + since(g.lastPlayed));
      if (!bits.length) bits.push('IN YOUR LIBRARY');
      capLine.textContent = bits.join(', ');
      capAch.innerHTML = '';
      if (ctx.achieve) ctx.achieve(capAch, g, { sizeU: 22, barU: 160 }); // the wall's: small, under the hours
      else {
        var ac = g.achievements;
        if (ac && ac.total > 0) {
          var u = Math.min(ac.unlocked || 0, ac.total), row = el('div', 'bl-mosaic-achrow bl-h-mono', capAch);
          if (u >= ac.total) { el('span', 'bl-mosaic-done', row); el('span', null, row, 'ALL ' + ac.total + ' ACHIEVEMENTS'); }
          else { el('span', null, row, u + ' / ' + ac.total + ' ACHIEVEMENTS'); var bar = el('span', 'bl-mosaic-bar', row); el('i', null, bar).style.width = (u / ac.total * 100).toFixed(1) + '%'; }
        }
      }
    }
    function pct(x) { return (x * 100).toFixed(2) + '%'; }
    function poolBg(c, k) {
      var tint = c.replace(/^rgb\(/, 'rgba(').replace(/\)$/, ',.2)').replace(/^hsl\((.*)\)$/, 'hsla($1,.2)');
      return 'radial-gradient(circle closest-side,rgba(0,0,0,0) 0,rgba(0,0,0,0) ' + pct(k * .78) + ',' + tint + ' ' + pct(k * 1.05) + ',rgba(4,5,6,.58) ' + pct(k * 1.45) + ',rgba(4,5,6,.8) ' + pct(k * 2.3) + ',rgba(4,5,6,.86) 100%)';
    }
    function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function ease2(x) { x = Math.max(0, Math.min(1, x)); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    // Zoom through one cycle (fractions of CYCLE): finish the pull-out, hold far, push in, hold close, pull out.
    // ?mosaic-zoom=log, for recordings: the push-in and pull-out move by equal steps of magnification, so
    // the camera travels at an even pace instead of surging at the wide end and crawling at the close end.
    var LOGZ = ctx.params.get('mosaic-zoom') === 'log';
    function mix(a, b, e) { return LOGZ ? Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * e) : a + (b - a) * e; }
    function zoomAt(f) {
      var zOut = 1.12, zIn = ZMAX;
      if (quickNow()) return zOut;
      if (f < 0.06) return zOut + (1 - zOut) * ease(f / 0.06);
      if (f < 0.33) return 1 + 0.04 * (f - 0.06) / 0.27;
      if (f < 0.64) return mix(1.04, zIn, ease2((f - 0.33) / 0.31));
      if (f < 0.83) return zIn * (1 + 0.05 * (f - 0.64) / 0.19);
      return mix(zIn * 1.05, zOut, ease2((f - 0.83) / 0.17));
    }
    function cellCenter(q) { return [MX + (q % cols + .5) * TW, MY + (((q / cols) | 0) + .5) * TH]; }

    var capSide = 0, capW = 0;
    function draw(t) {
      var f = (t - cycleAt) / cycleLen(), z = zoomAt(f);
      // The camera's aim: the screen centre when far, the focal cover when close, sliding from the last one at the start.
      var fc = cellCenter(pic.focal), pc = prevPic ? cellCenter(prevPic.focal) : fc, s = ease(f / 0.06);
      var ax = pc[0] + (fc[0] - pc[0]) * s, ay = pc[1] + (fc[1] - pc[1]) * s;
      var w = Math.max(0, Math.min(1, (z - 1) / (ZMAX - 1)));
      w = w * w * (3 - 2 * w);
      var drift = (1 - w) * TW * 0.9;
      var cx = W / 2 + (ax - W / 2) * w + Math.sin(t / 23) * drift, cy = H / 2 + (ay - H / 2) * w + Math.sin(t / 31 + 1) * drift * 0.6;
      var k = z * dpr;
      g2.setTransform(1, 0, 0, 1, 0, 0);
      g2.fillStyle = '#060708'; g2.fillRect(0, 0, cv.width, cv.height);
      g2.setTransform(k, 0, 0, k, dpr * (W / 2 - cx * z), dpr * (H / 2 - cy * z));
      g2.imageSmoothingEnabled = true;
      // Visible cells only.
      var vx0 = cx - W / 2 / z, vx1 = cx + W / 2 / z, vy0 = cy - H / 2 / z, vy1 = cy + H / 2 / z;
      var i0 = Math.max(0, Math.floor((vx0 - MX) / TW)), i1 = Math.min(cols - 1, Math.floor((vx1 - MX) / TW));
      var j0 = Math.max(0, Math.floor((vy0 - MY) / TH)), j1 = Math.min(rows - 1, Math.floor((vy1 - MY) / TH));
      var tc = t - cycleAt, gw = TW - GAP, gh = TH - GAP, T = pic.targets, PT = prevPic ? prevPic.targets : T;
      // How strongly each tile wears its patch of the picture: strong far away, a whisper up close.
      var tint = 0.5 * (1 - w) + 0.04;
      if (CRISP) drawCrisp(tc, w, i0, i1, j0, j1, gw, gh);
      else if (tc < flipEnd || !cacheFor(pic)) {
        // While the tiles turn: each one drawn, with its own patch of color.
        for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
          var q = j * cols + i, c = cells[q], p = Math.max(0, Math.min(1, (tc - c[2]) / 0.7)), tl = p < .5 ? c[0] : c[1];
          if (tl < 0) continue;
          var sx = Math.abs(Math.cos(p * Math.PI)), x = MX + i * TW + GAP / 2, y = MY + j * TH + GAP / 2;
          var dw = gw * sx, ox = x + (gw - dw) / 2;
          if (dw < 0.5) continue;
          g2.drawImage(atlas, (tl % ACOLS) * AW, ((tl / ACOLS) | 0) * AH, AW, AH, ox, y, dw, gh);
          var A = p < .5 ? PT : T;
          g2.fillStyle = 'rgba(' + (A[q * 3] | 0) + ',' + (A[q * 3 + 1] | 0) + ',' + (A[q * 3 + 2] | 0) + ',' + tint.toFixed(3) + ')';
          g2.fillRect(ox, y, dw, gh);
        }
      } else {
        // Settled: the whole mosaic is one cached image while far; close in, only the few visible tiles are drawn.
        if (k <= CS * 1.2) g2.drawImage(cache, MX, MY, cols * TW, rows * TH);
        else for (var j2 = j0; j2 <= j1; j2++) for (var i2 = i0; i2 <= i1; i2++) {
          var tl2 = pic.tiles[j2 * cols + i2];
          g2.drawImage(atlas, (tl2 % ACOLS) * AW, ((tl2 / ACOLS) | 0) * AH, AW, AH, MX + i2 * TW + GAP / 2, MY + j2 * TH + GAP / 2, gw, gh);
        }
        if (pic.full && w > .3) g2.drawImage(pic.full, MX + (pic.focal % cols) * TW + GAP / 2, MY + ((pic.focal / cols) | 0) * TH + GAP / 2, gw, gh);
        // the picture's color, one pixel a tile, laid over the whole mosaic in one go
        g2.globalAlpha = tint; g2.imageSmoothingEnabled = false;
        g2.drawImage(pic.tintCv, MX, MY, cols * TW, rows * TH);
        g2.globalAlpha = 1; g2.imageSmoothingEnabled = true;
      }
      // The picture itself, laid over thinly so it reads from afar; it fades as the tiles become covers.
      var over = (CRISP ? OVER : 0.34) * (1 - w) * (1 - w);
      var turn = ease((tc - 0.3) / 3.6);
      if (over > 0.01) {
        if (prevPic && prevPic.img && turn < 1) heroOver(prevPic, over * (1 - turn));
        if (pic.img) heroOver(pic, over * turn);
      }
      // Hold the whole picture a little down (more for a bright one), easing between pictures.
      var veil = prevPic && turn < 1 ? prevPic.veil + (pic.veil - prevPic.veil) * turn : pic.veil;
      g2.fillStyle = 'rgba(6,7,8,' + veil.toFixed(3) + ')';
      g2.fillRect(MX, MY, cols * TW, rows * TH);
      // The featured cover's thin accent edge when the camera arrives.
      if (w > .5) {
        var th = ctx.theme, fx = MX + (pic.focal % cols) * TW + GAP / 2, fy = MY + ((pic.focal / cols) | 0) * TH + GAP / 2;
        g2.globalAlpha = (w - .5) * 2 * 0.8;
        g2.strokeStyle = th ? th.rgba(0.85) : 'rgba(242,165,22,.85)';
        g2.lineWidth = Math.max(1, 2 * ctx.u) / z;
        g2.strokeRect(fx, fy, gw, gh);
        g2.globalAlpha = 1;
      }
      // The caption and the pool follow the focal cover, as on the wall.
      var fsx = W / 2 + (fc[0] - cx) * z, fsy = H / 2 + (fc[1] - cy) * z, hw = gw * z / 2, hh = gh * z / 2;
      pool.style.opacity = w.toFixed(3);
      pool.style.transform = 'translate(' + fsx.toFixed(1) + 'px,' + fsy.toFixed(1) + 'px)';
      if (f > 0.5 && f < 0.85 && w > 0.6) {
        placeCap(fsx - hw, fsx + hw, fsy - hh, fsy + hh);
        cap.classList.add('on');
      } else if (cap.classList.contains('on')) cap.classList.remove('on'); // it fades where it stands
    }
    // Crisp: every picture has its own image of the whole mosaic with each cover color-corrected to its patch (multiply
    // where the patch is darker than the cover, screen where it is lighter, so the cover keeps its detail and its
    // average lands on the picture's color). Far away that image is the frame; as the camera pushes in it fades off
    // the plain covers underneath. While the tiles turn, each flap is cut from the old picture's image or the new one's.
    var spareCv = null, PS = 1;
    function renderPic(p) {
      var mw = cols * TW, mh = rows * TH;
      PS = Math.min(1.5, 2800 / mw, 2800 / mh);
      var c = p.cv || spareCv || document.createElement('canvas');
      if (c === spareCv) spareCv = null;
      var cw = Math.round(mw * PS), ch = Math.round(mh * PS);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      var a = c.getContext('2d'), T = p.targets, gw = TW - GAP, gh = TH - GAP, K = KCOR;
      a.globalCompositeOperation = 'source-over';
      a.setTransform(1, 0, 0, 1, 0, 0); a.fillStyle = '#060708'; a.fillRect(0, 0, cw, ch);
      a.setTransform(PS, 0, 0, PS, 0, 0); a.imageSmoothingQuality = 'high';
      for (var q = 0; q < cols * rows; q++) {
        var tl = p.tiles[q], x = (q % cols) * TW + GAP / 2, y = ((q / cols) | 0) * TH + GAP / 2;
        a.globalCompositeOperation = 'source-over';
        a.drawImage(atlas, (tl % ACOLS) * AW, ((tl / ACOLS) | 0) * AH, AW, AH, x, y, gw, gh);
        var mu = [255, 255, 255], sc = [0, 0, 0], dm = false, ds = false;
        for (var ch2 = 0; ch2 < 3; ch2++) {
          var av = Math.max(1, Math.min(254, avg[tl * 3 + ch2])), tv = av + (T[q * 3 + ch2] - av) * K;
          if (tv < av - 1) { mu[ch2] = Math.round(255 * tv / av); dm = true; }
          else if (tv > av + 1) { sc[ch2] = Math.round(255 * (tv - av) / (255 - av)); ds = true; }
        }
        if (dm) { a.globalCompositeOperation = 'multiply'; a.fillStyle = 'rgb(' + mu.join(',') + ')'; a.fillRect(x, y, gw, gh); }
        if (ds) { a.globalCompositeOperation = 'screen'; a.fillStyle = 'rgb(' + sc.join(',') + ')'; a.fillRect(x, y, gw, gh); }
        // then the cover's own contrast is held back a little, so the picture carries from afar
        if (FLAT > 0) { a.globalCompositeOperation = 'source-over'; a.fillStyle = 'rgba(' + (T[q * 3] | 0) + ',' + (T[q * 3 + 1] | 0) + ',' + (T[q * 3 + 2] | 0) + ',' + FLAT + ')'; a.fillRect(x, y, gw, gh); }
      }
      a.globalCompositeOperation = 'source-over';
      p.cv = c;
    }
    function drawCrisp(tc, w, i0, i1, j0, j1, gw, gh) {
      var i, j, q;
      if (tc < flipEnd) {
        for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
          q = j * cols + i;
          var c = cells[q], p = Math.max(0, Math.min(1, (tc - c[2]) / 0.7)), src = p < .5 ? (c[0] < 0 || !prevPic ? null : prevPic.cv) : pic.cv;
          if (!src) continue;
          var sx = Math.abs(Math.cos(p * Math.PI)), dw = gw * sx;
          if (dw < 0.5) continue;
          g2.drawImage(src, (i * TW + GAP / 2) * PS, (j * TH + GAP / 2) * PS, gw * PS, gh * PS, MX + i * TW + GAP / 2 + (gw - dw) / 2, MY + j * TH + GAP / 2, dw, gh);
        }
        return;
      }
      var corr = Math.pow(1 - w, 1.3);
      if (corr < 0.985) {
        for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
          var tl = pic.tiles[j * cols + i];
          g2.drawImage(atlas, (tl % ACOLS) * AW, ((tl / ACOLS) | 0) * AH, AW, AH, MX + i * TW + GAP / 2, MY + j * TH + GAP / 2, gw, gh);
        }
        if (pic.full && w > .3) g2.drawImage(pic.full, MX + (pic.focal % cols) * TW + GAP / 2, MY + ((pic.focal / cols) | 0) * TH + GAP / 2, gw, gh);
      }
      if (corr > 0.01 && pic.cv) { g2.globalAlpha = Math.min(1, corr); g2.drawImage(pic.cv, MX, MY, cols * TW, rows * TH); g2.globalAlpha = 1; }
    }
    // The settled mosaic, drawn once per picture at up to 1.5x, so a far frame is a single drawImage.
    var cache = null, cachePic = null, CS = 1, flipEnd = 0;
    function cacheFor(p) {
      if (cachePic === p) return true;
      var mw = cols * TW, mh = rows * TH;
      CS = Math.min(1.5, 3600 / mw, 3600 / mh);
      if (!cache) cache = document.createElement('canvas');
      var cw = Math.round(mw * CS), ch = Math.round(mh * CS);
      if (cache.width !== cw || cache.height !== ch) { cache.width = cw; cache.height = ch; }
      var a = cache.getContext('2d');
      a.setTransform(1, 0, 0, 1, 0, 0); a.fillStyle = '#060708'; a.fillRect(0, 0, cw, ch);
      a.setTransform(CS, 0, 0, CS, 0, 0); a.imageSmoothingQuality = 'high';
      var gw = TW - GAP, gh = TH - GAP;
      for (var q = 0; q < cols * rows; q++) {
        var tl = p.tiles[q];
        a.drawImage(atlas, (tl % ACOLS) * AW, ((tl / ACOLS) | 0) * AH, AW, AH, (q % cols) * TW + GAP / 2, ((q / cols) | 0) * TH + GAP / 2, gw, gh);
      }
      cachePic = p;
      return true;
    }
    function heroOver(p, a) {
      var mw = cols * TW, mh = rows * TH, bx = cropOf(p.img, p);
      g2.globalAlpha = a;
      g2.drawImage(p.img, bx[0], bx[1], bx[2], bx[3], MX, MY, mw, mh);
      g2.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- start
    layout();
    var fontsReady = document.fonts && document.fonts.load ? document.fonts.load('700 40px "Barlow Condensed"').catch(function () {}) : Promise.resolve();
    fontsReady.then(function () {
      if (dead) return;
      var ah = Math.min(240, Math.ceil(TH * ZMAX * 0.8)), aw = Math.round(ah / 1.5);
      return buildAtlas(aw, ah);
    }).then(function () {
      if (dead) return;
      return prepare().then(function (p) {
        if (dead) return;
        startCycle(p, tNow); ready = true; cv.classList.add('on');
      });
    });

    function tick(t) {
      tNow = t;
      if (clockUi) clockUi.tick(t); // the time when the minute turns, and the slow wander
      if (!ready) return;
      var f = (t - cycleAt) / cycleLen();
      if (f > (quickNow() ? 0.1 : CRISP ? 0.68 : 0.4) && !nextPic && !preparing) { preparing = true; prepare().then(function (p) { if (!dead) nextPic = p; }); }
      if (f >= 1) {
        if (nextPic) startCycle(nextPic, cycleAt + cycleLen());
        else cycleAt = t - cycleLen() * 0.999; // still loading: hold at the end of the pull-out
      }
      draw(t);
    }
    return {
      frame: tick,
      resize: function () {
        if (!ready) { layout(); return; }
        var oc = cols, orr = rows;
        layout();
        if (cols !== oc || rows !== orr) {
          // A new grid: re-read the current picture into it and show it whole, no turn.
          pic.focal = focalCell(); pic.targets = targetsFor(pic.img, pic.game, pic); dress(pic); assign(pic); cachePic = null;
          if (CRISP) renderPic(pic);
          if (prevPic && prevPic !== pic && prevPic.cv) { prevPic.cv.width = prevPic.cv.height = 0; prevPic.cv = null; }
          prevPic = null; cells = null; startCycle(pic, tNow - 6); prevPic = null;
          nextPic = null; preparing = false;
        }
        capW = 0; capSide = 0;
      },
      unmount: function () { dead = true; atlas = null; if (cache) cache.width = cache.height = 0; cache = null; cells = null; [pic, prevPic, nextPic].forEach(function (p) { if (p && p.cv) p.cv.width = p.cv.height = 0; }); if (spareCv) spareCv.width = spareCv.height = 0; spareCv = null; pic = prevPic = nextPic = null; cv.width = cv.height = 0; }
    };
  }
});
