import { FONT_OPTIONS, STORAGE_KEYS } from "./config.js";
import { elements } from "./dom.js";
import { saveOutputSettings } from "./settings.js";
import { setStatus } from "./ui.js";

const INSTALLED_SUFFIX = " (\uC124\uCE58\uB428)";
const UNSUPPORTED_BROWSER_MESSAGE =
  "\uC774 \uBE0C\uB77C\uC6B0\uC800\uB294 \uC124\uCE58 \uD3F0\uD2B8 \uC77D\uAE30\uB97C \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
const LOAD_SUCCESS_PREFIX = "\uD55C\uAE00 \uC9C0\uC6D0 \uAE00\uAF34 ";
const LOAD_SUCCESS_SUFFIX = "\uAC1C\uB97C \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.";
const LOAD_ERROR_MESSAGE =
  "\uC124\uCE58 \uAE00\uAF34 \uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uAC70\uB098 \uBD88\uB7EC\uC624\uAE30\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";
const LOADING_MESSAGE = "\uD55C\uAE00 \uC9C0\uC6D0 \uAE00\uAF34\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...";
const KOREAN_SCRIPT_TAGS = new Set(["kore", "hang"]);
const META_TAGS = new Set(["dlng", "slng"]);

export function populateFontOptions() {
  elements.fontFace.innerHTML = "";
  FONT_OPTIONS.forEach((font) => {
    const option = document.createElement("option");
    option.value = font.value;
    option.textContent = font.label;
    elements.fontFace.append(option);
  });
}

export function upsertFontOption(value, label) {
  const existingOption = Array.from(elements.fontFace.options).find((option) => option.value === value);
  if (existingOption) {
    existingOption.textContent = label;
    return;
  }

  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  elements.fontFace.append(option);
}

export function getBodyFontFamily() {
  const computedFontFamily = getComputedStyle(document.body).fontFamily || "";
  const primaryFont = computedFontFamily.split(",")[0]?.replace(/^["']|["']$/g, "").trim();
  return primaryFont || "sans-serif";
}

export function ensureAvailableFontOption() {
  const selectedFont = String(elements.fontFace.value || "").replace(/^["']|["']$/g, "").trim();
  if (selectedFont) {
    if (!Array.from(elements.fontFace.options).some((option) => option.value === selectedFont)) {
      upsertFontOption(selectedFont, selectedFont);
    }
    elements.fontFace.value = selectedFont;
    return selectedFont;
  }

  const firstOption = elements.fontFace.options[0]?.value || "";
  if (firstOption) {
    elements.fontFace.value = firstOption;
  }
  return firstOption;
}

function saveCachedFontOptions(fontOptions) {
  try {
    localStorage.setItem(STORAGE_KEYS.cachedFontOptions, JSON.stringify(fontOptions));
  } catch (error) {
    console.warn("Failed to cache font options", error);
  }
}

export function restoreCachedFontOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cachedFontOptions);
    if (!raw) {
      return false;
    }

    const fontOptions = JSON.parse(raw);
    if (!Array.isArray(fontOptions) || !fontOptions.length) {
      return false;
    }

    fontOptions.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const family = String(entry.family || "").trim();
      const label = String(entry.label || family).trim();
      if (!family || !label) {
        return;
      }

      upsertFontOption(family, label);
    });

    return true;
  } catch (error) {
    console.warn("Failed to restore cached font options", error);
    return false;
  }
}

function setFontLoadingState(isLoading) {
  const button = elements.loadLocalFontsButton;
  if (!button) {
    return;
  }

  const glyph = button.querySelector(".icon-button-glyph");
  if (!glyph) {
    return;
  }

  if (!button.dataset.idleLabel) {
    button.dataset.idleLabel = glyph.textContent || "\uD83D\uDCE5";
  }

  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  button.setAttribute("aria-busy", isLoading ? "true" : "false");
  button.title = isLoading
    ? "\uAE00\uAF34 \uBD88\uB7EC\uC624\uB294 \uC911"
    : "\uC124\uCE58 \uD3F0\uD2B8 \uBD88\uB7EC\uC624\uAE30";
  glyph.textContent = isLoading ? "\u21BB" : button.dataset.idleLabel;
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function getSfntOffsets(view) {
  if (readTag(view, 0) === "ttcf") {
    const count = view.getUint32(8, false);
    const offsets = [];
    for (let index = 0; index < count; index += 1) {
      offsets.push(view.getUint32(12 + index * 4, false));
    }
    return offsets;
  }

  return [0];
}

function getTableOffset(view, sfntOffset, tableTag) {
  const numTables = view.getUint16(sfntOffset + 4, false);
  const tableDirOffset = sfntOffset + 12;

  for (let index = 0; index < numTables; index += 1) {
    const recordOffset = tableDirOffset + index * 16;
    if (readTag(view, recordOffset) === tableTag) {
      return view.getUint32(recordOffset + 8, false);
    }
  }

  return -1;
}

function normalizeLabel(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getDisplayLabel(entries, family) {
  const fullName = entries
    .map((entry) => normalizeLabel(entry.fullName))
    .find(Boolean);

  return fullName || family;
}

function parseScriptLangTags(rawValue) {
  return rawValue
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function hasKoreanScriptTag(tags) {
  return tags.some((tag) => tag.split("-").some((part) => KOREAN_SCRIPT_TAGS.has(part)));
}

function extractMetaScriptLangTags(view) {
  const collectedTags = [];
  const decoder = new TextDecoder("utf-8");

  getSfntOffsets(view).forEach((sfntOffset) => {
    const metaOffset = getTableOffset(view, sfntOffset, "meta");
    if (metaOffset < 0) {
      return;
    }

    const dataMapsCount = view.getUint32(metaOffset + 12, false);
    const dataMapsOffset = metaOffset + 16;

    for (let index = 0; index < dataMapsCount; index += 1) {
      const recordOffset = dataMapsOffset + index * 12;
      const tag = readTag(view, recordOffset).trim();
      if (!META_TAGS.has(tag)) {
        continue;
      }

      const dataOffset = metaOffset + view.getUint32(recordOffset + 4, false);
      const dataLength = view.getUint32(recordOffset + 8, false);
      const bytes = new Uint8Array(view.buffer, dataOffset, dataLength);
      const decoded = decoder.decode(bytes);
      collectedTags.push(...parseScriptLangTags(decoded));
    }
  });

  return collectedTags;
}

function hasBit(value, bitIndex) {
  return (value & (1 << bitIndex)) !== 0;
}

function extractOs2KoreanSupport(view) {
  return getSfntOffsets(view).some((sfntOffset) => {
    const os2Offset = getTableOffset(view, sfntOffset, "OS/2");
    if (os2Offset < 0) {
      return false;
    }

    const unicodeRange1 = view.getUint32(os2Offset + 42, false);
    const unicodeRange2 = view.getUint32(os2Offset + 46, false);
    const codePageRange1 = view.getUint32(os2Offset + 78, false);

    const hasHangulJamo = hasBit(unicodeRange1, 28);
    const hasHangulCompatibilityJamo = hasBit(unicodeRange2, 20);
    const hasHangulSyllables = hasBit(unicodeRange2, 24);
    const hasKoreanWansung = hasBit(codePageRange1, 19);
    const hasKoreanJohab = hasBit(codePageRange1, 21);

    return hasHangulJamo || hasHangulCompatibilityJamo || hasHangulSyllables || hasKoreanWansung || hasKoreanJohab;
  });
}

async function supportsKoreanMetadata(entries) {
  for (const entry of entries) {
    if (typeof entry.blob !== "function") {
      continue;
    }

    try {
      const blob = await entry.blob();
      const buffer = await blob.arrayBuffer();
      const view = new DataView(buffer);
      const metaTags = extractMetaScriptLangTags(view);

      if (hasKoreanScriptTag(metaTags)) {
        return true;
      }

      if (extractOs2KoreanSupport(view)) {
        return true;
      }
    } catch (error) {
      console.warn("Failed to inspect font metadata", error);
    }
  }

  return false;
}

export async function loadLocalFonts(silent = false) {
  setFontLoadingState(true);

  if (!("queryLocalFonts" in window)) {
    ensureAvailableFontOption();
    if (!silent) {
      setStatus(UNSUPPORTED_BROWSER_MESSAGE, true);
    }
    setFontLoadingState(false);
    return;
  }

  try {
    if (!silent) {
      setStatus(LOADING_MESSAGE);
    }

    const fontDataList = await window.queryLocalFonts();
    const fontGroups = new Map();

    fontDataList.forEach((fontData) => {
      const family = String(fontData.family || "").trim();
      if (!family) {
        return;
      }

      const existingGroup = fontGroups.get(family) || [];
      existingGroup.push(fontData);
      fontGroups.set(family, existingGroup);
    });

    const filteredFamilies = [];

    for (const [family, entries] of fontGroups.entries()) {
      if (!(await supportsKoreanMetadata(entries))) {
        continue;
      }

      filteredFamilies.push({
        family,
        label: getDisplayLabel(entries, family),
      });
    }

    filteredFamilies.sort((left, right) => left.label.localeCompare(right.label, "ko-KR"));

    const cachedFontOptions = filteredFamilies.map(({ family, label }) => ({
      family,
      label: `${label}${INSTALLED_SUFFIX}`,
    }));

    cachedFontOptions.forEach(({ family, label }) => {
      upsertFontOption(family, label);
    });

    saveCachedFontOptions(cachedFontOptions);

    ensureAvailableFontOption();

    if (!silent) {
      saveOutputSettings();
      setStatus(`${LOAD_SUCCESS_PREFIX}${filteredFamilies.length}${LOAD_SUCCESS_SUFFIX}`);
    }
  } catch (error) {
    console.error(error);
    ensureAvailableFontOption();
    if (!silent) {
      setStatus(LOAD_ERROR_MESSAGE, true);
    }
  } finally {
    setFontLoadingState(false);
  }
}

export function getSelectedFontFace() {
  return (elements.fontFace.value || getBodyFontFamily()).replace(/^["']|["']$/g, "").trim() || getBodyFontFamily();
}
