import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Les tests qui tournent ici sont ceux dont le chemin exécuté EST le chemin de production :
 * `src/lib/*` est isomorphe (navigateur et Node). Ce que ça ne couvre pas, assumé et écrit
 * dans PROPOSITIONS.md : le rendu à l'écran et le comportement réel du service worker —
 * ce bac à sable n'a pas de navigateur.
 */
export default defineConfig({
  resolve: { alias: { "@": path.join(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
