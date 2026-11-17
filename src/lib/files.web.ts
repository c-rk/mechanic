import { createStore, del, get, set } from 'idb-keyval';

import type { PickedFile } from './files';

/** Web: file bytes live in a dedicated IndexedDB object store, keyed by reference. */
const blobs = createStore('bay-one-files', 'blobs');
const urls = new Map<string, string>();

export async function saveFile(file: PickedFile): Promise<string> {
  const ref = `idb:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const blob = file.file ?? (await (await fetch(file.uri)).blob());
  await set(ref, blob, blobs);
  return ref;
}

export async function fileUrl(ref: string): Promise<string> {
  const cached = urls.get(ref);
  if (cached) return cached;
  const blob = await get<Blob>(ref, blobs);
  if (!blob) throw new Error('File is missing from device storage');
  const url = URL.createObjectURL(blob);
  urls.set(ref, url);
  return url;
}

export async function deleteFile(ref: string): Promise<void> {
  const url = urls.get(ref);
  if (url) URL.revokeObjectURL(url);
  urls.delete(ref);
  await del(ref, blobs);
}

export async function openFile(ref: string): Promise<void> {
  window.open(await fileUrl(ref), '_blank', 'noopener');
}

export async function shareText(filename: string, text: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readText(file: PickedFile): Promise<string> {
  return file.file ? file.file.text() : (await fetch(file.uri)).text();
}
