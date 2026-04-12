import { elements } from "./dom.js";
import { persistedAssetNames } from "./state.js";

const STATUS_HIDE_DELAY_MS = 2200;

let statusHideTimeoutId = 0;

export function setStatus(message, isError = false) {
  if (!elements.statusMessage) {
    return;
  }

  if (statusHideTimeoutId) {
    window.clearTimeout(statusHideTimeoutId);
  }

  elements.statusMessage.textContent = message;
  elements.statusMessage.hidden = false;
  elements.statusMessage.classList.toggle("is-error", isError);
  elements.statusMessage.classList.add("is-visible");

  statusHideTimeoutId = window.setTimeout(() => {
    elements.statusMessage.classList.remove("is-visible");
    statusHideTimeoutId = 0;
  }, STATUS_HIDE_DELAY_MS);
}

export function getFileDisplayName(inputFile, persistedName) {
  return inputFile?.name || persistedName || "선택된 파일 없음";
}

export function updateFileLabels() {
  elements.textFileName.textContent = getFileDisplayName(elements.textFile.files?.[0], persistedAssetNames.textFile);
  elements.backgroundFileName.textContent = getFileDisplayName(
    elements.backgroundFile.files?.[0],
    persistedAssetNames.backgroundFile
  );
}

export function updateColorPreview() {
  const textColor = elements.textColor.value.toUpperCase();
  const backgroundColor = elements.backgroundColor.value.toUpperCase();

  elements.textColorSwatch.style.backgroundColor = textColor;
  elements.textColorValue.textContent = textColor;
  elements.backgroundColorSwatch.style.backgroundColor = backgroundColor;
  elements.backgroundColorValue.textContent = backgroundColor;
}
