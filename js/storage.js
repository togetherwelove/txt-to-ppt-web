import { STORAGE_KEYS } from "./config.js";
import { elements } from "./dom.js";

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function saveSourceText() {
  try {
    localStorage.setItem(STORAGE_KEYS.sourceText, elements.sourceText.value || "");
  } catch (error) {
    console.warn("Failed to save source text", error);
  }
}

export function restoreSourceText() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEYS.sourceText);
    if (!savedText) {
      return false;
    }

    elements.sourceText.value = savedText;
    return true;
  } catch (error) {
    console.warn("Failed to restore source text", error);
    return false;
  }
}
