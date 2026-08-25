import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AppDataService } from '@/services/appDataService'
import { Company } from '@/types'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Lock } from 'lucide-react'

interface CompanySelectProps {
  value?: string
  onChange: (companyId: string) => void
  disabled?: boolean
  required?: boolean
  label?: string
  description?: string
  className?: string
}

export const CompanySelect: React.FC<CompanySelectProps> = ({
  value,
  onChange,
  disabled = false,
  required = true,
  label = 'Empresa (Tenant)',
  description,
  className = '',
}) => {
  const { company: authCompany, companies: authCompanies, isAdmin } = useAuth()
  const [companies, setCompanies] = useState<Company[]>(authCompanies || [])
  const [loading, setLoading] = useState<boolean>(authCompanies.length === 0)

  useEffect(() => {
    if (authCompanies && authCompanies.length > 0) {
      setCompanies(authCompanies)
      setLoading(false)
    } else {
      AppDataService.getCompanies()
        .then((list) => {
          setCompanies(list)
        })
        .finally(() => setLoading(false))
    }
  }, [authCompanies])

  // Se o valor estiver vazio mas tivermos uma empresa atual ou padrão, aplicar via onChange
  useEffect(() => {
    if (!value && (authCompany?.id || companies[0]?.id)) {
      const defaultId = authCompany?.id || companies[0]?.id
      if (defaultId) {
        onChange(defaultId)
      }
    }
  }, [value, authCompany?.id, companies, onChange])

  const effectiveValue = value || authCompany?.id || companies[0]?.id || ''
  const isSelectDisabled = disabled || (!isAdmin && !!authCompany?.id)
  const currentSelectedCompany = companies.find((c) => c.id === effectiveValue)

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          {label} {required && <span className="text-red-400">*</span>}
        </Label>
        {!isAdmin && (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-slate-500" /> Vinculado ao seu perfil
          </span>
        )}
      </div>

      <Select
        value={effectiveValue}
        onValueChange={onChange}
        disabled={isSelectDisabled || loading}
      >
        <SelectTrigger
          className={`bg-slate-950 border-slate-800 text-slate-200 text-xs w-full ${
            isSelectDisabled ? 'opacity-90 bg-slate-900 cursor-not-allowed text-slate-300' : ''
          }`}
        >
          <SelectValue placeholder={loading ? 'Carregando empresas...' : 'Selecione a empresa'} />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-60">
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              <div className="flex flex-col text-left py-0.5">
                <span className="font-semibold text-slate-100">{c.trade_name || c.name}</span>
                {c.trade_name && c.trade_name !== c.name && (
                  <span className="text-[10px] text-slate-400">{c.name}</span>
                )}
                {c.cnpj && (
                  <span className="text-[10px] text-slate-500 font-mono">CNPJ: {c.cnpj}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {description && <p className="text-[11px] text-slate-400">{description}</p>}
      {!description && currentSelectedCompany && (
        <p className="text-[10px] text-slate-500 truncate">
          Empresa:{' '}
          <span className="text-slate-400 font-medium">
            {currentSelectedCompany.trade_name || currentSelectedCompany.name}
          </span>
          {currentSelectedCompany.cnpj ? ` • CNPJ: ${currentSelectedCompany.cnpj}` : ''}
        </p>
      )}
    </div>
  )
}
