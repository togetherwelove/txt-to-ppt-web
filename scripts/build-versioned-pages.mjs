import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST_DIR = path.join(ROOT, "dist");
const posixPath = path.posix;
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css"]);
const IGNORED_NAMES = new Set([".git", ".github", "dist", "scripts"]);

const sourceFiles = new Map();
const renderedBuffers = new Map();
const versionHashes = new Map();
const renderStack = new Set();

async function walk(currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath);
      continue;
    }

    const relativePath = posixPath.join(...path.relative(ROOT, absolutePath).split(path.sep));
    const buffer = await readFile(absolutePath);

    sourceFiles.set(relativePath, {
      absolutePath,
      extension: path.extname(entry.name).toLowerCase(),
      buffer,
    });
  }
}

function isExternalUrl(url) {
  return /^(?:[a-z][a-z\d+\-.]*:|\/\/|#)/i.test(url);
}

function splitUrlParts(url) {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  return { pathname, query, hash };
}

function resolveTargetPath(fromFile, url) {
  if (!url || isExternalUrl(url)) {
    return "";
  }

  const { pathname } = splitUrlParts(url);
  if (!pathname) {
    return "";
  }

  const resolved = pathname.startsWith("/")
    ? pathname.slice(1)
    : posixPath.normalize(posixPath.join(posixPath.dirname(fromFile), pathname));

  if (!resolved || resolved.startsWith("../")) {
    return "";
  }

  return sourceFiles.has(resolved) ? resolved : "";
}

function appendHashQuery(url, hash) {
  const { pathname, query, hash: fragment } = splitUrlParts(url);
  const params = new URLSearchParams(query);
  params.set("v", hash);
  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}${fragment}`;
}

async function replaceAsync(input, pattern, replacer) {
  const matches = [...input.matchAll(pattern)];
  if (!matches.length) {
    return input;
  }

  const replacements = await Promise.all(matches.map((match) => replacer(...match)));
  let result = "";
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const matchIndex = match.index ?? 0;
    result += input.slice(lastIndex, matchIndex);
    result += replacements[index];
    lastIndex = matchIndex + match[0].length;
  });

  result += input.slice(lastIndex);
  return result;
}

async function versionUrl(url, fromFile) {
  const targetPath = resolveTargetPath(fromFile, url);
  if (!targetPath) {
    return url;
  }

  const hash = await getVersionHash(targetPath);
  return appendHashQuery(url, hash);
}

async function rewriteHtml(content, fromFile) {
  return replaceAsync(content, /\b(?:src|href)=(["'])([^"']+)\1/g, async (match, quote, url) => {
    const versionedUrl = await versionUrl(url, fromFile);
    return match.replace(url, versionedUrl);
  });
}

async function rewriteJavaScript(content, fromFile) {
  let nextContent = content;

  nextContent = await replaceAsync(nextContent, /\bfrom\s*(["'])([^"']+)\1/g, async (match, quote, url) => {
    const versionedUrl = await versionUrl(url, fromFile);
    return match.replace(url, versionedUrl);
  });

  nextContent = await replaceAsync(nextContent, /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g, async (match, quote, url) => {
    const versionedUrl = await versionUrl(url, fromFile);
    return match.replace(url, versionedUrl);
  });

  nextContent = await replaceAsync(nextContent, /\bimport\s*(["'])([^"']+)\1/g, async (match, quote, url) => {
    const versionedUrl = await versionUrl(url, fromFile);
    return match.replace(url, versionedUrl);
  });

  return nextContent;
}

async function rewriteCss(content, fromFile) {
  return replaceAsync(content, /url\(\s*(["']?)([^)"']+)\1\s*\)/g, async (match, quote, url) => {
    const versionedUrl = await versionUrl(url, fromFile);
    return match.replace(url, versionedUrl);
  });
}

async function renderFile(relativePath) {
  if (renderedBuffers.has(relativePath)) {
    return renderedBuffers.get(relativePath);
  }

  const source = sourceFiles.get(relativePath);
  if (!source) {
    throw new Error(`Missing source file: ${relativePath}`);
  }

  if (!TEXT_EXTENSIONS.has(source.extension)) {
    renderedBuffers.set(relativePath, source.buffer);
    return source.buffer;
  }

  if (renderStack.has(relativePath)) {
    return source.buffer;
  }

  renderStack.add(relativePath);

  let text = source.buffer.toString("utf8");
  if (source.extension === ".html") {
    text = await rewriteHtml(text, relativePath);
  } else if (source.extension === ".js") {
    text = await rewriteJavaScript(text, relativePath);
  } else if (source.extension === ".css") {
    text = await rewriteCss(text, relativePath);
  }

  renderStack.delete(relativePath);

  const rendered = Buffer.from(text, "utf8");
  renderedBuffers.set(relativePath, rendered);
  return rendered;
}

async function getVersionHash(relativePath) {
  if (versionHashes.has(relativePath)) {
    return versionHashes.get(relativePath);
  }

  const rendered = await renderFile(relativePath);
  const hash = createHash("sha256").update(rendered).digest("hex");
  versionHashes.set(relativePath, hash);
  return hash;
}

async function writeDist() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  for (const [relativePath, source] of sourceFiles.entries()) {
    const outputPath = path.join(DIST_DIR, ...relativePath.split("/"));
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (TEXT_EXTENSIONS.has(source.extension)) {
      const rendered = await renderFile(relativePath);
      await writeFile(outputPath, rendered);
    } else {
      await copyFile(source.absolutePath, outputPath);
    }
  }
}

await walk(ROOT);
await writeDist();
