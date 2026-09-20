// dhlottery 새 사이트 API 크롤러
// - selectPstLt645Info.do: 최신 회차 요약 (자동/수동/반자동 breakdown 포함)
// - selectLtEpsdInfo.do: 전체 회차 목록 (부트스트랩 시 회차 존재 검증용)
// - selectLtWnShpCnt.do: 회차별 판매점 카운트 (사전 존재 확인용)
// - selectLtWnShp.do: 회차별 배출점 상세 (rank 파라미터 무시하고 전체 반환)

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REF = "https://www.dhlottery.co.kr/wnprchsplcsrch/home";

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: REF,
    },
    redirect: "follow",
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  if (!ct.includes("json")) {
    const snippet = (await res.text()).slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`${url} → non-json (${ct}): ${snippet}`);
  }
  return (await res.json()) as T;
}

export interface LatestDraw {
  drwNo: number;
  drwDate: string;             // YYYY-MM-DD
  numbers: number[];           // 6개, 오름차순
  bonus: number;
  totalSales: number | null;
  firstAmt: number | null;
  firstCnt: number | null;
  prizes: { rank: number; winners: number; amount: number }[];
  // 자동/수동/반자동 breakdown (winType0~3 의미는 rows에서 추출)
  raw: unknown;
}

interface LtInfoRow {
  ltEpsd: number;
  ltRflYmd: string;            // YYYYMMDD
  tm1WnNo: number; tm2WnNo: number; tm3WnNo: number;
  tm4WnNo: number; tm5WnNo: number; tm6WnNo: number;
  bnsWnNo: number;
  rnk1WnNope: number; rnk1WnAmt: number;
  rnk2WnNope: number; rnk2WnAmt: number;
  rnk3WnNope: number; rnk3WnAmt: number;
  rnk4WnNope: number; rnk4WnAmt: number;
  rnk5WnNope: number; rnk5WnAmt: number;
  rlvtEpsdSumNtslAmt: number;
}

function ymd(s: string) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** 최신 회차만 반환 (파라미터 무시됨). 매주 새 회차 감지·저장용. */
export async function fetchLatestDraw(): Promise<LatestDraw> {
  const doc = await fetchJson<{ data: { list: LtInfoRow[] } }>(
    "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do",
  );
  const row = doc.data.list[0];
  if (!row) throw new Error("selectPstLt645Info: empty list");
  const numbers = [row.tm1WnNo, row.tm2WnNo, row.tm3WnNo, row.tm4WnNo, row.tm5WnNo, row.tm6WnNo].sort((a, b) => a - b);
  return {
    drwNo: row.ltEpsd,
    drwDate: ymd(row.ltRflYmd),
    numbers,
    bonus: row.bnsWnNo,
    totalSales: row.rlvtEpsdSumNtslAmt ?? null,
    firstAmt: row.rnk1WnAmt ?? null,
    firstCnt: row.rnk1WnNope ?? null,
    prizes: [
      { rank: 1, winners: row.rnk1WnNope, amount: row.rnk1WnAmt },
      { rank: 2, winners: row.rnk2WnNope, amount: row.rnk2WnAmt },
      { rank: 3, winners: row.rnk3WnNope, amount: row.rnk3WnAmt },
      { rank: 4, winners: row.rnk4WnNope, amount: row.rnk4WnAmt },
      { rank: 5, winners: row.rnk5WnNope, amount: row.rnk5WnAmt },
    ],
    raw: row,
  };
}

export interface EpsdListRow {
  ltEpsd: number;
  ltRflYmd: string;
}
/** 전 회차 목록 (부트스트랩 검증용). 응답 크기가 커도 회차 정수 배열만 유용. */
export async function fetchDrawList(): Promise<EpsdListRow[]> {
  const doc = await fetchJson<{ data: { list: EpsdListRow[] } }>(
    "https://www.dhlottery.co.kr/lt645/selectLtEpsdInfo.do",
  );
  return doc.data.list.map((r) => ({ ltEpsd: r.ltEpsd, ltRflYmd: ymd(r.ltRflYmd) }));
}

export interface WinningStoreRow {
  wnShpRnk: number;               // 1 or 2 (원본은 문자열 '2'/'1' 도 가능하므로 파싱 시 정수화)
  ltShpId: string;                // 판매점 고유 ID (숫자 문자열)
  shpNm: string;
  shpAddr: string;                // 우선 사용 (전체 주소 문자열)
  rdnm: string;
  atmtPsvYnTxt: string | null;    // '자동' | '수동' | '반자동'
  region: string;                 // '서울', '경기' 등
  shpLat: number | null;
  shpLot: number | null;
}
export interface WinningStoresResp {
  total: number;
  list: WinningStoreRow[];
}

/** 회차별 배출점 (전체 = 1등 + 2등). 파라미터 srchWnShpRnk는 무시되어 항상 total 반환. */
export async function fetchWinningStores(drwNo: number): Promise<WinningStoresResp> {
  const url = `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=&srchLtEpsd=${drwNo}&srchShpLctn=`;
  const doc = await fetchJson<{ data: { total: number; list: WinningStoreRow[] } | null }>(url);
  if (!doc.data || !Array.isArray(doc.data.list)) return { total: 0, list: [] };
  return { total: doc.data.total ?? doc.data.list.length, list: doc.data.list };
}

/** 회차별 배출점 카운트 (empty check용, 백필 스킵 판정 등) */
export async function fetchWinningStoreCount(drwNo: number): Promise<number> {
  const doc = await fetchJson<{ data: { list: { wnShpRnk: string; cnt: number }[] } }>(
    `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShpCnt.do?srchLtEpsd=${drwNo}`,
  );
  const all = doc.data.list.find((r) => r.wnShpRnk === "all");
  return all?.cnt ?? 0;
}

/** '자동' → 'auto', '수동' → 'manual', '반자동' → 'semi' */
export function methodCode(txt: string | null | undefined): string | null {
  if (!txt) return null;
  if (txt.includes("반자동")) return "semi";
  if (txt.includes("자동")) return "auto";
  if (txt.includes("수동")) return "manual";
  return null;
}
