// Celebraciones de Guardián de Memorias: al cerrar la insignia de una escena, 3DVista muestra su flecha
// de salida («Arrow 02»); este script lo nota y abre el clip celebracion-N de esa escena.
// Se pega en 3DVista: Escena 1 → Acciones Panorama → «Ejecutar Javascript», disparador «Al Inicio».
// Cada escena tiene un hotspot oculto llamado «celebracion» cuya acción (al hacer clic) es el Video Popup
// celebracion-N.webm; el script dispara ese clic. Corre una sola vez por sesión aunque se vuelva a la Escena 1.
(function (tour) {
  var SCENES = ['1. La Plaza de los Recuerdos', '2. El Faro de los Sueños', '3. El Escudo Verde del Caribe',
    '4. La Alerta en la Desembocadura', '5. El Santuario del Manglar'];
  var ARROW_LABEL = 'Arrow 02', CLIP_LABEL = 'celebracion', POLL_MS = 400;
  if (window.__celebraciones) return;
  window.__celebraciones = true;

  var watched = [];
  for (var i = 0; i < SCENES.length; i++) {
    var pano = tour.getMediaByName(SCENES[i]);
    if (!pano) continue;
    var overlays = tour.getOverlays(pano), arrows = [], clip = null;
    for (var j = 0; j < overlays.length; j++) {
      var d = overlays[j].get('data'), label = d && d.label;
      if (label === CLIP_LABEL) clip = overlays[j];
      else if (label === ARROW_LABEL && !overlays[j].get('enabled')) arrows.push(overlays[j]);
    }
    if (clip && arrows.length) watched.push({ arrows: arrows, clip: clip, played: false });
  }

  var timer = setInterval(function () {
    var pending = 0;
    for (var k = 0; k < watched.length; k++) {
      var w = watched[k];
      if (w.played) continue;
      pending++;
      for (var a = 0; a < w.arrows.length; a++) {
        if (w.arrows[a].get('enabled')) { w.played = true; tour.triggerOverlay(w.clip, 'click'); break; }
      }
    }
    if (!pending) clearInterval(timer);
  }, POLL_MS);
})(this);
