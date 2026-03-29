import { LINE_BREAK_DELIMITER, TEXT_DECODER_CANDIDATES } from "./config.js";
import { elements } from "./dom.js";

export function getCurrentPageSize() {
  return elements.layout.value === "LAYOUT_STANDARD"
    ? { width: 10, height: 7.5 }
    : { width: 13.333, height: 7.5 };
}

export function parseSlides(rawText) {
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

export function getSlidesFromInput() {
  return parseSlides(elements.sourceText.value);
}

export function getMockupSlideText(slides = getSlidesFromInput()) {
  const normalizedSlides = slides.map((slideText) => slideText.trim()).filter(Boolean);
  if (!normalizedSlides.length) {
    return "";
  }

  return normalizedSlides.reduce((selectedSlide, currentSlide) => {
    const selectedLongestLine = Math.max(...selectedSlide.split("\n").map((line) => line.trim().length), 0);
    const currentLongestLine = Math.max(...currentSlide.split("\n").map((line) => line.trim().length), 0);
    return currentLongestLine > selectedLongestLine ? currentSlide : selectedSlide;
  });
}

export function getPaddingValues() {
  const padding = Math.max(0, Number(elements.padding.value) || 0);
  return {
    top: padding,
    right: 0,
    bottom: padding,
    left: 0,
  };
}

export function updatePaddingOutputs(paddings = getPaddingValues()) {
  elements.paddingValue.textContent = `${paddings.top}pt`;
}

export function paddingPointsToInches(paddingPoints) {
  return {
    top: paddingPoints.top / 72,
    right: paddingPoints.right / 72,
    bottom: paddingPoints.bottom / 72,
    left: paddingPoints.left / 72,
  };
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
  } catch {
    return null;
  }
}

function scoreDecodedText(text) {
  if (text == null) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  for (const char of text) {
    if (char === "\uFFFD" || char === "\u0000") {
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

export async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const encoding = detectTextEncoding(buffer);
  const text = decodeWithEncoding(buffer, encoding);

  if (text == null) {
    throw new Error(`Unsupported text encoding: ${encoding}`);
  }

  return { text, encoding };
}
