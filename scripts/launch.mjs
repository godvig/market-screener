#!/usr/bin/env node
// One-step launcher: installs dependencies, builds the client when needed,
// starts the server on a free port and opens the browser.
// Usage: node scripts/launch.mjs [--no-open] [--shortcut]
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const args = new Set(process.argv.slice(2));
const win = process.platform === "win32";
const say = (msg) => console.log(`\n▸ ${msg}`);
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

const MIN_NODE = 20;
if (Number(process.versions.node.split(".")[0]) < MIN_NODE) {
  fail(`Node ${MIN_NODE} or newer is needed (you have ${process.versions.node}). Get it from https://nodejs.org`);
}

const mtime = (file) => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0);
/** Newest modification time among files under the given paths. */
function newest(...paths) {
  let latest = 0;
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) latest = Math.max(latest, newest(...fs.readdirSync(p).map((name) => path.join(p, name))));
    else latest = Math.max(latest, stat.mtimeMs);
  }
  return latest;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: win });
  if (result.status !== 0) fail(`"${command} ${commandArgs.join(" ")}" failed. Fix the error above and run the launcher again.`);
}

if (args.has("--shortcut")) {
  addShortcut();
  process.exit(0);
}

if (!fs.existsSync(".env")) {
  fs.copyFileSync(".env.example", ".env");
  say("Created .env from .env.example (Yahoo data, no key needed).");
}

if (mtime("package-lock.json") > mtime("node_modules/.package-lock.json")) {
  say("Installing dependencies (first run, or they changed)…");
  run("npm", ["install", "--no-audit", "--no-fund"]);
}

const sources = ["src", "shared", "public", "index.html", "vite.config.ts", "package-lock.json"];
if (newest(...sources) > mtime("dist/index.html")) {
  say("Building the app…");
  run("npm", ["run", "build"]);
}

const wanted = Number(process.env.PORT ?? fs.readFileSync(".env", "utf8").match(/^PORT=(\d+)/m)?.[1] ?? 8787);
const isFree = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
/** True when the port is answered by a Market Screener that is already running. */
const isOurs = async (port) => {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    return res.ok && (await res.json()).app === "market-screener";
  } catch {
    return false;
  }
};

function openBrowser(url) {
  if (args.has("--no-open")) return;
  const [command, commandArgs] = win ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(command, commandArgs, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

let port = wanted;
while (!(await isFree(port))) {
  if (await isOurs(port)) {
    say(`Market Screener is already running: http://localhost:${port}`);
    openBrowser(`http://localhost:${port}`);
    process.exit(0);
  }
  if (++port > wanted + 20) fail(`No free port between ${wanted} and ${wanted + 20}.`);
}
if (port !== wanted) say(`Port ${wanted} is used by another program, using ${port} instead.`);

const url = `http://localhost:${port}`;
const server = spawn(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "server/index.ts"], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));

for (let attempt = 0; attempt < 60; attempt++) {
  if (await isOurs(port)) {
    say(`Market Screener is running: ${url}\n  Keep this window open. Close it (or press Ctrl+C) to stop.`);
    openBrowser(url);
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

/** Adds a launcher to the application menu (Linux), so the app starts without a terminal command. */
function addShortcut() {
  if (process.platform !== "linux") fail("--shortcut is for Linux. On Windows, right-click start.bat and choose Create shortcut.");
  const dir = path.join(os.homedir(), ".local", "share", "applications");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "market-screener.desktop");
  fs.writeFileSync(
    file,
    [
      "[Desktop Entry]",
      "Type=Application",
      "Name=Market Screener",
      "Comment=Stock screener with your own scorecards",
      `Exec="${path.join(root, "start.sh")}"`,
      `Icon=${path.join(root, "public", "favicon.svg")}`,
      "Terminal=true",
      "Categories=Office;Finance;",
      "",
    ].join("\n"),
  );
  fs.chmodSync(file, 0o755);
  say(`Added "Market Screener" to the application menu (${file}).`);
}
