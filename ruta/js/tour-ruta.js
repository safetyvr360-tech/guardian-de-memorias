// Enganche de la Ruta del Guardián dentro del tour de 3DVista (lo agrega juego/ruta/build_ruta.py a index.htm/.html).
//
// Siempre: arranca los scripts del juego (celebraciones, movimiento, navegación) aunque se entre directo a una escena
// con un enlace #media=N; en 3DVista solo arrancan al entrar por la Escena 1.
//
// En modo ruta (index.htm?modo=ruta#media=N, el enlace que dan las estaciones):
// - no corre la navegación normal (que pasa sola a la escena siguiente);
// - si la escena visible no está desbloqueada en la ruta, la tapa con un aviso y un botón al mapa;
// - cuando la misión termina (aparece la flecha de salida), marca el nivel como completado y manda al jugador al
//   mapa para que camine a la siguiente estación. En el nivel 5 deja ver el certificado.
(function () {
  var RUTA = /[?&]modo=ruta(&|$)/.test(location.search);
  if (RUTA) window.__navegacion = true;          // antes de que el tour arranque: apaga el avance automático

  var SCENES = ['1. La Plaza de los Recuerdos', '2. El Faro de los Sueños', '3. El Escudo Verde del Caribe',
    '4. La Alerta en la Desembocadura', '5. El Santuario del Manglar'];
  var ARROW_LABEL = 'Arrow 02', BASE = 'ruta/';

  function cargar(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = mal;
      document.head.appendChild(s);
    });
  }

  function correr(rp, archivo) {
    return fetch(BASE + 'tour/' + archivo).then(function (r) { return r.text(); })
      .then(function (code) { new Function(code).call(rp); })
      .catch(function (err) { console.warn('[ruta] no se pudo arrancar ' + archivo, err); });
  }

  function esperarTour(listo) {
    var t = setInterval(function () {
      var rp;
      try { rp = window.tour && window.tour.player && window.tour.player.getById('rootPlayer'); } catch (e) { rp = null; }
      if (!rp || !rp.getMainViewer) return;
      var m;
      try { m = rp.getActiveMediaWithViewer(rp.getMainViewer()); } catch (e) { m = null; }
      if (!m) return;
      clearInterval(t);
      listo(rp);
    }, 300);
  }

  function escenaVisible(rp) {
    try {
      var m = rp.getActiveMediaWithViewer(rp.getMainViewer()), d = m && m.get('data');
      return d ? SCENES.indexOf(d.label) + 1 : 0;
    } catch (e) { return 0; }
  }

  function flechaSalida(rp, n) {
    var pano = rp.getMediaByName(SCENES[n - 1]);
    var list = (pano && rp.getOverlays(pano)) || [];
    for (var k = 0; k < list.length; k++) {
      var d = list[k].get('data');
      if (d && d.label === ARROW_LABEL && list[k].get('enabled')) return list[k];
    }
    return null;
  }

  function caja(css) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;z-index:99999;font-family:"Century Gothic","Segoe UI",sans-serif;color:#2B2420;' +
      'text-align:center;display:none;' + css;
    document.body.appendChild(d);
    return d;
  }
  var BTN = 'display:inline-block;margin:6px;cursor:pointer;font:bold 18px Rockwell,Georgia,serif;color:#fff;background:#E4613F;' +
    'border:3px solid #2B2420;border-radius:12px;padding:9px 18px;box-shadow:3px 3px 0 #2B2420;text-decoration:none;';

  function modoRuta(rp) {
    var P = window.GDM.progreso;
    var candado = caja('inset:0;background:rgba(15,47,45,.92);align-items:center;justify-content:center;padding:20px;');
    var panel = caja('left:50%;bottom:22px;transform:translateX(-50%);width:min(560px,92vw);background:#F3E6C8;' +
      'border:3px solid #2B2420;border-radius:16px;padding:12px 16px 14px;box-shadow:5px 5px 0 #2B2420;');
    var avisado = {};

    function mostrarCandado(n) {
      var e = P.estacion(n);
      candado.innerHTML = '<div style="max-width:440px;background:#FBF6EA;border:3px solid #2B2420;border-radius:20px;' +
        'padding:22px;box-shadow:6px 6px 0 #3FA7A0"><div style="font-size:54px">🔒</div>' +
        '<div style="font:bold 24px Rockwell,Georgia,serif;margin:6px 0">Nivel ' + n + ' bloqueado</div>' +
        '<p style="font-size:17px">Para jugarlo tienes que ir a <b>' + e.lugar + '</b> y escanear el afiche de la estación ' + n +
        ' o acercar tu celular a su NFC. ¿No puedes ir? Juégalo desde casa.</p>' +
        '<a style="' + BTN + '" href="' + BASE + P.urlCasa(n) + '">🏠 Jugar desde casa</a>' +
        '<a style="' + BTN + 'background:#257A74;" href="' + BASE + '">🗺️ Ver el mapa de la ruta</a></div>';
      candado.style.display = 'flex';
    }

    function mostrarFin(n, flecha) {
      var sig = P.estacion(n + 1);
      panel.innerHTML = '<div style="font:bold 22px Rockwell,Georgia,serif;color:#1F6E43">¡Nivel ' + n + ' completado!</div>' +
        '<div style="margin:4px 0 8px;font-size:16px">' + (sig
          ? 'Tu siguiente parada: <b>' + sig.lugar + '</b>. Camina hasta allá y escanea el afiche de la estación ' + sig.n +
            ' para ganar su sello 👣, o sigue desde casa en el mapa.'
          : '¡Terminaste la Ruta del Guardián!') + '</div>' +
        (sig ? '' : '<button data-cert type="button" style="' + BTN + '">Ver mi certificado ➜</button>') +
        '<a style="' + BTN + (sig ? '' : 'background:#257A74;') + '" href="' + BASE + '">🗺️ Ver el mapa de la ruta</a>';
      var cert = panel.querySelector('[data-cert]');
      if (cert) cert.addEventListener('click', function () { panel.style.display = 'none'; rp.triggerOverlay(flecha, 'click'); });
      panel.style.display = 'block';
    }

    setInterval(function () {
      var n = escenaVisible(rp);
      if (!n) return;
      var estado = P.estado(n);
      var abierto = estado === 'desbloqueado' || estado === 'completado';
      candado.style.display = abierto ? 'none' : 'flex';
      if (!abierto) { if (!candado.innerHTML || candado.getAttribute('data-n') !== String(n)) { mostrarCandado(n); candado.setAttribute('data-n', n); } return; }
      var flecha = flechaSalida(rp, n);
      if (!flecha) { panel.style.display = 'none'; return; }
      if (estado !== 'completado') P.completar(n);
      if (avisado[n]) return;
      // Igual que la navegación normal: esperar a que acabe la celebración y se cierren la insignia o el pasaporte.
      if (ocupado()) { quieto = 0; panel.style.display = 'none'; return; }
      if (!quieto) quieto = Date.now();
      if (Date.now() - quieto < 1500) return;
      avisado[n] = true;
      mostrarFin(n, flecha);
    }, 400);
    var quieto = 0;

    function ocupado() {
      var players = rp.getByClassName('VideoPlayer') || [];
      for (var k = 0; k < players.length; k++) {
        try { if (players[k].get('state') === 'playing') return true; } catch (e) { /* reproductor sin estado */ }
      }
      var im = document.querySelectorAll('img, video');
      for (var j = 0; j < im.length; j++) {
        var r = im[j].getBoundingClientRect();
        if (r.width > innerWidth * 0.35 && r.height > innerHeight * 0.35 && im[j].offsetParent) return true;
      }
      return false;
    }
  }

  esperarTour(function (rp) {
    correr(rp, 'popups.js');              // ventanas que se cierran solas y pausan las voces de fondo
    correr(rp, 'celebraciones.js');
    correr(rp, 'movimiento.js');
    if (!RUTA) { correr(rp, 'navegacion.js'); return; }
    cargar(BASE + 'js/config.js').then(function () { return cargar(BASE + 'js/progreso.js'); })
      .then(function () { modoRuta(rp); })
      .catch(function (err) { console.warn('[ruta] no se pudo cargar el modo ruta', err); });
  });
})();
