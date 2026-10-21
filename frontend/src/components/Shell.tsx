import { useState, type FormEvent } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Activity, Bell, BookLock, ChevronsUpDown, KeyRound, LifeBuoy, LogOut, Router, Users, Waypoints } from 'lucide-react'
import { api, useApi, type Alerta, type Visao } from '../lib/api'
import { useSessao } from '../lib/sessao'
import Modal from './Modal'
import { Botao, Led } from './ui'

const NAV = [
  { para: '/', rotulo: 'Visão do enlace', icone: Waypoints, permissao: 'visao' },
  { para: '/alertas', rotulo: 'Alertas', icone: Activity, permissao: 'alertas', contagem: true },
  { para: '/chamados', rotulo: 'Chamados', icone: BookLock, permissao: 'chamados' },
  { para: '/equipamentos', rotulo: 'Equipamentos', icone: Router, permissao: 'equipamentos' },
  { para: '/usuarios', rotulo: 'Usuários', icone: Users, permissao: 'usuarios' },
]

export default function Shell() {
  const { eu, pode, sair } = useSessao()
  const [trocando, setTrocando] = useState(false)
  const { dados: alertas } = useApi<Alerta[]>(pode('alertas') ? '/api/alertas' : '', 15000)
  const { dados: visao } = useApi<Visao>('/api/visao', 10000)
  const ativos = alertas?.filter(a => a.ativo && !a.reconhecido).length ?? 0
  const redundante = visao ? visao.enlaces.fibra.up && visao.enlaces.radio.up : true

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-fio px-3 py-5 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <Marca />
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-[0.14em]">SENNAGUARD</div>
            <div className="text-[11px] text-tinta-3">NOC Matriz · Filial</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.filter(n => pode(n.permissao)).map(({ para, rotulo, icone: Icone, contagem }) => (
            <NavLink key={para} to={para} end
              className={({ isActive }) => `group flex h-9 items-center gap-3 rounded-lg px-2.5 font-medium transition-colors duration-150 ${isActive ? 'bg-fibra/14 text-tinta' : 'text-tinta-3 hover:bg-white/[0.03] hover:text-tinta-2'}`}>
              {({ isActive }) => (<>
                <Icone className={`size-4 ${isActive ? 'text-fibra' : ''}`} strokeWidth={1.8} />
                {rotulo}
                {contagem && ativos > 0 && (
                  <span className="num ml-auto rounded-full bg-desastre/15 px-1.5 text-[11px] font-semibold text-desastre">{ativos}</span>
                )}
              </>)}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <a href="https://github.com/MathZiraA/noc-senai-tcc/blob/main/docs/DOCUMENTACAO.md" target="_blank" rel="noreferrer"
            className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-tinta-3 transition-colors hover:text-tinta-2">
            <LifeBuoy className="size-4" strokeWidth={1.8} /> Documentação
          </a>
          <Menu.Root>
            <Menu.Trigger className="flex items-center gap-2.5 rounded-lg border-t border-fio px-2 pb-1 pt-4 text-left transition-colors hover:bg-white/[0.02] data-[state=open]:bg-white/[0.03]">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-fibra/18 text-[11px] font-semibold text-fibra">
                {eu?.nome.split(/[\s-]/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate font-semibold">{eu?.nome}</div>
                <div className="text-[11px] text-tinta-3">{eu?.papel}</div>
              </div>
              <ChevronsUpDown className="size-3.5 text-tinta-3" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content side="top" align="start" sideOffset={6} className="z-50 w-[208px] rounded-xl border border-fio-forte bg-painel-alto p-1 text-[12px] shadow-2xl">
                <div className="truncate px-2.5 py-2 text-[11px] text-tinta-3">{eu?.email}</div>
                <Menu.Item onSelect={() => setTrocando(true)} className="flex h-8 cursor-default items-center gap-2 rounded-lg px-2.5 text-tinta-2 outline-none data-[highlighted]:bg-white/5 data-[highlighted]:text-tinta">
                  <KeyRound className="size-3.5" />Trocar senha
                </Menu.Item>
                <Menu.Item onSelect={sair} className="flex h-8 cursor-default items-center gap-2 rounded-lg px-2.5 text-tinta-2 outline-none data-[highlighted]:bg-desastre/10 data-[highlighted]:text-desastre">
                  <LogOut className="size-3.5" />Sair
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-fio px-6">
          <div className="flex items-center gap-2 text-tinta-2">
            <Led cor={redundante ? 'var(--color-led)' : 'var(--color-media)'} pulsa={!redundante} />
            <span className="font-medium">{redundante ? 'Rede com redundância' : 'Rede sem redundância'}</span>
            {visao && <span className="text-tinta-4">· {visao.modo === 'simulação' ? 'dados simulados' : 'Zabbix ao vivo'}</span>}
          </div>
          <button onClick={sair} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-tinta-3 transition-colors hover:bg-painel-alto hover:text-tinta md:hidden"><LogOut className="size-4" />Sair</button>
          {pode('alertas') && <NavLink to="/alertas" aria-label={`${ativos} alertas ativos`}
            className="relative ml-auto grid size-8 place-items-center rounded-lg text-tinta-3 transition-colors hover:bg-painel-alto hover:text-tinta">
            <Bell className="size-4" strokeWidth={1.8} />
            {ativos > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-desastre" />}
          </NavLink>}
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
      <Modal aberto={trocando} onClose={() => setTrocando(false)} titulo="Trocar senha">
        <TrocarSenha onFim={() => setTrocando(false)} />
      </Modal>
    </div>
  )
}

function TrocarSenha({ onFim }: { onFim: () => void }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    try { await api('/api/eu/senha', { method: 'PUT', body: JSON.stringify({ atual, nova }) }); onFim() } catch (x) { setErro((x as Error).message) }
  }
  const campo = 'h-9 w-full rounded-lg border border-fio bg-fenda px-3 text-tinta focus:border-fibra/60 focus:outline-none'
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-tinta-2">Senha atual
        <input type="password" required autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} className={campo} /></label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-tinta-2">Nova senha (mínimo 8 caracteres)
        <input type="password" required minLength={8} autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} className={campo} /></label>
      {erro && <p className="text-[12px] text-desastre">{erro}</p>}
      <div className="flex justify-end gap-2 border-t border-fio pt-4">
        <Botao type="button" onClick={onFim}>Cancelar</Botao>
        <Botao type="submit" variante="primario">Salvar</Botao>
      </div>
    </form>
  )
}

/** Dois trilhos (fibra e rádio) ligando dois nós: o mesmo desenho do enlace, em miniatura. */
export function Marca() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
      <rect width="28" height="28" rx="8" fill="var(--color-fibra)" fillOpacity=".14" />
      <path d="M7 11 H21" stroke="var(--color-fibra)" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 17 H21" stroke="var(--color-radio)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
      <circle cx="7" cy="14" r="2.6" fill="var(--color-tinta)" />
      <circle cx="21" cy="14" r="2.6" fill="var(--color-tinta)" />
    </svg>
  )
}
