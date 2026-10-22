import { useState, type FormEvent } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Bell, CaretDoubleLeft, CaretDoubleRight, ChartLineUp, DotsThree, Key, Lifebuoy, HardDrives, SignOut, Siren, Ticket, UsersThree } from '@phosphor-icons/react'
import { api, useApi, type Alerta, type ListaChamados } from '../lib/api'
import { useSessao } from '../lib/sessao'
import Modal from './Modal'
import { Botao } from './ui'

const NAV = [
  { para: '/', rotulo: 'Visão do enlace', icone: ChartLineUp, permissao: 'visao' },
  { para: '/alertas', rotulo: 'Alertas e incidentes', icone: Siren, permissao: 'alertas' },
  { para: '/chamados', rotulo: 'Chamados', icone: Ticket, permissao: 'chamados' },
  { para: '/equipamentos', rotulo: 'Equipamentos', icone: HardDrives, permissao: 'equipamentos' },
  { para: '/usuarios', rotulo: 'Usuários', icone: UsersThree, permissao: 'usuarios' },
]

const iniciais = (nome = '') => nome.split(/[\s-]/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

export default function Shell() {
  const { eu, pode, sair } = useSessao()
  const [trocando, setTrocando] = useState(false)
  const [recolhida, setRecolhida] = useState(() => { try { return localStorage.getItem('sg:lateral') === '1' } catch { return false } })
  const { dados: alertas } = useApi<Alerta[]>(pode('alertas') ? '/api/alertas' : '', 15000)
  // Para a equipe: chamados abertos pela Filial que ninguém assumiu ainda
  const { dados: ch } = useApi<ListaChamados>(pode('atender_chamado') ? '/api/chamados' : '', 30000)
  const semDono = ch?.manuais.filter(c => c.status === 'aberto').length ?? 0
  const ativos = alertas?.filter(a => a.ativo && !a.reconhecido).length ?? 0
  const ponto: Record<string, string | null> = {
    '/alertas': ativos ? 'var(--color-desastre)' : null,
    '/chamados': semDono ? 'var(--color-media)' : null,
  }
  const alternar = () => { const r = !recolhida; setRecolhida(r); try { localStorage.setItem('sg:lateral', r ? '1' : '0') } catch { /* sem storage */ } }

  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-lateral px-3.5 pb-5 pt-7 transition-[width] duration-200 md:flex ${recolhida ? 'w-[76px]' : 'w-[240px]'}`}>
        <div className={`mb-12 flex items-center ${recolhida ? 'justify-center' : 'justify-between pl-3'}`}>
          {!recolhida && <span className="text-[15px] font-medium tracking-[0.28em] text-tinta">SENNA<span className="text-fibra">G</span>UARD</span>}
          <button onClick={alternar} aria-label={recolhida ? 'Abrir menu' : 'Recolher menu'}
            className="grid size-7 place-items-center rounded-md text-tinta-2 transition-colors hover:bg-white/5 hover:text-tinta">
            {recolhida ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.filter(n => pode(n.permissao)).map(({ para, rotulo, icone: Icone }) => (
            <NavLink key={para} to={para} end title={recolhida ? rotulo : undefined}
              className={({ isActive }) => `flex h-10 items-center gap-3 rounded-lg text-[13.5px] transition-colors duration-150 focus-visible:outline-offset-0 ${recolhida ? 'justify-center' : 'px-3.5'} ${isActive ? 'bg-[#3a3049] text-white' : 'text-tinta-2 hover:bg-white/[0.04] hover:text-tinta'}`}>
              <span className="relative">
                <Icone size={19} weight="fill" />
                {recolhida && ponto[para] && <span className="absolute -right-1 -top-0.5 size-1.5 rounded-full" style={{ background: ponto[para]! }} />}
              </span>
              {!recolhida && <>{rotulo}{ponto[para] && <span className="size-1.5 rounded-full" style={{ background: ponto[para]! }} />}</>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <a href="https://github.com/MathZiraA/noc-senai-tcc/blob/main/docs/DOCUMENTACAO.md" target="_blank" rel="noreferrer" title="Central de ajuda"
            className={`flex h-10 items-center gap-3 rounded-lg text-[13.5px] text-tinta-2 transition-colors hover:bg-white/[0.04] hover:text-tinta ${recolhida ? 'justify-center' : 'px-3.5'}`}>
            <Lifebuoy size={19} weight="fill" />{!recolhida && 'Central de ajuda'}
          </a>
          <div className="mx-1 h-px bg-fio-forte" />
          <Menu.Root>
            <Menu.Trigger className={`flex items-center gap-2.5 rounded-lg py-1.5 text-left transition-colors hover:bg-white/[0.03] data-[state=open]:bg-white/[0.04] ${recolhida ? 'justify-center' : 'px-2'}`}>
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#4a3d6b] text-[11px] font-semibold text-white">{iniciais(eu?.nome)}</div>
              {!recolhida && <>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[12.5px] font-semibold">{eu?.nome}</div>
                  <div className="mt-0.5 text-[11px] text-tinta-3">{eu?.papel}</div>
                </div>
                <DotsThree size={20} weight="bold" className="text-tinta-2" />
              </>}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content side="top" align="start" sideOffset={6} className="z-50 w-[208px] rounded-lg border border-fio-forte bg-painel-alto p-1 text-[12.5px] shadow-2xl">
                <div className="truncate px-2.5 py-2 text-[11px] text-tinta-3">{eu?.email}</div>
                <Menu.Item onSelect={() => setTrocando(true)} className="flex h-8 cursor-default items-center gap-2 rounded-md px-2.5 text-tinta-2 outline-none data-[highlighted]:bg-white/5 data-[highlighted]:text-tinta">
                  <Key size={14} />Trocar senha
                </Menu.Item>
                <Menu.Item onSelect={sair} className="flex h-8 cursor-default items-center gap-2 rounded-md px-2.5 text-tinta-2 outline-none data-[highlighted]:bg-desastre/10 data-[highlighted]:text-desastre">
                  <SignOut size={14} />Sair
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] items-center gap-3 px-10">
          {/* Bloco da organização, como o "Amazon · Administration" da referência */}
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-full bg-white text-[14px] font-bold text-[#1c1b21]">S</div>
            <div className="leading-tight">
              <div className="text-[12.5px] font-semibold text-tinta">SENAI</div>
              <div className="text-[12px] text-tinta-2">NOC Matriz · Filial</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {pode('alertas') && <NavLink to="/alertas" aria-label={`${ativos} alertas ativos`}
              className="relative grid size-9 place-items-center rounded-lg text-tinta transition-colors hover:bg-white/5">
              <Bell size={20} weight="fill" />
              {ativos > 0 && <span className="absolute right-2 top-1.5 size-2 rounded-full border-2 border-rack bg-desastre" />}
            </NavLink>}
            <NavLink to="/chamados" aria-label="Chamados" className="relative grid size-9 place-items-center rounded-lg text-tinta transition-colors hover:bg-white/5">
              <Ticket size={20} weight="fill" />
              {semDono > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-rack bg-media" />}
            </NavLink>
            <button onClick={sair} aria-label="Sair" className="grid size-9 place-items-center rounded-lg text-tinta-2 transition-colors hover:bg-white/5 md:hidden"><SignOut size={20} /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-10 pb-8 pt-2">
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
