import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fitRoute } from '../lib/routePath';
import { ROUTE_BOX } from '../postcard/Route';
import { demoRuns } from './demoRuns';
import { CollageColumns, LoginScreen, collageSvgs } from './LoginScreen';

const runs = demoRuns();

// Odcinki polilinii z „M x yL x y…”.
function segments(d: string): [number, number, number, number][] {
  return d.split('M').filter(Boolean).flatMap((part) => {
    const pts = part.replace('Z', '').split('L').map((p) => p.trim().split(' ').map(Number));
    return pts.slice(1).map((p, i) => [pts[i][0], pts[i][1], p[0], p[1]] as [number, number, number, number]);
  });
}

function toSegment([x, y]: [number, number], [ax, ay, bx, by]: [number, number, number, number]) {
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
}

describe('demoRuns', () => {
  it('deterministyczne, 18 biegów 5–26 km, bez NaN', () => {
    expect(JSON.stringify(demoRuns())).toBe(JSON.stringify(runs));
    expect(runs).toHaveLength(18);
    for (const { activity, streams, map } of runs) {
      expect(activity.distance, activity.name).toBeGreaterThan(4500);
      expect(activity.distance, activity.name).toBeLessThan(26000);
      expect(streams.latlng).toHaveLength(streams.distance.length);
      expect(JSON.stringify([activity, streams, map])).not.toMatch(/NaN|null|Infinity/);
      for (const d of Object.values(map).filter(Boolean)) expect(d).toMatch(/^M[MLZ\d\s.-]+$/);
    }
  });

  it('trasa mieści się w ROUTE_BOX, a biegi miejskie leżą na narysowanych ulicach', () => {
    const [[x0, y0], [x1, y1]] = ROUTE_BOX;
    for (const { activity, streams, map } of runs) {
      const fit = fitRoute(activity.map.summary_polyline, ROUTE_BOX)!;
      const pts = streams.latlng.map(([lat, lng]) => fit.projection([lng, lat])!);
      for (const [x, y] of pts) {
        expect(x).toBeGreaterThanOrEqual(x0 - 0.5);
        expect(x).toBeLessThanOrEqual(x1 + 0.5);
        expect(y).toBeGreaterThanOrEqual(y0 - 0.5);
        expect(y).toBeLessThanOrEqual(y1 + 0.5);
      }
      if (activity.sport_type !== 'Run') continue;
      const roads = segments([map.minor, map.mid, map.major].filter(Boolean).join(''));
      // Tolerancja ~8 m (szum GPS, ścięte zakręty) w px tej skali, najmniej 8 px.
      const pxPerM = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) / activity.distance;
      const tol = Math.max(8, 8 * pxPerM);
      const near = pts.filter((p) => roads.some((s) => toSegment(p as [number, number], s) < tol)).length;
      expect(near / pts.length, activity.name).toBeGreaterThan(0.95);
    }
  }, 30000); // łuki ulic to dużo odcinków, a sprawdzenie jest punkt × odcinek
});

describe('LoginScreen', () => {
  it('przycisk Stravy nad kolażem ukrytym przed czytnikami', () => {
    const html = renderToStaticMarkup(<LoginScreen />);
    expect(html).toContain('alt="Connect with Strava"');
    expect(html).toContain('class="login-collage" aria-hidden="true"');
  });

  it('kolumny po kolei; 3 kolumny po 6 kart dwa razy; w SVG kart brak adresów zewnętrznych', async () => {
    const calls: number[] = [];
    let svgs: string[] = [];
    await collageSvgs((s) => {
      calls.push(s.length);
      svgs = s;
    });
    expect(calls).toEqual([6, 12, 18]);
    expect(new Set(svgs).size).toBe(18);
    // Zewnętrzne adresy ani w dokumencie, ani w środku pocztówek (poza przestrzenią nazw SVG).
    for (const svg of svgs) expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    // Drugi raz z pamięci, bez liczenia.
    const again: number[] = [];
    await collageSvgs((s) => again.push(s.length));
    expect(again).toEqual([18]);

    const urls = svgs.map((_, i) => `blob:card-${i}`);
    const html = renderToStaticMarkup(<CollageColumns urls={urls} />);
    const columns = html.split('class="login-column"').slice(1);
    expect(columns).toHaveLength(3);
    columns.forEach((col, c) => {
      const srcs = [...col.matchAll(/<img class="login-card" src="([^"]+)" alt=""/g)].map(([, src]) => src);
      const own = urls.slice(c * 6, c * 6 + 6);
      expect(srcs).toEqual([...own, ...own]);
    });
  });
});
