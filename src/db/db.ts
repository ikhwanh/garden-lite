import Dexie, { type Table } from "dexie";
import type { Planting, Profile, Settings } from "../domain/types";

export class GardenDB extends Dexie {
  profile!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  plantings!: Table<Planting, number>;

  constructor() {
    super("garden-lite");
    this.version(1).stores({
      profile: "id",
      settings: "id",
      plantings: "++id, presetSlug, plantedOn",
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
