export interface BodyItem {
  /** text item 문자열. */
  str: string;
  /** 이 item 으로 라인이 끝나는가(pdf.js hasEOL). */
  hasEOL: boolean;
  /** 글리프 높이(상대 비교용 단위). */
  fontHeight: number;
  /** 페이지 상단 기준 정규화 위치(0=상단, 1=하단). */
  normTop: number;
  /** 해석된 폰트 패밀리(pdf.js styles[fontName].fontFamily). */
  fontFamily: string;
}

/** body 문자열 범위 ↔ 원문(text-layer) 전역 offset 매핑. */
export interface BodySegment {
  bodyStart: number;
  bodyEnd: number;
  globalStart: number;
  globalEnd: number;
}

export function extractBody(items: BodyItem[]): {
  bodyText: string;
  segments: BodySegment[];
};

export function mapBodyRange(
  segments: BodySegment[],
  bodyStart: number,
  bodyEnd: number,
): { startOffset: number; endOffset: number } | null;

/** 캡션 머리말 정규식(영문 + 그림/표). 캡션 판별과 라벨 파싱에서 공유. */
export const CAPTION_RE: RegExp;

/** 캡션 텍스트에서 종류와 정규화된 라벨을 추출. */
export function parseCaptionLabel(
  text: string,
): { kind: "figure" | "table"; label: string } | null;
