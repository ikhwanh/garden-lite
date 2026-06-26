import type {
  GardenEvent,
  Planting,
  Preset,
  EventCategory,
  ActionPhase,
  PestPhase,
  SoilPhase,
  BenchmarkPhase,
  FertilizationPhase,
  Range,
} from "./types";
import { getPreset } from "./presets";

// ---- date helpers (work in local time, date-only) ----

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function fmtRange(label: string, r: Range, unit = ""): string {
  const parts = [r.min, r.max].filter((x) => x != null);
  return `${label}: ${parts.join("–")}${unit}`;
}

// ---- per-category event builders ----

function actionEvents(
  planting: Planting,
  phases: ActionPhase[] | undefined,
  category: EventCategory,
  titlePrefix: string
): GardenEvent[] {
  if (!phases) return [];
  return phases.map((ph) => {
    const dap = ph.dap_range?.min ?? 0;
    return {
      date: addDays(planting.plantedOn, dap),
      dap,
      category,
      plantingId: planting.id!,
      plantingName: planting.name,
      presetSlug: planting.presetSlug,
      title: `${titlePrefix} — ${planting.name}`,
      details: ph.actions ?? [],
    };
  });
}

function pestEvents(planting: Planting, phases: PestPhase[] | undefined): GardenEvent[] {
  if (!phases) return [];
  const out: GardenEvent[] = [];
  for (const ph of phases) {
    const interval = Math.min(
      ...ph.pests.map((p) => p.inspection_interval_days ?? Infinity)
    );
    const details = ph.pests.map(
      (p) => `${p.name} — check ${p.inspect_part ?? "plant"} (act when ${p.action_threshold ?? "found"})`
    );
    const start = ph.dap_range?.min ?? 0;
    const end = ph.dap_range?.max ?? start;
    if (!Number.isFinite(interval)) {
      out.push(makePest(planting, start, details));
      continue;
    }
    for (let dap = start; dap <= end; dap += interval) {
      out.push(makePest(planting, dap, details));
    }
  }
  return out;
}

function makePest(planting: Planting, dap: number, details: string[]): GardenEvent {
  return {
    date: addDays(planting.plantedOn, dap),
    dap,
    category: "pest_disease_checklist",
    plantingId: planting.id!,
    plantingName: planting.name,
    presetSlug: planting.presetSlug,
    title: `Pest & disease scouting — ${planting.name}`,
    details,
  };
}

function fertilizationEvents(planting: Planting, phases: FertilizationPhase[] | undefined): GardenEvent[] {
  if (!phases) return [];
  const out: GardenEvent[] = [];
  for (const ph of phases) {
    const details = [
      ...(ph.fertilizers ?? []).map((f) => {
        const label = f.product ?? f.name ?? "Fertilizer";
        const rate = f.rate ? ` @ ${f.rate}` : "";
        const method = f.method ? ` (${f.method})` : "";
        return `${label}${rate}${method}`;
      }),
      ...(ph.notes ? [ph.notes] : []),
    ];
    const start = ph.dap_range?.min ?? 0;
    const end = ph.dap_range?.max ?? start;
    const interval = ph.interval_days;
    if (!interval) {
      out.push(makeFert(planting, start, ph.phase, details));
      continue;
    }
    for (let dap = start; dap <= end; dap += interval) {
      out.push(makeFert(planting, dap, ph.phase, details));
    }
  }
  return out;
}

function makeFert(planting: Planting, dap: number, phase: string, details: string[]): GardenEvent {
  return {
    date: addDays(planting.plantedOn, dap),
    dap,
    category: "fertilization_schedule",
    plantingId: planting.id!,
    plantingName: planting.name,
    presetSlug: planting.presetSlug,
    title: `Fertilize (${phase}) — ${planting.name}`,
    details,
  };
}

function benchmarkEvents(planting: Planting, phases: BenchmarkPhase[] | undefined): GardenEvent[] {
  if (!phases) return [];
  return phases.map((ph) => {
    const targets = Object.entries(ph.targets ?? {}).map(([k, r]) =>
      fmtRange(k.replace(/_/g, " "), r)
    );
    return {
      date: addDays(planting.plantedOn, ph.dap),
      dap: ph.dap,
      category: "growth_benchmarks",
      plantingId: planting.id!,
      plantingName: planting.name,
      presetSlug: planting.presetSlug,
      title: `Growth check (DAP ${ph.dap}) — ${planting.name}`,
      details: ph.notes ? [...targets, ph.notes] : targets,
    };
  });
}

function soilEvents(planting: Planting, phases: SoilPhase[] | undefined): GardenEvent[] {
  if (!phases) return [];
  return phases.map((ph) => {
    const dap = ph.dap_range?.min ?? 0;
    const targets = Object.entries(ph.targets ?? {}).map(([k, r]) => fmtRange(k, r));
    return {
      date: addDays(planting.plantedOn, dap),
      dap,
      category: "soil_parameters",
      plantingId: planting.id!,
      plantingName: planting.name,
      presetSlug: planting.presetSlug,
      title: `Soil targets — ${planting.name}`,
      details: ph.notes ? [...targets, ph.notes] : targets,
    };
  });
}

/** Generate all calendar events for a single planting. */
export function eventsForPlanting(planting: Planting, preset?: Preset): GardenEvent[] {
  const p = preset ?? getPreset(planting.presetSlug);
  if (!p) return [];
  const pd = p.presets;

  const planted: GardenEvent = {
    date: planting.plantedOn,
    dap: 0,
    category: "planted",
    plantingId: planting.id!,
    plantingName: planting.name,
    presetSlug: planting.presetSlug,
    title: `Planted ${planting.name}`,
    details: planting.quantity ? [`Quantity: ${planting.quantity}`] : [],
  };

  const harvest: GardenEvent = {
    date: addDays(planting.plantedOn, p.daysMin),
    dap: p.daysMin,
    category: "harvest",
    plantingId: planting.id!,
    plantingName: planting.name,
    presetSlug: planting.presetSlug,
    title: `Harvest window opens — ${planting.name}`,
    details: [`Expected harvest: DAP ${p.daysMin}–${p.daysMax}`],
  };

  return [
    planted,
    harvest,
    ...actionEvents(planting, pd.crop_protection, "crop_protection", "Crop protection"),
    ...actionEvents(planting, pd.pruning_trimming, "pruning_trimming", "Pruning & trimming"),
    ...soilEvents(planting, pd.soil_parameters),
    ...benchmarkEvents(planting, pd.growth_benchmarks),
    ...pestEvents(planting, pd.pest_disease_checklist),
    ...fertilizationEvents(planting, pd.fertilization_schedule),
  ];
}

/** Generate events for many plantings, indexed by ISO date. */
export function eventsByDate(plantings: Planting[]): Map<string, GardenEvent[]> {
  const map = new Map<string, GardenEvent[]>();
  for (const planting of plantings) {
    for (const ev of eventsForPlanting(planting)) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
  }
  return map;
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  planted: "Planted",
  harvest: "Harvest",
  crop_protection: "Crop protection",
  pruning_trimming: "Pruning & trimming",
  pest_disease_checklist: "Pest & disease",
  soil_parameters: "Soil parameters",
  growth_benchmarks: "Growth benchmark",
  fertilization_schedule: "Fertilization",
};
