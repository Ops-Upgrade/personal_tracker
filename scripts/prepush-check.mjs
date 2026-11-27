#!/usr/bin/env node
/**
 * Pre-push security gate (runs automatically from .githooks/pre-push).
 *
 * Checks, in order:
 *   1. npm audit        — blocks if any vulnerability is reported.
 *   2. Shai-Hulud list  — cross-checks package-lock.json against the
 *                          community list of packages compromised in the
 *                          npm supply-chain campaigns, by exact version.
 *                          The list is cached for 24 h in
 *                          .security-cache/ (git-ignored).
 *   3. gitleaks         — runs when the push touches config/env files
 *                          (always when invoked manually) and blocks on
 *                          any finding. Findings are printed redacted;
 *                          known-benign test placeholders are baselined
 *                          in .gitleaksignore.
 *
 * Hook mode: reads the ref lines git pipes to the hook's stdin and
 * scans the exact commits being pushed with `gitleaks protect
 * --log-opts`. Manual mode (no stdin): scans commits not yet on the
 * remote default, uncommitted tracked changes, and untracked files.
 *
 * Emergency override (use sparingly):
 *   PREPUSH_SKIP=audit,shaihulud,gitleaks   (or "all")
 *
 * No dependencies. Node >= 18.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDir = path.join(repoRoot, ".security-cache");
const listCache = path.join(cacheDir, "shai-hulud.txt");
const untrackedScanDir = path.join(cacheDir, "scan");
const LIST_URL =
  "https://raw.githubusercontent.com/Cobenian/shai-hulud-detect/main/compromised-packages.txt";
const LIST_TTL_MS = 24 * 60 * 60 * 1000;
const NULL_SHA = "0".repeat(40);

// Files whose change makes a gitleaks scan mandatory for the push.
const CONFIG_ENV_RE = [
  /(^|\/)\.env($|\.)/,
  /(^|\/)package(-lock)?\.json$/,
  /(^|\/)npm-shrinkwrap\.json$/,
  /(^|\/)\.npmrc$/,
  /(^|\/)next\.config\./,
  /(^|\/)proxy\.ts$/,
  /(^|\/)middleware\.ts$/,
  /(^|\/)supabase-admin/,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)\.githooks\//,
];
const isConfigEnv = (p) =>
  CONFIG_ENV_RE.some((re) => re.test(p.replaceAll("\\", "/")));

const skipped = new Set(
  (process.env.PREPUSH_SKIP ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);
if (skipped.has("all")) {
  skipped.add("audit");
  skipped.add("shaihulud");
  skipped.add("gitleaks");
}
if (skipped.size > 0) {
  console.warn(
    `WARNING: skipping check(s): ${[...skipped].join(", ")} ` +
      `(PREPUSH_SKIP). This is an emergency escape hatch — restore the ` +
      `checks before any real push.`
  );
}

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failures++;
};
const pass = (msg) => console.log(`PASS: ${msg}`);

// ---- git helpers --------------------------------------------------------

function git(args, { allowFail = false } = {}) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    throw new Error(
      `git ${args.join(" ")} exited ${r.status}: ${(r.stderr ?? "").trim()}`
    );
  }
  return r.status === 0 ? r.stdout : "";
}

/** Remote default branch's commit, when the remote is configured. */
function remoteHead() {
  return git(["rev-parse", "--verify", "--quiet", "origin/HEAD"], {
    allowFail: true,
  }).trim();
}

/** Untracked, non-ignored files (git would include them in a commit). */
function untrackedFiles() {
  return git(["ls-files", "-o", "--exclude-standard"])
    .split(/\r?\n/)
    .filter(Boolean);
}

/**
 * Files changed by the commits being pushed (hook mode), or null when
 * run manually (no ref lines on stdin).
 */
function changedFiles(refLines) {
  if (refLines.length === 0) return null;
  const files = new Set();
  for (const line of refLines) {
    const [, localSha, , remoteSha] = line.split(" ");
    if (!localSha) continue;
    const base = remoteSha && remoteSha !== NULL_SHA ? remoteSha : null;
    let out = base
      ? git(["diff", "--name-only", `${base}...${localSha}`])
      : "";
    if (!base) {
      // New branch: diff against the remote default branch when known.
      const head = remoteHead();
      out = head
        ? git(["diff", "--name-only", `${head}...${localSha}`])
        : "";
      if (!head) continue; // nothing to diff against — gitleaks can't scope
    }
    for (const f of out.split(/\r?\n/)) if (f) files.add(f);
  }
  return [...files];
}

// ---- check 1: npm audit -------------------------------------------------

function checkAudit() {
  if (skipped.has("audit")) {
    console.warn("SKIP: npm audit");
    return;
  }
  if (!existsSync(path.join(repoRoot, "package-lock.json"))) {
    fail("no package-lock.json — resolve dependencies before pushing");
    return;
  }
  // Run npm through its JS entry point to avoid shell quoting on Windows.
  const npmCli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );
  const npmBin = existsSync(npmCli) ? process.execPath : "npm";
  const npmArgs = existsSync(npmCli)
    ? [npmCli, "audit", "--audit-level=low"]
    : ["audit", "--audit-level=low"];
  const r = spawnSync(npmBin, npmArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: !existsSync(npmCli) && process.platform === "win32",
  });
  if (r.error) {
    fail(`npm audit could not run: ${r.error.message}`);
    return;
  }
  if (r.status !== 0) {
    fail("npm audit reported vulnerabilities (see output above)");
    return;
  }
  pass("npm audit — 0 vulnerabilities");
}

// ---- check 2: Shai-Hulud compromised-package cross-check ----------------

/**
 * Parses compromised-packages.txt into a Map of lowercase npm package
 * name -> Set of compromised exact versions. Lines look like
 * "npm:name:version" or bare "name:version" (npm default); entries with
 * other ecosystem prefixes (pypi:, composer:, go:, crates:, gem:) are
 * skipped.
 */
function parseList(text) {
  const names = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let rest = line;
    const eco = /^(npm|pypi|composer|go|crates|gem):/.exec(rest);
    if (eco) {
      if (eco[1] !== "npm") continue;
      rest = rest.slice(eco[0].length);
    }
    const i = rest.lastIndexOf(":");
    if (i <= 0) continue;
    const name = rest.slice(0, i).toLowerCase();
    const version = rest.slice(i + 1);
    if (!names.has(name)) names.set(name, new Set());
    names.get(name).add(version);
  }
  return names;
}

async function loadList() {
  mkdirSync(cacheDir, { recursive: true });
  const fresh =
    existsSync(listCache) &&
    Date.now() - statSync(listCache).mtimeMs < LIST_TTL_MS;
  if (!fresh) {
    try {
      const res = await fetch(LIST_URL, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!/compromised/i.test(text)) throw new Error("unexpected payload");
      writeFileSync(listCache, text);
      console.log(`INFO: refreshed compromised-package list (${LIST_URL})`);
    } catch (err) {
      if (!existsSync(listCache)) {
        fail(`cannot fetch ${LIST_URL} and no cache exists — ${err.message}`);
        return null;
      }
      console.warn(
        `WARN: list refresh failed (${err.message}); using cached copy ` +
          `from ${new Date(statSync(listCache).mtimeMs).toISOString()}`
      );
    }
  }
  return parseList(readFileSync(listCache, "utf8"));
}

async function checkShaiHulud() {
  if (skipped.has("shaihulud")) {
    console.warn("SKIP: Shai-Hulud cross-check");
    return;
  }
  const list = await loadList();
  if (!list) return; // failure already recorded
  const lockPath = path.join(repoRoot, "package-lock.json");
  if (!existsSync(lockPath)) return; // audit already failed on this
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const checked = new Set();
  const hits = new Set();
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    if (key === "") continue;
    const name = (
      key.replace(/^.*node_modules\//, "") ||
      entry.name ||
      ""
    ).toLowerCase();
    const version = entry.version ?? "";
    if (!name) continue;
    if (version) checked.add(`${name}@${version}`);
    const listed = list.get(name);
    if (listed && version && listed.has(version)) {
      hits.add(`${name}@${version} (listed as compromised at exactly this version)`);
    }
  }
  if (hits.size > 0) {
    for (const h of hits) fail(`compromised package in lockfile: ${h}`);
    return;
  }
  pass(
    `Shai-Hulud cross-check — ${checked.size} lockfile packages vs ` +
      `${list.size} compromised npm names: clean`
  );
}

// ---- check 3: gitleaks --------------------------------------------------

function gitleaksBinary() {
  for (const cand of ["gitleaks", "gitleaks.exe"]) {
    const probe = spawnSync(cand, ["version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (!probe.error) return cand;
  }
  return null;
}

/** Lines of .gitleaksignore (format: <file>:<rule>:<line>). */
function loadBaselines() {
  const p = path.join(repoRoot, ".gitleaksignore");
  if (!existsSync(p)) return new Set();
  return new Set(
    readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  );
}

const baselines = loadBaselines();

function findingKey(f) {
  const raw = (f.Fingerprint ?? "").replaceAll("\\", "/");
  if (raw) return raw.replace(/^\.security-cache\/scan\//, "");
  const file = (f.File ?? "").replaceAll("\\", "/");
  const line = f.StartLine ?? f.LineNumber ?? f.Line ?? "";
  return line ? `${file}:${f.RuleID ?? ""}:${line}` : `${file}:${f.RuleID ?? ""}`;
}

function reportFindings(findings) {
  const seen = new Set();
  const baselined = new Set();
  const live = [];
  for (const f of findings) {
    const k = findingKey(f);
    if (baselines.has(k)) {
      baselined.add(k);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    live.push(f);
  }
  for (const f of live) {
    const line = f.StartLine ?? f.LineNumber ?? f.Line ?? "";
    const loc = `${f.File ?? "?"}${line ? ":" + line : ""}`;
    fail(`gitleaks: ${loc} (${f.RuleID ?? "?"}) ${f.Description ?? ""}`);
  }
  if (baselined.size > 0) {
    console.log(
      `INFO: ${baselined.size} finding(s) baselined via .gitleaksignore`
    );
  }
  return live.length;
}

/**
 * Runs gitleaks (protect with extra args) and aggregates findings into
 * `allFindings`. Returns false when gitleaks itself errored.
 */
function runGitleaks(args, allFindings) {
  const bin = gitleaksBinary();
  if (!bin) {
    fail(
      "gitleaks is not installed (winget install gitleaks) and this " +
        "push touches config/env files"
    );
    return false;
  }
  const reportPath = path.join(
    tmpdir(),
    `prepush-gitleaks-${process.pid}-${Math.random().toString(36).slice(2)}.json`
  );
  const r = spawnSync(
    bin,
    [
      "protect",
      ...args,
      "--report-format",
      "json",
      "--report-path",
      reportPath,
      "--redact=100",
    ],
    { cwd: repoRoot, encoding: "utf8", windowsHide: true }
  );
  if (r.status !== 0 && r.status !== 1) {
    rmSync(reportPath, { force: true });
    fail(
      `gitleaks error (exit ${r.status}): ` +
        `${(r.stderr ?? r.stdout ?? "").trim().slice(0, 400)}`
    );
    return false;
  }
  try {
    allFindings.push(...JSON.parse(readFileSync(reportPath, "utf8") ?? "[]"));
  } catch {
    // treat unreadable report as an error only if gitleaks exited badly
  }
  rmSync(reportPath, { force: true });
  return true;
}

/** Scans untracked, non-ignored files (a gitleaks-dir blind spot). */
function scanUntracked(allFindings) {
  const files = untrackedFiles().filter(
    (f) => !f.startsWith(".security-cache/")
  );
  if (files.length === 0) return true;
  const bin = gitleaksBinary();
  if (!bin) {
    fail("gitleaks is not installed (winget install gitleaks)");
    return false;
  }
  rmSync(untrackedScanDir, { recursive: true, force: true });
  for (const f of files) {
    const dest = path.join(untrackedScanDir, f);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(path.join(repoRoot, f), dest);
  }
  const reportPath = path.join(
    tmpdir(),
    `prepush-gitleaks-untracked-${process.pid}-${Math.random().toString(36).slice(2)}.json`
  );
  const r = spawnSync(
    bin,
    [
      "dir",
      untrackedScanDir,
      "--report-format",
      "json",
      "--report-path",
      reportPath,
      "--redact=100",
    ],
    { cwd: repoRoot, encoding: "utf8", windowsHide: true }
  );
  rmSync(untrackedScanDir, { recursive: true, force: true });
  if (r.status !== 0 && r.status !== 1) {
    rmSync(reportPath, { force: true });
    fail(
      `gitleaks untracked-scan error (exit ${r.status}): ` +
        `${(r.stderr ?? r.stdout ?? "").trim().slice(0, 400)}`
    );
    return false;
  }
  try {
    allFindings.push(...JSON.parse(readFileSync(reportPath, "utf8") ?? "[]"));
  } catch {
    // unreadable report — gitleaks exit code already handled
  }
  rmSync(reportPath, { force: true });
  return true;
}

function checkGitleaks(refLines, envTouched) {
  if (skipped.has("gitleaks")) {
    console.warn("SKIP: gitleaks");
    return;
  }
  const manual = refLines.length === 0;
  if (!manual && !envTouched) {
    console.log(
      "SKIP: gitleaks — no config/env files in this push " +
        "(run the script manually for a full scan)"
    );
    return;
  }

  const allFindings = [];
  let ok = true;

  // Commits being pushed (hook) / not yet on the remote default (manual).
  const ranges = [];
  if (manual) {
    const head = remoteHead();
    if (head) ranges.push(`${head}...HEAD`);
    else console.warn("WARN: no origin/HEAD — skipping the commit-range scan");
  } else {
    for (const line of refLines) {
      const [, localSha, , remoteSha] = line.split(" ");
      if (!localSha) continue;
      if (remoteSha && remoteSha !== NULL_SHA) {
        ranges.push(`${remoteSha}..${localSha}`);
      } else {
        const head = remoteHead();
        if (head) ranges.push(`${head}...${localSha}`);
        else {
          console.warn(
            "WARN: new branch with no origin/HEAD — commit-range gitleaks scan skipped"
          );
        }
      }
    }
  }
  if (ranges.length > 0) {
    ok = runGitleaks(["--log-opts", ranges.join(" ")], allFindings) && ok;
  }

  // Uncommitted changes to tracked files (manual mode only: what you
  // are about to commit must be clean too).
  if (manual) {
    ok = runGitleaks([], allFindings) && ok;
    ok = scanUntracked(allFindings) && ok;
  }

  if (!ok) return; // an error was already reported
  if (allFindings.length > 0) {
    reportFindings(allFindings);
    return;
  }
  pass(
    `gitleaks — ${ranges.length > 0 ? "commit range(s) " : ""}${
      manual ? "+ uncommitted + untracked " : ""
    }clean`
  );
}

// ---- main ---------------------------------------------------------------

async function main() {
  let refLines = [];
  if (!process.stdin.isTTY) {
    try {
      refLines = readFileSync(0, "utf8")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
    } catch {
      refLines = [];
    }
  }
  const manual = refLines.length === 0;
  const changed = changedFiles(refLines);
  const envTouched = (changed ?? []).some(isConfigEnv);

  if (manual) {
    console.log("INFO: manual mode — full local check before a push");
  } else {
    console.log(
      `INFO: hook mode — ${(changed ?? []).length} changed file(s); gitleaks ` +
        (envTouched ? "required (config/env touched)" : "not required")
    );
  }

  checkAudit();
  await checkShaiHulud();
  checkGitleaks(refLines, envTouched);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed — push blocked.`);
    process.exit(1);
  }
  console.log("\nAll pre-push checks passed.");
}

main().catch((err) => {
  console.error(`FAIL: unexpected error: ${err.stack ?? err}`);
  process.exit(1);
});
