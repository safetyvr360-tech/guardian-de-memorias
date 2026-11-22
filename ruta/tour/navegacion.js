// Navegación clara entre escenas de Guardián de Memorias.
// Se pega en 3DVista: Escena 1 → Acciones Panorama → «Ejecutar Javascript», disparador «Al Inicio».
// Cuando la flecha de salida («Arrow 02») de la escena visible aparece (la misión terminó) y ya no suena ningún
// video (la celebración acabó), muestra abajo un panel «¡Misión cumplida!» con el siguiente lugar, un botón grande
// y una cuenta regresiva: al llegar a cero, o al hacer clic, se hace clic en la flecha (abre la siguiente escena;
// en la Escena 5, el pasaporte y el certificado). La flecha 3D además late para que se note.
// La cuenta automática corre una sola vez por escena; si el jugador vuelve, el botón sigue ahí sin cuenta.
// Ojo: 3DVista mete el código en eval y escapa las comillas simples; no usar barras invertidas.
(function (tour) {
  if (window.__navegacion) return;
  window.__navegacion = true;

  var SCENES = ['1. La Plaza de los Recuerdos', '2. El Faro de los Sueños', '3. El Escudo Verde del Caribe',
    '4. La Alerta en la Desembocadura', '5. El Santuario del Manglar'];
  var NEXT = ['El Faro de los Sueños', 'El Escudo Verde del Caribe', 'La Alerta en la Desembocadura',
    'El Santuario del Manglar', null];
  var ARROW_LABEL = 'Arrow 02', AUTO_S = 15, POLL_MS = 250, QUIET_MS = 1500;
  var viewer = tour.getMainViewer();
  var autoDone = {};

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99998;display:none;' +
    'width:min(560px,90vw);background:#F3E6C8;border:3px solid #2B2B2B;border-radius:16px;padding:12px 16px 14px;' +
    'box-shadow:5px 5px 0 #2B2B2B;font-family:"Century Gothic","Segoe UI",sans-serif;color:#2B2B2B;text-align:center;';
  box.innerHTML = '<div style="font-family:Rockwell,Georgia,serif;font-weight:bold;font-size:22px;color:#1F6E43;">' +
    '¡Misión cumplida!</div>' +
    '<div data-sub style="margin:4px 0 10px;font-size:16px;"></div>' +
    '<button data-go type="button" style="cursor:pointer;font:bold 19px Rockwell,Georgia,serif;color:#fff;' +
    'background:#E1663F;border:3px solid #2B2B2B;border-radius:12px;padding:9px 22px;box-shadow:3px 3px 0 #2B2B2B;"></button>' +
    '<div data-count style="margin-top:8px;font-size:14px;color:#555;"></div>';
  document.body.appendChild(box);
  var sub = box.querySelector('[data-sub]'), go = box.querySelector('[data-go]'), count = box.querySelector('[data-count]');

  var current = { scene: -1, arrow: null, quietSince: 0, deadline: 0 };

  function sceneIndex() {
    var m = tour.getActiveMediaWithViewer(viewer), d = m && m.get('data');
    return d ? SCENES.indexOf(d.label) : -1;
  }
  function exitArrow(i) {
    var pano = tour.getMediaByName(SCENES[i]);
    if (!pano) return null;
    var list = tour.getOverlays(pano) || [];
    for (var k = 0; k < list.length; k++) {
      var d = list[k].get('data');
      if (d && d.label === ARROW_LABEL && list[k].get('enabled')) return list[k];
    }
    return null;
  }
  function videoPlaying() {   // celebración, encargo o video de bienvenida sonando (los reproductores de 3DVista)
    var players = tour.getByClassName('VideoPlayer') || [];
    for (var k = 0; k < players.length; k++) {
      try { if (players[k].get('state') === 'playing') return true; } catch (e) { }
    }
    return false;
  }
  function imagePopupOpen() {   // insignia, pasaporte, inicio o certificado abiertos encima
    var im = document.querySelectorAll('img');
    for (var k = 0; k < im.length; k++) {
      var r = im[k].getBoundingClientRect();
      if (r.width > window.innerWidth * 0.35 && r.height > window.innerHeight * 0.35 && im[k].offsetParent) return true;
    }
    return false;
  }
  function hide() { box.style.display = 'none'; current.deadline = 0; }
  function advance() {
    var arrow = current.arrow;
    hide();
    if (arrow) tour.triggerOverlay(arrow, 'click');
  }
  go.addEventListener('click', function (e) { e.stopPropagation(); autoDone[current.scene] = true; advance(); });

  var pulse = { item: null, hfov: 0, vfov: 0 };
  function setPulse(arrow, t) {
    var item = arrow ? arrow.get('items')[0] : null;
    if (pulse.item && pulse.item !== item) {
      pulse.item.set('hfov', pulse.hfov);
      if (pulse.vfov) pulse.item.set('vfov', pulse.vfov);
      pulse.item = null;
    }
    if (!item) return;
    if (pulse.item !== item) { pulse.item = item; pulse.hfov = item.get('hfov'); pulse.vfov = item.get('vfov'); }
    var k = 1 + 0.18 * Math.abs(Math.sin(t * 3));
    item.set('hfov', pulse.hfov * k);
    if (pulse.vfov) item.set('vfov', pulse.vfov * k);
  }

  setInterval(function () {
    var now = Date.now(), i = sceneIndex();
    if (i !== current.scene) { hide(); current.scene = i; current.arrow = null; current.quietSince = 0; }
    var arrow = i >= 0 ? exitArrow(i) : null;
    setPulse(arrow, now / 1000);
    if (!arrow) { hide(); current.arrow = null; return; }
    current.arrow = arrow;
    if (videoPlaying() || imagePopupOpen()) { current.quietSince = 0; hide(); return; }
    if (!current.quietSince) current.quietSince = now;
    if (now - current.quietSince < QUIET_MS) return;
    if (box.style.display === 'none') {
      sub.textContent = NEXT[i] ? 'Siguiente lugar: ' + NEXT[i] : 'Completaste las cinco misiones.';
      go.textContent = NEXT[i] ? 'Ir al siguiente lugar ➜' : 'Ver mi certificado ➜';
      box.style.display = 'block';
      current.deadline = autoDone[i] ? 0 : now + AUTO_S * 1000;
    }
    if (current.deadline) {
      var left = Math.max(0, Math.ceil((current.deadline - now) / 1000));
      count.textContent = 'Avanza solo en ' + left + ' s';
      if (left === 0) { autoDone[i] = true; advance(); }
    } else {
      count.textContent = 'Toca el botón o la flecha cuando quieras seguir.';
    }
  }, POLL_MS);
})(this);
