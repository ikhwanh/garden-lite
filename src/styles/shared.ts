import { css } from "lit";

/** Common control styles shared by components (consumed via CSS custom props). */
export const controls = css`
  button {
    font: inherit;
    cursor: pointer;
    border: 1px solid var(--gl-border);
    background: var(--gl-surface);
    color: var(--gl-text);
    border-radius: var(--gl-radius-sm);
    padding: 0.55rem 0.9rem;
    transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  }
  button:hover {
    border-color: var(--gl-primary);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button.primary {
    background: var(--gl-primary);
    color: var(--gl-primary-text);
    border-color: var(--gl-primary);
  }
  button.danger {
    color: var(--gl-danger);
    border-color: var(--gl-danger);
  }
  button.ghost {
    background: transparent;
    border-color: transparent;
  }
  label {
    display: block;
    font-size: 0.85rem;
    color: var(--gl-text-muted);
    margin-bottom: 0.3rem;
  }
  input,
  select,
  textarea {
    font: inherit;
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--gl-border);
    border-radius: var(--gl-radius-sm);
    background: var(--gl-surface);
    color: var(--gl-text);
  }
  input:focus,
  select:focus,
  textarea:focus {
    outline: 2px solid var(--gl-primary);
    outline-offset: 1px;
  }
  .field {
    margin-bottom: 0.9rem;
  }
  .row {
    display: flex;
    gap: 0.7rem;
  }
  .row > * {
    flex: 1;
  }
`;

/** Modal dialog backdrop + panel styles. */
export const dialog = css`
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
  }
  .panel {
    background: var(--gl-surface);
    color: var(--gl-text);
    border-radius: var(--gl-radius);
    box-shadow: 0 12px 40px var(--gl-shadow);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1.4rem;
  }
  .panel::-webkit-scrollbar {
    width: 10px;
  }
  .panel::-webkit-scrollbar-track {
    background: transparent;
  }
  .panel::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--gl-text-muted) 40%, transparent);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  .panel::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--gl-text-muted) 65%, transparent);
    background-clip: padding-box;
  }
  .panel h2 {
    margin: 0 0 1rem;
    font-size: 1.2rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 1.2rem;
  }
`;
