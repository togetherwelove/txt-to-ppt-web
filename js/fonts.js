import { ASSET_KEYS, FONT_OPTIONS } from "./config.js";
import { elements } from "./dom.js";
import { saveOutputSettings } from "./settings.js";
import { loadAsset, persistAssetSafely } from "./storage.js";
import { state } from "./state.js";
import { setStatus } from "./ui.js";

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

export function ensureFontFaceOption(value, label = value) {
  const normalizedValue = String(value || "").replace(/^["']|["']$/g, "").trim();
  if (!normalizedValue) {
    return "";
  }

  upsertFontOption(normalizedValue, label);
  return normalizedValue;
}

export function ensureAvailableFontOption() {
  const selectedFont = String(elements.fontFace.value || "").replace(/^["']|["']$/g, "").trim();
  if (selectedFont) {
    ensureFontFaceOption(selectedFont, elements.fontFace.selectedOptions[0]?.textContent || selectedFont);
    elements.fontFace.value = selectedFont;
    return selectedFont;
  }

  const fallbackFont = ensureFontFaceOption(getBodyFontFamily());
  if (fallbackFont) {
    elements.fontFace.value = fallbackFont;
  }
  return fallbackFont;
}

function clearCachedLocalFontFace() {
  if (state.cachedLocalFontUrl) {
    URL.revokeObjectURL(state.cachedLocalFontUrl);
    state.cachedLocalFontUrl = "";
  }
}

export function registerCachedLocalFont(fontName, blob, shouldSelect = false) {
  clearCachedLocalFontFace();
  state.cachedLocalFontUrl = URL.createObjectURL(blob);

  let styleTag = document.querySelector("#cachedLocalFontStyle");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "cachedLocalFontStyle";
    document.head.append(styleTag);
  }

  styleTag.textContent = `@font-face {
  font-family: "${fontName}";
  src: url("${state.cachedLocalFontUrl}");
  font-display: swap;
}`;

  upsertFontOption(fontName, `${fontName} (저장됨)`);
  if (shouldSelect) {
    elements.fontFace.value = fontName;
  }
}

export async function restoreSavedLocalFont() {
  try {
    const savedLocalFont = await loadAsset(ASSET_KEYS.localFont);
    if (savedLocalFont?.name && savedLocalFont.blob instanceof Blob) {
      registerCachedLocalFont(savedLocalFont.name, savedLocalFont.blob, false);
    }
  } catch (error) {
    console.warn("Failed to restore cached local font", error);
  }
}

export async function persistSelectedLocalFont(fontName) {
  const matchingFont = state.cachedLocalFonts.find((fontData) => fontData.family === fontName);
  if (!matchingFont || typeof matchingFont.blob !== "function") {
    return;
  }

  try {
    const blob = await matchingFont.blob();
    await persistAssetSafely(ASSET_KEYS.localFont, { name: fontName, blob });
    registerCachedLocalFont(fontName, blob, false);
  } catch (error) {
    console.warn("Failed to persist selected local font", error);
  }
}

export async function loadLocalFonts(silent = false) {
  if (!("queryLocalFonts" in window)) {
    ensureAvailableFontOption();
    if (!silent) {
      setStatus("이 브라우저는 설치 폰트 읽기를 지원하지 않습니다.", true);
    }
    return;
  }

  try {
    const fontDataList = await window.queryLocalFonts();
    state.cachedLocalFonts = fontDataList;

    const uniqueFamilies = [...new Set(fontDataList.map((fontData) => fontData.family).filter(Boolean))]
      .filter((family) => document.fonts.check(`16px "${family}"`, "가나다라마바사아자차카타파하"))
      .sort((left, right) => left.localeCompare(right, "ko-KR"));

    uniqueFamilies.forEach((family) => {
      upsertFontOption(family, `${family} (설치됨)`);
    });

    ensureAvailableFontOption();
    saveOutputSettings();

    if (!silent) {
      setStatus(`설치 폰트 ${uniqueFamilies.length}개를 불러왔습니다.`);
    }
  } catch (error) {
    console.error(error);
    ensureAvailableFontOption();
    if (!silent) {
      setStatus("설치 폰트 접근 권한이 없거나 불러오기에 실패했습니다.", true);
    }
  }
}

export function getSelectedFontFace() {
  return (elements.fontFace.value || getBodyFontFamily()).replace(/^["']|["']$/g, "").trim() || getBodyFontFamily();
}
