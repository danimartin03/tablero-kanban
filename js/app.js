// Aquí va todo lo que toca la página: pintar el tablero, las ventanas y los botones.

const CLAVE_TEMA = 'tablero-kanban:tema';

// El tablero entero (mira su forma en tablero.js)
let tablero = null;
// Lo que hay puesto en el buscador y en el filtro de etiqueta
const filtro = { texto: '', etiqueta: 'todas' };

// ---------- Ayudas pequeñas ----------

// Atajo para no escribir document.getElementById cien veces
function porId(id) {
  return document.getElementById(id);
}

// Creo un elemento con su clase y su texto de una vez.
// OJO: el texto va siempre con textContent, porque títulos y nombres los escribe
// el usuario y no quiero que se cuele HTML por ahí.
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto) elemento.textContent = texto;
  return elemento;
}

// Escribo en la zona aria-live para que el lector de pantalla cuente lo que pasa
function decirEstado(texto) {
  porId('mensajeEstado').textContent = texto;
}

// Guardo después de cada cambio. Si falla, enseño un aviso arriba.
function guardar() {
  porId('avisoGuardado').hidden = guardarTablero(tablero);
}

function hayFiltro() {
  return filtro.texto.trim() !== '' || filtro.etiqueta !== 'todas';
}

// ---------- Tema claro / oscuro ----------

// El tema ya lo ha puesto el script del <head> (para que no parpadee).
// Aquí solo dejo el botón con el texto que toca.
function pintarBotonTema() {
  const esOscuro = document.documentElement.dataset.tema === 'oscuro';
  porId('botonTema').textContent = esOscuro ? 'Tema claro' : 'Tema oscuro';
  porId('botonTema').setAttribute('aria-pressed', esOscuro);
}

function cambiarTema() {
  const esOscuro = document.documentElement.dataset.tema === 'oscuro';
  const temaNuevo = esOscuro ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = temaNuevo;
  guardarDato(CLAVE_TEMA, temaNuevo);
  pintarBotonTema();
}

// ---------- Pintar el tablero ----------

// Borro todas las columnas y las vuelvo a crear a partir de los datos.
// Son pocos elementos y así la pantalla siempre coincide con lo que hay guardado.
function pintarTablero() {
  const zona = porId('columnas');
  const hoy = fechaComoTexto(new Date());
  zona.textContent = '';

  tablero.columnas.forEach(function (columna, numero) {
    // En la última columna (la de "hecho") no aviso de fechas: eso ya está terminado
    const esLaUltima = numero === tablero.columnas.length - 1;
    zona.append(crearColumna(columna, esLaUltima, hoy));
  });

  porId('botonNuevaColumna').hidden = tablero.columnas.length >= LIMITE_COLUMNAS;
  porId('avisoFiltro').hidden = !hayFiltro();
}

function crearColumna(columna, esLaUltima, hoy) {
  const visibles = columna.tarjetas.filter(function (tarjeta) {
    return pasaElFiltro(tarjeta, filtro.texto, filtro.etiqueta);
  });

  const seccion = crear('section', 'columna');
  seccion.dataset.columna = columna.id;
  seccion.setAttribute('aria-labelledby', 'columna-' + columna.id);

  const asa = crear('span', 'asa asa-columna');
  asa.setAttribute('aria-hidden', 'true');
  asa.title = 'Arrastrar columna';

  const titulo = crear('h2', '', columna.nombre);
  titulo.id = 'columna-' + columna.id;

  const total = columna.tarjetas.length;
  const contador = crear('span', 'contador', hayFiltro() ? visibles.length + ' de ' + total : String(total));
  contador.setAttribute('aria-label', (total === 1 ? '1 tarjeta' : total + ' tarjetas'));

  const opciones = crear('button', 'boton-icono boton-opciones', '⋯');
  opciones.type = 'button';
  opciones.setAttribute('aria-label', 'Opciones de la columna ' + columna.nombre);

  const cabecera = crear('header', 'columna-cabecera');
  cabecera.append(asa, titulo, contador, opciones);

  const lista = crear('ul', 'lista-tarjetas');
  for (const tarjeta of visibles) {
    lista.append(crearTarjeta(tarjeta, !esLaUltima, hoy));
  }
  if (visibles.length === 0) {
    lista.append(crear('li', 'columna-vacia', hayFiltro() ? 'Ninguna tarjeta coincide' : 'Sin tarjetas'));
  }

  const anadir = crear('button', 'boton-anadir', '+ Añadir tarjeta');
  anadir.type = 'button';
  anadir.setAttribute('aria-label', 'Añadir tarjeta a ' + columna.nombre);

  seccion.append(cabecera, lista, anadir);
  return seccion;
}

function crearTarjeta(tarjeta, avisarDeFecha, hoy) {
  const nota = crear('li', 'tarjeta');
  nota.dataset.tarjeta = tarjeta.id;
  nota.dataset.etiqueta = tarjeta.etiqueta;

  const asa = crear('span', 'asa asa-tarjeta');
  asa.setAttribute('aria-hidden', 'true');
  asa.title = 'Arrastrar tarjeta';

  // El título es un botón: al pulsarlo se abre la tarjeta para editarla
  const titulo = crear('button', 'tarjeta-titulo', tarjeta.titulo);
  titulo.type = 'button';

  const arriba = crear('div', 'tarjeta-arriba');
  arriba.append(asa, titulo);
  nota.append(arriba);

  if (tarjeta.descripcion) {
    nota.append(crear('p', 'tarjeta-descripcion', tarjeta.descripcion));
  }

  const pie = crear('div', 'tarjeta-pie');
  if (tarjeta.etiqueta) {
    pie.append(crear('span', 'chip chip-etiqueta', tablero.etiquetas[tarjeta.etiqueta]));
  }
  if (tarjeta.fecha) {
    pie.append(crearChipDeFecha(tarjeta.fecha, avisarDeFecha, hoy));
  }

  const mover = crear('button', 'boton-mover', 'Mover');
  mover.type = 'button';
  mover.setAttribute('aria-label', 'Mover la tarjeta ' + tarjeta.titulo);
  pie.append(mover);

  nota.append(pie);
  return nota;
}

// "2026-03-15" -> "15 mar"
function formatearFecha(fecha) {
  const partes = fecha.split('-');
  // OJO: no uso new Date("2026-03-15") porque lo toma como hora UTC y según
  // la zona horaria puede salir el día anterior. Le paso año, mes y día sueltos.
  const dia = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  return dia.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function crearChipDeFecha(fecha, avisar, hoy) {
  const estado = avisar ? estadoDeFecha(fecha, hoy) : '';
  // El aviso va escrito, no solo en color
  if (estado === 'vencida') return crear('span', 'chip chip-fecha vencida', 'Vencida · ' + formatearFecha(fecha));
  if (estado === 'hoy') return crear('span', 'chip chip-fecha pronto', 'Vence hoy');
  if (estado === 'manana') return crear('span', 'chip chip-fecha pronto', 'Vence mañana');
  return crear('span', 'chip chip-fecha', 'Para el ' + formatearFecha(fecha));
}

// ---------- Ventanas comunes ----------

// Abro un <dialog> y espero a que se cierre. Devuelvo true si se cerró con "aceptar".
// Los botones están dentro de un <form method="dialog">, así que al pulsarlos
// el propio navegador cierra la ventana y me deja en returnValue el value del botón.
function abrirDialogo(dialogo) {
  return new Promise(function (resolver) {
    // Lo vacío antes, porque si cierran con Escape se queda el valor de la vez anterior
    dialogo.returnValue = '';
    dialogo.showModal();
    dialogo.addEventListener('close', function () {
      resolver(dialogo.returnValue === 'aceptar');
    }, { once: true });
  });
}

function confirmar(pregunta, textoBoton) {
  porId('textoConfirmar').textContent = pregunta;
  porId('botonConfirmar').textContent = textoBoton;
  return abrirDialogo(porId('dialogoConfirmar'));
}

function mostrarError(idParrafo, mensaje) {
  porId(idParrafo).textContent = mensaje;
  porId(idParrafo).hidden = mensaje === '';
}

// Aviso general debajo de la barra (límites alcanzados, archivo que no vale...)
function avisar(mensaje) {
  mostrarError('avisoGeneral', mensaje);
}

// ---------- Columnas ----------

// La columna que tengo abierta en la ventana, o null si estoy creando una nueva
let columnaEditada = null;

function abrirDialogoColumna(columna) {
  columnaEditada = columna;
  porId('tituloDialogoColumna').textContent = columna ? 'Opciones de la columna' : 'Nueva columna';
  porId('campoNombreColumna').value = columna ? columna.nombre : '';
  mostrarError('errorColumna', '');

  // Mover y borrar solo tienen sentido si la columna ya existe
  porId('opcionesColumna').hidden = !columna;
  if (columna) {
    const posicion = tablero.columnas.indexOf(columna);
    porId('botonColumnaIzquierda').disabled = posicion === 0;
    porId('botonColumnaDerecha').disabled = posicion === tablero.columnas.length - 1;
  }
  porId('dialogoColumna').showModal();
}

function guardarColumna(evento) {
  evento.preventDefault();
  const nombre = limpiarTexto(porId('campoNombreColumna').value, LIMITE_NOMBRE_COLUMNA);
  if (!nombre) {
    mostrarError('errorColumna', 'Ponle un nombre a la columna.');
    porId('campoNombreColumna').focus();
    return;
  }

  let columna = columnaEditada;
  if (columna) {
    columna.nombre = nombre;
  } else {
    columna = anadirColumna(tablero, nombre);
  }

  guardar();
  porId('dialogoColumna').close();
  pintarTablero();
  enfocarColumna(columna.id);
  decirEstado('Columna ' + nombre + ' guardada.');
}

// pasos: -1 para la izquierda, 1 para la derecha
function moverColumnaConBoton(pasos) {
  const columna = columnaEditada;
  const posicion = tablero.columnas.indexOf(columna);
  moverColumna(tablero, columna.id, posicion + pasos);

  guardar();
  porId('dialogoColumna').close();
  pintarTablero();
  enfocarColumna(columna.id);
  decirEstado('Columna ' + columna.nombre + ' movida a la posición ' + (tablero.columnas.indexOf(columna) + 1) + ' de ' + tablero.columnas.length + '.');
}

async function borrarColumnaConAviso() {
  const columna = columnaEditada;
  const cuantas = columna.tarjetas.length;
  porId('dialogoColumna').close();

  let pregunta = '¿Borrar la columna «' + columna.nombre + '»?';
  if (cuantas === 1) pregunta = '¿Borrar la columna «' + columna.nombre + '» y su tarjeta? No se puede deshacer.';
  if (cuantas > 1) pregunta = '¿Borrar la columna «' + columna.nombre + '» y sus ' + cuantas + ' tarjetas? No se puede deshacer.';

  const seguro = await confirmar(pregunta, 'Borrar columna');
  if (!seguro) {
    enfocarColumna(columna.id);
    return;
  }

  borrarColumna(tablero, columna.id);
  guardar();
  pintarTablero();
  decirEstado('Columna ' + columna.nombre + ' borrada.');
  porId('botonNuevaColumna').focus();
}

// Después de repintar, el botón que tenía el foco ya no existe.
// Con esto lo devuelvo al botón de opciones de la columna.
function enfocarColumna(idColumna) {
  const boton = document.querySelector('[data-columna="' + idColumna + '"] .boton-opciones');
  if (boton) boton.focus();
}

// ---------- Clics dentro del tablero ----------

// Un solo listener para todo el tablero: miro qué botón se ha pulsado y de qué columna es.
// Así no tengo que poner un listener a cada botón cada vez que repinto.
function alPulsarEnTablero(evento) {
  const boton = evento.target.closest('button');
  if (!boton) return;
  const columna = buscarColumna(tablero, Number(boton.closest('.columna').dataset.columna));

  if (boton.matches('.boton-opciones')) abrirDialogoColumna(columna);
  if (boton.matches('.boton-anadir')) abrirDialogoTarjeta(null, columna);

  // Los otros botones están dentro de una tarjeta
  const nota = boton.closest('.tarjeta');
  if (!nota) return;
  const tarjeta = buscarTarjeta(tablero, Number(nota.dataset.tarjeta)).tarjeta;

  if (boton.matches('.tarjeta-titulo')) abrirDialogoTarjeta(tarjeta, columna);
}

// ---------- Etiquetas ----------

// Relleno un <select> con las etiquetas. Lo uso en el filtro y en la ventana de tarjeta,
// que solo cambian en las primeras opciones.
function pintarOpcionesDeEtiqueta(select, primeras) {
  const elegida = select.value;
  select.textContent = '';

  for (const primera of primeras) {
    const opcion = crear('option', '', primera.texto);
    opcion.value = primera.valor;
    select.append(opcion);
  }
  for (const color of ETIQUETAS) {
    const opcion = crear('option', '', tablero.etiquetas[color]);
    opcion.value = color;
    select.append(opcion);
  }

  // Dejo elegido lo que había antes de repintar (si sigue existiendo)
  select.value = elegida;
  if (select.selectedIndex === -1) select.selectedIndex = 0;
}

function pintarFiltroDeEtiquetas() {
  pintarOpcionesDeEtiqueta(porId('campoFiltro'), [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'ninguna', texto: 'Sin etiqueta' }
  ]);
}

function abrirDialogoEtiquetas() {
  const zona = porId('camposEtiquetas');
  zona.textContent = '';

  for (const color of ETIQUETAS) {
    const campo = crear('input');
    campo.type = 'text';
    campo.id = 'etiqueta-' + color;
    campo.maxLength = LIMITE_NOMBRE_ETIQUETA;
    campo.value = tablero.etiquetas[color];

    // Reutilizo el estilo de la tarjeta para enseñar el puntito de cada color
    const etiqueta = crear('label', 'chip chip-etiqueta tarjeta-muestra', NOMBRES_DE_ETIQUETA[color]);
    etiqueta.htmlFor = campo.id;
    etiqueta.dataset.etiqueta = color;

    const caja = crear('div', 'campo');
    caja.append(etiqueta, campo);
    zona.append(caja);
  }
  porId('dialogoEtiquetas').showModal();
}

function guardarEtiquetas(evento) {
  evento.preventDefault();
  for (const color of ETIQUETAS) {
    const nombre = limpiarTexto(porId('etiqueta-' + color).value, LIMITE_NOMBRE_ETIQUETA);
    // Si la dejan en blanco, vuelve a llamarse como el color
    tablero.etiquetas[color] = nombre || NOMBRES_DE_ETIQUETA[color];
  }
  guardar();
  porId('dialogoEtiquetas').close();
  pintarFiltroDeEtiquetas();
  pintarTablero();
  decirEstado('Nombres de las etiquetas guardados.');
}

// ---------- Tarjetas ----------

// La tarjeta que tengo abierta en la ventana, o null si estoy creando una nueva
let tarjetaEditada = null;

function abrirDialogoTarjeta(tarjeta, columna) {
  if (!tarjeta && contarTarjetas(tablero) >= LIMITE_TARJETAS) {
    avisar('El tablero ya tiene ' + LIMITE_TARJETAS + ' tarjetas, que es el máximo. Borra alguna para añadir más.');
    return;
  }
  avisar('');
  tarjetaEditada = tarjeta;

  porId('tituloDialogoTarjeta').textContent = tarjeta ? 'Editar tarjeta' : 'Nueva tarjeta';
  porId('campoTitulo').value = tarjeta ? tarjeta.titulo : '';
  porId('campoDescripcion').value = tarjeta ? tarjeta.descripcion : '';
  porId('campoFecha').value = tarjeta ? tarjeta.fecha : '';
  porId('botonBorrarTarjeta').hidden = !tarjeta;
  mostrarError('errorTarjeta', '');

  pintarOpcionesDeEtiqueta(porId('campoEtiqueta'), [{ valor: '', texto: 'Sin etiqueta' }]);
  porId('campoEtiqueta').value = tarjeta ? tarjeta.etiqueta : '';

  const selectColumna = porId('campoColumna');
  selectColumna.textContent = '';
  for (const otra of tablero.columnas) {
    const opcion = crear('option', '', otra.nombre);
    opcion.value = otra.id;
    selectColumna.append(opcion);
  }
  selectColumna.value = columna.id;

  porId('dialogoTarjeta').showModal();
}

function guardarTarjeta(evento) {
  evento.preventDefault();
  const titulo = limpiarTexto(porId('campoTitulo').value, LIMITE_TITULO);
  if (!titulo) {
    mostrarError('errorTarjeta', 'Ponle un título a la tarjeta.');
    porId('campoTitulo').focus();
    return;
  }

  const datos = {
    titulo: titulo,
    descripcion: limpiarTexto(porId('campoDescripcion').value, LIMITE_DESCRIPCION),
    etiqueta: porId('campoEtiqueta').value,
    fecha: porId('campoFecha').value
  };
  const idColumna = Number(porId('campoColumna').value);

  let tarjeta = tarjetaEditada;
  if (tarjeta) {
    Object.assign(tarjeta, datos);
    // Si le han cambiado la columna en el formulario, la paso al final de la nueva
    const donde = buscarTarjeta(tablero, tarjeta.id);
    if (donde.columna.id !== idColumna) {
      moverTarjeta(tablero, tarjeta.id, idColumna, buscarColumna(tablero, idColumna).tarjetas.length);
    }
  } else {
    tarjeta = anadirTarjeta(tablero, idColumna, datos);
  }

  guardar();
  porId('dialogoTarjeta').close();
  pintarTablero();
  enfocarTarjeta(tarjeta.id);
  decirEstado('Tarjeta ' + titulo + ' guardada.');
}

async function borrarTarjetaConAviso() {
  const tarjeta = tarjetaEditada;
  const columna = buscarTarjeta(tablero, tarjeta.id).columna;
  porId('dialogoTarjeta').close();

  const seguro = await confirmar('¿Borrar la tarjeta «' + tarjeta.titulo + '»?', 'Borrar tarjeta');
  if (!seguro) {
    enfocarTarjeta(tarjeta.id);
    return;
  }

  borrarTarjeta(tablero, tarjeta.id);
  guardar();
  pintarTablero();
  decirEstado('Tarjeta ' + tarjeta.titulo + ' borrada.');
  document.querySelector('[data-columna="' + columna.id + '"] .boton-anadir').focus();
}

// Devuelvo el foco al título de una tarjeta después de repintar.
// Si la tarjeta está oculta por el filtro no la encuentro, y no pasa nada.
function enfocarTarjeta(idTarjeta) {
  const titulo = document.querySelector('[data-tarjeta="' + idTarjeta + '"] .tarjeta-titulo');
  if (titulo) titulo.focus();
}

async function vaciarTablero() {
  const cuantas = contarTarjetas(tablero);
  if (cuantas === 0) {
    decirEstado('El tablero ya está vacío.');
    return;
  }

  const seguro = await confirmar('¿Borrar las ' + cuantas + ' tarjetas del tablero? Las columnas se quedan. No se puede deshacer.', 'Vaciar tablero');
  if (!seguro) return;

  for (const columna of tablero.columnas) {
    columna.tarjetas = [];
  }
  guardar();
  pintarTablero();
  decirEstado('Tablero vacío.');
}

// ---------- Arranque ----------

// Espero a DOMContentLoaded para que ya estén cargados todos los archivos JS
document.addEventListener('DOMContentLoaded', arrancar);

function arrancar() {
  tablero = leerTablero();
  pintarBotonTema();
  pintarFiltroDeEtiquetas();
  pintarTablero();

  porId('botonTema').addEventListener('click', cambiarTema);
  porId('columnas').addEventListener('click', alPulsarEnTablero);

  porId('botonNuevaColumna').addEventListener('click', function () { abrirDialogoColumna(null); });
  porId('formularioColumna').addEventListener('submit', guardarColumna);
  porId('botonCancelarColumna').addEventListener('click', function () { porId('dialogoColumna').close(); });
  porId('botonColumnaIzquierda').addEventListener('click', function () { moverColumnaConBoton(-1); });
  porId('botonColumnaDerecha').addEventListener('click', function () { moverColumnaConBoton(1); });
  porId('botonBorrarColumna').addEventListener('click', borrarColumnaConAviso);

  porId('formularioTarjeta').addEventListener('submit', guardarTarjeta);
  porId('botonCancelarTarjeta').addEventListener('click', function () { porId('dialogoTarjeta').close(); });
  porId('botonBorrarTarjeta').addEventListener('click', borrarTarjetaConAviso);
  porId('botonEtiquetas').addEventListener('click', abrirDialogoEtiquetas);
  porId('formularioEtiquetas').addEventListener('submit', guardarEtiquetas);
  porId('botonCancelarEtiquetas').addEventListener('click', function () { porId('dialogoEtiquetas').close(); });
  porId('botonVaciar').addEventListener('click', vaciarTablero);
}
