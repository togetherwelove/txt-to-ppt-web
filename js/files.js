import { elements } from "./dom.js";
import { updateMockup } from "./mockup.js";
import { ensureDefaultFileName } from "./settings.js";
import { readTextFile } from "./slides.js";
import { persistedAssetNames, state } from "./state.js";
import { readFileAsDataUrl, saveSourceText } from "./storage.js";
import { setStatus, updateFileLabels } from "./ui.js";

export async function loadUploadedText(onSourceChange) {
  const file = elements.textFile.files?.[0];
  if (!file) {
    updateFileLabels();
    return;
  }

  if (elements.sourceText.value.trim()) {
    const shouldOverwrite = window.confirm("이미 작성된 텍스트가 있습니다. 업로드한 파일로 덮어쓸까요?");
    if (!shouldOverwrite) {
      elements.textFile.value = "";
      updateFileLabels();
      return;
    }
  }

  try {
    const { text, encoding } = await readTextFile(file);
    persistedAssetNames.textFile = file.name;
    elements.sourceText.value = text;
    saveSourceText();

    ensureDefaultFileName();
    updateFileLabels();
    onSourceChange();
    setStatus(`"${file.name}" 파일을 불러왔습니다. 감지된 인코딩: ${encoding}`);
  } catch (error) {
    console.error(error);
    setStatus("텍스트 파일을 읽는 중 문제가 발생했습니다.", true);
  }
}

export async function loadBackgroundImage() {
  const file = elements.backgroundFile.files?.[0];
  if (!file) {
    state.backgroundImageDataUrl = "";
    persistedAssetNames.backgroundFile = "";
    updateFileLabels();
    updateMockup(state.currentSlides);
    return;
  }

  try {
    state.backgroundImageDataUrl = await readFileAsDataUrl(file);
    persistedAssetNames.backgroundFile = file.name;

    updateFileLabels();
    updateMockup(state.currentSlides);
    setStatus(`배경 이미지 "${file.name}"를 적용했습니다.`);
  } catch (error) {
    console.error(error);
    state.backgroundImageDataUrl = "";
    setStatus("배경 이미지를 읽는 데 실패했습니다.", true);
  }
}
