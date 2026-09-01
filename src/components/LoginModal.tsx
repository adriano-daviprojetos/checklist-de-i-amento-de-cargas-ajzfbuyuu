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
import { AlertCircle, Loader2 } from 'lucide-react'

export const LoginModal: React.FC<{ isOpen?: boolean; onClose?: () => void }> = () => {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background visual accents with brand colors (Navy, Red & Gold) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-700/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -translate-y-1/2 -left-20 w-80 h-80 bg-red-800/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <img
              src="/logo.png"
              alt="DAVI PROJETOS DE RIGGING"
              onError={(e) => {
                const target = e.currentTarget
                if (!target.src.endsWith('/logo.svg')) {
                  target.src = '/logo.svg'
                }
              }}
              className="w-full max-w-[260px] sm:max-w-[280px] h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
            />
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-amber-600/30 rounded-full blur-md group-hover:blur-lg transition duration-300" />
              <img
                src="/seal-10-years.svg"
                alt="10 Anos DAVI PROJETOS (2016-2026)"
                className="relative w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl hover:rotate-3 transition-transform duration-300"
              />
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-300 font-medium">
              Checklist e Gestão de Içamento de Cargas Pesadas
            </p>
            <p className="text-xs text-amber-400/90 font-medium mt-0.5 tracking-wide">
              Comemorando 10 Anos de Excelência em Rigging (2016 - 2026)
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <Badge
              variant="outline"
              className="border-blue-500/40 bg-blue-950/40 text-blue-300 text-xs"
            >
              Offline-First
            </Badge>
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-950/40 text-amber-300 text-xs"
            >
              10 Anos de Rigging
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-xs"
            >
              NR-11 & NR-12
            </Badge>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800/80 bg-slate-900/95 backdrop-blur shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-blue-600 to-amber-500" />
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Acessar Sistema</CardTitle>
            <CardDescription className="text-slate-400">
              Entre com seu e-mail, CPF ou Nome de Usuário
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
                  E-mail, CPF ou Nome de Usuário
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="ex: usuario@empresa.com, 123.456.789-00 ou usuario"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500"
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
      </div>
    </div>
  )
}
