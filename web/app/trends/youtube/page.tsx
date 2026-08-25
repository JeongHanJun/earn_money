import type { Metadata } from "next";
import Link from "next/link";
import { fetchedAt, formatCount, formatRelative, youtubePopular } from "@/lib/trends";

export const metadata: Metadata = {
  title: "YouTube 인기 동영상",
  description: "YouTube Data API 기준 한국 실시간 인기 동영상 Top 25.",
};

export default function YouTubePage() {
  const videos = youtubePopular();
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <Link
        href="/trends"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← 트렌드 대시보드
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          YouTube · 한국 · {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          📺 YouTube 인기 동영상
        </h1>
        <p className="mt-2 text-white/90 text-sm">
          지금 대한민국에서 가장 많이 보는 영상 {videos.length}개.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <a
            key={v.video_id}
            href={`https://www.youtube.com/watch?v=${v.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm hover:shadow-md hover:border-red-400 transition-all"
          >
            <div className="relative aspect-video bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumbnail}
                alt={v.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-0.5 text-xs font-bold text-white">
                #{v.rank}
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity h-14 w-14 rounded-full bg-red-600 flex items-center justify-center text-white">
                  <svg className="h-6 w-6 ml-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="font-medium text-sm text-zinc-900 leading-snug line-clamp-2 group-hover:text-red-700">
                {v.title}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span className="truncate">{v.channel}</span>
                <span className="shrink-0 ml-2 font-medium">
                  조회 {formatCount(v.view_count)}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
