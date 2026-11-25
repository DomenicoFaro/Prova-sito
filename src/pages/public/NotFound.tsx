import { Link } from 'react-router-dom'
import { Seo } from '../../components/Seo'

export default function NotFound() {
  return (
    <div className="container-sito flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <Seo titolo="Pagina non trovata" noindex />
      <p className="font-display text-8xl font-extrabold text-brand-300">404</p>
      <h1 className="mt-4 text-3xl font-bold text-brand-950">Pagina non trovata</h1>
      <p className="mt-3 text-slate-600">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link to="/" className="btn-primary btn-grande mt-8">Torna alla home</Link>
    </div>
  )
}
