import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { dialog } from "../styles/shared";
import "./profile-form";

/**
 * First-run onboarding modal. Wraps <gl-profile-form> in a non-dismissable
 * dialog and re-emits its `saved` event.
 */
@customElement("gl-profile-dialog")
export class ProfileDialog extends LitElement {
  static override styles = [dialog, css`
    .hint { font-size: 0.8rem; color: var(--gl-text-muted); margin: 0 0 1rem; }
  `];

  override render() {
    return html`
      <div class="backdrop">
        <div class="panel">
          <h2>🌱 Welcome to Garden Lite</h2>
          <p class="hint">Tell us about your growing site so we can recommend plants that thrive there.</p>
          <gl-profile-form onboarding></gl-profile-form>
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
