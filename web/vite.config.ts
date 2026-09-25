import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server + build config for the Reading Buddy SPA.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expose on the local network so you can test on a phone
  },
});
