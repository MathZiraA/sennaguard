import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronRight, Cpu, FileDown, MemoryStick, Signal, Timer } from 'lucide-react'
import { useApi, type Alerta, type Chamado, type Ponto, type Visao as TVisao } from '../lib/api'
import { useSessao } from '../lib/sessao'
import { dataHora, duracao, hora, corSev } from '../lib/fmt'
import Trilho, { TrilhoMini } from '../components/Trilho'
import Grafico, { faixasSemResposta } from '../components/Grafico'
import { Botao, Card, Carregando, Led, Segmentado } from '../components/ui'

const periodos = [{ h: 6, r: 'Últimas 6 h' }, { h: 24, r: 'Últimas 24 h' }, { h: 72, r: 'Últimos 3 dias' }, { h: 168, r: 'Últimos 7 dias' }]

export default function Visao() {
  const [horas, setHoras] = useState(24)
  const [enlace, setEnlace] = useState<'fibra' | 'radio'>('fibra')
  const { dados: v } = useApi<TVisao>('/api/visao', 10000)
  const { dados: lat } = useApi<Ponto[]>(`/api/serie/latencia?horas=${horas}`, 60000)
  const { dados: trf } = useApi<Ponto[]>(`/api/serie/trafego?horas=${horas}`, 60000)
  const { pode } = useSessao()
  const interno = pode('alertas') // equipe do NOC; o cliente vê os próprios chamados no lugar dos alertas
  const { dados: alertas } = useApi<Alerta[]>(interno ? '/api/alertas' : '', 15000)
  const { dados: ch } = useApi<{ chamados: Chamado[] }>(interno ? '' : '/api/chamados', 30000)

  const exportar = () => {
    if (!lat) return
    const csv = ['horario;latencia_fibra_ms;latencia_radio_ms', ...lat.map(p => `${new Date(p.t * 1000).toISOString()};${p.fibra ?? ''};${p.radio ?? ''}`)].join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `sennaguard-latencia-${horas}h.csv` })
    a.click()
  }

  const ultimo = lat?.length ? lat[lat.length - 1] : null
  const atual = ultimo?.[enlace] ?? null
  const cor = enlace === 'fibra' ? 'var(--color-fibra)' : 'var(--color-radio)'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.02em]">
          <span className="text-tinta-3">Enlaces</span><ChevronRight className="size-4 text-tinta-4" />Matriz ⇄ Filial
        </div>
        <div className="flex gap-2">
          <Menu.Root>
            <Menu.Trigger asChild><Botao>{periodos.find(p => p.h === horas)?.r}<ChevronDown /></Botao></Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-40 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-fio-forte bg-painel-alto p-1 text-[12px] shadow-2xl">
                {periodos.map(p => (
                  <Menu.Item key={p.h} onSelect={() => setHoras(p.h)}
                    className={`flex h-8 cursor-default items-center rounded-lg px-2.5 outline-none data-[highlighted]:bg-white/5 ${p.h === horas ? 'text-fibra' : 'text-tinta-2'}`}>
                    {p.r}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          <Botao onClick={exportar}><FileDown />Exportar CSV</Botao>
        </div>
      </div>

      {v && interno && <Contexto v={v} />}
      {v ? <Trilho v={v} /> : <Carregando />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          titulo="Latência do enlace"
          extra={<span className="num text-[15px] font-semibold" style={{ color: atual == null ? 'var(--color-desastre)' : cor }}>
            {atual == null ? 'sem resposta' : `${atual.toLocaleString('pt-BR')} ms`}</span>}
          acao={<Segmentado valor={enlace} onChange={setEnlace} opcoes={[{ v: 'fibra', rotulo: 'Fibra' }, { v: 'radio', rotulo: 'Rádio' }]} />}>
          {lat ? (
            <Grafico dados={lat} serie={enlace} cor={cor} unidade="ms"
              faixas={faixasSemResposta(lat, enlace, enlace === 'fibra' ? 'fibra fora' : 'rádio fora')}
              limites={enlace === 'fibra'
                ? [{ valor: 30, rotulo: 'Degradada (troca p/ rádio)', cor: 'var(--color-alta)' }]
                : [{ valor: 50, rotulo: 'Latência alta', cor: 'var(--color-media)' }]} altura={330} />
          ) : <div className="h-[330px]" />}
        </Card>

        {!interno && (
          <Card titulo="Seus chamados" acao={<Link to="/chamados" className="text-[12px] font-medium text-tinta-3 transition-colors hover:text-tinta">Ver todos</Link>}>
            <ul className="flex flex-col gap-1.5">
              {ch?.chamados.slice(0, 5).map(c => (
                <li key={c.numero} className="flex items-center gap-3 rounded-lg border border-fio px-3 py-2">
                  <Led cor={c.status === 'aberto' ? 'var(--color-media)' : 'var(--color-tinta-4)'} pulsa={c.status === 'aberto'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={c.nome}>{c.nome}</div>
                    <div className="num text-[11px] text-tinta-3"><span className="font-mono text-fibra">{c.numero}</span> · {c.status === 'aberto' ? 'em atendimento' : `resolvido em ${c.duracao}`}</div>
                  </div>
                  <TrilhoMini nome={c.nome} />
                </li>
              ))}
              {ch && !ch.chamados.length && <li className="py-6 text-center text-tinta-3">Nenhum chamado. Tudo certo com a Filial.</li>}
            </ul>
          </Card>
        )}

        {interno && <Card titulo="Alertas" acao={<Link to="/alertas" className="text-[12px] font-medium text-tinta-3 transition-colors hover:text-tinta">Ver todos</Link>}>
          <ul className="flex flex-col gap-1.5">
            {alertas?.slice(0, 5).map(a => (
              <li key={a.id}>
                <Link to={`/alertas?id=${a.id}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-white/[0.03] ${a.ativo ? 'border-[color-mix(in_srgb,var(--sev)_45%,transparent)] bg-[color-mix(in_srgb,var(--sev)_7%,transparent)]' : 'border-fio'}`}
                  style={{ '--sev': corSev[a.severidade] } as React.CSSProperties}>
                  <Led cor={corSev[a.severidade]} pulsa={a.ativo} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={a.nome}>{a.nome}</div>
                    <div className="num text-[11px] text-tinta-3">{dataHora(a.inicio)} · {a.ativo ? `há ${duracao(Date.now() / 1000 - a.inicio)}` : duracao((a.fim ?? 0) - a.inicio)}</div>
                  </div>
                  <TrilhoMini nome={a.nome} />
                </Link>
              </li>
            ))}
          </ul>
          {alertas && (
            <div className="num mt-4 flex gap-4 border-t border-fio pt-3 text-[11px] text-tinta-3">
              <span><b className="font-semibold text-tinta">{alertas.filter(a => a.ativo).length}</b> ativos</span>
              <span><b className="font-semibold text-tinta">{alertas.filter(a => a.nivel >= 4).length}</b> alta ou desastre</span>
              <span className="ml-auto">{alertas.length} em 7 dias</span>
            </div>
          )}
        </Card>}

        <Card titulo="Tráfego na Filial" extra={<span className="text-[11px] text-tinta-3">Mbps · caminho ativo</span>}>
          {trf ? <Grafico dados={trf.map(p => ({ t: p.t, mbps: p.fibra ?? p.radio }))} serie="mbps" cor="var(--color-tinta-2)" unidade="Mbps" altura={170} /> : <div className="h-[170px]" />}
        </Card>

        <Card titulo="Trocas de caminho" extra={<span className="text-[11px] text-tinta-3">{periodos.find(p => p.h === horas)?.r.toLowerCase()}</span>}>
          {lat && v && <Trocas pontos={lat} v={v} />}
        </Card>
      </div>
    </div>
  )
}

/** Barra de contexto do host monitorado, como a ficha do sensor na referência. */
function Contexto({ v }: { v: TVisao }) {
  const s = v.snmp
  const itens = [
    { icone: Signal, texto: v.enlaces.radio.up ? `Sinal ${v.enlaces.radio.sinal ?? '—'} dBm` : 'Sinal do rádio: sem leitura', alerta: !v.enlaces.radio.up },
    s.cpu != null && { icone: Cpu, texto: `CPU ${s.cpu}%` },
    s.memoria != null && { icone: MemoryStick, texto: `Memória ${s.memoria}%` },
    s.uptime != null && { icone: Timer, texto: `No ar há ${duracao(s.uptime)}` },
  ].filter(Boolean) as { icone: typeof Cpu; texto: string; alerta?: boolean }[]
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-fio bg-painel px-5 py-3 text-tinta-2">
      <span className="font-mono text-[12px]"><span className="text-tinta-3">host</span> {v.host}</span>
      {s.modelo && <span className="text-tinta-3">{s.modelo} · RouterOS {s.routeros}</span>}
      {itens.map(i => (
        <span key={i.texto} className={`flex items-center gap-1.5 ${i.alerta ? 'text-media' : ''}`}><i.icone className="size-3.5" strokeWidth={1.8} />{i.texto}</span>
      ))}
      <span className="num ml-auto text-[11px] text-tinta-4">atualizado {hora(v.atualizado)}</span>
    </div>
  )
}

/** Código de barras do período: cada risco é um trecho, colorido pelo enlace que carregou o tráfego. */
function Trocas({ pontos, v }: { pontos: Ponto[]; v: TVisao }) {
  const passo = Math.max(1, Math.floor(pontos.length / 72))
  const amostra = pontos.filter((_, i) => i % passo === 0)
  const trocas = amostra.filter((p, i) => i > 0 && (p.fibra == null) !== (amostra[i - 1].fibra == null)).length
  return (
    <div>
      <div className="flex gap-6">
        <div>
          <div className="text-[11px] text-tinta-3">Estado</div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold" style={{ color: v.caminho === 'fibra' ? 'var(--color-fibra)' : 'var(--color-radio)' }}>
            <Led cor="currentColor" />{v.caminho === 'fibra' ? 'Na fibra' : 'No rádio'}
          </div>
        </div>
        <div><div className="text-[11px] text-tinta-3">Trocas</div><div className="num mt-1 font-semibold">{trocas}</div></div>
        {v.ultimo_failover && <div><div className="text-[11px] text-tinta-3">Último failover</div><div className="num mt-1 font-semibold">{v.ultimo_failover.segundos.toLocaleString('pt-BR')} s</div></div>}
      </div>
      <div className="mt-5 flex h-14 items-end gap-[2px]" role="img" aria-label="Enlace que carregou o tráfego ao longo do período">
        {amostra.map(p => {
          const radio = p.fibra == null
          const semBackup = p.radio == null
          return <span key={p.t} title={`${hora(p.t)} · ${radio ? 'rádio' : 'fibra'}${semBackup ? ' · sem backup' : ''}`}
            className="flex-1 rounded-[1px]"
            style={{ height: radio ? '100%' : '55%', background: radio ? 'var(--color-radio)' : 'var(--color-fibra)', opacity: radio ? 0.95 : semBackup ? 0.25 : 0.55 }} />
        })}
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-tinta-3">
        <span>{hora(amostra[0].t)}</span><span>{hora(amostra[Math.floor(amostra.length / 2)].t)}</span><span>{hora(amostra[amostra.length - 1].t)}</span>
      </div>
    </div>
  )
}
