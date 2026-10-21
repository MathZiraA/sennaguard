import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, Send, Wrench } from 'lucide-react'
import { api, type ChamadoManual, type ContextoEnlace } from '../lib/api'
import { dataHora, desde } from '../lib/fmt'
import { useSessao } from '../lib/sessao'
import { Botao, Led } from './ui'

export const CATEGORIAS: Record<string, string> = {
  sem_acesso: 'Sem acesso à rede', lentidao: 'Lentidão', instavel: 'Quedas intermitentes', outro: 'Outro problema',
}
export const IMPACTOS: Record<string, string> = { um_pc: 'Um computador', setor: 'Um setor', filial: 'A Filial inteira' }
const STATUS: Record<string, { rotulo: string; cor: string }> = {
  aberto: { rotulo: 'Aberto', cor: 'var(--color-media)' },
  em_atendimento: { rotulo: 'Em atendimento', cor: 'var(--color-fibra)' },
  resolvido: { rotulo: 'Resolvido', cor: 'var(--color-led)' },
}
const ACOES: Record<string, string> = {
  abertura: 'abriu o chamado', comentario: 'comentou', em_atendimento: 'assumiu o atendimento',
  resolvido: 'marcou como resolvido', aberto: 'voltou para aberto', reaberto: 'reabriu ao responder',
}

export function StatusChamado({ status }: { status: string }) {
  const s = STATUS[status]
  return <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: s.cor }}><Led cor={s.cor} pulsa={status === 'aberto'} />{s.rotulo}</span>
}

const campo = 'w-full rounded-lg border border-fio bg-fenda px-3 text-tinta placeholder:text-tinta-4 focus:border-fibra/60 focus:outline-none'

function Opcoes({ legenda, opcoes, valor, onChange, colunas }: { legenda: string; opcoes: Record<string, string>; valor: string; onChange: (v: string) => void; colunas: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12px] font-medium text-tinta-2">{legenda}</legend>
      <div className={`grid gap-2 ${colunas}`}>
        {Object.entries(opcoes).map(([v, r]) => (
          <label key={v} className={`flex h-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-[12px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fibra ${valor === v ? 'border-fibra/60 bg-fibra/10 text-tinta' : 'border-fio text-tinta-3 hover:border-fio-forte hover:text-tinta-2'}`}>
            <input type="radio" className="sr-only" checked={valor === v} onChange={() => onChange(v)} />{r}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Formulário de abertura: o estado do enlace é anexado pelo servidor, o cliente só descreve o problema. */
export function NovoChamado({ onCriado, onCancelar }: { onCriado: (c: ChamadoManual) => void; onCancelar: () => void }) {
  const [f, setF] = useState({ titulo: '', descricao: '', categoria: 'sem_acesso', impacto: 'um_pc' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); setErro(''); setEnviando(true)
    try { onCriado(await api<ChamadoManual>('/api/chamados', { method: 'POST', body: JSON.stringify(f) })) }
    catch (x) { setErro((x as Error).message) } finally { setEnviando(false) }
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Opcoes legenda="O que está acontecendo?" opcoes={CATEGORIAS} valor={f.categoria} onChange={categoria => setF({ ...f, categoria })} colunas="grid-cols-2" />
      <Opcoes legenda="Quem é afetado?" opcoes={IMPACTOS} valor={f.impacto} onChange={impacto => setF({ ...f, impacto })} colunas="grid-cols-3" />
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-tinta-2">Título
        <input required minLength={4} maxLength={120} value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })}
          placeholder="Ex.: Sem internet no setor financeiro" className={`${campo} h-9`} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-tinta-2">Descrição
        <textarea required minLength={10} maxLength={4000} rows={4} value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })}
          placeholder="Desde quando, quais computadores, o que aparece na tela…" className={`${campo} resize-none py-2`} />
      </label>
      <p className="text-[11px] leading-snug text-tinta-3">O estado da fibra e do rádio neste momento é anexado ao chamado automaticamente.</p>
      {erro && <p className="text-[12px] text-desastre">{erro}</p>}
      <div className="flex justify-end gap-2 border-t border-fio pt-4">
        <Botao type="button" onClick={onCancelar}>Cancelar</Botao>
        <Botao type="submit" variante="primario" disabled={enviando}><Send />{enviando ? 'Abrindo…' : 'Abrir chamado'}</Botao>
      </div>
    </form>
  )
}

/** O enlace no instante da abertura, no mesmo desenho do trilho. */
function Foto({ c }: { c: ContextoEnlace }) {
  const linha = (nome: string, up: boolean, ativo: boolean, ms: string, cor: string) => (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="w-12 font-semibold tracking-[0.06em] text-tinta-3">{nome}</span>
      <span className="h-[2px] flex-1 rounded" style={{ background: up ? cor : 'var(--color-desastre)', opacity: up ? (ativo ? 1 : 0.4) : 0.8 }} />
      <span className="num w-28 text-right font-mono" style={{ color: up ? 'var(--color-tinta-2)' : 'var(--color-desastre)' }}>{up ? (ativo ? `ativo · ${ms}` : 'em espera') : 'fora'}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-fio bg-fenda px-4 py-3">
      <div className="text-[11px] font-medium text-tinta-3">Enlace no momento da abertura</div>
      {linha('FIBRA', c.fibra_up, c.caminho === 'fibra', c.fibra_ms, 'var(--color-fibra)')}
      {linha('RÁDIO', c.radio_up, c.caminho === 'radio', c.radio_ms, 'var(--color-radio)')}
    </div>
  )
}

export function DetalheChamado({ id, onMudou }: { id: number; onMudou: () => void }) {
  const { pode, eu } = useSessao()
  const [c, setC] = useState<ChamadoManual | null>(null)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { api<ChamadoManual>(`/api/chamados/manuais/${id}`).then(setC) }, [id])

  const agir = async (url: string, corpo: object) => {
    setOcupado(true)
    try { setC(await api<ChamadoManual>(url, { method: 'POST', body: JSON.stringify(corpo) })); onMudou() } finally { setOcupado(false) }
  }
  if (!c) return <div className="grid h-40 place-items-center text-tinta-3"><Loader2 className="size-5 animate-spin" /></div>

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div><dt className="text-[11px] text-tinta-3">Situação</dt><dd className="mt-1"><StatusChamado status={c.status} /></dd></div>
        <div><dt className="text-[11px] text-tinta-3">Responsável</dt><dd className="mt-1 font-medium">{c.responsavel_nome ?? <span className="text-tinta-3">Ninguém ainda</span>}</dd></div>
        <div><dt className="text-[11px] text-tinta-3">Problema</dt><dd className="mt-1 font-medium">{CATEGORIAS[c.categoria]}</dd></div>
        <div><dt className="text-[11px] text-tinta-3">Afeta</dt><dd className="mt-1 font-medium">{IMPACTOS[c.impacto]}</dd></div>
      </dl>

      <p className="whitespace-pre-wrap leading-relaxed text-tinta-2">{c.descricao}</p>
      {c.contexto && <Foto c={c.contexto} />}

      {pode('atender_chamado') && c.status !== 'resolvido' && (
        <div className="flex gap-2">
          {c.status === 'aberto' && <Botao variante="primario" disabled={ocupado} onClick={() => agir(`/api/chamados/manuais/${c.id}/status`, { status: 'em_atendimento' })}><Wrench />Assumir atendimento</Botao>}
          <Botao disabled={ocupado} onClick={() => agir(`/api/chamados/manuais/${c.id}/status`, { status: 'resolvido' })}><CheckCircle2 />Marcar como resolvido</Botao>
        </div>
      )}

      <section>
        <h3 className="mb-3 text-[13px] font-semibold">Histórico</h3>
        <ol className="relative flex flex-col gap-4 border-l border-fio pl-5">
          {c.registros?.map(r => {
            const daEquipe = r.autor_papel !== 'Cliente'
            return (
              <li key={r.seq} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2 rounded-full ring-4 ring-painel" style={{ background: daEquipe ? 'var(--color-fibra)' : 'var(--color-media)' }} />
                <div className="text-[12px]">
                  <b className="font-semibold text-tinta">{r.autor_nome}</b> <span className="text-tinta-3">{ACOES[r.acao] ?? r.acao} · {dataHora(r.em)}</span>
                </div>
                {r.acao === 'comentario' && <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-painel-alto px-3 py-2 leading-relaxed text-tinta-2">{r.texto}</p>}
                <div className="mt-1 truncate font-mono text-[10px] text-tinta-4" title={r.hash}>#{r.seq} · sha256 {r.hash.slice(0, 24)}…</div>
              </li>
            )
          })}
        </ol>
      </section>

      <form onSubmit={e => { e.preventDefault(); if (texto.trim()) agir(`/api/chamados/manuais/${c.id}/comentario`, { texto }).then(() => setTexto('')) }} className="flex flex-col gap-2">
        <label htmlFor="resp" className="text-[13px] font-semibold">{eu?.papel === 'Cliente' ? 'Responder ao NOC' : 'Responder ao cliente'}</label>
        <textarea id="resp" rows={3} value={texto} onChange={e => setTexto(e.target.value)} maxLength={4000}
          placeholder={c.status === 'resolvido' && eu?.papel === 'Cliente' ? 'Se o problema voltou, conte aqui: o chamado é reaberto.' : 'Escreva uma mensagem…'}
          className={`${campo} resize-none py-2`} />
        <div className="flex justify-end"><Botao type="submit" variante="primario" disabled={ocupado || !texto.trim()}><Send />Enviar</Botao></div>
      </form>
      <p className="text-center text-[11px] text-tinta-4">Aberto por {c.aberto_por_nome} há {desde(c.criado_em)}</p>
    </div>
  )
}
