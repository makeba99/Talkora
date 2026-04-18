import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

try {
  Object.defineProperty(navigator, "geolocation", {
    value: undefined,
    configurable: false,
  });
} catch {
}

try {
  const originalQuery = navigator.permissions?.query?.bind(navigator.permissions);
  if (originalQuery) {
    navigator.permissions.query = ((descriptor: PermissionDescriptor) => {
      if (descriptor?.name === "geolocation") {
        return Promise.resolve({
          name: "geolocation",
          state: "denied",
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as PermissionStatus);
      }
      return originalQuery(descriptor);
    }) as Permissions["query"];
  }
} catch {
}

createRoot(document.getElementById("root")!).render(<App />);
