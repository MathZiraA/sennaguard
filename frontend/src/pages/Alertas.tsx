import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookLock, Check, Sparkles } from 'lucide-react'
import { api, useApi, type Alerta } from '../lib/api'
import { dataHora, duracao, corSev } from '../lib/fmt'
import { TrilhoMini } from '../components/Trilho'
import Modal from '../components/Modal'
import { Botao, Card, Carregando, Led, Segmentado, Sev, Vazio } from '../components/ui'

const SEVS = ['Desastre', 'Alta', 'Média', 'Aviso']

export default function Alertas() {
  const { dados, recarregar } = useApi<Alerta[]>('/api/alertas', 15000)
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = useState<'ativos' | 'todos'>('todos')
  const [sevs, setSevs] = useState<string[]>([])

  const lista = useMemo(() => (dados ?? []).filter(a =>
    (filtro === 'todos' || a.ativo) && (!sevs.length || sevs.includes(a.severidade))), [dados, filtro, sevs])
  const aberto = dados?.find(a => a.id === params.get('id')) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium tracking-[-0.02em] text-[#d9d7e0]">Alertas</h1>
          <p className="mt-1 text-tinta-3">Problemas abertos pelos 9 triggers de redundância nos últimos 7 dias.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SEVS.map(s => {
            const ligado = sevs.includes(s)
            return (
              <button key={s} aria-pressed={ligado} onClick={() => setSevs(ligado ? sevs.filter(x => x !== s) : [...sevs, s])}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${ligado ? 'border-fio-forte bg-painel-alto text-tinta' : 'border-fio text-tinta-3 hover:text-tinta-2'}`}>
                <Led cor={corSev[s]} />{s}
              </button>
            )
          })}
          <Segmentado valor={filtro} onChange={setFiltro} opcoes={[{ v: 'todos', rotulo: 'Todos' }, { v: 'ativos', rotulo: 'Ativos' }]} />
        </div>
      </div>

      {!dados ? <Carregando /> : (
        <Card className="!p-0">
          {lista.length === 0 ? <div className="p-5"><Vazio>Nenhum alerta com esse filtro.</Vazio></div> : (
            <table className="w-full text-left">
              <thead className="text-[11px] font-medium text-tinta-3">
                <tr className="border-b border-fio">
                  <th className="py-3 pl-5 font-medium">Problema</th>
                  <th className="font-medium">Severidade</th>
                  <th className="font-medium">Início</th>
                  <th className="font-medium">Duração</th>
                  <th className="pr-5 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(a => (
                  <tr key={a.id} onClick={() => setParams({ id: a.id })} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setParams({ id: a.id })}
                    className="cursor-pointer border-b border-fio transition-colors last:border-0 hover:bg-white/[0.02] focus-visible:bg-white/[0.03]">
                    <td className="py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <TrilhoMini nome={a.nome} />
                        <div className="min-w-0">
                          <div className="font-medium">{a.nome}</div>
                          <div className="font-mono text-[11px] text-tinta-4">{a.host} · evento {a.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><Sev nome={a.severidade} /></td>
                    <td className="num text-tinta-2">{dataHora(a.inicio)}</td>
                    <td className="num text-tinta-2">{duracao((a.fim ?? Date.now() / 1000) - a.inicio)}</td>
                    <td className="pr-5"><Situacao a={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal lado aberto={!!aberto} onClose={() => setParams({})} titulo={aberto?.nome} descricao={aberto && `${aberto.host} · evento ${aberto.id}`}>
        {aberto && <Detalhe a={aberto} onMudou={recarregar} />}
      </Modal>
    </div>
  )
}

function Situacao({ a }: { a: Alerta }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      {a.ativo
        ? <span className="flex items-center gap-1.5 font-medium text-tinta"><Led cor={corSev[a.severidade]} pulsa />Ativo</span>
        : <span className="text-tinta-3">Resolvido</span>}
      {a.reconhecido && <span className="text-tinta-3">· reconhecido</span>}
      {a.chamado && <span className="rounded-md bg-fibra/12 px-1.5 py-0.5 font-mono text-[11px] text-fibra">{a.chamado}</span>}
    </div>
  )
}

function Detalhe({ a, onMudou }: { a: Alerta; onMudou: () => void }) {
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const reconhecer = async () => {
    setEnviando(true)
    await api(`/api/alertas/${a.id}/reconhecer`, { method: 'POST', body: JSON.stringify({ mensagem: msg }) }).finally(() => setEnviando(false))
    setMsg('')
    onMudou()
  }

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div><dt className="text-[11px] text-tinta-3">Severidade</dt><dd className="mt-1"><Sev nome={a.severidade} /></dd></div>
        <div><dt className="text-[11px] text-tinta-3">Situação</dt><dd className="mt-1"><Situacao a={a} /></dd></div>
        <div><dt className="text-[11px] text-tinta-3">Início</dt><dd className="num mt-1 font-medium">{dataHora(a.inicio)}</dd></div>
        <div><dt className="text-[11px] text-tinta-3">{a.ativo ? 'Aberto há' : 'Durou'}</dt><dd className="num mt-1 font-medium">{duracao((a.fim ?? Date.now() / 1000) - a.inicio)}</dd></div>
      </dl>

      {a.chamado && (
        <Link to="/chamados" className="flex items-center gap-3 rounded-xl border border-fibra/25 bg-fibra/8 px-4 py-3 transition-colors hover:bg-fibra/12">
          <BookLock className="size-4 text-fibra" />
          <div><div className="font-semibold">Chamado {a.chamado}</div><div className="text-[12px] text-tinta-3">Passou de 1 h fora: registrado no livro com hash SHA-256</div></div>
        </Link>
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Sparkles className="size-4 text-fibra" />Análise do Analista IA</h3>
        {a.analise
          ? <div className="rounded-xl border border-fio bg-fenda px-4 py-3.5 leading-relaxed text-tinta-2"><Markdown texto={a.analise} /></div>
          : <p className="text-tinta-3">{a.nivel >= 3 ? 'A análise aparece aqui cerca de 1 min depois da abertura do problema.' : 'Avisos não passam pela IA: só problemas de severidade Média ou maior.'}</p>}
      </section>

      {a.ativo && !a.reconhecido && (
        <section className="flex flex-col gap-2">
          <label htmlFor="msg" className="text-[13px] font-semibold">Reconhecer</label>
          <textarea id="msg" value={msg} onChange={e => setMsg(e.target.value)} rows={3} placeholder="Ex.: técnico a caminho da Filial para checar o alinhamento da antena"
            className="resize-none rounded-lg border border-fio bg-fenda px-3 py-2 text-tinta placeholder:text-tinta-4 focus:border-fibra/60 focus:outline-none" />
          <div className="flex justify-end"><Botao variante="primario" onClick={reconhecer} disabled={enviando}><Check />{enviando ? 'Enviando…' : 'Reconhecer alerta'}</Botao></div>
        </section>
      )}
    </div>
  )
}

/** Markdown mínimo do relatório da IA: títulos em negrito, listas e `código`. */
function Markdown({ texto }: { texto: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith('**') ? <b key={i} className="font-semibold text-tinta">{p.slice(2, -2)}</b>
      : p.startsWith('`') ? <code key={i} className="rounded bg-painel-alto px-1 font-mono text-[11.5px] text-tinta">{p.slice(1, -1)}</code> : p)
  return (
    <div className="flex flex-col gap-1">
      {texto.split('\n').map((l, i) => {
        if (!l.trim()) return <div key={i} className="h-2" />
        const item = l.match(/^\s*(?:-|(\d+)\.)\s+(.*)/)
        return item
          ? <div key={i} className="flex gap-2 pl-1"><span className="num text-tinta-4">{item[1] ? `${item[1]}.` : '•'}</span><span>{inline(item[2])}</span></div>
          : <p key={i}>{inline(l)}</p>
      })}
    </div>
  )
}
