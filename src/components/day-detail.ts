import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { CATEGORY_LABELS, parseISODate } from "../domain/events";
import type { GardenEvent } from "../domain/types";

@customElement("gl-day-detail")
export class DayDetail extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      margin-bottom: 1rem;
    }
    .date { font-size: 1.1rem; font-weight: 600; }
    .empty {
      color: var(--gl-text-muted);
      text-align: center;
      padding: 2.5rem 1rem;
    }
    .event {
      border: 1px solid var(--gl-border);
      border-left: 4px solid var(--cat);
      border-radius: var(--gl-radius-sm);
      padding: 0.7rem 0.85rem;
      margin-bottom: 0.7rem;
      background: var(--gl-surface);
    }
    .ev-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .ev-title { font-weight: 600; font-size: 0.95rem; }
    .tag {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--cat);
      white-space: nowrap;
    }
    .dap { font-size: 0.72rem; color: var(--gl-text-muted); }
    ul { margin: 0.5rem 0 0; padding-left: 1.1rem; }
    li { font-size: 0.86rem; margin-bottom: 0.2rem; color: var(--gl-text); }
  `];

  @property() selected = "";
  @property({ attribute: false }) events: GardenEvent[] = [];

  private fmtDate(iso: string): string {
    if (!iso) return "";
    return parseISODate(iso).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  private add() {
    this.dispatchEvent(new CustomEvent("add-plant", { bubbles: true, composed: true }));
  }

  private removePlanting(plantingId: number) {
    this.dispatchEvent(new CustomEvent("delete-planting", { detail: plantingId, bubbles: true, composed: true }));
  }

  override render() {
    if (!this.selected) {
      return html`<div class="empty">Select a day on the calendar to see what's happening.</div>`;
    }
    // order events so "planted" comes first, harvest last-ish, rest by dap
    const order = (e: GardenEvent) => (e.category === "planted" ? -1 : e.category === "harvest" ? 99 : 1);
    const sorted = [...this.events].sort((a, b) => order(a) - order(b));

    return html`
      <div class="head">
        <div class="date">${this.fmtDate(this.selected)}</div>
        <button class="primary" @click=${this.add}>Add +</button>
      </div>
      ${sorted.length === 0
        ? html`<div class="empty">Nothing scheduled. Click <strong>Add +</strong> to plant something.</div>`
        : sorted.map(
            (ev) => html`
              <div class="event" style="--cat: var(--gl-cat-${ev.category})">
                <div class="ev-head">
                  <span class="ev-title">${ev.title}</span>
                  <span class="tag">${CATEGORY_LABELS[ev.category]}</span>
                </div>
                <span class="dap">DAP ${ev.dap}</span>
                ${ev.details.length ? html`<ul>${ev.details.map((d) => html`<li>${d}</li>`)}</ul>` : null}
                ${ev.category === "planted"
                  ? html`<div style="margin-top:0.6rem"><button class="danger ghost" @click=${() => this.removePlanting(ev.plantingId)}>Remove planting</button></div>`
                  : null}
              </div>
            `
          )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-day-detail": DayDetail;
  }
}
