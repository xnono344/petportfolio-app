import { useEffect, useState } from 'react';
import { resolveStoredImageUri } from '../lib/images';

export function useStoredImageUri(uri: string | null | undefined): string | null {
  const [signed, setSigned] = useState<{ source: string; uri: string } | null>(null);
  const needsSigning = !!uri?.startsWith('sb://');

  useEffect(() => {
    let active = true;
    if (!needsSigning || !uri) return () => {};
    void resolveStoredImageUri(uri)
      .then((next) => {
        if (active && next) setSigned({ source: uri, uri: next });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [uri, needsSigning]);

  if (!needsSigning) return uri ?? null;
  return signed && signed.source === uri ? signed.uri : null;
}
