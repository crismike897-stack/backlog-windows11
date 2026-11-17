/* Flip: the calm one of the pack. A flat wall of covers, front on and barely tilted, that turns over like a
   departures board: one flap at a time, and now and then a wave that sweeps across and shows a whole new board.
   Every so often a flap turns to the game whose moment is longest overdue and lifts toward you, with Drift's
   caption beside it. The house clock sits in the dark corner, as on the wall.
   Plain DOM with CSS 3D: each cover is a two-sided flap; a flip is one CSS transition, the board sways in one
   transform per frame. Options (config.sceneOptions.flip): clock (true), spotlight (seconds between lifts, 16;
   0 = never), motion ('calm' or 'more'; also ?flip-motion=). More: single flaps a little more often, a small ripple
   of neighbouring flaps now and then, and the full waves a little closer together. */
BACKLOG.scene({
  id: 'flip', name: 'Flip', overlay: 'none',
  mount: function (root, ctx) {
    var opt = ctx.options('flip');
    var every = opt.spotlight == null ? 16 : +opt.spotlight;
    var MORE = String(ctx.params.get('flip-motion') || opt.motion || 'more') === 'more';
    var games = ctx.games, n = games.length;
    var store = ctx.store || function () { return null; };
    var el = ctx.el;

    // ================================================================ the family kit
    // Copied from Drift (scenes/drift.js) so every scene of the pack has the same clock corner, the same
    // spotlight caption and the same pool of darkness round a lifted cover. Keep the copies in step with the wall.
    function famKit(p, title, showClock) {
      ctx.css(p + 'kit', [
        '.P-pool{position:absolute;left:0;top:0;border-radius:50%;opacity:0;transition:opacity 2.2s ease;pointer-events:none}',
        '.P-pool.on{opacity:1}',
        '.P-haze{position:absolute;inset:0;pointer-events:none;background:',
        'radial-gradient(ellipse 85% 46% at 58% 0%,rgba(var(--bl-accent-rgb),.13),rgba(var(--bl-accent-rgb),.04) 60%,rgba(var(--bl-accent-rgb),0) 100%),',
        'linear-gradient(0deg,rgba(var(--bl-accent-rgb),.06),rgba(var(--bl-accent-rgb),0) 22%)}',
        '.P-cap{position:absolute;left:0;top:0;width:max-content;max-width:calc(760*var(--u));opacity:0;transition:opacity 1.2s ease;pointer-events:none;will-change:transform}',
        '.P-cap.on{opacity:1}',
        '.P-cap::before{content:"";position:absolute;inset:-40% -18%;z-index:-1;background:radial-gradient(closest-side,rgba(4,5,6,.95),rgba(4,5,6,.84) 50%,rgba(4,5,6,.5) 75%,rgba(4,5,6,0))}',
        '.P-cap.right{text-align:right}',
        '.P-cap.right .bl-h-head,.P-cap.right .bl-h-ach{justify-content:flex-end}',
        '.P-cap .bl-h-rule{transform-origin:0 50%;transform:scaleX(0);transition:transform 1.1s cubic-bezier(.2,.8,.2,1) .2s}',
        '.P-cap .bl-h-rule.b{transition-delay:.34s}',
        '.P-cap.right .bl-h-rule{transform-origin:100% 50%}',
        '.P-cap.on .bl-h-rule{transform:none}',
        '.P-cap .bl-h-head{margin-bottom:calc(12*var(--u))}',
        '.P-cname{padding:calc(10*var(--u)) 0 calc(10*var(--u));font-size:calc(66*var(--u))}',
        '.P-cname.long{font-size:calc(52*var(--u))}.P-cname.longer{font-size:calc(42*var(--u))}',
        '.P-cline{white-space:nowrap;margin-top:calc(14*var(--u));font-size:calc(31*var(--u))}',
        '.P-ach{margin-top:calc(14*var(--u))}.P-ach:empty{display:none}',
        '.P-name{position:absolute;inset:0;display:flex;align-items:flex-end;padding:12% 10%;font:700 calc(34*var(--u))/1 "Barlow Condensed",sans-serif;letter-spacing:.02em;text-transform:uppercase;color:var(--bl-accent)}'
      ].join('').replace(/\.P-/g, '.' + p));
      var k = {}, n = games.length;
      // Past two years, months read oddly ("86 MONTHS AGO"); say years.
      k.since = function (sec) { var d = (ctx.nowMs() / 1000 - sec) / 86400; return d >= 730 ? Math.floor(d / 365.25) + ' YEARS AGO' : d >= 365 ? 'A YEAR AGO' : ctx.ago(sec); };
      var rankOf = {}; ctx.top.forEach(function (g, i) { rankOf[g.appid] = i + 1; });
      k.rank = function (g) { return rankOf[g.appid]; };
      // A cover: the art, or the game's name in type while it loads or when there is none.
      k.paint = function (box, g, keep) {
        box.innerHTML = '';
        box.style.background = 'linear-gradient(160deg,hsl(' + g.hue + ',35%,18%),hsl(' + ((g.hue + 30) % 360) + ',40%,7%))';
        if (keep) el('div', keep, box);
        var url = g.art('cover');
        if (!url) { el('div', p + 'name', box, g.name); return; }
        var im = el('img', null, box);
        im.decoding = 'async'; im.alt = '';
        im.onload = function () { im.classList.add('on'); };
        im.onerror = function () { im.remove(); el('div', p + 'name', box, g.name); };
        im.src = url; // the shade (first child) sits over the art by its z-index
      };
      k.mountPool = function () { k.pool = el('div', p + 'pool', root); };
      k.mountChrome = function () {
        el('div', p + 'haze', root);
        var cap = k.cap = el('div', p + 'cap bl-cap', root);
        k.capHead = ctx.head(cap, 'IN THE SPOTLIGHT', '', 22);
        el('div', 'bl-h-rule', cap);
        k.capName = el('div', p + 'cname bl-cap-name', cap);
        el('div', 'bl-h-rule b', cap);
        k.capLine = el('div', p + 'cline bl-cap-line', cap);
        k.capAch = el('div', p + 'ach', cap); // small: achievements, under the hours
        // The clock corner is core's (ctx.clockCorner).
        if (showClock) { k.clockUi = ctx.clockCorner({ parent: root, title: title }); k.clock = k.clockUi.box; }
      };
      k.tickClock = function (t) { if (k.clockUi) k.clockUi.tick(t); }; // the time when the minute turns, and the slow wander
      k.clockBox = function () { return k.clockUi ? k.clockUi.rect() : null; };
      k.hit = function (a, b) { return b && a.left < b.r && a.right > b.l && a.top < b.b && a.bottom > b.t; };
      function pct(x) { return (x * 100).toFixed(2) + '%'; }
      function poolBg(c, q) {
        // Clear over the cover, a breath of its own colour spilling on the neighbours, then the room goes dark.
        var tint = c.replace(/^rgb\(/, 'rgba(').replace(/\)$/, ',.2)').replace(/^hsl\((.*)\)$/, 'hsla($1,.2)');
        return 'radial-gradient(circle closest-side,rgba(0,0,0,0) 0,rgba(0,0,0,0) ' + pct(q * .78) + ',' + tint + ' ' + pct(q * 1.05) + ',rgba(4,5,6,.58) ' + pct(q * 1.45) + ',rgba(4,5,6,.8) ' + pct(q * 2.3) + ',rgba(4,5,6,.86) 100%)';
      }
      var capSide = 0, capW = 0, shownG = null;
      // label: the head ('IN THE SPOTLIGHT', 'MOST PLAYED'...); h: the lifted cover's height on screen, in px.
      k.show = function (g, label, h) {
        shownG = g;
        var R = Math.max(h * 8, Math.hypot(ctx.w, ctx.h) * 1.05), q = h / R;
        k.pool.style.width = k.pool.style.height = 2 * R + 'px';
        k.pool.style.margin = -R + 'px 0 0 ' + -R + 'px';
        k.pool.style.background = poolBg(g.color, q);
        ctx.artColor(g, 'cover').then(function (c) { if (shownG === g) k.pool.style.background = poolBg(c, q); });
        k.pool.classList.add('on');
        k.capHead._label.textContent = label || 'IN THE SPOTLIGHT';
        k.capName.textContent = g.name;
        k.capName.className = p + 'cname bl-cap-name' + (g.name.length > 30 ? ' longer' : g.name.length > 18 ? ' long' : '');
        var rk = rankOf[g.appid];
        k.capHead._note.textContent = rk ? 'No.' + ctx.pad(rk, 3) + ' OF ' + n : '';
        var bits = [];
        if (g.playtime) bits.push(ctx.hours(g.playtime) + ' ' + (ctx.hours(g.playtime) === 1 ? 'HOUR' : 'HOURS'));
        if (g.lastPlayed) bits.push('LAST PLAYED ' + k.since(g.lastPlayed));
        if (!bits.length) bits.push('IN YOUR LIBRARY');
        k.capLine.textContent = bits.join(', ');
        k.capAch.innerHTML = ''; if (ctx.achieve) ctx.achieve(k.capAch, g, { sizeU: 22, barU: 160 });
        capSide = 0; capW = 0;
      };
      k.hide = function () { shownG = null; k.pool.classList.remove('on'); k.cap.classList.remove('on'); };
      // Every frame while a cover is up: the pool and the caption follow it. r: its screen rect; since: seconds up.
      k.follow = function (r, since) {
        var W = ctx.w, m = 52 * ctx.u;
        var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        k.pool.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
        if (!capW) capW = k.cap.offsetWidth;
        if (!capSide) {
          var cb = k.clockBox(), roomR = W - r.right - m, roomL = r.left - m;
          capSide = roomR >= capW || roomR >= roomL ? 1 : -1;
          if (capSide === -1 && cb && r.left - m - capW < cb.r && r.bottom > cb.t) capSide = 1;
          k.cap.classList.toggle('right', capSide === -1);
        }
        var x = capSide === 1 ? r.right + m : r.left - m - capW;
        var y = r.bottom - k.cap.offsetHeight - r.height * 0.06, H = ctx.h, ch = k.cap.offsetHeight;
        // No room on either side (a long name beside a cover near the edge, with the clock on the other side):
        // sit the caption above the cover, kept on screen.
        if (x + capW > W - m * .5 || x < m * .5) {
          x = Math.min(Math.max(m, (r.left + r.right) / 2 - capW / 2), W - m - capW);
          y = r.top - ch - m * .6;
          if (y < m) y = r.bottom + m * .6;
        }
        y = Math.min(Math.max(y, m * .5), H - ch - m * .5); // and never off the top or bottom
        k.cap.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        if (since > 1.1) k.cap.classList.add('on');
      };
      k.reset = function () { capW = 0; capSide = 0; };
      // Least-recently-used choice, remembered across launches: a new run opens on covers you haven't just seen.
      k.chooser = function (key) {
        var shown = new Array(n).fill(0), used = new Array(n).fill(0), stamp = 0, log = [];
        ctx.R.shuffle(games.map(function (g, i) { return i; })).forEach(function (gi, q) { used[gi] = q - 1e7; });
        var idIndex = {}; games.forEach(function (g, i) { idIndex[String(g.appid)] = i; });
        (store(key) || []).forEach(function (id, q) { var gi = idIndex[String(id)]; if (gi != null) used[gi] = -1 - q; });
        return {
          // avoid: game indexes not to put here (the neighbours), as an object
          pick: function (avoid) {
            var best = 0, bs = Infinity;
            for (var i = 0; i < n; i++) { var s = shown[i] * 1e9 + (avoid && avoid[i] ? 1e8 : 0) + used[i]; if (s < bs) { bs = s; best = i; } }
            used[best] = ++stamp; shown[best]++;
            log.unshift(String(games[best].appid)); if (log.length > 240) log.length = 240;
            return best;
          },
          release: function (gi) { if (gi >= 0 && shown[gi] > 0) shown[gi]--; },
          clear: function () { shown.fill(0); },
          save: function () { store(key, log.slice(0, 160)); }
        };
      };
      // The cover that has waited longest for its moment goes next (shared memory with the scene's own key).
      k.waited = function (key, list) {
        var lit = store(key) || {};
        list.sort(function (a, b) { return (lit[a.appid] || 0) - (lit[b.appid] || 0); });
        return list;
      };
      k.lit = function (key, g) {
        var lit = store(key) || {};
        lit[g.appid] = ctx.nowMs();
        var ids = Object.keys(lit); if (ids.length > 400) ids.sort(function (a, b) { return lit[a] - lit[b]; }).slice(0, ids.length - 400).forEach(function (id) { delete lit[id]; });
        store(key, lit);
      };
      return k;
    }
    // ================================================================ end of the kit

    var showClock = opt.clock !== false && ctx.clockShown();
    var K = famKit('bl-flip-', 'FLIP // ' + n + (n === 1 ? ' TITLE' : ' TITLES'), showClock);

    ctx.css('bl-flip-css', [
      '.bl-flip{background:#060708}',
      '.bl-flip-persp{position:absolute;inset:0;overflow:hidden}',
      '.bl-flip-plane,.bl-flip-tile,.bl-flip-flip{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}',
      '.bl-flip-plane{will-change:transform}',
      '.bl-flip-tile,.bl-flip-flip{left:0;top:0}',
      '.bl-flip-tile.lift{transition:transform 1.8s cubic-bezier(.22,.8,.25,1);z-index:2}',
      /* the flap: falls forward about its middle like a departures board, with a little settle at the end */
      '.bl-flip-flip{transition:transform 1.25s cubic-bezier(.5,.02,.24,1.12)}',
      '.bl-flip-face{position:absolute;border-radius:calc(7*var(--u));overflow:hidden;background:#15171b;backface-visibility:hidden}',
      '.bl-flip-face img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .6s ease}',
      '.bl-flip-face img.on{opacity:1}',
      '.bl-flip-face::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(var(--bl-accent-rgb),.1)}',
      /* the board's split: a hairline across the middle of every cover, as on a real flap */
      '.bl-flip-shade{position:absolute;inset:0;z-index:1;background:#060708;opacity:.32;transition:opacity 1.25s ease}',
      '.bl-flip-fog{position:absolute;inset:0;pointer-events:none;background:',
      'linear-gradient(180deg,rgba(6,7,8,.88) 0,rgba(6,7,8,.45) 16%,rgba(6,7,8,.1) 34%,rgba(6,7,8,0) 50%,rgba(6,7,8,.12) 76%,rgba(6,7,8,.6) 100%),',
      'radial-gradient(ellipse 80% 90% at 52% 50%,rgba(0,0,0,0) 45%,rgba(0,0,0,.3) 70%,rgba(0,0,0,.7) 100%)}',
      /* Solid edges left and right: covers cut by the screen's edge can flicker on the Deck; this hides them. */
      '.bl-flip-edge{position:absolute;inset:0;pointer-events:none;background:',
      'linear-gradient(90deg,#060708 0,#060708 2%,rgba(6,7,8,.7) 4.5%,rgba(6,7,8,0) 9%,rgba(6,7,8,0) 91%,rgba(6,7,8,.7) 95.5%,#060708 98%,#060708 100%)}'
    ].join(''));
    root.classList.add('bl-flip');

    var persp = el('div', 'bl-flip-persp', root);
    var plane = el('div', 'bl-flip-plane', persp);
    K.mountPool();
    el('div', 'bl-flip-fog', root);
    el('div', 'bl-flip-edge', root);
    K.mountChrome();

    // ---------------------------------------------------------------- the board
    var pick = K.chooser('flip-seen');
    var TW, TH, PX, PY, cols = 0, rows = 0, tiles = [], AX = 9 * Math.PI / 180, AZ = -3 * Math.PI / 180;
    function layout() {
      var W = ctx.w, H = ctx.h, u = ctx.u;
      TW = Math.round(Math.max(190 * u, W / 10.5)); TH = Math.round(TW * 1.5);
      PX = TW + Math.round(TW * 0.09); PY = TH + Math.round(TW * 0.09);
      persp.style.perspective = Math.max(H * 2, W) + 'px';
      var c2 = Math.ceil(W / PX) + 4, r2 = Math.ceil(H / PY) + 3; // room for the drift and lean in tick()
      if (c2 !== cols || r2 !== rows) build(c2, r2);
      tiles.forEach(function (t) {
        t.x = (t.c - (cols - 1) / 2) * PX; t.y = (t.r - (rows - 1) / 2) * PY;
        t.el.style.transform = 'translate3d(' + t.x + 'px,' + t.y + 'px,0)';
        [t.a, t.b].forEach(function (f) { f.style.width = TW + 'px'; f.style.height = TH + 'px'; f.style.left = -TW / 2 + 'px'; f.style.top = -TH / 2 + 'px'; });
        t.b.style.transform = 'rotateX(180deg)';
      });
    }
    function build(c2, r2) {
      tiles.forEach(function (t) { t.el.remove(); pick.release(t.g); });
      tiles = []; cols = c2; rows = r2;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var e = el('div', 'bl-flip-tile', plane), f = el('div', 'bl-flip-flip', e);
        tiles.push({ el: e, flip: f, a: el('div', 'bl-flip-face', f), b: el('div', 'bl-flip-face', f), c: c, r: r, g: -1, turns: 0, at: -99, busy: false });
      }
      tiles.forEach(function (t) { t.g = pick.pick(neighbours(t)); K.paint(t.a, games[t.g], 'bl-flip-shade'); });
    }
    function at(c, r) { return c < 0 || r < 0 || c >= cols || r >= rows ? null : tiles[r * cols + c]; }
    function neighbours(t) {
      var o = {};
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) { var x = at(t.c + a, t.r + b); if (x && x !== t && x.g >= 0) o[x.g] = 1; }
      if (t.g >= 0) o[t.g] = 1;
      return o;
    }
    // Turn one flap over to show g (or the next game due). delay in seconds.
    function flip(t, delay, gi) {
      if (t.busy) return;
      t.busy = true;
      if (gi == null) { pick.release(t.g); gi = pick.pick(neighbours(t)); }
      t.g = gi;
      var face = t.turns % 2 ? t.a : t.b;
      K.paint(face, games[gi], 'bl-flip-shade');
      setTimeout(function () {
        if (!alive) return;
        t.turns++; t.at = tNow;
        t.flip.style.transform = 'rotateX(' + (-180 * t.turns) + 'deg)';
        setTimeout(function () { t.busy = false; }, 1300);
      }, 250 + delay * 1000);
    }
    function front(t) { return t.turns % 2 ? t.b : t.a; }

    // ---------------------------------------------------------------- the rhythm: single flaps, now and then a wave
    var tNow = 0, alive = true, nextOne = 2, nextWave = MORE ? 24 : 34, waveUntil = 0, nextRipple = 7;
    var lifted = null, liftAt = 0, nextLift = 9, LIFT_HOLD = 9, lastSave = 0;
    function single() {
      var pool = tiles.filter(function (t) { return !t.busy && t !== lifted && tNow - t.at > 20; });
      if (pool.length) flip(pool[ctx.R.int(pool.length)], 0);
    }
    // A small ripple: one flap and the few around it turn over, spreading outward from it.
    function ripple() {
      var W = ctx.w, H = ctx.h, pool = tiles.filter(function (t) {
        if (t.busy || t === lifted || tNow - t.at < 8) return false;
        return Math.abs(t.x) < W * 0.5 && Math.abs(t.y) < H * 0.5;
      });
      if (!pool.length) return;
      var c = pool[ctx.R.int(pool.length)], reach = ctx.R.range(1.3, 2.1);
      tiles.forEach(function (t) {
        if (t === lifted || t.busy) return;
        var d = Math.hypot(t.c - c.c, (t.r - c.r) * 1.3);
        if (d <= reach) flip(t, d * 0.2);
      });
    }
    function wave() {
      var kind = ctx.R.pick(['sweep', 'diag', 'rain', 'centre']), cc = (cols - 1) / 2, rc = (rows - 1) / 2, longest = 0;
      tiles.forEach(function (t) {
        if (t === lifted) return;
        var d = kind === 'sweep' ? t.c * 0.11 + t.r * 0.035 : kind === 'diag' ? (t.c + t.r) * 0.08 : kind === 'rain' ? ctx.R() * 2.6 : Math.hypot(t.c - cc, (t.r - rc) * 1.4) * 0.13;
        longest = Math.max(longest, d);
        flip(t, d);
      });
      waveUntil = tNow + longest + 2;
    }
    function lift() {
      var W = ctx.w, H = ctx.h, cb = K.clockBox(), cands = [];
      tiles.forEach(function (t) {
        if (t.busy) return;
        var r = t.el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        if (cx < W * 0.28 || cx > W * 0.72 || cy < H * 0.36 || cy > H * 0.66 || K.hit(r, cb)) return;
        cands.push(t);
      });
      if (!cands.length) return;
      var t = cands[ctx.R.int(cands.length)];
      // The flap turns over to the game whose moment is longest overdue, then lifts.
      var order = K.waited('flip-lit', (ctx.featured && ctx.featured.length ? ctx.featured : games).slice()), gi = games.indexOf(order[0]);
      if (n > 1 && gi === t.g) gi = games.indexOf(order[1]);
      pick.release(t.g); t.busy = false; flip(t, 0, gi);
      K.lit('flip-lit', games[gi]);
      lifted = t; liftAt = tNow + 1.5;
    }
    function raise() {
      var t = lifted;
      t.el.classList.add('lift');
      t.el.style.transform = 'translate3d(' + t.x + 'px,' + t.y + 'px,' + TW * 1.1 + 'px) scale(1.04)';
      front(t).style.boxShadow = '0 ' + TW * 0.12 + 'px ' + TW * 0.4 + 'px rgba(0,0,0,.6)';
      front(t).firstChild.style.opacity = 0;
      K.show(games[t.g], games[t.g] === ctx.recent[0] ? 'MOST RECENT' : games[t.g] === ctx.top[0] ? 'MOST PLAYED' : 'IN THE SPOTLIGHT', TH * 1.4);
      t.raised = true;
    }
    function drop() {
      var t = lifted; if (!t) return;
      lifted = null;
      t.el.style.transform = 'translate3d(' + t.x + 'px,' + t.y + 'px,0)';
      if (t.raised) { front(t).style.boxShadow = ''; front(t).firstChild.style.opacity = ''; }
      t.raised = false; t.at = tNow;
      setTimeout(function () { t.el.classList.remove('lift'); }, 1900);
      K.hide();
    }

    layout();
    function tick(t, dt) {
      tNow = t;
      if (!lifted && t > waveUntil) {
        if (t >= nextWave) { wave(); nextWave = t + (MORE ? ctx.R.range(28, 40) : ctx.R.range(38, 56)); }
        else if (MORE && t >= nextRipple) { ripple(); nextRipple = t + ctx.R.range(8, 13); }
        else if (t >= nextOne) { single(); nextOne = t + (MORE ? ctx.R.range(0.9, 1.9) : ctx.R.range(1.4, 3)); }
        if (every > 0 && t >= nextLift && t > waveUntil) { lift(); nextLift = t + Math.max(every, LIFT_HOLD + 6); }
      }
      if (lifted && !lifted.raised && t >= liftAt) raise();
      if (lifted && t - liftAt > LIFT_HOLD) drop();
      // The board drifts, leans and breathes gently, so it never looks parked (and nothing bright sits on the same
      // pixels). Periods of roughly 40 to 70 seconds: visible if you watch, calm if you don't.
      var sx = Math.sin(t / 41) * PX * 0.75, sy = Math.sin(t / 29 + 2) * PY * 0.32;
      var ax = AX + Math.sin(t / 53) * 0.035, ay = Math.sin(t / 37 + 1) * 0.04, sz = Math.sin(t / 67) * TW * 0.35;
      plane.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,' + sz.toFixed(1) + 'px) rotateX(' + ax.toFixed(4) + 'rad) rotateY(' + ay.toFixed(4) + 'rad) rotateZ(' + AZ + 'rad)';
      if (lifted && lifted.raised) K.follow(front(lifted).getBoundingClientRect(), t - liftAt);
      K.tickClock(t);
      if (t - lastSave > 30) { lastSave = t; pick.save(); }
    }
    return {
      frame: tick,
      resize: function () { drop(); K.reset(); layout(); },
      unmount: function () { alive = false; pick.save(); tiles = []; }
    };
  }
});
