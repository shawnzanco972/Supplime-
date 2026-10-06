import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource-variable/fraunces/opsz.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppFrame } from "@/components/app-frame";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppFrame />
  </StrictMode>,
);
