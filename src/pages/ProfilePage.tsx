import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AppDataService } from '@/services/appDataService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  User,
  Mail,
  Building,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  CreditCard,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'

export const ProfilePage: React.FC = () => {
  const { user, company, role } = useAuth()

  // Form state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const getRoleLabel = (r?: string) => {
    switch (r) {
      case 'superadmin':
        return 'Super Admin'
      case 'admin':
        return 'Administrador'
      case 'gestor':
        return 'Gestor Operacional'
      case 'supervisor':
        return 'Supervisor de Rigging'
      case 'rigger':
        return 'Rigger Especialista'
      case 'sinaleiro':
        return 'Sinaleiro / Amarrador'
      case 'operador':
        return 'Operador de Guindaste'
      default:
        return r || 'Usuário'
    }
  }

  const getRoleBadgeVariant = (r?: string) => {
    switch (r) {
      case 'superadmin':
      case 'admin':
        return 'bg-blue-600/20 text-blue-400 border-blue-500/30'
      case 'gestor':
        return 'bg-purple-600/20 text-purple-400 border-purple-500/30'
      case 'supervisor':
        return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
      case 'rigger':
        return 'bg-amber-600/20 text-amber-400 border-amber-500/30'
      case 'sinaleiro':
        return 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    // Validations
    if (!oldPassword.trim()) {
      setErrorMessage('Por favor, informe sua senha atual.')
      toast.warning('Informe sua senha atual.')
      return
    }

    if (!newPassword.trim()) {
      setErrorMessage('Por favor, digite a nova senha.')
      toast.warning('Digite a nova senha.')
      return
    }

    if (newPassword.trim().length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      toast.warning('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('A confirmação da nova senha não confere.')
      toast.warning('A confirmação da nova senha não confere.')
      return
    }

    if (oldPassword === newPassword) {
      setErrorMessage('A nova senha não pode ser idêntica à senha atual.')
      toast.warning('A nova senha deve ser diferente da atual.')
      return
    }

    setIsSubmitting(true)
    try {
      await AppDataService.changeOwnPassword(oldPassword, newPassword, confirmPassword)
      setSuccessMessage('Sua senha foi alterada com sucesso!')
      toast.success('Senha atualizada com sucesso!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowOldPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    } catch (err: any) {
      console.error('Error changing password:', err)
      const msg =
        err.data?.message ||
        err.data?.data?.oldPassword?.message ||
        err.data?.data?.password?.message ||
        err.message ||
        'Erro ao alterar senha. Verifique se a senha atual está correta.'
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-blue-500" />
          Meu Perfil
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Visualize seus dados cadastrais e gerencie suas credenciais de segurança.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* User Information Card */}
        <div className="md:col-span-5 space-y-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardHeader className="pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base text-white truncate">
                    {user?.name || 'Usuário Autenticado'}
                  </CardTitle>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-2 py-0.5 uppercase ${getRoleBadgeVariant(role)}`}
                    >
                      <Shield className="w-3 h-3 mr-1 inline" />
                      {getRoleLabel(role)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  E-mail de Login
                </span>
                <p className="text-slate-200 font-medium pl-5 break-all">
                  {user?.email || 'Não informado'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  Empresa Vinculada
                </span>
                <p className="text-slate-200 font-medium pl-5">
                  {company?.trade_name || company?.name || 'Empresa Padrão'}
                </p>
                {company?.cnpj && (
                  <p className="text-[11px] text-slate-400 pl-5">CNPJ: {company.cnpj}</p>
                )}
              </div>

              {user?.cpf && (
                <div className="space-y-1">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    CPF (Login Alternativo)
                  </span>
                  <p className="text-slate-200 font-mono pl-5">{user.cpf}</p>
                </div>
              )}

              {user?.phone && (
                <div className="space-y-1">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    Telefone / WhatsApp
                  </span>
                  <p className="text-slate-200 pl-5">{user.phone}</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Status da Conta:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ativo
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Security Notice Card */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Lock className="w-4 h-4 text-blue-400" />
              Recomendações de Segurança
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>Use uma senha forte com no mínimo 8 caracteres.</li>
              <li>Não compartilhe sua senha com outros operadores ou colegas.</li>
              <li>Altere sua senha periodicamente para manter a conta segura.</li>
            </ul>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="md:col-span-7">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Alterar Senha
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Preencha os campos abaixo para redefinir sua senha de acesso ao sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Feedback Alerts */}
                {errorMessage && (
                  <Alert
                    variant="destructive"
                    className="bg-red-950/40 border-red-800/60 text-red-300 py-2.5"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle className="text-xs font-semibold">
                      Não foi possível alterar
                    </AlertTitle>
                    <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                  <Alert className="bg-emerald-950/40 border-emerald-800/60 text-emerald-300 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <AlertTitle className="text-xs font-semibold">Sucesso</AlertTitle>
                    <AlertDescription className="text-xs">{successMessage}</AlertDescription>
                  </Alert>
                )}

                {/* Senha Atual */}
                <div className="space-y-1.5">
                  <Label htmlFor="old-password" className="text-xs text-slate-300">
                    Senha Atual *
                  </Label>
                  <div className="relative">
                    <Input
                      id="old-password"
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                      disabled={isSubmitting}
                      className="bg-slate-950 border-slate-800 text-white text-xs pr-10 focus:border-blue-500"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      tabIndex={-1}
                      title={showOldPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showOldPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Nova Senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs text-slate-300">
                    Nova Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      disabled={isSubmitting}
                      className="bg-slate-950 border-slate-800 text-white text-xs pr-10 focus:border-blue-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      tabIndex={-1}
                      title={showNewPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    A senha deve ter no mínimo 8 caracteres.
                  </p>
                </div>

                {/* Confirmar Nova Senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs text-slate-300">
                    Confirmar Nova Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      disabled={isSubmitting}
                      className={`bg-slate-950 border-slate-800 text-white text-xs pr-10 focus:border-blue-500 ${
                        confirmPassword && newPassword !== confirmPassword
                          ? 'border-red-500 focus:border-red-500'
                          : ''
                      }`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      tabIndex={-1}
                      title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[11px] text-red-400">As senhas não coincidem.</p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> As senhas coincidem.
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setOldPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setErrorMessage(null)
                      setSuccessMessage(null)
                    }}
                    disabled={isSubmitting || (!oldPassword && !newPassword && !confirmPassword)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Limpar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 px-5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Senha'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
