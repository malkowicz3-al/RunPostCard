// Ten sam SVG co podgląd, z jawnym rozmiarem 1080x1920.
export function serialize(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', '1080');
  clone.setAttribute('height', '1920');
  return new XMLSerializer().serializeToString(clone);
}

export function download(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  // Od razu po click część przeglądarek jeszcze nie zdążyła pobrać pliku.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// PNG 1080x1920; bez tła w SVG wynik ma przezroczyste tło (canvas nie jest wypełniany).
export async function pngBlob(svg: SVGSVGElement): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([serialize(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = svgUrl;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG export failed');
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
