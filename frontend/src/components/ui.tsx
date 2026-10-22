import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { corSev } from '../lib/fmt'

export function Card({ titulo, extra, acao, children, className = '' }: {
  titulo?: ReactNode; extra?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`rounded-xl border border-fio bg-painel px-5 py-5 ${className}`}>
      {titulo && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{titulo}</h2>
            {extra}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}

/** Botãozinho de cabeçalho de card ("Thresholds", "Download", "Details" na referência). */
export function Chip({ ativo = false, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button {...p}
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] [&_svg]:size-3.5 ${ativo ? 'bg-fibra/20 text-tinta' : 'bg-painel-alto text-tinta-2 hover:bg-[#34333b] hover:text-tinta'} ${className}`} />
  )
}

type Variante = 'primario' | 'quieto' | 'perigo' | 'contorno'
const variantes: Record<Variante, string> = {
  primario: 'bg-fibra text-white hover:bg-[#9d8cf5]',
  quieto: 'bg-[#3a3940] text-tinta hover:bg-[#45444c]',
  contorno: 'border border-[#4a4952] text-tinta hover:bg-white/[0.04]',
  perigo: 'bg-desastre/12 text-desastre border border-desastre/25 hover:bg-desastre/20',
}

export function Botao({ variante = 'quieto', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...p}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-[12.5px] font-medium transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 ${variantes[variante]} ${className}`}
    />
  )
}

/** Ponto de status no estilo do LED do equipamento. */
export function Led({ cor, pulsa = false }: { cor: string; pulsa?: boolean }) {
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${pulsa ? 'respira' : ''}`} style={{ background: cor, boxShadow: `0 0 8px ${cor}` }} />
}

export function Sev({ nome }: { nome: string }) {
  const cor = corSev[nome] ?? 'var(--color-tinta-3)'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
      <Led cor={cor} />{nome}
    </span>
  )
}

export function Segmentado<T extends string>({ opcoes, valor, onChange }: { opcoes: { v: T; rotulo: ReactNode }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-fio bg-fenda p-0.5">
      {opcoes.map(o => (
        <button key={o.v} aria-pressed={valor === o.v} onClick={() => onChange(o.v)}
          className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors duration-150 ${valor === o.v ? 'bg-painel-alto text-tinta' : 'text-tinta-3 hover:text-tinta-2'}`}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-medium text-tinta-3">{children}</div>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center rounded-xl border border-dashed border-fio py-10 text-tinta-3">{children}</div>
}

export function Carregando() {
  return <div className="h-40 animate-pulse rounded-2xl bg-painel" />
}
