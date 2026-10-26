import { useEffect, useState } from 'react'
import { api, type Ponto, type Visao } from '../lib/api'
import { desde } from '../lib/fmt'
import Trilho from '../components/Trilho'
import Grafico, { faixasSemResposta } from '../components/Grafico'
import { curto } from './Visao'

type DadosTv = { visao: Visao; latencia: Ponto[]; alertas: { id: string; severidade: string; nivel: number; nome: string; inicio: number }[] }

/** Tela da TV do NOC: aberta por link fixo (?k=), sem login, atualiza a cada 10 s. */
export default function Tv() {
  const k = new URLSearchParams(location.search).get('k') ?? ''
  const [d, setD] = useState<DadosTv | null>(null)
  const [erro, setErro] = useState('')
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    const carregar = () => api<DadosTv>(`/api/tv?k=${encodeURIComponent(k)}`).then(r => { setD(r); setErro('') }).catch(e => setErro(e.message))
    carregar()
    const a = setInterval(carregar, 2000), b = setInterval(() => setAgora(new Date()), 1000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [k])

  if (erro && !d) return <div className="grid min-h-screen place-items-center text-[20px] text-tinta-2">{erro}</div>
  if (!d) return null
  const redundante = d.visao.enlaces.fibra.up && d.visao.enlaces.radio.up

  return (
    <div className="flex min-h-screen flex-col gap-5 p-8">
      <header className="flex items-center gap-6">
        <span className="text-[22px] font-medium tracking-[0.28em]">SENNA<span className="text-fibra">G</span>UARD</span>
        <span className="text-[16px] text-tinta-2">NOC Matriz · Filial</span>
        <span className={`rounded-full px-4 py-1.5 text-[15px] font-semibold ${redundante ? 'bg-led/15 text-led' : 'bg-desastre/15 text-desastre'}`}>
          {redundante ? '● Rede com redundância' : '● Rede sem redundância'}
        </span>
        {erro && <span className="text-[14px] text-desastre">sem atualização: {erro}</span>}
        <span className="num ml-auto text-[40px] font-semibold tracking-[-0.02em]">{agora.toLocaleTimeString('pt-BR')}</span>
      </header>

      <div className="[&_h1]:text-[30px]"><Trilho v={d.visao} /></div>

      <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="rounded-xl border border-fio bg-painel px-9 pb-6 pt-7">
          <h2 className="mb-2 text-[22px] font-semibold">Latência da fibra · últimas 6 h</h2>
          <Grafico dados={d.latencia} serie="fibra" cor="var(--color-fibra)" unidade="ms" altura={460}
            limites={[{ valor: 30, rotulo: 'Crítico', tipo: 'critico' }, { valor: 0.6, rotulo: 'Normal', tipo: 'normal' }]}
            faixas={faixasSemResposta(d.latencia, 'fibra', 'Fibra fora')} />
        </section>
        <section className="rounded-xl border border-fio bg-painel px-7 py-7">
          <h2 className="mb-5 text-[22px] font-semibold">Alertas ativos <span className="num text-tinta-3">{d.alertas.length}</span></h2>
          <ul className="flex flex-col gap-3">
            {d.alertas.map(a => {
              const c = a.nivel >= 4 ? 'var(--color-desastre)' : 'var(--color-media)'
              return (
                <li key={a.id} className="flex items-center gap-4 rounded-full bg-painel-alto px-5 py-3 text-[17px]">
                  <span className="size-3 shrink-0 rounded-full respira" style={{ background: c }} />
                  <b className="font-semibold">{curto(a.nome)}</b>
                  <span className="num ml-auto text-tinta-2">há {desde(a.inicio)}</span>
                </li>
              )
            })}
            {!d.alertas.length && <li className="py-16 text-center text-[18px] text-tinta-3">Nenhum alerta ativo.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
