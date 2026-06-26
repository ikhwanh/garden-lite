import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { controls, dialog } from "../styles/shared";
import "./profile-form";
import "./data-panel";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/**
 * Single Settings page consolidating Appearance (theme), Garden profile,
 * and Data & sync. Re-emits child events to the app shell.
 *
 * Events: `theme-change` (detail: Theme), `saved`, `changed`, `close`.
 */
@customElement("gl-settings-page")
export class SettingsPage extends LitElement {
  static override styles = [controls, dialog, css`
    .panel { max-width: 560px; }
    section { margin-bottom: 1.6rem; }
    section > h3 {
      margin: 0 0 0.7rem;
      font-size: 1rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--gl-border);
    }
    .theme-opts { display: flex; gap: 0.5rem; }
    .theme-opts button { flex: 1; }
    .theme-opts button.active {
      background: var(--gl-primary);
      color: var(--gl-primary-text);
      border-color: var(--gl-primary);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.2rem;
    }
    .head h2 { margin: 0; }
  `];

  @property() theme: Theme = "light";

  private close() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private pickTheme(t: Theme) {
    if (t === this.theme) return;
    this.dispatchEvent(new CustomEvent("theme-change", { detail: t, bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
        <div class="panel">
          <div class="head">
            <h2>⚙️ Settings</h2>
            <button @click=${this.close}>Close</button>
          </div>

          <section>
            <h3>Appearance</h3>
            <div class="theme-opts">
              ${THEMES.map(
                (t) => html`<button
                  class=${t === this.theme ? "active" : ""}
                  @click=${() => this.pickTheme(t)}
                >${t === "dark" ? "🌙 Dark" : "☀️ Light"}</button>`
              )}
            </div>
          </section>

          <section>
            <h3>Garden profile</h3>
            <gl-profile-form></gl-profile-form>
          </section>

          <section>
            <h3>Data &amp; sync</h3>
            <gl-data-panel></gl-data-panel>
          </section>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-settings-page": SettingsPage;
  }
}
