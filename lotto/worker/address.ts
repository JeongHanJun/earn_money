// 주소 파싱: dhlottery의 도로명주소(rdnm/shpAddr)에서 시·도, 시·군·구 추출.
// 도로명주소는 동 정보가 없으므로 eupmyeondong은 대체로 null (v2에서 좌표 역지오코딩).

const SIDO_ALIASES: Record<string, string> = {
  서울: "서울",
  서울특별시: "서울",
  부산: "부산",
  부산광역시: "부산",
  대구: "대구",
  대구광역시: "대구",
  인천: "인천",
  인천광역시: "인천",
  광주: "광주",
  광주광역시: "광주",
  대전: "대전",
  대전광역시: "대전",
  울산: "울산",
  울산광역시: "울산",
  세종: "세종",
  세종특별자치시: "세종",
  경기: "경기",
  경기도: "경기",
  강원: "강원",
  강원도: "강원",
  강원특별자치도: "강원",
  충북: "충북",
  충청북도: "충북",
  충남: "충남",
  충청남도: "충남",
  전북: "전북",
  전라북도: "전북",
  전북특별자치도: "전북",
  전남: "전남",
  전라남도: "전남",
  경북: "경북",
  경상북도: "경북",
  경남: "경남",
  경상남도: "경남",
  제주: "제주",
  제주도: "제주",
  제주특별자치도: "제주",
};

export interface ParsedAddr {
  sido: string | null;
  sigungu: string | null;
  eupmyeondong: string | null;
}

// 예: "서울 중랑구 상봉로 7 105호" → { 서울, 중랑구, null }
// 예: "경기도 성남시 분당구 판교로 235" → { 경기, 성남시 분당구, null }
export function parseAddress(raw: string | null | undefined): ParsedAddr {
  const empty: ParsedAddr = { sido: null, sigungu: null, eupmyeondong: null };
  if (!raw) return empty;
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return empty;

  const sido = SIDO_ALIASES[tokens[0]] ?? null;
  if (!sido || tokens.length < 2) return { ...empty, sido };

  // 특별시/광역시: 두 번째 토큰이 시군구
  // 도: 두 번째 토큰이 시(예: 성남시), 시 이하 구가 있으면 세 번째 토큰이 구 (예: 분당구)
  let sigungu: string | null = tokens[1] ?? null;

  const isProvince = ["경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"].includes(sido);
  if (isProvince && tokens[2]) {
    // "성남시 분당구" 같은 시+구 결합
    if (tokens[1].endsWith("시") && tokens[2].endsWith("구")) {
      sigungu = `${tokens[1]} ${tokens[2]}`;
    }
  }

  return { sido, sigungu, eupmyeondong: null };
}
