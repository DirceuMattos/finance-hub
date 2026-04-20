import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: "@/integrations/supabase/client",
        replacement: path.resolve(__dirname, "./src/lib/supabase-client-proxy.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
}));
