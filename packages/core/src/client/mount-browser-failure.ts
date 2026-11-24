import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { BrowserFailureScreen } from "./browser-screen.tsx";

export const showBrowserFailure = (): void => {
  const container = globalThis.document.createElement("div");
  globalThis.document.body.replaceChildren(container);
  createRoot(container).render(createElement(BrowserFailureScreen));
};
