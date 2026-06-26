import "./styles/main.scss";
import "./components/app-root";

// Apply persisted theme as early as possible (default set in index.html).
const saved = localStorage.getItem("gl-theme");
if (saved === "light" || saved === "dark") {
  document.documentElement.setAttribute("data-theme", saved);
}
