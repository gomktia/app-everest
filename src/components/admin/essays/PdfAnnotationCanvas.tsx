import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pen,
  Highlighter,
  Type,
  Eraser,
  Undo2,
  Trash2,
  Save,
  Maximize2,
  Minus,
  Circle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Use inline worker (no external file needed)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

type Tool = 'pen' | 'highlighter' | 'text' | 'eraser'
type StrokeWidth = 2 | 4 | 8

interface Point {
  x: number
  y: number
  pressure?: number
}

interface Stroke {
  tool: Tool
  color: string
  width: number
  alpha: number
  points: Point[]
  text?: string
  position?: Point
}

interface PdfAnnotationCanvasProps {
  fileUrl: string
  isImage: boolean
  annotationDataUrl: string | null
  onSave: (dataUrl: string) => void
}

const COLORS = [
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#000000', label: 'Preto' },
]

const STROKE_WIDTHS: { value: StrokeWidth; label: string }[] = [
  { value: 2, label: 'Fino' },
  { value: 4, label: 'Médio' },
  { value: 8, label: 'Grosso' },
]

export const PdfAnnotationCanvas = ({
  fileUrl,
  isImage,
  annotationDataUrl,
  onSave,
}: PdfAnnotationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [activeTool, setActiveTool] = useState<Tool>('pen')
  const [activeColor, setActiveColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>(4)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // PDF rendering state
  const [pdfRenderedUrl, setPdfRenderedUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  // Effective state: treat rendered PDF pages as images
  const effectiveIsImage = isImage || !!pdfRenderedUrl
  const effectiveFileUrl = pdfRenderedUrl || fileUrl

  // Fullscreen refs (mirror for the dialog canvas)
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null)
  const fullscreenImageRef = useRef<HTMLImageElement>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)

  // Render a specific PDF page to data URL
  const renderPdfPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await doc.getPage(pageNum)
    const scale = 2
    const viewport = page.getViewport({ scale })
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = viewport.width
    tempCanvas.height = viewport.height
    const ctx = tempCanvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    return tempCanvas.toDataURL('image/png')
  }, [])

  // Load PDF document and render first page
  useEffect(() => {
    if (isImage || !fileUrl) return

    let cancelled = false
    setPdfLoading(true)
    setPdfError(null)

    const loadPdf = async () => {
      try {
        // Fetch PDF as ArrayBuffer to avoid CORS issues
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error(`Erro ao baixar PDF: ${response.status}`)
        if (cancelled) return

        const arrayBuffer = await response.arrayBuffer()
        if (cancelled) return

        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
        if (cancelled) { doc.destroy(); return }

        pdfDocRef.current = doc
        setTotalPages(doc.numPages)

        // Render first page immediately
        const dataUrl = await renderPdfPage(doc, 1)
        if (cancelled) return

        setPdfRenderedUrl(dataUrl)
        setImageLoaded(false)
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido'
          logger.error('Failed to load PDF:', err)
          setPdfError(msg)
        }
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [isImage, fileUrl, renderPdfPage])

  // Render page when currentPage changes (skip initial load which is handled above)
  const prevPageRef = useRef(1)
  useEffect(() => {
    if (isImage || !pdfDocRef.current || currentPage === prevPageRef.current) return
    prevPageRef.current = currentPage

    let cancelled = false
    setPdfLoading(true)

    const doRender = async () => {
      try {
        const dataUrl = await renderPdfPage(pdfDocRef.current!, currentPage)
        if (!cancelled) {
          setPdfRenderedUrl(dataUrl)
          setStrokes([])
          setImageLoaded(false)
        }
      } catch (err) {
        logger.error('Failed to render page:', err)
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    }

    doRender()
    return () => { cancelled = true }
  }, [isImage, currentPage, renderPdfPage])

  const getActiveCanvas = useCallback(() => {
    return isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
  }, [isFullscreen])

  const getActiveImage = useCallback(() => {
    return isFullscreen ? fullscreenImageRef.current : imageRef.current
  }, [isFullscreen])

  // Sync canvas size to image dimensions
  const syncCanvasSize = useCallback(() => {
    const img = getActiveImage()
    const canvas = getActiveCanvas()
    if (!img || !canvas) return

    const rect = img.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    canvas.width = rect.width
    canvas.height = rect.height
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    setCanvasSize({ width: rect.width, height: rect.height })
  }, [getActiveCanvas, getActiveImage])

  // Redraw all strokes onto a canvas
  const redrawStrokes = useCallback(
    (canvas: HTMLCanvasElement, strokeList: Stroke[]) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const stroke of strokeList) {
        ctx.save()

        if (stroke.tool === 'text' && stroke.text && stroke.position) {
          ctx.globalAlpha = 1
          ctx.fillStyle = stroke.color
          ctx.font = `${stroke.width * 4}px sans-serif`
          ctx.fillText(stroke.text, stroke.position.x, stroke.position.y)
          ctx.restore()
          continue
        }

        if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.strokeStyle = 'rgba(0,0,0,1)'
        } else if (stroke.tool === 'highlighter') {
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 0.3
          ctx.strokeStyle = stroke.color
        } else {
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
          ctx.strokeStyle = stroke.color
        }

        const baseWidth = stroke.tool === 'highlighter' ? stroke.width * 4 : stroke.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (stroke.points.length > 0) {
          const hasPressure = stroke.points.some(p => p.pressure !== undefined && p.pressure !== 0.5)

          if (hasPressure && stroke.tool === 'pen') {
            // Pressure-sensitive rendering: draw segments with varying width
            for (let i = 1; i < stroke.points.length; i++) {
              const prev = stroke.points[i - 1]
              const curr = stroke.points[i]
              const pressure = curr.pressure ?? 0.5
              ctx.lineWidth = baseWidth * (0.3 + pressure * 1.4) // range: 30%-170% of base width

              ctx.beginPath()
              ctx.moveTo(prev.x, prev.y)

              // Smooth curve using midpoints for quadratic bezier
              if (i < stroke.points.length - 1) {
                const next = stroke.points[i + 1]
                const midX = (curr.x + next.x) / 2
                const midY = (curr.y + next.y) / 2
                ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
              } else {
                ctx.lineTo(curr.x, curr.y)
              }
              ctx.stroke()
            }
          } else {
            // Standard rendering with smooth curves (no pressure)
            ctx.lineWidth = baseWidth
            ctx.beginPath()
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

            if (stroke.points.length === 2) {
              ctx.lineTo(stroke.points[1].x, stroke.points[1].y)
            } else {
              // Smooth curve through midpoints
              for (let i = 1; i < stroke.points.length - 1; i++) {
                const curr = stroke.points[i]
                const next = stroke.points[i + 1]
                const midX = (curr.x + next.x) / 2
                const midY = (curr.y + next.y) / 2
                ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
              }
              // Connect to last point
              const last = stroke.points[stroke.points.length - 1]
              ctx.lineTo(last.x, last.y)
            }
            ctx.stroke()
          }
        }

        ctx.restore()
      }
    },
    []
  )

  // Redraw whenever strokes change
  useEffect(() => {
    const canvas = getActiveCanvas()
    if (!canvas) return
    redrawStrokes(canvas, strokes)
  }, [strokes, getActiveCanvas, redrawStrokes, canvasSize])

  // Load existing annotations
  useEffect(() => {
    if (!annotationDataUrl || !effectiveIsImage) return

    const canvas = getActiveCanvas()
    if (!canvas || canvas.width === 0) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
    }
    img.src = annotationDataUrl
  }, [annotationDataUrl, effectiveIsImage, getActiveCanvas, canvasSize])

  // Sync canvas on image load and resize
  useEffect(() => {
    if (!effectiveIsImage || !imageLoaded) return

    syncCanvasSize()

    const handleResize = () => syncCanvasSize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [effectiveIsImage, imageLoaded, syncCanvasSize, isFullscreen])

  // Get position relative to canvas (supports PointerEvent pressure)
  const getPos = useCallback(
    (e: React.PointerEvent | React.MouseEvent | React.TouchEvent): Point => {
      const canvas = getActiveCanvas()
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      let clientX: number, clientY: number
      let pressure = 0.5 // default for mouse

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      } else {
        clientX = (e as React.MouseEvent).clientX
        clientY = (e as React.MouseEvent).clientY
      }

      // Capture pen pressure from PointerEvent
      if ('pressure' in e && (e as React.PointerEvent).pressure > 0) {
        pressure = (e as React.PointerEvent).pressure
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        pressure,
      }
    },
    [getActiveCanvas]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
      if (!effectiveIsImage) return
      e.preventDefault()

      const pos = getPos(e)

      if (activeTool === 'text') {
        const text = prompt('Digite o texto da anotação:')
        if (text) {
          const textStroke: Stroke = {
            tool: 'text',
            color: activeColor,
            width: strokeWidth,
            alpha: 1,
            points: [],
            text,
            position: pos,
          }
          setStrokes((prev) => [...prev, textStroke])
        }
        return
      }

      setIsDrawing(true)
      const newStroke: Stroke = {
        tool: activeTool,
        color: activeColor,
        width: strokeWidth,
        alpha: activeTool === 'highlighter' ? 0.3 : 1,
        points: [pos],
      }
      setCurrentStroke(newStroke)
    },
    [effectiveIsImage, activeTool, activeColor, strokeWidth, getPos]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !currentStroke) return
      e.preventDefault()

      const pos = getPos(e)
      const updatedStroke = {
        ...currentStroke,
        points: [...currentStroke.points, pos],
      }
      setCurrentStroke(updatedStroke)

      // Draw current stroke in real-time
      const canvas = getActiveCanvas()
      if (!canvas) return

      redrawStrokes(canvas, [...strokes, updatedStroke])
    },
    [isDrawing, currentStroke, getPos, getActiveCanvas, redrawStrokes, strokes]
  )

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !currentStroke) return

    setStrokes((prev) => [...prev, currentStroke])
    setCurrentStroke(null)
    setIsDrawing(false)
  }, [isDrawing, currentStroke])

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1))
  }, [])

  const handleClearAll = useCallback(() => {
    setStrokes([])
    const canvas = getActiveCanvas()
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [getActiveCanvas])

  const handleSave = useCallback(() => {
    const img = getActiveImage()
    const annotationCanvas = getActiveCanvas()
    if (!img || !annotationCanvas) return

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = annotationCanvas.width
    tempCanvas.height = annotationCanvas.height
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return

    // Draw original image
    ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height)
    // Draw annotations on top
    ctx.drawImage(annotationCanvas, 0, 0)

    const dataUrl = tempCanvas.toDataURL('image/png')
    onSave(dataUrl)
  }, [getActiveImage, getActiveCanvas, onSave])

  const getCursorClass = () => {
    switch (activeTool) {
      case 'pen':
        return 'cursor-crosshair'
      case 'highlighter':
        return 'cursor-crosshair'
      case 'text':
        return 'cursor-text'
      case 'eraser':
        return 'cursor-cell'
      default:
        return 'cursor-crosshair'
    }
  }

  const toolbarButton = (
    tool: Tool,
    icon: React.ReactNode,
    label: string
  ) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setActiveTool(tool)}
      className={
        activeTool === tool
          ? 'ring-2 ring-primary bg-accent'
          : ''
      }
      title={label}
    >
      {icon}
    </Button>
  )

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center gap-1">
      {/* Drawing tools */}
      {toolbarButton('pen', <Pen className="h-4 w-4" />, 'Caneta')}
      {toolbarButton('highlighter', <Highlighter className="h-4 w-4" />, 'Marcador')}
      {toolbarButton('text', <Type className="h-4 w-4" />, 'Texto')}
      {toolbarButton('eraser', <Eraser className="h-4 w-4" />, 'Borracha')}

      <div className="w-px h-6 bg-border mx-1" />

      {/* Colors */}
      {COLORS.map((c) => (
        <button
          key={c.value}
          onClick={() => setActiveColor(c.value)}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            activeColor === c.value
              ? 'border-foreground scale-125'
              : 'border-transparent'
          }`}
          style={{ backgroundColor: c.value }}
          title={c.label}
        />
      ))}

      <div className="w-px h-6 bg-border mx-1" />

      {/* Stroke width */}
      {STROKE_WIDTHS.map((sw) => (
        <Button
          key={sw.value}
          variant="ghost"
          size="sm"
          onClick={() => setStrokeWidth(sw.value)}
          className={
            strokeWidth === sw.value
              ? 'ring-2 ring-primary bg-accent'
              : ''
          }
          title={sw.label}
        >
          {sw.value === 2 && <Minus className="h-3 w-3" />}
          {sw.value === 4 && <Circle className="h-3 w-3" />}
          {sw.value === 8 && <Circle className="h-4 w-4" />}
        </Button>
      ))}

      <div className="w-px h-6 bg-border mx-1" />

      {/* Actions */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleUndo}
        disabled={strokes.length === 0}
        title="Desfazer"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearAll}
        disabled={strokes.length === 0}
        title="Limpar tudo"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsFullscreen(true)}
        title="Expandir"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      {effectiveIsImage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={strokes.length === 0}
          title="Salvar anotações"
          className="text-green-600 hover:text-green-700"
        >
          <Save className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  const renderImageWithCanvas = (
    imgRef: React.RefObject<HTMLImageElement | null>,
    cvRef: React.RefObject<HTMLCanvasElement | null>,
    ctnRef: React.RefObject<HTMLDivElement | null>
  ) => (
    <div ref={ctnRef} className="relative inline-block w-full">
      <img
        ref={imgRef}
        src={effectiveFileUrl}
        alt="Documento"
        crossOrigin="anonymous"
        className="block w-full h-auto select-none"
        onLoad={() => {
          setImageLoaded(true)
          // Defer sync to next frame so layout is settled
          requestAnimationFrame(() => syncCanvasSize())
        }}
        draggable={false}
      />
      <canvas
        ref={cvRef}
        className={`absolute top-0 left-0 touch-none ${getCursorClass()}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  )

  const isValidFileUrl = useCallback((url: string) => {
    if (!url) return false
    // Allow blob URLs (from local file uploads)
    if (url.startsWith('blob:')) return true
    // Allow Supabase storage URLs
    if (url.includes('supabase.co/storage')) return true
    // Allow common document viewers
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }, [])

  const renderPdfStatus = () => {
    if (pdfError) {
      return (
        <div className="w-full flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-destructive">Erro ao converter PDF: {pdfError}</p>
          {isValidFileUrl(fileUrl) ? (
            <iframe
              src={fileUrl}
              sandbox="allow-same-origin"
              className="w-full h-[600px] border-0 rounded-md mt-4"
              title="PDF do documento"
            />
          ) : (
            <div className="text-sm text-destructive mt-4">URL do arquivo inválida</div>
          )}
        </div>
      )
    }
    if (pdfLoading && !pdfRenderedUrl) {
      return (
        <div className="w-full flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Convertendo PDF para imagem...</p>
        </div>
      )
    }
    return null
  }

  const renderPageNavigation = () => (
    totalPages > 1 ? (
      <div className="flex items-center justify-center gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)) }}
          disabled={currentPage <= 1 || pdfLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)) }}
          disabled={currentPage >= totalPages || pdfLoading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    ) : null
  )

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Arquivo Enviado</CardTitle>
          </div>
          {effectiveIsImage && <div className="mt-2">{renderToolbar()}</div>}
        </CardHeader>
        <CardContent>
          {!isImage && renderPdfStatus()}
          {effectiveIsImage && renderImageWithCanvas(imageRef, canvasRef, containerRef)}
          {!isImage && !pdfError && renderPageNavigation()}
        </CardContent>
      </Card>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Arquivo Enviado</DialogTitle>
            {effectiveIsImage && <div className="mt-2">{renderToolbar()}</div>}
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {!isImage && renderPdfStatus()}
            {effectiveIsImage && renderImageWithCanvas(
              fullscreenImageRef,
              fullscreenCanvasRef,
              fullscreenContainerRef
            )}
            {!isImage && !pdfError && renderPageNavigation()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
