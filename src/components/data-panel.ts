import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { controls } from "../styles/shared";
import { exportJSON, importJSON, downloadFile } from "../domain/io";
import { eventsToICS } from "../domain/ics";
import { upsertGist, fetchGistFile } from "../domain/gist";
import { getSettings, saveSettings } from "../db/db";
import type { GardenEvent } from "../domain/types";

const ICS_FILE = "garden-lite.ics";
const DATA_FILE = "garden-lite-data.json";

/**
 * Data export/import + GitHub Gist sync controls (no modal chrome).
 * Emits `changed` when local data is replaced (import / restore).
 */
@customElement("gl-data-panel")
export class DataPanel extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    .group { margin-bottom: 1.3rem; }
    .group h3 { margin: 0 0 0.3rem; font-size: 0.95rem; }
    .group p { margin: 0 0 0.6rem; font-size: 0.82rem; color: var(--gl-text-muted); }
    .btns { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .status { font-size: 0.82rem; margin-top: 0.5rem; word-break: break-all; }
    .ok { color: var(--gl-primary); }
    .err { color: var(--gl-danger); }
    a { color: var(--gl-primary); }
    hr { border: none; border-top: 1px solid var(--gl-border); margin: 0 0 1.2rem; }
  `];

  @property({ attribute: false }) events: GardenEvent[] = [];

  @state() private msg = "";
  @state() private ok = true;
  @state() private busy = false;
  @state() private rawUrl = "";
  @state() private hasToken = false;

  override async connectedCallback() {
    super.connectedCallback();
    const s = await getSettings();
    this.hasToken = !!s.githubToken;
  }

  private changed() {
    this.dispatchEvent(new CustomEvent("changed", { bubbles: true, composed: true }));
  }

  private setStatus(msg: string, ok = true) {
    this.msg = msg;
    this.ok = ok;
  }

  // ---- local file actions ----

  private async exportJson() {
    downloadFile(DATA_FILE, await exportJSON(), "application/json");
  }

  private exportIcs() {
    downloadFile(ICS_FILE, eventsToICS(this.events), "text/calendar");
  }

  private importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await importJSON(await file.text());
        this.setStatus(`Imported ${res.plantings} planting(s).`);
        this.changed();
      } catch (e) {
        this.setStatus((e as Error).message, false);
      }
    };
    input.click();
  }

  // ---- gist actions ----

  private async requireToken(): Promise<string | null> {
    const s = await getSettings();
    if (!s.githubToken) {
      this.setStatus("Add a GitHub token in your profile first.", false);
      return null;
    }
    return s.githubToken;
  }

  private async backupToGist() {
    const token = await this.requireToken();
    if (!token) return;
    this.busy = true;
    try {
      const s = await getSettings();
      const res = await upsertGist({
        token,
        gistId: s.gistId,
        filename: DATA_FILE,
        content: await exportJSON(),
        description: "garden-lite backup",
      });
      await saveSettings({ gistId: res.gistId });
      this.setStatus(`Backed up to gist ${res.gistId}.`);
    } catch (e) {
      this.setStatus((e as Error).message, false);
    } finally {
      this.busy = false;
    }
  }

  private async restoreFromGist() {
    const token = await this.requireToken();
    if (!token) return;
    const s = await getSettings();
    if (!s.gistId) { this.setStatus("No backup gist yet — back up first.", false); return; }
    this.busy = true;
    try {
      const content = await fetchGistFile({ token, gistId: s.gistId, filename: DATA_FILE });
      const res = await importJSON(content);
      this.setStatus(`Restored ${res.plantings} planting(s) from gist.`);
      this.changed();
    } catch (e) {
      this.setStatus((e as Error).message, false);
    } finally {
      this.busy = false;
    }
  }

  private async publishIcsToGist() {
    const token = await this.requireToken();
    if (!token) return;
    this.busy = true;
    try {
      const s = await getSettings();
      const res = await upsertGist({
        token,
        gistId: s.gistId,
        filename: ICS_FILE,
        content: eventsToICS(this.events),
        description: "garden-lite calendar",
      });
      await saveSettings({ gistId: res.gistId });
      this.rawUrl = res.rawUrl;
      this.setStatus("Calendar published. Subscribe with the URL below:");
    } catch (e) {
      this.setStatus((e as Error).message, false);
    } finally {
      this.busy = false;
    }
  }

  override render() {
    return html`
      <div class="group">
        <h3>Local backup</h3>
        <p>Export or import all your garden data as a JSON file.</p>
        <div class="btns">
          <button @click=${this.exportJson}>Export JSON</button>
          <button @click=${this.importJson}>Import JSON</button>
        </div>
      </div>

      <div class="group">
        <h3>Calendar (.ics)</h3>
        <p>Download an iCalendar file you can import into any calendar app.</p>
        <div class="btns">
          <button @click=${this.exportIcs} ?disabled=${!this.events.length}>Export .ics</button>
        </div>
      </div>

      <hr />

      <div class="group">
        <h3>GitHub Gist sync</h3>
        <p>${this.hasToken ? "Sync data and publish a subscribable calendar to a private gist." : "Add a GitHub token above to enable gist sync."}</p>
        <div class="btns">
          <button @click=${this.backupToGist} ?disabled=${this.busy || !this.hasToken}>Back up data</button>
          <button @click=${this.restoreFromGist} ?disabled=${this.busy || !this.hasToken}>Restore data</button>
          <button @click=${this.publishIcsToGist} ?disabled=${this.busy || !this.hasToken || !this.events.length}>Publish calendar</button>
        </div>
      </div>

      ${this.msg ? html`<div class="status ${this.ok ? "ok" : "err"}">${this.msg}</div>` : null}
      ${this.rawUrl
        ? html`<div class="status">
            <a href=${this.rawUrl} target="_blank" rel="noopener">${this.rawUrl}</a>
            <div><button class="ghost" @click=${() => navigator.clipboard?.writeText(this.rawUrl)}>Copy URL</button></div>
          </div>`
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-data-panel": DataPanel;
  }
}
