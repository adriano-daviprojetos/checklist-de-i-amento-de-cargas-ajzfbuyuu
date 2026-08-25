import React, { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { DigitalSignaturePad, DigitalSignaturePadRef } from './DigitalSignaturePad'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Lock,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react'

interface FinalizeChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: {
    status: 'Concluído' | 'Reprovado'
    inspectorName: string
    signatureData: string
    signedAt: string
    userId?: string
  }) => Promise<void>
  targetStatus: 'Concluído' | 'Reprovado'
  checklistCode?: string
  checklistTitle?: string
  answeredCount: number
  totalItems: number
  criticalFailsCount: number
  saving?: boolean
}

export const FinalizeChecklistModal: React.FC<FinalizeChecklistModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetStatus,
  checklistCode,
  checklistTitle,
  answeredCount,
  totalItems,
  criticalFailsCount,
  saving = false,
}) => {
  const { user } = useAuth()
  const authenticatedName = user?.name || user?.email || 'Usuário Autenticado'
  const authenticatedUserId = user?.id || ''
  const authenticatedRole = user?.role || 'Operacional'

  const [signatureError, setSignatureError] = useState<string | null>(null)
  const signaturePadRef = useRef<DigitalSignaturePadRef | null>(null)
  const [, setHasSignature] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)

  const currentDate = new Date()

  // Reset or initialize state on dialog open
  useEffect(() => {
    if (isOpen) {
      setSignatureError(null)
      setHasSignature(false)
      setSignatureData(null)
      if (signaturePadRef.current) {
        signaturePadRef.current.clear()
      }
    }
  }, [isOpen])

  const handleSignatureChange = (isEmpty: boolean, dataUrl: string | null) => {
    setHasSignature(!isEmpty)
    setSignatureData(dataUrl)
    if (!isEmpty && signatureError) {
      setSignatureError(null)
    }
  }

  const handleConfirm = async () => {
    if (!authenticatedName.trim()) {
      setSignatureError('Não foi possível identificar o usuário autenticado.')
      return
    }

    const currentSig = signatureData || signaturePadRef.current?.getSignatureDataUrl()

    if (!currentSig || signaturePadRef.current?.isEmpty()) {
      setSignatureError(
        'A assinatura digital do responsável logado é obrigatória para finalizar o checklist.',
      )
      return
    }

    setSignatureError(null)
    await onConfirm({
      status: targetStatus,
      inspectorName: authenticatedName.trim(),
      signatureData: currentSig,
      signedAt: new Date().toISOString(),
      userId: authenticatedUserId,
    })
  }

  const isCompleted = targetStatus === 'Concluído'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !saving && !open && onClose()}>
      <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-white p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              className={
                isCompleted
                  ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-700'
                  : 'bg-red-950/90 text-red-400 border border-red-700'
              }
            >
              {isCompleted ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Liberação da Operação
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Bloqueio / Reprovação
                </span>
              )}
            </Badge>
            <span className="text-xs font-mono text-slate-400">{checklistCode}</span>
          </div>

          <DialogTitle className="text-xl font-bold text-white tracking-tight">
            {isCompleted ? 'Finalizar & Liberar Operação' : 'Encerrar & Reprovar Checklist'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {isCompleted
              ? 'Para validar a conformidade e autorizar o içamento, colete a assinatura digital do responsável técnico abaixo.'
              : 'Ao reprovar a operação, a assinatura do responsável é registrada para fins de auditoria e segurança.'}
          </DialogDescription>
        </DialogHeader>

        {/* Operational Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Itens Respondidos</span>
            <strong className="text-slate-200">
              {answeredCount} / {totalItems}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Não-Conformidades</span>
            <strong className={criticalFailsCount > 0 ? 'text-red-400' : 'text-emerald-400'}>
              {criticalFailsCount} {criticalFailsCount > 0 ? '(Críticas)' : '(0)'}
            </strong>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-500 block text-[11px]">Data de Finalização</span>
            <strong className="text-slate-200">
              {currentDate.toLocaleDateString('pt-BR')} às{' '}
              {currentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
        </div>

        {criticalFailsCount > 0 && isCompleted && (
          <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção:</strong> Existem itens com reprovação crítica identificados.
              Certifique-se de que medidas mitigatórias foram adotadas antes de assinar a liberação.
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1">
          {/* Signer Identification Card (Preenchimento automático a partir do usuário autenticado) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                Responsável Técnico Autenticado (Signatário)
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Usuário Logado
              </span>
            </Label>

            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                  {authenticatedName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">
                    {authenticatedName}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="capitalize">{authenticatedRole}</span>
                    {user?.cpf && <span>• CPF: {user.cpf}</span>}
                    {user?.email && <span className="hidden sm:inline">• {user.email}</span>}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <Badge
                  variant="outline"
                  className="bg-slate-900 border-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                >
                  <Fingerprint className="w-3 h-3 text-blue-400" />
                  ID: {authenticatedUserId ? authenticatedUserId.slice(0, 8) : 'Sessão'}
                </Badge>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * O checklist será assinado e vinculado ao perfil autenticado acima para fins de
              auditoria técnica.
            </p>
          </div>

          {/* Digital Signature Pad */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                Assinatura Digital Obrigatória *
              </Label>
              <span className="text-[10px] text-slate-400">
                {currentDate.toLocaleDateString('pt-BR')} às{' '}
                {currentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <DigitalSignaturePad
              ref={signaturePadRef}
              onSignatureChange={handleSignatureChange}
              signerName={authenticatedName}
              date={currentDate}
              strokeColor="#1e3a5f" // Azul Davi Projetos #1e3a5f
              height={170}
            />

            {signatureError && (
              <div className="text-xs text-red-400 flex items-center gap-1 mt-1 font-medium animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {signatureError}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
          >
            Voltar à Edição
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className={`text-xs font-semibold text-white shadow-md ${
              isCompleted
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
            }`}
          >
            {saving ? (
              'Processando Assinatura...'
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Assinar & Liberar Operação
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-1.5" /> Assinar & Reprovar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
