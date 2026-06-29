"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Focus, Loader2, Maximize2, Search, ZoomIn, ZoomOut } from "lucide-react";
import { saBtnSecondarySm, saInput } from "@/components/super-admin/super-admin-dashboard-ui";
import type {
  KnowledgeGraphData,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";
import { EmptyStateInsight, GlassPanel } from "./operations-premium-ui";

type GraphViewMode = "force" | "tree" | "hierarchy" | "path" | "mindmap";

interface PositionedNode extends KnowledgeGraphNode {
  x: number;
  y: number;
}

const NODE_STYLES: Record<string, { fill: string; stroke: string; text: string }> = {
  core: { fill: "#fef2f2", stroke: "#ef4444", text: "#991b1b" },
  essential: { fill: "#fff7ed", stroke: "#f97316", text: "#9a3412" },
  advanced: { fill: "#eef2ff", stroke: "#6366f1", text: "#3730a3" },
  reference: { fill: "#f0f9ff", stroke: "#0ea5e9", text: "#075985" },
  optional: { fill: "#f8fafc", stroke: "#94a3b8", text: "#475569" },
  legacy: { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#64748b" },
  weak: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e" },
  default: { fill: "#f5f3ff", stroke: "#8b5cf6", text: "#5b21b6" },
};

interface InteractiveKnowledgeGraphProps {
  graph: KnowledgeGraphData | null;
  loading?: boolean;
  onOpenEntry?: (entryId: string) => void;
}

export function InteractiveKnowledgeGraph({
  graph,
  loading,
  onOpenEntry,
}: InteractiveKnowledgeGraphProps) {
  const [mode, setMode] = useState<GraphViewMode>("hierarchy");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const svgRef = useRef<SVGSVGElement>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const layoutNodes = useMemo(() => {
    if (!graph) return [];
    return computeLayout(graph.nodes, graph.edges, mode, graph.paths);
  }, [graph, mode]);

  useEffect(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of layoutNodes) map.set(n.id, { x: n.x, y: n.y });
    setPositions(map);
  }, [layoutNodes]);

  const displayNodes = useMemo(() => {
    return layoutNodes.map((n) => ({
      ...n,
      x: positions.get(n.id)?.x ?? n.x,
      y: positions.get(n.id)?.y ?? n.y,
    }));
  }, [layoutNodes, positions]);

  const searchLower = search.toLowerCase();
  const highlightedIds = useMemo(() => {
    if (!searchLower || !graph) return new Set<string>();
    const ids = new Set<string>();
    for (const n of graph.nodes) {
      if (n.label.toLowerCase().includes(searchLower)) ids.add(n.id);
    }
    for (const edge of graph.edges) {
      if (ids.has(edge.source) || ids.has(edge.target)) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [graph, searchLower]);

  const connectedIds = useMemo(() => {
    if (!selectedId || !graph) return new Set<string>();
    const ids = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.source === selectedId) ids.add(e.target);
      if (e.target === selectedId) ids.add(e.source);
    }
    return ids;
  }, [graph, selectedId]);

  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDragging(nodeId);
      setSelectedId(nodeId);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        setPositions((prev) => {
          const next = new Map(prev);
          next.set(dragging, { x, y });
          return next;
        });
      } else if (panStart.current) {
        setPan({
          x: panStart.current.px + (e.clientX - panStart.current.x),
          y: panStart.current.py + (e.clientY - panStart.current.y),
        });
      }
    },
    [dragging, pan.x, pan.y, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    panStart.current = null;
  }, []);

  if (loading) {
    return (
      <GlassPanel compact className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </GlassPanel>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <GlassPanel compact>
        <EmptyStateInsight kind="graph" />
      </GlassPanel>
    );
  }

  const width = 900;
  const height = 440;

  return (
    <div className="space-y-3">
      <GlassPanel compact>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Neural Knowledge Map</h3>
            </div>
            <p className="text-[10px] text-slate-500">
              {graph.nodes.length} concepts · {graph.edges.length} synaptic links
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["force", "tree", "hierarchy", "path", "mindmap"] as GraphViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-all duration-200",
                  mode === m
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                onClick={() => setMode(m)}
              >
                {m === "path" ? "Paths" : m.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search concepts…"
              className={cn(saInput, "py-1.5 pl-8 text-xs")}
            />
          </div>
          <button
            type="button"
            className={cn(saBtnSecondarySm, focusMode && "ring-2 ring-violet-300")}
            onClick={() => setFocusMode((f) => !f)}
            title="Focus mode"
          >
            <Focus className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={saBtnSecondarySm} onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={saBtnSecondarySm} onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={saBtnSecondarySm}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setSelectedId(null);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          className="relative mt-3 overflow-hidden rounded-xl border border-violet-100/80 bg-gradient-to-br from-slate-950 via-indigo-950/90 to-violet-950/80 shadow-inner"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as Element).tagName === "svg") {
              panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.min(2.5, Math.max(0.4, z - e.deltaY * 0.001)));
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.15)_0%,_transparent_70%)]" />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="relative h-[440px] w-full cursor-grab active:cursor-grabbing"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#a5b4fc" />
              </marker>
              <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {graph.edges.map((edge) => {
              const source = displayNodes.find((n) => n.id === edge.source);
              const target = displayNodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;
              const dimmed =
                (searchLower && highlightedIds.size > 0 && !highlightedIds.has(edge.source) && !highlightedIds.has(edge.target)) ||
                (focusMode && selectedId && !connectedIds.has(edge.source) && !connectedIds.has(edge.target));
              const isActive = selectedId && connectedIds.has(edge.source) && connectedIds.has(edge.target);
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2 - 20;

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={isActive ? "url(#edgeGradient)" : "#818cf8"}
                    strokeWidth={isActive ? 2 : 1}
                    strokeOpacity={dimmed ? 0.08 : isActive ? 0.9 : 0.45}
                    markerEnd="url(#arrow)"
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}

            {displayNodes.map((node) => {
              const style = nodeStyle(node);
              const dimmed =
                (searchLower && highlightedIds.size > 0 && !highlightedIds.has(node.id)) ||
                (focusMode && selectedId && !connectedIds.has(node.id));
              const isSelected = selectedId === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onDoubleClick={() => {
                    if (node.entryId && onOpenEntry) onOpenEntry(node.entryId);
                  }}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.15 : 1}
                  filter={isSelected ? "url(#nodeGlow)" : undefined}
                >
                  {isSelected ? (
                    <circle r={42} fill="none" stroke="#a78bfa" strokeWidth={1} opacity={0.5} className="animate-pulse" />
                  ) : null}
                  <rect
                    x={-68}
                    y={-16}
                    width={136}
                    height={32}
                    rx={8}
                    fill={style.fill}
                    stroke={isSelected ? "#a78bfa" : style.stroke}
                    strokeWidth={isSelected ? 2 : 1.5}
                    className="transition-all duration-300 hover:stroke-violet-400"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={style.text}
                    fontSize={9}
                    fontWeight={600}
                    className="pointer-events-none select-none"
                  >
                    {truncate(node.label, 20)}
                  </text>
                </g>
              );
            })}
          </svg>

          <p className="absolute bottom-2 left-3 text-[9px] text-violet-200/60">
            Drag · scroll to zoom · double-click to open · focus isolates connections
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-slate-500">
          {Object.entries(NODE_STYLES)
            .filter(([k]) => k !== "default" && k !== "weak")
            .slice(0, 5)
            .map(([key, s]) => (
              <span key={key} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: s.stroke }} />
                {key}
              </span>
            ))}
        </div>
      </GlassPanel>

      {mode === "path" && graph.paths.length > 0 ? (
        <div className="space-y-2">
          {graph.paths.slice(0, 3).map((path) => (
            <GlassPanel key={path.label} compact>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold capitalize text-indigo-700">
                <GitBranch className="h-3.5 w-3.5" />
                {path.label}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {path.nodeIds.map((nodeId, idx) => {
                  const node = graph.nodes.find((n) => n.id === nodeId);
                  return (
                    <div key={nodeId} className="flex items-center gap-1.5">
                      <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-900">
                        {node?.label ?? nodeId}
                      </span>
                      {idx < path.nodeIds.length - 1 ? <span className="text-slate-300">→</span> : null}
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function computeLayout(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  mode: GraphViewMode,
  paths: KnowledgeGraphData["paths"]
): PositionedNode[] {
  const width = 900;
  const height = 440;

  if (mode === "force") {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.35;
    return nodes.map((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
  }

  if (mode === "mindmap") {
    const cx = width / 2;
    const cy = height / 2;
    return nodes.map((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const r = 80 + (i % 3) * 60;
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
  }

  if (mode === "path" && paths.length > 0) {
    const positioned: PositionedNode[] = [];
    const path = paths[0];
    const y = height / 2;
    const step = width / Math.max(path.nodeIds.length, 1);
    for (let i = 0; i < path.nodeIds.length; i++) {
      const node = nodes.find((n) => n.id === path.nodeIds[i]);
      if (node) positioned.push({ ...node, x: step * (i + 0.5), y });
    }
    for (const n of nodes) {
      if (!positioned.find((p) => p.id === n.id)) {
        positioned.push({ ...n, x: Math.random() * width * 0.8 + 50, y: height * 0.75 });
      }
    }
    return positioned;
  }

  const byModule = new Map<string, KnowledgeGraphNode[]>();
  for (const n of nodes) {
    const mod = n.moduleId ?? "general";
    const list = byModule.get(mod) ?? [];
    list.push(n);
    byModule.set(mod, list);
  }

  const modules = [...byModule.entries()];
  const colWidth = width / Math.max(modules.length, 1);
  const result: PositionedNode[] = [];

  modules.forEach(([mod, modNodes], col) => {
    const x = colWidth * col + colWidth / 2;
    modNodes.forEach((n, row) => {
      const y =
        mode === "hierarchy"
          ? 60 + row * (height - 120) / Math.max(modNodes.length - 1, 1)
          : 80 + row * 48;
      result.push({ ...n, x, y });
    });
  });

  return result;
}

function nodeStyle(node: KnowledgeGraphNode) {
  if (node.quality != null && node.quality < 70) return NODE_STYLES.weak;
  if (node.strength && NODE_STYLES[node.strength]) return NODE_STYLES[node.strength];
  return NODE_STYLES.default;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
