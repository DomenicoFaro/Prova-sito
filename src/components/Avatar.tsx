export function Avatar({ nome, url, grande = false }: { nome: string; url?: string | null; grande?: boolean }) {
  const dim = grande ? 'h-20 w-20 text-2xl' : 'h-9 w-9 text-sm'
  const iniziali =
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  if (url) return <img src={url} alt={nome} className={`${dim} shrink-0 rounded-full object-cover`} />
  return <span className={`${dim} grid shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white`}>{iniziali}</span>
}
