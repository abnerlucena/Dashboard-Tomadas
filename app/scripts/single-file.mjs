// Junta o build (app/dist) num único HTML com CSS e JS embutidos,
// para abrir sem servidor ou publicar como página.
// Uso: npm run build:html  →  app/dist/dash-producao.html
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [folder = "dist", source = "index.html", target = "dash-producao.html"] = process.argv.slice(2);
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", folder);
let html = readFileSync(path.join(dist, source), "utf8");

html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g,
  (_, file) => `<style>${readFileSync(path.join(dist, file), "utf8")}</style>`,
);
html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g,
  (_, file) =>
    `<script type="module">${readFileSync(path.join(dist, file), "utf8").replace(/<\/script/g, "<\\/script")}</script>`,
);

const leftovers = html.replace(/<style>[\s\S]*?<\/style>|<script type="module">[\s\S]*?<\/script>/g, "");
if (/\.\/assets\//.test(leftovers)) throw new Error("Algum asset não foi embutido no HTML");

const out = path.join(dist, target);
writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
