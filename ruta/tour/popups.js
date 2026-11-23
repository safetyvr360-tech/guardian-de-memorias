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
  // Ventanas que nunca se cierran solas: la pantalla de inicio espera el toque de «¡Empezar!», que es el que deja
  // sonar el audio en el celular. Es el id de su imagen en la exportación de 3DVista.
  var SIN_CIERRE = ['DC967C06_F934_E2FD_41B6_0AE3D7737944'];

  var pill = document.createElement('div');
  pill.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100000;display:none;' +
    'font:bold 16px "Century Gothic","Segoe UI",sans-serif;color:#2B2420;background:#E8B43A;border:3px solid #2B2420;' +
    'border-radius:30px;padding:6px 16px;box-shadow:3px 3px 0 #2B2420;cursor:pointer;user-select:none';
  pill.title = 'Toca para cerrar ya';
  document.body.appendChild(pill);

  var activa = null;         // la ventana con contador en curso
  var actual = null;         // la tarjeta abierta ahora (3DVista tiene un solo visor de imagen: una a la vez)
  var videos = 0;            // videos en ventana abiertos ahora
  var esperando = 0;         // preguntas que esperan a que se cierre la ventana
  var PAUSA_PREGUNTA_MS = 700;   // respiro entre cerrar la tarjeta y mostrar la pregunta
  var PREGUNTA_MAX_S = 90;       // la pregunta sale igual pasado este tiempo, por si algo no avisa

  var registro = [];
  function anotar(t) { registro.push(Math.round(performance.now() / 100) / 10 + 's ' + t); if (registro.length > 40) registro.shift(); }
  // Para revisar desde la consola: window.__popupsEstado()
  window.__popupsEstado = function () {
    return { hayVentana: hayVentana(), conContador: !!activa, videos: videos, preguntasEsperando: esperando, log: registro.slice() };
  };

  function urlImagen(img) {
    try { var lv = img.get('levels') || []; return String(lv[0] && lv[0].get('url') || img.get('id') || ''); }
    catch (err) { return ''; }
  }

  function visible(c) { try { return !!(c && c.get('visible')); } catch (err) { return false; } }

  // ¿Hay una tarjeta, una ventana 3D de objeto o un video tapando la pantalla?
  function hayVentana() {
    if (videos > 0 || visible(tour.zoomImagePopupPanorama)) return true;
    var pops = tour.getByClassName('PopupPanoramaOverlay') || [];
    for (var k = 0; k < pops.length; k++) if (visible(pops[k])) return true;
    return false;
  }

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
    anotar('abre imagen ' + urlImagen(a) + (i ? ' con voz ' + ((i.get('data') || {}).label || '') : ''));
    var alOcultar = function () {
      anotar('cierra imagen');
      v.cerrada = true;
      limpiar(v);
      if (l) l.apply(this, arguments);
    };
    // Si 3DVista reemplaza una tarjeta por otra sin cerrarla, la anterior deja de contar.
    if (actual) { actual.cerrada = true; limpiar(actual); }
    limpiar(activa);
    actual = v;
    v.cerrarFn = showImage.call(this, a, b, c, d, e, f, g, h, i, true, k, alOcultar, m, n);
    var url = urlImagen(a);
    var fija = SIN_CIERRE.some(function (id) { return url.indexOf(id) !== -1; });
    if (!h && !fija && typeof v.cerrarFn === 'function') programar(v);
    return v.cerrarFn;
  };

  var showMedia = tour.showPopupMedia;
  // a ventana, b video, c lista, d/e tamaño, f cerrar al terminar.
  tour.showPopupMedia = function (a, b, c, d, e, f) {
    this.pauseGlobalAudios(null, true);
    videos++;
    anotar('abre video');
    var alCerrar = function () {
      a.unbind('close', alCerrar, this);
      videos = Math.max(0, videos - 1);
      anotar('cierra video');
      this.resumeGlobalAudios();
    };
    a.bind('close', alCerrar, this);
    return showMedia.call(this, a, b, c, d, e, true);
  };

  // Las preguntas (al encontrar el último objeto) esperan a que se cierre la tarjeta o el video que esté abierto,
  // en vez de salir encima. Se empieza a mirar un instante después porque la tarjeta y la pregunta se lanzan casi a
  // la vez (la tarjeta 3D del objeto tarda en abrirse).
  var REVISAR_MS = 300, PRIMERA_MIRADA_MS = 600;
  var showQuestion = tour.quizShowQuestion;
  tour.quizShowQuestion = function () {
    var self = this, args = arguments, inicio = Date.now();
    anotar('pide pregunta ' + args[0]);
    return new Promise(function (ok, mal) {
      function lanzar() {
        esperando = Math.max(0, esperando - 1);
        anotar('muestra pregunta ' + args[0]);
        var r = showQuestion.apply(self, args);
        if (r && typeof r.then === 'function') r.then(ok, mal); else ok(r);
      }
      function revisar() {
        if (hayVentana() && Date.now() - inicio < PREGUNTA_MAX_S * 1000) { setTimeout(revisar, REVISAR_MS); return; }
        setTimeout(lanzar, PAUSA_PREGUNTA_MS);
      }
      esperando++;
      setTimeout(revisar, PRIMERA_MIRADA_MS);
    });
  };
})(this);
