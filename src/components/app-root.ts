import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Router } from "@lit-labs/router";
import { BASE, toAppPath } from "../router";
import { controls } from "../styles/shared";
import { getProfile, listPlantings, addPlanting, deletePlanting } from "../db/db";
import { eventsByDate, toISODate, CATEGORY_LABELS } from "../domain/events";
import { eventsToICS } from "../domain/ics";
import { downloadFile } from "../domain/io";
import type { EventCategory, GardenEvent, Planting, Profile } from "../domain/types";

import "./profile-dialog";
import "./calendar-view";
import "./day-detail";
import "./timeline-view";
import "./add-plant-dialog";
import "./export-dialog";
import "./settings-page";

type Theme = "light" | "dark";

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
    .segmented button,
    .segmented a {
      border: none;
      border-radius: 0;
      padding: 0.45rem 0.9rem;
      display: inline-flex;
      align-items: center;
      color: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    .segmented button.active,
    .segmented a.active {
      background: var(--gl-primary);
      color: var(--gl-primary-text);
    }
    a.navlink {
      display: inline-flex;
      align-items: center;
      font: inherit;
      cursor: pointer;
      border: 1px solid var(--gl-border);
      background: var(--gl-surface);
      color: var(--gl-text);
      border-radius: var(--gl-radius-sm);
      padding: 0.45rem 0.7rem;
      text-decoration: none;
      transition: border-color 0.15s ease;
    }
    a.navlink:hover { border-color: var(--gl-primary); }
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

  /** null = show all plantings; otherwise filter to this planting id. */
  @state() private filterPlantingId: number | null = null;
  /** null = show all event types; otherwise filter to this category. */
  @state() private filterCategory: EventCategory | null = null;

  @state() private showProfile = false; // first-run onboarding only
  @state() private showAdd = false;
  @state() private showExport = false;
  @state() private theme: Theme =
    (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";

  private router = new Router(this, [
    { path: `${BASE}/`, render: () => this.renderCalendarPage() },
    { path: `${BASE}/index.html`, render: () => this.renderCalendarPage() },
    { path: `${BASE}/timeline`, render: () => this.renderTimelinePage() },
    { path: `${BASE}/settings`, render: () => this.renderSettingsPage() },
  ], {
    // Unknown paths fall back to the calendar rather than throwing.
    fallback: { render: () => this.renderCalendarPage() },
  });

  /** In-app path (base stripped), e.g. `/`, `/timeline`, `/settings`. */
  private get currentPath(): string {
    return toAppPath(location.pathname);
  }

  /** Programmatic navigation for non-anchor triggers (e.g. closing Settings). */
  private goto(path: string) {
    const url = `${BASE}${path}`;
    if (url === location.pathname) return;
    history.pushState({}, "", url);
    this.router.goto(url);
  }

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
    return (
      (this.filterPlantingId == null || e.plantingId === this.filterPlantingId) &&
      (this.filterCategory == null || e.category === this.filterCategory)
    );
  }

  /** Events for the active plant filter, flattened. */
  private filteredEvents(): GardenEvent[] {
    return this.allEvents().filter((e) => this.matchesFilter(e));
  }

  /** eventsMap restricted to the active plant and event-type filters. */
  private filteredEventsMap(): Map<string, GardenEvent[]> {
    if (this.filterPlantingId == null && this.filterCategory == null) return this.eventsMap;
    const out = new Map<string, GardenEvent[]>();
    for (const [date, evs] of this.eventsMap) {
      const f = evs.filter((e) => this.matchesFilter(e));
      if (f.length) out.set(date, f);
    }
    return out;
  }

  /** Event categories present for the active plant filter, in CATEGORY_LABELS order. */
  private availableCategories(): EventCategory[] {
    const present = new Set(
      this.allEvents()
        .filter((e) => this.filterPlantingId == null || e.plantingId === this.filterPlantingId)
        .map((e) => e.category)
    );
    return (Object.keys(CATEGORY_LABELS) as EventCategory[]).filter((c) => present.has(c));
  }

  /** Drop a stale filter if its planting no longer exists or its category is no longer present. */
  private syncFilter() {
    if (this.filterPlantingId != null && !this.plantings.some((p) => p.id === this.filterPlantingId)) {
      this.filterPlantingId = null;
    }
    if (this.filterCategory != null && !this.availableCategories().includes(this.filterCategory)) {
      this.filterCategory = null;
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

  /** Download the shown events, restricted to the chosen categories, as .ics. */
  private exportIcs(categories: EventCategory[]) {
    const include = new Set(categories);
    const events = this.filteredEvents().filter((e) => include.has(e.category));
    if (!events.length) return;
    downloadFile("garden-lite.ics", eventsToICS(events), "text/calendar");
    this.showExport = false;
  }

  private renderToolbar() {
    return html`
      <div class="toolbar">
        <div class="segmented" role="tablist">
          <a
            class=${this.currentPath === "/timeline" ? "" : "active"}
            role="tab"
            href="${BASE}/"
          >📅 Calendar</a>
          <a
            class=${this.currentPath === "/timeline" ? "active" : ""}
            role="tab"
            href="${BASE}/timeline"
          >📋 Timeline</a>
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
                  if (this.filterCategory != null && !this.availableCategories().includes(this.filterCategory)) {
                    this.filterCategory = null;
                  }
                }}
              >
                <option value="" ?selected=${this.filterPlantingId == null}>All plants</option>
                ${this.plantings.map(
                  (p) => html`<option value=${p.id!} ?selected=${p.id === this.filterPlantingId}>${p.name} · ${p.plantedOn}</option>`
                )}
              </select>
            </div>`
          : null}
        ${this.plantings.length
          ? html`<div class="filter">
              <label for="event-filter">Event</label>
              <select
                id="event-filter"
                @change=${(e: Event) => {
                  const v = (e.target as HTMLSelectElement).value;
                  this.filterCategory = v === "" ? null : (v as EventCategory);
                }}
              >
                <option value="" ?selected=${this.filterCategory == null}>All events</option>
                ${this.availableCategories().map(
                  (c) => html`<option value=${c} ?selected=${c === this.filterCategory}>${CATEGORY_LABELS[c]}</option>`
                )}
              </select>
            </div>`
          : null}
        <button
          @click=${() => (this.showExport = true)}
          ?disabled=${!this.filteredEvents().length}
          title="Choose event types and download as an iCalendar (.ics) file"
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

  /* --- Routed pages (see `router` above) --- */

  private renderCalendarPage() {
    return html`${this.renderToolbar()}${this.renderCalendar()}`;
  }

  private renderTimelinePage() {
    return html`${this.renderToolbar()}${this.renderTimeline()}`;
  }

  private renderSettingsPage() {
    return html`
      <gl-settings-page
        .theme=${this.theme}
        @theme-change=${(e: CustomEvent<Theme>) => this.setTheme(e.detail)}
        @saved=${async () => { await this.refresh(); }}
        @changed=${async () => { await this.refresh(); }}
        @close=${() => this.goto("/")}
      ></gl-settings-page>
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
        <a class="navlink" href="${BASE}/settings">⚙️ Settings</a>
      </header>

      ${this.router.outlet()}

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

      ${this.showExport
        ? html`<gl-export-dialog
            .events=${this.filteredEvents()}
            @export=${(e: CustomEvent<EventCategory[]>) => this.exportIcs(e.detail)}
            @close=${() => (this.showExport = false)}
          ></gl-export-dialog>`
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-app": AppRoot;
  }
}
