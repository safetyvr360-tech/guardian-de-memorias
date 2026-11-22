// Movimiento de los objetos del juego Guardián de Memorias (cangrejos que caminan, basura que flota, etc.).
// Se pega en 3DVista: Escena 1 → Acciones Panorama → «Ejecutar Javascript», disparador «Al Inicio».
// Técnica (probada en el reproductor 3DVista v2379): cada hotspot de imagen tiene items[0] con yaw, pitch, hfov,
// vfov y roll; al cambiarlos con .set() el dibujo y la zona de clic se mueven juntos. Solo se anima la escena
// visible y solo los hotspots visibles (los objetos ya encontrados se ocultan y dejan de moverse).
// Movimientos pequeños y lentos: los niños tienen que poder hacer clic.
// Ojo: 3DVista mete el código en eval('...'); no usar \' dentro de cadenas.
(function (tour) {
  if (window.__movimiento) return;
  window.__movimiento = true;

  var TAU = Math.PI * 2;
  var MOVES = {
    flotar: function (t, ph) { return { pitch: 0.25 * Math.sin(t * 1.1 + ph), roll: 2 * Math.sin(t * 0.8 + ph) }; },
    girar: function (t, ph) { return { roll: (t * 40 + ph * 57) % 360, pitch: 0.2 * Math.sin(t + ph) }; },
    faro: function (t, ph) { return { scale: 1 + 0.07 * Math.sin(t * 3 + ph) }; },
    marea: function (t, ph) { return { yaw: 0.6 * Math.sin(t * 0.5 + ph), pitch: 0.3 * Math.sin(t * 0.9 + ph), roll: 5 * Math.sin(t * 0.9 + ph + 1) }; },
    cangrejo: function (t, ph) {
      var walk = Math.sin(t * 0.9 + ph);
      var step = Math.abs(Math.sin(t * 5 + ph));
      return { yaw: 3.5 * walk, pitch: 0.3 * step, roll: 4 * Math.sin(t * 5 + ph) };
    },
    pez: function (t, ph) {
      var x = Math.sin(t * 0.7 + ph);
      return { yaw: 2.5 * x, pitch: 0.6 * Math.sin(t * 1.4 + ph), roll: 8 * Math.cos(t * 0.7 + ph) };
    },
    camaron: function (t, ph) { return { roll: 12 * Math.sin(t * 4 + ph), pitch: 0.2 * Math.sin(t * 1.3 + ph) }; },
    garza: function (t, ph) { return { pitch: 0.2 * Math.sin(t * 0.8 + ph), roll: 2 * Math.sin(t * 0.6 + ph) }; },
    respirar: function (t, ph) { return { scale: 1 + 0.06 * Math.sin(t * 2.2 + ph) }; }
  };
  var BY_LABEL = {
    maleta: 'flotar', olla: 'flotar', acordeon: 'flotar', ventana: 'flotar', helice: 'girar',
    marcador: 'faro', alerta: 'faro',
    botella: 'marea', bolsa: 'marea', tapa: 'marea', pitillo: 'marea', red: 'marea', lata: 'marea',
    icopor: 'marea', zapato: 'marea',
    cangrejo1: 'cangrejo', cangrejo2: 'cangrejo', cangrejo3: 'cangrejo',
    pez: 'pez', camaron: 'camaron', garza: 'garza',
    'boton-pista': 'respirar'
  };
  var FRAME_MS = 33;

  var bases = [];
  function baseOf(item) {
    for (var i = 0; i < bases.length; i++) if (bases[i].item === item) return bases[i];
    var b = { item: item, yaw: item.get('yaw'), pitch: item.get('pitch'), hfov: item.get('hfov'),
      vfov: item.get('vfov'), roll: item.get('roll') || 0, phase: Math.random() * TAU };
    bases.push(b);
    return b;
  }

  var viewer = tour.getMainViewer(), last = 0, t0 = Date.now();
  function frame() {
    window.requestAnimationFrame(frame);
    var now = Date.now();
    if (now - last < FRAME_MS) return;
    last = now;
    var t = (now - t0) / 1000;
    var pano = tour.getActiveMediaWithViewer(viewer);
    if (!pano) return;
    var overlays = tour.getOverlays(pano) || [];
    for (var i = 0; i < overlays.length; i++) {
      var o = overlays[i], d = o.get('data'), move = d && MOVES[BY_LABEL[d.label]];
      if (!move || !o.get('enabled')) continue;
      var items = o.get('items');
      if (!items || !items.length) continue;
      var b = baseOf(items[0]), m = move(t, b.phase), it = b.item;
      it.set('yaw', b.yaw + (m.yaw || 0));
      it.set('pitch', b.pitch + (m.pitch || 0));
      if (m.roll !== undefined) it.set('roll', b.roll + m.roll);
      if (m.scale !== undefined) { it.set('hfov', b.hfov * m.scale); if (b.vfov) it.set('vfov', b.vfov * m.scale); }
    }
  }
  window.requestAnimationFrame(frame);
})(this);
