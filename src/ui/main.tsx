import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { OdeClient } from "./app/client";
import { ClientContext } from "./app/hooks";
import { layoutFromUrl } from "./app/layout";

const container = document.getElementById("root");
if (!container) throw new Error("The page has no #root element");

const client = new OdeClient(layoutFromUrl());
client.start();

createRoot(container).render(
  <StrictMode>
    <ClientContext value={client}>
      <App />
    </ClientContext>
  </StrictMode>,
);
