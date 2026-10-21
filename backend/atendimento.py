"""Chamados abertos pelas pessoas (cliente da Filial ou equipe), numerados SG-<n>.

Cada passo (abertura, comentário, mudança de status) entra em `chamado_registros`, encadeado por
SHA-256 como o livro dos chamados automáticos: alterar ou apagar um registro quebra a cadeia.
"""
import hashlib
import json
import sqlite3
import time

STATUS = ("aberto", "em_atendimento", "resolvido")
CATEGORIAS = ("sem_acesso", "lentidao", "instavel", "outro")
IMPACTOS = ("um_pc", "setor", "filial")


def criar_tabelas(con: sqlite3.Connection):
    con.execute("""create table if not exists chamados_manuais (
        id integer primary key, titulo text not null, descricao text not null, categoria text not null,
        impacto text not null, status text not null default 'aberto', contexto text,
        aberto_por integer not null, responsavel integer, criado_em integer not null, atualizado_em integer not null)""")
    con.execute("""create table if not exists chamado_registros (
        seq integer primary key, chamado_id integer not null, acao text not null, autor_id integer,
        autor_nome text, autor_papel text, texto text, em integer not null, hash_anterior text not null, hash text not null)""")


def _hash(anterior, registro):
    corpo = json.dumps(registro, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256((anterior + corpo).encode()).hexdigest()


def registrar(con, chamado_id, acao, autor, texto=""):
    ultimo = con.execute("select hash from chamado_registros order by seq desc limit 1").fetchone()
    anterior = ultimo[0] if ultimo else "0" * 64
    seq = (con.execute("select coalesce(max(seq), 0) from chamado_registros").fetchone()[0]) + 1
    r = {"seq": seq, "chamado_id": chamado_id, "acao": acao, "autor_id": autor["id"], "autor_nome": autor["nome"],
         "autor_papel": autor["papel"], "texto": texto, "em": int(time.time())}
    h = _hash(anterior, r)
    con.execute("insert into chamado_registros values (?,?,?,?,?,?,?,?,?,?)",
                (seq, chamado_id, acao, autor["id"], autor["nome"], autor["papel"], texto, r["em"], anterior, h))
    con.execute("update chamados_manuais set atualizado_em=? where id=?", (r["em"], chamado_id))


def verificar(con):
    anterior, n = "0" * 64, 0
    for row in con.execute("select * from chamado_registros order by seq"):
        r = dict(row)
        n += 1
        if r.pop("hash_anterior") != anterior:
            return {"ok": False, "registros": n, "quebra": r["seq"], "motivo": "registro fora de ordem ou apagado"}
        h = r.pop("hash")
        if _hash(anterior, r) != h:
            return {"ok": False, "registros": n, "quebra": r["seq"], "motivo": "conteúdo alterado depois de gravado"}
        anterior = h
    return {"ok": True, "registros": n, "quebra": None, "motivo": ""}


def contexto_do_enlace(v: dict) -> str:
    """Foto do enlace na hora da abertura: o NOC vê de onde partir sem perguntar ao cliente."""
    f, r = v["enlaces"]["fibra"], v["enlaces"]["radio"]
    ms = lambda e: f"{e['latencia']:.1f} ms".replace(".", ",") if e.get("latencia") is not None else "sem resposta"
    return json.dumps({"caminho": v["caminho"], "fibra_up": f["up"], "radio_up": r["up"],
                       "fibra_ms": ms(f), "radio_ms": ms(r)}, ensure_ascii=False)


def _publico(row):
    c = dict(row)
    c["numero"] = f"SG-{c['id']}"
    c["contexto"] = json.loads(c["contexto"]) if c.get("contexto") else None
    return c


def listar(con, usuario):
    q = """select c.*, u.nome as aberto_por_nome, r.nome as responsavel_nome from chamados_manuais c
           left join usuarios u on u.id = c.aberto_por left join usuarios r on r.id = c.responsavel"""
    if usuario["papel"] == "Cliente":  # o cliente só vê os que ele abriu
        return [_publico(r) for r in con.execute(q + " where c.aberto_por=? order by c.atualizado_em desc", (usuario["id"],))]
    return [_publico(r) for r in con.execute(q + " order by (c.status='resolvido'), c.atualizado_em desc")]


def detalhe(con, cid, usuario):
    c = next((x for x in listar(con, usuario) if x["id"] == cid), None)
    if c:
        c["registros"] = [dict(r) for r in con.execute(
            "select seq, acao, autor_nome, autor_papel, texto, em, hash from chamado_registros where chamado_id=? order by seq", (cid,))]
    return c
