import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    passWithNoTests: false,
    projects: [
      "./vitest.billdesk.config.mts",
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          globals: true,
          include: ["tests/unit/**/*.test.tsx"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
