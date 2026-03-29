import { elements } from "./dom.js";
import { getSelectedFontFace } from "./fonts.js";
import { getOutputBaseName } from "./settings.js";
import { alignmentState, state } from "./state.js";
import { getCurrentPageSize, getPaddingValues, paddingPointsToInches } from "./slides.js";
import { setStatus } from "./ui.js";

function getExportTextBox(pageSize) {
  const padding = paddingPointsToInches(getPaddingValues());
  return {
    x: padding.left,
    y: padding.top,
    w: Math.max(1, pageSize.width - padding.left - padding.right),
    h: Math.max(1, pageSize.height - padding.top - padding.bottom),
  };
}

export async function downloadPresentation(buildSlidesFromInput) {
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

    if (state.backgroundImageDataUrl) {
      slide.addImage({
        data: state.backgroundImageDataUrl,
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

export function downloadSourceText() {
  const text = elements.sourceText.value || "";
  if (!text.trim()) {
    setStatus("텍스트 내용을 먼저 입력해 주세요.", true);
    return;
  }

  const outputName = `${getOutputBaseName()}.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = outputName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  setStatus(`"${outputName}" 다운로드가 시작되었습니다.`);
}
