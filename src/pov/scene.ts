import * as THREE from 'three';
import type { GeoProjection } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import type { Dem } from '../lib/dem';
import type { Building } from '../lib/vectorMap';
import { FOV, buildingsData, cameraAt, cameraPath, ribbon, toLocal, track, type CameraPath, type Mesh } from './data';

// Scena POV (ADR 0010, 0011): ładowana tylko przez import() eksportu POV, więc Three.js trafia do osobnego chunku.
export type PovInput = {
  streams: RunStreams;
  projection: GeoProjection;
  dem: Dem | null;
  buildings: Building[];
  floor: HTMLCanvasElement | null; // mapa motywu na całe płótno 1080x1920; null = jednolita podłoga
  background: string;
  building: string;
  color: (t: number) => string; // kolor trasy w ułamku dystansu
  route: boolean; // false = bez wstęgi i kropki biegacza (przełącznik Route)
};

export type Pov = {
  path: CameraPath; // ścieżka kamery (rzutowanie napisów nad trasą)
  paint: (target: HTMLCanvasElement, p: number) => void; // klatka eksportu w rozmiarze target
  dispose: () => void;
};

const SIZE: [number, number] = [1080, 1920];

// Renderer poza ekranem; preserveDrawingBuffer, żeby drawImage po render() widział klatkę.
export function createRenderer(): THREE.WebGLRenderer {
  // Kolory jak w SVG (sRGB bez konwersji): tekstura mapy i wierzchołki mają wyglądać jak pocztówka.
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  return renderer;
}

function meshGeometry({ positions, colors, index }: Mesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

export function createPov(renderer: THREE.WebGLRenderer, input: PovInput): Pov {
  const { frame, track: t, ground } = track(input.streams, input.projection, input.dem);
  const path = cameraPath(t, ground);
  const bg = new THREE.Color(input.background);
  const scene = new THREE.Scene();
  scene.background = bg;

  // Podłoga = całe płótno pocztówki w metrach; z DEM siatka podniesiona do terenu.
  const [x0, z0] = toLocal(frame, [0, 0]);
  const [x1, z1] = toLocal(frame, SIZE);
  const width = x1 - x0;
  const depth = z1 - z0;
  const far = Math.max(width, depth);
  scene.fog = new THREE.Fog(bg, Math.min(600, far * 0.1), Math.max(1500, far * 0.45));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-1, 2, -0.5);
  scene.add(sun);

  const floorGeo = input.dem ? new THREE.PlaneGeometry(width, depth, 256, 455) : new THREE.PlaneGeometry(width, depth);
  floorGeo.rotateX(-Math.PI / 2); // górny brzeg tekstury (północ) na -z
  floorGeo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  if (input.dem) {
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)));
    floorGeo.computeVertexNormals();
  }
  const texture = input.floor ? new THREE.CanvasTexture(input.floor) : null;
  if (texture) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Bez terenu mapa bez cieniowania (kolory motywu 1:1), z terenem oświetlona, żeby było widać relief.
  const floorMat = input.dem
    ? new THREE.MeshLambertMaterial({ map: texture, color: texture ? 0xffffff : input.background })
    : new THREE.MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : input.background });
  scene.add(new THREE.Mesh(floorGeo, floorMat));

  const walls = buildingsData(input.buildings, frame, ground);
  if (walls.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(walls, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: input.building, side: THREE.DoubleSide })));
  }

  if (input.route) {
    scene.add(
      new THREE.Mesh(
        meshGeometry(ribbon(t, 5, input.color)),
        new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }),
      ),
    );
    // Bez terenu trasa wisi na wysokości zegarka: półprzezroczysta kurtyna do podłogi, jak w widoku 3D.
    if (!input.dem) {
      scene.add(
        new THREE.Mesh(
          meshGeometry(ribbon(t, 0, input.color, () => 0)),
          new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.22, depthWrite: false }),
        ),
      );
    }
  }

  const runner = new THREE.Group();
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  runner.add(new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), dotMat));
  runner.add(new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), glowMat));
  runner.visible = input.route; // jak w SVG: bez trasy także bez kropki biegacza
  scene.add(runner);

  const view = new THREE.PerspectiveCamera(FOV, SIZE[0] / SIZE[1], 1, far * 2);
  const pose = (camera: THREE.PerspectiveCamera, p: number) => {
    const { eye, look, runner: at } = cameraAt(path, p);
    camera.position.set(...eye);
    camera.lookAt(...look);
    runner.position.set(...at);
    glowMat.color.set(input.color(p));
  };

  return {
    path,
    paint(target, p) {
      const c = renderer.domElement;
      if (c.width !== target.width || c.height !== target.height) renderer.setSize(target.width, target.height, false);
      pose(view, p);
      renderer.render(scene, view);
      target.getContext('2d')!.drawImage(c, 0, 0, target.width, target.height);
    },
    dispose() {
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      });
      texture?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
