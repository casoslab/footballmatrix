import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

// Dynamic routes are injected (not file-based) because the repository naming
// linter (tools/ts/lint-naming) requires every path to be kebab-case, which
// forbids Astro's [param].astro filenames. Each entrypoint below is a normal
// kebab-case .astro file that exports getStaticPaths.
function localeRoutes() {
  const entry = (path) => fileURLToPath(new URL(path, import.meta.url));
  return {
    name: "locale-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        injectRoute({ pattern: "/tr/ulke/[id]", entrypoint: entry("./src/routes/tr/country.astro") });
        injectRoute({ pattern: "/tr/oyuncu/[id]", entrypoint: entry("./src/routes/tr/player.astro") });
        injectRoute({ pattern: "/tr/turnuva/[id]", entrypoint: entry("./src/routes/tr/tournament.astro") });
        injectRoute({ pattern: "/en/country/[id]", entrypoint: entry("./src/routes/en/country.astro") });
        injectRoute({ pattern: "/en/player/[id]", entrypoint: entry("./src/routes/en/player.astro") });
        injectRoute({ pattern: "/en/tournament/[id]", entrypoint: entry("./src/routes/en/tournament.astro") });
        // Static locale routes (no params) are injected too, so every
        // entrypoint stays a kebab-case .astro file under src/routes.
        injectRoute({ pattern: "/tr/veri-kalitesi", entrypoint: entry("./src/routes/tr/data-quality.astro") });
        injectRoute({ pattern: "/tr/hakkinda", entrypoint: entry("./src/routes/tr/about.astro") });
        injectRoute({ pattern: "/en/data-quality", entrypoint: entry("./src/routes/en/data-quality.astro") });
        injectRoute({ pattern: "/en/about", entrypoint: entry("./src/routes/en/about.astro") });
      },
    },
  };
}

// A GitHub Pages project site lives at https://<user>.github.io/<repo>/, so the
// build needs a base path. Both are overridable: set SITE_BASE="/" (and SITE_URL)
// once a custom domain is in place, and every link follows via hrefX() in
// src/lib/i18n.ts. Local dev stays at the root.
const SITE_URL = process.env.SITE_URL ?? "https://casoslab.github.io";
const SITE_BASE = process.env.SITE_BASE ?? "/footballmatrix/";

export default defineConfig({
  site: SITE_URL,
  base: SITE_BASE,
  output: "static",
  trailingSlash: "always",
  integrations: [localeRoutes()],
  build: {
    // Keep stylesheets external so `style-src 'self'` holds.
    inlineStylesheets: "never",
  },
  vite: {
    // Vite inlines small bundles into the HTML by default, which would be
    // blocked by this site's `script-src 'self'` policy. Keep them external.
    build: { assetsInlineLimit: 0 },
  },
});
