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
  /** 이 item 중심이 Figure/Table 영역 안에 있는가(viewer.js가 region 기준 산출). */
  inFigure?: boolean;
}

/** body 문자열 범위 ↔ 원문(text-layer) 전역 offset 매핑. */
export interface BodySegment {
  bodyStart: number;
  bodyEnd: number;
  globalStart: number;
  globalEnd: number;
}

export function extractBody(
  items: BodyItem[],
  opts?: { firstPage?: boolean; refActiveAtStart?: boolean },
): {
  bodyText: string;
  segments: BodySegment[];
  /** 비공백 입력이 전부 drop됨(의도적 empty). viewer가 fullText 폴백과 구분한다. */
  allDropped: boolean;
};

/**
 * 문서 전체(페이지별 BodyItem)를 순서대로 훑어 페이지별 refActiveAtStart를 산출.
 * References가 여러 페이지에 걸치는 경우와 말미 Checklist 보일러플레이트를 문서 수준으로 제외.
 */
export function scanReferenceActivation(pagesItems: BodyItem[][]): boolean[];

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
