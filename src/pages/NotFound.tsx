/* 404 Page - Displays when a user attempts to access a non-existent route - translate to the language of the user */
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-5xl font-extrabold text-slate-900 dark:text-white">404</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">Página não encontrada</p>
        <div>
          <a
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          >
            Voltar ao Início
          </a>
        </div>
      </div>
    </div>
  )
}

export default NotFound
