import raw from "../data/presets.json";
import type { GrowType, Preset, PresetData, GrowingConditions } from "./types";

interface RawCrop {
  id: string;
  name: string;
  local_name?: string;
  grow_type: GrowType;
  days_to_harvest: { min: number; max: number };
  growing_conditions?: GrowingConditions;
  presets: PresetData;
}

interface RawNursery {
  id: string;
  name: string;
  local_name?: string;
  days_in_nursery: { min: number; max: number };
  growing_conditions?: GrowingConditions;
  presets: PresetData;
}

interface RawData {
  crops: RawCrop[];
  nurseries: RawNursery[];
}

const data = raw as RawData;

function fromCrop(c: RawCrop): Preset {
  return {
    slug: `${c.id}-${c.grow_type}`,
    id: c.id,
    name: c.name,
    localName: c.local_name,
    growType: c.grow_type,
    daysMin: c.days_to_harvest.min,
    daysMax: c.days_to_harvest.max,
    growingConditions: c.growing_conditions,
    presets: c.presets ?? {},
  };
}

function fromNursery(n: RawNursery): Preset {
  return {
    slug: `${n.id}-nursery`,
    id: n.id,
    name: `${n.name} (Nursery)`,
    localName: n.local_name,
    growType: "nursery",
    daysMin: n.days_in_nursery.min,
    daysMax: n.days_in_nursery.max,
    growingConditions: n.growing_conditions,
    presets: n.presets ?? {},
  };
}

export const PRESETS: Preset[] = [
  ...data.crops.map(fromCrop),
  ...data.nurseries.map(fromNursery),
].sort((a, b) => a.name.localeCompare(b.name));

const BY_SLUG = new Map(PRESETS.map((p) => [p.slug, p]));

export function getPreset(slug: string): Preset | undefined {
  return BY_SLUG.get(slug);
}
