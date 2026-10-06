import BlobUtil from "react-native-blob-util";
const directory = `${BlobUtil.fs.dirs.DocumentDir}/shell-draft-images`;
export function isDraftImage(path: unknown): path is string {
  return typeof path === "string" && path.startsWith(`${directory}/`) && /^[a-z0-9-]+\.jpg$/.test(path.slice(directory.length + 1));
}
export async function retainDraftImage(path: string): Promise<string> {
  if (!await BlobUtil.fs.exists(directory)) await BlobUtil.fs.mkdir(directory);
  const target = `${directory}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`;
  await BlobUtil.fs.cp(path.replace(/^file:\/\//, ""), target);
  return target;
}
export async function removeDraftImage(path?: string) { if (isDraftImage(path)) await BlobUtil.fs.unlink(path).catch(() => {}); }
export async function existingDraftImages<T extends { path?: string }>(photos: T[]): Promise<T[]> {
  const valid = await Promise.all(photos.map(async photo => isDraftImage(photo.path) && await BlobUtil.fs.exists(photo.path).catch(() => false)));
  return photos.filter((_photo, index) => valid[index]);
}
