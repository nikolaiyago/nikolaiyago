import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Vite is only used as a local static file server + build tool.
 * Pages are plain HTML/CSS/JS in the project root.
 * /presence-ws proxies to the live visitor / cursor server.
 *
 * Force-serve files under public/ with correct MIME types. Without this,
 * newly added public assets can be returned as text/html by the SPA fallback.
 */
function servePublicAssets(): Plugin {
  const mime: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
    ".html": "text/html; charset=utf-8",
  };

  return {
    name: "serve-public-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = decodeURIComponent((req.url || "").split("?")[0] || "");
        const allowed =
          urlPath.startsWith("/images/") ||
          urlPath.startsWith("/videos/") ||
          urlPath.startsWith("/rema/") ||
          urlPath.startsWith("/wcag/");
        if (!allowed) {
          return next();
        }
        // Strip leading "/" so path.join never treats urlPath as absolute.
        const filePath = path.join(
          server.config.root,
          "public",
          urlPath.replace(/^\/+/, ""),
        );
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return next();
        }
        const ext = path.extname(filePath).toLowerCase();
        const type = mime[ext];
        if (!type) return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", type);
        res.setHeader("Content-Length", fs.statSync(filePath).size);
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Multi-page HTML site — avoid SPA index.html fallback for missing assets
  // (that fallback is what makes broken <img> look "corrupted").
  appType: "mpa",
  plugins: [servePublicAssets()],
  publicDir: "public",
  assetsInclude: ["**/*.pdf"],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    proxy: {
      "/presence-ws": {
        // 8790 — old stuck presence processes often still own 8787–8789
        target: "ws://127.0.0.1:8790",
        ws: true,
        rewrite: (path) => path.replace(/^\/presence-ws/, ""),
      },
    },
  },
});
