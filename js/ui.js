import { elements } from "./dom.js";
import { persistedAssetNames } from "./state.js";

const STATUS_HIDE_DELAY_MS = 2200;
const STATUS_REMOVE_DELAY_MS = 180;

export function setStatus(message, isError = false) {
  if (!elements.statusMessage) {
    return;
  }

  elements.statusMessage.hidden = false;
  const toastItem = document.createElement("div");
  toastItem.className = "status-toast-item";
  toastItem.textContent = message;

  if (isError) {
    toastItem.classList.add("is-error");
  }

  elements.statusMessage.append(toastItem);

  window.requestAnimationFrame(() => {
    toastItem.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toastItem.classList.remove("is-visible");
    window.setTimeout(() => {
      toastItem.remove();
      if (!elements.statusMessage.childElementCount) {
        elements.statusMessage.hidden = true;
      }
    }, STATUS_REMOVE_DELAY_MS);
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
