import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { getProfile, listPlantings, addPlanting, deletePlanting } from "../db/db";
import { eventsByDate, toISODate } from "../domain/events";
import type { GardenEvent, Planting, Profile } from "../domain/types";

import "./profile-dialog";
import "./calendar-view";
import "./day-detail";
import "./add-plant-dialog";
import "./data-dialog";

const THEMES = ["light", "dark"] as const;

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

    main {
      display: grid;
      grid-template-columns: minmax(320px, 1.2fr) 1fr;
      gap: 1rem;
      padding: 1rem;
      max-width: 1100px;
      margin: 0 auto;
      align-items: start;
    }
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

  @state() private showProfile = false;
  @state() private showAdd = false;
  @state() private showData = false;
  @state() private theme = document.documentElement.getAttribute("data-theme") ?? "light";

  override async connectedCallback() {
    super.connectedCallback();
    await this.reload();
  }

  private async reload() {
    this.loading = true;
    this.profile = await getProfile();
    this.plantings = await listPlantings();
    this.eventsMap = eventsByDate(this.plantings);
    this.loading = false;
    if (!this.profile) this.showProfile = true;
  }

  private allEvents(): GardenEvent[] {
    return [...this.eventsMap.values()].flat();
  }

  private cycleTheme() {
    const idx = THEMES.indexOf(this.theme as (typeof THEMES)[number]);
    const next = THEMES[(idx + 1) % THEMES.length];
    this.theme = next;
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gl-theme", next);
  }

  private async onPlant(e: CustomEvent<Omit<Planting, "id" | "createdAt">>) {
    await addPlanting(e.detail);
    this.showAdd = false;
    await this.reload();
  }

  private async onDeletePlanting(e: CustomEvent<number>) {
    if (!confirm("Remove this planting and all its scheduled events?")) return;
    await deletePlanting(e.detail);
    await this.reload();
  }

  override render() {
    if (this.loading) return html`<main><div class="pane">Loading…</div></main>`;

    const dayEvents = this.eventsMap.get(this.selected) ?? [];

    return html`
      <header>
        <div>
          <div class="brand"><span class="leaf">🌱</span> Garden Lite</div>
          ${this.profile ? html`<div class="site">${this.profile.name}${this.profile.altitudeMasl != null ? ` · ${this.profile.altitudeMasl} masl` : ""}${this.profile.avgTempC != null ? ` · ${this.profile.avgTempC}°C` : ""}</div>` : null}
        </div>
        <div class="spacer"></div>
        <button @click=${this.cycleTheme} title="Switch theme">${this.theme === "dark" ? "☀️ Light" : "🌙 Dark"}</button>
        <button @click=${() => (this.showData = true)}>Data &amp; sync</button>
        <button @click=${() => (this.showProfile = true)}>Profile</button>
      </header>

      <main>
        <div class="pane">
          <gl-calendar
            .events=${this.eventsMap}
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

      ${this.showProfile
        ? html`<gl-profile-dialog
            .onboarding=${!this.profile}
            @saved=${async () => { this.showProfile = false; await this.reload(); }}
            @close=${() => (this.showProfile = false)}
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

      ${this.showData
        ? html`<gl-data-dialog
            .events=${this.allEvents()}
            @changed=${async () => { await this.reload(); }}
            @close=${() => (this.showData = false)}
          ></gl-data-dialog>`
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-app": AppRoot;
  }
}
