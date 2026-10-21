# SennaGuard

Painel do NOC do projeto [noc-senai-tcc](https://github.com/MathZiraA/noc-senai-tcc): estado do enlace Fibra x Rádio entre Matriz e Filial, alertas com a análise do Analista IA, chamados com o livro encadeado por SHA-256, equipamentos e usuários, com login e acesso por perfil.

## Perfis de acesso

| Perfil | Vê | Pode |
| --- | --- | --- |
| Administrador | tudo | reconhecer alertas, atender chamados, criar/editar/remover usuários, redefinir senhas |
| Analista | enlace, alertas (com análise da IA), chamados, equipamentos | reconhecer alertas, atender chamados |
| Operador | enlace, alertas, chamados, equipamentos | reconhecer alertas, atender chamados |
| Cliente | estado do enlace, os chamados automáticos e os que ele abriu | abrir chamados (SG-xxx) e responder |

Senhas com scrypt, sessão em cookie `HttpOnly` + `SameSite=Strict` (12 h), bloqueio de 5 min após 5 senhas erradas, e sempre pelo menos um administrador ativo.

## Chamados

- **Automáticos (NOC-xxx):** queda acima de 1 h, gerados pelo `noc/chamados.py` do noc-senai-tcc.
- **Abertos pelas pessoas (SG-xxx):**
  - o cliente informa o tipo do problema, quem é afetado e a descrição;
  - o estado da fibra e do rádio no momento da abertura é anexado sozinho;
  - a equipe assume o atendimento, responde e resolve;
  - se o cliente responde um chamado resolvido, ele é reaberto.

Cada passo entra num histórico encadeado por SHA-256, e a tela de Chamados acusa qualquer alteração.

## No servidor do NOC (Debian 12, junto do Zabbix)

```bash
git clone https://github.com/MathZiraA/sennaguard.git /opt/sennaguard
bash /opt/sennaguard/deploy/instalar.sh      # pede o e-mail e a senha do primeiro administrador
```

O instalador:

- lê o token do Zabbix de `/root/.zabbix_token` e os IPs de `/etc/noc/noc.conf`;
- compila a interface;
- cria o serviço `sennaguard` (usuário próprio, só em `127.0.0.1:8010`);
- publica pelo Apache em **`https://<SERVIDOR_IP>/sennaguard/`**.

**Acesso pela Filial:** o PC na rede `192.168.20.0/24` abre `https://192.168.10.50/sennaguard/`. O caminho é a fibra, ou o rádio se a fibra cair. O firewall do R-MATRIZ já libera `Filial -> Matriz` e não precisa de mudança. O PC precisa confiar na CA do NOC (`http://192.168.10.50/NOC-SENAI-CA.crt`), como já é feito para o Zabbix.

| Tarefa | Comando |
| --- | --- |
| Atualizar para a última versão do GitHub | `bash /opt/sennaguard/deploy/atualizar.sh` |
| Redefinir a senha de alguém pelo terminal | `cd /opt/sennaguard/backend && sudo -u sennaguard env $(cat /etc/sennaguard/sennaguard.env \| xargs) ../.venv/bin/python gerenciar.py redefinir-senha --email x@y` |
| Ver o log | `journalctl -u sennaguard -f` |

## Desenvolvimento (Windows ou Linux)

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
cd frontend && npm install && npm run dev      # http://localhost:5173/sennaguard/
```

Sem `ZABBIX_URL`/`ZABBIX_TOKEN` a API roda em **simulação**: valores da bancada real e um cenário com o rádio fora e um chamado aberto. Usuários de demonstração com a senha `senai2026`: `matheus.ziravello@gmail.com` (administrador) e `cliente@filial.local` (cliente).

## Estrutura

- `backend/main.py`: rotas `/api/*`, sessão e usuários (SQLite)
- `backend/auth.py`: senhas, sessões e permissões por perfil
- `backend/fonte.py`: Zabbix ou simulação
- `backend/livro.py`: livro de chamados (mesmo formato de `noc/chamados.py`)
- `frontend/src/components/Trilho.tsx`: o trilho do caminho ativo (Matriz ⇄ Filial)
- `deploy/`: instalador, serviço systemd e configuração do Apache
