// El cielo (domo, skyline, luna, nubes, estrellas) solo existe en la calle.
// Hoy el campo de estrellas sigue a la camara con fog:false y entra con el jugador
// a todos los interiores: eso es la "banda de estrellas" que se ve por encima de la
// pared de salida del restaurante.
export function skyVisibleForLocation(location) {
  return location === 'street';
}
