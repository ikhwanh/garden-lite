import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { controls } from "../styles/shared";
import "./profile-form";
import "./data-panel";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/**
 * Single Settings page consolidating Appearance (theme), Garden profile,
 * and Data & sync. Re-emits child events to the app shell.
 *
 * Events: `theme-change` (detail: Theme), `saved`, `changed`.
 */
@customElement("gl-settings-page")
export class SettingsPage extends LitElement {
  static override styles = [controls, css`
    :host { display: block; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 1rem; }
    h2 { margin: 0 0 1.4rem; }
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
  `];

  @property() theme: Theme = "light";

  private pickTheme(t: Theme) {
    if (t === this.theme) return;
    this.dispatchEvent(new CustomEvent("theme-change", { detail: t, bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="wrap">
        <h2>⚙️ Settings</h2>

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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gl-settings-page": SettingsPage;
  }
}
