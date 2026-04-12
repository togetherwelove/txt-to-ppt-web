import { STORAGE_KEYS } from "./config.js";
import { elements } from "./dom.js";
import { alignmentState } from "./state.js";

const DEFAULT_FILE_NAME = "generated-slides";
const DATE_FILE_NAME_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeFileName(fileName) {
  const trimmed = (fileName || "").trim().replace(/\.pptx$/i, "");
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-") || DEFAULT_FILE_NAME;
}

export function getTodayTitle() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\.\s?/g, "-").replace(/-$/, "");
}

export function ensureDefaultFileName() {
  const currentValue = (elements.fileName.value || "").trim();
  const todayTitle = getTodayTitle();
  if (!currentValue || currentValue === DEFAULT_FILE_NAME) {
    elements.fileName.value = todayTitle;
    return;
  }

  if (DATE_FILE_NAME_PATTERN.test(currentValue) && currentValue < todayTitle) {
    elements.fileName.value = todayTitle;
  }
}

export function getOutputBaseName() {
  const candidate = sanitizeFileName(elements.fileName.value || getTodayTitle());
  return candidate || sanitizeFileName(getTodayTitle());
}

export function getOutputSettings() {
  return {
    fileName: elements.fileName.value || "",
    layout: elements.layout.value || "LAYOUT_WIDE",
    fontFace: elements.fontFace.value || "",
    fontSize: String(elements.fontSize.value || "42"),
    textColor: elements.textColor.value || "#ffffff",
    backgroundColor: elements.backgroundColor.value || "#000000",
    padding: String(elements.padding.value || "20"),
    alignmentVertical: alignmentState.vertical,
  };
}

export function saveOutputSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.outputSettings, JSON.stringify(getOutputSettings()));
  } catch (error) {
    console.warn("Failed to save output settings", error);
  }
}

export function restoreOutputSettings() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.outputSettings);
    if (!savedSettings) {
      return false;
    }

    const settings = JSON.parse(savedSettings);
    if (!settings || typeof settings !== "object") {
      return false;
    }

    if (typeof settings.fileName === "string") {
      elements.fileName.value = settings.fileName;
    }
    if (typeof settings.layout === "string" && settings.layout) {
      elements.layout.value = settings.layout;
    }
    if (typeof settings.fontFace === "string" && settings.fontFace) {
      elements.fontFace.value = settings.fontFace;
    }
    if (typeof settings.fontSize === "string" && settings.fontSize) {
      elements.fontSize.value = settings.fontSize;
    }
    if (typeof settings.textColor === "string" && settings.textColor) {
      elements.textColor.value = settings.textColor;
    }
    if (typeof settings.backgroundColor === "string" && settings.backgroundColor) {
      elements.backgroundColor.value = settings.backgroundColor;
    }
    if (typeof settings.padding === "string" && settings.padding) {
      elements.padding.value = settings.padding;
    }
    if (["top", "mid", "bottom"].includes(settings.alignmentVertical)) {
      alignmentState.vertical = settings.alignmentVertical;
    }

    return true;
  } catch (error) {
    console.warn("Failed to restore output settings", error);
    return false;
  }
}
