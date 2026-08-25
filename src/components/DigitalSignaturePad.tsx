import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, CheckCircle, AlertCircle, PenLine, Check, Edit3 } from 'lucide-react'

export interface DigitalSignaturePadRef {
  clear: () => void
  isEmpty: () => boolean
  getSignatureDataUrl: () => string | null
  finalize: () => string | null
  isFinalized: () => boolean
}

interface DigitalSignaturePadProps {
  onSignatureChange?: (isEmpty: boolean, dataUrl: string | null) => void
  onFinalize?: (dataUrl: string) => void
  signerName?: string
  date?: string | Date
  strokeColor?: string
  lineWidth?: number
  height?: number
  disabled?: boolean
  className?: string
  title?: string
}

export const DigitalSignaturePad = forwardRef<DigitalSignaturePadRef, DigitalSignaturePadProps>(
  (
    {
      onSignatureChange,
      onFinalize,
      signerName,
      date,
      strokeColor = '#1e3a5f', // Azul Davi Projetos
      lineWidth = 2.5,
      height = 180,
      disabled = false,
      className = '',
      title = 'Área de Assinatura Digital',
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)
    const [isFinalized, setIsFinalized] = useState(false)
    const [savedDataUrl, setSavedDataUrl] = useState<string | null>(null)
    const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)

    // Clear canvas
    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasDrawn(false)
      setIsFinalized(false)
      setSavedDataUrl(null)
      if (onSignatureChange) {
        onSignatureChange(true, null)
      }
    }, [onSignatureChange])

    // Get current drawing data URL (PNG)
    const getSignatureDataUrl = useCallback((): string | null => {
      if (savedDataUrl) return savedDataUrl
      const canvas = canvasRef.current
      if (!canvas || !hasDrawn) return null
      return canvas.toDataURL('image/png')
    }, [hasDrawn, savedDataUrl])

    // Finalize signature explicitly
    const handleFinalizeSignature = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas || !hasDrawn) return null

      const dataUrl = canvas.toDataURL('image/png')
      setIsFinalized(true)
      setSavedDataUrl(dataUrl)

      if (onSignatureChange) {
        onSignatureChange(false, dataUrl)
      }
      if (onFinalize) {
        onFinalize(dataUrl)
      }

      return dataUrl
    }, [hasDrawn, onSignatureChange, onFinalize])

    // Unlock to allow further drawing / editing
    const handleEditSignature = useCallback(() => {
      setIsFinalized(false)
    }, [])

    const isEmpty = useCallback(() => !hasDrawn || !isFinalized, [hasDrawn, isFinalized])
    const getIsFinalized = useCallback(() => isFinalized, [isFinalized])

    useImperativeHandle(
      ref,
      () => ({
        clear: clearCanvas,
        isEmpty,
        getSignatureDataUrl,
        finalize: handleFinalizeSignature,
        isFinalized: getIsFinalized,
      }),
      [clearCanvas, isEmpty, getSignatureDataUrl, handleFinalizeSignature, getIsFinalized],
    )

    // Adjust canvas resolution for high-DPI displays and container width
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      // Save current content if any
      let currentData: string | null = null
      if (hasDrawn) {
        currentData = canvas.toDataURL('image/png')
      }

      canvas.width = rect.width * dpr
      canvas.height = height * dpr

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = lineWidth

        // Restore content after resize if had data
        if (currentData) {
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, height)
          }
          img.src = currentData
        }
      }
    }, [height, strokeColor, lineWidth, hasDrawn])

    useEffect(() => {
      resizeCanvas()
      const handleResize = () => {
        resizeCanvas()
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }, [resizeCanvas])

    const getCanvasCoordinates = (
      e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
    ) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()

      if ('touches' in e) {
        const touch = e.touches[0] || e.changedTouches[0]
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        }
      } else {
        return {
          x: (e as React.MouseEvent).clientX - rect.left,
          y: (e as React.MouseEvent).clientY - rect.top,
        }
      }
    }

    const startDrawing = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      if (disabled || isFinalized) return
      // Prevent scrolling on touch screens when signing
      if ('touches' in e) {
        e.preventDefault()
      }
      const coords = getCanvasCoordinates(e)
      setIsDrawing(true)
      setLastPoint(coords)

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.beginPath()
          ctx.arc(coords.x, coords.y, lineWidth / 2, 0, Math.PI * 2)
          ctx.fillStyle = strokeColor
          ctx.fill()
          setHasDrawn(true)
        }
      }
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || disabled || isFinalized) return
      if ('touches' in e) {
        e.preventDefault()
      }

      const canvas = canvasRef.current
      if (!canvas || !lastPoint) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const coords = getCanvasCoordinates(e)

      ctx.beginPath()
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(coords.x, coords.y)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      setLastPoint(coords)
      setHasDrawn(true)
    }

    const stopDrawing = () => {
      if (!isDrawing) return
      setIsDrawing(false)
      setLastPoint(null)
      // Note: We do NOT auto-finalize here. The user can lift their finger and continue drawing!
    }

    return (
      <div className={`space-y-2 ${className}`}>
        {/* Canvas container */}
        <div
          className={`relative w-full rounded-xl border-2 transition-colors overflow-hidden ${
            disabled
              ? 'border-slate-800 bg-slate-950 opacity-60'
              : isFinalized
                ? 'border-emerald-500/80 bg-white shadow-md shadow-emerald-500/10'
                : hasDrawn
                  ? 'border-blue-500/80 bg-white shadow-inner shadow-slate-200'
                  : 'border-dashed border-slate-700 bg-slate-950/80 hover:border-slate-500'
          }`}
          style={{ minHeight: `${height}px` }}
        >
          {/* Subtle signature guideline & watermark */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none">
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-medium tracking-wide flex items-center gap-1 ${
                  hasDrawn || isFinalized ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                <PenLine
                  className="w-3.5 h-3.5"
                  style={{ color: strokeColor === '#000000' ? '#334155' : strokeColor }}
                />
                {title}
              </span>
              {isFinalized ? (
                <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  <CheckCircle className="w-3 h-3 text-emerald-600" /> Assinatura Finalizada
                </span>
              ) : hasDrawn ? (
                <span className="text-[10px] font-medium text-blue-800 flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">
                  <PenLine className="w-3 h-3 text-blue-600" /> Em edição (clique em Finalizar)
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/50">
                  <AlertCircle className="w-3 h-3" /> Desenhe com o dedo ou mouse
                </span>
              )}
            </div>

            {/* Baseline for signing */}
            <div className="border-b border-dashed border-slate-300 w-full mb-6"></div>
          </div>

          <canvas
            ref={canvasRef}
            className={`w-full touch-none relative z-10 ${
              disabled || isFinalized ? 'cursor-not-allowed' : 'cursor-crosshair'
            }`}
            style={{ height: `${height}px`, display: 'block' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
          />

          {/* Overlay badge when finalized */}
          {isFinalized && (
            <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
              <span className="inline-flex items-center gap-1 bg-emerald-700/90 text-white text-[10px] px-2 py-0.5 rounded shadow">
                <Check className="w-3 h-3" /> Confirmada
              </span>
            </div>
          )}
        </div>

        {/* Info & Action Bar below canvas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
          <div className="text-slate-400 space-y-0.5">
            {signerName && (
              <div>
                <span className="text-slate-500">Signatário:</span>{' '}
                <strong className="text-slate-200">{signerName}</strong>
              </div>
            )}
            {date && (
              <div className="text-[11px] text-slate-500">
                Data / Hora:{' '}
                {date instanceof Date
                  ? date.toLocaleString('pt-BR')
                  : new Date(date).toLocaleString('pt-BR')}
              </div>
            )}
          </div>

          {!disabled && (
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              {/* Botão Limpar / Refazer */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearCanvas}
                disabled={!hasDrawn && !isFinalized}
                className="h-8 px-2.5 text-xs border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Limpar
              </Button>

              {/* Botão Editar / Continuar Desenhando (quando já finalizou) */}
              {isFinalized ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditSignature}
                  className="h-8 px-3 text-xs border-blue-600/60 bg-blue-950/40 text-blue-300 hover:bg-blue-900/60 hover:text-white"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1 text-blue-400" />
                  Continuar Desenhando
                </Button>
              ) : (
                /* Botão Finalizar Assinatura */
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFinalizeSignature}
                  disabled={!hasDrawn}
                  className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Finalizar Assinatura
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  },
)

DigitalSignaturePad.displayName = 'DigitalSignaturePad'
