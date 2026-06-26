import type { Preset, Profile, OptimalRange, Range } from "./types";

export type CompatLevel =
  | "compatible"
  | "marginal"
  | "incompatible"
  | "unknown"
  | "incomplete_profile";

export interface CompatResult {
  level: CompatLevel;
  reasons: string[];
}

function profileComplete(p: Profile | null | undefined): boolean {
  return !!p && p.altitudeMasl != null && p.avgTempC != null;
}

interface CheckArgs {
  label: string;
  value: number | null | undefined;
  range?: Range | OptimalRange;
  unit: string;
  failures: string[];
  warnings: string[];
}

function checkRange({ label, value, range, unit, failures, warnings }: CheckArgs): void {
  if (value == null || !range) return;
  const { min, max } = range;
  if (min == null && max == null) return;
  const v = value;

  if ((min != null && v < min) || (max != null && v > max)) {
    const rangeStr = [min, max].filter((x) => x != null).join("–");
    failures.push(`${label} ${Math.round(v)}${unit} is outside the required range (${rangeStr}${unit})`);
    return;
  }

  const opt = range as OptimalRange;
  if (opt.optimal_min != null && opt.optimal_max != null) {
    if (v < opt.optimal_min || v > opt.optimal_max) {
      warnings.push(
        `${label} ${Math.round(v)}${unit} is outside the optimal range (${opt.optimal_min}–${opt.optimal_max}${unit})`
      );
    }
  }
}

/** Mirrors PresetCompatibility from the garden Rails app. */
export function checkCompatibility(preset: Preset, profile: Profile | null): CompatResult {
  const cond = preset.growingConditions;
  if (!cond) return { level: "unknown", reasons: [] };
  if (!profileComplete(profile)) return { level: "incomplete_profile", reasons: [] };

  const failures: string[] = [];
  const warnings: string[] = [];
  const p = profile!;

  checkRange({ label: "Altitude", value: p.altitudeMasl, range: cond.altitude_masl, unit: " masl", failures, warnings });
  checkRange({ label: "Temperature", value: p.avgTempC, range: cond.temperature_c, unit: "°C", failures, warnings });
  checkRange({ label: "Humidity", value: p.avgHumidityPct, range: cond.humidity_pct, unit: "%", failures, warnings });

  if (failures.length) return { level: "incompatible", reasons: [...failures, ...warnings] };
  if (warnings.length) return { level: "marginal", reasons: warnings };
  return { level: "compatible", reasons: [] };
}
