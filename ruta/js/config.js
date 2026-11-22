// Configuración de la Ruta del Guardián: una estación física por nivel del juego.
// Para activar el control por GPS (estilo Pokémon Go), escribe lat y lng de cada estación
// (en Google Maps: clic derecho sobre el lugar → copiar las coordenadas) y deja verificarGPS en true.
// Mientras una estación no tenga coordenadas, se desbloquea solo con su QR o su NFC.
window.GDM_RUTA = {
  sitio: 'https://safetyvr360-tech.github.io/guardian-de-memorias/',
  tour: '../index.htm',
  verificarGPS: true,
  radioMetros: 120,
  // true: para desbloquear un nivel hay que haber terminado la misión 360° del anterior.
  exigirMisionAnterior: true,
  estaciones: [
    {
      n: 1, nombre: 'La Plaza de los Recuerdos', lugar: 'Plaza principal de Puerto Colombia',
      lat: null, lng: null, clave: 'xSqDA7', color: '#E4613F', personaje: 'marina',
      insignia: 'Guardián de la Memoria', que: 'recuerdos',
      objetos: [['maleta', 'Maleta del viajero'], ['acordeon', 'Acordeón'], ['helice', 'Hélice'],
        ['olla', 'Olla de la abuela'], ['ventana', 'Ventana antigua']]
    },
    {
      n: 2, nombre: 'El Faro de los Sueños', lugar: 'Muelle y malecón',
      lat: null, lng: null, clave: '6j6ldQ', color: '#5B789E', personaje: 'azulin',
      insignia: 'Piloto del Caribe', que: 'postales del Caribe',
      objetos: [['torre', 'Torre azul'], ['espejo', 'Espejo de agua'], ['playa', 'La playa'], ['pueblo', 'El pueblo']]
    },
    {
      n: 3, nombre: 'El Escudo Verde del Caribe', lugar: 'Playa con la franja de manglar',
      lat: null, lng: null, clave: 'u3yVYg', color: '#7E8538', personaje: 'marina',
      insignia: 'Escudo Verde', que: 'postales del manglar',
      objetos: [['franja', 'La franja verde'], ['orilla', 'La orilla'], ['muelle', 'El muelle'], ['casas', 'Las casas']]
    },
    {
      n: 4, nombre: 'La Alerta en la Desembocadura', lugar: 'Desembocadura',
      lat: null, lng: null, clave: '1lFnOg', color: '#257A74', personaje: 'azulin',
      insignia: 'Limpiador de Orillas', que: 'residuos',
      objetos: [['bolsa', 'Bolsa plástica'], ['botella', 'Botella'], ['icopor', 'Icopor'], ['lata', 'Lata'],
        ['pitillo', 'Pitillo'], ['red', 'Red de pesca'], ['tapa', 'Tapa'], ['zapato', 'Zapato']]
    },
    {
      n: 5, nombre: 'El Santuario del Manglar', lugar: 'Manglar',
      lat: null, lng: null, clave: 'ooJ4Ag', color: '#C08A1E', personaje: 'marina',
      insignia: 'Guardián del Manglar', que: 'vecinos de Azulín',
      objetos: [['cangrejo1', 'Cangrejo azul'], ['cangrejo2', 'Cangrejo rojo'], ['cangrejo3', 'Cangrejito'],
        ['pez', 'Pez'], ['camaron', 'Camarón'], ['garza', 'Garza']]
    }
  ]
};
