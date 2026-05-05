import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const packageNames = [
  "@harness/core",
  "@harness/adapter-codex",
  "@harness/adapter-claude",
  "@harness/adapter-hermes",
  "@harness/cli",
  "@harness/mcp-server",
];

export const essentialPackedFiles = ["package.json", "dist/index.js", "dist/index.d.ts"];
export const packageFilesAllowlist = ["dist"];
export const nodeEngineRange = ">=20";

export function packageDirectory(packageName) {
  return path.join(repoRoot, "packages", packageName.replace("@harness/", ""));
}

export function isCanonicalPackageName(name) {
  return packageNames.includes(name);
}

export function isHarnessScopePackageName(name) {
  return name.startsWith("@harness/");
}

export const isInternalPackageName = isCanonicalPackageName;

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readPackage(packageName) {
  return readJsonFile(path.join(packageDirectory(packageName), "package.json"));
}

export async function readRootPackage() {
  return readJsonFile(path.join(repoRoot, "package.json"));
}

export async function listTarballEntries(tarballPath) {
  return parseTarball(await readFile(tarballPath)).map((entry) => entry.name);
}

export async function readTarballJson(tarballPath, entryName) {
  const entry = parseTarball(await readFile(tarballPath)).find((item) => item.name === entryName);

  if (!entry) {
    throw new Error(`Tarball ${tarballPath} is missing ${entryName}`);
  }

  return JSON.parse(entry.content.toString("utf8"));
}

function parseTarball(content) {
  const tar = gunzipSync(content);
  const entries = [];
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const sizeText = readTarString(header, 124, 12).trim();
    const size = sizeText.length === 0 ? 0 : Number.parseInt(sizeText, 8);
    const fullName = prefix.length > 0 ? `${prefix}/${name}` : name;
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;

    entries.push({
      name: fullName,
      content: tar.subarray(contentStart, contentEnd),
    });

    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function readTarString(buffer, offset, length) {
  const raw = buffer.subarray(offset, offset + length);
  const nul = raw.indexOf(0);
  const text = (nul === -1 ? raw : raw.subarray(0, nul)).toString("utf8");

  return text.trim();
}
