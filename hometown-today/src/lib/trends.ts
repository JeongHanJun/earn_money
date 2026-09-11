/**
 * 트렌드 순수 로직. 한국(kr) Google 급상승 top N만 사용하는 MVP.
 */

export type GoogleTrend = {
  rank: number;
  keyword: string;
  traffic: string;
  pub_date: string;
  articles: Array<{ title: string; url: string; source: string }>;
};

export type CountryTrends = {
  fetched_at: string;
  data: {
    country_code: string;
    country_name: string;
    google_trends: GoogleTrend[];
  };
};

export function pickTopTrends(file: CountryTrends, limit = 5): GoogleTrend[] {
  return (file.data.google_trends ?? []).slice(0, limit);
}
