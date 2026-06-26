import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { getProfile, listPlantings, addPlanting, deletePlanting } from "../db/db";
import { eventsByDate, toISODate } from "../domain/events";
import { eventsToICS } from "../domain/ics";
import { downloadFile } from "../domain/io";
import type { GardenEvent, Planting, Profile } from "../domain/types";

import "./profile-dialog";
import "./calendar-view";
import "./day-detail";
import "./timeline-view";
import "./add-plant-dialog";
import "./settings-page";

type Theme = "light" | "dark";
type ViewMode = "calendar" | "timeline";

@customElement("gl-app")
export class AppRoot extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    header {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.8rem 1.1rem;
      background: var(--gl-surface);
      border-bottom: 1px solid var(--gl-border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand { font-weight: 700; font-size: 1.1rem; }
    .brand .leaf { color: var(--gl-primary); }
    .site { font-size: 0.78rem; color: var(--gl-text-muted); }
    .spacer { flex: 1; }
    header button { padding: 0.45rem 0.7rem; }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-wrap: wrap;
      max-width: 1100px;
      margin: 0 auto;
      padding: 1rem 1rem 0;
    }
    .toolbar .spacer { flex: 1; }
    .segmented {
      display: inline-flex;
      border: 1px solid var(--gl-border);
      border-radius: var(--gl-radius-sm);
      overflow: hidden;
    }
    .segmented button {
      border: none;
      border-radius: 0;
      padding: 0.45rem 0.9rem;
    }
    .segmented button.active {
      background: var(--gl-primary);
      color: var(--gl-primary-text);
    }
    .filter {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .filter label { margin: 0; white-space: nowrap; }
    .filter select { width: auto; min-width: 160px; padding: 0.4rem 0.6rem; }

    main {
      display: grid;
      grid-template-columns: minmax(320px, 1.2fr) 1fr;
      gap: 1rem;
      padding: 1rem;
      max-width: 1100px;
      margin: 0 auto;
      align-items: start;
    }
    main.single { grid-template-columns: 1fr; }
    .pane {
      background: var(--gl-surface-2);
      border: 1px solid var(--gl-border);
      border-radius: var(--gl-radius);
      padding: 1rem;
    }
    .right { position: sticky; top: 70px; }

    @media (max-width: 760px) {
      main { grid-template-columns: 1fr; }
      .right { position: static; }
      header { flex-wrap: wrap; }
    }
  `];

  @state() private profile: Profile | null = null;
  @state() private plantings: Planting[] = [];
  @state() private eventsMap: Map<string, GardenEvent[]> = new Map();
  @state() private selected = toISODate(new Date());
  @state() private loading = true;

  @state() private view: ViewMode = "calendar";
  /** null = show all plantings; otherwise filter to this planting id. */
  @state() private filterPlantingId: number | null = null;

  @state() private showProfile = false; // first-run onboarding only
  @state() private showAdd = false;
  @state() private showSettings = false;
  @state() private theme: Theme =
    (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";

  override async connectedCallback() {
    super.connectedCallback();
    await this.reload();
  }

  /** Initial load — shows the loading splash and gates onboarding. */
  private async reload() {
    this.loading = true;
    await this.refresh();
    this.loading = false;
    if (!this.profile) this.showProfile = true;
  }

  /** Re-read data without unmounting open overlays (e.g. Settings). */
  private async refresh() {
    this.profile = await getProfile();
    this.plantings = await listPlantings();
    this.eventsMap = eventsByDate(this.plantings);
    this.syncFilter();
  }

  private allEvents(): GardenEvent[] {
    return [...this.eventsMap.values()].flat();
  }

  private matchesFilter(e: GardenEvent): boolean {
    return this.filterPlantingId == null || e.plantingId === this.filterPlantingId;
  }

  /** Events for the active plant filter, flattened. */
  private filteredEvents(): GardenEvent[] {
    return this.allEvents().filter((e) => this.matchesFilter(e));
  }

  /** eventsMap restricted to the active plant filter. */
  private filteredEventsMap(): Map<string, GardenEvent[]> {
    if (this.filterPlantingId == null) return this.eventsMap;
    const out = new Map<string, GardenEvent[]>();
    for (const [date, evs] of this.eventsMap) {
      const f = evs.filter((e) => this.matchesFilter(e));
      if (f.length) out.set(date, f);
    }
    return out;
  }

  /** Drop a stale filter if its planting no longer exists. */
  private syncFilter() {
    if (this.filterPlantingId != null && !this.plantings.some((p) => p.id === this.filterPlantingId)) {
      this.filterPlantingId = null;
    }
  }

  private setTheme(next: Theme) {
    this.theme = next;
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gl-theme", next);
  }

  private async onPlant(e: CustomEvent<Omit<Planting, "id" | "createdAt">>) {
    await addPlanting(e.detail);
    this.showAdd = false;
    await this.refresh();
  }

  private async onDeletePlanting(e: CustomEvent<number>) {
    if (!confirm("Remove this planting and all its scheduled events?")) return;
    await deletePlanting(e.detail);
    await this.refresh();
  }

  /** Export the currently-shown events (respects the active plant filter) as .ics. */
  private exportIcs() {
    const events = this.filteredEvents();
    if (!events.length) return;
    downloadFile("garden-lite.ics", eventsToICS(events), "text/calendar");
  }

  private renderToolbar() {
    return html`
      <div class="toolbar">
        <div class="segmented" role="tablist">
          <button
            class=${this.view === "calendar" ? "active" : ""}
            role="tab"
            @click=${() => (this.view = "calendar")}
          >📅 Calendar</button>
          <button
            class=${this.view === "timeline" ? "active" : ""}
            role="tab"
            @click=${() => (this.view = "timeline")}
          >📋 Timeline</button>
        </div>
        <div class="spacer"></div>
        ${this.plantings.length
          ? html`<div class="filter">
              <label for="plant-filter">Plant</label>
              <select
                id="plant-filter"
                @change=${(e: Event) => {
                  const v = (e.target as HTMLSelectElement).value;
                  this.filterPlantingId = v === "" ? null : Number(v);
                }}
              >
                <option value="" ?selected=${this.filterPlantingId == null}>All plants</option>
                ${this.plantings.map(
                  (p) => html`<option value=${p.id!} ?selected=${p.id === this.filterPlantingId}>${p.name} · ${p.plantedOn}</option>`
                )}
              </select>
            </div>`
          : null}
        <button
          @click=${this.exportIcs}
          ?disabled=${!this.filteredEvents().length}
          title="Download the shown events as an iCalendar (.ics) file"
        >⬇️ Export .ics</button>
      </div>
    `;
  }

  private renderCalendar() {
    const map = this.filteredEventsMap();
    const dayEvents = map.get(this.selected) ?? [];
    return html`
      <main>
        <div class="pane">
          <gl-calendar
            .events=${map}
            .selected=${this.selected}
            @select-date=${(e: CustomEvent<string>) => (this.selected = e.detail)}
          ></gl-calendar>
        </div>
        <div class="pane right">
          <gl-day-detail
            .selected=${this.selected}
            .events=${dayEvents}
            @add-plant=${() => (this.showAdd = true)}
            @delete-planting=${this.onDeletePlanting}
          ></gl-day-detail>
        </div>
      </main>
    `;
  }

  private renderTimeline() {
    return html`
      <main class="single">
        <div class="pane">
          <gl-timeline-view .events=${this.filteredEvents()}></gl-timeline-view>
        </div>
      </main>
    `;
  }

  override render() {
    if (this.loading) return html`<main><div class="pane">Loading…</div></main>`;

    return html`
      <header>
        <div>
          <div class="brand"><span class="leaf">🌱</span> Garden Lite</div>
          ${this.profile ? html`<div class="site">${this.profile.name}${this.profile.altitudeMasl != null ? ` · ${this.profile.altitudeMasl} masl` : ""}${this.profile.avgTempC != null ? ` · ${this.profile.avgTempC}°C` : ""}</div>` : null}
        </div>
        <div class="spacer"></div>
        <button @click=${() => (this.showSettings = true)}>⚙️ Settings</button>
      </header>

      ${this.renderToolbar()}
      ${this.view === "calendar" ? this.renderCalendar() : this.renderTimeline()}

      ${this.showProfile
        ? html`<gl-profile-dialog
            @saved=${async () => { this.showProfile = false; await this.refresh(); }}
          ></gl-profile-dialog>`
        : null}

      ${this.showAdd
        ? html`<gl-add-plant-dialog
            .date=${this.selected}
            .profile=${this.profile}
            @plant=${this.onPlant}
            @close=${() => (this.showAdd = false)}
          ></gl-add-plant-dialog>`
        : null}

      ${this.showSettings
        ? html`<gl-settings-page
            .theme=${this.theme}
            @theme-change=${(e: CustomEvent<Theme>) => this.setTheme(e.detail)}
            @saved=${async () => { await this.refresh(); }}
            @changed=${async () => { await this.refresh(); }}
            @close=${() => (this.showSettings = false)}
          ></gl-settings-page>`
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-app": AppRoot;
  }
}
