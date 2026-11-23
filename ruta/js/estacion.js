// Estación de la Ruta del Guardián. La abre el QR o el NFC del afiche: estacion.html?n=<nivel>&k=<clave>.
// Pasos: clave válida → orden de la ruta → GPS (si la estación tiene coordenadas) → personaje → cámara RA → desbloqueo.
(function () {
  var cfg = window.GDM_RUTA, P = window.GDM.progreso;
  var pantalla = document.getElementById('pantalla');
  var params = new URLSearchParams(location.search);
  var n = parseInt(params.get('n'), 10), clave = params.get('k') || '';
  var e = P.estacion(n);

  var INTRO = {
    1: '¡Llegaste a la <b>Plaza de los Recuerdos</b>! Los viajeros dejaron <b>cinco recuerdos</b> volando por aquí. Mueve el celular a tu alrededor y tócalos para atraparlos.',
    2: '¡Ajá, piloto! Desde aquí se ven <b>cuatro postales del Caribe</b> flotando en el aire. Gira con el celular y atrápalas antes de despegar.',
    3: 'Este es el <b>Escudo Verde del Caribe</b>. Busca a tu alrededor las <b>cuatro postales del manglar</b> y tócalas para guardarlas.',
    4: '¡Alerta! La marea trajo basura hasta aquí. Busca los <b>ocho residuos</b> a tu alrededor y recógelos tocándolos.',
    5: 'Shhh… estamos en el <b>Santuario del Manglar</b>. Los vecinos de Azulín están escondidos a tu alrededor. ¡Encuentra a los <b>seis</b>!'
  };
  var FIN = {
    1: '¡Los atrapaste todos! Ya puedes entrar a la misión de la plaza.',
    2: '¡Listo! Súbete al hidroavión y entra a la misión.',
    3: '¡Muy bien! El manglar te espera en la misión.',
    4: '¡Orilla limpia! Ahora salva la desembocadura en la misión.',
    5: '¡Los encontraste! Entra a la misión y haz el Juramento del Guardián.'
  };
  var NOMBRE = { marina: 'Marina', azulin: 'el Capitán Azulín' };

  function mostrar(html) { pantalla.innerHTML = html; window.scrollTo(0, 0); }
  function cabecera() {
    return '<div class="centro"><span class="cinta" style="background:' + e.color + '">Estación ' + e.n + ' de 5</span></div>' +
      '<h1 class="titulo" style="font-size:30px">' + e.nombre + '</h1>';
  }
  function boton(texto, href, clase) { return '<a class="btn ' + (clase || '') + '" href="' + href + '">' + texto + '</a>'; }
  var VOLVER = '<p class="centro" style="margin-top:16px">' + boton('🗺️ Ver el mapa de la ruta', './', 'sec') + '</p>';

  function invalida() {
    mostrar('<h1 class="titulo">Ups…</h1><div class="tarjeta centro"><p>Este código no es de ninguna estación de la ruta. ' +
      'Vuelve a escanear el afiche o acerca otra vez tu celular al símbolo NFC.</p></div>' + VOLVER);
  }

  function bloqueada(r) {
    var falta = P.estacion(r.falta);
    var texto = r.motivo === 'mision'
      ? 'Ya desbloqueaste el nivel ' + falta.n + ', pero te falta <b>terminar su misión 360°</b> para ganar la insignia.'
      : 'Primero tienes que ir a la estación ' + falta.n + ': <b>' + falta.lugar + '</b>.';
    var accion = r.motivo === 'mision' ? boton('Terminar el nivel ' + falta.n, P.urlMision(falta.n), 'teal')
      : boton('🧭 Cómo llegar', P.urlComoLlegar(falta));
    mostrar(cabecera() + '<p class="centro" style="font-size:60px">🔒</p><div class="tarjeta centro"><p>' + texto +
      '</p><p class="nota" style="margin-top:8px">Los niveles se desbloquean en orden, como en el juego.</p></div>' +
      '<p class="centro" style="margin-top:18px">' + accion + '</p>' + VOLVER);
  }

  function yaDesbloqueada() {
    mostrar(cabecera() + '<img class="personaje" src="assets/n' + e.n + '/insignia.webp" alt="" style="max-height:28vh">' +
      '<div class="tarjeta centro" style="margin-top:12px"><p>Ya desbloqueaste este nivel. ¡Bien hecho, guardián!</p></div>' +
      '<p class="centro" style="margin-top:18px">' + boton('Entrar a la misión 360°', P.urlMision(e.n), 'teal') + '</p>' +
      '<p class="centro" style="margin-top:14px"><button id="otra" class="btn sec" type="button">Atrapar otra vez con la cámara</button></p>' + VOLVER);
    document.getElementById('otra').addEventListener('click', intro);
  }

  function verificarGPS() {
    mostrar(cabecera() + '<p class="centro" style="font-size:54px">📍</p><div class="tarjeta centro">' +
      '<p id="gps-txt">Para abrir esta estación tienes que estar en <b>' + e.lugar + '</b>. Buscando tu ubicación…</p>' +
      '<div id="gps-dist" class="distancia" style="margin-top:8px"></div></div>' +
      '<p class="centro" style="margin-top:18px">' + boton('🧭 Cómo llegar', P.urlComoLlegar(e)) + '</p>' + VOLVER);
    if (!navigator.geolocation) {
      document.getElementById('gps-txt').innerHTML = 'Tu celular no permite saber la ubicación, y esta estación la necesita.';
      return;
    }
    var id = navigator.geolocation.watchPosition(function (pos) {
      var d = P.distancia(pos.coords.latitude, pos.coords.longitude, e.lat, e.lng);
      var margen = Math.min(pos.coords.accuracy || 0, 60);
      if (d - margen <= cfg.radioMetros) { navigator.geolocation.clearWatch(id); intro(); return; }
      document.getElementById('gps-txt').innerHTML = 'Todavía no estás en <b>' + e.lugar + '</b>. Acércate un poco más:';
      document.getElementById('gps-dist').textContent = d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km';
    }, function () {
      document.getElementById('gps-txt').innerHTML = 'Activa la <b>ubicación</b> del celular y dale permiso a esta página para abrir la estación.';
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  }

  function intro() {
    mostrar(cabecera() + GDM.RA.figura('personajes/' + e.personaje, 'assets/' + e.personaje + '.webp', NOMBRE[e.personaje], 'personaje') +
      '<div class="globo">' + INTRO[e.n] + '</div>' +
      '<p class="centro">' + '<button id="vamos" class="btn" type="button">📷 ¡Abrir la cámara!</button></p>' +
      '<p class="nota centro" style="margin-top:12px">Te pediremos permiso para usar la cámara y el movimiento del celular. ' +
      'No se graba ni se envía nada.</p>');
    document.getElementById('vamos').addEventListener('click', cazar);
  }

  function cazar() {
    window.GDM.RA.iniciar({
      estacion: e,
      textoIntro: INTRO[e.n].replace(/<[^>]+>/g, ''),
      vozIntro: 'assets/voz/intro' + e.n + '.mp3',
      vozFin: 'assets/voz/fin' + e.n + '.mp3',
      textoFin: FIN[e.n],
      alTerminar: function () { P.desbloquear(e.n); },
      botones: [
        { texto: 'Entrar a la misión 360°', href: P.urlMision(e.n), clase: 'teal' },
        { texto: '🗺️ Ver el mapa', href: './', clase: 'sec' }
      ],
      alCerrar: intro
    });
  }

  function iniciar() {
    if (!e || clave !== e.clave) return invalida();
    var estado = P.estado(n);
    if (estado === 'desbloqueado' || estado === 'completado') return yaDesbloqueada();
    var r = P.puedeDesbloquear(n);
    if (!r.ok) return bloqueada(r);
    if (P.tieneGPS(e)) return verificarGPS();
    intro();
  }

  iniciar();
})();
