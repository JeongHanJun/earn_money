/**
 * OpenDART API 클라이언트.
 *
 * 원본: opendart.fss.or.kr — 한국어 XML/JSON 응답.
 * 우리는 (1) 영어 필드 매핑, (2) 표준 에러, (3) rate limit 방어를 여기서 처리.
 * 상용화 원칙: 원본 raw 재배포는 안 한다. 지표·이벤트·요약만 판매.
 */

const DEFAULT_BASE = "https://opendart.fss.or.kr/api";

export interface OpenDartConfig {
  key: string;
  baseUrl?: string;
  userAgent?: string;
}

export interface FilingListParams {
  corp_code?: string;
  bgn_de?: string;       // YYYYMMDD
  end_de?: string;
  last_reprt_at?: "Y" | "N";
  pblntf_ty?: string;    // A~J (공시유형)
  pblntf_detail_ty?: string;
  corp_cls?: "Y" | "K" | "N" | "E";  // Y=유가 K=코스닥 N=코넥스 E=기타
  sort?: "date" | "crp" | "rpt";
  sort_mth?: "asc" | "desc";
  page_no?: number;
  page_count?: number;   // max 100
}

export interface FilingListItem {
  corp_code: string;
  corp_name: string;
  corp_cls: string;
  stock_code: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface FilingListResponse {
  status: string;        // 000=OK 013=no data 020=key error 800=service closed
  message: string;
  page_no?: number;
  page_count?: number;
  total_count?: number;
  total_page?: number;
  list?: FilingListItem[];
}

export interface FinancialItem {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  sj_div: string;        // BS/IS/CIS/CF/SCE
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail: string;
  thstrm_nm: string;
  thstrm_amount: string;
  frmtrm_nm: string;
  frmtrm_amount: string;
  bfefrmtrm_nm: string;
  bfefrmtrm_amount: string;
  ord: string;
  currency: string;
}

export interface FinancialResponse {
  status: string;
  message: string;
  list?: FinancialItem[];
}

/**
 * 재시도 가능한 fetch. DART 서버가 간헐적으로 502/504 뱉는 것 대응.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 2, delayMs = 500 }: { retries?: number; delayMs?: number } = {}
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && i < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
    }
  }
  throw lastErr;
}

export class OpenDartClient {
  private key: string;
  private baseUrl: string;
  private userAgent: string;

  constructor(cfg: OpenDartConfig) {
    if (!cfg.key || cfg.key.length !== 40) {
      throw new Error("OpenDART key must be 40 chars");
    }
    this.key = cfg.key;
    this.baseUrl = cfg.baseUrl ?? DEFAULT_BASE;
    this.userAgent = cfg.userAgent ?? "dart-api/0.1";
  }

  private buildUrl(path: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}/${path}`);
    url.searchParams.set("crtfc_key", this.key);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  /**
   * 공시목록 조회. bgn_de만 있으면 그날 이후 전체.
   * 대량 조회는 page_count=100으로 페이지네이션.
   */
  async listFilings(params: FilingListParams): Promise<FilingListResponse> {
    const url = this.buildUrl("list.json", {
      ...params,
      page_count: params.page_count ?? 100,
    });
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`DART list.json HTTP ${res.status}`);
    }
    return (await res.json()) as FilingListResponse;
  }

  /**
   * 단일 회사 재무 (주요 계정만). fnlttSinglAcnt.json
   * reprt_code: 11011=사업 11012=반기 11013=1분기 11014=3분기
   */
  async singleFinancial(
    corp_code: string,
    bsns_year: number,
    reprt_code: string
  ): Promise<FinancialResponse> {
    const url = this.buildUrl("fnlttSinglAcnt.json", {
      corp_code,
      bsns_year,
      reprt_code,
    });
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`DART fnlttSinglAcnt HTTP ${res.status}`);
    }
    return (await res.json()) as FinancialResponse;
  }

  /**
   * 단일 회사 전체 재무 (전체 재무제표). fnlttSinglAcntAll.json
   * fs_div: CFS(연결) / OFS(별도)
   */
  async fullFinancial(
    corp_code: string,
    bsns_year: number,
    reprt_code: string,
    fs_div: "CFS" | "OFS" = "CFS"
  ): Promise<FinancialResponse> {
    const url = this.buildUrl("fnlttSinglAcntAll.json", {
      corp_code,
      bsns_year,
      reprt_code,
      fs_div,
    });
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`DART fnlttSinglAcntAll HTTP ${res.status}`);
    }
    return (await res.json()) as FinancialResponse;
  }

  /**
   * corpCode.xml (zip) 다운로드. 10만 법인 마스터. ArrayBuffer로 반환.
   * unzip은 호출자가 처리 (Cloudflare Workers는 stream API 사용).
   */
  async corpCodeArchive(): Promise<ArrayBuffer> {
    const url = this.buildUrl("corpCode.xml", {});
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": this.userAgent },
    });
    if (!res.ok) {
      throw new Error(`DART corpCode HTTP ${res.status}`);
    }
    return await res.arrayBuffer();
  }
}

/**
 * DART status code → 사람이 읽는 사유.
 */
export function dartStatusLabel(code: string): string {
  const map: Record<string, string> = {
    "000": "OK",
    "010": "미등록 키",
    "011": "사용할 수 없는 키",
    "012": "접근할 수 없는 IP",
    "013": "조회된 데이터 없음",
    "014": "파일이 존재하지 않음",
    "020": "요청 제한 초과",
    "021": "조회 가능한 회사 개수 초과",
    "100": "필드의 부적절한 값",
    "101": "부적절한 접근",
    "800": "시스템 점검 중",
    "900": "정의되지 않은 오류",
    "901": "사용자 계정의 개인정보 보호",
  };
  return map[code] ?? `unknown(${code})`;
}
