import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { countView } from "./counter";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// One anonymous count per load of the hosted demo; nothing is sent anywhere else (see counter.ts).
countView("/");
