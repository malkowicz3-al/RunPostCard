import { useEffect, useState } from 'react';

const LIGHT = '(prefers-color-scheme: light)';

// Motyw systemu, aktualizowany przy zmianie (ciemny jest domyślny, jak w styles.css).
export function useColorScheme(): 'light' | 'dark' {
  const [light, setLight] = useState(() => matchMedia(LIGHT).matches);
  useEffect(() => {
    const query = matchMedia(LIGHT);
    const onChange = () => setLight(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return light ? 'light' : 'dark';
}
