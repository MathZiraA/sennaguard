#!/usr/bin/env bash
# Instala ou atualiza o SennaGuard no servidor do NOC (Debian 12, como root), ao lado do Zabbix.
#
#   git clone https://github.com/MathZiraA/sennaguard.git /opt/sennaguard
#   bash /opt/sennaguard/deploy/instalar.sh
#
# Publica em https://<SERVIDOR_IP>/sennaguard/ pelo Apache que já serve o Zabbix (HTTPS com a CA do NOC).
# Os PCs da Filial chegam por OSPF (fibra ou rádio): o R-MATRIZ já libera 192.168.20.0/24 -> 192.168.10.0/24.
# Pode rodar de novo a qualquer momento: cada etapa pula o que já está pronto.
set -euo pipefail

APP=/opt/sennaguard
ETC=/etc/sennaguard
DADOS=/var/lib/sennaguard
PORTA=8010
NOC_CONF=/etc/noc/noc.conf
LIVRO=/var/lib/noc-analista/chamados.jsonl

[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
cd "$(dirname "$0")/.."
[ "$(pwd)" = "$APP" ] || { echo "Clone o repositório em $APP (git clone ... $APP)."; exit 1; }
conf() { grep -E "^\s*$1\s*=" "$NOC_CONF" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"' " || true; }

echo "==> 1/7 Pacotes"
apt-get install -y -qq python3-venv curl >/dev/null
if ! node -v 2>/dev/null | grep -qE '^v(2[0-9]|[3-9][0-9])'; then
    # Tailwind 4 pede Node 20+; o Debian 12 traz o 18
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
fi

echo "==> 2/7 Usuário do serviço"
id sennaguard >/dev/null 2>&1 || useradd --system --home "$DADOS" --shell /usr/sbin/nologin sennaguard
install -d -o sennaguard -g sennaguard -m 750 "$DADOS"

echo "==> 3/7 Backend (Python)"
[ -d "$APP/.venv" ] || python3 -m venv "$APP/.venv"
"$APP/.venv/bin/pip" install -q --upgrade pip
"$APP/.venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

echo "==> 4/7 Interface (compilação)"
(cd "$APP/frontend" && npm ci --no-audit --no-fund --loglevel=error && npm run build >/dev/null)

echo "==> 5/7 Configuração ($ETC/sennaguard.env)"
install -d -m 750 -o root -g sennaguard "$ETC"
if [ ! -f "$ETC/sennaguard.env" ]; then
    TOKEN=$(cat /root/.zabbix_token 2>/dev/null || true)
    [ -n "$TOKEN" ] || read -rsp "Token da API do Zabbix: " TOKEN && echo
    cat > "$ETC/sennaguard.env" <<EOF
ZABBIX_URL=http://localhost/zabbix/api_jsonrpc.php
ZABBIX_TOKEN=$TOKEN
NOC_HOST=$(conf HOST_FILIAL || echo R-FILIAL)
NOC_FIBRA_FILIAL=$(conf FIBRA_FILIAL)
NOC_RADIO_FILIAL=$(conf RADIO_FILIAL)
NOC_LIVRO=$LIVRO
SENNAGUARD_BANCO=$DADOS/sennaguard.db
COOKIE_SEGURO=1
EOF
    sed -i '/=$/d' "$ETC/sennaguard.env"  # tira as chaves que o noc.conf não tinha (ficam no padrão)
    chmod 640 "$ETC/sennaguard.env"; chown root:sennaguard "$ETC/sennaguard.env"
fi
# O serviço lê o livro de chamados do Analista IA (só leitura, pelo grupo). O setgid na pasta faz o
# livro criado depois (primeiro chamado NOC-xxx) já nascer com o grupo sennaguard.
install -d "$(dirname "$LIVRO")"
chgrp sennaguard "$(dirname "$LIVRO")" && chmod g+rxs "$(dirname "$LIVRO")"
[ -f "$LIVRO" ] && chgrp sennaguard "$LIVRO" && chmod 640 "$LIVRO"

echo "==> 6/7 Serviço systemd e Apache"
install -m 644 "$APP/deploy/sennaguard.service" /etc/systemd/system/sennaguard.service
install -m 644 "$APP/deploy/apache-sennaguard.conf" /etc/apache2/conf-available/sennaguard.conf
a2enmod -q proxy proxy_http headers >/dev/null
a2enconf -q sennaguard >/dev/null
systemctl daemon-reload
systemctl enable -q sennaguard
systemctl restart sennaguard
apache2ctl configtest 2>/dev/null && systemctl reload apache2

echo "==> 7/7 Primeiro administrador"
ADMINS=$(sudo -u sennaguard env $(grep -v '^#' "$ETC/sennaguard.env" | xargs) "$APP/.venv/bin/python" -c \
    "import sys; sys.path.insert(0,'$APP/backend'); import main; main.iniciar(); print(main.db().execute(\"select count(*) from usuarios where papel='Administrador'\").fetchone()[0])")
if [ "$ADMINS" = 0 ]; then
    read -rp "E-mail do administrador: " EMAIL
    read -rp "Nome: " NOME
    sudo -u sennaguard env $(grep -v '^#' "$ETC/sennaguard.env" | xargs) \
        "$APP/.venv/bin/python" "$APP/backend/gerenciar.py" criar-admin --email "$EMAIL" --nome "$NOME"
fi

sleep 1
if curl -fsS "http://127.0.0.1:$PORTA/api/publico" >/dev/null; then
    IP=$(conf SERVIDOR_IP); IP=${IP:-$(hostname -I | awk '{print $1}')}
    echo
    echo "SennaGuard no ar: https://$IP/sennaguard/"
    echo "Na Filial, o PC precisa confiar na CA do NOC (http://$IP/NOC-SENAI-CA.crt), como para o Zabbix."
else
    echo "O serviço não respondeu. Veja: journalctl -u sennaguard -n 50"; exit 1
fi
