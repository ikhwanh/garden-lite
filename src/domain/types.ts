// ---- Domain types for garden-lite ----
// Most of these mirror the shape of the preset JSON ported from the garden app.

export type GrowType = "soil" | "hydroponic" | "nursery";

export interface Range {
  min: number | null;
  max: number | null;
}

export interface OptimalRange extends Range {
  optimal_min?: number | null;
  optimal_max?: number | null;
}

export interface GrowingConditions {
  temperature_c?: OptimalRange;
  humidity_pct?: Range;
  light_hours_per_day?: Range;
  altitude_masl?: Range;
  notes?: string;
}

export interface DapRange {
  min: number;
  max: number;
}

/** crop_protection / pruning_trimming */
export interface ActionPhase {
  phase: string;
  dap_range: DapRange;
  actions: string[];
}

export interface PestEntry {
  name: string;
  inspect_part?: string;
  action_threshold?: string;
  inspection_interval_days?: number;
}

export interface PestPhase {
  phase: string;
  dap_range: DapRange;
  pests: PestEntry[];
}

export interface SoilPhase {
  phase: string;
  dap_range: DapRange;
  targets: Record<string, Range>;
  notes?: string;
}

export interface BenchmarkPhase {
  dap: number;
  targets: Record<string, Range>;
  notes?: string;
}

export interface FertilizationPhase {
  phase: string;
  dap_range: DapRange;
  interval_days: number | null;
  fertilizers?: string[];
  notes?: string;
}

export interface PresetData {
  crop_protection?: ActionPhase[];
  pruning_trimming?: ActionPhase[];
  pest_disease_checklist?: PestPhase[];
  soil_parameters?: SoilPhase[];
  growth_benchmarks?: BenchmarkPhase[];
  fertilization_schedule?: FertilizationPhase[];
}

/** Normalized preset (crop or nursery) used throughout the app. */
export interface Preset {
  slug: string;
  id: string;
  name: string;
  localName?: string;
  growType: GrowType;
  daysMin: number;
  daysMax: number;
  growingConditions?: GrowingConditions;
  presets: PresetData;
}

// ---- Persisted records (Dexie) ----

export interface Profile {
  id: "profile"; // singleton
  name: string;
  altitudeMasl: number | null;
  avgTempC: number | null;
  avgHumidityPct: number | null;
  updatedAt: string;
}

export interface Settings {
  id: "settings"; // singleton
  githubToken?: string;
  gistId?: string; // last gist used for calendar publish
  theme?: string;
}

export interface Planting {
  id?: number;
  presetSlug: string;
  name: string; // snapshot of preset name (label)
  plantedOn: string; // ISO date yyyy-mm-dd
  note?: string;
  createdAt: string;
}

// ---- Generated calendar event ----

export type EventCategory =
  | "planted"
  | "harvest"
  | "crop_protection"
  | "pruning_trimming"
  | "pest_disease_checklist"
  | "soil_parameters"
  | "growth_benchmarks"
  | "fertilization_schedule";

export interface GardenEvent {
  date: string; // yyyy-mm-dd
  dap: number; // days after planting
  category: EventCategory;
  plantingId: number;
  plantingName: string;
  presetSlug: string;
  title: string;
  details: string[]; // human-readable lines
}
