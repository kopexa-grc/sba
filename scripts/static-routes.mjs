// GitHub Pages serves unknown paths via 404.html (status 404). Copy the app shell to the
// main routes so they answer with 200 – for search engines, link checkers and publiccode.yml.
import { copyFileSync, mkdirSync } from "node:fs";

const ROUTES = ["hilfe", "einstellungen", "styleguide"];
copyFileSync("dist/index.html", "dist/404.html");
for (const route of ROUTES) {
  mkdirSync(`dist/${route}`, { recursive: true });
  copyFileSync("dist/index.html", `dist/${route}/index.html`);
}
console.log(`static routes: 404.html, ${ROUTES.map((r) => `${r}/index.html`).join(", ")}`);
