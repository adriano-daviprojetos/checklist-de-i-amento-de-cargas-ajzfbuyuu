import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  HardHat,
  Truck,
  Anchor,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

export const LoginModal: React.FC<{ isOpen?: boolean; onClose?: () => void }> = () => {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('adriano@daviprojetos.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await login(identifier, password)
      if (!res.success) {
        setError(res.error || 'Falha ao autenticar.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const setDemoAccount = (email: string) => {
    setIdentifier(email)
    setPassword('Skip@Pass')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.svg"
              alt="DAVI PROJETOS CHECKLIST"
              className="w-full max-w-[320px] h-auto object-contain drop-shadow-xl"
            />
          </div>
          <p className="text-sm text-slate-400">Checklist e Gestão de Içamento de Cargas Pesadas</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
              Offline-First
            </Badge>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
              Multi-Tenant
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
              NR-11 & NR-12
            </Badge>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Acessar Sistema</CardTitle>
            <CardDescription className="text-slate-400">
              Entre com seu e-mail corporativo ou CPF cadastrado
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg flex items-center gap-2 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-slate-200">
                  E-mail ou CPF
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="ex: usuario@empresa.com ou 123.456.789-00"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-200">
                    Senha
                  </Label>
                  <span className="text-xs text-slate-500">Padrão: Skip@Pass</span>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-800 text-white focus:border-blue-500"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Quick Demo Role Logins */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Acessos Rápidos de Demonstração (Perfis):</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDemoAccount('adriano@daviprojetos.com.br')}
              className="p-2 text-left bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded text-xs transition"
            >
              <div className="font-semibold text-blue-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Administrador
              </div>
              <div className="text-[11px] text-slate-400 truncate">adriano@daviprojetos.com.br</div>
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('supervisor@gebrigging.com.br')}
              className="p-2 text-left bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded text-xs transition"
            >
              <div className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Supervisor
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                supervisor@gebrigging.com.br
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('rigger@gebrigging.com.br')}
              className="p-2 text-left bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded text-xs transition"
            >
              <div className="font-semibold text-amber-400 flex items-center gap-1">
                <Anchor className="w-3.5 h-3.5" /> Rigger
              </div>
              <div className="text-[11px] text-slate-400 truncate">rigger@gebrigging.com.br</div>
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('operador@gebrigging.com.br')}
              className="p-2 text-left bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded text-xs transition"
            >
              <div className="font-semibold text-purple-400 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Operador Guindaste
              </div>
              <div className="text-[11px] text-slate-400 truncate">operador@gebrigging.com.br</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
