import { Component as Globe } from "@/components/ui/interactive-globe";
import { Activity, Zap, Globe2 } from "lucide-react";

const SIGNAL_MARKERS = [
  { lat: 55.68, lng: 12.57,   label: "Copenhagen" },
  { lat: 52.52, lng: 13.40,   label: "Berlin" },
  { lat: 48.85, lng: 2.35,    label: "Paris" },
  { lat: 51.51, lng: -0.13,   label: "London" },
  { lat: 40.71, lng: -74.01,  label: "New York" },
  { lat: 37.78, lng: -122.42, label: "San Francisco" },
  { lat: 35.68, lng: 139.69,  label: "Tokyo" },
  { lat: 1.35,  lng: 103.82,  label: "Singapore" },
  { lat: -33.87, lng: 151.21, label: "Sydney" },
  { lat: 19.43, lng: -99.13,  label: "Mexico City" },
];

const SIGNAL_CONNECTIONS = [
  { from: [55.68, 12.57],  to: [52.52, 13.40] },
  { from: [55.68, 12.57],  to: [51.51, -0.13] },
  { from: [55.68, 12.57],  to: [48.85, 2.35] },
  { from: [51.51, -0.13],  to: [40.71, -74.01] },
  { from: [40.71, -74.01], to: [37.78, -122.42] },
  { from: [37.78, -122.42], to: [1.35, 103.82] },
  { from: [1.35, 103.82],  to: [35.68, 139.69] },
  { from: [1.35, 103.82],  to: [-33.87, 151.21] },
  { from: [52.52, 13.40],  to: [40.71, -74.01] },
  { from: [40.71, -74.01], to: [19.43, -99.13] },
];

const STATS = [
  { label: "Active Markets", value: "10+", sub: "Cities tracked" },
  { label: "Sync Latency", value: "<2s", sub: "Real-time signals" },
  { label: "Uptime", value: "99.9%", sub: "Signal reliability" },
];

export default function GlobeDemo() {
  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white overflow-hidden relative shadow-sm">
      {/* Ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row min-h-[480px]">
        {/* Left — content */}
        <div className="flex-1 flex flex-col justify-center p-8 lg:p-12 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 mb-6 w-fit">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live signal monitoring
          </div>

          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 leading-tight mb-3">
            Global Signal
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Intelligence
            </span>
          </h2>

          <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-8">
            Signals flowing in real-time from connected CRMs, website trackers,
            and enrichment sources across your target markets.
            Drag the globe to explore.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-6 flex-wrap">
            {STATS.map(({ label, value, sub }, i) => (
              <div key={label} className="flex items-center gap-4">
                {i > 0 && <div className="w-px h-8 bg-gray-200" />}
                <div>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Source badges */}
          <div className="mt-8 flex flex-wrap gap-2">
            {["Salesforce", "Snitcher", "Clay", "HubSpot", "Notion"].map(src => (
              <span
                key={src}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium"
              >
                <Activity className="w-3 h-3" />
                {src}
              </span>
            ))}
          </div>
        </div>

        {/* Right — Globe */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-0 min-h-[380px]">
          <Globe
            size={420}
            markers={SIGNAL_MARKERS}
            connections={SIGNAL_CONNECTIONS}
            dotColor="rgba(59, 130, 246, ALPHA)"
            arcColor="rgba(59, 130, 246, 0.45)"
            markerColor="rgba(34, 197, 94, 1)"
            autoRotateSpeed={0.0015}
          />
        </div>
      </div>
    </div>
  );
}
