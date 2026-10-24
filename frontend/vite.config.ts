import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { validateProductionConfig } from "./src/lib/productionConfig.js";

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    validateProductionConfig({
      ...loadEnv(mode, process.cwd(), "VITE_"),
      ...process.env,
    });
  }
  return { plugins: [react()] };
});
