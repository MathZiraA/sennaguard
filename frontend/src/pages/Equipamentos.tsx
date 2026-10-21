import { Antenna, Network, Router, Server } from 'lucide-react'
import { useApi, type Equipamento } from '../lib/api'
import { ms } from '../lib/fmt'
import { Card, Carregando, Led } from '../components/ui'

const icones = { roteador: Router, switch: Network, antena: Antenna, servidor: Server } as const

export default function Equipamentos() {
  const { dados } = useApi<Equipamento[]>('/api/equipamentos', 15000)
  if (!dados) return <Carregando />
  const locais = [...new Set(dados.map(e => e.local || 'Sem local'))]
  const fora = dados.filter(e => !e.up).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Equipamentos</h1>
        <p className="mt-1 text-tinta-3">
          {dados.length} hosts monitorados · {fora ? <span className="font-medium text-desastre">{fora} sem resposta</span> : 'todos respondendo'}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {locais.map(local => (
          <Card key={local} titulo={local} extra={<span className="text-[11px] text-tinta-3">{local === 'Matriz' ? '192.168.10.0/24' : local === 'Filial' ? '192.168.20.0/24' : ''}</span>}>
            <ul className="flex flex-col gap-1">
              {dados.filter(e => (e.local || 'Sem local') === local).map(e => {
                const Icone = icones[e.tipo as keyof typeof icones] ?? Server
                return (
                  <li key={e.nome} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${e.up ? '' : 'bg-desastre/[0.07]'}`}>
                    <div className={`grid size-8 place-items-center rounded-lg ${e.up ? 'bg-painel-alto text-tinta-2' : 'bg-desastre/15 text-desastre'}`}><Icone className="size-4" strokeWidth={1.7} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{e.nome}</div>
                      <div className="truncate text-[11px] text-tinta-3"><span className="font-mono">{e.ip}</span> · {e.modelo}</div>
                    </div>
                    {e.sinal != null && <span className="num font-mono text-[12px] text-radio">{e.sinal} dBm</span>}
                    <span className="num w-16 text-right font-mono text-[12px] text-tinta-2">{e.up ? ms(e.latencia) : ''}</span>
                    <span className="flex w-24 items-center justify-end gap-1.5 text-[12px] font-medium">
                      <Led cor={e.up ? 'var(--color-led)' : 'var(--color-desastre)'} pulsa={!e.up} />{e.up ? 'Respondendo' : 'Sem resposta'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
