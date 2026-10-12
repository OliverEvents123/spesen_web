// Vite übersetzt den React-Code in normale Dateien für den Browser.
// base "./": alle Pfade relativ — dieselbe Fassung läuft unter / und unter /test/.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true }
});
