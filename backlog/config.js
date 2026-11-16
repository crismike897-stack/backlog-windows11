/* Backlog settings. Change anything here, save, then reopen the screensaver (or restart Steam).
   Leave a line out and its default is used. */
window.BACKLOG_CONFIG = {
  // Which scenes to play, in order, or 'all'. The main four: mosaic, drift, flip, ripple. Also included: ripple2
  // (a deeper Ripple). Add it to the list if you like: ['mosaic', 'drift', 'flip', 'ripple', 'ripple2'].
  // The installer can set this line and the minutes for you: run it again and pick.
  scenes: ['mosaic', 'drift', 'flip', 'ripple'],
  shuffle: true,          // a random order (never the same one twice in a row); false plays them as listed above
  minutesPerScene: 5,     // how long each scene stays
  transition: 'tv',       // tv (the picture folds to a line and the next opens from one), fade, glitch or cut

  // style: the clock in the lower-left corner of the cover scenes (Drift, Flip, Mosaic, Ripple and the rest):
  // 'label' (a museum placard), 'thin' (big light figures), 'segment' (the seven-segment clock) or 'caption' (a tall
  // condensed clock under a LOCAL TIME heading). One scene can have its own: sceneOptions: { mosaic: { clockStyle: 'thin' } }.
  clock: { hour12: true, seconds: false, style: 'label' },

  // clock: 'auto' shows each scene's clock, 'never' hides the clock everywhere, 'always' swaps it for a small
  // plain clock in a corner. date, battery and idle are that small clock's extra lines.
  overlay: { clock: 'auto', date: true, battery: true, idle: true },

  // Care for OLED screens (the Steam Deck OLED, OLED TVs): nothing bright sits still for long.
  // pixelShift nudges the whole picture a few pixels every minute. dim is the brightness (1 = full).
  // nightDim lowers it between those hours (24-hour clock).
  // blackAfterMinutes: after this long, fade to black and rest the screen (0 = never); blackClock keeps a faint
  // wandering clock on the black.
  oled: { pixelShift: true, shiftPx: 10, dim: 1, nightDim: { from: 23, to: 7, level: 0.6 }, blackAfterMinutes: 0, blackClock: true },

  // Favorites: the whole library still fills the scenes, but only these games step into the spotlight and make
  // Mosaic's pictures, the first one first. Leave it empty for any game. For example: featured: ['Lies of P', 'Bloodborne']
  featured: [],

  // Which games to show. recentDays: only games played in the last N days (0 = all).
  // minMinutes: skip games with less playtime. exclude: app ids or names to never show.
  // merge: show several entries as one game, hours added up. Entries with the same name join on their own;
  // list differently named ones together, the name to show first.
  library: { recentDays: 0, minMinutes: 0, exclude: [], merge: [] },

  // Games Steam doesn't know about (PlayStation, Switch, other launchers). Art is optional: put your own images in
  // the my-art folder and name them here. Without a cover, the game's name is drawn in type.
  extraGames: [
    // { name: 'Hollow Knight: Silksong', hours: 12, lastPlayed: '2026-10-01', cover: 'my-art/silksong-cover.jpg', hero: 'my-art/silksong-wide.jpg' }
  ],

  // Per-scene settings, for example: sceneOptions: { mosaic: { cycle: 48 } }
  sceneOptions: {}
};
