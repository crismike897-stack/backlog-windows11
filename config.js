(function() {
  window.BACKLOG_CONFIG = {
    scenes: ['drift', 'flip', 'mosaic', 'ripple', 'ripple2'],
    shuffle: true, minutesPerScene: 2, transition: 'tv',
    clock: { hour12: true, seconds: false, style: 'label' },
    overlay: { clock: 'auto', date: true, battery: true, idle: true },
    oled: { pixelShift: true, shiftPx: 10, dim: 1, nightDim: { from: 23, to: 7, level: 0.6 }, blackAfterMinutes: 0, blackClock: true },
    tier1Games: [], tier2Games: [], library: { recentDays: 0, minMinutes: 0, exclude: [], merge: [] }, extraGames: [],
    sceneOptions: { drift: { focus: false }, mosaic: { look: "crisp" } }
  };
})();
