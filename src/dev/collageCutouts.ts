import { cutout } from '../ui/usePersonCutout';

// Jednorazowo w dev (model MediaPipe tylko tu, nigdy na ekranie logowania): w konsoli `npm run dev`
//   await (await import('/src/dev/collageCutouts.ts')).collageCutouts()
// Zapisuje src/assets/collage/cutouts/NN.png (połowa rozdzielczości) i rects.json (prostokąty w płótnie 1080x1920).
// Zdjęcie bez osoby nie dostaje pliku; po zapisie warto obejrzeć PNG i usunąć nietrafione.
const PHOTOS = import.meta.glob('../assets/collage/*.jpg', { eager: true, query: '?url', import: 'default' });

export async function collageCutouts(): Promise<Record<string, number[]>> {
  const rects: Record<string, number[]> = {};
  for (const [path, url] of Object.entries(PHOTOS).sort(([a], [b]) => a.localeCompare(b))) {
    const name = path.match(/(\w+)\.jpg$/)![1];
    const cut = await cutout(url as string, null);
    if (!cut) continue;
    const img = new Image();
    img.src = cut.href;
    await img.decode();
    const side = Math.round((cut.rect[2] - cut.rect[0]) / 2);
    const c = document.createElement('canvas');
    c.width = c.height = side;
    c.getContext('2d')!.drawImage(img, 0, 0, side, side);
    const png = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    await fetch(`/__dev/collage-cutouts/${name}.png`, { method: 'POST', body: png });
    rects[name] = cut.rect;
  }
  await fetch('/__dev/collage-cutouts/rects.json', { method: 'POST', body: JSON.stringify(rects, null, 2) + '\n' });
  return rects;
}
