import type { GardenEvent } from "./types";
import { CATEGORY_LABELS } from "./events";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Fold lines at 75 octets per RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function uid(ev: GardenEvent): string {
  return `${ev.plantingId}-${ev.category}-${ev.dap}-${ev.date}@garden-lite`;
}

export function eventsToICS(events: GardenEvent[], calName = "Garden Lite"): string {
  const now = dateStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//garden-lite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
  ];

  for (const ev of events) {
    const dateCompact = ev.date.replace(/-/g, "");
    const summary = `[${CATEGORY_LABELS[ev.category]}] ${ev.title}`;
    const desc = ev.details.join("\n");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid(ev)}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
    lines.push(`SUMMARY:${esc(summary)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push(`CATEGORIES:${esc(CATEGORY_LABELS[ev.category])}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
