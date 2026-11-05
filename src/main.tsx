import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// The old-browser check in index.html replaces the page (and #root) on unsupported browsers
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
