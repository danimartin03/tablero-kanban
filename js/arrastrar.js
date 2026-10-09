// Arrastrar y soltar con Pointer Events.
// Los Pointer Events valen igual para ratón, dedo y lápiz, así que con un solo
// código funciona en el ordenador y en el móvil.
//
// Cómo funciona, en corto:
//   1. Al pulsar en el asa, dejo un "hueco" en el sitio del elemento y lo pongo
//      a flotar (position: fixed) para que siga al puntero.
//   2. Mientras se mueve, miro qué hay debajo del puntero y cambio el hueco de sitio.
//   3. Al soltar, cuento en qué posición ha quedado el hueco y aviso a app.js,
//      que es quien cambia los datos y repinta.
// Este archivo no sabe nada del tablero: solo mueve elementos por la pantalla.

// Lo que estoy arrastrando ahora mismo, o null si no arrastro nada
let arrastre = null;

const MARGEN_DE_BORDE = 60; // a cuántos píxeles del borde empieza a desplazarse solo
const PASO_DE_BORDE = 8;    // cuánto se desplaza en cada fotograma

// opciones: { tipo: 'tarjeta' o 'columna', sinReordenar: true/false, alSoltar: función }
function empezarArrastre(evento, elemento, opciones) {
  // Solo con el botón principal del ratón (un dedo también cuenta como botón 0)
  if (evento.button !== 0 || arrastre) return;
  // Evito que el navegador empiece a seleccionar texto
  evento.preventDefault();

  const caja = elemento.getBoundingClientRect();
  const esTarjeta = opciones.tipo === 'tarjeta';

  // El hueco ocupa lo mismo que el elemento, para que nada pegue un salto
  const hueco = document.createElement(esTarjeta ? 'li' : 'div');
  hueco.className = esTarjeta ? 'hueco' : 'hueco-columna';
  hueco.style.height = caja.height + 'px';
  elemento.before(hueco);

  // Lo dejo "flotando" justo donde estaba. A partir de aquí lo muevo con transform.
  elemento.style.left = caja.left + 'px';
  elemento.style.top = caja.top + 'px';
  elemento.style.width = caja.width + 'px';
  elemento.classList.add('arrastrando');
  document.body.classList.add('arrastre-en-marcha');

  arrastre = {
    elemento: elemento,
    hueco: hueco,
    opciones: opciones,
    asa: evento.target,
    puntero: evento.pointerId,
    inicioX: evento.clientX,
    inicioY: evento.clientY,
    x: evento.clientX,
    y: evento.clientY
  };

  // Con esto me siguen llegando los movimientos aunque el puntero se salga de la ventana
  arrastre.asa.setPointerCapture(evento.pointerId);
  document.addEventListener('pointermove', alMoverPuntero);
  document.addEventListener('pointerup', alSoltarPuntero);
  document.addEventListener('pointercancel', cancelarArrastre);
  document.addEventListener('keydown', alPulsarEscape);
  requestAnimationFrame(seguirAlPuntero);
}

// Aquí solo apunto dónde está el puntero. Lo de mover se hace en seguirAlPuntero.
function alMoverPuntero(evento) {
  if (!arrastre || evento.pointerId !== arrastre.puntero) return;
  arrastre.x = evento.clientX;
  arrastre.y = evento.clientY;
}

// Se ejecuta en cada fotograma mientras dura el arrastre
function seguirAlPuntero() {
  if (!arrastre) return;

  desplazarEnLosBordes();

  const moverX = arrastre.x - arrastre.inicioX;
  const moverY = arrastre.y - arrastre.inicioY;
  arrastre.elemento.style.transform = 'translate(' + moverX + 'px, ' + moverY + 'px)';

  const sitio = buscarSitio();
  // insertBefore con null lo pone al final, que es justo lo que quiero en ese caso
  if (sitio) sitio.contenedor.insertBefore(arrastre.hueco, sitio.antesDe);

  requestAnimationFrame(seguirAlPuntero);
}

// Si llevo el puntero cerca de un borde, desplazo el tablero o la página.
// OJO: solo lo hago si de verdad estoy tirando hacia ese lado. Si no, en el móvil
// (donde el asa ya está pegada al borde) se pondría a desplazarse nada más tocar.
function desplazarEnLosBordes() {
  const tablero = document.getElementById('tablero');
  const caja = tablero.getBoundingClientRect();
  const haciaLaIzquierda = arrastre.x < arrastre.inicioX - 10;
  const haciaLaDerecha = arrastre.x > arrastre.inicioX + 10;
  const haciaArriba = arrastre.y < arrastre.inicioY - 10;
  const haciaAbajo = arrastre.y > arrastre.inicioY + 10;

  if (haciaLaIzquierda && arrastre.x < caja.left + MARGEN_DE_BORDE) tablero.scrollLeft -= PASO_DE_BORDE;
  if (haciaLaDerecha && arrastre.x > caja.right - MARGEN_DE_BORDE) tablero.scrollLeft += PASO_DE_BORDE;
  if (haciaArriba && arrastre.y < MARGEN_DE_BORDE) window.scrollBy(0, -PASO_DE_BORDE);
  if (haciaAbajo && arrastre.y > window.innerHeight - MARGEN_DE_BORDE) window.scrollBy(0, PASO_DE_BORDE);
}

// Decido dónde caería lo que llevo: en qué contenedor y delante de qué elemento.
// Devuelvo null si el puntero no está encima de ningún sitio válido.
function buscarSitio() {
  const esTarjeta = arrastre.opciones.tipo === 'tarjeta';
  let contenedor = document.getElementById('columnas');

  if (esTarjeta) {
    // La tarjeta que llevo tiene pointer-events: none, así que esto me dice lo que hay DEBAJO
    const debajo = document.elementFromPoint(arrastre.x, arrastre.y);
    const columna = debajo ? debajo.closest('.columna') : null;
    if (!columna) return null;
    contenedor = columna.querySelector('.lista-tarjetas');

    // Con el filtro puesto no se reordena: en su columna vuelve a su sitio
    // y en las demás va al final
    if (arrastre.opciones.sinReordenar) {
      const esSuColumna = contenedor === arrastre.elemento.parentElement;
      return { contenedor: contenedor, antesDe: esSuColumna ? arrastre.elemento : null };
    }
  }

  // Recorro los hermanos y me quedo con el primero cuya mitad está más allá del puntero.
  // Las tarjetas se comparan de arriba abajo y las columnas de izquierda a derecha.
  for (const hermano of contenedor.children) {
    if (!esArrastrable(hermano)) continue;
    const caja = hermano.getBoundingClientRect();
    const mitad = esTarjeta ? caja.top + caja.height / 2 : caja.left + caja.width / 2;
    const puntero = esTarjeta ? arrastre.y : arrastre.x;
    if (puntero < mitad) return { contenedor: contenedor, antesDe: hermano };
  }
  return { contenedor: contenedor, antesDe: null };
}

// Un hermano "de verdad": ni el hueco, ni lo que llevo cogido, ni el texto de "Sin tarjetas"
function esArrastrable(hermano) {
  const selector = arrastre.opciones.tipo === 'tarjeta' ? '.tarjeta' : '.columna';
  return hermano !== arrastre.elemento && hermano.matches(selector);
}

function alSoltarPuntero(evento) {
  if (!arrastre || evento.pointerId !== arrastre.puntero) return;

  // La posición nueva es cuántos hermanos tiene el hueco por delante
  let posicion = 0;
  for (const hermano of arrastre.hueco.parentElement.children) {
    if (hermano === arrastre.hueco) break;
    if (esArrastrable(hermano)) posicion++;
  }
  const columnaDestino = arrastre.hueco.closest('.columna');
  const alSoltar = arrastre.opciones.alSoltar;

  // OJO: no devuelvo el elemento a su sitio. app.js va a repintar el tablero y,
  // como el elemento sigue donde lo he soltado, la animación sale desde ahí.
  dejarDeEscuchar();
  alSoltar(columnaDestino, posicion);
}

// Si se cancela (Escape, o el navegador corta el toque), lo dejo todo como estaba
function cancelarArrastre() {
  if (!arrastre) return;
  arrastre.hueco.remove();
  arrastre.elemento.classList.remove('arrastrando');
  arrastre.elemento.removeAttribute('style');
  dejarDeEscuchar();
}

function alPulsarEscape(evento) {
  if (evento.key === 'Escape') cancelarArrastre();
}

function dejarDeEscuchar() {
  document.removeEventListener('pointermove', alMoverPuntero);
  document.removeEventListener('pointerup', alSoltarPuntero);
  document.removeEventListener('pointercancel', cancelarArrastre);
  document.removeEventListener('keydown', alPulsarEscape);
  document.body.classList.remove('arrastre-en-marcha');
  arrastre = null;
}
