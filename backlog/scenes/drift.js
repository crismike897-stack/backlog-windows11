/* Drift: the library as an endless wall of covers on a tilted plane. The camera drifts; every so often it slows
   and one cover lifts off the wall toward you, its light spilling on the neighbours, with its name and hours beside
   it, set like a title card. The clock sits in the dark corner. A faint haze of the theme's color
   hangs over the far edge.
   Plain DOM with CSS 3D: the camera is one transform per frame, a tile is touched only when it wraps round.
   Options (config.sceneOptions.drift): clock (true), spotlight (seconds between lifts, 16; 0 = never),
   speed (1), focus (true: the tilt-shift blur at the far edge; false saves GPU on very slow machines). */
BACKLOG.scene({
  id: 'drift', name: 'Drift', overlay: 'none',
  mount: function (root, ctx) {
    var opt = ctx.options('drift');
    var showClock = opt.clock !== false && ctx.clockShown();
    var every = opt.spotlight == null ? 16 : +opt.spotlight;
    var speed = opt.speed == null ? 1 : +opt.speed;
    var games = ctx.games, n = games.length;
    var store = ctx.store || function () { return null; };
    // Past two years, months read oddly ("86 MONTHS AGO"); say years.
    function since(sec) { var d = (ctx.nowMs() / 1000 - sec) / 86400; return d >= 730 ? Math.floor(d / 365.25) + ' YEARS AGO' : d >= 365 ? 'A YEAR AGO' : ctx.ago(sec); }

    ctx.css('bl-drift-css', [
      '.bl-drift{background:#060708}',
      '.bl-drift-persp{position:absolute;inset:0;overflow:hidden}',
      '.bl-drift-plane,.bl-drift-cam{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}',
      '.bl-drift-cam{left:0;top:0;will-change:transform}',
      '.bl-drift-tile{position:absolute;left:0;top:0;border-radius:calc(7*var(--u));overflow:hidden;background:#15171b;backface-visibility:hidden}',
      '.bl-drift-tile img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 1.2s ease}',
      '.bl-drift-tile img.on{opacity:1}',
      '.bl-drift-tile.lift{transition:transform 1.8s cubic-bezier(.22,.8,.25,1);z-index:2}',
      '.bl-drift-tile::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(var(--bl-accent-rgb),.1)}',
      '.bl-drift-name{position:absolute;inset:0;display:flex;align-items:flex-end;padding:12% 10%;font:700 calc(34*var(--u))/1 "Barlow Condensed",sans-serif;letter-spacing:.02em;text-transform:uppercase;color:var(--bl-accent)}',
      /* The camera's darkness: a big soft hole that follows the lifted cover, so the rest of the wall falls back. */
      '.bl-drift-pool{position:absolute;left:0;top:0;border-radius:50%;opacity:0;transition:opacity 2.2s ease;pointer-events:none}',
      '.bl-drift-pool.on{opacity:1}',
      /* Depth of field: the far edge of the wall goes soft and falls into the dark. */
      '.bl-drift-far{position:absolute;left:0;right:0;top:0;height:42%;pointer-events:none;',
      '-webkit-mask-image:linear-gradient(#000 0,rgba(0,0,0,.85) 30%,rgba(0,0,0,.4) 62%,transparent 100%);mask-image:linear-gradient(#000 0,rgba(0,0,0,.85) 30%,rgba(0,0,0,.4) 62%,transparent 100%)}',
      '.bl-drift-far.blur{-webkit-backdrop-filter:blur(calc(5*var(--u)));backdrop-filter:blur(calc(5*var(--u)))}',
      '.bl-drift-fog{position:absolute;inset:0;pointer-events:none;background:',
      'linear-gradient(180deg,rgba(6,7,8,.94) 0,rgba(6,7,8,.72) 12%,rgba(6,7,8,.36) 28%,rgba(6,7,8,.12) 42%,rgba(6,7,8,0) 55%,rgba(6,7,8,0) 72%,rgba(6,7,8,.3) 88%,rgba(6,7,8,.62) 100%),',
      'radial-gradient(ellipse 75% 85% at 52% 52%,rgba(0,0,0,0) 40%,rgba(0,0,0,.18) 62%,rgba(0,0,0,.5) 86%,rgba(0,0,0,.7) 100%)}',
      /* The theme's haze: a breath of the accent where the wall falls into the dark, nothing over the covers you look at. */
      '.bl-drift-haze{position:absolute;inset:0;pointer-events:none;background:',
      'radial-gradient(ellipse 85% 46% at 58% 0%,rgba(var(--bl-accent-rgb),.13),rgba(var(--bl-accent-rgb),.04) 60%,rgba(var(--bl-accent-rgb),0) 100%),',
      'linear-gradient(0deg,rgba(var(--bl-accent-rgb),.06),rgba(var(--bl-accent-rgb),0) 22%)}',
      /* The lifted cover's card. */
      '.bl-drift-cap{position:absolute;left:0;top:0;width:max-content;max-width:calc(760*var(--u));opacity:0;transition:opacity 1.2s ease;pointer-events:none;will-change:transform}',
      '.bl-drift-cap.on{opacity:1}',
      '.bl-drift-cap::before{content:"";position:absolute;inset:-40% -18%;z-index:-1;background:radial-gradient(closest-side,rgba(4,5,6,.95),rgba(4,5,6,.84) 50%,rgba(4,5,6,.5) 75%,rgba(4,5,6,0))}',
      '.bl-drift-cap.right{text-align:right}',
      '.bl-drift-cap.right .bl-h-head{justify-content:flex-end}',
      /* the title card in small: head, a rule, the name in big type, a rule, the subtitle line. The rules draw in. */
      '.bl-drift-cap .bl-h-rule{transform-origin:0 50%;transform:scaleX(0);transition:transform 1.1s cubic-bezier(.2,.8,.2,1) .2s}',
      '.bl-drift-cap .bl-h-rule.b{transition-delay:.34s}',
      '.bl-drift-cap.right .bl-h-rule{transform-origin:100% 50%}',
      '.bl-drift-cap.on .bl-h-rule{transform:none}',
      '.bl-drift-cap .bl-h-head{margin-bottom:calc(12*var(--u))}',
      '.bl-drift-cname{padding:calc(10*var(--u)) 0 calc(10*var(--u));font-size:calc(66*var(--u))}',
      '.bl-drift-cname.long{font-size:calc(52*var(--u))}.bl-drift-cname.longer{font-size:calc(42*var(--u))}',
      '.bl-drift-cline{white-space:nowrap;margin-top:calc(14*var(--u));font-size:calc(31*var(--u))}',
      '.bl-drift-ach{margin-top:calc(14*var(--u))}.bl-drift-ach:empty{display:none}',
      '.bl-drift-cap.right .bl-h-ach{justify-content:flex-end}'
    ].join(''));
    root.classList.add('bl-drift');

    var el = ctx.el;
    var persp = el('div', 'bl-drift-persp', root);
    var plane = el('div', 'bl-drift-plane', persp);
    var cam = el('div', 'bl-drift-cam', plane);
    var pool = el('div', 'bl-drift-pool', root);
    var far = el('div', 'bl-drift-far' + (opt.focus === false ? '' : ' blur'), root);
    el('div', 'bl-drift-fog', root);
    el('div', 'bl-drift-haze', root);
    var cap = el('div', 'bl-drift-cap bl-cap', root);
    var capHead = ctx.head(cap, 'IN THE SPOTLIGHT', '', 22);
    el('div', 'bl-h-rule', cap);
    var capName = el('div', 'bl-drift-cname bl-cap-name', cap);
    el('div', 'bl-h-rule b', cap);
    var capLine = el('div', 'bl-drift-cline bl-cap-line', cap);
    var capAch = el('div', 'bl-drift-ach', cap); // small: achievements, under the hours
    // The clock corner is core's (ctx.clockCorner).
    var clockUi = showClock ? ctx.clockCorner({ parent: root, title: 'DRIFT // ' + n + (n === 1 ? ' TITLE' : ' TITLES') }) : null;
    void far;

    // ---------------------------------------------------------------- choosing covers
    // Least-recently-used, never twice on screen while the library allows it, never beside itself.
    // The last run's covers are remembered, so a new launch opens on ones you haven't just seen.
    var shown = new Array(n).fill(0), used = new Array(n).fill(0), stamp = 0;
    var order = ctx.R.shuffle(games.map(function (g, i) { return i; }));
    order.forEach(function (gi, q) { used[gi] = q - 1e7; });
    var seen = store('drift-seen') || [];
    var idIndex = {}; games.forEach(function (g, i) { idIndex[String(g.appid)] = i; });
    seen.forEach(function (id, p) { var gi = idIndex[String(id)]; if (gi != null) used[gi] = -1 - p; });
    var log = [];
    var cells = {};
    function key(i, j) { return i + ',' + j; }
    function choose(i, j) {
      var nb = {};
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) { var v = cells[key(i + a, j + b)]; if (v != null) nb[v] = 1; }
      var best = 0, bs = Infinity;
      for (var k = 0; k < n; k++) {
        var s = shown[k] * 1e9 + (nb[k] ? 1e8 : 0) + used[k];
        if (s < bs) { bs = s; best = k; }
      }
      used[best] = ++stamp; shown[best]++;
      log.unshift(String(games[best].appid)); if (log.length > 240) log.length = 240;
      return best;
    }

    // ---------------------------------------------------------------- geometry
    var AX = 31 * Math.PI / 180, AZ = -8 * Math.PI / 180;
    var TW, TH, PX, PY, P, bx0, bx1, by0, by1, cols = 0, rows = 0, tiles = [];
    function toPlane(sx, sy) {
      // Undo the perspective and the two rotations: where a screen point (from the centre) lands on the wall.
      var sa = Math.sin(AX), ca = Math.cos(AX);
      var yy = sy * P / (P * ca + sy * sa);
      var xx = sx * (P - yy * sa) / P;
      var cz = Math.cos(AZ), sz = Math.sin(AZ);
      return [xx * cz + yy * sz, -xx * sz + yy * cz];
    }
    function layout() {
      var W = ctx.w, H = ctx.h, u = ctx.u;
      // Bigger covers on wide screens keep the count (and the decoded images) down.
      TW = Math.round(Math.max(196 * u, W / 11.5)); TH = Math.round(TW * 1.5);
      var gap = Math.round(TW * 0.1);
      PX = TW + gap; PY = TH + gap;
      P = Math.max(H * 1.3, W * 0.7);
      persp.style.perspective = P + 'px';
      plane.style.transform = 'rotateX(' + AX + 'rad) rotateZ(' + AZ + 'rad)';
      var pts = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2], [0, -H / 2], [0, H / 2]];
      bx0 = by0 = Infinity; bx1 = by1 = -Infinity;
      pts.forEach(function (p) { var q = toPlane(p[0], p[1]); bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); });
      bx0 -= PX * 1.1; by0 -= PY * 1.1; bx1 += PX * 0.1; by1 += PY * 0.1;
      var c2 = Math.ceil((bx1 - bx0) / PX) + 1, r2 = Math.ceil((by1 - by0) / PY) + 1;
      if (c2 !== cols || r2 !== rows) build(c2, r2);
    }
    function build(c2, r2) {
      tiles.forEach(function (t) { t.el.remove(); });
      tiles = []; cells = {}; shown.fill(0);
      cols = c2; rows = r2;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var e = el('div', 'bl-drift-tile', cam);
        tiles.push({ el: e, c: c, r: r, i: null, j: null, g: -1, x: 0, y: 0 });
      }
    }
    function mod(a, m) { return ((a % m) + m) % m; }
    function setTile(t, i, j) {
      if (t.i != null) { delete cells[key(t.i, t.j)]; shown[t.g]--; }
      t.i = i; t.j = j;
      t.x = i * PX; t.y = j * PY + (mod(i, 2) ? PY * 0.5 : 0);
      t.el.style.width = TW + 'px'; t.el.style.height = TH + 'px';
      t.el.style.transform = 'translate3d(' + t.x + 'px,' + t.y + 'px,0)';
      var gi = choose(i, j); cells[key(i, j)] = gi; t.g = gi;
      paint(t.el, games[gi]);
    }
    function paint(box, g) {
      box.innerHTML = '';
      box.style.background = 'linear-gradient(160deg,hsl(' + g.hue + ',35%,18%),hsl(' + ((g.hue + 30) % 360) + ',40%,7%))';
      var url = g.art('cover');
      if (!url) { el('div', 'bl-drift-name', box, g.name); return; }
      var im = el('img', null, box);
      im.decoding = 'async'; im.alt = '';
      im.onload = function () { im.classList.add('on'); };
      im.onerror = function () { im.remove(); el('div', 'bl-drift-name', box, g.name); };
      im.src = url;
    }
    function place() {
      for (var k = 0; k < tiles.length; k++) {
        var t = tiles[k];
        var i0 = Math.floor((bx0 + camX) / PX), i = i0 + mod(t.c - i0, cols);
        var off = mod(i, 2) ? PY * 0.5 : 0;
        var j0 = Math.floor((by0 + camY - off) / PY), j = j0 + mod(t.r - j0, rows);
        if (i !== t.i || j !== t.j) { if (t === lifted) dropNow(); setTile(t, i, j); }
      }
    }

    // ---------------------------------------------------------------- the spotlight
    var lifted = null, liftAt = 0, nextLift = 7, slow = 1, capSide = 0, capW = 0;
    var rankOf = {}; ctx.top.forEach(function (g, i) { rankOf[g.appid] = i + 1; }); // the caption's "No." is its rank by hours
    var LIFT_HOLD = 9;
    function clockBox() { return clockUi ? clockUi.rect() : null; }
    function hit(a, b) { return b && a.left < b.r && a.right > b.l && a.top < b.b && a.bottom > b.t; }
    function lift(t) {
      var W = ctx.w, H = ctx.h, cb = clockBox(), pool2 = [];
      tiles.forEach(function (tl) {
        var r = tl.el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        if (cx < W * 0.26 || cx > W * 0.74 || cy < H * 0.46 || cy > H * 0.68) return;
        if (hit(r, cb)) return;
        pool2.push(tl);
      });
      if (!pool2.length) return;
      // The cover that has waited longest for its moment goes next.
      var lastLit = store('drift-lit') || {};
      pool2.sort(function (a, b) { return (lastLit[games[a.g].appid] || 0) - (lastLit[games[b.g].appid] || 0) || (ctx.R() - .5); });
      t = pool2[0];
      // With config.featured, only those games lift: the longest-waiting one, on a cover already showing it if one is
      // in reach, else on the chosen cover, repainted.
      var fe = ctx.featured || [];
      if (fe.length) {
        var fg = fe.slice().sort(function (a, b) { return (lastLit[a.appid] || 0) - (lastLit[b.appid] || 0); })[0];
        var there = pool2.filter(function (tl) { return games[tl.g] === fg; })[0];
        if (there) t = there;
        else {
          var gi = games.indexOf(fg);
          shown[t.g]--; shown[gi]++; t.g = gi; cells[key(t.i, t.j)] = gi;
          paint(t.el, fg);
        }
      }
      lastLit[games[t.g].appid] = ctx.nowMs();
      var ids = Object.keys(lastLit); if (ids.length > 400) ids.sort(function (a, b) { return lastLit[a] - lastLit[b]; }).slice(0, ids.length - 400).forEach(function (id) { delete lastLit[id]; });
      store('drift-lit', lastLit);
      lifted = t; liftAt = tNow;
      var g = games[t.g];
      t.el.classList.add('lift');
      // Lift toward the camera and turn partly to face it, about the cover's own centre.
      t.el.style.transformOrigin = '50% 50%';
      // Straight toward the camera: out along the wall's normal, and down the wall by the same amount times the
      // tilt, so it grows without climbing up the screen into the soft far edge.
      var dz = TW * 1.15, dy = dz * Math.tan(AX);
      var ox = dy * Math.sin(AZ), oy = dy * Math.cos(AZ);
      t.el.style.transform = 'translate3d(' + (t.x + ox) + 'px,' + (t.y + oy) + 'px,' + dz + 'px) rotateX(' + (-AX * 0.6) + 'rad) rotateZ(' + (-AZ) + 'rad) scale(1.08)';
      t.el.style.boxShadow = '0 ' + TW * 0.12 + 'px ' + TW * 0.4 + 'px rgba(0,0,0,.6)';
      // The pool is sized from the cover so the clear middle always fits it; its edge reaches past every corner.
      var R = Math.max(TH * 8, Math.hypot(ctx.w, ctx.h) * 1.05), k = TH / R;
      pool.style.width = pool.style.height = 2 * R + 'px';
      pool.style.margin = -R + 'px 0 0 ' + -R + 'px';
      pool.style.background = poolBg(g.color, k);
      ctx.artColor(g, 'cover').then(function (c) {
        if (lifted !== t) return;
        pool.style.background = poolBg(c, k);
        cap.style.setProperty('--tkw-c', c);
      });
      cap.style.setProperty('--tkw-c', g.color);
      pool.classList.add('on');
      capName.textContent = g.name;
      capName.className = 'bl-drift-cname bl-cap-name' + (g.name.length > 30 ? ' longer' : g.name.length > 18 ? ' long' : '');
      var rk = rankOf[g.appid];
      capHead._note.textContent = rk ? 'No.' + ctx.pad(rk, 3) + ' OF ' + n : '';
      var bits = [];
      if (g.playtime) bits.push(ctx.hours(g.playtime) + ' ' + (ctx.hours(g.playtime) === 1 ? 'HOUR' : 'HOURS'));
      if (g.lastPlayed) bits.push('LAST PLAYED ' + since(g.lastPlayed));
      if (!bits.length) bits.push('IN YOUR LIBRARY');
      capLine.textContent = bits.join(', ');
      capAch.innerHTML = ''; ctx.achieve(capAch, g, { sizeU: 22, barU: 160 });
      capSide = 0; capW = 0;
    }
    function pct(x) { return (x * 100).toFixed(2) + '%'; }
    function poolBg(c, k) {
      // Clear over the cover, a breath of its own colour spilling on the neighbours, then the room goes dark.
      var tint = c.replace(/^rgb\(/, 'rgba(').replace(/\)$/, ',.2)').replace(/^hsl\((.*)\)$/, 'hsla($1,.2)');
      return 'radial-gradient(circle closest-side,rgba(0,0,0,0) 0,rgba(0,0,0,0) ' + pct(k * .78) + ',' + tint + ' ' + pct(k * 1.05) + ',rgba(4,5,6,.58) ' + pct(k * 1.45) + ',rgba(4,5,6,.8) ' + pct(k * 2.3) + ',rgba(4,5,6,.86) 100%)';
    }
    function drop() {
      var t = lifted; if (!t) return;
      lifted = null;
      t.el.style.transform = 'translate3d(' + t.x + 'px,' + t.y + 'px,0)';
      t.el.style.boxShadow = '';
      setTimeout(function () { t.el.classList.remove('lift'); }, 1900);
      pool.classList.remove('on'); cap.classList.remove('on');
    }
    function dropNow() { var t = lifted; drop(); if (t) t.el.classList.remove('lift'); }
    function follow() {
      if (!lifted) return;
      var r = lifted.el.getBoundingClientRect(), W = ctx.w, m = 52 * ctx.u;
      var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      pool.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      if (!capW) capW = cap.offsetWidth;
      if (!capSide) {
        var cb = clockBox(), roomR = W - r.right - m, roomL = r.left - m;
        capSide = roomR >= capW || roomR >= roomL ? 1 : -1;
        if (capSide === -1 && cb && r.left - m - capW < cb.r && r.bottom > cb.t) capSide = 1;
        cap.classList.toggle('right', capSide === -1);
      }
      var x = capSide === 1 ? r.right + m : r.left - m - capW;
      var y = r.bottom - cap.offsetHeight - r.height * 0.06;
      // No room on either side (a long name beside a cover near the edge, with the clock on the other side):
      // sit the caption above the cover, kept on screen.
      if (x + capW > W - m * .5 || x < m * .5) {
        x = Math.min(Math.max(m, (r.left + r.right) / 2 - capW / 2), W - m - capW);
        y = r.top - cap.offsetHeight - m * .6;
        if (y < m) y = r.bottom + m * .6;
      }
      cap.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (tNow - liftAt > 1.1) cap.classList.add('on');
    }

    // ---------------------------------------------------------------- loop
    var camX = ctx.R.range(-2000, 2000), camY = ctx.R.range(-2000, 2000), tNow = 0, lastSave = 0;
    layout(); place();
    function tick(t, dt) {
      tNow = t;
      if (every > 0) {
        if (!lifted && t >= nextLift) { lift(); nextLift = t + Math.max(every, LIFT_HOLD + 4); }
        if (lifted && t - liftAt > LIFT_HOLD) drop();
      }
      // The camera eases almost to a stop while a cover is up, as if to look at it.
      slow += ((lifted ? 0.18 : 1) - slow) * Math.min(1, dt * 0.9);
      var v = 24 * ctx.u * speed * slow, th = -0.36 + 0.5 * Math.sin(t / 157);
      camX += Math.cos(th) * v * dt; camY += Math.sin(th) * v * dt;
      cam.style.transform = 'translate3d(' + (-camX) + 'px,' + (-camY) + 'px,0)';
      place();
      follow();
      if (clockUi) clockUi.tick(t); // the time when the minute turns, and the slow wander
      if (t - lastSave > 30) { lastSave = t; store('drift-seen', log.slice(0, 160)); }
    }
    return {
      frame: tick,
      resize: function () { dropNow(); capW = 0; layout(); tiles.forEach(function (t) { t.i = null; }); cells = {}; shown.fill(0); place(); if (clockUi) clockUi.redraw(); },
      unmount: function () { store('drift-seen', log.slice(0, 160)); tiles = []; }
    };
  }
});
