import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { controls, dialog } from "../styles/shared";
import { PRESETS, getPreset } from "../domain/presets";
import { checkCompatibility, type CompatLevel } from "../domain/compatibility";
import { parseISODate } from "../domain/events";
import type { Profile } from "../domain/types";

const LEVEL_LABEL: Record<CompatLevel, string> = {
  compatible: "✓ Well suited to your site",
  marginal: "△ Marginal — grows but watch conditions",
  incompatible: "✗ Not suited to your site",
  unknown: "No growing-condition data",
  incomplete_profile: "Complete your profile for a fit check",
};

@customElement("gl-add-plant-dialog")
export class AddPlantDialog extends LitElement {
  static override styles = [controls, dialog, css`
    .badge {
      display: inline-block;
      padding: 0.35rem 0.6rem;
      border-radius: var(--gl-radius-sm);
      font-size: 0.82rem;
      margin-top: 0.3rem;
    }
    .badge.compatible { background: color-mix(in srgb, var(--gl-primary) 18%, transparent); color: var(--gl-primary); }
    .badge.marginal { background: color-mix(in srgb, var(--gl-accent) 22%, transparent); color: var(--gl-accent); }
    .badge.incompatible { background: color-mix(in srgb, var(--gl-danger) 16%, transparent); color: var(--gl-danger); }
    .badge.unknown, .badge.incomplete_profile { background: var(--gl-surface-2); color: var(--gl-text-muted); }
    .reasons { margin: 0.5rem 0 0; padding-left: 1.1rem; font-size: 0.82rem; color: var(--gl-text-muted); }
    .meta { font-size: 0.82rem; color: var(--gl-text-muted); margin-top: 0.4rem; }
  `];

  @property() date = "";
  @property({ attribute: false }) profile: Profile | null = null;

  @state() private slug = "";
  @state() private note = "";

  private close() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private save() {
    const preset = getPreset(this.slug);
    if (!preset) return;
    this.dispatchEvent(new CustomEvent("plant", {
      detail: {
        presetSlug: preset.slug,
        name: preset.name,
        plantedOn: this.date,
        note: this.note.trim() || undefined,
      },
      bubbles: true,
      composed: true,
    }));
  }

  private fmtDate(iso: string): string {
    return iso ? parseISODate(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
  }

  override render() {
    const preset = getPreset(this.slug);
    const compat = preset ? checkCompatibility(preset, this.profile) : null;

    return html`
      <div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
        <div class="panel">
          <h2>Plant something on ${this.fmtDate(this.date)}</h2>

          <div class="field">
            <label>Plant</label>
            <select @change=${(e: Event) => (this.slug = (e.target as HTMLSelectElement).value)}>
              <option value="">— choose a plant —</option>
              ${PRESETS.map((p) => html`<option value=${p.slug} ?selected=${p.slug === this.slug}>${p.name}${p.localName ? ` · ${p.localName}` : ""}</option>`)}
            </select>
          </div>

          ${preset
            ? html`
                <div class="field">
                  <span class="badge ${compat!.level}">${LEVEL_LABEL[compat!.level]}</span>
                  ${compat!.reasons.length
                    ? html`<ul class="reasons">${compat!.reasons.map((r) => html`<li>${r}</li>`)}</ul>`
                    : null}
                  <div class="meta">
                    Days to harvest: ${preset.daysMin}–${preset.daysMax} · Grow type: ${preset.growType}
                    ${preset.growingConditions?.notes ? html`<br />${preset.growingConditions.notes}` : null}
                  </div>
                </div>
              `
            : null}

          <div class="field">
            <label>Note (optional)</label>
            <textarea rows="2" .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLTextAreaElement).value)} placeholder="bed 3, north row…"></textarea>
          </div>

          <div class="actions">
            <button @click=${this.close}>Cancel</button>
            <button class="primary" ?disabled=${!preset} @click=${this.save}>Plant & generate schedule</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-add-plant-dialog": AddPlantDialog;
  }
}
