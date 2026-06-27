import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { controls, dialog } from "../styles/shared";
import { CATEGORY_LABELS } from "../domain/events";
import type { EventCategory, GardenEvent } from "../domain/types";

@customElement("gl-export-dialog")
export class ExportDialog extends LitElement {
  static override styles = [controls, dialog, css`
    .meta { font-size: 0.82rem; color: var(--gl-text-muted); margin-bottom: 0.6rem; }
    .list { display: flex; flex-direction: column; gap: 0.1rem; }
    .row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.4rem 0.45rem;
      border-radius: var(--gl-radius-sm);
      cursor: pointer;
    }
    .row:hover { background: var(--gl-surface-2); }
    .row input { width: auto; margin: 0; }
    .row .count { margin-left: auto; font-size: 0.8rem; color: var(--gl-text-muted); }
    .toggle-all {
      align-self: flex-start;
      padding: 0.3rem 0;
      background: none;
      border: none;
      color: var(--gl-primary);
      cursor: pointer;
      font-size: 0.82rem;
    }
  `];

  @property({ attribute: false }) events: GardenEvent[] = [];

  /** Categories the user has chosen to include. Default: nothing selected. */
  @state() private included = new Set<EventCategory>();

  /** Category -> count, in CATEGORY_LABELS order, restricted to what's present. */
  private counts(): Array<[EventCategory, number]> {
    const tally = new Map<EventCategory, number>();
    for (const ev of this.events) tally.set(ev.category, (tally.get(ev.category) ?? 0) + 1);
    return (Object.keys(CATEGORY_LABELS) as EventCategory[])
      .filter((c) => tally.has(c))
      .map((c) => [c, tally.get(c)!]);
  }

  private toggle(cat: EventCategory) {
    const next = new Set(this.included);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    this.included = next;
  }

  private selectedCount(): number {
    return this.events.filter((e) => this.included.has(e.category)).length;
  }

  private close() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private download() {
    const categories = (Object.keys(CATEGORY_LABELS) as EventCategory[]).filter(
      (c) => this.included.has(c)
    );
    this.dispatchEvent(
      new CustomEvent<EventCategory[]>("export", {
        detail: categories,
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    const rows = this.counts();
    const allIncluded = rows.length > 0 && rows.every(([c]) => this.included.has(c));
    const selected = this.selectedCount();

    return html`
      <div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
        <div class="panel">
          <h2>Export to calendar</h2>
          <p class="meta">Choose which event types to include in the .ics file.</p>

          <button
            class="toggle-all"
            @click=${() => (this.included = allIncluded ? new Set() : new Set(rows.map(([c]) => c)))}
          >${allIncluded ? "Deselect all" : "Select all"}</button>

          <div class="list">
            ${rows.map(
              ([cat, n]) => html`
                <label class="row">
                  <input
                    type="checkbox"
                    .checked=${this.included.has(cat)}
                    @change=${() => this.toggle(cat)}
                  />
                  <span>${CATEGORY_LABELS[cat]}</span>
                  <span class="count">${n}</span>
                </label>
              `
            )}
          </div>

          <div class="actions">
            <button @click=${this.close}>Cancel</button>
            <button class="primary" ?disabled=${selected === 0} @click=${this.download}>
              ⬇️ Export ${selected} event${selected === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-export-dialog": ExportDialog;
  }
}
