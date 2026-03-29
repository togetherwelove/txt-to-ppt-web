import { sampleText } from "./config.js";
import { elements } from "./dom.js";
import { downloadPresentation, downloadSourceText } from "./exports.js";
import { loadBackgroundImage, loadUploadedText, restoreUploadedAssets } from "./files.js";
import {
  ensureAvailableFontOption,
  loadLocalFonts,
  persistSelectedLocalFont,
  populateFontOptions,
  restoreSavedLocalFont,
  upsertFontOption,
} from "./fonts.js";
import { applyTextPosition, setAlignmentFromPointer, updateMockup } from "./mockup.js";
import { ensureDefaultFileName, restoreOutputSettings, saveOutputSettings } from "./settings.js";
import { getSlidesFromInput, parseSlides } from "./slides.js";
import { saveSourceText, restoreSourceText } from "./storage.js";
import { state } from "./state.js";
import { setStatus, updateFileLabels } from "./ui.js";

function buildSlidesFromInput() {
  const rawText = elements.sourceText.value;
  if (!rawText.trim()) {
    setStatus("텍스트 내용을 먼저 입력해 주세요.", true);
    state.currentSlides = [];
    updateMockup([]);
    return [];
  }

  const slides = parseSlides(rawText);
  state.currentSlides = slides;
  updateMockup(slides);
  setStatus(`${slides.length}개의 슬라이드를 준비했습니다.`);
  return slides;
}

function bindEvents() {
  elements.textFile.addEventListener("change", () => {
    void loadUploadedText(buildSlidesFromInput);
  });

  elements.backgroundFile.addEventListener("change", () => {
    void loadBackgroundImage();
  });

  elements.loadSampleButton.addEventListener("click", () => {
    if (elements.sourceText.value.trim()) {
      const shouldOverwrite = window.confirm("이미 작성된 텍스트가 있습니다. 샘플로 덮어쓸까요?");
      if (!shouldOverwrite) {
        return;
      }
    }

    elements.sourceText.value = sampleText;
    saveSourceText();
    ensureAvailableFontOption();
    ensureDefaultFileName();
    buildSlidesFromInput();
  });

  elements.downloadTextButton.addEventListener("click", downloadSourceText);
  elements.downloadButton.addEventListener("click", () => {
    void downloadPresentation(buildSlidesFromInput);
  });

  elements.sourceText.addEventListener("input", () => {
    saveSourceText();
    buildSlidesFromInput();
  });

  elements.fileName.addEventListener("input", saveOutputSettings);

  elements.loadLocalFontsButton.addEventListener("click", () => {
    void loadLocalFonts();
  });

  elements.fontFace.addEventListener("change", () => {
    void persistSelectedLocalFont(elements.fontFace.value);
    saveOutputSettings();
    updateMockup(state.currentSlides);
  });

  ["fontSize", "textColor", "backgroundColor", "padding"].forEach((key) => {
    elements[key].addEventListener("input", () => {
      saveOutputSettings();
      updateMockup(state.currentSlides);
    });
  });

  elements.layout.addEventListener("change", () => {
    saveOutputSettings();
    updateMockup(state.currentSlides);
  });

  elements.slideMockupText.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    elements.slideMockupText.classList.add("dragging");
    setAlignmentFromPointer(event.clientX, event.clientY);
    elements.slideMockupText.setPointerCapture(event.pointerId);
  });

  elements.slideMockupText.addEventListener("pointermove", (event) => {
    if (!elements.slideMockupText.classList.contains("dragging")) {
      return;
    }
    setAlignmentFromPointer(event.clientX, event.clientY);
  });

  ["pointerup", "pointercancel"].forEach((eventName) => {
    elements.slideMockupText.addEventListener(eventName, (event) => {
      if (elements.slideMockupText.hasPointerCapture(event.pointerId)) {
        elements.slideMockupText.releasePointerCapture(event.pointerId);
      }
      elements.slideMockupText.classList.remove("dragging");
      applyTextPosition();
    });
  });

  window.addEventListener("resize", () => {
    updateMockup(state.currentSlides.length ? state.currentSlides : getSlidesFromInput());
  });
}

async function initializeApp() {
  populateFontOptions();
  await restoreUploadedAssets();
  await restoreSavedLocalFont();
  await loadLocalFonts(true);
  restoreOutputSettings();

  if (elements.fontFace.value && !Array.from(elements.fontFace.options).some((option) => option.value === elements.fontFace.value)) {
    upsertFontOption(elements.fontFace.value, `${elements.fontFace.value} (저장됨)`);
  }

  ensureAvailableFontOption();
  ensureDefaultFileName();
  saveOutputSettings();

  const restoredSourceText = restoreSourceText();
  updateFileLabels();

  if (restoredSourceText || elements.sourceText.value.trim()) {
    buildSlidesFromInput();
  } else {
    state.currentSlides = [];
    updateMockup([]);
  }
}

bindEvents();
void initializeApp();
