import { SearchBar, useReader } from "paperlight-frontend";

/** SearchBar는 useReader 스토어에 결합되어 있고 searchOpen=false면 null을 반환한다. */
function seed(state: Record<string, unknown>) {
  useReader.setState({
    searchOpen: true,
    searchQuery: "",
    searchMatchCount: 0,
    searchCurrent: 0,
    ...state,
  });
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 96,
        background: "var(--bg-base)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/** 검색어가 있고 여러 일치가 잡힌 상태 — "3 / 12" 카운터 + 이전/다음 활성. */
export function WithMatches() {
  seed({ searchQuery: "transformer", searchMatchCount: 12, searchCurrent: 3 });
  return (
    <Stage>
      <SearchBar />
    </Stage>
  );
}

/** 일치하는 결과가 없을 때 — "결과 없음", 이동 버튼 비활성. */
export function NoResults() {
  seed({ searchQuery: "quaternion", searchMatchCount: 0, searchCurrent: 0 });
  return (
    <Stage>
      <SearchBar />
    </Stage>
  );
}

/** 막 열린 빈 입력 상태(플레이스홀더 "페이지에서 찾기"). */
export function Empty() {
  seed({ searchQuery: "", searchMatchCount: 0, searchCurrent: 0 });
  return (
    <Stage>
      <SearchBar />
    </Stage>
  );
}
