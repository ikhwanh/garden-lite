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
import "./crops-page";

type Theme = "light" | "dark";

@customElement("gl-app")
export class AppRoot extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    nav.tabs {
      background: var(--gl-surface);
      border-bottom: 1px solid var(--gl-border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .tabs-inner {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      max-width: 1100px;
      margin: 0 auto;
      padding: 0.4rem 0.5rem;
    }
    .segmented {
      display: inline-flex;
      border: 1px solid var(--gl-border);
      border-radius: var(--gl-radius-sm);
      overflow: hidden;
    }
    .segmented a {
      padding: 0.35rem 0.7rem;
      font-size: 0.85rem;
      color: var(--gl-text-muted);
      text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .segmented a.active {
      background: var(--gl-primary);
      color: var(--gl-primary-text);
    }
    .tab {
      padding: 0.35rem 0.7rem;
      color: var(--gl-text-muted);
      text-decoration: none;
      font-size: 0.85rem;
      border-radius: var(--gl-radius-sm);
      transition: color 0.15s ease, background 0.15s ease;
    }
    .tab:hover { color: var(--gl-text); }
    .tab.active {
      color: var(--gl-primary-text);
      background: var(--gl-primary);
    }

    .spacer { flex: 1; }

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
    }

    footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.5rem 1rem 2rem;
      font-size: 0.78rem;
      color: var(--gl-text-muted);
    }
    footer a {
      color: inherit;
      text-decoration: none;
    }
    footer a:hover { color: var(--gl-primary); }
    footer .sep { opacity: 0.5; }
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
    { path: `${BASE}/crops`, render: () => this.renderCropsPage() },
    { path: `${BASE}/settings`, render: () => this.renderSettingsPage() },
  ], {
    // Unknown paths fall back to the calendar rather than throwing.
    fallback: { render: () => this.renderCalendarPage() },
  });

  /** In-app path (base stripped), e.g. `/`, `/timeline`, `/settings`. */
  private get currentPath(): string {
    return toAppPath(location.pathname);
  }

  /** Whether `path` is the active tab (the calendar tab also matches `/index.html`). */
  private isActive(path: string): boolean {
    const cur = this.currentPath;
    if (path === "/") return cur === "/" || cur === "/index.html";
    return cur === path;
  }

  private tab(path: string, label: string) {
    const active = this.isActive(path);
    return html`<a
      class="tab ${active ? "active" : ""}"
      role="tab"
      aria-selected=${active}
      href="${BASE}${path}"
    >${label}</a>`;
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
        <div class="spacer"></div>
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

  private renderCropsPage() {
    return html`
      <gl-crops-page @changed=${async () => { await this.refresh(); }}></gl-crops-page>
    `;
  }

  private renderSettingsPage() {
    return html`
      <gl-settings-page
        .theme=${this.theme}
        @theme-change=${(e: CustomEvent<Theme>) => this.setTheme(e.detail)}
        @saved=${async () => { await this.refresh(); }}
        @changed=${async () => { await this.refresh(); }}
      ></gl-settings-page>
    `;
  }

  override render() {
    if (this.loading) return html`<main><div class="pane">Loading…</div></main>`;

    return html`
      <nav class="tabs" role="tablist">
        <div class="tabs-inner">
          <div class="segmented">
            <a
              class=${this.isActive("/") ? "active" : ""}
              role="tab"
              aria-selected=${this.isActive("/")}
              href="${BASE}/"
            >Calendar</a>
            <a
              class=${this.isActive("/timeline") ? "active" : ""}
              role="tab"
              aria-selected=${this.isActive("/timeline")}
              href="${BASE}/timeline"
            >Timeline</a>
          </div>
          ${this.tab("/crops", "Notes")}
          ${this.tab("/settings", "Settings")}
        </div>
      </nav>

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

      <footer>
        <a
          href="https://github.com/ikhwanh/garden-lite"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub</a>
        <span class="sep">·</span>
        <span>v${__APP_VERSION__}</span>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-app": AppRoot;
  }
}
