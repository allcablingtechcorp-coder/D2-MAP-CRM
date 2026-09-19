import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n/i18n";
import { CrmWorkspaceProvider } from "./application/CrmWorkspace";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <CrmWorkspaceProvider><App /></CrmWorkspaceProvider>
    </I18nProvider>
  </StrictMode>,
);
