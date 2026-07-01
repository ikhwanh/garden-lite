import Dexie, { type Table } from "dexie";
import type { CropNote, Planting, Profile, Settings } from "../domain/types";

export class GardenDB extends Dexie {
  profile!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  plantings!: Table<Planting, number>;
  notes!: Table<CropNote, number>;

  constructor() {
    super("garden-lite");
    this.version(1).stores({
      profile: "id",
      settings: "id",
      plantings: "++id, presetSlug, plantedOn",
    });
    this.version(2).stores({
      notes: "++id, presetSlug",
    });
  }
}

export const db = new GardenDB();

// ---- Profile ----

export async function getProfile(): Promise<Profile | null> {
  return (await db.profile.get("profile")) ?? null;
}

export async function saveProfile(p: Omit<Profile, "id" | "updatedAt">): Promise<void> {
  await db.profile.put({ ...p, id: "profile", updatedAt: new Date().toISOString() });
}

// ---- Settings ----

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get("settings")) ?? { id: "settings" };
}

export async function saveSettings(patch: Partial<Omit<Settings, "id">>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: "settings" };
  await db.settings.put(next);
  return next;
}

// ---- Plantings ----

export async function listPlantings(): Promise<Planting[]> {
  return db.plantings.orderBy("plantedOn").toArray();
}

export async function addPlanting(p: Omit<Planting, "id" | "createdAt">): Promise<number> {
  return db.plantings.add({ ...p, createdAt: new Date().toISOString() });
}

export async function deletePlanting(id: number): Promise<void> {
  await db.plantings.delete(id);
}

// ---- Crop notes ----

/** All notes for one crop, newest first. */
export async function listNotes(presetSlug: string): Promise<CropNote[]> {
  const rows = await db.notes.where("presetSlug").equals(presetSlug).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** All notes across every crop, newest first. */
export async function listAllNotes(): Promise<CropNote[]> {
  const rows = await db.notes.toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addNote(n: Omit<CropNote, "id" | "createdAt">): Promise<number> {
  return db.notes.add({ ...n, createdAt: new Date().toISOString() });
}

export async function updateNote(
  id: number,
  patch: Partial<Omit<CropNote, "id" | "createdAt">>
): Promise<void> {
  await db.notes.update(id, patch);
}

export async function deleteNote(id: number): Promise<void> {
  await db.notes.delete(id);
}
