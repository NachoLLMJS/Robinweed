export function supportedOriginY({ surfaceY, localMinY = 0, inset = 0 }) {
  return surfaceY - localMinY - inset;
}
