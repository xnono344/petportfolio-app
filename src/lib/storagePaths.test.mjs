import assert from 'node:assert/strict';
import test from 'node:test';
import { makeStorageUri, parseStorageUri } from './storagePaths.ts';

test('storage references round-trip without exposing a public URL', () => {
  const uri = makeStorageUri('pet-images', 'user-1/journal/photo.jpg');
  assert.equal(uri, 'sb://pet-images/user-1/journal/photo.jpg');
  assert.deepEqual(parseStorageUri(uri), {
    bucket: 'pet-images',
    path: 'user-1/journal/photo.jpg',
  });
});

test('ordinary local and https image URIs are not storage references', () => {
  assert.equal(parseStorageUri('file:///tmp/photo.jpg'), null);
  assert.equal(parseStorageUri('https://example.com/photo.jpg'), null);
});
