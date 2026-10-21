import { useState, type FormEvent } from 'react'
import { BellRing, Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, useApi, type Usuario } from '../lib/api'
import { desde } from '../lib/fmt'
import Modal from '../components/Modal'
import { Botao, Card, Carregando } from '../components/ui'

const PAPEIS: Record<string, string> = {
  Administrador: 'Configura o NOC e gerencia usuários',
  Analista: 'Investiga incidentes e comenta eventos',
  Operador: 'Acompanha o plantão e reconhece alertas',
  Cliente: 'Recebe os chamados da Filial por e-mail',
}
const corPapel: Record<string, string> = {
  Administrador: 'var(--color-fibra)', Analista: 'var(--color-radio)', Operador: 'var(--color-tinta-2)', Cliente: 'var(--color-media)',
}
type Form = Omit<Usuario, 'id' | 'criado_em' | 'ultimo_acesso'> & { senha?: string }
const vazio: Form = { nome: '', email: '', papel: 'Operador', ativo: 1, alerta_email: 1, chamado_email: 0, senha: '' }

export default function Usuarios() {
  const { dados, recarregar } = useApi<Usuario[]>('/api/usuarios')
  const [editando, setEditando] = useState<(Form & { id?: number }) | null>(null)
  const [erro, setErro] = useState('')
  if (!dados) return <Carregando />

  const salvar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!editando) return
    const { id, ...corpo } = editando
    try {
      await api(id ? `/api/usuarios/${id}` : '/api/usuarios', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ ...corpo, senha: corpo.senha || null, ativo: !!corpo.ativo, alerta_email: !!corpo.alerta_email, chamado_email: !!corpo.chamado_email }) })
      setEditando(null); recarregar()
    } catch (e) { setErro((e as Error).message) }
  }
  const remover = async (u: Usuario) => {
    if (!confirm(`Remover ${u.nome}? Essa ação não pode ser desfeita.`)) return
    await api(`/api/usuarios/${u.id}`, { method: 'DELETE' }).catch(e => alert(e.message)); recarregar()
  }
  const abrir = (u?: Usuario) => { setErro(''); setEditando(u ? { ...u, senha: '' } : { ...vazio }) }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Usuários</h1>
          <p className="mt-1 text-tinta-3">Quem acessa o NOC e quem recebe os e-mails de alerta e de chamado.</p>
        </div>
        <Botao variante="primario" onClick={() => abrir()}><Plus />Novo usuário</Botao>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(PAPEIS).map(([papel, desc]) => (
          <div key={papel} className="rounded-xl border border-fio bg-painel px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold" style={{ color: corPapel[papel] }}>{papel}</span>
              <span className="num text-[18px] font-semibold">{dados.filter(u => u.papel === papel && u.ativo).length}</span>
            </div>
            <div className="mt-1 text-[11px] leading-snug text-tinta-3">{desc}</div>
          </div>
        ))}
      </div>

      <Card className="!p-0">
        <table className="w-full text-left">
          <thead className="text-[11px] text-tinta-3">
            <tr className="border-b border-fio">
              <th className="py-3 pl-5 font-medium">Nome</th><th className="font-medium">Papel</th>
              <th className="font-medium">Recebe por e-mail</th><th className="font-medium">Último acesso</th><th className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {dados.map(u => (
              <tr key={u.id} className={`group border-b border-fio last:border-0 ${u.ativo ? '' : 'opacity-50'}`}>
                <td className="py-3 pl-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full text-[11px] font-semibold"
                      style={{ color: corPapel[u.papel], background: `color-mix(in srgb, ${corPapel[u.papel]} 14%, transparent)` }}>
                      {u.nome.split(/[\s-]/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div><div className="font-medium">{u.nome}{!u.ativo && <span className="ml-2 text-[11px] text-tinta-3">desativado</span>}</div><div className="text-[11px] text-tinta-3">{u.email}</div></div>
                  </div>
                </td>
                <td className="font-medium" style={{ color: corPapel[u.papel] }}>{u.papel}</td>
                <td>
                  <div className="flex gap-1.5 text-[11px]">
                    {u.alerta_email ? <span className="flex items-center gap-1 rounded-md bg-painel-alto px-1.5 py-0.5 text-tinta-2"><BellRing className="size-3" />Alertas</span> : null}
                    {u.chamado_email ? <span className="flex items-center gap-1 rounded-md bg-painel-alto px-1.5 py-0.5 text-tinta-2"><Mail className="size-3" />Chamados</span> : null}
                    {!u.alerta_email && !u.chamado_email && <span className="text-tinta-4">Nada</span>}
                  </div>
                </td>
                <td className="num text-tinta-2">{u.ultimo_acesso ? `há ${desde(u.ultimo_acesso)}` : <span className="text-tinta-4">Nunca entrou</span>}</td>
                <td className="pr-5">
                  <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button onClick={() => abrir(u)} aria-label={`Editar ${u.nome}`} className="grid size-8 place-items-center rounded-lg text-tinta-3 hover:bg-painel-alto hover:text-tinta"><Pencil className="size-3.5" /></button>
                    <button onClick={() => remover(u)} aria-label={`Remover ${u.nome}`} className="grid size-8 place-items-center rounded-lg text-tinta-3 hover:bg-desastre/12 hover:text-desastre"><Trash2 className="size-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal aberto={!!editando} onClose={() => setEditando(null)} titulo={editando?.id ? 'Editar usuário' : 'Novo usuário'}>
        {editando && (
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <Campo rotulo="Nome"><input required minLength={2} value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} className={campo} /></Campo>
            <Campo rotulo="E-mail"><input required type="email" value={editando.email} onChange={e => setEditando({ ...editando, email: e.target.value })} className={campo} /></Campo>
            <Campo rotulo={editando.id ? 'Nova senha (em branco mantém a atual)' : 'Senha inicial (mínimo 8)'}>
              <input type="password" autoComplete="new-password" required={!editando.id} minLength={8} value={editando.senha ?? ''}
                onChange={e => setEditando({ ...editando, senha: e.target.value })} className={campo} />
            </Campo>
            <fieldset>
              <legend className="mb-1.5 text-[12px] font-medium text-tinta-2">Papel</legend>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PAPEIS).map(([p, d]) => (
                  <label key={p} className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${editando.papel === p ? 'border-fibra/60 bg-fibra/8' : 'border-fio hover:border-fio-forte'}`}>
                    <input type="radio" name="papel" className="sr-only" checked={editando.papel === p} onChange={() => setEditando({ ...editando, papel: p })} />
                    <div className="font-medium">{p}</div><div className="text-[11px] leading-snug text-tinta-3">{d}</div>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2.5">
              <Chave rotulo="Recebe e-mail de alerta e análise da IA" ligado={!!editando.alerta_email} onChange={v => setEditando({ ...editando, alerta_email: +v })} />
              <Chave rotulo="Recebe e-mail de chamado (NOC-xxx)" ligado={!!editando.chamado_email} onChange={v => setEditando({ ...editando, chamado_email: +v })} />
              <Chave rotulo="Acesso ativo" ligado={!!editando.ativo} onChange={v => setEditando({ ...editando, ativo: +v })} />
            </div>
            {erro && <p className="text-[12px] text-desastre">{erro}</p>}
            <div className="flex justify-end gap-2 border-t border-fio pt-4">
              <Botao type="button" onClick={() => setEditando(null)}>Cancelar</Botao>
              <Botao type="submit" variante="primario">Salvar</Botao>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

const campo = 'h-9 w-full rounded-lg border border-fio bg-fenda px-3 text-tinta placeholder:text-tinta-4 focus:border-fibra/60 focus:outline-none'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-[12px] font-medium text-tinta-2">{rotulo}{children}</label>
}

function Chave({ rotulo, ligado, onChange }: { rotulo: string; ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-tinta-2">
      {rotulo}
      <span className="relative">
        <input type="checkbox" role="switch" checked={ligado} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
        <span className="block h-5 w-9 rounded-full bg-painel-alto ring-1 ring-fio-forte transition-colors peer-checked:bg-fibra peer-focus-visible:outline-2 peer-focus-visible:outline-fibra" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-tinta transition-transform duration-150 peer-checked:translate-x-4" />
      </span>
    </label>
  )
}
