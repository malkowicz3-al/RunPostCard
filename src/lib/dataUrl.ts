// Zasoby osadzane w SVG pocztówki (font, kafelki mapy) muszą być data URL, bo <img> z SVG nie ładuje zewnętrznych plików.
const cache = new Map<string, Promise<string>>();

export function fetchDataUrl(url: string): Promise<string> {
  let result = cache.get(url);
  if (!result) {
    result = fetch(url).then(async (res) => {
      // Bez pliku serwer SPA zwraca index.html ze statusem 200, a to nie jest szukany zasób.
      if (!res.ok || res.headers.get('content-type')?.includes('text/html'))
        throw new Error(`Could not load ${url}`);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    });
    // Błąd nie zostaje w cache, żeby kolejna próba mogła się udać.
    result.catch(() => cache.delete(url));
    cache.set(url, result);
  }
  return result;
}
