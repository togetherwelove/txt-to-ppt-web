export const LINE_BREAK_DELIMITER = "/";
export const FONT_OPTIONS = [];

export const STORAGE_KEYS = {
  sourceText: "txt-to-ppt:last-source-text",
  outputSettings: "txt-to-ppt:last-output-settings",
};

export const DB_NAME = "txt-to-ppt-assets";
export const DB_VERSION = 1;
export const DB_STORE_NAME = "assets";

export const ASSET_KEYS = {
  backgroundImage: "background-image",
  localFont: "local-font",
};

export const TEXT_DECODER_CANDIDATES = [
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

export const sampleText = `첫 번째 줄은 첫 슬라이드입니다
같은 줄에서 / 를 쓰면 줄바꿈이 됩니다
/
두 번째 슬라이드는 이렇게 분리됩니다
텍스트 박스를 드래그해서/상하 정렬을 바꿔보세요`;
