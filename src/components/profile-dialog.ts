import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { controls, dialog } from "../styles/shared";
import { getProfile, saveProfile, getSettings, saveSettings } from "../db/db";
import { verifyToken } from "../domain/gist";
import type { Profile } from "../domain/types";

/**
 * Onboarding / edit dialog for the garden profile and GitHub token.
 * Emits `saved` when the profile is stored.
 */
@customElement("gl-profile-dialog")
export class ProfileDialog extends LitElement {
  static override styles = [controls, dialog, css`
    .hint {
      font-size: 0.8rem;
      color: var(--gl-text-muted);
      margin: 0.2rem 0 0;
    }
    .token-status {
      font-size: 0.82rem;
      margin-top: 0.4rem;
    }
    .ok {
      color: var(--gl-primary);
    }
    .err {
      color: var(--gl-danger);
    }
    .divider {
      border: none;
      border-top: 1px solid var(--gl-border);
      margin: 1.2rem 0;
    }
    .sub {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0 0 0.6rem;
    }
  `];

  /** When true the dialog is the first-run onboarding (cannot be dismissed). */
  @property({ type: Boolean }) onboarding = false;

  @state() private name = "";
  @state() private masl: string = "";
  @state() private temp: string = "";
  @state() private humidity: string = "";
  @state() private token = "";
  @state() private tokenMsg = "";
  @state() private tokenOk = false;
  @state() private verifying = false;

  override async connectedCallback() {
    super.connectedCallback();
    const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
    if (profile) {
      this.name = profile.name ?? "";
      this.masl = profile.altitudeMasl?.toString() ?? "";
      this.temp = profile.avgTempC?.toString() ?? "";
      this.humidity = profile.avgHumidityPct?.toString() ?? "";
    }
    if (settings.githubToken) {
      this.token = settings.githubToken;
      this.tokenOk = true;
    }
  }

  private num(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  private async verify() {
    if (!this.token.trim()) return;
    this.verifying = true;
    this.tokenMsg = "";
    try {
      const login = await verifyToken(this.token.trim());
      this.tokenOk = true;
      this.tokenMsg = `Connected as @${login}`;
    } catch (e) {
      this.tokenOk = false;
      this.tokenMsg = (e as Error).message;
    } finally {
      this.verifying = false;
    }
  }

  private async save() {
    const profile: Omit<Profile, "id" | "updatedAt"> = {
      name: this.name.trim() || "My Garden",
      altitudeMasl: this.num(this.masl),
      avgTempC: this.num(this.temp),
      avgHumidityPct: this.num(this.humidity),
    };
    await saveProfile(profile);
    await saveSettings({ githubToken: this.token.trim() || undefined });
    this.dispatchEvent(new CustomEvent("saved", { bubbles: true, composed: true }));
  }

  private close() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && !this.onboarding && this.close()}>
        <div class="panel">
          <h2>${this.onboarding ? "🌱 Welcome to Garden Lite" : "Garden profile"}</h2>
          ${this.onboarding
            ? html`<p class="hint">Tell us about your growing site so we can recommend plants that thrive there.</p>`
            : null}

          <div class="field">
            <label>Garden name</label>
            <input .value=${this.name} @input=${(e: Event) => (this.name = (e.target as HTMLInputElement).value)} placeholder="e.g. Highland Plot" />
          </div>

          <div class="row">
            <div class="field">
              <label>Altitude (masl)</label>
              <input type="number" inputmode="numeric" .value=${this.masl} @input=${(e: Event) => (this.masl = (e.target as HTMLInputElement).value)} placeholder="700" />
            </div>
            <div class="field">
              <label>Avg temperature (°C)</label>
              <input type="number" inputmode="decimal" .value=${this.temp} @input=${(e: Event) => (this.temp = (e.target as HTMLInputElement).value)} placeholder="24" />
            </div>
          </div>

          <div class="field">
            <label>Avg humidity (%) — optional</label>
            <input type="number" inputmode="decimal" .value=${this.humidity} @input=${(e: Event) => (this.humidity = (e.target as HTMLInputElement).value)} placeholder="70" />
            <p class="hint">Improves plant compatibility accuracy when provided.</p>
          </div>

          <hr class="divider" />
          <p class="sub">GitHub Gist sync (optional)</p>
          <div class="field">
            <label>Personal access token</label>
            <input type="password" .value=${this.token} @input=${(e: Event) => { this.token = (e.target as HTMLInputElement).value; this.tokenOk = false; this.tokenMsg = ""; }} placeholder="ghp_… (gist scope only)" />
            <p class="hint">Create a token with <strong>only the “gist” scope</strong>. Stored locally in your browser.</p>
            ${this.token.trim()
              ? html`<div class="token-status">
                  <button class="ghost" @click=${this.verify} ?disabled=${this.verifying}>${this.verifying ? "Checking…" : "Verify token"}</button>
                  ${this.tokenMsg ? html`<span class=${this.tokenOk ? "ok" : "err"}>${this.tokenMsg}</span>` : null}
                </div>`
              : null}
          </div>

          <div class="actions">
            ${this.onboarding ? null : html`<button @click=${this.close}>Cancel</button>`}
            <button class="primary" @click=${this.save}>${this.onboarding ? "Start gardening" : "Save"}</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-profile-dialog": ProfileDialog;
  }
}
