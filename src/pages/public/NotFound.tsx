import { Link } from 'react-router-dom'
import { Seo } from '../../components/Seo'

export default function NotFound() {
  return (
    <div className="container-sito flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <Seo titolo="Pagina non trovata" />
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Pagina non trovata</h1>
      <p className="mt-2 text-slate-500">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link to="/" className="btn-primary mt-6">Torna alla home</Link>
    </div>
  )
}
