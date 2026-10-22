import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowsOut, CaretDown, CaretRight, CellSignalFull, CellSignalX, Cpu, DownloadSimple, FileText, LinkBreak, LinkSimple, Plus, SlidersHorizontal } from '@phosphor-icons/react'
import { useApi, type Alerta, type ListaChamados, type Ponto, type Visao as TVisao } from '../lib/api'
import { dataHora, desde, duracao, hora } from '../lib/fmt'
import { useSessao } from '../lib/sessao'
import Grafico, { faixasSemResposta, type Limite } from '../components/Grafico'
import { StatusChamado } from '../components/Atendimento'
import { Botao, Card, Carregando, Chip } from '../components/ui'

const periodos = [{ h: 6, r: 'Últimas 6 horas' }, { h: 24, r: 'Últimas 24 horas' }, { h: 72, r: 'Últimos 3 dias' }, { h: 168, r: 'Últimos 7 dias' }]

// Limites reais do projeto: troca automática da fibra em 30 ms (netwatch) e trigger do rádio em 50 ms;
// "Normal" = o que a bancada mediu em 16/10/2026.
const LIMITES: Record<'fibra' | 'radio', Limite[]> = {
  fibra: [{ valor: 30, rotulo: 'Crítico', tipo: 'critico' }, { valor: 0.6, rotulo: 'Normal', tipo: 'normal' }],
  radio: [{ valor: 50, rotulo: 'Crítico', tipo: 'critico' }, { valor: 6.4, rotulo: 'Normal', tipo: 'normal' }],
}

const CRITICO = ['Desastre', 'Alta']

/** Nome curto do trigger, para a pílula do alerta (o equivalente ao "12°C" da referência). */
export function curto(nome: string) {
  const n = nome.toUpperCase()
  if (n.startsWith('FILIAL ISOLADA')) return 'Filial isolada'
  if (n.startsWith('PREVISÃO')) return 'Previsão rádio'
  if (n.includes('FIBRA') && n.includes('INSTÁVEL')) return 'Fibra instável'
  if (n.startsWith('LINK FIBRA')) return 'Fibra caiu'
  if (n.startsWith('LINK RÁDIO')) return 'Rádio caiu'
  if (n.includes('PERDA')) return 'Perda no rádio'
  if (n.includes('ACIMA DO NORMAL')) return 'Rádio lento'
  if (n.includes('LATÊNCIA ALTA')) return 'Latência alta'
  if (n.includes('SEM COMUNICAÇÃO')) return 'Failover lento'
  return nome.split(':')[0]
}

export default function Visao() {
  const [horas, setHoras] = useState(24)
  const [enlace, setEnlace] = useState<'fibra' | 'radio'>('fibra')
  const [comLimites, setComLimites] = useState(true)
  const { pode } = useSessao()
  const interno = pode('alertas') // equipe do NOC; o cliente vê os próprios chamados no lugar dos alertas
  const { dados: v } = useApi<TVisao>('/api/visao', 10000, ['visao'])
  const { dados: lat } = useApi<Ponto[]>(`/api/serie/latencia?horas=${horas}`, 60000, ['visao'])
  const { dados: trf } = useApi<Ponto[]>(`/api/serie/trafego?horas=${horas}`, 60000)
  const { dados: alertas } = useApi<Alerta[]>(interno ? '/api/alertas' : '', 30000, ['alertas'])
  const { dados: ch } = useApi<ListaChamados>(interno ? '' : '/api/chamados', 60000, ['chamados'])

  const baixar = (nome: string, linhas: string[]) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([linhas.join('\n')], { type: 'text/csv' })), download: nome })
    a.click()
  }
  const exportar = () => lat && baixar(`sennaguard-latencia-${horas}h.csv`,
    ['horario;latencia_fibra_ms;latencia_radio_ms', ...lat.map(p => `${new Date(p.t * 1000).toISOString()};${p.fibra ?? ''};${p.radio ?? ''}`)])

  const ultimo = lat?.length ? lat[lat.length - 1] : null
  const atual = ultimo?.[enlace] ?? null
  const cor = enlace === 'fibra' ? 'var(--color-fibra)' : 'var(--color-radio)'
  const trafego = trf?.map(p => ({ t: p.t, mbps: p.fibra ?? p.radio }))
  const mbps = trafego?.length ? trafego[trafego.length - 1].mbps : null
  const media = trafego?.length ? trafego.reduce((s, p) => s + (p.mbps ?? 0), 0) / trafego.length : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-[22px] font-medium tracking-[-0.02em] text-titulo">
          Enlaces<CaretRight size={18} weight="bold" className="text-titulo" />Matriz ⇄ Filial
        </h1>
        <div className="flex gap-2.5">
          <Menu.Root>
            <Menu.Trigger asChild><Botao variante="contorno">{periodos.find(p => p.h === horas)?.r}<CaretDown weight="fill" /></Botao></Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-lg border border-fio-forte bg-painel-alto p-1 text-[12.5px] shadow-2xl">
                {periodos.map(p => (
                  <Menu.Item key={p.h} onSelect={() => setHoras(p.h)}
                    className={`flex h-8 cursor-default items-center rounded-md px-2.5 outline-none data-[highlighted]:bg-white/5 ${p.h === horas ? 'text-fibra' : 'text-tinta-2'}`}>
                    {p.r}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          <Botao onClick={exportar}><FileText />Exportar relatório</Botao>
        </div>
      </div>

      {v ? <Contexto v={v} interno={interno} /> : <Carregando />}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="md:!px-9 md:!pt-7 !pb-5"
          titulo={enlace === 'fibra' ? 'Latência da fibra' : 'Latência do rádio'}
          extra={<Valor valor={atual == null ? 'sem resposta' : `${atual.toLocaleString('pt-BR')} ms`} erro={atual == null} cor={cor} quando={ultimo?.t} />}
          acao={<div className="flex gap-1.5">
            <Chip ativo={enlace === 'fibra'} onClick={() => setEnlace('fibra')}>Fibra</Chip>
            <Chip ativo={enlace === 'radio'} onClick={() => setEnlace('radio')}>Rádio</Chip>
            <Chip ativo={comLimites} onClick={() => setComLimites(!comLimites)}><SlidersHorizontal />Limites</Chip>
          </div>}>
          {lat ? <Grafico dados={lat} serie={enlace} cor={cor} unidade="ms" altura={250}
            limites={comLimites ? LIMITES[enlace] : []}
            faixas={faixasSemResposta(lat, enlace, enlace === 'fibra' ? 'Fibra fora' : 'Rádio fora')} />
            : <div className="h-[250px]" />}
        </Card>

        {interno ? <CardAlertas alertas={alertas} baixar={baixar} /> : <CardChamados ch={ch} />}

        <Card className="md:!px-9 md:!pt-7 !pb-5" titulo="Tráfego na Filial"
          extra={<Valor valor={mbps == null ? '—' : `${mbps.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} Mbps`} cor="var(--color-fibra)" quando={trf?.[trf.length - 1]?.t} />}>
          {trafego ? <Grafico dados={trafego} serie="mbps" cor="var(--color-fibra)" unidade="Mbps" altura={150}
            limites={comLimites && media ? [{ valor: Math.round(media), rotulo: 'Média', tipo: 'normal' }] : []} />
            : <div className="h-[150px]" />}
        </Card>

        {lat && v ? <CardCaminho pontos={lat} v={v} alertas={alertas ?? []} /> : <Card><div className="h-[150px]" /></Card>}
      </div>
    </div>
  )
}

function Valor({ valor, cor, quando, erro = false }: { valor: string; cor: string; quando?: number; erro?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="num text-[17px] font-semibold" style={{ color: erro ? 'var(--color-desastre)' : cor }}>{valor}</span>
      {quando && <span className="text-[10.5px] text-tinta-3">há {desde(quando)}</span>}
    </span>
  )
}

/** Faixa do host monitorado, com divisores, como a do sensor na referência. */
function Contexto({ v, interno }: { v: TVisao; interno: boolean }) {
  const s = v.snmp
  const radio = v.enlaces.radio
  const redundante = v.enlaces.fibra.up && radio.up
  const div = <span className="h-5 w-px shrink-0 bg-fio-forte" />
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-x-6 gap-y-2 rounded-[10px] border border-fio bg-painel px-7 py-2.5 text-[13px] text-tinta">
      <span>Host: {v.host}</span>
      {div}
      <span className="flex items-center gap-2">
        {radio.up
          ? <><CellSignalFull size={15} weight="fill" className="text-led" />Rádio {radio.sinal ?? '—'} dBm</>
          : <><CellSignalX size={15} weight="fill" className="text-desastre" />Rádio sem sinal</>}
      </span>
      {interno && s.cpu != null && <>{div}<span className="flex items-center gap-2"><Cpu size={15} weight="fill" className="text-led" />CPU {s.cpu}%</span></>}
      {interno && s.uptime != null && <>{div}<span>No ar há {duracao(s.uptime)}</span></>}
      {interno && s.routeros && <>{div}<span className="text-tinta-2">{s.modelo} · RouterOS {s.routeros}</span></>}
      <span className="ml-auto" title={redundante ? 'Com redundância: fibra e rádio no ar' : 'Sem redundância'}>
        {redundante ? <LinkSimple size={18} className="text-tinta-3" /> : <LinkBreak size={18} className="text-desastre" />}
      </span>
    </div>
  )
}

function CardAlertas({ alertas, baixar }: { alertas: Alerta[] | null; baixar: (nome: string, linhas: string[]) => void }) {
  const lista = alertas?.slice(0, 5) ?? []
  const destaque = lista.find(a => a.ativo && CRITICO.includes(a.severidade)) ?? lista.find(a => a.ativo)
  const criticos = alertas?.filter(a => CRITICO.includes(a.severidade)).length ?? 0
  return (
    <Card titulo="Alertas" acao={
      <Chip onClick={() => alertas && baixar('sennaguard-alertas.csv', ['evento;severidade;problema;inicio;fim',
        ...alertas.map(a => `${a.id};${a.severidade};${a.nome};${dataHora(a.inicio)};${a.fim ? dataHora(a.fim) : 'ativo'}`)])}>
        <DownloadSimple />Baixar
      </Chip>}>
      <ul className="flex flex-col gap-2">
        {lista.map(a => {
          const c = CRITICO.includes(a.severidade) ? 'var(--color-desastre)' : 'var(--color-media)'
          return (
            <li key={a.id}>
              <Link to={`/alertas?id=${a.id}`} title={a.nome}
                className={`flex h-[30px] items-center gap-2.5 rounded-full px-3 text-[12px] transition-colors hover:bg-pilula-hover ${a === destaque ? 'bg-destaque ring-1 ring-inset' : 'bg-painel-alto'}`}
                style={{ '--tw-ring-color': c } as React.CSSProperties}>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: c }} />
                <b className="shrink-0 font-semibold text-tinta">{curto(a.nome)}</b>
                <span className="num truncate text-tinta-2">às {dataHora(a.inicio).replace(',', '')} {a.ativo ? '(ativo)' : `(${duracao((a.fim ?? 0) - a.inicio)})`}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {alertas && (
        <div className="num mt-4 flex items-center gap-4 border-t border-fio pt-3 text-[11.5px] text-tinta-2">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-desastre" />Crítico <b className="font-semibold text-tinta">{criticos}</b></span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-media" />Aviso <b className="font-semibold text-tinta">{alertas.length - criticos}</b></span>
          <span className="ml-auto">Total <b className="font-semibold text-tinta">{alertas.length}</b></span>
        </div>
      )}
    </Card>
  )
}

function CardChamados({ ch }: { ch: ListaChamados | null }) {
  return (
    <Card titulo="Seus chamados" acao={<Link to="/chamados?sg=novo"><Chip><Plus />Abrir</Chip></Link>}>
      <ul className="flex flex-col gap-2">
        {ch?.manuais.slice(0, 5).map(c => (
          <li key={c.id}>
            <Link to={`/chamados?sg=${c.id}`} title={c.titulo}
              className="flex h-[30px] items-center gap-2.5 rounded-full bg-painel-alto px-3 text-[12px] transition-colors hover:bg-pilula-hover">
              <b className="shrink-0 font-mono text-[11px] font-medium text-tinta-2">{c.numero}</b>
              <span className="min-w-0 flex-1 truncate text-tinta">{c.titulo}</span>
              <StatusChamado status={c.status} />
            </Link>
          </li>
        ))}
        {ch && !ch.manuais.length && <li className="py-8 text-center text-tinta-3">Nenhum chamado aberto.</li>}
      </ul>
      {ch && (
        <div className="num mt-4 flex items-center gap-4 border-t border-fio pt-3 text-[11.5px] text-tinta-2">
          <span>Em andamento <b className="font-semibold text-tinta">{ch.manuais.filter(c => c.status !== 'resolvido').length}</b></span>
          <span className="ml-auto">Total <b className="font-semibold text-tinta">{ch.manuais.length}</b></span>
        </div>
      )}
    </Card>
  )
}

/** Equivalente ao "Door Activity": situação do caminho, trocas e uma régua com quedas (blocos) e alertas (riscos). */
function CardCaminho({ pontos, v, alertas }: { pontos: Ponto[]; v: TVisao; alertas: Alerta[] }) {
  const t0 = pontos[0]?.t ?? 0, t1 = pontos[pontos.length - 1]?.t ?? 1
  const x = (t: number) => `${Math.min(100, Math.max(0, ((t - t0) / (t1 - t0)) * 100))}%`
  const quedas = faixasSemResposta(pontos, 'fibra', '')
  const noRadio = quedas.reduce((s, f) => s + (f.fim - f.ini), 0)
  const naFibra = v.caminho === 'fibra'
  const riscos = alertas.filter(a => a.inicio >= t0 && a.inicio <= t1)
  return (
    <Card titulo="Caminho ativo" acao={<Link to="/equipamentos"><Chip><ArrowsOut />Detalhes</Chip></Link>}>
      <div className="grid grid-cols-3 divide-x divide-fio-forte text-[11px] text-tinta-2">
        <div className="pr-3">
          Situação
          <div className="mt-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${naFibra ? 'bg-led/15 text-led' : 'bg-desastre/15 text-desastre'}`}>
              <span className="size-1.5 rounded-full bg-current" />{naFibra ? 'Na fibra' : 'No rádio'}
            </span>
          </div>
        </div>
        <div className="px-3">Trocas<div className="num mt-1 text-[16px] font-semibold text-tinta">{quedas.length}</div></div>
        <div className="pl-3">No rádio<div className="num mt-1 text-[16px] font-semibold text-tinta">{noRadio ? duracao(noRadio) : '0 min'}</div></div>
      </div>
      <div className="relative mt-5 h-[34px]" role="img" aria-label="Quedas da fibra (blocos) e alertas (riscos) no período">
        {riscos.map(a => <span key={a.id} title={`${hora(a.inicio)} · ${a.nome}`} className="absolute inset-y-0 w-[2px] rounded-[1px] bg-risco" style={{ left: x(a.inicio) }} />)}
        {quedas.map(f => <span key={f.ini} title={`Fibra fora: ${hora(f.ini)} às ${hora(f.fim)}`} className="absolute inset-y-0 min-w-[10px] rounded-[2px] bg-queda" style={{ left: x(f.ini), width: `calc(${x(f.fim)} - ${x(f.ini)})` }} />)}
      </div>
      <div className="num mt-2 flex justify-between border-t border-fio pt-1.5 text-[10.5px] text-tinta-3">
        <span>{hora(t0)}</span><span>{hora((t0 + t1) / 2)}</span><span>{hora(t1)}</span>
      </div>
    </Card>
  )
}

