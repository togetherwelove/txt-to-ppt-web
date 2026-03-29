import { elements } from "./dom.js";
import { persistedAssetNames } from "./state.js";

export function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#b42318" : "";
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
