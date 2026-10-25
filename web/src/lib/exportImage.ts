/** Rasterise an SVG element to a PNG and trigger a download. */
export async function exportPng(svg: SVGSVGElement, filename: string, pxPerFoot = 8) {
  const vb = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(Math.round(vb.width * pxPerFoot)));
  clone.setAttribute('height', String(Math.round(vb.height * pxPerFoot)));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('style');
  clone.querySelectorAll('text').forEach((t) => t.setAttribute('font-family', 'Helvetica, Arial, sans-serif'));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the rink image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Could not create image');
    download(blob, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const safeName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'drill';
