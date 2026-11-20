// Bez ładowania Three.js: czy przeglądarka da kontekst WebGL (sprawdzane raz).
let webgl: boolean | undefined;
export function hasWebGL(): boolean {
  if (webgl === undefined) {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl;
}
