import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { CATEGORY_LABELS, parseISODate, toISODate } from "../domain/events";
import type { GardenEvent } from "../domain/types";

interface DayGroup {
  date: string;
  events: GardenEvent[];
}

/**
 * Chronological timeline of all (filtered) events grouped by date, with a
 * vertical rail. Past days are dimmed; today is highlighted.
 */
@customElement("gl-timeline-view")
export class TimelineView extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    .empty { color: var(--gl-text-muted); text-align: center; padding: 3rem 1rem; }

    .timeline { position: relative; }
    .day {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 0.9rem;
      padding-bottom: 1.3rem;
    }
    .rail {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    /* the vertical line */
    .rail::before {
      content: "";
      position: absolute;
      left: 5px;
      top: 0.5rem;
      bottom: -1.3rem;
      width: 2px;
      background: var(--gl-border);
    }
    .day:last-child .rail::before { display: none; }
    .node {
      position: relative;
      z-index: 1;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--gl-surface);
      border: 2px solid var(--gl-text-muted);
      margin-top: 0.35rem;
    }
    .day.today .node { border-color: var(--gl-primary); background: var(--gl-primary); }
    .date {
      margin-left: 0.5rem;
      font-size: 0.85rem;
      line-height: 1.25;
    }
    .date .wd { color: var(--gl-text-muted); }
    .date .today-tag {
      display: inline-block;
      margin-top: 0.2rem;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--gl-primary);
    }
    .day.past { opacity: 0.55; }

    .events { display: flex; flex-direction: column; gap: 0.6rem; }
    .event {
      border: 1px solid var(--gl-border);
      border-left: 4px solid var(--cat);
      border-radius: var(--gl-radius-sm);
      padding: 0.6rem 0.8rem;
      background: var(--gl-surface);
    }
    .ev-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .ev-title { font-weight: 600; font-size: 0.92rem; }
    .tag {
      font-size: 0.66rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--cat);
      white-space: nowrap;
    }
    .dap { font-size: 0.7rem; color: var(--gl-text-muted); }
    ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    li { font-size: 0.83rem; margin-bottom: 0.15rem; }

    @media (max-width: 600px) {
      .day { grid-template-columns: 92px 1fr; gap: 0.5rem; }
      .date { font-size: 0.78rem; }
    }
  `];

  @property({ attribute: false }) events: GardenEvent[] = [];

  private groups(): DayGroup[] {
    const byDate = new Map<string, GardenEvent[]>();
    for (const ev of this.events) {
      const arr = byDate.get(ev.date) ?? [];
      arr.push(ev);
      byDate.set(ev.date, arr);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date,
        events: events.sort((x, y) => x.dap - y.dap),
      }));
  }

  private fmt(iso: string) {
    const d = parseISODate(iso);
    return {
      wd: d.toLocaleDateString(undefined, { weekday: "short" }),
      md: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    };
  }

  override render() {
    const groups = this.groups();
    if (!groups.length) {
      return html`<div class="empty">No events yet. Add a planting to build its timeline.</div>`;
    }
    const today = toISODate(new Date());

    return html`
      <div class="timeline">
        ${groups.map((g) => {
          const isToday = g.date === today;
          const past = g.date < today;
          const f = this.fmt(g.date);
          return html`
            <div class="day ${isToday ? "today" : ""} ${past ? "past" : ""}">
              <div class="rail">
                <span class="node"></span>
                <div class="date">
                  <div class="wd">${f.wd}</div>
                  <div>${f.md}</div>
                  ${isToday ? html`<span class="today-tag">Today</span>` : null}
                </div>
              </div>
              <div class="events">
                ${g.events.map(
                  (ev) => html`
                    <div class="event" style="--cat: var(--gl-cat-${ev.category})">
                      <div class="ev-head">
                        <span class="ev-title">${ev.title}</span>
                        <span class="tag">${CATEGORY_LABELS[ev.category]}</span>
                      </div>
                      <span class="dap">DAP ${ev.dap}</span>
                      ${ev.details.length ? html`<ul>${ev.details.map((d) => html`<li>${d}</li>`)}</ul>` : null}
                    </div>
                  `
                )}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-timeline-view": TimelineView;
  }
}
