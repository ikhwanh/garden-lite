import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { PRESETS, getPreset } from "../domain/presets";
import { listAllNotes, addNote, updateNote, deleteNote } from "../db/db";
import type { CropNote } from "../domain/types";

/** Keep-style label hues; mixed with the surface so they adapt to light/dark. */
const COLORS: { name: string; hue: string }[] = [
  { name: "Default", hue: "" },
  { name: "Red", hue: "#f28b82" },
  { name: "Orange", hue: "#fbbc04" },
  { name: "Green", hue: "#34a853" },
  { name: "Teal", hue: "#26a69a" },
  { name: "Blue", hue: "#4285f4" },
  { name: "Purple", hue: "#a142f4" },
];

function cardBg(hue?: string): string {
  return hue ? `color-mix(in srgb, ${hue} 22%, var(--gl-surface))` : "var(--gl-surface)";
}

/**
 * Crop notes board (Google Keep style): an expanding composer, a masonry grid
 * of note cards with inline editing, color labels, and delete-on-hover. Notes
 * are keyed by preset slug and resurface in the add-plant dialog.
 *
 * Emits `changed` after any add/edit/delete so the shell can refresh.
 */
@customElement("gl-crops-page")
export class CropsPage extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 1rem; }
    h2 { margin: 0 0 0.3rem; }
    .intro { margin: 0 0 1.4rem; font-size: 0.85rem; color: var(--gl-text-muted); }

    .card {
      border: 1px solid var(--gl-border);
      border-radius: var(--gl-radius);
      box-shadow: 0 1px 2px var(--gl-shadow);
    }

    /* --- composer --- */
    .composer {
      max-width: 600px;
      margin: 0 auto 1.8rem;
      padding: 0.6rem 0.9rem;
      background: var(--gl-surface);
    }
    .composer.collapsed {
      cursor: text;
      color: var(--gl-text-muted);
      padding: 0.85rem 0.9rem;
    }
    .composer .field { margin: 0.6rem 0; }
    .composer textarea { min-height: 3.4rem; resize: vertical; border: none; padding: 0.4rem 0; background: transparent; }
    .composer textarea:focus { outline: none; }
    .composer select { max-width: 260px; }
    .composer-foot {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: 0.4rem;
    }
    .composer-foot .spacer { flex: 1; }

    /* --- masonry grid --- */
    .board { column-width: 240px; column-gap: 1rem; }
    .note {
      break-inside: avoid;
      margin: 0 0 1rem;
      padding: 0.75rem 0.85rem;
      display: block;
    }
    .note:hover { box-shadow: 0 2px 8px var(--gl-shadow); }
    .note .chip {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--gl-primary);
      margin-bottom: 0.4rem;
    }
    .note .body {
      white-space: pre-wrap;
      word-break: break-word;
      cursor: text;
      min-height: 1.2rem;
      font-size: 0.9rem;
    }
    .note textarea { width: 100%; border: none; background: transparent; padding: 0; font: inherit; resize: vertical; min-height: 3rem; }
    .note textarea:focus { outline: none; }
    .note-foot {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    .note:hover .note-foot, .note:focus-within .note-foot { opacity: 1; }
    .note-foot .when { font-size: 0.72rem; color: var(--gl-text-muted); }
    .note-foot .spacer { flex: 1; }
    .note-foot button { padding: 0.25rem 0.45rem; font-size: 0.78rem; }

    /* --- color palette --- */
    .palette { display: inline-flex; gap: 0.3rem; }
    .swatch {
      width: 1.15rem;
      height: 1.15rem;
      padding: 0;
      border-radius: 50%;
      border: 1px solid var(--gl-border);
      cursor: pointer;
    }
    .swatch.active { outline: 2px solid var(--gl-primary); outline-offset: 1px; }

    /* --- filter --- */
    .filter { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.2rem; }
    .filter label { margin: 0; white-space: nowrap; }
    .filter select { width: auto; min-width: 180px; padding: 0.4rem 0.6rem; }

    .empty { text-align: center; color: var(--gl-text-muted); font-size: 0.9rem; margin-top: 2rem; }
  `];

  @state() private notes: CropNote[] = [];
  @state() private filterSlug = "";

  // composer
  @state() private composing = false;
  @state() private slug = "";
  @state() private draft = "";
  @state() private draftColor = "";

  // inline edit
  @state() private editingId: number | null = null;
  @state() private editDraft = "";

  override async connectedCallback() {
    super.connectedCallback();
    await this.refresh();
  }

  private async refresh() {
    this.notes = await listAllNotes();
    // Drop the filter if its crop no longer has any notes.
    if (this.filterSlug && !this.notes.some((n) => n.presetSlug === this.filterSlug)) {
      this.filterSlug = "";
    }
  }

  private changed() {
    this.dispatchEvent(new CustomEvent("changed", { bubbles: true, composed: true }));
  }

  // ---- composer ----

  private resetComposer() {
    this.composing = false;
    this.slug = "";
    this.draft = "";
    this.draftColor = "";
  }

  private async add() {
    const preset = getPreset(this.slug);
    const body = this.draft.trim();
    if (!preset || !body) return;
    await addNote({ presetSlug: preset.slug, presetName: preset.name, body, color: this.draftColor || undefined });
    this.resetComposer();
    await this.refresh();
    this.changed();
  }

  // ---- inline edit ----

  private startEdit(n: CropNote) {
    this.editingId = n.id!;
    this.editDraft = n.body;
  }

  private async commitEdit(n: CropNote) {
    if (this.editingId !== n.id) return;
    const body = this.editDraft.trim();
    this.editingId = null;
    if (body && body !== n.body) {
      await updateNote(n.id!, { body });
      await this.refresh();
      this.changed();
    }
  }

  private async setColor(n: CropNote, hue: string) {
    if ((n.color ?? "") === hue) return;
    await updateNote(n.id!, { color: hue || undefined });
    await this.refresh();
    this.changed();
  }

  private async removeNote(id: number) {
    await deleteNote(id);
    await this.refresh();
    this.changed();
  }

  private fmt(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  /** Distinct crops that currently have notes, for the filter dropdown. */
  private notedCrops(): { slug: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const n of this.notes) if (!seen.has(n.presetSlug)) seen.set(n.presetSlug, n.presetName);
    return [...seen].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private visibleNotes(): CropNote[] {
    return this.filterSlug ? this.notes.filter((n) => n.presetSlug === this.filterSlug) : this.notes;
  }

  private renderComposer() {
    if (!this.composing) {
      return html`
        <div class="card composer collapsed" @click=${() => (this.composing = true)}>
          Take a note about a crop…
        </div>
      `;
    }
    const canAdd = !!this.slug && !!this.draft.trim();
    return html`
      <div class="card composer">
        <div class="field">
          <select @change=${(e: Event) => (this.slug = (e.target as HTMLSelectElement).value)}>
            <option value="">— choose a crop —</option>
            ${PRESETS.map((p) => html`<option value=${p.slug} ?selected=${p.slug === this.slug}>${p.name}${p.localName ? ` · ${p.localName}` : ""} · ${p.growType}</option>`)}
          </select>
        </div>
        <div class="field">
          <textarea
            autofocus
            rows="2"
            .value=${this.draft}
            @input=${(e: Event) => (this.draft = (e.target as HTMLTextAreaElement).value)}
            placeholder="e.g. Soil pH over 8 stunts it — amend before planting"
          ></textarea>
        </div>
        <div class="composer-foot">
          ${this.renderPalette(this.draftColor, (hue) => (this.draftColor = hue))}
          <div class="spacer"></div>
          <button @click=${this.resetComposer}>Close</button>
          <button class="primary" ?disabled=${!canAdd} @click=${this.add}>Add</button>
        </div>
      </div>
    `;
  }

  private renderPalette(current: string, pick: (hue: string) => void) {
    return html`
      <div class="palette">
        ${COLORS.map(
          (c) => html`<button
            class="swatch ${(current ?? "") === c.hue ? "active" : ""}"
            style="background: ${cardBg(c.hue)}"
            title=${c.name}
            @click=${() => pick(c.hue)}
          ></button>`
        )}
      </div>
    `;
  }

  private renderNote(n: CropNote) {
    const editing = this.editingId === n.id;
    return html`
      <div class="card note" style="background: ${cardBg(n.color)}">
        <span class="chip">🌿 ${n.presetName}</span>
        ${editing
          ? html`<textarea
              .value=${this.editDraft}
              @input=${(e: Event) => (this.editDraft = (e.target as HTMLTextAreaElement).value)}
              @blur=${() => this.commitEdit(n)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur();
                if (e.key === "Escape") this.editingId = null;
              }}
            ></textarea>`
          : html`<div class="body" @click=${() => this.startEdit(n)}>${n.body}</div>`}
        <div class="note-foot">
          <span class="when">${this.fmt(n.createdAt)}</span>
          <div class="spacer"></div>
          ${this.renderPalette(n.color ?? "", (hue) => this.setColor(n, hue))}
          <button class="danger" title="Delete" @click=${() => this.removeNote(n.id!)}>🗑</button>
        </div>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="wrap">
        <h2>🌿 Crop notes</h2>
        <p class="intro">
          Jot down what you learn about a crop — soil quirks, timing, mistakes to avoid.
          These resurface when you plant that crop again.
        </p>

        ${this.renderComposer()}

        ${this.notedCrops().length > 1
          ? html`<div class="filter">
              <label for="crop-filter">Filter</label>
              <select
                id="crop-filter"
                @change=${(e: Event) => (this.filterSlug = (e.target as HTMLSelectElement).value)}
              >
                <option value="" ?selected=${this.filterSlug === ""}>All crops</option>
                ${this.notedCrops().map(
                  (c) => html`<option value=${c.slug} ?selected=${c.slug === this.filterSlug}>${c.name}</option>`
                )}
              </select>
            </div>`
          : null}

        ${this.notes.length
          ? html`<div class="board">${this.visibleNotes().map((n) => this.renderNote(n))}</div>`
          : html`<p class="empty">No notes yet. Use the box above to add your first learning.</p>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-crops-page": CropsPage;
  }
}
