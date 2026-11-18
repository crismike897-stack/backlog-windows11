/* Ripple 2: the same op-art cloth as Ripple, with a deeper swell that travels a little faster. Same options as
   Ripple, under config.sceneOptions.ripple2 (amplitude defaults to 1.7, speed to 1.35). */
BACKLOG.scene(Object.assign({}, BACKLOG.registry.ripple, {
  id: 'ripple2', name: 'Ripple 2', label: 'RIPPLE 2',
  defaults: { amplitude: 1.7, speed: 1.35 }
}));
