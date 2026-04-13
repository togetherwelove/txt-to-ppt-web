import { elements } from "./dom.js";
import { getSelectedFontFace } from "./fonts.js";
import { saveOutputSettings } from "./settings.js";
import { alignmentState, state } from "./state.js";
import { getCurrentPageSize, getMockupSlideText, getPaddingValues, paddingPointsToInches, updatePaddingOutputs } from "./slides.js";
import { updateColorPreview } from "./ui.js";

const EMPTY_PREVIEW_TEXT = "텍스트를 입력하면 여기에 표시됩니다";

export function applyTextPosition() {
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
  const isEmptyPreview = !previewText;
  const fontSize = Number(elements.fontSize.value) || 28;
  const aspectRatio = elements.layout.value === "LAYOUT_STANDARD" ? "4 / 3" : "16 / 9";
  const paddings = getPaddingValues();

  elements.fontSizeValue.textContent = `${fontSize}px`;
  updatePaddingOutputs(paddings);
  updateColorPreview();

  elements.slideMockup.style.aspectRatio = aspectRatio;
  elements.slideMockup.style.backgroundColor = elements.backgroundColor.value;
  elements.slideMockup.style.backgroundImage = state.backgroundImageDataUrl
    ? `linear-gradient(rgba(10, 12, 18, 0.16), rgba(10, 12, 18, 0.16)), url("${state.backgroundImageDataUrl}")`
    : "none";
  elements.slideMockup.classList.toggle("has-image", Boolean(state.backgroundImageDataUrl));
  elements.slideMockupText.classList.toggle("is-placeholder", isEmptyPreview);
  elements.slideMockupText.textContent = previewText || EMPTY_PREVIEW_TEXT;
  elements.slideMockupText.style.fontFamily = getSelectedFontFace();
  elements.slideMockupText.style.color = elements.textColor.value;
  elements.slideMockupText.style.textAlign = "center";

  requestAnimationFrame(() => {
    const pageSize = getCurrentPageSize();
    const mockupRect = elements.slideMockup.getBoundingClientRect();
    const widthPixelsPerInch = mockupRect.width / pageSize.width;
    const heightPixelsPerInch = mockupRect.height / pageSize.height;
    const pixelsPerInch = Math.min(widthPixelsPerInch, heightPixelsPerInch);
    const paddingInches = paddingPointsToInches(paddings);
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
    elements.slideMockupText.style.fontSize = `${Math.max(10, (fontSize / 72) * pixelsPerInch)}px`;

    applyTextPosition();
  });
}
