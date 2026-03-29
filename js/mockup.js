import { elements } from "./dom.js";
import { getSelectedFontFace } from "./fonts.js";
import { saveOutputSettings } from "./settings.js";
import { alignmentState, state } from "./state.js";
import { getCurrentPageSize, getMockupSlideText, getPaddingValues, paddingPointsToInches, updatePaddingOutputs } from "./slides.js";
import { updateColorPreview } from "./ui.js";

export function applyTextPosition() {
  alignmentState.horizontal = "center";
  elements.slideSafeZone.style.justifyContent = "center";
  elements.slideSafeZone.style.alignItems =
    alignmentState.vertical === "top" ? "flex-start" : alignmentState.vertical === "bottom" ? "flex-end" : "center";
}

export function setAlignmentFromPointer(clientX, clientY) {
  const rect = elements.slideSafeZone.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const relativeY = (clientY - rect.top) / rect.height;
  alignmentState.horizontal = "center";
  alignmentState.vertical = relativeY < 1 / 3 ? "top" : relativeY > 2 / 3 ? "bottom" : "mid";

  applyTextPosition();
  saveOutputSettings();
}

export function updateMockup(slides) {
  const previewText = getMockupSlideText(slides);
  const fontSize = Number(elements.fontSize.value) || 28;
  const aspectRatio = elements.layout.value === "LAYOUT_STANDARD" ? "4 / 3" : "16 / 9";
  const paddings = getPaddingValues();

  elements.fontSizeValue.textContent = `${fontSize}px`;
  updatePaddingOutputs(paddings);
  updateColorPreview();
  elements.slideMockup.style.aspectRatio = aspectRatio;
  elements.slideMockup.style.backgroundColor = elements.backgroundColor.value;
  elements.slideMockupText.style.fontFamily = getSelectedFontFace();
  elements.slideMockupText.style.color = elements.textColor.value;
  elements.slideMockupText.style.textAlign = "center";
  elements.slideMockupText.textContent = previewText || "텍스트를 입력하면 여기에 표시됩니다";

  if (state.backgroundImageDataUrl) {
    elements.slideMockup.classList.add("has-image");
    elements.slideMockup.style.backgroundImage =
      `linear-gradient(rgba(10, 12, 18, 0.28), rgba(10, 12, 18, 0.28)), url("${state.backgroundImageDataUrl}")`;
  } else {
    elements.slideMockup.classList.remove("has-image");
    elements.slideMockup.style.backgroundImage = "none";
  }

  requestAnimationFrame(() => {
    const pageSize = getCurrentPageSize();
    const mockupRect = elements.slideMockup.getBoundingClientRect();
    const pixelsPerInch = mockupRect.height / pageSize.height;
    const paddingInches = paddingPointsToInches(paddings);
    const previewFontSizePx = Math.max(10, (fontSize / 72) * pixelsPerInch);
    const previewPadding = {
      top: paddingInches.top * pixelsPerInch,
      right: paddingInches.right * pixelsPerInch,
      bottom: paddingInches.bottom * pixelsPerInch,
      left: paddingInches.left * pixelsPerInch,
    };

    elements.slideSafeZone.style.top = `${previewPadding.top}px`;
    elements.slideSafeZone.style.right = `${previewPadding.right}px`;
    elements.slideSafeZone.style.bottom = `${previewPadding.bottom}px`;
    elements.slideSafeZone.style.left = `${previewPadding.left}px`;
    elements.slideMockupText.style.fontSize = `${previewFontSizePx}px`;
    elements.slideMockupText.style.padding = "0";

    applyTextPosition();
  });
}
