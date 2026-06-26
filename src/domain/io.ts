import { db, getProfile, listPlantings } from "../db/db";
import type { Planting, Profile } from "./types";

export const BACKUP_VERSION = 1;

export interface BackupData {
  app: "garden-lite";
  version: number;
  exportedAt: string;
  profile: Profile | null;
  plantings: Planting[];
}

/** Serialize all user data (profile + plantings). Secrets are never included. */
export async function exportData(): Promise<BackupData> {
  const [profile, plantings] = await Promise.all([getProfile(), listPlantings()]);
  return {
    app: "garden-lite",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    plantings,
  };
}

export async function exportJSON(): Promise<string> {
  return JSON.stringify(await exportData(), null, 2);
}

function isBackup(x: unknown): x is BackupData {
  return !!x && typeof x === "object" && (x as BackupData).app === "garden-lite";
}

/** Replace local profile + plantings with imported data. Returns counts. */
export async function importJSON(json: string): Promise<{ plantings: number }> {
  const parsed = JSON.parse(json);
  if (!isBackup(parsed)) throw new Error("Not a garden-lite backup file.");

  await db.transaction("rw", db.profile, db.plantings, async () => {
    if (parsed.profile) {
      await db.profile.put({ ...parsed.profile, id: "profile" });
    }
    await db.plantings.clear();
    if (Array.isArray(parsed.plantings)) {
      // drop ids so Dexie reassigns and avoids collisions
      const rows = parsed.plantings.map(({ id: _id, ...rest }) => rest as Planting);
      await db.plantings.bulkAdd(rows);
    }
  });

  return { plantings: parsed.plantings?.length ?? 0 };
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
