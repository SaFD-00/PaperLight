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
