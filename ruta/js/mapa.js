// Mapa de la Ruta del Guardián: dibuja las 5 estaciones con su estado y las acciones que tocan.
(function () {
  var cfg = window.GDM_RUTA, P = window.GDM.progreso;
  var camino = document.getElementById('camino');
  var ETIQUETA = { completado: '🏅 Insignia ganada', desbloqueado: '✅ Desbloqueado', siguiente: '📍 Tu siguiente parada',
    bloqueado: '🔒 Bloqueado' };

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }

  function acciones(e, estado) {
    var box = el('div', { class: 'acciones' });
    if (estado === 'desbloqueado' || estado === 'completado') {
      box.appendChild(el('a', { class: 'btn teal', href: P.urlMision(e.n), style: 'font-size:15px;padding:8px 16px 10px' },
        estado === 'completado' ? 'Repetir la misión' : 'Entrar a la misión 360°'));
    }
    if (estado === 'siguiente') {
      box.appendChild(el('a', { class: 'btn', href: P.urlComoLlegar(e), target: '_blank', rel: 'noopener',
        style: 'font-size:15px;padding:8px 16px 10px' }, '🧭 Cómo llegar'));
      box.appendChild(el('a', { class: 'btn sec', href: P.urlCasa(e.n), style: 'font-size:14px' }, '🏠 Jugar desde casa'));
      if (P.tieneGPS(e)) {
        var b = el('button', { class: 'btn sec', type: 'button', style: 'font-size:14px' }, '¿Qué tan lejos estoy?');
        b.addEventListener('click', function () { medir(e, b); });
        box.appendChild(b);
      }
    }
    return box;
  }

  function medir(e, boton) {
    if (!navigator.geolocation) { boton.textContent = 'Tu celular no da la ubicación'; return; }
    boton.textContent = 'Buscando tu ubicación…';
    navigator.geolocation.watchPosition(function (pos) {
      var d = P.distancia(pos.coords.latitude, pos.coords.longitude, e.lat, e.lng);
      boton.textContent = d < 1000 ? 'Estás a ' + Math.round(d) + ' m' : 'Estás a ' + (d / 1000).toFixed(1) + ' km';
    }, function () {
      boton.textContent = 'Activa la ubicación para medir';
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }

  function parada(e) {
    var estado = P.estado(e.n);
    var p = el('article', { class: 'parada ' + estado });
    var nodo = el('div', { class: 'nodo' + (estado === 'siguiente' ? ' pulso' : ''), style: 'background:' + e.color });
    if (estado === 'completado') nodo.appendChild(el('img', { src: 'assets/n' + e.n + '/insignia.webp', alt: 'Insignia ' + e.insignia }));
    else nodo.textContent = e.n;
    if (estado === 'bloqueado') nodo.appendChild(el('span', { class: 'candado' }, '🔒'));
    var info = el('div', { class: 'info' });
    info.appendChild(el('span', { class: 'chip' }, ETIQUETA[estado]));
    if (P.visitado(e.n)) info.appendChild(el('span', { class: 'chip sello', title: 'Fuiste en persona a esta estación' }, '👣 Sello caminante'));
    info.appendChild(el('h3', { style: 'margin-top:6px' }, 'Nivel ' + e.n + ' · ' + e.nombre));
    info.appendChild(el('p', {}, '📌 ' + e.lugar + (estado === 'completado' ? ' · ' + e.insignia : '')));
    info.appendChild(acciones(e, estado));
    p.appendChild(nodo);
    p.appendChild(info);
    return p;
  }

  function consejo(d, sig) {
    if (!sig) return '¡Completaste la ruta! Eres Guardián de Memorias de Puerto Colombia. 🦀';
    var est = P.estado(sig.n);
    if (est === 'desbloqueado') return 'Ya desbloqueaste el nivel ' + sig.n + '. Entra a su misión 360° y termínala.';
    if (d.desbloqueados.length === 0) return 'Empieza en la ' + sig.lugar + ': busca el afiche de la estación 1, o juega el nivel 1 desde casa.';
    return 'Ve a ' + sig.lugar + ' y escanea el afiche de la estación ' + sig.n + ', o sigue desde casa.';
  }

  function sellos(d, total) {
    var n = d.visitados.length;
    if (n === total) return '👣 ¡Eres Guardián caminante! Visitaste las ' + total + ' estaciones en persona.';
    return '👣 Sellos de caminante: ' + n + ' de ' + total + (n ? '' : ' · se ganan yendo a cada afiche en persona');
  }

  function render() {
    var d = P.leer(), total = cfg.estaciones.length;
    document.getElementById('cuenta').textContent = d.completados.length + ' de ' + total + ' insignias';
    document.getElementById('sellos').textContent = sellos(d, total);
    document.getElementById('barra').style.width = (100 * d.completados.length / total) + '%';
    document.getElementById('consejo').textContent = consejo(d, P.siguiente());
    camino.innerHTML = '';
    cfg.estaciones.forEach(function (e) { camino.appendChild(parada(e)); });
  }

  document.getElementById('reiniciar').addEventListener('click', function () {
    if (confirm('¿Seguro? Se borra tu progreso de la ruta en este celular.')) { P.reiniciar(); render(); }
  });
  window.addEventListener('pageshow', render);
  render();
})();
