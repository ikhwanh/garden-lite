import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { toISODate } from "../domain/events";
import type { GardenEvent } from "../domain/types";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

@customElement("gl-calendar")
export class CalendarView extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.8rem;
    }
    .title { font-size: 1.1rem; font-weight: 600; }
    .nav { display: flex; gap: 0.4rem; }
    .nav button { padding: 0.4rem 0.7rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .dow {
      text-align: center;
      font-size: 0.72rem;
      color: var(--gl-text-muted);
      padding-bottom: 0.2rem;
    }
    .cell {
      position: relative;
      aspect-ratio: 1 / 1;
      border: 1px solid var(--gl-border);
      border-radius: var(--gl-radius-sm);
      background: var(--gl-surface);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 0.35rem;
      cursor: pointer;
      transition: border-color 0.12s ease, background 0.12s ease;
      font-size: 0.9rem;
    }
    .cell:hover { border-color: var(--gl-primary); }
    .cell.outside { opacity: 0.35; }
    .cell.today { background: var(--gl-today); }
    .cell.selected {
      border-color: var(--gl-primary);
      box-shadow: inset 0 0 0 1px var(--gl-primary);
    }
    .dots {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      justify-content: center;
      margin-top: auto;
      margin-bottom: 0.3rem;
      max-width: 90%;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .count {
      font-size: 0.62rem;
      color: var(--gl-text-muted);
    }
    @media (max-width: 600px) {
      .cell { font-size: 0.8rem; padding-top: 0.2rem; }
    }
  `];

  @property({ attribute: false }) events: Map<string, GardenEvent[]> = new Map();
  @property() selected = "";

  @state() private year = new Date().getFullYear();
  @state() private month = new Date().getMonth();

  private go(delta: number) {
    let m = this.month + delta;
    let y = this.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    this.month = m;
    this.year = y;
  }

  private today() {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
    this.select(toISODate(now));
  }

  private select(iso: string) {
    this.dispatchEvent(new CustomEvent("select-date", { detail: iso, bubbles: true, composed: true }));
  }

  private cells(): { iso: string; day: number; outside: boolean }[] {
    const first = new Date(this.year, this.month, 1);
    // Monday-based offset
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(this.year, this.month, 1 - offset);
    const out: { iso: string; day: number; outside: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ iso: toISODate(d), day: d.getDate(), outside: d.getMonth() !== this.month });
    }
    return out;
  }

  override render() {
    const todayIso = toISODate(new Date());
    return html`
      <div class="head">
        <div class="title">${MONTHS[this.month]} ${this.year}</div>
        <div class="nav">
          <button @click=${() => this.go(-1)} aria-label="Previous month">‹</button>
          <button @click=${this.today}>Today</button>
          <button @click=${() => this.go(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div class="grid">
        ${DOW.map((d) => html`<div class="dow">${d}</div>`)}
        ${this.cells().map((c) => {
          const evs = this.events.get(c.iso) ?? [];
          const cats = [...new Set(evs.map((e) => e.category))].slice(0, 6);
          return html`
            <div
              class="cell ${c.outside ? "outside" : ""} ${c.iso === todayIso ? "today" : ""} ${c.iso === this.selected ? "selected" : ""}"
              @click=${() => this.select(c.iso)}
            >
              <span>${c.day}</span>
              ${evs.length
                ? html`<div class="dots">
                    ${cats.map((cat) => html`<span class="dot" style="background: var(--gl-cat-${cat})"></span>`)}
                  </div>
                  ${evs.length > 6 ? html`<span class="count">+${evs.length}</span>` : null}`
                : null}
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-calendar": CalendarView;
  }
}
