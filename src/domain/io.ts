import { db, getProfile, listPlantings, listAllNotes } from "../db/db";
import type { CropNote, Planting, Profile } from "./types";

export const BACKUP_VERSION = 2;

export interface BackupData {
  app: "garden-lite";
  version: number;
  exportedAt: string;
  profile: Profile | null;
  plantings: Planting[];
  notes?: CropNote[];
}

/** Serialize all user data (profile + plantings + notes). Secrets are never included. */
export async function exportData(): Promise<BackupData> {
  const [profile, plantings, notes] = await Promise.all([
    getProfile(),
    listPlantings(),
    listAllNotes(),
  ]);
  return {
    app: "garden-lite",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    plantings,
    notes,
  };
}

export async function exportJSON(): Promise<string> {
  return JSON.stringify(await exportData(), null, 2);
}

function isBackup(x: unknown): x is BackupData {
  return !!x && typeof x === "object" && (x as BackupData).app === "garden-lite";
}

/** Replace local profile + plantings + notes with imported data. Returns counts. */
export async function importJSON(json: string): Promise<{ plantings: number; notes: number }> {
  const parsed = JSON.parse(json);
  if (!isBackup(parsed)) throw new Error("Not a garden-lite backup file.");

  await db.transaction("rw", db.profile, db.plantings, db.notes, async () => {
    if (parsed.profile) {
      await db.profile.put({ ...parsed.profile, id: "profile" });
    }
    await db.plantings.clear();
    if (Array.isArray(parsed.plantings)) {
      // drop ids so Dexie reassigns and avoids collisions
      const rows = parsed.plantings.map(({ id: _id, ...rest }) => rest as Planting);
      await db.plantings.bulkAdd(rows);
    }
    await db.notes.clear();
    if (Array.isArray(parsed.notes)) {
      const rows = parsed.notes.map(({ id: _id, ...rest }) => rest as CropNote);
      await db.notes.bulkAdd(rows);
    }
  });

  return { plantings: parsed.plantings?.length ?? 0, notes: parsed.notes?.length ?? 0 };
}

/** Trigger a browser download of a text file. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
