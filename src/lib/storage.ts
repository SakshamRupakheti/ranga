import { createStore, get, set, del, values, clear } from "idb-keyval";
import {
  documentSchema,
  brandSchema,
  defaultBrand,
  type DesignDocument,
  type BrandKit,
} from "./document";
const projectStore = () => createStore("ranga-local-v1", "projects");
const prefStore = () => createStore("ranga-preferences-v1", "preferences");
export type SavedProject = {
  document: DesignDocument;
  thumbnail: string;
  versions: {
    id: string;
    name: string;
    createdAt: string;
    document: DesignDocument;
  }[];
};
export async function listProjects(): Promise<SavedProject[]> {
  return (await values<SavedProject>(projectStore())).sort((a, b) =>
    b.document.updatedAt.localeCompare(a.document.updatedAt),
  );
}
export async function loadProject(
  id: string,
): Promise<SavedProject | undefined> {
  const item = await get<SavedProject>(id, projectStore());
  if (item) documentSchema.parse(item.document);
  return item;
}
export async function saveProject(project: SavedProject) {
  documentSchema.parse(project.document);
  await set(project.document.id, project, projectStore());
}
export async function deleteProject(id: string) {
  await del(id, projectStore());
}
export async function loadBrand(): Promise<BrandKit> {
  const stored = await get("brand", prefStore());
  return stored ? brandSchema.parse(stored) : defaultBrand;
}
export async function saveBrand(brand: BrandKit) {
  await set("brand", brandSchema.parse(brand), prefStore());
}
export async function clearLocalData() {
  await clear(projectStore());
  await clear(prefStore());
}
