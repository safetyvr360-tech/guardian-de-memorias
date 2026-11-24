// Videos verticales en el celular. Los videos de ventana (encargo y celebración) tienen una versión 9:16 en
// media/vertical/ (la crea juego/ruta/videos_web.py). Cuando el tour se abre en un celular (el mismo aviso que usa
// 3DVista para su skin de celular) y la pantalla está de pie, cada video que tenga versión vertical se cambia por ella.
// Si se gira el celular, el cambio vale para los videos que se abran después.
//
// Lo arranca ruta/js/tour-ruta.js (lo copia juego/ruta/build_ruta.py) con this = rootPlayer.
(function (tour) {
  if (window.__videosVerticales) return;
  window.__videosVerticales = true;

  // Ids de los archivos con versión vertical: encargo 1-5 y celebración 1-5.
  var VERTICALES = ['0D1D835B', 'D50C8E6C', '0D1939F2', '0D7CD59B', '0D0963F0',
    '0D0B2205', '0D111491', '0D0822C6', '0D0E510D', '0D0F7F41'];
  var ANCHO_V = 540, ALTO_V = 960;
  var CELULAR_MAX_PX = 900;      // lado corto de pantalla por debajo del cual se trata como celular

  function esCelular() {
    var api = window.TDV && TDV.PlayerAPI && TDV.PlayerAPI.mobile;
    var tactil = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    return !!api || (tactil && Math.min(screen.width, screen.height) < CELULAR_MAX_PX);
  }
  function dePie() { return window.innerHeight >= window.innerWidth; }

  // Para cada nivel de video con versión vertical guarda la original y sus medidas.
  var niveles = [];
  (tour.getByClassName('VideoResourceLevel') || []).forEach(function (nivel) {
    var url = String(nivel.get('url') || '');
    var id = VERTICALES.filter(function (v) { return url.indexOf('/video_' + v + '_') !== -1; })[0];
    if (!id) return;
    niveles.push({
      nivel: nivel,
      video: window.tour.player.getById('video_' + url.split('/video_')[1].split('_es.mp4')[0]),
      original: { url: url, ancho: nivel.get('width'), alto: nivel.get('height') },
      vertical: url.replace('/media/video_', '/media/vertical/video_')
    });
  });

  function medidas(obj, ancho, alto) {
    if (!obj) return;
    try { obj.set('width', ancho); obj.set('height', alto); } catch (err) { /* objeto sin medidas */ }
  }

  var modo = null;
  function aplicar() {
    var vertical = esCelular() && dePie();
    if (vertical === modo) return;
    modo = vertical;
    niveles.forEach(function (n) {
      var ancho = vertical ? ANCHO_V : n.original.ancho, alto = vertical ? ALTO_V : n.original.alto;
      n.nivel.set('url', vertical ? n.vertical : n.original.url);
      medidas(n.nivel, ancho, alto);
      medidas(n.video, ancho, alto);
    });
  }

  aplicar();
  window.addEventListener('resize', aplicar);
  window.__videosEstado = function () { return { vertical: modo, niveles: niveles.length, celular: esCelular() }; };
})(this);
