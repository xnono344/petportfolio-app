const PREFIX = 'sb://';

export interface StorageLocation {
  bucket: string;
  path: string;
}

export function makeStorageUri(bucket: string, path: string): string {
  if (!bucket || !path || bucket.includes('/') || path.startsWith('/')) {
    throw new Error('Invalid storage location');
  }
  return `${PREFIX}${bucket}/${path}`;
}

export function parseStorageUri(uri: string | null | undefined): StorageLocation | null {
  if (!uri?.startsWith(PREFIX)) return null;
  const separator = uri.indexOf('/', PREFIX.length);
  if (separator < 0) return null;
  const bucket = uri.slice(PREFIX.length, separator);
  const path = uri.slice(separator + 1);
  return bucket && path ? { bucket, path } : null;
}
