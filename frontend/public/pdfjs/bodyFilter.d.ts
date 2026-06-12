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
  opts?: { firstPage?: boolean; refActiveAtStart?: boolean; furniture?: Set<string> },
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

/**
 * 문서 전체에서 상하단 밴드에 여러 페이지 반복되는 러닝 헤더/푸터의 정규화 키 집합을 반환.
 * extractBody opts.furniture로 주입하면 '밴드 위치 AND 반복'인 24자+ 헤더도 제거한다.
 */
export function scanRunningFurniture(pagesItems: BodyItem[][], minRepeat?: number): Set<string>;

/** 문장 종결 이후 미완 꼬리를 분리(페이지 경계 문장 처리). */
export function trailingIncomplete(text: string): { headLen: number; tail: string };

/**
 * cross-page: 페이지 끝 미완 문장을 제외하고 이전 페이지 미완 꼬리를 앞에 붙여 완성 문장으로.
 * 이어진 첫 문장은 segments 매핑이 없어 교차 하이라이트만 비활성(나머지 정상).
 */
export function carryAcrossPages(
  prevText: string,
  raw: { text: string; segments: BodySegment[] },
  isLast: boolean,
): { text: string; segments: BodySegment[] };

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

/** figureExclusionBand 입력 라인 박스(정규화 0..1, top<bot). */
export interface FigureLine {
  top: number;
  bot: number;
  x0: number;
  x1: number;
  text: string;
}

/**
 * 캡션 기준 "본문 보존형" Figure/Table 제외 밴드(inFigure 번역 제외 전용, crop용 region과 분리).
 * 고정 0.42 밴드 대신 도표 콘텐츠(표 행·라벨) 구간만 반환해 인접 본문·섹션 헤딩·제목을 보존한다.
 * 양쪽 다 본문이면(인라인 캡션 오탐·텍스트 없는 그림) h=0(제외 없음).
 */
export function figureExclusionBand(
  lines: FigureLine[],
  cap: { top: number; bot: number },
  col: { x0: number; x1: number },
  kind: "figure" | "table",
  opts?: { maxBand?: number; minBodyLen?: number },
): { y: number; h: number };
