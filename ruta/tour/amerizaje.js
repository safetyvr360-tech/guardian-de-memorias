// Amerizaje del hidroavión (nivel 3, El Escudo Verde del Caribe). Las dos preguntas del manglar ya no salen en la
// ventana de 3DVista: son las boyas de la pista de agua. El jugador lleva el hidroavión (arrastrando, con las flechas,
// inclinando el celular o tocando una respuesta) hacia la boya de la respuesta correcta. Con la primera cruza el
// canal de entrada; con la segunda ameriza y llega al muelle, listo para seguir a pie en el nivel 4.
// Lo que enseña el nivel se ve en la costa sin decirlo: donde hay manglar el agua está mansa; donde no hay, las olas
// le pegan a las casas.
// La respuesta se le entrega al quiz de 3DVista (vale la primera boya que cruzó el jugador).
//
// Lo arranca ruta/js/tour-ruta.js después de averia.js (de ahí toma sonidos y utilidades) y antes de popups.js.
(function (tour) {
  var H = window.__hidro;
  if (window.__amerizaje || !H) return;
  window.__amerizaje = true;

  var PREGUNTAS = {
    question_E42AEA06_F955_E6FD_41EC_78F102992E2B: { final: false, voz: 'torre1', aviso: 'Canal de entrada: vuela hacia la boya correcta' },
    question_D98F05B5_F955_AD1F_41E0_8DD89D8E010E: { final: true, voz: 'torre2', aviso: '¡A amerizar! Baja junto a la boya correcta' }
  };
  var COLORES = [{ fondo: '#E4613F', nombre: 'A' }, { fondo: '#E8B43A', nombre: 'B' }, { fondo: '#3FA7A0', nombre: 'C' }];
  var CARRIL = 26;               // separación entre boyas
  var X_MAX = 36;                // hasta dónde se puede ir a los lados
  var VELOCIDAD = 30;            // unidades por segundo hacia las boyas
  var DISTANCIA = 480;           // distancia a las boyas al empezar cada pregunta (unos 16 s)
  var DISTANCIA_VUELTA = 300;    // distancia al dar otra vuelta después de fallar
  var ALTURA_CANAL = 34, ALTURA_INICIO = 62;
  var INTRO_MS = 2600;
  var ESPERA_SIGUIENTE_MS = 6000;
  var CIERRE_MS = 520;           // lo que tarda en desvanecerse la escena
  var GIRO_MODELO = -Math.PI / 2; // el modelo de Meshy viene de lado: se gira para que la nariz mire al frente
  var HELICE_Y = 0.9;
  var ZONA_MUERTA = 0.15;        // inclinación del celular que todavía no mueve el avión (de 0 a 1)
  var TINTA = '#2B2420', CREMA = '#F3E6C8';
  var FUENTE = '"Century Gothic","Segoe UI",sans-serif', TITULO = 'Rockwell,Georgia,serif';
  var el = H.el, lienzo = H.lienzo;

  // ---------- interfaz ----------
  var ui = null;
  function crearInterfaz() {
    var raiz = el('div', 'position:fixed;inset:0;z-index:99990;background:#8FD6EE;overflow:hidden;touch-action:none;display:none;' +
      'flex-direction:column;user-select:none;-webkit-user-select:none;font-family:' + FUENTE + ';color:' + TINTA +
      ';opacity:0;transition:opacity .5s');
    raiz.appendChild(el('style', '', '.amz-op{display:flex;align-items:center;gap:8px;width:100%;margin:6px 0 0;padding:7px 10px;' +
      'cursor:pointer;font:bold 15px ' + FUENTE + ';color:' + TINTA + ';background:#FBF6EA;border:3px solid ' + TINTA +
      ';border-radius:12px;box-shadow:3px 3px 0 ' + TINTA + ';text-align:left}.amz-op b{flex:none;width:28px;height:28px;' +
      'border-radius:50%;border:2px solid ' + TINTA + ';display:flex;align-items:center;justify-content:center;color:#fff;' +
      'font:bold 16px ' + TITULO + '}.amz-op.amz-rumbo{background:#FFF1B8;transform:translate(1px,1px);box-shadow:2px 2px 0 ' + TINTA +
      '}.amz-op[disabled]{opacity:.4;text-decoration:line-through;cursor:default}' +
      '@keyframes amzSube{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}'));
    var vista = el('div', 'position:relative;flex:1;min-height:0;overflow:hidden');
    var mundo = el('div', 'position:absolute;inset:0');
    var aviso = el('div', 'position:absolute;left:50%;top:8%;transform:translateX(-50%);width:min(540px,90vw);text-align:center;' +
      'font:bold 22px ' + TITULO + ';color:#fff;text-shadow:0 2px 0 ' + TINTA + ',2px 0 0 ' + TINTA + ',-2px 0 0 ' + TINTA +
      ',0 -2px 0 ' + TINTA + ';pointer-events:none');
    var tablero = el('div', 'position:absolute;left:10px;top:10px;border:3px solid ' + TINTA + ';border-radius:12px;' +
      'background:rgba(16,32,31,.85);color:#9CF5D2;padding:4px 10px;font:bold 12px Consolas,monospace;pointer-events:none;line-height:1.35');
    vista.appendChild(mundo); vista.appendChild(aviso); vista.appendChild(tablero);
    var panel = el('div', 'flex:none;max-height:60%;overflow-y:auto;padding:8px 12px calc(10px + env(safe-area-inset-bottom));' +
      'background:#3B2E28;border-top:5px solid ' + TINTA);
    var tarjeta = el('div', 'max-width:760px;margin:0 auto;background:' + CREMA + ';border:3px solid ' + TINTA +
      ';border-radius:14px;padding:8px 12px 12px;box-shadow:4px 4px 0 ' + TINTA);
    panel.appendChild(tarjeta);
    raiz.appendChild(vista); raiz.appendChild(panel);
    document.body.appendChild(raiz);
    return { raiz: raiz, mundo: mundo, aviso: aviso, tablero: tablero, tarjeta: tarjeta };
  }

  // ---------- mundo 3D ----------
  var m3 = null;
  function letrero(T, texto, color) {
    var tex = new T.CanvasTexture(lienzo(512, 256, function (c, w, h) {
      c.fillStyle = TINTA; c.fillRect(0, 0, w, h);
      c.fillStyle = color.fondo; c.fillRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#FBF6EA'; c.fillRect(22, 70, w - 44, h - 92);
      c.fillStyle = '#fff'; c.font = 'bold 52px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(color.nombre, w / 2, 42);
      c.fillStyle = TINTA; c.font = 'bold 34px Arial';
      var palabras = texto.split(' '), lineas = [''], k;
      for (k = 0; k < palabras.length; k++) {
        var prueba = (lineas[lineas.length - 1] + ' ' + palabras[k]).trim();
        if (c.measureText(prueba).width > w - 70 && lineas[lineas.length - 1]) lineas.push(palabras[k]);
        else lineas[lineas.length - 1] = prueba;
      }
      for (k = 0; k < lineas.length; k++) c.fillText(lineas[k], w / 2, 70 + (h - 92) / 2 + (k - (lineas.length - 1) / 2) * 40);
    }));
    var g = new T.Group();
    g.add(new T.Mesh(new T.PlaneGeometry(22, 11), new T.MeshBasicMaterial({ map: tex, fog: false })));
    var matPalo = new T.MeshLambertMaterial({ color: 0x6B4A2E });
    [-10, 10].forEach(function (x) {
      var palo = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 80, 8), matPalo);
      palo.position.set(x, -45.5, 0); g.add(palo);
      var boya = new T.Mesh(new T.SphereGeometry(1.8, 12, 10), new T.MeshLambertMaterial({ color: color.fondo }));
      boya.userData.boya = true; boya.position.set(x, 0, 0); g.add(boya);
    });
    return g;
  }

  function crearCosta(T) {
    var costa = new T.Group();
    var arena = new T.Mesh(new T.BoxGeometry(760, 3, 90), new T.MeshLambertMaterial({ color: 0xE9D29A }));
    arena.position.set(0, 0.5, -45); costa.add(arena);
    var cerro = new T.Mesh(new T.SphereGeometry(240, 20, 10), new T.MeshLambertMaterial({ color: 0x4E9E63 }));
    cerro.scale.set(1.6, 0.16, 0.3); cerro.position.set(0, 0, -130); costa.add(cerro);
    // Casas a lo largo de toda la orilla.
    var pintura = [0xF3E6C8, 0xE8B43A, 0xE4613F, 0x8FD6EE, 0xFBF6EA];
    for (var c = 0; c < 22; c++) {
      var casa = new T.Group(), ancho = 12 + Math.random() * 8, alto = 9 + Math.random() * 6;
      var muro = new T.Mesh(new T.BoxGeometry(ancho, alto, 12), new T.MeshLambertMaterial({ color: pintura[c % pintura.length] }));
      muro.position.y = alto / 2; casa.add(muro);
      var techo = new T.Mesh(new T.ConeGeometry(ancho * 0.8, 6, 4), new T.MeshLambertMaterial({ color: 0xB0452B }));
      techo.rotation.y = Math.PI / 4; techo.position.y = alto + 3; casa.add(techo);
      casa.position.set(-345 + c * 33 + Math.random() * 6, 2, -52 - Math.random() * 14);
      costa.add(casa);
    }
    // Manglar: solo en la mitad izquierda. Raíces en el agua y copas verdes.
    var verdes = [0x2F7D4F, 0x3E9A62, 0x1F6E43], matRaiz = new T.MeshLambertMaterial({ color: 0x5A4030 });
    for (var m = 0; m < 46; m++) {
      var mangle = new T.Group();
      var raiz = new T.Mesh(new T.ConeGeometry(4, 8, 6, 1, true), matRaiz);
      raiz.position.y = 3; mangle.add(raiz);
      for (var k = 0; k < 3; k++) {
        var copa = new T.Mesh(new T.SphereGeometry(6 + Math.random() * 3, 10, 8), new T.MeshLambertMaterial({ color: verdes[(m + k) % 3] }));
        copa.position.set((k - 1) * 5, 10 + Math.random() * 4, (Math.random() - 0.5) * 5); mangle.add(copa);
      }
      mangle.scale.setScalar(0.8 + Math.random() * 0.7);
      mangle.position.set(-365 + (m % 23) * 15.5 + Math.random() * 5, 0, m < 23 ? 6 : -10);
      costa.add(mangle);
    }
    // Olas: llegan con fuerza donde no hay manglar; frente al manglar se quedan pequeñas.
    var olas = [], matOla = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (var o = 0; o < 7; o++) {
      var fuerte = new T.Mesh(new T.BoxGeometry(330, 2.2, 4), matOla.clone());
      fuerte.position.x = 190; fuerte.userData = { t: o / 7, fuerte: true }; costa.add(fuerte); olas.push(fuerte);
      var mansa = new T.Mesh(new T.BoxGeometry(330, 0.5, 1.2), matOla.clone());
      mansa.position.x = -190; mansa.userData = { t: o / 7, fuerte: false }; costa.add(mansa); olas.push(mansa);
    }
    var texEspuma = new T.CanvasTexture(lienzo(64, 64, function (c) {
      var g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    }));
    var espuma = [];
    for (var e = 0; e < 12; e++) {
      var gota = new T.Sprite(new T.SpriteMaterial({ map: texEspuma, transparent: true, depthWrite: false }));
      gota.userData = { t: Math.random(), x: 40 + Math.random() * 300 }; costa.add(gota); espuma.push(gota);
    }
    // Muelle de madera, hacia el mar.
    var matMadera = new T.MeshLambertMaterial({ color: 0x8A6240 });
    var muelle = new T.Mesh(new T.BoxGeometry(12, 1.5, 170), matMadera);
    muelle.position.set(52, 5, 80); costa.add(muelle);
    for (var p = 0; p < 9; p++) {
      [-5, 5].forEach(function (dx) {
        var pilote = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 8, 6), matMadera);
        pilote.position.set(52 + dx, 1.5, p * 20); costa.add(pilote);
      });
    }
    return { grupo: costa, olas: olas, espuma: espuma, texEspuma: texEspuma };
  }

  function crearAvion(T, escena) {
    // Primero un hidroavión sencillo; cuando carga el modelo de Meshy, lo reemplaza.
    var avion = new T.Group(), cuerpo = new T.Group();
    var metal = new T.MeshLambertMaterial({ color: 0xC9CED1 });
    var fuselaje = new T.Mesh(new T.CylinderGeometry(0.9, 0.5, 8, 12), metal);
    fuselaje.rotation.x = Math.PI / 2; cuerpo.add(fuselaje);
    var ala = new T.Mesh(new T.BoxGeometry(11, 0.25, 2), metal); ala.position.set(0, -0.3, -0.8); cuerpo.add(ala);
    var cola = new T.Mesh(new T.BoxGeometry(0.2, 2, 1.4), metal); cola.position.set(0, 1, 3.4); cuerpo.add(cola);
    [-1.6, 1.6].forEach(function (x) {
      var flotador = new T.Mesh(new T.CylinderGeometry(0.45, 0.3, 7, 10), metal);
      flotador.rotation.x = Math.PI / 2; flotador.position.set(x, -2, -0.3); cuerpo.add(flotador);
    });
    avion.add(cuerpo);
    var helice = new T.Mesh(new T.CircleGeometry(1.7, 24),
      new T.MeshBasicMaterial({ color: 0x3B2E28, transparent: true, opacity: 0.3, side: T.DoubleSide }));
    helice.position.set(0, 0, -4.4); avion.add(helice);
    escena.add(avion);
    var partes = { avion: avion, helice: helice, modelo: null };
    if (T.GLTFLoader) {
      var cargador = new T.GLTFLoader();
      if (window.MeshoptDecoder) cargador.setMeshoptDecoder(window.MeshoptDecoder);
      cargador.load(H.base + '3d/vehiculos/hidroavion.glb', function (g) {
        var caja = new T.Box3().setFromObject(g.scene), tamano = caja.getSize(new T.Vector3()), centro = caja.getCenter(new T.Vector3());
        var s = 10 / (Math.max(tamano.x, tamano.z) || 1), pivote = new T.Group();
        g.scene.position.set(-centro.x, -centro.y, -centro.z);
        pivote.add(g.scene); pivote.scale.setScalar(s);
        pivote.rotation.y = GIRO_MODELO;
        avion.remove(cuerpo); avion.add(pivote);
        helice.position.set(0, HELICE_Y, -5.1);
        partes.modelo = pivote;
      }, undefined, function () { /* queda el avión sencillo */ });
    }
    return partes;
  }

  function crearMundo() {
    var T = window.THREE;
    var render = new T.WebGLRenderer({ antialias: true });
    render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    ui.mundo.appendChild(render.domElement);
    render.domElement.style.cssText = 'width:100%;height:100%;display:block';
    var escena = new T.Scene();
    escena.background = new T.CanvasTexture(lienzo(8, 256, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#3F9AD6'); g.addColorStop(0.6, '#A8E0F0'); g.addColorStop(1, '#FBEFC4');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }));
    escena.fog = new T.Fog(0xD8EEE6, 700, 2600);
    var camara = new T.PerspectiveCamera(60, 1, 0.5, 5000);
    escena.add(new T.HemisphereLight(0xffffff, 0x4a7f86, 1.2));
    var sol = new T.DirectionalLight(0xfff1c9, 0.9);
    sol.position.set(-300, 500, 300); escena.add(sol);

    var texMar = new T.CanvasTexture(lienzo(256, 256, function (c, w, h) {
      c.fillStyle = '#35A9B8'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 40; i++) {
        var x = Math.random() * w, y = Math.random() * h, l = 14 + Math.random() * 30;
        c.strokeStyle = Math.random() < 0.3 ? 'rgba(255,255,255,.7)' : 'rgba(18,100,120,.5)';
        c.lineWidth = 2 + Math.random() * 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 5, x + l, y); c.stroke();
      }
    }));
    texMar.wrapS = texMar.wrapT = T.RepeatWrapping; texMar.repeat.set(80, 80);
    var mar = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshBasicMaterial({ map: texMar }));
    mar.rotation.x = -Math.PI / 2; escena.add(mar);

    var texNube = new T.CanvasTexture(lienzo(256, 128, function (c) {
      c.fillStyle = '#fff';
      [[70, 80, 46], [118, 62, 54], [170, 78, 44], [128, 92, 50], [206, 92, 30], [40, 94, 28]].forEach(function (b) {
        c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.fill();
      });
    }));
    for (var n = 0; n < 12; n++) {
      var nube = new T.Sprite(new T.SpriteMaterial({ map: texNube, transparent: true, opacity: 0.9, fog: false }));
      var tam = 120 + Math.random() * 160;
      nube.scale.set(tam * 2, tam, 1);
      nube.position.set((Math.random() - 0.5) * 3000, 220 + Math.random() * 260, -1500 - Math.random() * 800);
      escena.add(nube);
    }

    var costa = crearCosta(T);
    escena.add(costa.grupo);
    var partes = crearAvion(T, escena);
    var gotas = [];
    for (var s = 0; s < 26; s++) {
      var gota = new T.Sprite(new T.SpriteMaterial({ map: costa.texEspuma, transparent: true, depthWrite: false, opacity: 0 }));
      gota.userData.vida = 0; escena.add(gota); gotas.push(gota);
    }
    var boyas = new T.Group();
    escena.add(boyas);

    function medir() {
      var w = ui.mundo.clientWidth || innerWidth, h = ui.mundo.clientHeight || innerHeight;
      render.setSize(w, h, false);
      camara.aspect = w / h;
      camara.fov = w < h ? 82 : 58;
      camara.updateProjectionMatrix();
    }
    medir();
    if (window.ResizeObserver) new ResizeObserver(medir).observe(ui.mundo);
    else window.addEventListener('resize', medir);
    return { T: T, render: render, escena: escena, camara: camara, texMar: texMar, costa: costa, partes: partes,
      gotas: gotas, boyas: boyas, letreros: [], medir: medir };
  }

  // ---------- estado ----------
  var vuelo = { fase: 'apagado', x: 0, vx: 0, y: ALTURA_INICIO, dist: DISTANCIA, costa: 1250, mando: 0, inclinacion: null,
    rumbo: null, t: 0, velocidad: VELOCIDAD, rebote: 0, inclinacionBase: null };
  var ronda = null, cuadro = 0, ultimo = 0, cierre = 0, textoTablero = '', carrilMarcado = -2;

  function ponerLetreros() {
    while (m3.boyas.children.length) m3.boyas.remove(m3.boyas.children[0]);
    m3.letreros = ronda.orden.map(function (op, i) {
      var g = letrero(m3.T, op.text, COLORES[i]);
      g.position.x = (i - 1) * CARRIL;
      m3.boyas.add(g);
      return g;
    });
  }

  function chapuzon(x, cuantas) {
    if (!m3) return;
    for (var k = 0; k < m3.gotas.length && cuantas > 0; k++) {
      var g = m3.gotas[k];
      if (g.userData.vida > 0) continue;
      cuantas--;
      g.userData.vida = 0.6 + Math.random() * 0.5;
      g.userData.v = [(Math.random() - 0.5) * 14, 8 + Math.random() * 12, 6 + Math.random() * 16];
      g.position.set(x + (Math.random() - 0.5) * 5, 0.5, 1 + Math.random() * 3);
    }
  }

  function moverAvion(dt) {
    var f = vuelo.fase, volando = f === 'vuelo' || f === 'intro' || f === 'crucero' || f === 'vuelta';
    // Timón: a mano, o solo hacia la boya que el jugador tocó.
    var mando = Math.max(-1, Math.min(1, vuelo.mando + (vuelo.inclinacion || 0)));
    if (Math.abs(mando) > 0.05) vuelo.rumbo = null;
    var quiere = vuelo.rumbo !== null ? Math.max(-1, Math.min(1, (vuelo.rumbo - vuelo.x) / 6)) : mando;
    if (f === 'agua' || f === 'apagado') quiere = 0;
    vuelo.vx += (quiere * 26 - vuelo.vx) * dt * 4;
    vuelo.x = Math.max(-X_MAX, Math.min(X_MAX, vuelo.x + vuelo.vx * dt));

    if (volando) {
      vuelo.velocidad += (VELOCIDAD - vuelo.velocidad) * dt * 2;
      if (f === 'vuelo') {
        vuelo.dist -= vuelo.velocidad * dt;
        var meta = ronda.conf.final ? Math.max(0, ALTURA_CANAL * vuelo.dist / ronda.largo) : ALTURA_CANAL;
        vuelo.y += (meta - vuelo.y) * dt * (ronda.conf.final ? 3 : 1.2);
        if (vuelo.dist <= 0) llegar();
      } else if (f !== 'intro') {
        vuelo.y += (ALTURA_CANAL - vuelo.y) * dt * 1.5;
        vuelo.dist -= vuelo.velocidad * dt;        // las boyas quedan atrás
      }
      vuelo.costa = Math.max(250, vuelo.costa - vuelo.velocidad * dt * 0.8);
    } else if (f === 'agua') {
      vuelo.velocidad = Math.max(0, vuelo.velocidad - 9 * dt);
      vuelo.dist -= vuelo.velocidad * dt;
      vuelo.y += (0 - vuelo.y) * dt * 5;
      vuelo.costa = Math.max(150, vuelo.costa - vuelo.velocidad * dt * 0.8);
      if (vuelo.velocidad > 4 && Math.random() < 0.5) chapuzon(vuelo.x, 2);
    }
    vuelo.rebote = Math.max(0, vuelo.rebote - dt);
  }

  function pintarMundo(dt) {
    var f = vuelo.fase, p = m3.partes;
    var flota = f === 'agua' ? Math.sin(vuelo.t * 3) * 0.25 : Math.sin(vuelo.t * 1.7) * 0.5;
    var y = vuelo.y + 3 + flota + Math.sin(vuelo.rebote * 9) * vuelo.rebote * 6;
    p.avion.position.set(vuelo.x, y, 0);
    p.avion.rotation.set(f === 'vuelo' && ronda && ronda.conf.final ? -0.07 : 0, -vuelo.vx * 0.012, -vuelo.vx * 0.022);
    p.helice.rotation.z = vuelo.t * 30;
    p.helice.material.opacity = f === 'agua' ? 0.3 * vuelo.velocidad / VELOCIDAD : 0.3;
    // De pie la pantalla es angosta: la cámara se aleja y sigue menos al avión, para que quepan el avión y las boyas.
    var angosta = m3.camara.aspect < 1;
    m3.camara.position.set(vuelo.x * (angosta ? 0.72 : 0.8), y + (angosta ? 10 : 7.5), angosta ? 30 : 19);
    m3.camara.lookAt(vuelo.x * (angosta ? 0.78 : 0.9), y + 1.5, -40);
    m3.texMar.offset.y += vuelo.velocidad * dt / 75;
    m3.boyas.position.z = -Math.max(vuelo.dist, -400);
    var alto = (ronda && ronda.conf.final ? 0 : ALTURA_CANAL) + 14;
    m3.letreros.forEach(function (l, i) {
      l.position.y += ((l.userData.fuera ? -30 : alto) - l.position.y) * dt * 3;
      l.children.forEach(function (h) { if (h.userData.boya) h.position.y = -l.position.y + 0.6 + Math.sin(vuelo.t * 2 + i) * 0.3; });
    });
    var c = m3.costa;
    c.grupo.position.z = -vuelo.costa;
    c.olas.forEach(function (o) {
      var t = (o.userData.t + vuelo.t * (o.userData.fuerte ? 0.16 : 0.1)) % 1;
      o.position.z = 230 - t * 235;
      o.position.y = o.userData.fuerte ? 1 + Math.sin(t * Math.PI) * 2.2 : 0.4;
      o.material.opacity = Math.sin(t * Math.PI) * (o.userData.fuerte ? 0.9 : 0.35);
    });
    c.espuma.forEach(function (e) {
      var t = (e.userData.t + vuelo.t * 0.6) % 1;
      e.position.set(e.userData.x, 3 + t * 16, -8 - t * 10);
      e.scale.setScalar(6 + t * 16);
      e.material.opacity = (1 - t) * 0.85;
    });
    m3.gotas.forEach(function (g) {
      if (g.userData.vida <= 0) { g.material.opacity = 0; return; }
      g.userData.vida -= dt;
      g.userData.v[1] -= 22 * dt;
      g.position.x += g.userData.v[0] * dt; g.position.y = Math.max(0.2, g.position.y + g.userData.v[1] * dt); g.position.z += g.userData.v[2] * dt;
      g.scale.setScalar(2.2); g.material.opacity = Math.min(1, g.userData.vida * 2);
    });
    m3.render.render(m3.escena, m3.camara);
  }

  function paso(ahora) {
    cuadro = requestAnimationFrame(paso);
    var dt = Math.min(0.05, (ahora - ultimo) / 1000 || 0.016);
    ultimo = ahora;
    vuelo.t += dt;
    moverAvion(dt);
    var texto = 'ALTURA ' + Math.round(vuelo.y * 3) + ' m' +
      (vuelo.fase === 'vuelo' ? '<br>BOYAS A ' + Math.max(0, Math.round(vuelo.dist * 2)) + ' m' : '');
    if (texto !== textoTablero) { textoTablero = texto; ui.tablero.innerHTML = texto; }
    marcarRumbo();
    if (m3) pintarMundo(dt);
  }

  // ---------- mando ----------
  function prepararMando() {
    var x0 = null;
    ui.raiz.addEventListener('pointerdown', function (e) { if (!e.target.closest('button')) x0 = e.clientX; });
    window.addEventListener('pointermove', function (e) {
      if (x0 !== null) vuelo.mando = Math.max(-1, Math.min(1, (e.clientX - x0) / 70));
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
    ui.raiz.addEventListener('click', H.despertarSonido);
    ui.raiz.addEventListener('touchend', H.despertarSonido);
    // Inclinación del celular: cuenta desde la postura que tenía al empezar la ronda y con una zona muerta.
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma === null || e.gamma === undefined || vuelo.fase === 'apagado') return;
      var acostado = innerHeight < innerWidth, alReves = window.screen && screen.orientation && screen.orientation.angle === 270;
      var grados = acostado ? e.beta * (alReves ? -1 : 1) : e.gamma;
      if (vuelo.inclinacionBase === null) vuelo.inclinacionBase = grados;
      var v = (grados - vuelo.inclinacionBase) / 26;
      vuelo.inclinacion = Math.abs(v) < ZONA_MUERTA ? 0 : Math.max(-1, Math.min(1, v));
    });
  }

  function carrilActual() {
    var mejor = -1, d = 1e9;
    if (!ronda) return -1;
    ronda.orden.forEach(function (op, i) {
      if (ronda.descartadas.indexOf(op) !== -1) return;
      var dx = Math.abs(vuelo.x - (i - 1) * CARRIL);
      if (dx < d) { d = dx; mejor = i; }
    });
    return mejor;
  }

  function marcarRumbo() {
    if (!ronda || vuelo.fase !== 'vuelo') return;
    var i = carrilActual();
    if (i === carrilMarcado) return;
    carrilMarcado = i;
    var botones = ui.tarjeta.querySelectorAll('.amz-op');
    for (var k = 0; k < botones.length; k++) botones[k].classList.toggle('amz-rumbo', k === i);
  }

  // ---------- fases ----------
  function pintarPregunta() {
    ui.tarjeta.innerHTML = '<div style="font:bold 17px ' + TITULO + '">' + ronda.q.title + '</div>' +
      '<div style="font-size:12px;color:#7A5A45">Vuela hacia la boya de tu respuesta, o tócala aquí.</div>';
    ronda.orden.forEach(function (op, i) {
      var b = el('button', '', '<b style="background:' + COLORES[i].fondo + '">' + COLORES[i].nombre + '</b><span>' + op.text + '</span>');
      b.type = 'button'; b.className = 'amz-op';
      b.disabled = ronda.descartadas.indexOf(op) !== -1;
      b.addEventListener('click', function () { vuelo.rumbo = (i - 1) * CARRIL; });
      ui.tarjeta.appendChild(b);
    });
    ui.tarjeta.style.animation = 'none';
    carrilMarcado = -2;                          // los botones son nuevos: hay que volver a marcar el rumbo
    void ui.tarjeta.offsetWidth;                 // reinicia la animación de entrada
    ui.tarjeta.style.animation = 'amzSube .4s';
  }

  function empezarRonda() {
    vuelo.fase = 'intro'; vuelo.dist = DISTANCIA; vuelo.rumbo = null; vuelo.inclinacionBase = null;
    ronda.largo = DISTANCIA;
    if (m3) ponerLetreros();
    ui.aviso.textContent = ronda.conf.aviso;
    ui.tarjeta.innerHTML = '<div style="font:bold 16px ' + TITULO + '">📻 Torre de control llamando…</div>';
    H.motorEncender();
    H.tono(660, 0.12, 'square', 0.05); setTimeout(function () { H.tono(880, 0.12, 'square', 0.05); }, 140);
    H.voz(ronda.conf.voz);
    var actual = ronda;
    setTimeout(function () {
      if (ronda !== actual || vuelo.fase !== 'intro') return;
      vuelo.fase = 'vuelo';
      pintarPregunta();
      setTimeout(function () { if (ronda === actual && vuelo.fase === 'vuelo') ui.aviso.textContent = ''; }, 2500);
    }, INTRO_MS);
  }

  function llegar() {
    var i = carrilActual(), op = ronda.orden[i];
    if (!ronda.primera) ronda.primera = op;
    if (op.score > 0) { acertar(); return; }
    // Boya equivocada: el avión rebota, la boya se hunde y hay que dar otra vuelta.
    ronda.descartadas.push(op);
    if (m3 && m3.letreros[i]) m3.letreros[i].userData.fuera = true;
    vuelo.fase = 'vuelta'; vuelo.rebote = 1; vuelo.rumbo = null;
    if (ronda.conf.final) chapuzon(vuelo.x, 10);
    H.tono(220, 0.35, 'sawtooth', 0.09, 90); H.ruido(0.4, 0.3);
    H.voz('torre_mal');
    ui.aviso.textContent = '¡Esa boya no era! Otra vuelta…';
    pintarPregunta();
    var actual = ronda;
    setTimeout(function () {
      if (ronda !== actual) return;
      vuelo.dist = DISTANCIA_VUELTA; ronda.largo = DISTANCIA_VUELTA;
      vuelo.fase = 'vuelo'; ui.aviso.textContent = '';
    }, 2600);
  }

  function acertar() {
    var actual = ronda, final = ronda.conf.final;
    [0, 130, 260, 420].forEach(function (ms, k) { setTimeout(function () { H.tono([523, 659, 784, 1047][k], 0.22, 'triangle', 0.09); }, ms); });
    if (final) {
      vuelo.fase = 'agua';
      chapuzon(vuelo.x, 16); H.ruido(0.9, 0.45);
      H.voz('torre_bien');
      setTimeout(function () { H.motorApagar(); H.voz('amerizaje_fin'); }, 3300);
      ui.aviso.textContent = '¡Amerizaje perfecto! 🌊';
      ui.tarjeta.innerHTML = '<div style="font:bold 19px ' + TITULO + ';color:#1F6E43;text-align:center">¡Llegamos al muelle! Ahora seguimos a pie.</div>';
    } else {
      vuelo.fase = 'crucero';
      ui.aviso.textContent = '¡Canal correcto! ✔';
      ui.tarjeta.innerHTML = '<div style="font:bold 19px ' + TITULO + ';color:#1F6E43;text-align:center">¡Bien! Ya se ve la costa…</div>';
    }
    setTimeout(function () {
      if (ronda !== actual) return;
      ronda = null;
      var respuesta = [actual.primera || actual.correcta];
      try { actual.q.setAnswer(respuesta); } catch (err) { console.warn('[amerizaje] no se pudo guardar la respuesta', err); }
      // Después del amerizaje la escena se quita antes de avisarle al tour, para no tapar la insignia.
      if (final) { cerrar(); setTimeout(function () { actual.ok(respuesta); }, CIERRE_MS); return; }
      actual.ok(respuesta);
      cierre = setTimeout(cerrar, ESPERA_SIGUIENTE_MS);
    }, final ? 10500 : 2600);
  }

  function cerrar() {
    clearTimeout(cierre);
    if (ronda) return;
    vuelo.fase = 'apagado';
    H.motorApagar();
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
    if (vuelo.fase === 'apagado') { vuelo.x = 0; vuelo.y = ALTURA_INICIO; vuelo.costa = 1250; vuelo.velocidad = VELOCIDAD; }
    ui.raiz.style.display = 'flex';
    requestAnimationFrame(function () { ui.raiz.style.opacity = '1'; });
    if (!cuadro) { ultimo = performance.now(); cuadro = requestAnimationFrame(paso); }
    if (!m3 && window.THREE) {
      try { m3 = crearMundo(); } catch (err) { console.warn('[amerizaje] sin 3D', err); }
    } else if (m3) { m3.medir(); }
  }

  var original = tour.quizShowQuestion;
  tour.quizShowQuestion = function (id) {
    var conf = PREGUNTAS[id], q = conf && H.modeloQuiz(id), self = this, args = arguments;
    var correcta = q && q.options && q.options.filter(function (o) { return o.score > 0; })[0];
    if (!conf || !q || q.answered || !correcta || !q.setAnswer || q.options.length > COLORES.length) return original.apply(self, args);
    return new Promise(function (ok) {
      if (ronda) { ok([]); return; }             // ya hay un amerizaje en curso: esta llamada repetida no cuenta
      var pausados = null;
      try { pausados = self.pauseCurrentPlayers(true); } catch (err) { pausados = null; }
      ronda = { q: q, conf: conf, correcta: correcta, descartadas: [], primera: null, largo: DISTANCIA,
        orden: q.options.slice().sort(function () { return Math.random() - 0.5; }),
        ok: function (r) {
          try { if (pausados) self.resumePlayers(pausados, true); } catch (err) { /* nada que reanudar */ }
          ok(r);
        } };
      Promise.race([H.libs, new Promise(function (listo) { setTimeout(listo, 4000); })]).then(function () {
        abrir();
        empezarRonda();
      });
    });
  };

  window.__amerizajeEstado = function () {
    return { fase: vuelo.fase, x: Math.round(vuelo.x), y: Math.round(vuelo.y), dist: Math.round(vuelo.dist), con3d: !!m3,
      modelo: !!(m3 && m3.partes.modelo), carril: carrilActual(), ronda: !!ronda };
  };
})(this);
