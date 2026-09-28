import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Se l'app va in errore mostra il messaggio invece di una pagina bianca. */
export class ErroreAvvio extends Component<{ children: ReactNode }, { errore: Error | null }> {
  state = { errore: null as Error | null }

  static getDerivedStateFromError(errore: Error) {
    return { errore }
  }

  componentDidCatch(errore: Error, info: ErrorInfo) {
    console.error(errore, info.componentStack)
  }

  render() {
    if (!this.state.errore) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card w-full max-w-lg p-6">
          <h1 className="text-lg font-bold text-slate-900">Si è verificato un errore</h1>
          <p className="mt-2 text-sm text-slate-600">Ricarica la pagina. Se il problema continua, invia questo messaggio a chi gestisce il sito:</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs whitespace-pre-wrap text-red-200">{this.state.errore.message}</pre>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Ricarica</button>
        </div>
      </div>
    )
  }
}
