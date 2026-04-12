import { elements } from "./dom.js";
import { downloadPresentation, downloadSourceText } from "./exports.js";
import { loadBackgroundImage, loadUploadedText } from "./files.js";
import { ensureAvailableFontOption, loadLocalFonts, populateFontOptions, restoreCachedFontOptions, upsertFontOption } from "./fonts.js";
import { applyTextPosition, setAlignmentFromPointer, updateMockup } from "./mockup.js";
import { ensureDefaultFileName, restoreOutputSettings, saveOutputSettings } from "./settings.js";
import { getSlidesFromInput, parseSlides } from "./slides.js";
import { saveSourceText, restoreSourceText } from "./storage.js";
import { state } from "./state.js";
import { setStatus, updateFileLabels } from "./ui.js";

let activeTooltipButton = null;
let isTooltipPinned = false;
let mockupResizeFrameId = 0;
let mockupResizeObserver = null;

const STARTUP_FONT_LOADING_TIMEOUT_MS = 2400;

function setStartupLoadingVisible(isVisible) {
  if (!elements.startupLoading) {
    return;
  }

  elements.startupLoading.hidden = !isVisible;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildSlidesFromInput(shouldNotify = true) {
  const rawText = elements.sourceText.value;
  if (!rawText.trim()) {
    if (shouldNotify) {
      setStatus("텍스트 내용을 먼저 입력해 주세요.", true);
    }
    state.currentSlides = [];
    updateMockup([]);
    return [];
  }

  const slides = parseSlides(rawText);
  state.currentSlides = slides;
  updateMockup(slides);
  if (shouldNotify) {
    setStatus(`${slides.length}개의 슬라이드를 준비했습니다.`);
  }
  return slides;
}

function positionFloatingTooltip(button) {
  const tooltip = elements.floatingTooltip;
  if (!button || !tooltip) {
    return;
  }

  const viewportPadding = 12;
  const gap = 12;
  const rect = button.getBoundingClientRect();

  tooltip.style.left = "0px";
  tooltip.style.top = "0px";

  const tooltipRect = tooltip.getBoundingClientRect();
  const showAbove = rect.bottom + gap + tooltipRect.height > window.innerHeight - viewportPadding
    && rect.top - gap - tooltipRect.height >= viewportPadding;
  const top = showAbove
    ? rect.top - gap - tooltipRect.height
    : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - tooltipRect.height);

  const centeredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
  const maxLeft = window.innerWidth - viewportPadding - tooltipRect.width;
  const left = Math.min(Math.max(viewportPadding, centeredLeft), Math.max(viewportPadding, maxLeft));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(viewportPadding, top)}px`;
}

function showFloatingTooltip(button, pinned = false) {
  const tooltip = elements.floatingTooltip;
  const content = button?.querySelector(".tooltip-content");
  if (!tooltip || !content) {
    return;
  }

  if (activeTooltipButton && activeTooltipButton !== button) {
    hideFloatingTooltip(activeTooltipButton);
  }

  activeTooltipButton = button;
  isTooltipPinned = pinned;
  button.setAttribute("aria-expanded", "true");
  tooltip.innerHTML = content.innerHTML;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  positionFloatingTooltip(button);
}

function hideFloatingTooltip(button = activeTooltipButton) {
  if (!button || button !== activeTooltipButton) {
    return;
  }

  const tooltip = elements.floatingTooltip;
  button.setAttribute("aria-expanded", "false");
  isTooltipPinned = false;
  activeTooltipButton = null;
  if (!tooltip) {
    return;
  }

  tooltip.classList.remove("is-visible");
  tooltip.hidden = true;
  tooltip.innerHTML = "";
}

function bindTooltips() {
  const tooltipButtons = document.querySelectorAll(".info-tooltip");

  tooltipButtons.forEach((button) => {
    button.setAttribute("aria-expanded", "false");

    button.addEventListener("mouseenter", () => {
      if (!isTooltipPinned) {
        showFloatingTooltip(button);
      }
    });

    button.addEventListener("mouseleave", () => {
      if (!isTooltipPinned) {
        hideFloatingTooltip(button);
      }
    });

    button.addEventListener("focusin", () => {
      showFloatingTooltip(button, isTooltipPinned && activeTooltipButton === button);
    });

    button.addEventListener("focusout", (event) => {
      if (isTooltipPinned && activeTooltipButton === button) {
        return;
      }
      if (button.contains(event.relatedTarget)) {
        return;
      }
      hideFloatingTooltip(button);
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (activeTooltipButton === button && isTooltipPinned) {
        hideFloatingTooltip(button);
        return;
      }

      showFloatingTooltip(button, true);
      button.focus();
    });
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node) || !activeTooltipButton) {
      return;
    }

    if (activeTooltipButton.contains(target) || elements.floatingTooltip?.contains(target)) {
      return;
    }

    hideFloatingTooltip(activeTooltipButton);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activeTooltipButton) {
      return;
    }

    const button = activeTooltipButton;
    hideFloatingTooltip(button);
    button.focus();
  });

  window.addEventListener("scroll", () => {
    if (activeTooltipButton) {
      positionFloatingTooltip(activeTooltipButton);
    }
  }, true);

  window.addEventListener("resize", () => {
    if (activeTooltipButton) {
      positionFloatingTooltip(activeTooltipButton);
    }
  });
}

function bindEvents() {
  elements.textFile.addEventListener("change", () => {
    void loadUploadedText(buildSlidesFromInput);
  });

  elements.backgroundFile.addEventListener("change", () => {
    void loadBackgroundImage();
  });

  elements.downloadTextButton.addEventListener("click", downloadSourceText);
  elements.downloadButton.addEventListener("click", () => {
    void downloadPresentation(buildSlidesFromInput);
  });

  elements.sourceText.addEventListener("input", () => {
    saveSourceText();
    buildSlidesFromInput(false);
  });

  elements.fileName.addEventListener("input", saveOutputSettings);

  elements.loadLocalFontsButton.addEventListener("click", () => {
    void loadLocalFonts();
  });

  elements.fontFace.addEventListener("change", () => {
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

function bindMockupResizeObserver() {
  if (!elements.slideMockup || !("ResizeObserver" in window)) {
    return;
  }

  mockupResizeObserver = new ResizeObserver(() => {
    if (mockupResizeFrameId) {
      window.cancelAnimationFrame(mockupResizeFrameId);
    }

    mockupResizeFrameId = window.requestAnimationFrame(() => {
      mockupResizeFrameId = 0;
      updateMockup(state.currentSlides.length ? state.currentSlides : getSlidesFromInput());
    });
  });

  mockupResizeObserver.observe(elements.slideMockup);
}

async function initializeApp() {
  populateFontOptions();
  const restoredSourceText = restoreSourceText();
  const restoredCachedFonts = restoreCachedFontOptions();
  const shouldLoadFontsOnStartup = !restoredCachedFonts;

  if (shouldLoadFontsOnStartup) {
    setStartupLoadingVisible(true);
  }

  try {
    if (shouldLoadFontsOnStartup) {
      await Promise.race([
        loadLocalFonts(true, false),
        wait(STARTUP_FONT_LOADING_TIMEOUT_MS),
      ]);
    }
    restoreOutputSettings();

    if (elements.fontFace.value && !Array.from(elements.fontFace.options).some((option) => option.value === elements.fontFace.value)) {
      upsertFontOption(elements.fontFace.value, elements.fontFace.value);
    }

    ensureAvailableFontOption();
    ensureDefaultFileName();
    saveOutputSettings();
    updateFileLabels();

    if (restoredSourceText || elements.sourceText.value.trim()) {
      buildSlidesFromInput(false);
    } else {
      state.currentSlides = [];
      updateMockup([]);
    }
  } finally {
    setStartupLoadingVisible(false);
  }
}

bindTooltips();
bindEvents();
bindMockupResizeObserver();
void initializeApp();
