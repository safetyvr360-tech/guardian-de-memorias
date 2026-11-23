// Cámara de realidad aumentada estilo Pokémon Go para la Ruta del Guardián.
// Los objetos del nivel quedan fijos a tu alrededor (en grados de brújula); giras el celular para buscarlos y los
// tocas para atraparlos. Usa la cámara trasera y el giroscopio. Sin giroscopio se mira arrastrando el dedo, y sin
// cámara se ve la panorámica del nivel de fondo. No graba ni envía nada.
(function () {
  var HFOV = 50;            // grados que se ven de lado a lado de la pantalla en vertical
  var SUAVE = 0.25;         // suavizado del giroscopio (0 = quieto, 1 = sin suavizar)
  var COLORES = ['#E4613F', '#E8B43A', '#3FA7A0', '#5B789E', '#FBF6EA'];

  function wrap(a) { a = (a + 540) % 360 - 180; return a; }
  function rad(d) { return d * Math.PI / 180; }

  // Dirección a la que apunta la cámara trasera, a partir de alpha/beta/gamma (matriz ZXY de la especificación W3C).
  function orientacion(ev) {
    var a = rad(ev.alpha || 0), b = rad(ev.beta || 0), g = rad(ev.gamma || 0);
    var cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
    var x = -(cG * sA * sB + cA * sG), y = -(sA * sG - cA * cG * sB), z = -cB * cG;
    // Solo importa el giro relativo al primer dato (los objetos se reparten desde ahí), no el norte real.
    var rumbo = Math.atan2(x, y) * 180 / Math.PI;
    return { yaw: rumbo, pitch: Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI };
  }

  function sonido(ctx) {
    if (!ctx) return;
    try {
      var t = ctx.currentTime, o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(1760, t + 0.22);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(gn).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    } catch (err) { /* sin sonido no pasa nada */ }
  }

  function confeti(raiz) {
    for (var i = 0; i < 40; i++) {
      var c = document.createElement('i');
      c.className = 'confeti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = COLORES[i % COLORES.length];
      c.style.animationDuration = (2 + Math.random() * 2) + 's';
      c.style.animationDelay = Math.random() * 0.8 + 's';
      raiz.appendChild(c);
    }
  }

  // Modelo 3D de Meshy (assets/3d/<ruta>.glb) girando solo, con el dibujo como póster mientras carga.
  // Si los modelos 3D están apagados en config.js o el navegador no carga <model-viewer>, queda el dibujo.
  function figura(ruta3d, dibujo, alt, clase) {
    var usar3d = window.GDM_RUTA && window.GDM_RUTA.modelos3d && window.customElements;
    if (!usar3d) return '<img class="' + (clase || '') + '" src="' + dibujo + '" alt="' + alt + '">';
    return '<model-viewer class="' + (clase || '') + '" src="assets/3d/' + ruta3d + '.glb" poster="' + dibujo + '" alt="' + alt +
      '" auto-rotate auto-rotate-delay="0" rotation-per-second="40deg" interaction-prompt="none" disable-zoom disable-pan' +
      ' disable-tap shadow-intensity="0" exposure="1.1" loading="eager" reveal="auto"></model-viewer>';
  }

  function iniciar(op) {
    var e = op.estacion;
    var voz = new Audio(op.vozIntro);
    voz.play().catch(function () { });          // dentro del toque del jugador: deja el audio desbloqueado en iPhone
    var ctx = null;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { ctx = null; }
    var pedirGiro = window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function'
      ? DeviceOrientationEvent.requestPermission().catch(function () { return 'denied'; }) : Promise.resolve('granted');

    var raiz = document.createElement('div');
    raiz.id = 'ra';
    raiz.innerHTML = '<video playsinline muted autoplay></video><div class="fondo oculto"></div><div class="capa"></div>' +
      '<div class="ra-top"><button class="ra-cerrar" type="button" aria-label="Cerrar la cámara">✕</button>' +
      '<div class="barra"><i style="width:0"></i></div><b data-cuenta></b></div>' +
      '<div class="ra-guia oculto"></div><div class="ra-toast"></div>' +
      '<div class="ra-ayuda"><img src="assets/' + e.personaje + '.webp" alt=""><div data-ayuda></div></div>';
    document.body.appendChild(raiz);
    document.body.style.overflow = 'hidden';

    var video = raiz.querySelector('video'), fondo = raiz.querySelector('.fondo'), capa = raiz.querySelector('.capa');
    var guia = raiz.querySelector('.ra-guia'), toast = raiz.querySelector('.ra-toast');
    var ayuda = raiz.querySelector('[data-ayuda]'), cuenta = raiz.querySelector('[data-cuenta]');
    var barra = raiz.querySelector('.barra i');
    var stream = null, vivo = true, sensor = false, toastT = 0;
    var cam = { yaw: 0, pitch: 0 }, meta = { yaw: 0, pitch: 0 }, base = null;
    var total = e.objetos.length, atrapados = 0;

    ayuda.textContent = op.textoIntro;
    voz.addEventListener('ended', function () { if (atrapados < total) ayuda.textContent = pista(); });

    function pista() {
      var faltan = total - atrapados;
      return sensor ? 'Gira despacio con el celular: ' + (faltan === 1 ? 'falta 1.' : 'faltan ' + faltan + '.')
        : 'Arrastra el dedo para mirar alrededor: ' + (faltan === 1 ? 'falta 1.' : 'faltan ' + faltan + '.');
    }
    function actualizarCuenta() {
      cuenta.textContent = atrapados + '/' + total;
      barra.style.width = (100 * atrapados / total) + '%';
    }
    function aviso(txt) {
      toast.textContent = txt;
      toast.style.opacity = 1;
      clearTimeout(toastT);
      toastT = setTimeout(function () { toast.style.opacity = 0; }, 1600);
    }

    // Objetos repartidos alrededor: el primero casi al frente para que se entienda el juego.
    var objs = e.objetos.map(function (o, i) {
      var div = document.createElement('div');
      div.className = 'obj';
      div.innerHTML = figura('n' + e.n + '/' + o[0], 'assets/n' + e.n + '/' + o[0] + '.webp', o[1]);
      capa.appendChild(div);
      var item = { id: o[0], nombre: o[1], el: div, vivo: true,
        dYaw: i === 0 ? 12 : i * 360 / total + (Math.random() * 24 - 12), pitch: i === 0 ? 2 : Math.random() * 26 - 10 };
      div.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); atrapar(item); });
      return item;
    });
    actualizarCuenta();

    function atrapar(o) {
      if (!o.vivo) return;
      o.vivo = false;
      atrapados++;
      o.el.classList.add('atrapado');
      sonido(ctx);
      if (navigator.vibrate) navigator.vibrate(40);
      aviso('¡Atrapaste: ' + o.nombre + '!');
      actualizarCuenta();
      if (voz.paused || voz.ended) ayuda.textContent = atrapados < total ? pista() : '¡Lo lograste!';
      setTimeout(function () { o.el.remove(); }, 650);
      if (atrapados === total) setTimeout(terminar, 800);
    }

    function terminar() {
      if (op.alTerminar) op.alTerminar();
      var fin = document.createElement('div');
      fin.className = 'ra-fin';
      fin.innerHTML = '<img class="ins" src="assets/n' + e.n + '/insignia.webp" alt="Insignia ' + e.insignia + '">' +
        '<h2>¡Nivel ' + e.n + ' desbloqueado!</h2><p style="max-width:420px">' + op.textoFin +
        '</p><p class="nota" style="color:#cfe7e3;margin-top:6px">Gana la insignia «' + e.insignia + '» al terminar la misión 360°.</p>' +
        '<div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">' +
        op.botones.map(function (b) { return '<a class="btn ' + (b.clase || '') + '" href="' + b.href + '">' + b.texto + '</a>'; }).join('') +
        '</div>';
      raiz.appendChild(fin);
      confeti(raiz);
      voz.src = op.vozFin;
      voz.play().catch(function () { });
      apagarCamara();
    }

    function apagarCamara() {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }

    function cerrar() {
      vivo = false;
      apagarCamara();
      voz.pause();
      window.removeEventListener('deviceorientation', alGirar);
      raiz.remove();
      document.body.style.overflow = '';
      if (op.alCerrar) op.alCerrar();
    }
    raiz.querySelector('.ra-cerrar').addEventListener('click', function () {
      if (atrapados === 0 || atrapados === total || confirm('¿Salir? Tendrás que atraparlos de nuevo.')) cerrar();
    });

    function alGirar(ev) {
      if (ev.alpha == null && ev.beta == null) return;
      var o = orientacion(ev);
      if (!sensor) { sensor = true; if (voz.paused || voz.ended) ayuda.textContent = pista(); }
      if (base === null) { base = o.yaw; cam.yaw = o.yaw; meta.yaw = o.yaw; }
      meta.yaw = o.yaw;
      meta.pitch = o.pitch;
    }

    // Arrastre con el dedo o el mouse (cuando no hay giroscopio).
    var arrastre = null;
    raiz.addEventListener('pointerdown', function (ev) { arrastre = { x: ev.clientX, y: ev.clientY }; });
    window.addEventListener('pointerup', function () { arrastre = null; });
    raiz.addEventListener('pointermove', function (ev) {
      if (!arrastre || sensor) return;
      var ppd = window.innerWidth / HFOV;
      meta.yaw = wrap(meta.yaw - (ev.clientX - arrastre.x) / ppd);
      meta.pitch = Math.max(-40, Math.min(40, meta.pitch + (ev.clientY - arrastre.y) / ppd));
      arrastre = { x: ev.clientX, y: ev.clientY };
    });

    function dibujar() {
      if (!vivo) return;
      var W = window.innerWidth, H = window.innerHeight, ppd = W / HFOV;
      cam.yaw = wrap(cam.yaw + wrap(meta.yaw - cam.yaw) * SUAVE);
      cam.pitch += (meta.pitch - cam.pitch) * SUAVE;
      if (!fondo.classList.contains('oculto')) fondo.style.backgroundPosition = (-cam.yaw * ppd) + 'px ' + (cam.pitch * ppd * 0.5) + 'px';
      var origen = base === null ? 0 : base, cerca = null, alguno = false;
      objs.forEach(function (o) {
        if (!o.vivo) return;
        var dx = wrap(origen + o.dYaw - cam.yaw), dy = o.pitch - cam.pitch;
        var w = o.el.offsetWidth || 120, x = W / 2 + dx * ppd - w / 2, y = H / 2 - dy * ppd - w / 2;
        o.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        var visible = Math.abs(dx) < HFOV / 2 + 4 && Math.abs(dy) < HFOV;
        if (visible) alguno = true;
        if (!cerca || Math.abs(dx) < Math.abs(cerca.dx)) cerca = { dx: dx, dy: dy };
      });
      if (cerca && !alguno) {
        var der = cerca.dx > 0;
        guia.classList.remove('oculto');
        guia.textContent = der ? '➜' : '⬅';
        guia.style.transform = 'translate(' + (der ? W - 80 : 16) + 'px,' + (H / 2 - 32) + 'px)';
      } else {
        guia.classList.add('oculto');
      }
      requestAnimationFrame(dibujar);
    }

    function sinCamara() {
      video.classList.add('oculto');
      fondo.classList.remove('oculto');
      fondo.style.backgroundImage = 'url(assets/n' + e.n + '/fondo.webp)';
    }

    pedirGiro.then(function (permiso) {
      if (permiso === 'granted') window.addEventListener('deviceorientation', alGirar);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return sinCamara();
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(function (s) {
          if (!vivo) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
          stream = s;
          video.srcObject = s;
          return video.play();
        })
        .catch(sinCamara);
    });
    requestAnimationFrame(dibujar);
  }

  window.GDM = window.GDM || {};
  window.GDM.RA = { iniciar: iniciar, figura: figura, _orientacion: orientacion };
})();
