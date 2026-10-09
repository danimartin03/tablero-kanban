// Aquí están los cambios sobre los DATOS del tablero: añadir, mover y borrar.
// No se toca la página: las funciones reciben el tablero y lo modifican.
//
// El tablero tiene esta forma:
//   {
//     columnas: [ { id, nombre, tarjetas: [ { id, titulo, descripcion, etiqueta, fecha } ] } ],
//     etiquetas: { rojo: 'Urgente', azul: 'Trabajo', ... }   <- el nombre que le doy a cada color
//   }
// El orden de las columnas y de las tarjetas es el orden que tienen en sus listas.

const ETIQUETAS = ['rojo', 'naranja', 'amarillo', 'verde', 'azul', 'morado'];

const NOMBRES_DE_ETIQUETA = {
  rojo: 'Rojo',
  naranja: 'Naranja',
  amarillo: 'Amarillo',
  verde: 'Verde',
  azul: 'Azul',
  morado: 'Morado'
};

const LIMITE_COLUMNAS = 8;
const LIMITE_TARJETAS = 200;
const LIMITE_TITULO = 80;
const LIMITE_DESCRIPCION = 500;
const LIMITE_NOMBRE_COLUMNA = 40;
const LIMITE_NOMBRE_ETIQUETA = 20;

// ---------- Crear tableros ----------

function crearTableroVacio() {
  return {
    columnas: [
      { id: 1, nombre: 'Por hacer', tarjetas: [] },
      { id: 2, nombre: 'En marcha', tarjetas: [] },
      { id: 3, nombre: 'Hecho', tarjetas: [] }
    ],
    // Copio el objeto para que cada tablero tenga sus propios nombres
    etiquetas: Object.assign({}, NOMBRES_DE_ETIQUETA)
  };
}

// El tablero que se ve la primera vez, con tres tarjetas que explican cómo va
function crearTableroDeEjemplo(hoy) {
  const tablero = crearTableroVacio();
  tablero.columnas[0].tarjetas = [
    {
      id: 4,
      titulo: 'Arrastra esta tarjeta a otra columna',
      descripcion: 'Cógela por los puntitos de la izquierda. En el móvil también funciona.',
      etiqueta: 'amarillo',
      fecha: ''
    },
    {
      id: 5,
      titulo: 'Muévela con el teclado',
      descripcion: 'Pon el foco en la tarjeta y pulsa Alt + flechas, o usa el botón Mover.',
      etiqueta: 'azul',
      fecha: ''
    }
  ];
  tablero.columnas[1].tarjetas = [
    {
      id: 6,
      titulo: 'Edita una tarjeta',
      descripcion: 'Pulsa el título para cambiar el texto, la etiqueta o la fecha límite.',
      etiqueta: 'verde',
      fecha: hoy
    }
  ];
  return tablero;
}

// ---------- Buscar cosas ----------

// Columnas y tarjetas comparten numeración, así que busco el id más alto entre todas
function nuevoId(tablero) {
  let mayor = 0;
  for (const columna of tablero.columnas) {
    if (columna.id > mayor) mayor = columna.id;
    for (const tarjeta of columna.tarjetas) {
      if (tarjeta.id > mayor) mayor = tarjeta.id;
    }
  }
  return mayor + 1;
}

function buscarColumna(tablero, idColumna) {
  return tablero.columnas.find(function (columna) { return columna.id === idColumna; }) || null;
}

// Devuelvo la tarjeta junto con su columna y su posición, que es lo que casi siempre necesito
function buscarTarjeta(tablero, idTarjeta) {
  for (const columna of tablero.columnas) {
    const posicion = columna.tarjetas.findIndex(function (tarjeta) { return tarjeta.id === idTarjeta; });
    if (posicion !== -1) {
      return { tarjeta: columna.tarjetas[posicion], columna: columna, posicion: posicion };
    }
  }
  return null;
}

function contarTarjetas(tablero) {
  let total = 0;
  for (const columna of tablero.columnas) {
    total += columna.tarjetas.length;
  }
  return total;
}

// ---------- Columnas ----------

function anadirColumna(tablero, nombre) {
  if (tablero.columnas.length >= LIMITE_COLUMNAS) return null;
  const columna = { id: nuevoId(tablero), nombre: nombre, tarjetas: [] };
  tablero.columnas.push(columna);
  return columna;
}

function borrarColumna(tablero, idColumna) {
  tablero.columnas = tablero.columnas.filter(function (columna) { return columna.id !== idColumna; });
}

// Me aseguro de que una posición no se sale de la lista
function ajustarPosicion(posicion, maximo) {
  return Math.max(0, Math.min(posicion, maximo));
}

// Saco la columna de donde está y la meto en su sitio nuevo.
// Devuelvo true si ha cambiado algo.
function moverColumna(tablero, idColumna, posicionNueva) {
  const posicionVieja = tablero.columnas.findIndex(function (columna) { return columna.id === idColumna; });
  if (posicionVieja === -1) return false;

  const columna = tablero.columnas.splice(posicionVieja, 1)[0];
  const destino = ajustarPosicion(posicionNueva, tablero.columnas.length);
  tablero.columnas.splice(destino, 0, columna);
  return destino !== posicionVieja;
}

// ---------- Tarjetas ----------

function anadirTarjeta(tablero, idColumna, datos) {
  const columna = buscarColumna(tablero, idColumna);
  if (!columna || contarTarjetas(tablero) >= LIMITE_TARJETAS) return null;

  const tarjeta = {
    id: nuevoId(tablero),
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    etiqueta: datos.etiqueta,
    fecha: datos.fecha
  };
  columna.tarjetas.push(tarjeta);
  return tarjeta;
}

function borrarTarjeta(tablero, idTarjeta) {
  const encontrada = buscarTarjeta(tablero, idTarjeta);
  if (!encontrada) return;
  encontrada.columna.tarjetas.splice(encontrada.posicion, 1);
}

// Muevo una tarjeta a una columna y a una posición dentro de ella.
// OJO: la posición es la que tendrá DESPUÉS de haberla quitado de donde estaba.
// Por eso primero la saco y luego la meto: así vale igual para cambiar de columna
// que para subirla o bajarla dentro de la suya. Devuelvo true si ha cambiado algo.
function moverTarjeta(tablero, idTarjeta, idColumnaDestino, posicionNueva) {
  const encontrada = buscarTarjeta(tablero, idTarjeta);
  const destino = buscarColumna(tablero, idColumnaDestino);
  if (!encontrada || !destino) return false;

  encontrada.columna.tarjetas.splice(encontrada.posicion, 1);
  const posicion = ajustarPosicion(posicionNueva, destino.tarjetas.length);
  destino.tarjetas.splice(posicion, 0, encontrada.tarjeta);

  return destino !== encontrada.columna || posicion !== encontrada.posicion;
}

// ---------- Fechas y filtros ----------

// La fecha de un día con la forma 2026-03-15, que es la del <input type="date">.
// Con ese formato puedo comparar dos fechas como si fueran texto: "2026-03-15" < "2026-04-01".
function fechaComoTexto(dia) {
  const mes = String(dia.getMonth() + 1).padStart(2, '0');
  const numero = String(dia.getDate()).padStart(2, '0');
  return dia.getFullYear() + '-' + mes + '-' + numero;
}

// Cómo va una fecha límite respecto a hoy: 'vencida', 'hoy', 'manana' o '' si va bien de tiempo
function estadoDeFecha(fecha, hoy) {
  if (!fecha) return '';
  if (fecha < hoy) return 'vencida';
  if (fecha === hoy) return 'hoy';

  const partes = hoy.split('-');
  const manana = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]) + 1);
  return fecha === fechaComoTexto(manana) ? 'manana' : '';
}

// ¿Pasa esta tarjeta la búsqueda y el filtro de etiqueta?
// texto: lo escrito en el buscador. etiqueta: 'todas', 'ninguna' o un color.
function pasaElFiltro(tarjeta, texto, etiqueta) {
  if (etiqueta === 'ninguna' && tarjeta.etiqueta !== '') return false;
  if (etiqueta !== 'todas' && etiqueta !== 'ninguna' && tarjeta.etiqueta !== etiqueta) return false;

  const buscado = texto.trim().toLowerCase();
  if (!buscado) return true;
  return tarjeta.titulo.toLowerCase().includes(buscado) || tarjeta.descripcion.toLowerCase().includes(buscado);
}
