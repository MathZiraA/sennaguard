import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Ponto } from '../lib/api'
import { dataHora, hora } from '../lib/fmt'

export type Limite = { valor: number; rotulo: string; cor: string }
export type Faixa = { ini: number; fim: number; rotulo: string }

const eixo = { fill: 'var(--color-tinta-3)', fontSize: 11 }

export default function Grafico({ dados, serie, cor, unidade, limites = [], faixas = [], altura = 220 }: {
  dados: Ponto[]; serie: string; cor: string; unidade: string; limites?: Limite[]; faixas?: Faixa[]; altura?: number
}) {
  const id = `g-${serie}`
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.32} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="faixa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-desastre)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-desastre)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-fio)" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={hora} tick={eixo} axisLine={false} tickLine={false} tickCount={8} />
        <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={v => `${v}`} />
        {faixas.map(f => (
          <ReferenceArea key={f.ini} x1={f.ini} x2={f.fim} fill="url(#faixa)" stroke="var(--color-desastre)" strokeOpacity={0.35}
            label={{ value: f.rotulo, position: 'insideTop', fill: 'var(--color-desastre)', fontSize: 11 }} />
        ))}
        {limites.map(l => (
          <ReferenceLine key={l.rotulo} y={l.valor} stroke={l.cor} strokeOpacity={0.55} strokeDasharray="5 5"
            label={{ value: `${l.rotulo} · ${l.valor} ${unidade}`, position: 'insideTopLeft', fill: l.cor, fontSize: 11 }} />
        ))}
        <Tooltip
          cursor={{ stroke: 'var(--color-fio-forte)' }}
          content={({ active, payload }) => active && payload?.length ? (
            <div className="rounded-lg border border-fio-forte bg-painel-alto px-3 py-2 text-[12px] shadow-xl">
              <div className="text-tinta-3">{dataHora(payload[0].payload.t)}</div>
              <div className="num mt-0.5 font-semibold" style={{ color: cor }}>
                {payload[0].value == null ? 'sem resposta' : `${payload[0].value} ${unidade}`}
              </div>
            </div>
          ) : null}
        />
        <Area type="monotone" dataKey={serie} stroke={cor} strokeWidth={1.75} fill={`url(#${id})`} connectNulls={false}
          isAnimationActive={false} dot={false} activeDot={{ r: 3.5, fill: cor, stroke: 'var(--color-painel)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Recorta os trechos sem resposta (null) da série em faixas de incidente. */
export function faixasSemResposta(dados: Ponto[], serie: string, rotulo: string): Faixa[] {
  const out: Faixa[] = []
  let ini: number | null = null
  dados.forEach((p, i) => {
    if (p[serie] == null && ini == null) ini = dados[Math.max(0, i - 1)].t
    if (p[serie] != null && ini != null) { out.push({ ini, fim: p.t, rotulo }); ini = null }
  })
  if (ini != null) out.push({ ini, fim: dados[dados.length - 1].t, rotulo })
  return out
}
