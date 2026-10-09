// Guardar y leer el tablero en el navegador, y comprobar que lo que leo está bien.

const CLAVE_TABLERO = 'tablero-kanban:tablero';

// Guardo cosas en localStorage. Va en try/catch porque en modo privado
// o con el almacenamiento lleno puede fallar, y no quiero que rompa la página.
// Devuelvo true o false para poder avisar si no se ha guardado.
function guardarDato(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    console.warn('No he podido guardar en localStorage:', error);
    return false;
  }
}

// Leo lo guardado. Si no hay nada o está roto, devuelvo null y ya está.
function leerDato(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave));
  } catch (error) {
    return null;
  }
}

function guardarTablero(tablero) {
  return guardarDato(CLAVE_TABLERO, tablero);
}

// Si hay un tablero guardado y está bien, lo uso. Si no, empiezo con el de ejemplo.
function leerTablero() {
  const guardado = validarTablero(leerDato(CLAVE_TABLERO));
  return guardado || crearTableroDeEjemplo(fechaComoTexto(new Date()));
}

// ---------- Comprobar que un tablero está bien ----------

function esObjeto(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// La fecha es opcional: vale vacía o con forma de 2026-03-15
function esFechaValida(valor) {
  return valor === '' || (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor));
}

// Me quedo con el texto sin espacios de sobra y recortado. Si no es texto, devuelvo ''.
function limpiarTexto(valor, maximo) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, maximo);
}

// Reviso un tablero que viene de fuera (localStorage o un JSON importado).
// OJO: no me fío de nada de lo que llega. Devuelvo una copia limpia, solo con
// los campos que conozco, o null si algo no cuadra.
function validarTablero(datos) {
  if (!esObjeto(datos) || !Array.isArray(datos.columnas)) return null;
  if (datos.columnas.length > LIMITE_COLUMNAS) return null;

  // Los ids los pongo yo de nuevo, así no tengo que comprobar que no se repiten
  let siguienteId = 1;
  let totalTarjetas = 0;
  const columnas = [];

  for (const columna of datos.columnas) {
    if (!esObjeto(columna) || !Array.isArray(columna.tarjetas)) return null;
    const nombre = limpiarTexto(columna.nombre, LIMITE_NOMBRE_COLUMNA);
    if (!nombre) return null;

    const tarjetas = [];
    const idColumna = siguienteId++;
    for (const tarjeta of columna.tarjetas) {
      const limpia = validarTarjeta(tarjeta);
      if (!limpia) return null;
      limpia.id = siguienteId++;
      tarjetas.push(limpia);
    }

    totalTarjetas += tarjetas.length;
    columnas.push({ id: idColumna, nombre: nombre, tarjetas: tarjetas });
  }
  if (totalTarjetas > LIMITE_TARJETAS) return null;

  // Si a alguna etiqueta le falta el nombre, le dejo el del color
  const etiquetas = {};
  const guardadas = esObjeto(datos.etiquetas) ? datos.etiquetas : {};
  for (const color of ETIQUETAS) {
    etiquetas[color] = limpiarTexto(guardadas[color], LIMITE_NOMBRE_ETIQUETA) || NOMBRES_DE_ETIQUETA[color];
  }

  return { columnas: columnas, etiquetas: etiquetas };
}

function validarTarjeta(datos) {
  if (!esObjeto(datos)) return null;

  const titulo = limpiarTexto(datos.titulo, LIMITE_TITULO);
  if (!titulo) return null;
  if (datos.etiqueta !== '' && !ETIQUETAS.includes(datos.etiqueta)) return null;
  if (!esFechaValida(datos.fecha)) return null;

  return {
    id: 0,
    titulo: titulo,
    descripcion: limpiarTexto(datos.descripcion, LIMITE_DESCRIPCION),
    etiqueta: datos.etiqueta,
    fecha: datos.fecha
  };
}

// ---------- Exportar e importar ----------

const NOMBRE_APP = 'tablero-kanban';
const TAMANO_MAXIMO_ARCHIVO = 1024 * 1024; // 1 MB, de sobra para un tablero

// El tablero como texto JSON. Le pongo delante el nombre de la app y una versión
// para poder reconocer el archivo al importarlo.
function exportarTablero(tablero) {
  const datos = { app: NOMBRE_APP, version: 1, tablero: tablero };
  return JSON.stringify(datos, null, 2);
}

// Paso el texto de un archivo a un tablero. Devuelvo { tablero, error }.
function importarTablero(texto) {
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch (error) {
    return { tablero: null, error: 'El archivo no es un JSON válido.' };
  }

  if (!esObjeto(datos) || datos.app !== NOMBRE_APP) {
    return { tablero: null, error: 'Este archivo no es un tablero exportado desde esta página.' };
  }

  const tablero = validarTablero(datos.tablero);
  if (!tablero) {
    return { tablero: null, error: 'El archivo tiene datos que no cuadran (columnas, tarjetas o etiquetas) y no lo he importado.' };
  }
  return { tablero: tablero, error: '' };
}
