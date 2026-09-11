import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "hometown-today",
  brand: {
    primaryColor: "#ff5c39",
  },
  permissions: [
    { name: "geolocation", access: "access" },
  ],
  webBundleDir: "dist",
});
