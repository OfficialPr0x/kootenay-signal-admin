"use client";

import { useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedImage {
  id: string;
  b64_json: string;
  revised_prompt: string | null;
  prompt: string;
  size: string;
  quality: string;
  createdAt: Date;
}

// ─── Aspect Ratio Config ──────────────────────────────────────────────────────

interface AspectOption {
  id: string;
  label: string;
  sublabel: string;
  size: string;
  w: number;
  h: number;
  icon: React.ReactNode;
}

const ASPECT_OPTIONS: AspectOption[] = [
  {
    id: "square",
    label: "Square",
    sublabel: "1:1 · 1024×1024",
    size: "1024x1024",
    w: 1,
    h: 1,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: "portrait",
    label: "Portrait",
    sublabel: "3:4 · 768×1024",
    size: "768x1024",
    w: 3,
    h: 4,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="5" y="2" width="14" height="20" rx="2" />
      </svg>
    ),
  },
  {
    id: "story",
    label: "Story",
    sublabel: "9:16 · 1152×2048",
    size: "1152x2048",
    w: 9,
    h: 16,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="7" y="1" width="10" height="22" rx="2" />
      </svg>
    ),
  },
  {
    id: "landscape",
    label: "Landscape",
    sublabel: "4:3 · 1024×768",
    size: "1024x768",
    w: 4,
    h: 3,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="2" y="5" width="20" height="14" rx="2" />
      </svg>
    ),
  },
  {
    id: "widescreen",
    label: "Widescreen",
    sublabel: "16:9 · 2048×1152",
    size: "2048x1152",
    w: 16,
    h: 9,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="1" y="6" width="22" height="12" rx="2" />
      </svg>
    ),
  },
];

const QUALITY_OPTIONS = [
  { id: "low",    label: "Draft",    desc: "Fast · Lower cost" },
  { id: "medium", label: "Standard", desc: "Balanced quality" },
  { id: "high",   label: "HD",       desc: "Best quality" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadImage(b64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:image/png;base64,${b64}`;
  link.download = filename;
  link.click();
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Image Card ───────────────────────────────────────────────────────────────

function ImageCard({ img }: { img: GeneratedImage }) {
  const [copied, setCopied] = useState(false);

  function handleCopyPrompt() {
    navigator.clipboard.writeText(img.revised_prompt || img.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const aspect = ASPECT_OPTIONS.find((a) => a.size === img.size);
  const paddingPercent = aspect ? (aspect.h / aspect.w) * 100 : 100;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden group transition-all duration-200 hover:border-border-bright">
      {/* Image preview */}
      <div className="relative w-full bg-[#0a0c10]" style={{ paddingBottom: `${Math.min(paddingPercent, 100)}%` }}>
        <img
          src={`data:image/png;base64,${img.b64_json}`}
          alt={img.prompt}
          className="absolute inset-0 w-full h-full object-contain"
        />
        {/* Overlay actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/40">
          <button
            onClick={() => downloadImage(img.b64_json, `ad-${img.id}.png`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          <button
            onClick={handleCopyPrompt}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card-elevated text-foreground rounded-lg text-xs font-semibold hover:bg-card-hover transition-colors border border-border shadow-lg"
          >
            {copied ? "Copied!" : "Copy Prompt"}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5 border-t border-border">
        <p className="text-xs text-muted-foreground truncate" title={img.revised_prompt || img.prompt}>
          {img.revised_prompt || img.prompt}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted bg-card-elevated px-1.5 py-0.5 rounded">
            {img.size}
          </span>
          <span className="text-[10px] text-muted bg-card-elevated px-1.5 py-0.5 rounded capitalize">
            {img.quality}
          </span>
          <span className="text-[10px] text-muted ml-auto">{formatTime(img.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdsPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedAspect, setSelectedAspect] = useState("square");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const idCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentAspect = ASPECT_OPTIONS.find((a) => a.id === selectedAspect)!;

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          size: currentAspect.size,
          quality,
          n: count,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      const newImages: GeneratedImage[] = (data.images as { b64_json: string; revised_prompt: string | null }[]).map((img) => ({
        id: String(++idCounter.current),
        b64_json: img.b64_json,
        revised_prompt: img.revised_prompt,
        prompt: trimmed,
        size: currentAspect.size,
        quality,
        createdAt: new Date(),
      }));

      setImages((prev) => [...newImages.reverse(), ...prev]);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, currentAspect, quality, count]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function clearHistory() {
    setImages([]);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ad Creative Suite</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate ad creatives with GPT-Image-2 — select a size, describe your creative, generate.
          </p>
        </div>
        {images.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-muted hover:text-danger transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      {/* Generator panel */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-5">

        {/* Aspect ratio */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Aspect Ratio</p>
          <div className="flex flex-wrap gap-2">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedAspect(opt.id)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  selectedAspect === opt.id
                    ? "border-accent bg-accent-dim text-foreground"
                    : "border-border bg-card-elevated text-muted-foreground hover:border-border-bright hover:text-foreground"
                }`}
              >
                <span className={selectedAspect === opt.id ? "text-accent" : ""}>{opt.icon}</span>
                <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                <span className="text-[10px] text-muted leading-tight">{opt.sublabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality + Count row */}
        <div className="flex flex-wrap gap-6">
          {/* Quality */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Quality</p>
            <div className="flex gap-1.5">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQuality(q.id as "low" | "medium" | "high")}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    quality === q.id
                      ? "border-accent bg-accent-dim text-foreground"
                      : "border-border bg-card-elevated text-muted-foreground hover:border-border-bright hover:text-foreground"
                  }`}
                >
                  <span className="block">{q.label}</span>
                  <span className="block font-normal text-[10px] text-muted mt-0.5">{q.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Images</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                    count === n
                      ? "border-accent bg-accent-dim text-foreground"
                      : "border-border bg-card-elevated text-muted-foreground hover:border-border-bright hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt</p>
            <span className={`text-[10px] ${prompt.length > 3800 ? "text-warning" : "text-muted"}`}>
              {prompt.length}/4000
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your ad creative… e.g. 'A bold outdoor adventure brand ad with mountains in the background, vibrant orange and dark tones, minimal text space at the bottom'"
            maxLength={4000}
            rows={4}
            className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />
          <p className="text-[10px] text-muted mt-1.5">
            Tip: ⌘+Enter / Ctrl+Enter to generate
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-danger text-sm bg-danger-dim border border-danger/20 rounded-lg px-4 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || loading}
          className="flex items-center justify-center gap-2 w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating{count > 1 ? ` ${count} images` : ""}…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                <path d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.02 12.02.707.707M3 12h1m16 0h1M4.927 19.073l.707-.707m12.02-12.02.707-.707M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
              </svg>
              Generate {count > 1 ? `${count} Images` : "Image"}
            </>
          )}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div
                className="w-full bg-card-elevated"
                style={{
                  paddingBottom: `${Math.min((currentAspect.h / currentAspect.w) * 100, 100)}%`,
                }}
              />
              <div className="px-3 py-2.5 border-t border-border">
                <div className="h-3 bg-card-elevated rounded w-3/4 mb-2" />
                <div className="flex gap-2">
                  <div className="h-2.5 bg-card-elevated rounded w-16" />
                  <div className="h-2.5 bg-card-elevated rounded w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image gallery */}
      {images.length > 0 && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Generated — {images.length} image{images.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((img) => (
              <ImageCard key={img.id} img={img} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-card-elevated border border-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="32" height="32" className="text-muted">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <p className="font-medium">No creatives yet</p>
            <p className="text-sm text-muted mt-1">Choose your aspect ratio, write a prompt, and generate.</p>
          </div>
        </div>
      )}
    </div>
  );
}
