/* Ripple: op art on a wall of covers, after the bulging grids of the sixties. A flat, front-on grid of the library's
   covers, and through it a slow swell: two long sine waves cross the wall, and each cover rides the surface they make,
   leaning with its slope, growing on the crests, shading in the troughs, sliding a little off the crest, so the flat
   grid seems to billow like cloth. Now and then a cover is singled out: a ring spreads from it across the cloth and it
   lifts toward you with the wall's caption. The wall's clock sits in the dark corner.
   One WebGL canvas: the covers live in one atlas texture, every tile is a quad, and the whole surface is worked out
   in the vertex shader from a few numbers a frame, so the main thread does almost nothing.
   Options (config.sceneOptions.ripple): clock (true), spotlight (seconds between lifts, 18; 0 = never), amplitude
   (1: how far the cloth billows), speed (1). */
BACKLOG.scene({
  id: 'ripple', name: 'Ripple', overlay: 'none',
  label: 'RIPPLE',
  mount: function (root, ctx) {
    // Ripple 2 (ripple2.js) reuses this mount with its own id, label and stronger default swell.
    var self = this || {};
    var opt = Object.assign({}, self.defaults || {}, ctx.options(self.id || 'ripple'));
    root.classList.add('bl-ripple');
    var showClock = opt.clock !== false && ctx.clockShown();
    var every = opt.spotlight == null ? 18 : +opt.spotlight;
    var AMP = Math.max(0, Math.min(2, opt.amplitude == null ? 1 : +opt.amplitude || 0));
    var SPD = Math.max(0.2, Math.min(3, opt.speed == null ? 1 : +opt.speed || 1));
    var games = ctx.games, n = games.length;
    var store = ctx.store || function () { return null; };
    var el = ctx.el;
    // Past two years, months read oddly ("86 MONTHS AGO"); say years.
    function since(sec) { var d = (ctx.nowMs() / 1000 - sec) / 86400; return d >= 730 ? Math.floor(d / 365.25) + ' YEARS AGO' : d >= 365 ? 'A YEAR AGO' : ctx.ago(sec); }

    // ---------------------------------------------------------------- the wall's chrome (copied from wall.js)
    ctx.css('bl-ripple-css', [
      '.bl-ripple{background:#060708}',
      '.bl-ripple-cv{position:absolute;left:0;top:0;opacity:0;transition:opacity 2.4s ease}',
      '.bl-ripple-cv.on{opacity:1}',
      '.bl-ripple-pool{position:absolute;left:0;top:0;border-radius:50%;opacity:0;transition:opacity 2.2s ease;pointer-events:none}',
      '.bl-ripple-pool.on{opacity:1}',
      '.bl-ripple-fog{position:absolute;inset:0;pointer-events:none;background:',
      'linear-gradient(180deg,rgba(6,7,8,.8) 0,rgba(6,7,8,.4) 12%,rgba(6,7,8,.1) 28%,rgba(6,7,8,0) 40%,rgba(6,7,8,0) 70%,rgba(6,7,8,.28) 88%,rgba(6,7,8,.6) 100%),',
      'radial-gradient(ellipse 75% 85% at 52% 50%,rgba(0,0,0,0) 44%,rgba(0,0,0,.2) 66%,rgba(0,0,0,.52) 88%,rgba(0,0,0,.7) 100%)}',
      '.bl-ripple-haze{position:absolute;inset:0;pointer-events:none;background:',
      'radial-gradient(ellipse 85% 46% at 58% 0%,rgba(var(--bl-accent-rgb),.13),rgba(var(--bl-accent-rgb),.04) 60%,rgba(var(--bl-accent-rgb),0) 100%),',
      'linear-gradient(0deg,rgba(var(--bl-accent-rgb),.06),rgba(var(--bl-accent-rgb),0) 22%)}',
      '.bl-ripple-cap{position:absolute;left:0;top:0;width:max-content;max-width:calc(760*var(--u));opacity:0;transition:opacity 1.2s ease;pointer-events:none;will-change:transform}',
      '.bl-ripple-cap.on{opacity:1}',
      '.bl-ripple-cap::before{content:"";position:absolute;inset:-40% -18%;z-index:-1;background:radial-gradient(closest-side,rgba(4,5,6,.95),rgba(4,5,6,.84) 50%,rgba(4,5,6,.5) 75%,rgba(4,5,6,0))}',
      '.bl-ripple-cap.right{text-align:right}',
      '.bl-ripple-cap.right .bl-h-head,.bl-ripple-cap.right .bl-h-ach{justify-content:flex-end}',
      '.bl-ripple-cap .bl-h-rule{transform-origin:0 50%;transform:scaleX(0);transition:transform 1.1s cubic-bezier(.2,.8,.2,1) .2s}',
      '.bl-ripple-cap .bl-h-rule.b{transition-delay:.34s}',
      '.bl-ripple-cap.right .bl-h-rule{transform-origin:100% 50%}',
      '.bl-ripple-cap.on .bl-h-rule{transform:none}',
      '.bl-ripple-cap .bl-h-head{margin-bottom:calc(12*var(--u))}',
      '.bl-ripple-cname{padding:calc(10*var(--u)) 0 calc(10*var(--u));font-size:calc(66*var(--u))}',
      '.bl-ripple-cname.long{font-size:calc(52*var(--u))}.bl-ripple-cname.longer{font-size:calc(42*var(--u))}',
      '.bl-ripple-cline{white-space:nowrap;margin-top:calc(14*var(--u));font-size:calc(31*var(--u))}',
      '.bl-ripple-ach{margin-top:calc(14*var(--u))}.bl-ripple-ach:empty{display:none}'
    ].join(''));
    root.classList.add('bl-ripple');

    var cv = el('canvas', 'bl-ripple-cv', root);
    var pool = el('div', 'bl-ripple-pool', root);
    el('div', 'bl-ripple-fog', root);
    el('div', 'bl-ripple-haze', root);
    var cap = el('div', 'bl-ripple-cap bl-cap', root);
    var capHead = ctx.head(cap, 'IN THE SPOTLIGHT', '', 22);
    el('div', 'bl-h-rule', cap);
    var capName = el('div', 'bl-ripple-cname bl-cap-name', cap);
    el('div', 'bl-h-rule b', cap);
    var capLine = el('div', 'bl-ripple-cline bl-cap-line', cap);
    var capAch = el('div', 'bl-ripple-ach', cap); // small: achievements, under the hours
    // The clock corner is core's (ctx.clockCorner).
    var clockUi = showClock ? ctx.clockCorner({ parent: root, title: (self.label || 'RIPPLE') + ' // ' + n + (n === 1 ? ' TITLE' : ' TITLES') }) : null;
    var rankOf = {}; ctx.top.forEach(function (g, i) { rankOf[g.appid] = i + 1; });

    // ---------------------------------------------------------------- which games take part
    // At most 160 covers fit the atlas; a big library brings the ones you haven't seen here for longest.
    var dead = false, MAXP = 160;
    var seen = store('ripple-seen') || [], seenAt = {};
    seen.forEach(function (id, q) { seenAt[String(id)] = seen.length - q; });
    var pal = games.slice();
    if (pal.length > MAXP) {
      var jit = {}; pal.forEach(function (g) { jit[g.appid] = ctx.R(); });
      pal.sort(function (a, b) { return (seenAt[a.appid] || 0) - (seenAt[b.appid] || 0) || jit[a.appid] - jit[b.appid]; });
      var keep = ctx.featured || []; // featured games always make the atlas
      pal = keep.concat(pal.filter(function (g) { return keep.indexOf(g) < 0; })).slice(0, MAXP);
    }
    var P = pal.length;

    // ---------------------------------------------------------------- WebGL
    var gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    // The surface. h is the height of the cloth (-1..1), g its slope; both come from two crossing sine waves and the
    // ring from the spotlit cover. A cover leans with the slope, grows and comes forward on a crest, darkens in a
    // trough and slides a little downhill, which is what makes the flat grid read as cloth.
    var VS = [
      'attribute vec2 aCorner;attribute vec2 aCell;attribute vec2 aUV;',
      'uniform vec2 uView;uniform vec2 uCam;uniform vec2 uPitch;uniform vec2 uTile;uniform vec2 uUVSize;uniform vec2 uUVInset;',
      'uniform float uT;uniform vec4 uW1;uniform vec4 uW2;uniform float uAmp;uniform vec4 uRip;uniform vec3 uRipK;',
      'uniform vec2 uSpot;uniform float uLift;uniform float uMode;uniform float uF;uniform float uLiftS;',
      'varying vec2 vUV;varying vec2 vLocal;varying float vShade;varying float vPx;',
      'void main(){',
      ' vec2 base=aCell*uPitch-uCam+uView*0.5;',
      ' float isSpot=step(length(aCell-uSpot),0.25);',
      ' if(uMode<0.5&&isSpot>0.5&&uLift>0.001){gl_Position=vec4(3.0,3.0,0.0,1.0);return;}',
      ' float p1=dot(base,uW1.xy)*uW1.z-uT*uW1.w;float p2=dot(base,uW2.xy)*uW2.z-uT*uW2.w;',
      ' float h=0.62*sin(p1)+0.38*sin(p2);vec2 g=0.62*cos(p1)*uW1.xy+0.38*cos(p2)*uW2.xy;',
      // the ring: a soft band travelling out from the spotlit cover, fading as it goes
      ' vec2 dv=base-uRip.xy;float r=length(dv)+0.001;float s=r-uRip.z*uRipK.x;',
      ' float env=exp(-s*s/(uRipK.y*uRipK.y))*uRip.w;',
      ' h+=env*sin(s*uRipK.z);g+=env*cos(s*uRipK.z)*(dv/r);',
      ' h*=uAmp;g*=uAmp;',
      ' float L=uLift*isSpot;',
      ' float sc=mix(1.0+0.09*h,uLiftS,L);',
      ' float ty=g.x*0.24*(1.0-L);float tx=-g.y*0.24*(1.0-L);',
      ' vec2 disp=-g*0.16*uPitch.x*(1.0-L);',
      ' float z=mix(h*0.3*uTile.x,uTile.x*0.6,L);',
      ' vec2 loc=aCorner*(uTile*sc+4.0);',
      // lean: turn about the vertical axis, then the horizontal one
      ' float cy=cos(ty),sy=sin(ty),cx=cos(tx),sx=sin(tx);',
      ' float x1=loc.x*cy;float z1=-loc.x*sy;',
      ' float y2=loc.y*cx-z1*sx;float z2=loc.y*sx+z1*cx;',
      ' vec2 p=base+disp+vec2(x1,y2);float depth=z+z2;',
      ' float k=uF/max(uF-depth,1.0);',
      ' vec2 scr=uView*0.5+(p-uView*0.5)*k;',
      ' gl_Position=vec4(scr.x/uView.x*2.0-1.0,1.0-scr.y/uView.y*2.0,0.0,1.0);',
      ' vLocal=loc/(uTile*sc);vPx=sc*k*uTile.x;',
      ' vec2 f=clamp(aCorner*(uTile*sc+4.0)/(uTile*sc)+0.5,0.0,1.0);',
      ' vUV=aUV+uUVInset+f*(uUVSize-2.0*uUVInset);',
      // light from the upper left: a crest and a slope that faces it are lit, a trough falls into shade
      ' float lit=0.78+0.17*h+0.12*(-0.55*g.x-0.8*g.y)+0.09*(aCorner.x*sin(ty)*-1.6+aCorner.y*sin(tx)*1.6);',
      ' vShade=mix(clamp(lit,0.5,1.04),1.0,L);',
      '}'
    ].join('\n');
    var FS = [
      'precision mediump float;',
      'uniform sampler2D uTex;uniform vec3 uEdge;uniform float uRadF;',
      'varying vec2 vUV;varying vec2 vLocal;varying float vShade;varying float vPx;',
      'void main(){',
      ' vec2 size=vec2(vPx,vPx*1.5);float rad=uRadF*vPx;',
      ' vec2 q=abs(vLocal)*size-(size*0.5-vec2(rad));',
      ' float d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-rad;',
      ' float a=clamp(0.5-d,0.0,1.0);',
      ' vec3 c=texture2D(uTex,vUV).rgb*vShade;',
      // the wall tile's faint accent hairline just inside the edge
      ' c=mix(c,uEdge,0.1*(1.0-smoothstep(0.5,2.0,-d)));',
      ' gl_FragColor=vec4(c*a,a);',
      '}'
    ].join('\n');
    var prog = null, buf = null, spotBuf = null, loc = {}, texA = null, texH = null, glOk = false;
    function setupGL() {
      if (!gl) return false;
      function sh(type, src) {
        var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('ripple shader', gl.getShaderInfoLog(s));
        return s;
      }
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      ['uView', 'uCam', 'uPitch', 'uTile', 'uUVSize', 'uUVInset', 'uT', 'uW1', 'uW2', 'uAmp', 'uRip', 'uRipK', 'uSpot', 'uLift', 'uMode', 'uF', 'uLiftS', 'uTex', 'uEdge', 'uRadF']
        .forEach(function (k) { loc[k] = gl.getUniformLocation(prog, k); });
      ['aCorner', 'aCell', 'aUV'].forEach(function (k) { loc[k] = gl.getAttribLocation(prog, k); });
      buf = gl.createBuffer(); spotBuf = gl.createBuffer();
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(6 / 255, 7 / 255, 8 / 255, 1);
      gl.uniform1i(loc.uTex, 0);
      var rgb = ctx.theme.accentRgb;
      gl.uniform3f(loc.uEdge, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      texA = gl.createTexture(); texH = gl.createTexture();
      return true;
    }
    function attribs(b) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc.aCorner); gl.vertexAttribPointer(loc.aCorner, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(loc.aCell); gl.vertexAttribPointer(loc.aCell, 2, gl.FLOAT, false, 24, 8);
      gl.enableVertexAttribArray(loc.aUV); gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 24, 16);
    }
    function upload(tex, src) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // ---------------------------------------------------------------- the atlas
    var atlas = null, AW = 0, AH = 0, ACOLS = 1;
    function nameTile(a, g, x, y, w, h) {
      var gr = a.createLinearGradient(x, y, x + w * .4, y + h);
      gr.addColorStop(0, 'hsl(' + g.hue + ',35%,18%)'); gr.addColorStop(1, 'hsl(' + ((g.hue + 30) % 360) + ',40%,7%)');
      a.fillStyle = gr; a.fillRect(x, y, w, h);
      var fs = Math.max(8, Math.round(w * 0.17)), words = String(g.name).toUpperCase().split(/\s+/), lines = [], cur = '';
      a.font = '700 ' + fs + 'px "Barlow Condensed", sans-serif';
      words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (a.measureText(t).width > w * 0.8 && cur) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      lines = lines.slice(-4);
      a.fillStyle = ctx.theme.accent; a.textBaseline = 'alphabetic';
      lines.forEach(function (l, k) { a.fillText(l, x + w * 0.1, y + h * 0.88 - (lines.length - 1 - k) * fs * 1.05); });
    }
    function coverInto(a, im, g, x, y, w, h) {
      if (!im) { nameTile(a, g, x, y, w, h); return; }
      var s = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / s, sh = h / s;
      a.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    }
    function buildAtlas() {
      AW = Math.max(80, Math.min(176, Math.round(TW * 1.25))); AH = Math.round(AW * 1.5);
      ACOLS = Math.ceil(Math.sqrt(P * AH / AW));
      atlas = document.createElement('canvas');
      atlas.width = ACOLS * AW; atlas.height = Math.ceil(P / ACOLS) * AH;
      var a = atlas.getContext('2d'); a.imageSmoothingQuality = 'high';
      return Promise.all(pal.map(function (g, k) {
        var x = (k % ACOLS) * AW, y = Math.floor(k / ACOLS) * AH;
        return ctx.loadImage(g.art('cover')).then(function (im) { if (!dead) coverInto(a, im, g, x, y, AW, AH); });
      })).then(function () {
        if (dead || !glOk) return;
        upload(texA, atlas);
        atlas.width = atlas.height = 0; // the texture keeps it now
      });
    }

    // ---------------------------------------------------------------- the grid
    // A flat front-on grid that drifts slowly (so no cover sits still), each slot taking a new cover as it wraps round.
    var W = 0, H = 0, dpr = 1, TW = 0, TH = 0, PX = 0, PY = 0, cols = 0, rows = 0, F = 2000, slots = [], fillOrder = [], verts = null, dirty = true;
    function layout() {
      W = ctx.w; H = ctx.h; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      // Smaller covers than the wall's, so the cloth has enough weave to fold: about 110 on screen at any shape.
      TW = Math.round(Math.max(96 * ctx.u, Math.sqrt(W * H / 165))); TH = Math.round(TW * 1.5);
      var gap = Math.round(TW * 0.14);
      PX = TW + gap; PY = TH + gap;
      F = Math.max(H * 2, W);
      var c2 = Math.ceil(W / PX) + 4, r2 = Math.ceil(H / PY) + 4;
      if (c2 !== cols || r2 !== rows) {
        slots.forEach(function (s) { if (s.k >= 0) shown[s.k]--; });
        cols = c2; rows = r2; slots = []; cells = {};
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) slots.push({ c: c, r: r, i: null, j: null, k: -1, q: slots.length });
        fillOrder = ctx.R.shuffle(slots); // filled in a scattered order, so a small library never repeats in rows
        verts = new Float32Array(slots.length * 6 * 6);
      }
      slots.forEach(function (s) { s.i = null; });
      dirty = true;
    }
    // Least-recently-used, never beside itself while the library allows, remembered across launches.
    var shown = new Array(P).fill(0), used = new Array(P).fill(0), stamp = 0, log = [], cells = {};
    ctx.R.shuffle(pal.map(function (g, k) { return k; })).forEach(function (k, q) { used[k] = q - 1e7; });
    var idIndex = {}; pal.forEach(function (g, k) { idIndex[String(g.appid)] = k; });
    seen.forEach(function (id, q) { var k = idIndex[String(id)]; if (k != null) used[k] = -1 - q; });
    function key(i, j) { return i + ',' + j; }
    function choose(i, j) {
      var nb = {};
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) { var v = cells[key(i + a, j + b)]; if (v != null) nb[v] = 1; }
      var best = 0, bs = Infinity;
      for (var k = 0; k < P; k++) { var s = shown[k] * 1e9 + (nb[k] ? 1e8 : 0) + used[k] + ctx.R() * P * 0.6; if (s < bs) { bs = s; best = k; } } // a little scatter, so rows never repeat
      used[best] = ++stamp; shown[best]++;
      log.unshift(String(pal[best].appid)); if (log.length > 240) log.length = 240;
      return best;
    }
    function mod(a, m) { return ((a % m) + m) % m; }
    var CORNERS = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, -.5], [.5, .5], [-.5, .5]];
    function writeQuad(arr, o, i, j, u0, v0) {
      for (var q = 0; q < 6; q++) {
        var b = o + q * 6;
        arr[b] = CORNERS[q][0]; arr[b + 1] = CORNERS[q][1]; arr[b + 2] = i; arr[b + 3] = j; arr[b + 4] = u0; arr[b + 5] = v0;
      }
    }
    function uvOf(k) { return [(k % ACOLS) * AW / (ACOLS * AW), ((k / ACOLS) | 0) * AH / (Math.ceil(P / ACOLS) * AH)]; }
    function place() {
      // the cell of each slot for this camera; a slot that wraps round takes a new cover
      var ia = Math.floor((camX - W / 2) / PX) - 2, ja = Math.floor((camY - H / 2) / PY) - 2;
      for (var n2 = 0; n2 < fillOrder.length; n2++) {
        var s = fillOrder[n2], q = s.q, i = ia + mod(s.c - ia, cols), j = ja + mod(s.r - ja, rows);
        if (i === s.i && j === s.j) continue;
        if (spot && spot.slot === s) dropNow();
        if (s.i != null) { delete cells[key(s.i, s.j)]; if (s.k >= 0) shown[s.k]--; }
        s.i = i; s.j = j; s.k = choose(i, j); cells[key(i, j)] = s.k;
        var uv = uvOf(s.k);
        writeQuad(verts, q * 36, i, j, uv[0], uv[1]);
        dirty = true;
      }
    }

    // ---------------------------------------------------------------- the surface, also worked out here for the lifted cover
    var R2 = ctx.rng(ctx.seed + 11);
    var a1 = R2.range(-0.5, 0.5), a2 = a1 + Math.PI / 2 + R2.range(-0.45, 0.45);
    var W1 = [Math.cos(a1), Math.sin(a1), 0, 0], W2 = [Math.cos(a2), Math.sin(a2), 0, 0];
    function waves() {
      // wavelengths of about seven and eleven covers; one swell passes in about 26 and 37 seconds
      W1[2] = 2 * Math.PI / (PX * 7.2); W1[3] = 2 * Math.PI / 26 * SPD;
      W2[2] = 2 * Math.PI / (PX * 11); W2[3] = 2 * Math.PI / 37 * SPD;
    }
    var RIP_V = 0, RIP_SIG = 0, RIP_K = 0;
    function ripK() { RIP_V = 170 * ctx.u * SPD; RIP_SIG = PX * 1.15; RIP_K = 2 * Math.PI / (PX * 2.4); }
    function amp(t) { return AMP * (0.86 + 0.14 * Math.sin(t / 53)); } // the swell itself breathes, very slowly
    function ripAmp(t) {
      if (!spot) return 0;
      var age = t - spot.at;
      return age < 0 ? 0 : 0.85 * (1 - Math.exp(-age / 0.9)) * Math.exp(-age / 6.5);
    }

    // ---------------------------------------------------------------- the spotlight
    var spot = null, nextLift = 8, LIFT_HOLD = 9, LIFT_S = 1;
    var capSide = 0, capW = 0;
    function clockBox() { return clockUi ? clockUi.rect() : null; }
    function cellScreen(i, j) { return [i * PX - camX + W / 2, j * PY - camY + H / 2]; }
    function lift(t) {
      var cb = clockBox(), cands = [];
      // About the size of a lifted cover on the wall.
      LIFT_S = Math.max(1.6, Math.min(2.6, 230 * ctx.u / TW));
      var hw = TW * LIFT_S * 0.56, hh = TH * LIFT_S * 0.56; // the lifted cover, never over the clock
      slots.forEach(function (s) {
        var c = cellScreen(s.i, s.j);
        if (c[0] < W * 0.3 || c[0] > W * 0.68 || c[1] < H * 0.36 || c[1] > H * 0.64) return;
        if (cb && c[0] + hw > cb.l && c[0] - hw < cb.r && c[1] + hh > cb.t && c[1] - hh < cb.b) return;
        cands.push(s);
      });
      if (!cands.length) return;
      // The cover that has waited longest for its moment goes next.
      var lit = store('ripple-lit') || {};
      cands.sort(function (a, b) { return (lit[pal[a.k].appid] || 0) - (lit[pal[b.k].appid] || 0) || (ctx.R() - .5); });
      var s = cands[0];
      // With config.featured, only those games lift: on a cover already showing one if it's in reach, else the chosen
      // cover turns into it first.
      var fe = (ctx.featured || []).filter(function (x) { return pal.indexOf(x) >= 0; });
      if (fe.length) {
        var fg = fe.slice().sort(function (a, b) { return (lit[a.appid] || 0) - (lit[b.appid] || 0); })[0], fk = pal.indexOf(fg);
        var there = cands.filter(function (c) { return c.k === fk; })[0];
        if (there) s = there;
        else {
          shown[s.k]--; shown[fk]++; s.k = fk; cells[key(s.i, s.j)] = fk;
          var fuv = uvOf(fk); writeQuad(verts, s.q * 36, s.i, s.j, fuv[0], fuv[1]); dirty = true;
        }
      }
      var g = pal[s.k];
      lit[g.appid] = ctx.nowMs();
      var ids = Object.keys(lit); if (ids.length > 400) ids.sort(function (a, b) { return lit[a] - lit[b]; }).slice(0, ids.length - 400).forEach(function (id) { delete lit[id]; });
      store('ripple-lit', lit);
      spot = { slot: s, i: s.i, j: s.j, k: s.k, at: t, up: true, downAt: 0, hiOk: false };
      var sp = new Float32Array(36), uv = uvOf(s.k);
      writeQuad(sp, 0, s.i, s.j, uv[0], uv[1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, spotBuf); gl.bufferData(gl.ARRAY_BUFFER, sp, gl.DYNAMIC_DRAW);
      // its full art, for the close look
      var mine = spot;
      ctx.loadImage(g.art('cover')).then(function (im) {
        if (dead || spot !== mine) return;
        var c = document.createElement('canvas'); c.width = 400; c.height = 600;
        var a = c.getContext('2d'); a.imageSmoothingQuality = 'high';
        coverInto(a, im, g, 0, 0, 400, 600);
        upload(texH, c); c.width = c.height = 0;
        var full = new Float32Array(36); writeQuad(full, 0, mine.i, mine.j, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, spotBuf); gl.bufferData(gl.ARRAY_BUFFER, full, gl.DYNAMIC_DRAW);
        mine.hiOk = true;
      });
      // the pool and the caption
      var h = TH * LIFT_S, R = Math.max(h * 8, Math.hypot(W, H) * 1.05), kq = h / R;
      pool.style.width = pool.style.height = 2 * R + 'px';
      pool.style.margin = -R + 'px 0 0 ' + -R + 'px';
      pool.style.background = poolBg(g.color, kq);
      ctx.artColor(g, 'cover').then(function (c) { if (spot === mine) pool.style.background = poolBg(c, kq); });
      pool.classList.add('on');
      setCaption(g);
    }
    function pct(x) { return (x * 100).toFixed(2) + '%'; }
    function poolBg(c, k) {
      // Clear over the cover, a breath of its own color spilling on the neighbors, then the room goes dark.
      var tint = c.replace(/^rgb\(/, 'rgba(').replace(/\)$/, ',.2)').replace(/^hsl\((.*)\)$/, 'hsla($1,.2)');
      return 'radial-gradient(circle closest-side,rgba(0,0,0,0) 0,rgba(0,0,0,0) ' + pct(k * .78) + ',' + tint + ' ' + pct(k * 1.05) + ',rgba(4,5,6,.58) ' + pct(k * 1.45) + ',rgba(4,5,6,.8) ' + pct(k * 2.3) + ',rgba(4,5,6,.86) 100%)';
    }
    function setCaption(g) {
      capHead._label.textContent = g === ctx.recent[0] ? 'MOST RECENT' : g === ctx.top[0] ? 'MOST PLAYED' : 'IN THE SPOTLIGHT';
      capName.textContent = g.name;
      capName.className = 'bl-ripple-cname bl-cap-name' + (g.name.length > 30 ? ' longer' : g.name.length > 18 ? ' long' : '');
      var rk = rankOf[g.appid];
      capHead._note.textContent = rk ? 'No.' + ctx.pad(rk, 3) + ' OF ' + n : '';
      var bits = [];
      if (g.playtime && +ctx.hours(g.playtime) > 0) bits.push(ctx.hours(g.playtime) + ' ' + (ctx.hours(g.playtime) === 1 ? 'HOUR' : 'HOURS'));
      if (g.lastPlayed) bits.push('LAST PLAYED ' + since(g.lastPlayed));
      if (!bits.length) bits.push('IN YOUR LIBRARY');
      capLine.textContent = bits.join(', ');
      capAch.innerHTML = ''; if (ctx.achieve) ctx.achieve(capAch, g, { sizeU: 22, barU: 160 });
      capSide = 0; capW = 0;
    }
    function drop(t) { if (!spot || !spot.up) return; spot.up = false; spot.downAt = t; pool.classList.remove('on'); cap.classList.remove('on'); }
    function dropNow() { spot = null; pool.classList.remove('on'); cap.classList.remove('on'); }
    function liftAmt(t) {
      if (!spot) return 0;
      var e = function (x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
      return spot.up ? e((t - spot.at) / 1.9) : 1 - e((t - spot.downAt) / 1.6);
    }
    // The lifted cover's rect on screen (it faces you, so its corners are a simple box).
    function spotRect(t, L) {
      var c = cellScreen(spot.i, spot.j), sc = 1 + (LIFT_S - 1) * L, z = TW * 0.6 * L, k = F / (F - z);
      var x = W / 2 + (c[0] - W / 2) * k, y = H / 2 + (c[1] - H / 2) * k, hw = TW * sc * k / 2, hh = TH * sc * k / 2;
      return { left: x - hw, right: x + hw, top: y - hh, bottom: y + hh, width: hw * 2, height: hh * 2 };
    }
    function follow(t, L) {
      var r = spotRect(t, L), m = 52 * ctx.u;
      var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      pool.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)';
      if (!spot.up) return;
      if (!capW) capW = cap.offsetWidth;
      var hgt = cap.offsetHeight;
      if (!capSide) {
        var cb = clockBox(), roomR = W - r.right - m, roomL = r.left - m;
        capSide = roomR >= capW || roomR >= roomL ? 1 : -1;
        if (capSide === -1 && cb && r.left - m - capW < cb.r && r.bottom > cb.t) capSide = 1;
        cap.classList.toggle('right', capSide === -1);
      }
      var x = capSide === 1 ? r.right + m : r.left - m - capW;
      var y = r.bottom - hgt - r.height * 0.06;
      // No room on either side: sit the caption above the cover, kept on screen.
      if (x + capW > W - m * .5 || x < m * .5) {
        x = Math.min(Math.max(m, (r.left + r.right) / 2 - capW / 2), W - m - capW);
        y = r.top - hgt - m * .6;
        if (y < m) y = r.bottom + m * .6;
      }
      y = Math.min(Math.max(y, m * .5), H - hgt - m * .5);
      cap.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      if (t - spot.at > 1.1) cap.classList.add('on');
    }

    // ---------------------------------------------------------------- loop
    var camX = ctx.R.range(-3000, 3000), camY = ctx.R.range(-3000, 3000), slow = 1, ready = false, lastSave = 0;
    glOk = setupGL();
    layout(); waves(); ripK();
    var fontsReady = document.fonts && document.fonts.load ? document.fonts.load('700 40px "Barlow Condensed"').catch(function () {}) : Promise.resolve();
    fontsReady.then(function () { if (!dead) return buildAtlas(); }).then(function () {
      if (dead || !glOk) return;
      ready = true; place();
      requestAnimationFrame(function () { if (!dead) cv.classList.add('on'); });
    });

    function render(t) {
      if (dirty) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW); dirty = false; }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      var L = liftAmt(t), A = amp(t);
      gl.uniform2f(loc.uView, W, H); gl.uniform2f(loc.uCam, camX, camY);
      gl.uniform2f(loc.uPitch, PX, PY); gl.uniform2f(loc.uTile, TW, TH);
      gl.uniform1f(loc.uT, t); gl.uniform4fv(loc.uW1, W1); gl.uniform4fv(loc.uW2, W2); gl.uniform1f(loc.uAmp, A);
      var rc = spot ? cellScreen(spot.i, spot.j) : [0, 0];
      gl.uniform4f(loc.uRip, rc[0], rc[1], spot ? Math.max(0, t - spot.at) : 0, ripAmp(t));
      gl.uniform3f(loc.uRipK, RIP_V, RIP_SIG, RIP_K);
      gl.uniform2f(loc.uSpot, spot ? spot.i : 1e6, spot ? spot.j : 1e6);
      gl.uniform1f(loc.uLift, L); gl.uniform1f(loc.uF, F); gl.uniform1f(loc.uLiftS, LIFT_S);
      gl.uniform1f(loc.uRadF, 0.04);
      // the atlas: a texel of inset keeps a tile from bleeding into its neighbor
      var aw = ACOLS * AW, ah = Math.ceil(P / ACOLS) * AH;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform2f(loc.uUVSize, AW / aw, AH / ah); gl.uniform2f(loc.uUVInset, 1 / aw, 1 / ah);
      gl.uniform1f(loc.uMode, 0);
      attribs(buf);
      gl.drawArrays(gl.TRIANGLES, 0, slots.length * 6);
      if (spot && L > 0.001) {
        // the lifted cover last, on top, in its full art once that has loaded
        if (spot.hiOk) { gl.bindTexture(gl.TEXTURE_2D, texH); gl.uniform2f(loc.uUVSize, 1, 1); gl.uniform2f(loc.uUVInset, 0.5 / 400, 0.5 / 600); }
        gl.uniform1f(loc.uMode, 1);
        attribs(spotBuf);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      return L;
    }
    function tick(t, dt) {
      if (clockUi) clockUi.tick(t); // the time when the minute turns, and the slow wander
      if (!ready) return;
      if (every > 0) {
        if (!spot && t >= nextLift) { lift(t); nextLift = t + Math.max(every, LIFT_HOLD + 6); }
        if (spot && spot.up && t - spot.at > LIFT_HOLD) drop(t);
        if (spot && !spot.up && t - spot.downAt > 1.7 && ripAmp(t) < 0.01) spot = null;
      }
      // The cloth drifts slowly so no cover sits still; it nearly stops while a cover is up.
      slow += ((spot && spot.up ? 0.12 : 1) - slow) * Math.min(1, dt * 0.9);
      var v = 11 * ctx.u * SPD * slow, th = 0.3 + 0.6 * Math.sin(t / 173);
      camX += Math.cos(th) * v * dt; camY += Math.sin(th) * v * dt * 0.6;
      place();
      var L = render(t);
      if (spot) follow(t, L);
      if (t - lastSave > 30) { lastSave = t; store('ripple-seen', log.slice(0, 160)); }
    }
    return {
      frame: tick,
      resize: function () { dropNow(); capW = 0; capSide = 0; layout(); waves(); ripK(); if (ready) place(); },
      unmount: function () {
        dead = true; store('ripple-seen', log.slice(0, 160));
        if (atlas) atlas.width = atlas.height = 0;
        atlas = null;
        if (gl) {
          try {
            gl.deleteTexture(texA); gl.deleteTexture(texH); gl.deleteBuffer(buf); gl.deleteBuffer(spotBuf); gl.deleteProgram(prog);
            var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
          } catch (e) { /* already gone */ }
        }
        gl = null; slots = []; fillOrder = []; verts = null; cv.width = cv.height = 0;
      }
    };
  }
});
