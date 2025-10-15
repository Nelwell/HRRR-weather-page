import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// HRRR Model Viewer – CONUS (Prototype)
// ---------------------------------------------------------------------------
// This file is a complete, drop‑in App.tsx for a Vite + React + TS project.
// It fetches pre-rendered HRRR images from NCEP MAG. Because MAG blocks
// hotlinking, the <img> src uses a Netlify Function proxy at
//   /.netlify/functions/mag
// Create that function as mag.js (provided in chat) and a netlify.toml pointing
// functions to "netlify/functions".
// ---------------------------------------------------------------------------

// Focus region
const AREA = "conus" as const;
// Proxy (Netlify Function) base path
const PROXY_BASE = "/.netlify/functions/mag" as const;
// Optional size suffix used by some MAG products (usually blank for HRRR)
const MAG_SIZE_SUFFIX = "" as const; // e.g. "_l" or "_s" if needed

// ----------------------------- Parameter Catalog ---------------------------

type ParamItem = { key: string; label: string };
const PARAM_GROUPS: Array<{ group: string; items: ParamItem[] }> = [
  {
    group: "Aviation (priority)",
    items: [
      { key: "ceiling", label: "Ceiling (AGL)" },
      { key: "vis", label: "Visibility" },
    ],
  },
  {
    group: "Precipitation",
    items: [
      { key: "sim_radar_comp", label: "Simulated Composite Reflectivity" },
      { key: "precip_ptot", label: "Total Precipitation" },
      { key: "snow_total", label: "Snow Total" },
    ],
  },
  {
    group: "Surface / Layer",
    items: [
      { key: "2m_temp_10m_wnd", label: "2 m Temp / 10 m Wind" },
      { key: "2m_dewp_10m_wnd", label: "2 m Dewpoint / 10 m Wind" },
      { key: "10m_wnd", label: "10 m Wind" },
    ],
  },
  {
    group: "Upper Air",
    items: [
      { key: "700_rh_ht", label: "700 mb RH/Height" },
      { key: "850_temp_ht", label: "850 mb Temp/Height" },
      { key: "300_wnd", label: "300 mb Wind" },
    ],
  },
];

// ----------------------------- Helpers ------------------------------------

function utcHourNow(): number {
  return new Date().getUTCHours();
}

function isExtendedCycle(hour: number): boolean {
  return [0, 6, 12, 18].includes(hour);
}

function listHoursForCycle(hour: number): number[] {
  const max = isExtendedCycle(hour) ? 48 : 18;
  return Array.from({ length: max + 1 }, (_, i) => i);
}

function zFmt(h: number) {
  return `${String(h).padStart(2, "0")}Z`;
}

function buildMagFilename(model: string, area: string, fhr: number, param: string) {
  const fh = `${String(fhr).padStart(3, "0")}00`; // HHHMM (MM=00)
  return `${model}_${area}_${fh}_${param}${MAG_SIZE_SUFFIX}.gif`;
}

function buildMagDirectUrl(args: {
  model?: string;
  area?: string;
  cycleHour: number;
  fhr: number;
  param: string;
}) {
  const { model = "hrrr", area = AREA, cycleHour, fhr, param } = args;
  const file = buildMagFilename(model, area, fhr, param);
  const cyc = String(cycleHour).padStart(2, "0");
  return `https://mag.ncep.noaa.gov/data/${model}${cyc}/${file}`;
}

function buildMagProxyUrl(args: {
  model?: string;
  area?: string;
  cycleHour: number;
  fhr: number;
  param: string;
}) {
  const { model = "hrrr", area = AREA, cycleHour, fhr, param } = args;
  const qs = new URLSearchParams({
    model,
    area,
    cycle: String(cycleHour).padStart(2, "0"),
    fhr: String(fhr).padStart(3, "0"),
    param,
  });
  return `${PROXY_BASE}?${qs.toString()}`;
}

// ----------------------------- UI Component -------------------------------

export default function App() {
  const [cycleHour, setCycleHour] = useState<number>(utcHourNow());
  const [activeParam, setActiveParam] = useState<string>("ceiling");
  const [fhr, setFhr] = useState<number>(3);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(600);
  const [paramFilter, setParamFilter] = useState<string>("");
  const timerRef = useRef<number | null>(null);

  const hours = useMemo(() => listHoursForCycle(cycleHour), [cycleHour]);

  const imageUrlDirect = useMemo(
    () => buildMagDirectUrl({ cycleHour, fhr, param: activeParam }),
    [cycleHour, fhr, activeParam]
  );
  const imageUrl = useMemo(
    () => buildMagProxyUrl({ cycleHour, fhr, param: activeParam }),
    [cycleHour, fhr, activeParam]
  );

  useEffect(() => {
    if (!playing) return;
    timerRef.current = window.setInterval(() => {
      setFhr((prev) => {
        const list = listHoursForCycle(cycleHour);
        const i = list.indexOf(prev);
        return i < 0 || i === list.length - 1 ? list[0] : list[i + 1];
      });
    }, speedMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [playing, speedMs, cycleHour]);

  const filteredGroups = useMemo(() => {
    if (!paramFilter.trim()) return PARAM_GROUPS;
    const q = paramFilter.toLowerCase();
    return PARAM_GROUPS.map((g) => ({
      group: g.group,
      items: g.items.filter((it) => it.label.toLowerCase().includes(q) || it.key.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [paramFilter]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex">
      {/* LEFT: parameter menu */}
      <aside className="w-72 shrink-0 border-r border-slate-800 p-3 space-y-3">
        <div className="text-xl font-semibold">HRRR – CONUS</div>
        <div className="text-xs text-slate-400">One‑stop parameter browser (prototype)</div>

        <div className="relative mt-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-8 pr-2 py-2 rounded-lg bg-slate-900/80 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Search parameters… (e.g. ceiling)"
            value={paramFilter}
            onChange={(e) => setParamFilter(e.target.value)}
          />
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
          {filteredGroups.map((grp) => (
            <div key={grp.group}>
              <div className="mt-3 mb-1 text-sky-300">{grp.group}</div>
              <div className="grid grid-cols-1 gap-1">
                {grp.items.map((it) => {
                  const active = it.key === activeParam;
                  return (
                    <button
                      key={it.key}
                      onClick={() => setActiveParam(it.key)}
                      className={`text-left px-3 py-2 rounded-xl border transition ${
                        active
                          ? "bg-sky-600/20 border-sky-600 text-sky-200"
                          : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="text-sm font-medium">{it.label}</div>
                      <div className="text-[10px] opacity-70">key: {it.key}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 text-[10px] text-slate-400">
          Images: NCEP MAG via Netlify proxy. If a field fails to load, verify the MAG key or try a different run/hour.
        </div>
      </aside>

      {/* CENTER: image viewer */}
      <main className="flex-1 flex flex-col">
        {/* Top controls */}
        <div className="border-b border-slate-800 p-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm opacity-80">Run:</div>
            <select
              value={cycleHour}
              onChange={(e) => setCycleHour(parseInt(e.target.value, 10))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1"
              title="UTC cycle hour"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {zFmt(h)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm opacity-80">Field:</div>
            <div className="text-sm font-mono bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              {activeParam}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm opacity-80">Fhr:</div>
            <div className="text-sm font-mono bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              {String(fhr).padStart(3, "0")}h
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800"
              onClick={() => setFhr((f) => Math.max(0, f - 1))}
              title="Prev hour"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              className={`px-3 py-2 rounded-xl border ${
                playing
                  ? "bg-rose-900/30 border-rose-700 hover:bg-rose-900/50"
                  : "bg-emerald-900/30 border-emerald-700 hover:bg-emerald-900/50"
              }`}
              onClick={() => setPlaying((p) => !p)}
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800"
              onClick={() =>
                setFhr((f) => {
                  const list = listHoursForCycle(cycleHour);
                  const i = list.indexOf(f);
                  return i < 0 || i === list.length - 1 ? list[0] : list[i + 1];
                })
              }
              title="Next hour"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image area */}
        <div className="relative flex-1 bg-slate-900 grid place-items-center overflow-hidden">
          <motion.img
            key={`${imageUrl}`}
            initial={{ opacity: 0.0 }}
            animate={{ opacity: 1.0 }}
            transition={{ duration: 0.25 }}
            src={imageUrl}
            alt={`${activeParam} – HRRR ${AREA.toUpperCase()} ${zFmt(cycleHour)} F${String(fhr).padStart(3, "0")}`}
            className="max-h-full max-w-full select-none"
            onError={(e) => {
              // dim on error so you notice
              (e.currentTarget as HTMLImageElement).style.opacity = "0.25";
            }}
          />

          {/* Debug overlay */}
          <div className="absolute bottom-3 left-3 space-y-1 text-[10px] text-slate-300/80">
            <div className="bg-slate-950/60 rounded-lg px-2 py-1">proxy: {imageUrl}</div>
            <div className="bg-slate-950/60 rounded-lg px-2 py-1">direct: {imageUrlDirect}</div>
          </div>
        </div>

        {/* Hour grid */}
        <div className="border-t border-slate-800 p-3">
          <div className="text-sm mb-1 opacity-80">Forecast hours</div>
          <div className="flex flex-wrap gap-1">
            {hours.map((h) => (
              <button
                key={h}
                onClick={() => setFhr(h)}
                className={`px-2 py-1 rounded-md border text-xs font-mono ${
                  h === fhr
                    ? "bg-sky-600/30 border-sky-600 text-sky-100"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                {String(h).padStart(3, "0")}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* RIGHT: links & tips */}
      <aside className="w-80 shrink-0 border-l border-slate-800 p-3 space-y-3">
        <div className="text-lg">Quick links</div>
        <div className="space-y-2">
          <a
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800"
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-4 w-4" /> Open via proxy (works)
          </a>
          <a
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800"
            href={imageUrlDirect}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" /> Open direct (may 403)
          </a>
        </div>

        <div className="pt-2 text-sm leading-relaxed text-slate-300">
          Tips:
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Extended cycles 00/06/12/18Z go to F048; others to F018.</li>
            <li>If a field errors, confirm the MAG key or try a different run/hour.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
