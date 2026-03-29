const LINE_BREAK_DELIMITER = "/";
const FONT_OPTIONS = [
  { label: "맑은 고딕", value: "Malgun Gothic" },
  { label: "SUIT", value: "SUIT" },
  { label: "Noto Sans KR", value: "Noto Sans KR" },
  { label: "Nanum Gothic", value: "Nanum Gothic" },
  { label: "Apple SD Gothic Neo", value: "Apple SD Gothic Neo" },
  { label: "Arial", value: "Arial" },
];
const STORAGE_KEYS = {
  sourceText: "txt-to-ppt:last-source-text",
};
const ALIGNMENT_LABELS = {
  center: "가운데",
  top: "상단",
  mid: "중앙",
  bottom: "하단",
};
const TEXT_DECODER_CANDIDATES = [
  "utf-8",
  "euc-kr",
  "utf-16le",
  "utf-16be",
  "shift_jis",
  "gb18030",
  "big5",
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "windows-1254",
  "windows-1256",
  "iso-8859-2",
  "iso-8859-15",
  "koi8-r",
  "macintosh",
];

const sampleText = `첫 번째 줄은 첫 슬라이드입니다
같은 줄에서 / 를 쓰면 줄바꿈이 됩니다
/
두 번째 슬라이드는 이렇게 분리됩니다
텍스트 박스를 드래그해서/상하 정렬을 바꿔보세요`;

const elements = {
  textFile: document.querySelector("#textFile"),
  backgroundFile: document.querySelector("#backgroundFile"),
  sourceText: document.querySelector("#sourceText"),
  fileName: document.querySelector("#fileName"),
  layout: document.querySelector("#layout"),
  fontFace: document.querySelector("#fontFace"),
  fontSize: document.querySelector("#fontSize"),
  fontSizeValue: document.querySelector("#fontSizeValue"),
  textColor: document.querySelector("#textColor"),
  textColorSwatch: document.querySelector("#textColorSwatch"),
  textColorValue: document.querySelector("#textColorValue"),
  backgroundColor: document.querySelector("#backgroundColor"),
  backgroundColorSwatch: document.querySelector("#backgroundColorSwatch"),
  backgroundColorValue: document.querySelector("#backgroundColorValue"),
  paddingTop: document.querySelector("#paddingTop"),
  paddingTopValue: document.querySelector("#paddingTopValue"),
  paddingRight: document.querySelector("#paddingRight"),
  paddingRightValue: document.querySelector("#paddingRightValue"),
  paddingBottom: document.querySelector("#paddingBottom"),
  paddingBottomValue: document.querySelector("#paddingBottomValue"),
  paddingLeft: document.querySelector("#paddingLeft"),
  paddingLeftValue: document.querySelector("#paddingLeftValue"),
  textFileName: document.querySelector("#textFileName"),
  backgroundFileName: document.querySelector("#backgroundFileName"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  downloadButton: document.querySelector("#downloadButton"),
  statusMessage: document.querySelector("#statusMessage"),
  slideMockup: document.querySelector("#slideMockup"),
  slideSafeZone: document.querySelector("#slideSafeZone"),
  slideMockupText: document.querySelector("#slideMockupText"),
  alignmentStatus: document.querySelector("#alignmentStatus"),
};

let backgroundImageDataUrl = "";
let currentSlides = [];
const alignmentState = {
  horizontal: "center",
  vertical: "top",
};

function populateFontOptions() {
  elements.fontFace.innerHTML = "";
  FONT_OPTIONS.forEach((font) => {
    const option = document.createElement("option");
    option.value = font.value;
    option.textContent = font.label;
    elements.fontFace.append(option);
  });
  elements.fontFace.value = "Malgun Gothic";
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#b42318" : "";
}

function sanitizeFileName(fileName) {
  const trimmed = (fileName || "").trim().replace(/\.pptx$/i, "");
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-") || "generated-slides";
}

function getTodayTitle() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\.\s?/g, "-").replace(/-$/, "");
}

function ensureDefaultFileName() {
  const currentValue = (elements.fileName.value || "").trim();
  if (!currentValue || currentValue === "generated-slides") {
    elements.fileName.value = getTodayTitle();
  }
}

function getOutputBaseName() {
  const candidate = sanitizeFileName(elements.fileName.value || getTodayTitle());
  return candidate || sanitizeFileName(getTodayTitle());
}

function getSelectedFontFace() {
  return (elements.fontFace.value || "Malgun Gothic").replace(/^["']|["']$/g, "").trim() || "Malgun Gothic";
}

function saveSourceText() {
  try {
    localStorage.setItem(STORAGE_KEYS.sourceText, elements.sourceText.value || "");
  } catch (error) {
    console.warn("Failed to save source text", error);
  }
}

function restoreSourceText() {
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

function getCurrentPageSize() {
  return elements.layout.value === "LAYOUT_STANDARD"
    ? { width: 10, height: 7.5 }
    : { width: 13.333, height: 7.5 };
}

function parseSlides(rawText) {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split("\n").map((line) => {
    if (!line) {
      return "";
    }

    return line
      .split(LINE_BREAK_DELIMITER)
      .map((segment) => segment.trim())
      .join("\n")
      .trim();
  });
}

function getSlidesFromInput() {
  return parseSlides(elements.sourceText.value);
}

function getMockupSlideText(slides = getSlidesFromInput()) {
  const normalizedSlides = slides
    .map((slideText) => slideText.trim())
    .filter(Boolean);

  if (!normalizedSlides.length) {
    return "";
  }

  return normalizedSlides.reduce((selectedSlide, currentSlide) => {
    const selectedLongestLine = Math.max(...selectedSlide.split("\n").map((line) => line.trim().length), 0);
    const currentLongestLine = Math.max(...currentSlide.split("\n").map((line) => line.trim().length), 0);
    return currentLongestLine > selectedLongestLine ? currentSlide : selectedSlide;
  });
}

function getPaddingValues() {
  return {
    top: Math.max(0, Number(elements.paddingTop.value) || 0),
    right: Math.max(0, Number(elements.paddingRight.value) || 0),
    bottom: Math.max(0, Number(elements.paddingBottom.value) || 0),
    left: Math.max(0, Number(elements.paddingLeft.value) || 0),
  };
}

function updatePaddingOutputs(paddings = getPaddingValues()) {
  elements.paddingTopValue.textContent = `${paddings.top}pt`;
  elements.paddingRightValue.textContent = `${paddings.right}pt`;
  elements.paddingBottomValue.textContent = `${paddings.bottom}pt`;
  elements.paddingLeftValue.textContent = `${paddings.left}pt`;
}

function paddingPointsToInches(paddingPoints) {
  return {
    top: paddingPoints.top / 72,
    right: paddingPoints.right / 72,
    bottom: paddingPoints.bottom / 72,
    left: paddingPoints.left / 72,
  };
}

function updateColorPreview() {
  const textColor = elements.textColor.value.toUpperCase();
  const backgroundColor = elements.backgroundColor.value.toUpperCase();

  elements.textColorSwatch.style.backgroundColor = textColor;
  elements.textColorValue.textContent = textColor;
  elements.backgroundColorSwatch.style.backgroundColor = backgroundColor;
  elements.backgroundColorValue.textContent = backgroundColor;
}

function updateFileLabels() {
  elements.textFileName.textContent = elements.textFile.files?.[0]?.name || "선택된 파일 없음";
  elements.backgroundFileName.textContent = elements.backgroundFile.files?.[0]?.name || "선택된 파일 없음";
}

function updateAlignmentStatus() {
  elements.alignmentStatus.textContent = `정렬: ${ALIGNMENT_LABELS[alignmentState.horizontal]} / ${ALIGNMENT_LABELS[alignmentState.vertical]}`;
}

function applyTextPosition() {
  alignmentState.horizontal = "center";
  elements.slideSafeZone.style.justifyContent = "center";
  elements.slideSafeZone.style.alignItems =
    alignmentState.vertical === "top" ? "flex-start" : alignmentState.vertical === "bottom" ? "flex-end" : "center";
}

function setAlignmentFromPointer(clientX, clientY) {
  const rect = elements.slideSafeZone.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const relativeY = (clientY - rect.top) / rect.height;

  alignmentState.horizontal = "center";
  alignmentState.vertical = relativeY < 1 / 3 ? "top" : relativeY > 2 / 3 ? "bottom" : "mid";

  applyTextPosition();
  updateAlignmentStatus();
}

function updateMockup(slides = getSlidesFromInput()) {
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
  elements.slideMockupText.textContent = previewText || "\ud14d\uc2a4\ud2b8\ub97c \uc785\ub825\ud558\uba74 \uc5ec\uae30\uc5d0 \ud45c\uc2dc\ub429\ub2c8\ub2e4";

  if (backgroundImageDataUrl) {
    elements.slideMockup.classList.add("has-image");
    elements.slideMockup.style.backgroundImage = `linear-gradient(rgba(10, 12, 18, 0.28), rgba(10, 12, 18, 0.28)), url("${backgroundImageDataUrl}")`;
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
    updateAlignmentStatus();
  });
}

function detectBomEncoding(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return "utf-16be";
  }
  return "";
}

function looksLikeUtf16(bytes, endianness) {
  const sampleSize = Math.min(bytes.length, 512);
  if (sampleSize < 4 || sampleSize % 2 !== 0) {
    return false;
  }

  let zeroesOnEven = 0;
  let zeroesOnOdd = 0;
  let pairs = 0;

  for (let index = 0; index < sampleSize - 1; index += 2) {
    if (bytes[index] === 0x00) {
      zeroesOnEven += 1;
    }
    if (bytes[index + 1] === 0x00) {
      zeroesOnOdd += 1;
    }
    pairs += 1;
  }

  const evenRatio = zeroesOnEven / pairs;
  const oddRatio = zeroesOnOdd / pairs;

  return endianness === "le"
    ? oddRatio > 0.3 && evenRatio < 0.1
    : evenRatio > 0.3 && oddRatio < 0.1;
}

function decodeWithEncoding(buffer, encoding, fatal = false) {
  try {
    return new TextDecoder(encoding, fatal ? { fatal: true } : {}).decode(buffer);
  } catch (error) {
    return null;
  }
}

function scoreDecodedText(text) {
  if (text == null) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  for (const char of text) {
    if (char === "\uFFFD") {
      score -= 20;
      continue;
    }
    if (char === "\u0000") {
      score -= 20;
      continue;
    }
    if (/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(char)) {
      score -= 8;
      continue;
    }
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(char)) {
      score += 4;
      continue;
    }
    if (/[\u3040-\u30FF\u3400-\u9FFF]/u.test(char)) {
      score += 3;
      continue;
    }
    if (/[A-Za-z0-9]/u.test(char)) {
      score += 1.5;
      continue;
    }
    if (/\s/u.test(char)) {
      score += 0.3;
      continue;
    }
    if (/[.,!?'"():;\/\\\-_[\]{}@#$%^&*+=~`<>|]/u.test(char)) {
      score += 0.8;
      continue;
    }
    score += 0.2;
  }

  return score;
}

function detectTextEncoding(buffer) {
  const bytes = new Uint8Array(buffer);
  const bomEncoding = detectBomEncoding(bytes);
  if (bomEncoding) {
    return bomEncoding;
  }

  const strictUtf8 = decodeWithEncoding(buffer, "utf-8", true);
  if (strictUtf8 !== null) {
    return "utf-8";
  }

  const candidates = [];
  if (looksLikeUtf16(bytes, "le")) {
    candidates.push("utf-16le");
  }
  if (looksLikeUtf16(bytes, "be")) {
    candidates.push("utf-16be");
  }

  TEXT_DECODER_CANDIDATES.forEach((encoding) => {
    if (!candidates.includes(encoding)) {
      candidates.push(encoding);
    }
  });

  let bestEncoding = "utf-8";
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((encoding) => {
    const decoded = decodeWithEncoding(buffer, encoding);
    const score = scoreDecodedText(decoded);

    if (score > bestScore) {
      bestScore = score;
      bestEncoding = encoding;
    }
  });

  return bestEncoding;
}

async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const encoding = detectTextEncoding(buffer);
  const text = decodeWithEncoding(buffer, encoding);

  if (text == null) {
    throw new Error(`Unsupported text encoding: ${encoding}`);
  }

  return { text, encoding };
}

async function loadUploadedText() {
  const file = elements.textFile.files?.[0];
  if (!file) {
    updateFileLabels();
    return;
  }

  try {
    const { text, encoding } = await readTextFile(file);
    elements.sourceText.value = text;
    saveSourceText();
    ensureDefaultFileName();
    updateFileLabels();
    buildSlidesFromInput();
    setStatus(`"${file.name}" 파일을 불러왔습니다. 감지된 인코딩: ${encoding}`);
  } catch (error) {
    console.error(error);
    setStatus("텍스트 파일을 읽는 중 문제가 발생했습니다.", true);
  }
}

async function loadBackgroundImage() {
  const file = elements.backgroundFile.files?.[0];
  if (!file) {
    backgroundImageDataUrl = "";
    updateFileLabels();
    updateMockup();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    backgroundImageDataUrl = String(reader.result || "");
    updateFileLabels();
    updateMockup();
    setStatus(`배경 이미지 "${file.name}"를 적용했습니다.`);
  };
  reader.onerror = () => {
    backgroundImageDataUrl = "";
    setStatus("배경 이미지를 읽는 데 실패했습니다.", true);
  };
  reader.readAsDataURL(file);
}

function buildSlidesFromInput() {
  const rawText = elements.sourceText.value;
  if (!rawText.trim()) {
    setStatus("텍스트 내용을 먼저 입력해 주세요.", true);
    currentSlides = [];
    updateMockup([]);
    return [];
  }

  const slides = parseSlides(rawText);
  currentSlides = slides;
  updateMockup(slides);
  setStatus(`${slides.length}개의 슬라이드를 준비했습니다.`);
  return slides;
}

function getExportTextBox(pageSize) {
  const padding = paddingPointsToInches(getPaddingValues());

  return {
    x: padding.left,
    y: padding.top,
    w: Math.max(1, pageSize.width - padding.left - padding.right),
    h: Math.max(1, pageSize.height - padding.top - padding.bottom),
  };
}

async function downloadPresentation() {
  const slides = buildSlidesFromInput();
  if (!slides.length) {
    return;
  }

  if (typeof PptxGenJS === "undefined") {
    setStatus("PptxGenJS 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.", true);
    return;
  }

  const pptx = new PptxGenJS();
  const outputBaseName = getOutputBaseName();
  pptx.layout = elements.layout.value;
  pptx.author = "OpenAI Codex";
  pptx.company = "txt-to-ppt-web";
  pptx.subject = "Converted from text to slides";
  pptx.title = outputBaseName;
  pptx.lang = "ko-KR";

  const fontSize = Number(elements.fontSize.value) || 28;
  const fontFace = getSelectedFontFace();
  const textColor = elements.textColor.value.replace("#", "").toUpperCase();
  const backgroundColor = elements.backgroundColor.value.replace("#", "").toUpperCase();
  const pageSize = getCurrentPageSize();
  const textBox = getExportTextBox(pageSize);

  slides.forEach((slideText) => {
    const slide = pptx.addSlide();
    slide.background = { color: backgroundColor };

    if (backgroundImageDataUrl) {
      slide.addImage({
        data: backgroundImageDataUrl,
        x: 0,
        y: 0,
        w: pageSize.width,
        h: pageSize.height,
      });
    }

    slide.addText(slideText || " ", {
      x: textBox.x,
      y: textBox.y,
      w: textBox.w,
      h: textBox.h,
      fontFace,
      fontSize,
      color: textColor,
      bold: true,
      shadow: {
        type: "outer",
        color: "000000",
        blur: 1,
        angle: 45,
        distance: 2,
        opacity: 0.35,
      },
      margin: 0,
      align: alignmentState.horizontal,
      valign: alignmentState.vertical,
      breakLine: false,
      fit: "shrink",
    });
  });

  const outputName = `${outputBaseName}.pptx`;

  try {
    setStatus("PPTX 파일을 생성하고 있습니다...");
    await pptx.writeFile({ fileName: outputName });
    setStatus(`"${outputName}" 다운로드가 시작되었습니다.`);
  } catch (error) {
    console.error(error);
    setStatus("PPTX 파일 생성 중 오류가 발생했습니다.", true);
  }
}

elements.textFile.addEventListener("change", loadUploadedText);
elements.backgroundFile.addEventListener("change", loadBackgroundImage);
elements.loadSampleButton.addEventListener("click", () => {
  if (elements.sourceText.value.trim()) {
    const shouldOverwrite = window.confirm("이미 작성된 텍스트가 있습니다. 샘플로 덮어쓸까요?");
    if (!shouldOverwrite) {
      return;
    }
  }

  elements.sourceText.value = sampleText;
  saveSourceText();
  ensureDefaultFileName();
  buildSlidesFromInput();
});
elements.downloadButton.addEventListener("click", downloadPresentation);
elements.sourceText.addEventListener("input", () => {
  saveSourceText();
  buildSlidesFromInput();
});
elements.fontFace.addEventListener("change", () => updateMockup());
elements.fontSize.addEventListener("input", () => updateMockup());
elements.textColor.addEventListener("input", () => updateMockup());
elements.backgroundColor.addEventListener("input", () => updateMockup());
elements.layout.addEventListener("change", () => updateMockup());
elements.paddingTop.addEventListener("input", () => updateMockup());
elements.paddingRight.addEventListener("input", () => updateMockup());
elements.paddingBottom.addEventListener("input", () => updateMockup());
elements.paddingLeft.addEventListener("input", () => updateMockup());
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

populateFontOptions();
ensureDefaultFileName();
const restoredSourceText = restoreSourceText();
updateFileLabels();
if (restoredSourceText) {
  buildSlidesFromInput();
} else {
  currentSlides = [];
  updateMockup();
}
window.addEventListener("resize", () => {
  updateMockup(currentSlides.length ? currentSlides : getSlidesFromInput());
});
