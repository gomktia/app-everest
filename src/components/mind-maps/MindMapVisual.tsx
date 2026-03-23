import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import { BookOpen, Code, AlertTriangle, Lightbulb, Scale, ShieldAlert, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MindMapNode } from '@/services/mindMapService'

// ─── Color config ──────────────────────────────────────────────────────────

const PALETTE: Record<string, { bg: string; border: string; text: string; line: string; bgHex: string }> = {
  blue:    { bg: 'bg-blue-50 dark:bg-blue-950',       border: 'border-blue-400 dark:border-blue-500',    text: 'text-blue-700 dark:text-blue-200',    line: '#3b82f6', bgHex: '#eff6ff' },
  purple:  { bg: 'bg-purple-50 dark:bg-purple-950',   border: 'border-purple-400 dark:border-purple-500', text: 'text-purple-700 dark:text-purple-200', line: '#8b5cf6', bgHex: '#faf5ff' },
  red:     { bg: 'bg-red-50 dark:bg-red-950',         border: 'border-red-400 dark:border-red-500',      text: 'text-red-700 dark:text-red-200',      line: '#ef4444', bgHex: '#fef2f2' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-400 dark:border-emerald-500', text: 'text-emerald-700 dark:text-emerald-200', line: '#10b981', bgHex: '#ecfdf5' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-950',       border: 'border-cyan-400 dark:border-cyan-500',    text: 'text-cyan-700 dark:text-cyan-200',    line: '#06b6d4', bgHex: '#ecfeff' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-950',   border: 'border-orange-400 dark:border-orange-500', text: 'text-orange-700 dark:text-orange-200', line: '#f97316', bgHex: '#fff7ed' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-950',     border: 'border-amber-400 dark:border-amber-500',  text: 'text-amber-700 dark:text-amber-200',  line: '#f59e0b', bgHex: '#fffbeb' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-950',       border: 'border-rose-400 dark:border-rose-500',    text: 'text-rose-700 dark:text-rose-200',    line: '#f43f5e', bgHex: '#fff1f2' },
}

const TYPE_STYLES: Record<string, { icon: React.ReactNode; label: string; accent: string; accentBorder: string }> = {
  concept:   { icon: <BookOpen className="w-3 h-3" />,       label: 'Conceito',  accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',       accentBorder: 'border-blue-400' },
  example:   { icon: <Code className="w-3 h-3" />,           label: 'Exemplo',   accent: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',   accentBorder: 'border-green-400' },
  exception: { icon: <AlertTriangle className="w-3 h-3" />,  label: 'Exceção',   accent: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200', accentBorder: 'border-orange-400' },
  tip:       { icon: <Lightbulb className="w-3 h-3" />,      label: 'Dica',      accent: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200', accentBorder: 'border-purple-400' },
  rule:      { icon: <Scale className="w-3 h-3" />,          label: 'Regra',     accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',     accentBorder: 'border-slate-400' },
  warning:   { icon: <ShieldAlert className="w-3 h-3" />,    label: 'Atenção',   accent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',             accentBorder: 'border-red-400' },
}

// ─── Custom node components ────────────────────────────────────────────────

interface MindMapNodeData {
  label: string
  detail?: string
  type?: string
  icon?: string
  level: number
  color: string
  isRoot?: boolean
  [key: string]: unknown
}

function RootNode({ data }: { data: MindMapNodeData }) {
  const p = PALETTE[data.color] || PALETTE.blue
  return (
    <div className={cn(
      'px-6 py-4 rounded-2xl shadow-lg border-2 min-w-[180px] max-w-[320px]',
      'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground',
    )}>
      <Handle type="source" position={Position.Right} className="!bg-primary-foreground !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary-foreground !w-2 !h-2" id="bottom" />
      <div className="flex items-center gap-2">
        {data.icon && <span className="text-xl">{data.icon}</span>}
        <span className="text-lg font-bold leading-tight">{data.label}</span>
      </div>
      {data.detail && (
        <p className="mt-1.5 text-xs opacity-80 leading-relaxed line-clamp-3">{data.detail}</p>
      )}
    </div>
  )
}

function BranchNode({ data }: { data: MindMapNodeData }) {
  const p = PALETTE[data.color] || PALETTE.blue
  const t = data.type ? TYPE_STYLES[data.type] : null
  const isLeaf = data.level >= 3

  return (
    <div className={cn(
      'rounded-xl shadow-sm border-2 min-w-[140px]',
      data.level === 1 ? 'max-w-[280px] px-4 py-3' : 'max-w-[250px] px-3 py-2.5',
      p.bg, p.border,
    )}>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" id="top" />
      {!isLeaf && (
        <>
          <Handle type="source" position={Position.Right} className={cn('!w-2 !h-2')} style={{ background: p.line }} />
          <Handle type="source" position={Position.Bottom} className={cn('!w-2 !h-2')} style={{ background: p.line }} id="bottom" />
        </>
      )}
      <div className="flex items-start gap-2">
        {data.icon && <span className="text-base shrink-0 mt-0.5">{data.icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              'font-semibold leading-tight',
              data.level === 1 ? 'text-sm' : 'text-xs',
              p.text,
            )}>{data.label}</span>
            {t && (
              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', t.accent)}>
                {t.icon}{t.label}
              </span>
            )}
          </div>
          {data.detail && (
            <p className={cn(
              'mt-1 text-muted-foreground leading-relaxed line-clamp-3',
              data.level === 1 ? 'text-xs' : 'text-[11px]',
            )}>{data.detail}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  root: RootNode,
  branch: BranchNode,
}

// ─── Layout algorithm ──────────────────────────────────────────────────────

const H_GAP = 280 // horizontal gap between levels
const V_GAP = 20  // vertical gap between siblings
const NODE_HEIGHT = 80 // estimated node height

interface LayoutResult {
  nodes: Node<MindMapNodeData>[]
  edges: Edge[]
  totalHeight: number
}

function layoutTree(
  sourceNodes: MindMapNode[],
  color: string,
  parentId: string | null = null,
  level: number = 0,
  startY: number = 0,
): LayoutResult {
  const nodes: Node<MindMapNodeData>[] = []
  const edges: Edge[] = []
  let currentY = startY

  for (const srcNode of sourceNodes) {
    const nodeId = srcNode.id
    const hasChildren = srcNode.children && srcNode.children.length > 0
    const isRoot = level === 0

    // First, layout children to know their total height
    let childResult: LayoutResult | null = null
    if (hasChildren) {
      childResult = layoutTree(srcNode.children!, color, nodeId, level + 1, currentY)
    }

    const childrenHeight = childResult ? childResult.totalHeight : 0
    const selfHeight = NODE_HEIGHT
    const subtreeHeight = Math.max(selfHeight, childrenHeight)

    // Center this node vertically relative to its children
    const nodeY = hasChildren
      ? currentY + (subtreeHeight - selfHeight) / 2
      : currentY

    const node: Node<MindMapNodeData> = {
      id: nodeId,
      type: isRoot ? 'root' : 'branch',
      position: { x: level * H_GAP, y: nodeY },
      data: {
        label: srcNode.label,
        detail: srcNode.detail,
        type: srcNode.type,
        icon: srcNode.icon,
        level,
        color,
        isRoot,
      },
    }
    nodes.push(node)

    if (parentId) {
      edges.push({
        id: `${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep',
        style: { stroke: (PALETTE[color] || PALETTE.blue).line, strokeWidth: 2 },
        animated: false,
      })
    }

    if (childResult) {
      nodes.push(...childResult.nodes)
      edges.push(...childResult.edges)
    }

    currentY += subtreeHeight + V_GAP
  }

  return {
    nodes,
    edges,
    totalHeight: currentY - startY - (sourceNodes.length > 0 ? V_GAP : 0),
  }
}

// ─── Inner component (needs ReactFlowProvider) ─────────────────────────────

function MindMapFlowInner({ nodes: sourceNodes, color, title }: {
  nodes: MindMapNode[]
  color: string
  title: string
}) {
  const { fitView } = useReactFlow()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () => layoutTree(sourceNodes, color),
    [sourceNodes, color],
  )

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.2 }), 100)
  }, [fitView])

  const toggleFullscreen = () => {
    const el = document.getElementById('mindmap-container')
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const p = PALETTE[color] || PALETTE.blue

  return (
    <div
      id="mindmap-container"
      className={cn(
        'w-full rounded-2xl overflow-hidden border border-border/60 shadow-sm bg-background',
        isFullscreen && 'rounded-none',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isFullscreen ? 'Sair' : 'Tela Cheia'}
        </Button>
      </div>

      {/* Flow */}
      <div className={cn('w-full', isFullscreen ? 'h-[calc(100vh-52px)]' : 'h-[70vh] min-h-[400px]')}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background gap={20} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={() => p.line}
            maskColor="rgba(0,0,0,0.1)"
            className="!bg-background !border-border"
          />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── Public component ──────────────────────────────────────────────────────

interface MindMapVisualProps {
  title: string
  subject: string
  color: string
  nodes: MindMapNode[]
}

export function MindMapVisual({ title, color, nodes }: MindMapVisualProps) {
  return (
    <ReactFlowProvider>
      <MindMapFlowInner nodes={nodes} color={color} title={title} />
    </ReactFlowProvider>
  )
}
