import { useState } from 'react'
import { ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useApi, type Chamado, type Integridade } from '../lib/api'
import { dataHora, desde } from '../lib/fmt'
import { TrilhoMini } from '../components/Trilho'
import { Card, Carregando, Led, Sev, Vazio } from '../components/ui'

export default function Chamados() {
  const { dados } = useApi<{ chamados: Chamado[]; integridade: Integridade }>('/api/chamados', 30000)
  const [aberto, setAberto] = useState<string | null>(null)
  if (!dados) return <Carregando />
  const { chamados, integridade: ig } = dados
  const abertos = chamados.filter(c => c.status === 'aberto').length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Chamados</h1>
        <p className="mt-1 text-tinta-3">Quedas que passaram de 1 h viram um chamado NOC-xxx, com e-mail ao cliente e registro no livro encadeado.</p>
      </div>

      <div className={`flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4 ${ig.ok ? 'border-led/25 bg-led/[0.06]' : 'border-desastre/40 bg-desastre/10'}`}>
        {ig.ok ? <ShieldCheck className="size-6 text-led" strokeWidth={1.7} /> : <ShieldAlert className="size-6 text-desastre" strokeWidth={1.7} />}
        <div>
          <div className="font-semibold">{ig.ok ? 'Livro íntegro' : `Livro adulterado no registro ${ig.quebra}`}</div>
          <div className="text-[12px] text-tinta-3">
            {ig.ok ? `${ig.registros} registros, cadeia SHA-256 conferida do primeiro ao último.` : `${ig.motivo}. Os registros a partir dele não têm valor de prova.`}
          </div>
        </div>
        <div className="num ml-auto flex gap-6 text-right">
          <div><div className="text-[22px] font-semibold leading-none">{abertos}</div><div className="mt-1 text-[11px] text-tinta-3">abertos</div></div>
          <div><div className="text-[22px] font-semibold leading-none text-tinta-2">{chamados.length - abertos}</div><div className="mt-1 text-[11px] text-tinta-3">encerrados</div></div>
        </div>
      </div>

      {chamados.length === 0 ? <Vazio>Nenhum chamado. Quedas curtas (menos de 1 h) não geram chamado.</Vazio> : (
        <Card className="!p-0">
          <ul>
            {chamados.map(c => {
              const exp = aberto === c.numero
              return (
                <li key={c.numero} className="border-b border-fio last:border-0">
                  <button onClick={() => setAberto(exp ? null : c.numero)} aria-expanded={exp}
                    className="grid w-full grid-cols-[120px_minmax(0,1fr)_auto_150px_20px] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]">
                    <span className="font-mono text-[12px] font-medium text-fibra">{c.numero}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <TrilhoMini nome={c.nome} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.nome}</span>
                        <span className="num text-[11px] text-tinta-3">aberto em {dataHora(c.inicio)}</span>
                      </span>
                    </span>
                    <Sev nome={c.severidade} />
                    <span className="num text-[12px]">
                      {c.status === 'aberto'
                        ? <span className="flex items-center gap-1.5 font-medium"><Led cor="var(--color-media)" pulsa />Aberto há {desde(new Date(c.inicio).getTime() / 1000)}</span>
                        : <span className="text-tinta-3">Encerrado · {c.duracao}</span>}
                    </span>
                    <ChevronDown className={`size-4 text-tinta-3 transition-transform duration-200 ${exp ? 'rotate-180' : ''}`} />
                  </button>
                  {exp && (
                    <ol className="mx-5 mb-4 flex flex-col gap-2 rounded-xl border border-fio bg-fenda p-4">
                      {c.registros.map(r => (
                        <li key={r.seq} className="grid grid-cols-[48px_110px_120px_minmax(0,1fr)] items-baseline gap-3 text-[12px]">
                          <span className="num font-mono text-tinta-4">#{r.seq}</span>
                          <span className="font-medium capitalize">{r.acao}</span>
                          <span className="num text-tinta-3">{dataHora(r.em)}</span>
                          <span className="truncate font-mono text-[11px] text-tinta-3" title={r.hash}>sha256 {r.hash}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
