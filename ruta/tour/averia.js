// Avería en el hidroavión (nivel 2, El Faro de los Sueños). Las dos preguntas del faro ya no salen en la ventana de
// 3DVista: salen dentro de la cabina del hidroavión, que va cayendo hacia el mar. El jugador nivela las alas
// (arrastrando, con las flechas o inclinando el celular) y responde antes de que la altura llegue a cero. Si acierta,
// Azulín arregla el avión; si falla pierde altura, y si toca el agua, vuelve a intentarlo.
// La respuesta se le entrega al quiz de 3DVista (vale la primera que tocó el jugador), así que el puntaje sigue igual.
//
// Lo arranca ruta/js/tour-ruta.js antes que popups.js (lo copia juego/ruta/build_ruta.py) con this = rootPlayer.
(function (tour) {
  if (window.__averia) return;
  window.__averia = true;

  var PREGUNTAS = {
    question_E42F70F5_F935_A31F_41B6_5EA14F0F3A88: { falla: 'EL MOTOR', voz: 'averia1' },
    question_E487D0D4_F937_631D_41E9_9A8372AA92E8: { falla: 'LA HÉLICE', voz: 'averia2', ultima: true }
  };
  var BASE = 'ruta/assets/';
  var LIBS = ['https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.js'];

  var ALTURA_M = 1000;           // altura con la que empieza cada avería
  var CAIDA_MS = 24;             // metros por segundo con las alas niveladas
  var CAIDA_LADEADO = 1.8;       // cuánto más rápido cae con las alas muy ladeadas
  var LADEO_MAX = 0.7, LADEO_PELIGRO = 0.32;   // radianes
  var CASTIGO_M = 170;           // altura que se pierde con una respuesta equivocada
  var INTRO_MS = 4200;           // aviso de la avería antes de mostrar la pregunta
  var ARREGLO_MS = 4200;         // Azulín arreglando y el avión subiendo
  var ESPERA_SIGUIENTE_MS = 6000; // la cabina se queda este tiempo esperando la otra pregunta
  var ZONA_MUERTA = 0.15;        // inclinación del celular que todavía no mueve el avión (de 0 a 1)
  var CIERRE_MS = 520;           // lo que tarda en desvanecerse la cabina
  var ESCALA = 0.09;             // metros de altura -> unidades de la escena

  // ---------- utilidades ----------
  function cargar(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = mal;
      document.head.appendChild(s);
    });
  }
  function el(tag, css, html) {
    var d = document.createElement(tag);
    if (css) d.style.cssText = css;
    if (html) d.innerHTML = html;
    return d;
  }
  function lienzo(w, h, pintar) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    pintar(c.getContext('2d'), w, h);
    return c;
  }
  function modeloQuiz(id) {
    try {
      var quiz = tour.get('data').quiz;
      var m = quiz && (quiz._model || quiz);
      return m && m.getQuestion ? m.getQuestion(id) : null;
    } catch (err) { return null; }
  }

  // ---------- sonido (sin archivos: motor, alarma, chapuzón y arreglo) ----------
  var audio = null, motor = null;
  function sonido() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio = new AC(); } catch (err) { audio = null; }
    return audio;
  }
  function despertarSonido() {
    var ac = sonido();
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tono(frec, dur, tipo, vol, hasta) {
    var ac = sonido();
    if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = tipo || 'square';
    o.frequency.setValueAtTime(frec, t);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + dur);
  }
  function ruido(dur, vol) {
    var ac = sonido();
    if (!ac) return;
    var n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.value = vol || 0.3;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
  }
  function motorEncender() {
    var ac = sonido();
    if (!ac || motor) return;
    var o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 70;
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.value = 0.05;
    o.connect(f); f.connect(g); g.connect(ac.destination); o.start();
    motor = { o: o, g: g };
  }
  function motorApagar() {
    if (!motor) return;
    try { motor.o.stop(); } catch (err) { /* ya estaba parado */ }
    motor = null;
  }
  var vozActual = null;
  function voz(nombre) {
    try {
      if (vozActual) vozActual.pause();
      vozActual = new Audio(BASE + 'voz/' + nombre + '.mp3');
      vozActual.play().catch(function () { /* el navegador no dejó sonar la voz */ });
    } catch (err) { /* sin audio */ }
  }

  // ---------- interfaz: la cabina es una «calcomanía» puesta encima del mundo 3D ----------
  var ui = null;
  var TINTA = '#2B2420', CREMA = '#F3E6C8', ROJO = '#E4613F', MOSTAZA = '#E8B43A';
  var FUENTE = '"Century Gothic","Segoe UI",sans-serif', TITULO = 'Rockwell,Georgia,serif';

  function crearInterfaz() {
    var raiz = el('div', 'position:fixed;inset:0;z-index:99990;background:#7FD3E6;overflow:hidden;touch-action:none;flex-direction:column;' +
      'user-select:none;-webkit-user-select:none;font-family:' + FUENTE + ';color:' + TINTA + ';opacity:0;transition:opacity .5s');
    var estilo = el('style', '', '@keyframes averiaLuz{50%{opacity:.25}}@keyframes averiaTiembla{0%,100%{transform:translate(0,0)}' +
      '25%{transform:translate(-6px,3px)}75%{transform:translate(6px,-3px)}}@keyframes averiaSube{from{transform:translateY(30px);' +
      'opacity:0}to{transform:none;opacity:1}}@keyframes averiaBurbuja{from{transform:translateY(0);opacity:.9}' +
      'to{transform:translateY(-110vh);opacity:0}}.averia-op{display:block;width:100%;margin:6px 0 0;padding:10px 12px;cursor:pointer;' +
      'font:bold 16px ' + FUENTE + ';color:' + TINTA + ';background:#FBF6EA;border:3px solid ' + TINTA + ';border-radius:12px;' +
      'box-shadow:3px 3px 0 ' + TINTA + ';text-align:left}.averia-op:active{transform:translate(2px,2px);box-shadow:1px 1px 0 ' + TINTA +
      '}.averia-op[disabled]{opacity:.45;text-decoration:line-through;cursor:default;background:#E9C9BD}');
    raiz.appendChild(estilo);

    // Arriba, la ventana de la cabina con el mundo 3D; abajo, el tablero con la pregunta.
    var vista = el('div', 'position:relative;flex:1;min-height:0;overflow:hidden');
    var mundo = el('div', 'position:absolute;inset:0');
    // Marco de la ventana de la cabina, visto desde adentro.
    var marco = el('div', 'position:absolute;inset:0;pointer-events:none',
      '<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<path d="M0 0H100V100H0Z M5 13 Q50 3 95 13 L97 100 H3 Z" fill="#257A74" fill-rule="evenodd" stroke="' + TINTA + '" stroke-width=".7"/>' +
      '<path d="M48.6 6 L49.2 100 H50.8 L51.4 6 Z" fill="#1E615C" stroke="' + TINTA + '" stroke-width=".4"/>' +
      '<path d="M0 0H100V7 Q50 -2 0 7Z" fill="' + CREMA + '" stroke="' + TINTA + '" stroke-width=".6"/>' +
      '<circle cx="8" cy="9" r="1" fill="' + TINTA + '"/><circle cx="92" cy="9" r="1" fill="' + TINTA + '"/>' +
      '<circle cx="50" cy="4" r="1" fill="' + TINTA + '"/></svg>');
    var rotulo = el('div', 'position:absolute;top:2px;left:0;right:0;text-align:center;font:bold 11px ' + TITULO +
      ';letter-spacing:4px;pointer-events:none', 'S C A D T A');

    // Tablero: alarma, altímetro con contador y el nivel de las alas.
    var tablero = el('div', 'position:relative;flex:none;max-height:64%;overflow-y:auto;padding:10px 12px calc(10px + env(safe-area-inset-bottom));' +
      'background:#3B2E28;border-top:5px solid ' + TINTA + ';box-shadow:0 -6px 0 rgba(0,0,0,.18)');
    var fila = el('div', 'display:flex;gap:10px;align-items:stretch;justify-content:center;max-width:760px;margin:0 auto 8px');
    var alarma = el('div', 'flex:1;min-width:0;border:3px solid ' + TINTA + ';border-radius:12px;background:' + ROJO +
      ';color:#fff;font:bold 15px ' + TITULO + ';padding:6px 8px;text-align:center;animation:averiaLuz .7s infinite');
    var altimetro = el('div', 'flex:1;min-width:0;border:3px solid ' + TINTA + ';border-radius:12px;background:#10201F;color:#9CF5D2;' +
      'padding:4px 8px;text-align:center');
    altimetro.innerHTML = '<div style="font:bold 10px ' + FUENTE + ';letter-spacing:2px;color:#7FB8A8">ALTURA</div>' +
      '<div data-m style="font:bold 26px Consolas,monospace;line-height:1.05">1000 m</div>' +
      '<div style="height:7px;border-radius:5px;background:#234;overflow:hidden;margin-top:2px"><div data-barra ' +
      'style="height:100%;width:100%;background:#9CF5D2"></div></div>';
    var nivel = el('div', 'flex:0 0 76px;border:3px solid ' + TINTA + ';border-radius:12px;background:#10201F;position:relative;overflow:hidden');
    nivel.innerHTML = '<div data-horizonte style="position:absolute;left:-40%;right:-40%;top:50%;height:120%;background:#2F8DA0;' +
      'border-top:3px solid #fff;transform-origin:50% 0"></div><div style="position:absolute;left:14%;right:14%;top:50%;height:3px;' +
      'background:' + MOSTAZA + ';margin-top:-1px"></div><div style="position:absolute;bottom:1px;left:0;right:0;text-align:center;' +
      'font:bold 9px ' + FUENTE + ';color:#fff;letter-spacing:1px">ALAS</div>';
    fila.appendChild(alarma); fila.appendChild(altimetro); fila.appendChild(nivel);
    var tarjeta = el('div', 'max-width:760px;margin:0 auto;background:' + CREMA + ';border:3px solid ' + TINTA +
      ';border-radius:14px;padding:10px 12px 12px;box-shadow:4px 4px 0 ' + TINTA);
    tablero.appendChild(fila); tablero.appendChild(tarjeta);

    var aviso = el('div', 'position:absolute;left:50%;top:22%;transform:translateX(-50%);width:min(520px,86vw);text-align:center;' +
      'font:bold 24px ' + TITULO + ';color:#fff;text-shadow:0 2px 0 ' + TINTA + ',2px 0 0 ' + TINTA + ',-2px 0 0 ' + TINTA +
      ',0 -2px 0 ' + TINTA + ';pointer-events:none');
    var agua = el('div', 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;' +
      'background:linear-gradient(#2F8DA0,#0F4F5E);color:#fff;padding:20px');

    vista.appendChild(mundo); vista.appendChild(marco); vista.appendChild(rotulo); vista.appendChild(aviso);
    raiz.appendChild(vista); raiz.appendChild(tablero); raiz.appendChild(agua);
    document.body.appendChild(raiz);
    return { raiz: raiz, mundo: mundo, alarma: alarma, metros: altimetro.querySelector('[data-m]'),
      barra: altimetro.querySelector('[data-barra]'), horizonte: nivel.querySelector('[data-horizonte]'),
      tarjeta: tarjeta, aviso: aviso, agua: agua, tablero: tablero };
  }

  // ---------- mundo 3D: mar, cielo, nubes, faro, la nariz del hidroavión y Azulín ----------
  var m3 = null;
  function crearMundo() {
    var T = window.THREE;
    var render = new T.WebGLRenderer({ antialias: true });
    render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    ui.mundo.appendChild(render.domElement);
    var escena = new T.Scene();
    escena.background = new T.CanvasTexture(lienzo(8, 256, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2E8FCB'); g.addColorStop(0.55, '#8FD6EE'); g.addColorStop(1, '#F6E7B8');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }));
    escena.fog = new T.Fog(0xCFE9E4, 500, 2600);
    var camara = new T.PerspectiveCamera(62, 1, 0.1, 5000);
    camara.rotation.order = 'YXZ';
    escena.add(camara);
    escena.add(new T.HemisphereLight(0xffffff, 0x4a7f86, 1.15));
    var sol = new T.DirectionalLight(0xfff1c9, 0.9);
    sol.position.set(-300, 500, -400);
    escena.add(sol);

    // Mar: un plano enorme con olas pintadas que corren hacia el avión.
    var olas = new T.CanvasTexture(lienzo(256, 256, function (c, w, h) {
      c.fillStyle = '#2F9FB0'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 46; i++) {
        var x = Math.random() * w, y = Math.random() * h, l = 14 + Math.random() * 34;
        c.strokeStyle = Math.random() < 0.3 ? 'rgba(255,255,255,.75)' : 'rgba(18,100,120,.55)';
        c.lineWidth = 2 + Math.random() * 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 5, x + l, y); c.stroke();
      }
    }));
    olas.wrapS = olas.wrapT = T.RepeatWrapping;
    olas.repeat.set(70, 70);
    var mar = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshBasicMaterial({ map: olas }));
    mar.rotation.x = -Math.PI / 2;
    escena.add(mar);

    var solDisco = new T.Sprite(new T.SpriteMaterial({ fog: false, map: new T.CanvasTexture(lienzo(128, 128, function (c) {
      var g = c.createRadialGradient(64, 64, 10, 64, 64, 64);
      g.addColorStop(0, '#FFF6C9'); g.addColorStop(0.45, '#FFD86B'); g.addColorStop(1, 'rgba(255,216,107,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    })) }));
    solDisco.scale.set(520, 520, 1); solDisco.position.set(-700, 330, -2400);
    escena.add(solDisco);

    var texNube = new T.CanvasTexture(lienzo(256, 128, function (c) {
      c.fillStyle = '#fff';
      [[70, 80, 46], [118, 62, 54], [170, 78, 44], [128, 92, 50], [206, 92, 30], [40, 94, 28]].forEach(function (b) {
        c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.fill();
      });
    }));
    var nubes = [];
    for (var n = 0; n < 16; n++) {
      var nube = new T.Sprite(new T.SpriteMaterial({ map: texNube, transparent: true, opacity: 0.92, fog: false }));
      var tam = 90 + Math.random() * 150;
      nube.scale.set(tam * 2, tam, 1);
      nube.position.set((Math.random() - 0.5) * 2400, 40 + Math.random() * 260, -200 - Math.random() * 2200);
      escena.add(nube); nubes.push(nube);
    }

    // La costa con el faro, a lo lejos.
    var costa = new T.Group();
    var arena = new T.Mesh(new T.CylinderGeometry(260, 300, 10, 28), new T.MeshLambertMaterial({ color: 0xE9D29A }));
    arena.scale.z = 0.35; costa.add(arena);
    var monte = new T.Mesh(new T.SphereGeometry(120, 16, 10), new T.MeshLambertMaterial({ color: 0x3E9A62 }));
    monte.scale.set(1.5, 0.28, 0.5); monte.position.set(90, 8, 0); costa.add(monte);
    costa.position.set(260, 0, -1500);
    escena.add(costa);

    // Nariz del hidroavión, pegada a la cámara: capó, franja, eje y hélice.
    var nariz = new T.Group();
    var capo = new T.Mesh(new T.CylinderGeometry(0.34, 0.5, 1.5, 20), new T.MeshLambertMaterial({ color: 0xF3E6C8 }));
    capo.rotation.x = Math.PI / 2; capo.position.z = -0.75; nariz.add(capo);
    var franja = new T.Mesh(new T.CylinderGeometry(0.42, 0.46, 0.2, 20), new T.MeshLambertMaterial({ color: 0xE4613F }));
    franja.rotation.x = Math.PI / 2; franja.position.z = -0.55; nariz.add(franja);
    var cono = new T.Mesh(new T.ConeGeometry(0.2, 0.34, 16), new T.MeshLambertMaterial({ color: 0x2B2420 }));
    cono.rotation.x = -Math.PI / 2; cono.position.z = -1.66; nariz.add(cono);
    var helice = new T.Group();
    var matPala = new T.MeshLambertMaterial({ color: 0x6B4A2E });
    for (var p = 0; p < 2; p++) {
      var pala = new T.Mesh(new T.BoxGeometry(0.16, 1.5, 0.04), matPala);
      pala.rotation.z = p * Math.PI / 2; helice.add(pala);
    }
    helice.position.z = -1.55; nariz.add(helice);
    var disco = new T.Mesh(new T.CircleGeometry(0.78, 28),
      new T.MeshBasicMaterial({ color: 0x6B4A2E, transparent: true, opacity: 0.0, side: T.DoubleSide }));
    disco.position.z = -1.56; nariz.add(disco);
    nariz.position.set(0, -0.62, -1.3);
    camara.add(nariz);

    // Humo del motor.
    var texHumo = new T.CanvasTexture(lienzo(64, 64, function (c) {
      var g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, 'rgba(60,52,48,.95)'); g.addColorStop(1, 'rgba(60,52,48,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    }));
    var humos = [];
    for (var h = 0; h < 14; h++) {
      var humo = new T.Sprite(new T.SpriteMaterial({ map: texHumo, transparent: true, depthWrite: false }));
      humo.userData.t = h / 14; camara.add(humo); humos.push(humo);
    }

    // Azulín: modelo 3D si carga; si no, su dibujo.
    var azulin = new T.Group();
    azulin.position.set(0.62, -0.5, -1.45);
    camara.add(azulin);
    var dibujo = new T.Sprite(new T.SpriteMaterial({ map: new T.TextureLoader().load(BASE + 'azulin.webp'), transparent: true }));
    dibujo.scale.set(0.5, 0.5, 1); dibujo.position.y = 0.22; azulin.add(dibujo);
    var chispa = new T.Sprite(new T.SpriteMaterial({ transparent: true, opacity: 0, map: new T.CanvasTexture(lienzo(64, 64, function (c) {
      c.fillStyle = '#FFE46B'; c.strokeStyle = '#2B2420'; c.lineWidth = 2; c.beginPath();
      for (var k = 0; k < 16; k++) { var r = k % 2 ? 10 : 30, a = k * Math.PI / 8; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
      c.closePath(); c.fill(); c.stroke();
    })) }));
    chispa.scale.set(0.5, 0.5, 1); chispa.position.set(0, -0.3, -2.1); camara.add(chispa);

    if (T.GLTFLoader) {
      var cargador = new T.GLTFLoader();
      if (window.MeshoptDecoder) cargador.setMeshoptDecoder(window.MeshoptDecoder);
      var encajar = function (obj, alto) {
        var caja = new T.Box3().setFromObject(obj), tamano = caja.getSize(new T.Vector3()), centro = caja.getCenter(new T.Vector3());
        var s = alto / (tamano.y || 1);
        obj.scale.setScalar(s);
        obj.position.set(-centro.x * s, -caja.min.y * s, -centro.z * s);
      };
      cargador.load(BASE + '3d/personajes/azulin.glb', function (g) {
        encajar(g.scene, 0.46); azulin.remove(dibujo); azulin.add(g.scene);
      }, undefined, function () { /* queda el dibujo */ });
      cargador.load(BASE + '3d/n2/torre.glb', function (g) {
        encajar(g.scene, 230); g.scene.position.x += 40; costa.add(g.scene);
      }, undefined, function () { /* costa sin faro */ });
    }

    function medir() {
      var w = ui.mundo.clientWidth || innerWidth, h = ui.mundo.clientHeight || innerHeight;
      render.setSize(w, h, false);
      render.domElement.style.cssText = 'width:100%;height:100%;display:block';
      camara.aspect = w / h;
      camara.fov = w < h ? 78 : 60;       // ventana angosta: más campo de vista para que quepa el horizonte
      camara.updateProjectionMatrix();
    }
    medir();
    // La ventana cambia de tamaño cuando el tablero crece con la pregunta o se gira el celular.
    if (window.ResizeObserver) new ResizeObserver(medir).observe(ui.mundo);
    else window.addEventListener('resize', medir);
    return { T: T, render: render, escena: escena, camara: camara, olas: olas, nubes: nubes, helice: helice, disco: disco,
      humos: humos, azulin: azulin, chispa: chispa, nariz: nariz, medir: medir };
  }

  // ---------- estado del vuelo ----------
  var vuelo = { fase: 'apagado', altura: ALTURA_M, ladeo: 0, viento: 0, mando: 0, cabeceo: 0, giroHelice: 0, t: 0,
    humo: 1, sacudida: 0, inclinacion: null, inclinacionBase: null };
  var ronda = null;              // la pregunta en curso
  var cuadro = 0, ultimo = 0, cierre = 0, ultimoPitido = 0;

  function paso(ahora) {
    cuadro = requestAnimationFrame(paso);
    var dt = Math.min(0.05, (ahora - ultimo) / 1000 || 0.016);
    ultimo = ahora;
    vuelo.t += dt;
    var cayendo = vuelo.fase === 'cayendo', arreglando = vuelo.fase === 'arreglo';

    // Alas: el viento las ladea y el jugador las corrige.
    if (cayendo || vuelo.fase === 'intro') {
      vuelo.viento += (Math.sin(vuelo.t * 0.9) * 0.5 + Math.sin(vuelo.t * 2.3 + 1) * 0.3 - vuelo.viento) * dt * 1.5;
      var mando = Math.max(-1, Math.min(1, vuelo.mando + (vuelo.inclinacion || 0)));
      vuelo.ladeo += (vuelo.viento * 0.4 - mando * 1.5) * dt;
      vuelo.ladeo -= vuelo.ladeo * 0.3 * dt;
    } else {
      vuelo.ladeo -= vuelo.ladeo * 2.5 * dt;
    }
    vuelo.ladeo = Math.max(-LADEO_MAX, Math.min(LADEO_MAX, vuelo.ladeo));
    var ladeado = Math.abs(vuelo.ladeo) > LADEO_PELIGRO;

    if (cayendo) {
      vuelo.altura -= CAIDA_MS * (ladeado ? CAIDA_LADEADO : 1) * dt;
      if (vuelo.altura <= 0) { vuelo.altura = 0; alAgua(); }
      var cada = vuelo.altura < 300 ? 260 : 620;
      if (ahora - ultimoPitido > cada) { ultimoPitido = ahora; tono(vuelo.altura < 300 ? 1180 : 880, 0.12, 'square', 0.05); }
    } else if (arreglando) {
      vuelo.altura += (ALTURA_M - vuelo.altura) * dt * 1.1;
    }
    var metaCabeceo = cayendo ? -0.2 - (1 - vuelo.altura / ALTURA_M) * 0.22 : arreglando ? 0.16 : vuelo.fase === 'intro' ? -0.1 : 0;
    vuelo.cabeceo += (metaCabeceo - vuelo.cabeceo) * dt * 1.6;
    vuelo.sacudida = Math.max(0, vuelo.sacudida - dt);

    // Hélice: tose cuando hay avería, gira pareja cuando Azulín la arregla.
    var velocidad = arreglando || vuelo.fase === 'bien' ? 38 : 6 + 9 * Math.max(0, Math.sin(vuelo.t * 7) * Math.sin(vuelo.t * 1.7));
    vuelo.giroHelice += velocidad * dt;
    vuelo.humo += ((cayendo || vuelo.fase === 'intro' ? 1 : 0) - vuelo.humo) * dt * 2;
    if (motor) motor.o.frequency.value = 40 + velocidad * 2.2;

    ui.metros.textContent = Math.round(vuelo.altura) + ' m';
    ui.barra.style.width = (vuelo.altura / ALTURA_M * 100) + '%';
    var color = vuelo.altura < 300 ? '#FF7A5C' : vuelo.altura < 600 ? '#FFD86B' : '#9CF5D2';
    ui.barra.style.background = color; ui.metros.style.color = color;
    ui.horizonte.style.transform = 'rotate(' + (-vuelo.ladeo * 57.3) + 'deg)';
    if (cayendo) ui.aviso.textContent = ladeado ? '¡Nivela las alas! ' + (vuelo.ladeo > 0 ? '👉' : '👈') : '';

    if (!m3) return;
    var c = m3.camara, tiembla = (cayendo ? 0.006 : 0) + vuelo.sacudida * 0.05;
    c.position.set(0, 2.2 + vuelo.altura * ESCALA, 0);
    c.rotation.set(vuelo.cabeceo + (Math.random() - 0.5) * tiembla, -vuelo.ladeo * 0.25, vuelo.ladeo + (Math.random() - 0.5) * tiembla);
    m3.olas.offset.y += dt * 1.6;
    m3.olas.offset.x += vuelo.ladeo * dt * 0.5;
    for (var n = 0; n < m3.nubes.length; n++) {
      var nube = m3.nubes[n];
      nube.position.z += dt * 150;
      nube.position.x += vuelo.ladeo * dt * 90;
      if (nube.position.z > 60) { nube.position.z = -2400; nube.position.x = (Math.random() - 0.5) * 2400; }
    }
    m3.helice.rotation.z = vuelo.giroHelice;
    m3.disco.material.opacity = velocidad > 30 ? 0.28 : 0;
    m3.helice.visible = velocidad <= 30;
    for (var h = 0; h < m3.humos.length; h++) {
      var humo = m3.humos[h], f = (humo.userData.t + vuelo.t * 0.55) % 1;
      humo.position.set(m3.nariz.position.x + 0.25 + Math.sin(f * 9 + h) * 0.12 + f * 0.5, m3.nariz.position.y + 0.3 + f * 1.3, -2.2 + f * 1.1);
      humo.scale.setScalar(0.25 + f * 0.9);
      humo.material.opacity = (1 - f) * 0.75 * vuelo.humo;
    }
    // Azulín: brinca asustado en el tablero y, al arreglar, se va a la nariz con sus chispas.
    var meta = arreglando ? 0.05 : 0.62;
    m3.azulin.position.x += (meta - m3.azulin.position.x) * dt * 4;
    m3.azulin.position.z += ((arreglando ? -2.0 : -1.45) - m3.azulin.position.z) * dt * 4;
    m3.azulin.position.y = m3.nariz.position.y + (arreglando ? 0.42 : 0.3) + Math.abs(Math.sin(vuelo.t * (cayendo ? 9 : 4))) * (cayendo ? 0.07 : 0.03);
    m3.azulin.rotation.y = Math.sin(vuelo.t * 3) * 0.4 + (arreglando ? Math.PI : -0.5);
    m3.chispa.material.opacity = arreglando && vuelo.altura < ALTURA_M * 0.93 ? 0.5 + 0.5 * Math.sin(vuelo.t * 30) : 0;
    m3.chispa.material.rotation = vuelo.t * 6;
    m3.chispa.position.y = m3.nariz.position.y + 0.25;
    m3.render.render(m3.escena, c);
  }

  // ---------- mando: arrastrar, flechas o inclinar el celular ----------
  function prepararMando() {
    var x0 = null;
    ui.raiz.addEventListener('pointerdown', function (e) { if (!e.target.closest('button')) x0 = e.clientX; });
    window.addEventListener('pointermove', function (e) {
      if (x0 === null) return;
      vuelo.mando = Math.max(-1, Math.min(1, (e.clientX - x0) / 90));
    });
    var soltar = function () { x0 = null; vuelo.mando = 0; };
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    window.addEventListener('keydown', function (e) {
      if (vuelo.fase === 'apagado') return;
      if (e.key === 'ArrowLeft') vuelo.mando = -1; else if (e.key === 'ArrowRight') vuelo.mando = 1;
    });
    window.addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') vuelo.mando = 0; });
    // Si se gira el celular, la inclinación se vuelve a medir desde la postura nueva.
    window.addEventListener('resize', function () { vuelo.inclinacionBase = null; vuelo.inclinacion = null; });
    // En el iPhone el sonido solo arranca desde un toque.
    ui.raiz.addEventListener('click', despertarSonido);
    ui.raiz.addEventListener('touchend', despertarSonido);
    // Inclinación del celular: cuenta desde la postura que tenía al empezar la ronda y con una zona muerta, para que
    // un celular quieto (o apoyado un poco torcido) no mueva el avión solo.
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma === null || e.gamma === undefined || vuelo.fase === 'apagado') return;
      var acostado = innerHeight < innerWidth, alReves = window.screen && screen.orientation && screen.orientation.angle === 270;
      var grados = acostado ? e.beta * (alReves ? -1 : 1) : e.gamma;
      if (vuelo.inclinacionBase === null) vuelo.inclinacionBase = grados;
      var v = (grados - vuelo.inclinacionBase) / 28;
      vuelo.inclinacion = Math.abs(v) < ZONA_MUERTA ? 0 : Math.max(-1, Math.min(1, v));
    });
  }

  // ---------- fases ----------
  function pintarAlarma() {
    ui.alarma.style.background = ROJO; ui.alarma.style.animation = 'averiaLuz .7s infinite';
    ui.alarma.innerHTML = '⚠ FALLA<br>' + ronda.conf.falla;
  }

  function pintarPregunta() {
    pintarAlarma();
    ui.tarjeta.innerHTML = '<div style="font:bold 12px ' + FUENTE + ';letter-spacing:1px;color:#B0452B">🔧 RESPONDE Y AZULÍN LO ARREGLA</div>' +
      '<div style="font:bold 18px ' + TITULO + ';margin-top:2px">' + ronda.q.title + '</div>';
    ronda.orden.forEach(function (op) {
      var b = el('button', '', op.text);
      b.type = 'button'; b.className = 'averia-op';
      b.addEventListener('click', function () { responder(op, b); });
      ui.tarjeta.appendChild(b);
    });
    ui.tarjeta.style.animation = 'averiaSube .4s';
  }

  function empezarRonda() {
    vuelo.fase = 'intro'; vuelo.altura = ALTURA_M; vuelo.inclinacionBase = null;
    ui.agua.style.display = 'none';
    pintarAlarma();
    ui.aviso.textContent = '¡ALERTA! Falla ' + ronda.conf.falla.toLowerCase() + ' y vamos hacia el mar';
    ui.tarjeta.innerHTML = '<div style="font:bold 17px ' + TITULO + '">Nivela las alas: arrastra a los lados' +
      ('ontouchstart' in window ? ' con el dedo o inclina el celular' : ' o usa las flechas ⬅ ➡') + '.</div>';
    tono(700, 0.5, 'sawtooth', 0.07, 180); ruido(0.5, 0.25);
    vuelo.sacudida = 0.7;
    motorEncender();
    voz(ronda.conf.voz);
    var actual = ronda;
    setTimeout(function () {
      if (ronda !== actual || vuelo.fase !== 'intro') return;
      vuelo.fase = 'cayendo'; ui.aviso.textContent = '';
      pintarPregunta();
    }, INTRO_MS);
  }

  function responder(op, boton) {
    if (!ronda || vuelo.fase !== 'cayendo') return;
    if (!ronda.primera) ronda.primera = op;
    if (op.score > 0) { arreglar(); return; }
    boton.disabled = true;
    vuelo.altura = Math.max(0, vuelo.altura - CASTIGO_M);
    vuelo.sacudida = 0.6;
    ui.tablero.style.animation = 'none';
    void ui.tablero.offsetWidth;                 // reinicia la animación del temblor
    ui.tablero.style.animation = 'averiaTiembla .35s 2';
    tono(220, 0.35, 'sawtooth', 0.09, 90); ruido(0.3, 0.2);
    voz('averia_mal');
  }

  function arreglar() {
    vuelo.fase = 'arreglo';
    ui.aviso.textContent = '¡Azulín está arreglando ' + ronda.conf.falla.toLowerCase() + '! 🔧';
    ui.alarma.style.animation = 'none'; ui.alarma.style.background = '#1F6E43';
    ui.alarma.innerHTML = '✔ ARREGLADO';
    ui.tarjeta.innerHTML = '<div style="font:bold 20px ' + TITULO + ';color:#1F6E43;text-align:center">¡Respuesta correcta! ¡Arriba otra vez!</div>';
    [0, 130, 260, 420].forEach(function (ms, i) { setTimeout(function () { tono([523, 659, 784, 1047][i], 0.22, 'triangle', 0.09); }, ms + 900); });
    [0, 220, 440].forEach(function (ms) { setTimeout(function () { tono(1500, 0.05, 'square', 0.05); }, ms); });
    voz('averia_bien');
    var actual = ronda;
    setTimeout(function () {
      if (ronda !== actual) return;
      vuelo.fase = 'bien'; ui.aviso.textContent = '';
      ronda = null;
      var respuesta = [actual.primera || actual.correcta];
      try { actual.q.setAnswer(respuesta); } catch (err) { console.warn('[averia] no se pudo guardar la respuesta', err); }
      // Después de la última pregunta la cabina se quita antes de avisarle al tour, para no tapar la insignia.
      if (actual.conf.ultima) { cerrar(); setTimeout(function () { actual.ok(respuesta); }, CIERRE_MS); return; }
      actual.ok(respuesta);
      cierre = setTimeout(cerrar, ESPERA_SIGUIENTE_MS);
    }, ARREGLO_MS);
  }

  function alAgua() {
    vuelo.fase = 'agua';
    motorApagar();
    ruido(1.1, 0.5); tono(300, 0.6, 'sine', 0.1, 60);
    voz('averia_agua');
    var burbujas = '';
    for (var b = 0; b < 16; b++) {
      var t = 14 + Math.random() * 30;
      burbujas += '<div style="position:absolute;bottom:-40px;left:' + (Math.random() * 100) + '%;width:' + t + 'px;height:' + t +
        'px;border-radius:50%;border:2px solid rgba(255,255,255,.7);animation:averiaBurbuja ' + (2.5 + Math.random() * 3) +
        's linear ' + (Math.random() * 2) + 's infinite"></div>';
    }
    ui.agua.innerHTML = burbujas + '<div style="position:relative;max-width:440px;background:#FBF6EA;color:' + TINTA + ';border:3px solid ' +
      TINTA + ';border-radius:20px;padding:20px;box-shadow:6px 6px 0 #3FA7A0;animation:averiaSube .5s">' +
      '<img src="' + BASE + 'azulin.webp" alt="" style="width:110px;height:auto">' +
      '<div style="font:bold 30px ' + TITULO + ';color:#2F8DA0">¡SPLASH! 🌊</div>' +
      '<p style="font-size:17px;margin:6px 0 12px">Caímos al agua… ¡pero los hidroaviones flotan! Azulín ya lo puso a volar otra vez.</p>' +
      '<button type="button" data-otra style="cursor:pointer;font:bold 19px ' + TITULO + ';color:#fff;background:' + ROJO +
      ';border:3px solid ' + TINTA + ';border-radius:12px;padding:10px 20px;box-shadow:3px 3px 0 ' + TINTA + '">🛩️ Intentar otra vez</button></div>';
    ui.agua.style.display = 'flex';
    ui.agua.querySelector('[data-otra]').addEventListener('click', function () { if (ronda) empezarRonda(); });
  }

  function cerrar() {
    clearTimeout(cierre);
    if (ronda) return;
    vuelo.fase = 'apagado';
    motorApagar();
    if (vozActual) vozActual.pause();
    ui.raiz.style.opacity = '0';
    setTimeout(function () {
      if (vuelo.fase !== 'apagado') return;
      ui.raiz.style.display = 'none';
      cancelAnimationFrame(cuadro); cuadro = 0;
    }, CIERRE_MS);
  }

  function abrir() {
    clearTimeout(cierre);
    if (!ui) { ui = crearInterfaz(); prepararMando(); }
    ui.raiz.style.display = 'flex';
    requestAnimationFrame(function () { ui.raiz.style.opacity = '1'; });
    if (!cuadro) { ultimo = performance.now(); cuadro = requestAnimationFrame(paso); }
    if (!m3 && window.THREE) {
      try { m3 = crearMundo(); } catch (err) { console.warn('[averia] sin 3D', err); }
    } else if (m3) { m3.medir(); }
  }

  // Las librerías 3D se piden apenas arranca el tour, para que estén listas cuando llegue la pregunta.
  var libs = LIBS.reduce(function (p, src) { return p.then(function () { return cargar(src); }); }, Promise.resolve())
    .catch(function (err) { console.warn('[averia] no cargó el 3D: se juega con la cabina sola', err); });

  var original = tour.quizShowQuestion;
  tour.quizShowQuestion = function (id) {
    var conf = PREGUNTAS[id], q = conf && modeloQuiz(id), self = this, args = arguments;
    var correcta = q && q.options && q.options.filter(function (o) { return o.score > 0; })[0];
    if (!conf || !q || q.answered || !correcta || !q.setAnswer) return original.apply(self, args);
    return new Promise(function (ok) {
      if (ronda) { ok([]); return; }             // ya hay una avería en curso: esta llamada repetida no cuenta
      var pausados = null;
      try { pausados = self.pauseCurrentPlayers(true); } catch (err) { pausados = null; }
      var orden = q.options.slice().sort(function () { return Math.random() - 0.5; });
      ronda = { q: q, conf: conf, correcta: correcta, orden: orden, primera: null,
        ok: function (r) {
          try { if (pausados) self.resumePlayers(pausados, true); } catch (err) { /* nada que reanudar */ }
          ok(r);
        } };
      Promise.race([libs, new Promise(function (listo) { setTimeout(listo, 4000); })]).then(function () {
        abrir();
        empezarRonda();
      });
    });
  };

  // Piezas que comparte el amerizaje del nivel 3 (juego/final/amerizaje.js).
  window.__hidro = { libs: libs, el: el, lienzo: lienzo, tono: tono, ruido: ruido, voz: voz, modeloQuiz: modeloQuiz,
    motorEncender: motorEncender, motorApagar: motorApagar, despertarSonido: despertarSonido, base: BASE };

  window.__averiaEstado = function () {
    return { fase: vuelo.fase, altura: Math.round(vuelo.altura), ladeo: +vuelo.ladeo.toFixed(2), con3d: !!m3, ronda: !!ronda };
  };
})(this);
