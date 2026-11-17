import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  /** Web only: the browser File object. */
  file?: Blob;
}

/** iOS/Android: files are copied into the app's private document directory. */
function vault() {
  const dir = new Directory(Paths.document, 'bay-one-files');
  if (!dir.exists) dir.create();
  return dir;
}

export async function saveFile(file: PickedFile): Promise<string> {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const dest = new File(vault(), `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${ext}`);
  new File(file.uri).copy(dest);
  return dest.uri;
}

export async function fileUrl(ref: string): Promise<string> {
  return ref;
}

export async function deleteFile(ref: string): Promise<void> {
  const f = new File(ref);
  if (f.exists) f.delete();
}

export async function openFile(ref: string): Promise<void> {
  await Sharing.shareAsync(ref);
}

export async function shareText(filename: string, text: string): Promise<void> {
  const f = new File(Paths.cache, filename);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri);
}

export async function readText(file: PickedFile): Promise<string> {
  return new File(file.uri).text();
}
