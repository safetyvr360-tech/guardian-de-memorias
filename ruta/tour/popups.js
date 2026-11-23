// Ventanas (popups) de Guardián de Memorias que se cierran solas y no se pisan con otras voces.
//
// - Tarjetas, insignias, pasaporte y certificado (todas pasan por showPopupImage, también las que 3DVista abre con
//   showPopupPanoramaOverlay): mientras están abiertas se pausan las demás voces y el video del personaje, y se
//   reanudan al cerrarse. Cuando termina la voz de la ventana (o tras SIN_VOZ_S si no tiene voz) aparece un contador
//   y la ventana se cierra sola, sin tener que tocar la X.
// - Videos en ventana (bienvenida, encargo, celebración, con showPopupMedia): pausan las voces de fondo y se cierran
//   solos al terminar el video.
//
// Lo arranca ruta/js/tour-ruta.js (lo copia juego/ruta/build_ruta.py) con this = rootPlayer, en cualquier escena.
(function (tour) {
  if (window.__popups) return;
  window.__popups = true;

  var ESPERA_S = 5;          // segundos de contador después de que termina la voz de la ventana
  var SIN_VOZ_S = 9;         // ventanas sin voz: tiempo para mirarlas antes del contador
  var VOZ_MAX_S = 60;        // por si el navegador no avisa el final del audio
  var MIN_S = 7;             // mínimo abierta antes del contador (por si la voz no suena y termina al instante)

  var pill = document.createElement('div');
  pill.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100000;display:none;' +
    'font:bold 16px "Century Gothic","Segoe UI",sans-serif;color:#2B2420;background:#E8B43A;border:3px solid #2B2420;' +
    'border-radius:30px;padding:6px 16px;box-shadow:3px 3px 0 #2B2420;cursor:pointer;user-select:none';
  pill.title = 'Toca para cerrar ya';
  document.body.appendChild(pill);

  var activa = null;         // la ventana con contador en curso

  function limpiar(v) {
    if (!v) return;
    clearInterval(v.tic);
    clearTimeout(v.espera);
    if (v.audio && v.alTerminar) v.audio.unbind('end', v.alTerminar, tour);
    if (activa === v) { activa = null; pill.style.display = 'none'; }
  }

  function cerrar(v) {
    if (v.cerrada) return;
    v.cerrada = true;
    limpiar(v);
    try { v.cerrarFn(); } catch (err) { console.warn('[popups] no se pudo cerrar la ventana', err); }
  }

  function contar(v) {
    if (v.cerrada) return;
    var quedan = ESPERA_S;
    activa = v;
    pill.textContent = 'Se cierra en ' + quedan + ' s ✕';
    pill.style.display = 'block';
    pill.onclick = function () { cerrar(v); };
    v.tic = setInterval(function () {
      quedan--;
      if (quedan <= 0) { cerrar(v); return; }
      pill.textContent = 'Se cierra en ' + quedan + ' s ✕';
    }, 1000);
  }

  // Espera a que termine la voz de la ventana; si no tiene voz, deja un rato para mirarla.
  function programar(v) {
    if (!v.audio) { v.espera = setTimeout(function () { contar(v); }, SIN_VOZ_S * 1000); return; }
    var abierta = Date.now();
    v.alTerminar = function () {
      clearTimeout(v.espera);
      v.espera = setTimeout(function () { contar(v); }, Math.max(0, abierta + MIN_S * 1000 - Date.now()));
    };
    v.audio.bind('end', v.alTerminar, tour);
    v.espera = setTimeout(v.alTerminar, VOZ_MAX_S * 1000);
  }

  var showImage = tour.showPopupImage;
  // Parámetros de 3DVista: a imagen, b imagen al clic, c/d tamaño, e/f efectos, g botón cerrar, h cierre automático (ms),
  // i audio de la ventana, j pausar las voces de fondo, k al mostrar, l al ocultar, m, n.
  tour.showPopupImage = function (a, b, c, d, e, f, g, h, i, j, k, l, m, n) {
    var v = { audio: i || null, cerrada: false };
    var alOcultar = function () { v.cerrada = true; limpiar(v); if (l) l.apply(this, arguments); };
    limpiar(activa);
    v.cerrarFn = showImage.call(this, a, b, c, d, e, f, g, h, i, true, k, alOcultar, m, n);
    if (!h && typeof v.cerrarFn === 'function') programar(v);
    return v.cerrarFn;
  };

  var showMedia = tour.showPopupMedia;
  // a ventana, b video, c lista, d/e tamaño, f cerrar al terminar.
  tour.showPopupMedia = function (a, b, c, d, e, f) {
    this.pauseGlobalAudios(null, true);
    var alCerrar = function () {
      a.unbind('close', alCerrar, this);
      this.resumeGlobalAudios();
    };
    a.bind('close', alCerrar, this);
    return showMedia.call(this, a, b, c, d, e, true);
  };
})(this);
