"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

interface HistoryItem {
  id: string;
  prompt: string;
  revisedPrompt: string | null;
  size: string;
  quality: string;
  imageUrl: string | null;
  createdAt: string;
}

interface ColorSwatch {
  name: string;
  hex: string;
}

interface BrandAsset {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string;
  mimeType: string;
  assetType: string;
  createdAt: string;
}

interface BrandProfile {
  id: string;
  name: string;
  tagline: string | null;
  brandVoice: string | null;
  colorPalette: string | null;
  visualStyle: string | null;
  targetAudience: string | null;
  doList: string | null;
  dontList: string | null;
  extraContext: string | null;
  AdBrandAsset?: BrandAsset[];
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
    sublabel: "2:3 · 1024×1536",
    size: "1024x1536",
    w: 2,
    h: 3,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="5" y="2" width="14" height="20" rx="2" />
      </svg>
    ),
  },
  {
    id: "story",
    label: "Story",
    sublabel: "Story · 1024×1536",
    size: "1024x1536",
    w: 2,
    h: 3,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="7" y="1" width="10" height="22" rx="2" />
      </svg>
    ),
  },
  {
    id: "landscape",
    label: "Landscape",
    sublabel: "3:2 · 1536×1024",
    size: "1536x1024",
    w: 3,
    h: 2,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="2" y="5" width="20" height="14" rx="2" />
      </svg>
    ),
  },
  {
    id: "widescreen",
    label: "Widescreen",
    sublabel: "Wide · 1536×1024",
    size: "1536x1024",
    w: 3,
    h: 2,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
        <rect x="1" y="6" width="22" height="12" rx="2" />
      </svg>
    ),
  },
];

const QUALITY_OPTIONS = [
  { id: "low",    label: "Draft",    desc: "Fast · Low cost" },
  { id: "medium", label: "Standard", desc: "Balanced" },
  { id: "high",   label: "HD",       desc: "Best quality" },
] as const;

const ASSET_TYPE_OPTIONS = [
  { id: "logo",         label: "Logo" },
  { id: "reference",    label: "Reference" },
  { id: "mockup",       label: "Mockup" },
  { id: "color-swatch", label: "Color Swatch" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadImage(b64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:image/png;base64,${b64}`;
  link.download = filename;
  link.click();
}

function fmtTime(date: Date | string) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(date: Date | string) {
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Image Card (session) ─────────────────────────────────────────────────────

function ImageCard({ img }: { img: GeneratedImage }) {
  const [copied, setCopied] = useState(false);
  const aspect = ASPECT_OPTIONS.find((a) => a.size === img.size);
  const paddingPercent = aspect ? (aspect.h / aspect.w) * 100 : 100;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden group transition-all duration-200 hover:border-border-bright">
      <div className="relative w-full bg-[#0a0c10]" style={{ paddingBottom: `${Math.min(paddingPercent, 100)}%` }}>
        <img
          src={`data:image/png;base64,${img.b64_json}`}
          alt={img.prompt}
          className="absolute inset-0 w-full h-full object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/40">
          <button
            onClick={() => downloadImage(img.b64_json, `ad-${img.id}.png`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(img.revised_prompt || img.prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-3 py-1.5 bg-card-elevated text-foreground rounded-lg text-xs font-semibold hover:bg-card-hover transition-colors border border-border shadow-lg"
          >
            {copied ? "Copied!" : "Copy Prompt"}
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{img.revised_prompt || img.prompt}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted bg-card-elevated px-1.5 py-0.5 rounded">{img.size}</span>
          <span className="text-[10px] text-muted bg-card-elevated px-1.5 py-0.5 rounded capitalize">{img.quality}</span>
          <span className="text-[10px] text-muted ml-auto">{fmtTime(img.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: HistoryItem }) {
  const aspect = ASPECT_OPTIONS.find((a) => a.size === item.size);
  const paddingPercent = aspect ? (aspect.h / aspect.w) * 100 : 100;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden group transition-all duration-200 hover:border-border-bright">
      <div className="relative w-full bg-[#0a0c10]" style={{ paddingBottom: `${Math.min(paddingPercent, 100)}%` }}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.prompt}
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="24" height="24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        {item.imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/40">
            <a
              href={item.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors shadow-lg"
            >
              Open Full Size
            </a>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{item.revisedPrompt || item.prompt}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted bg-card-elevated px-1.5 py-0.5 rounded">{item.size}</span>
          <span className="text-[10px] text-muted bg-card-elevated px-1.5 py-0.5 rounded capitalize">{item.quality}</span>
          <span className="text-[10px] text-muted ml-auto">{fmtDate(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab({ brandName }: { brandName: string | null }) {
  const [prompt, setPrompt] = useState("");
  const [selectedAspect, setSelectedAspect] = useState("square");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [brandApplied, setBrandApplied] = useState(false);
  const idCounter = useRef(0);

  const currentAspect = ASPECT_OPTIONS.find((a) => a.id === selectedAspect)!;

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);
    setBrandApplied(false);

    try {
      const res = await fetch("/api/ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, size: currentAspect.size, quality, n: count }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Generation failed"); return; }

      setBrandApplied(!!data.brandApplied);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-5">

        {/* Brand applied indicator */}
        {brandName && (
          <div className="flex items-center gap-2 text-xs text-success bg-success-dim border border-success/20 rounded-lg px-3 py-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Brand context from <strong className="font-semibold">{brandName}</strong> will be auto-injected into every generation.
          </div>
        )}

        {/* Aspect ratio */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Aspect Ratio</p>
          <div className="flex flex-wrap gap-2">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedAspect(opt.id)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all ${
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

        {/* Quality + Count */}
        <div className="flex flex-wrap gap-6">
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
            <span className={`text-[10px] ${prompt.length > 3800 ? "text-warning" : "text-muted"}`}>{prompt.length}/4000</span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleGenerate(); } }}
            placeholder="Describe your ad creative… e.g. 'A bold outdoor ad showcasing our SEO service, dark theme, orange glow'"
            maxLength={4000}
            rows={4}
            className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />
          <p className="text-[10px] text-muted mt-1.5">⌘+Enter / Ctrl+Enter to generate · Brand context is automatically applied</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-danger text-sm bg-danger-dim border border-danger/20 rounded-lg px-4 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

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

      {/* Brand applied notice */}
      {brandApplied && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card-elevated border border-border rounded-lg px-3 py-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" className="text-accent">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Brand context auto-applied to prompt
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="w-full bg-card-elevated" style={{ paddingBottom: `${Math.min((currentAspect.h / currentAspect.w) * 100, 100)}%` }} />
              <div className="px-3 py-2.5 border-t border-border">
                <div className="h-3 bg-card-elevated rounded w-3/4 mb-2" />
                <div className="flex gap-2"><div className="h-2.5 bg-card-elevated rounded w-16" /><div className="h-2.5 bg-card-elevated rounded w-12" /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery */}
      {images.length > 0 && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Session — {images.length} image{images.length !== 1 ? "s" : ""}
            </h2>
            <button onClick={() => setImages([])} className="text-xs text-muted hover:text-danger transition-colors">
              Clear
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((img) => <ImageCard key={img.id} img={img} />)}
          </div>
        </div>
      )}

      {images.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-card-elevated border border-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="32" height="32" className="text-muted">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <p className="font-medium">No creatives yet</p>
            <p className="text-sm text-muted mt-1">Choose aspect ratio, write a prompt, and generate.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Brand Tab ────────────────────────────────────────────────────────────────

function BrandTab({ onBrandLoaded }: { onBrandLoaded: (name: string | null) => void }) {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [doList, setDoList] = useState("");
  const [dontList, setDontList] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [palette, setPalette] = useState<ColorSwatch[]>([]);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#e87f24");

  // Asset upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("reference");
  const [assetDesc, setAssetDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/ads/brand");
      const data = await res.json();
      if (data) {
        setProfile(data);
        setName(data.name || "");
        setTagline(data.tagline || "");
        setBrandVoice(data.brandVoice || "");
        setVisualStyle(data.visualStyle || "");
        setTargetAudience(data.targetAudience || "");
        setDoList(data.doList || "");
        setDontList(data.dontList || "");
        setExtraContext(data.extraContext || "");
        try { setPalette(JSON.parse(data.colorPalette || "[]")); } catch { setPalette([]); }
        setAssets(data.AdBrandAsset || []);
        onBrandLoaded(data.name || null);
      }
      setLoading(false);
    }
    load();
  }, [onBrandLoaded]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, tagline, brandVoice, visualStyle, targetAudience,
          doList, dontList, extraContext,
          colorPalette: JSON.stringify(palette),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); return; }
      setProfile(data);
      onBrandLoaded(data.name || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function addColor() {
    if (!newColorName.trim() || !newColorHex) return;
    setPalette((prev) => [...prev, { name: newColorName.trim(), hex: newColorHex }]);
    setNewColorName("");
    setNewColorHex("#e87f24");
  }

  function removeColor(idx: number) {
    setPalette((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAssetUpload(file: File) {
    if (!assetName.trim()) { setUploadError("Please enter an asset name first."); return; }
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", assetName.trim());
    fd.append("description", assetDesc);
    fd.append("assetType", assetType);

    try {
      const res = await fetch("/api/ads/brand/assets", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || "Upload failed"); return; }
      setAssets((prev) => [data, ...prev]);
      setAssetName("");
      setAssetDesc("");
    } catch {
      setUploadError("Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAsset(id: string) {
    await fetch(`/api/ads/brand/assets/${id}`, { method: "DELETE" });
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  function buildPreview() {
    const lines: string[] = [];
    lines.push(`[BRAND: ${name || "Kootenay Signal"}]`);
    if (tagline) lines.push(`Tagline: "${tagline}"`);
    if (brandVoice) lines.push(`\nBrand Voice: ${brandVoice}`);
    if (visualStyle) lines.push(`\nVisual Style: ${visualStyle}`);
    if (palette.length) lines.push(`\nColor Palette: ${palette.map((c) => `${c.name} ${c.hex}`).join(", ")}`);
    if (targetAudience) lines.push(`\nTarget Audience: ${targetAudience}`);
    if (doList) lines.push(`\nAlways do:\n${doList.split("\n").filter(Boolean).map((l) => `- ${l}`).join("\n")}`);
    if (dontList) lines.push(`\nNever do:\n${dontList.split("\n").filter(Boolean).map((l) => `- ${l}`).join("\n")}`);
    if (extraContext) lines.push(`\nBrand Context: ${extraContext}`);
    lines.push(`\n[AD CREATIVE REQUEST]\n{your prompt here}`);
    return lines.join("\n");
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {[1,2,3].map((i) => <div key={i} className="h-24 bg-card border border-border rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Brand Identity */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Brand Identity</h2>
            <p className="text-xs text-muted-foreground mt-0.5">This context is automatically injected into every ad generation prompt.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors"
            >
              {showPreview ? "Hide" : "Preview"} Context
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Brand"}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-2">{error}</div>
        )}

        {/* Preview */}
        {showPreview && (
          <pre className="text-[11px] text-muted-foreground bg-card-elevated border border-border rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {buildPreview()}
          </pre>
        )}

        {/* Name + Tagline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Brand Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kootenay Signal"
              className="w-full bg-card-elevated border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tagline</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Helping local businesses grow through smart digital marketing"
              className="w-full bg-card-elevated border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Brand Voice */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Brand Voice</label>
          <textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="Bold, confident, and results-driven. Professional but approachable…"
            rows={3}
            className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Visual Style */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Visual Style</label>
          <textarea
            value={visualStyle}
            onChange={(e) => setVisualStyle(e.target.value)}
            placeholder="Dark near-black backgrounds, Signal Orange (#e87f24) accent, high contrast, minimal and clean…"
            rows={3}
            className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Target Audience</label>
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Small and medium-sized businesses in British Columbia…"
            rows={2}
            className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Dos and Donts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-success uppercase tracking-wider mb-1.5">Always Do (one per line)</label>
            <textarea
              value={doList}
              onChange={(e) => setDoList(e.target.value)}
              placeholder={"Use dark backgrounds\nUse orange accents\nKeep it minimal"}
              rows={5}
              className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-danger uppercase tracking-wider mb-1.5">Never Do (one per line)</label>
            <textarea
              value={dontList}
              onChange={(e) => setDontList(e.target.value)}
              placeholder={"Use light backgrounds\nUse competing brand colors\nOvercrowd composition"}
              rows={5}
              className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Extra Context */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Additional Brand Context</label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="Kootenay Signal is a boutique digital marketing agency based in British Columbia, Canada. Core services: SEO, paid ads, email marketing…"
            rows={3}
            className="w-full bg-card-elevated border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Color Palette */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Color Palette</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Brand colors are referenced by name and hex in every generation prompt.</p>
        </div>

        {/* Existing swatches */}
        {palette.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {palette.map((c, i) => (
              <div key={i} className="flex items-center gap-2 bg-card-elevated border border-border rounded-xl px-3 py-2">
                <div className="w-5 h-5 rounded-md border border-border flex-shrink-0" style={{ background: c.hex }} />
                <span className="text-xs font-medium">{c.name}</span>
                <span className="text-[10px] text-muted font-mono">{c.hex}</span>
                <button onClick={() => removeColor(i)} className="text-muted hover:text-danger transition-colors ml-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add color */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-32">
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Color Name</label>
            <input
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Signal Orange"
              className="w-full bg-card-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Hex</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
                className="w-9 h-9 rounded-lg border border-border bg-card-elevated cursor-pointer p-0.5"
              />
              <input
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
                placeholder="#e87f24"
                className="w-24 bg-card-elevated border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          <button
            onClick={addColor}
            disabled={!newColorName.trim()}
            className="px-4 py-2 bg-card-elevated border border-border hover:border-accent text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
          >
            + Add
          </button>
        </div>

        <p className="text-[10px] text-muted">Don't forget to Save Brand above after making changes.</p>
      </div>

      {/* Reference Images */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Reference Images</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Store logos, mockups, and style references. These are saved to the backend and available for brand training.
          </p>
        </div>

        {/* Upload form */}
        <div className="bg-card-elevated border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Asset Name *</label>
              <input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Primary Logo"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
              >
                {ASSET_TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Description</label>
              <input
                value={assetDesc}
                onChange={(e) => setAssetDesc(e.target.value)}
                placeholder="Optional note"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-danger">{uploadError}</p>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAssetUpload(f); }}
            />
            <button
              onClick={() => {
                if (!assetName.trim()) { setUploadError("Enter an asset name first."); return; }
                setUploadError(null);
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload Image
                </>
              )}
            </button>
          </div>
        </div>

        {/* Assets grid */}
        {assets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {assets.map((asset) => (
              <div key={asset.id} className="bg-card-elevated border border-border rounded-xl overflow-hidden group">
                <div className="relative aspect-square bg-[#0a0c10]">
                  <img src={asset.fileUrl} alt={asset.name} className="absolute inset-0 w-full h-full object-contain p-1" />
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-danger/80 hover:bg-danger text-white rounded-full flex items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="px-2 py-1.5 border-t border-border">
                  <p className="text-xs font-medium truncate">{asset.name}</p>
                  <p className="text-[10px] text-muted capitalize">{asset.assetType}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-6">No reference images yet — upload your logo, mockups, and style references.</p>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 24;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    const res = await fetch(`/api/ads/history?limit=${LIMIT}&offset=${off}`);
    const data = await res.json();
    setItems(off === 0 ? (data.items ?? []) : (prev) => [...prev, ...(data.items ?? [])]);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(0); }, [load]);

  function loadMore() {
    const next = offset + LIMIT;
    setOffset(next);
    load(next);
  }

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="w-full bg-card-elevated" style={{ paddingBottom: "100%" }} />
            <div className="px-3 py-2.5 border-t border-border">
              <div className="h-3 bg-card-elevated rounded w-3/4 mb-2" />
              <div className="flex gap-2"><div className="h-2.5 bg-card-elevated rounded w-16" /></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl bg-card-elevated border border-border flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="32" height="32" className="text-muted">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div>
          <p className="font-medium">No history yet</p>
          <p className="text-sm text-muted mt-1">Generated creatives are saved automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} creative{total !== 1 ? "s" : ""} generated</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => <HistoryCard key={item.id} item={item} />)}
      </div>
      {items.length < total && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mx-auto px-6 py-2.5 border border-border hover:border-border-bright text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl transition-colors"
        >
          {loading ? "Loading…" : "Load More"}
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "generate" | "brand" | "history";

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("generate");
  const [brandName, setBrandName] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "generate",
      label: "Generate",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <path d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.02 12.02.707.707M3 12h1m16 0h1M4.927 19.073l.707-.707m12.02-12.02.707-.707M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
        </svg>
      ),
    },
    {
      id: "brand",
      label: "Brand",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "History",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ad Creative Suite</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          GPT-Image-2 powered ad generation — brand-trained, aspect-ratio aware, saved automatically.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card-elevated border border-border rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-card border border-border text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={tab === t.id ? "text-accent" : ""}>{t.icon}</span>
            {t.label}
            {t.id === "brand" && brandName && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "generate" && <GenerateTab brandName={brandName} />}
      {tab === "brand" && <BrandTab onBrandLoaded={setBrandName} />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
