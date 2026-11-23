// Progreso de la Ruta del Guardián, guardado en el navegador (localStorage, clave «gdm-ruta-v1»).
// Forma: { desbloqueados: [n], completados: [n], visitados: [n] }. «visitados» son las estaciones abiertas en persona
// (QR o NFC del afiche, con GPS si está activo): dan el sello de Guardián caminante. Desde casa se desbloquea sin sello.
// Lo usan el mapa, las estaciones y el tour (tour-ruta.js). Requiere config.js antes.
(function () {
  var KEY = 'gdm-ruta-v1';
  var LISTAS = ['desbloqueados', 'completados', 'visitados'];
  var cfg = window.GDM_RUTA;

  function vacio() { return { desbloqueados: [], completados: [], visitados: [] }; }

  function leer() {
    var out = vacio();
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '{}');
      LISTAS.forEach(function (k) { if (Array.isArray(d[k])) out[k] = d[k].slice(); });
    } catch (e) { /* progreso dañado o sin acceso: se empieza de cero */ }
    return out;
  }

  function guardar(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }

  function agregar(lista, n) {
    var d = leer();
    if (d[lista].indexOf(n) === -1) {
      d[lista] = d[lista].concat([n]);
      guardar(d);
    }
    return d;
  }

  function estacion(n) {
    for (var i = 0; i < cfg.estaciones.length; i++) if (cfg.estaciones[i].n === n) return cfg.estaciones[i];
    return null;
  }

  function estado(n) {
    var d = leer();
    if (d.completados.indexOf(n) !== -1) return 'completado';
    if (d.desbloqueados.indexOf(n) !== -1) return 'desbloqueado';
    return puedeDesbloquear(n).ok ? 'siguiente' : 'bloqueado';
  }

  // ¿Se puede desbloquear el nivel n ahora? Devuelve { ok, motivo, falta }.
  function puedeDesbloquear(n) {
    if (n === 1) return { ok: true };
    var d = leer(), prev = n - 1;
    if (d.desbloqueados.indexOf(prev) === -1) return { ok: false, motivo: 'anterior', falta: prev };
    if (cfg.exigirMisionAnterior && d.completados.indexOf(prev) === -1) return { ok: false, motivo: 'mision', falta: prev };
    return { ok: true };
  }

  function siguiente() {
    for (var i = 0; i < cfg.estaciones.length; i++) {
      var e = cfg.estaciones[i];
      if (estado(e.n) !== 'completado') return e;
    }
    return null;
  }

  // Distancia en metros entre dos puntos (fórmula del haversine).
  function distancia(lat1, lng1, lat2, lng2) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function tieneGPS(e) {
    return cfg.verificarGPS && typeof e.lat === 'number' && typeof e.lng === 'number';
  }

  function urlMision(n, base) {
    return (base || cfg.tour) + '?modo=ruta#media=' + n;
  }

  function urlComoLlegar(e) {
    return tieneGPS(e) ? 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + e.lat + ',' + e.lng
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.lugar + ', Puerto Colombia, Atlántico');
  }

  window.GDM = window.GDM || {};
  window.GDM.progreso = {
    leer: leer, estacion: estacion, estado: estado, puedeDesbloquear: puedeDesbloquear, siguiente: siguiente,
    desbloquear: function (n) { return agregar('desbloqueados', n); },
    completar: function (n) { agregar('desbloqueados', n); return agregar('completados', n); },
    visitar: function (n) { return agregar('visitados', n); },
    visitado: function (n) { return leer().visitados.indexOf(n) !== -1; },
    reiniciar: function () { return guardar(vacio()); },
    distancia: distancia, tieneGPS: tieneGPS, urlMision: urlMision, urlComoLlegar: urlComoLlegar,
    urlCasa: function (n) { return 'estacion.html?n=' + n + '&casa=1'; }
  };
})();
