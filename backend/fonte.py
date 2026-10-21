"""Fonte dos dados do NOC: Zabbix real (ZABBIX_URL + ZABBIX_TOKEN) ou simulação com os valores da bancada.

A simulação reproduz a bancada de 16/10/2026: fibra ~0,6 ms, rádio ~6,4 ms com sinal de -53 dBm,
e uma queda da fibra resolvida pelo rádio em 3,9 s.
"""
import json
import math
import os
import random
import time
import urllib.request

URL = os.environ.get("ZABBIX_URL", "")
TOKEN = os.environ.get("ZABBIX_TOKEN", "")
HOST = os.environ.get("NOC_HOST", "R-FILIAL")
FIBRA_IP = os.environ.get("NOC_FIBRA_FILIAL", "10.0.1.2")  # IP da Filial em cada enlace (/etc/noc/noc.conf)
RADIO_IP = os.environ.get("NOC_RADIO_FILIAL", "10.0.2.2")
SIMULACAO = not (URL and TOKEN)

SEVERIDADES = {"5": "Desastre", "4": "Alta", "3": "Média", "2": "Aviso", "1": "Informação", "0": "Não classificada"}


def call(method, params):
    body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json-rpc",
                                                          "Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=15) as r:
        res = json.loads(r.read())
    if "error" in res:
        raise RuntimeError(f"{method}: {res['error']['message']} {res['error'].get('data', '')}")
    return res["result"]


# ---------------------------------------------------------------- simulação
_agora = lambda: int(time.time())
_queda_ini = _agora() - 3 * 3600 + 900  # janela da última queda da fibra (~2h45 atrás, 27 min)
_queda_fim = _queda_ini + 27 * 60
_radio_ini = _agora() - 80 * 60  # rádio fora agora: rede sem redundância, chamado aberto
_reconhecidos: set[str] = set()


def _lat_fibra(t):
    if _queda_ini <= t <= _queda_fim:
        return None
    pico = 9 * math.exp(-((t - (_agora() - 9 * 3600)) / 1500) ** 2)  # degradação breve de manhã
    return round(0.55 + 0.12 * math.sin(t / 2400) + random.uniform(0, 0.15) + pico, 2)


def _lat_radio(t):
    if t >= _radio_ini:
        return None
    subida = 14 * math.exp(-((t - (_queda_ini + 600)) / 900) ** 2)  # carrega o tráfego durante a queda
    return round(6.2 + 0.9 * math.sin(t / 3100) + random.uniform(0, 0.8) + subida, 2)


def _sim_serie(metrica, horas):
    fim = _agora() - _agora() % 300
    pontos = []
    random.seed(metrica)
    for t in range(fim - horas * 3600, fim + 1, 300):
        if metrica == "latencia":
            pontos.append({"t": t, "fibra": _lat_fibra(t), "radio": _lat_radio(t)})
        elif metrica == "sinal":
            pontos.append({"t": t, "matriz": None if t >= _radio_ini else round(-53 + 1.6 * math.sin(t / 5000) + random.uniform(-.6, .6), 1),
                           "filial": None if t >= _radio_ini else round(-52 + 1.4 * math.sin(t / 4300) + random.uniform(-.6, .6), 1)})
        else:  # trafego em Mbps no caminho ativo
            base = 38 + 22 * math.sin((t % 86400) / 86400 * 2 * math.pi - 1.9)
            pontos.append({"t": t, "fibra": None if _queda_ini <= t <= _queda_fim else round(base + random.uniform(-4, 4), 1),
                           "radio": None if t >= _radio_ini else round(base + random.uniform(-4, 4), 1) if _queda_ini <= t <= _queda_fim else round(random.uniform(.1, .4), 2)})
    random.seed()
    return pontos


_SIM_ALERTAS = [
    ("31415", 3, "Link RÁDIO (backup) caiu: rede sem redundância", _radio_ini, None),
    ("31390", 4, "Link FIBRA caiu: failover para RÁDIO ativo", _queda_ini, _queda_fim),
    ("31391", 3, "Filial sem comunicação há mais de 10s (failover lento ou queda)", _queda_ini + 4, _queda_ini + 30),
    ("31402", 2, "PREVISÃO: latência do RÁDIO deve passar de 50ms em 30min", _agora() - 1500, None),
    ("31398", 2, "RÁDIO acima do normal: latência 2x maior que a média de 24h", _queda_ini + 300, _queda_fim + 600),
    ("31207", 4, "Link FIBRA caiu: failover para RÁDIO ativo", _agora() - 52 * 3600, _agora() - 50 * 3600 - 2800),
    ("31150", 2, "Link FIBRA instável: 3+ quedas na última hora", _agora() - 9 * 3600 - 600, _agora() - 8 * 3600),
    ("30988", 5, "FILIAL ISOLADA: Fibra e Rádio indisponíveis", _agora() - 74 * 3600, _agora() - 72 * 3600 - 1500),
    ("30990", 3, "RÁDIO com perda de pacotes (>5% por 5min)", _agora() - 75 * 3600, _agora() - 74 * 3600),
]

_SIM_ANALISE = """**Linha do tempo**
- {ini}: fibra (sfp1) sem resposta em 2 medições seguidas; OSPF passou o tráfego para o rádio (ether1).
- {ini} + 3,9 s: LAN da Filial voltou a responder pelo rádio (failover medido).
- {fim}: fibra voltou; custo OSPF retornou a 10 e o tráfego voltou sem perda.

**Causa provável** (confiança média): perda de sinal no módulo SFP do R-FILIAL. `consultar_mikrotik erros_ethernet`
mostrou 0 erros CRC no sfp1 antes da queda e link down limpo, o que aponta para o cabo/conector e não para o roteador.

**Impacto:** nenhum para os usuários; latência subiu de 0,6 ms para ~19 ms no rádio durante 27 min.

**Ações recomendadas**
1. Limpar e reencaixar o conector LC do sfp1 na Filial.
2. Verificar o nível óptico (`/interface ethernet monitor sfp1`).
3. Acompanhar o trigger "fibra instável" nas próximas 24 h."""


def _hora(ts):
    return time.strftime("%H:%M:%S", time.localtime(ts))


# ---------------------------------------------------------------- API pública
def visao():
    if SIMULACAO:
        t = _agora()
        fibra_up = not (_queda_ini <= t <= _queda_fim)
        return {
            "modo": "simulação", "host": HOST, "atualizado": t,
            "caminho": "fibra" if fibra_up else "radio",
            "enlaces": {
                "fibra": {"up": fibra_up, "latencia": _lat_fibra(t), "perda": 0, "porta": "sfp1", "custo": 10, "ip": "10.0.1.2"},
                "radio": {"up": False, "latencia": None, "perda": 100, "porta": "ether1", "custo": 100, "ip": "10.0.2.2", "sinal": None, "desde": _radio_ini},
            },
            "ultimo_failover": {"em": _queda_ini, "segundos": 3.9, "retorno_em": _queda_fim, "retorno_sem_perda": True},
            "disponibilidade_24h": {"fibra": 98.1, "radio": 94.4, "filial": 99.99},
            "snmp": {"cpu": 4, "memoria": 21, "uptime": 6 * 86400 + 3 * 3600, "routeros": "7.24.5", "modelo": "hEX S RB760iGS"},
        }
    h = call("host.get", {"filter": {"host": [HOST]}, "output": ["hostid", "available"]})[0]
    itens = {i["key_"]: i for i in call("item.get", {"hostids": h["hostid"], "output": ["key_", "lastvalue", "lastclock"],
                                                       "search": {"key_": "icmp"}})}
    caminho = call("item.get", {"hostids": h["hostid"], "filter": {"key_": "noc.caminho_ativo"}, "output": ["lastvalue"]})
    fail = call("item.get", {"hostids": h["hostid"], "filter": {"key_": "noc.failover.segundos"}, "output": ["lastvalue", "lastclock"]})

    def enlace(prefixo):
        ping = next((v for k, v in itens.items() if k.startswith("icmpping[") and prefixo in k), None)
        lat = next((v for k, v in itens.items() if k.startswith("icmppingsec[") and prefixo in k), None)
        perda = next((v for k, v in itens.items() if k.startswith("icmppingloss[") and prefixo in k), None)
        up = bool(ping and ping["lastvalue"] == "1")
        return {"up": up,
                "latencia": round(float(lat["lastvalue"]) * 1000, 2) if lat and up else None,
                "perda": float(perda["lastvalue"]) if perda else None}

    fibra, radio = enlace(FIBRA_IP), enlace(RADIO_IP)
    fibra.update(porta="sfp1", custo=10, ip=FIBRA_IP)
    radio.update(porta="ether1", custo=100, ip=RADIO_IP)
    # Item calculado do noc-senai-tcc: fibra*2 + rádio -> 3/2 = FIBRA, 1 = RÁDIO, 0 = ISOLADA
    valor = caminho[0]["lastvalue"] if caminho and caminho[0]["lastvalue"] not in ("", None) else None
    via = ("fibra" if int(float(valor)) >= 2 else "radio") if valor is not None else ("fibra" if fibra["up"] else "radio")
    falhou = fail and fail[0]["lastclock"] not in ("0", "", None)
    return {"modo": "zabbix", "host": HOST, "atualizado": _agora(), "caminho": via,
            "enlaces": {"fibra": fibra, "radio": radio},
            "ultimo_failover": {"em": int(fail[0]["lastclock"]), "segundos": round(float(fail[0]["lastvalue"]), 1)} if falhou else None,
            "disponibilidade_24h": None, "snmp": {"disponivel": h.get("available") == "1"}}


def serie(metrica, horas):
    if SIMULACAO:
        return _sim_serie(metrica, horas)
    h = call("host.get", {"filter": {"host": [HOST]}, "output": ["hostid"]})[0]
    desde = _agora() - horas * 3600
    passo = 300 if horas <= 24 else 3600
    baldes: dict[int, dict[str, list[float]]] = {}

    def item(**filtro):
        r = call("item.get", {"hostids": h["hostid"], "output": ["itemid", "value_type", "name"], **filtro})
        return r[0] if r else None

    if metrica == "latencia":
        itens = {"fibra": item(search={"key_": f"icmppingsec[{FIBRA_IP},"}), "radio": item(search={"key_": f"icmppingsec[{RADIO_IP},"})}
        escala = 1000  # segundos -> ms
    else:  # tráfego: interfaces do template "Mikrotik by SNMP"
        rec = call("item.get", {"hostids": h["hostid"], "output": ["itemid", "value_type", "name"], "search": {"name": "Bits received"}})
        achar = lambda *nomes: next((i for i in rec if any(n.lower() in i["name"].lower() for n in nomes)), None)
        itens = {"fibra": achar("sfp1", "FIBRA"), "radio": achar("ether1", "RADIO")}
        escala = 1 / 1_000_000  # bps -> Mbps
    for nome, it in itens.items():
        if not it:
            continue
        if horas > 72:
            dados = call("trend.get", {"itemids": [it["itemid"]], "time_from": desde, "output": ["clock", "value_avg", "value_min"]})
        else:
            dados = call("history.get", {"itemids": [it["itemid"]], "history": int(it["value_type"]), "time_from": desde,
                                         "sortfield": "clock", "output": ["clock", "value"]})
        for p in dados:
            t = int(p["clock"]) - int(p["clock"]) % passo
            v = float(p.get("value", p.get("value_avg", 0)))
            # sem resposta (0 s) em qualquer medição do balde = enlace fora naquele trecho
            if metrica == "latencia" and float(p.get("value", p.get("value_min", 1))) == 0:
                v = float("nan")
            baldes.setdefault(t, {}).setdefault(nome, []).append(v)
    out = []
    for t in sorted(baldes):
        ponto = {"t": t}
        for nome, vals in baldes[t].items():
            ponto[nome] = None if any(v != v for v in vals) else round(sum(vals) / len(vals) * escala, 2)
        out.append(ponto)
    return out


def alertas(horas=168):
    if SIMULACAO:
        out = []
        for eid, sev, nome, ini, fim in _SIM_ALERTAS:
            ativo = fim is None or fim > _agora()
            out.append({"id": eid, "severidade": SEVERIDADES[str(sev)], "nivel": sev, "nome": nome, "host": HOST,
                        "inicio": ini, "fim": None if ativo else fim, "ativo": ativo, "reconhecido": eid in _reconhecidos,
                        "chamado": None,
                        "analise": _SIM_ANALISE.format(ini=_hora(ini), fim=_hora(fim)) if sev >= 4 and fim else None})
        return sorted(out, key=lambda a: (not a["ativo"], -a["inicio"]))
    evs = call("event.get", {"source": 0, "object": 0, "value": 1, "time_from": _agora() - horas * 3600,
                             "selectHosts": ["host"], "select_acknowledges": ["message", "username", "clock", "action"],
                             "output": ["eventid", "name", "severity", "clock", "r_eventid", "acknowledged"],
                             "sortfield": ["clock"], "sortorder": "DESC"})
    rec_ids = [e["r_eventid"] for e in evs if e["r_eventid"] != "0"]
    fins = {r["eventid"]: int(r["clock"]) for r in call("event.get", {"eventids": rec_ids, "output": ["eventid", "clock"]})} if rec_ids else {}
    out = []
    for e in evs:
        analise = next((a["message"] for a in e.get("acknowledges", []) if a.get("username") == "noc-analista" and a.get("message")), None)
        fim = fins.get(e["r_eventid"])
        out.append({"id": e["eventid"], "severidade": SEVERIDADES[e["severity"]], "nivel": int(e["severity"]), "nome": e["name"],
                    "host": e["hosts"][0]["host"] if e.get("hosts") else HOST, "inicio": int(e["clock"]), "fim": fim,
                    "ativo": fim is None, "reconhecido": e["acknowledged"] == "1", "chamado": None, "analise": analise})
    return out


def reconhecer(eventid, mensagem=""):
    if SIMULACAO:
        _reconhecidos.add(eventid)
        return True
    call("event.acknowledge", {"eventids": [eventid], "action": 2 | (4 if mensagem else 0), "message": mensagem})
    return True


_SIM_EQUIP = [
    {"nome": "R-MATRIZ", "tipo": "roteador", "ip": "10.255.255.1", "modelo": "MikroTik hEX S", "local": "Matriz", "latencia": 0.3},
    {"nome": "R-FILIAL", "tipo": "roteador", "ip": "10.255.255.2", "modelo": "MikroTik hEX S", "local": "Filial", "latencia": None},
    {"nome": "SW-MATRIZ", "tipo": "switch", "ip": "192.168.10.2", "modelo": "Switch L2", "local": "Matriz", "latencia": 0.4},
    {"nome": "SW-FILIAL", "tipo": "switch", "ip": "192.168.20.2", "modelo": "Switch L2", "local": "Filial", "latencia": 0.9},
    {"nome": "RADIO-P2P-MATRIZ", "tipo": "antena", "ip": "10.0.2.3", "modelo": "Ubiquiti PowerBeam M5", "local": "Matriz", "latencia": 1.1, "sinal": -53},
    {"nome": "RADIO-P2P-FILIAL", "tipo": "antena", "ip": "10.0.2.4", "modelo": "Ubiquiti PowerBeam M5", "local": "Filial", "latencia": 3.4, "sinal": -52},
    {"nome": "NOC-ZABBIX", "tipo": "servidor", "ip": "192.168.10.50", "modelo": "Debian 12 · Zabbix 7.0", "local": "Matriz", "latencia": 0.1},
]


def _tipo(nome):
    return "roteador" if nome.startswith("R-") else "antena" if "RADIO" in nome else "switch" if nome.startswith("SW") else "servidor"


def equipamentos():
    if SIMULACAO:
        t = _agora()
        fora = {"RADIO-P2P-FILIAL"}  # a antena da Filial parou de responder junto com o enlace
        return [dict(e, up=e["nome"] not in fora, latencia=None if e["nome"] in fora else e["latencia"] or _lat_fibra(t),
                     sinal=None if e["nome"] in fora else e.get("sinal")) for e in _SIM_EQUIP]
    hosts = call("host.get", {"output": ["hostid", "host", "status"], "selectInterfaces": ["ip"],
                              "selectInventory": ["model", "location"]})
    com_problema = {h["hostid"] for p in call("problem.get", {"output": ["eventid"], "selectHosts": ["hostid"]})
                    for h in p.get("hosts", [])}
    return [{"nome": h["host"], "tipo": _tipo(h["host"]), "ip": h["interfaces"][0]["ip"] if h.get("interfaces") else "",
             "modelo": (h.get("inventory") or {}).get("model", ""),
             "local": (h.get("inventory") or {}).get("location") or ("Filial" if "FILIAL" in h["host"].upper() else "Matriz"),
             "up": h["status"] == "0" and h["hostid"] not in com_problema, "latencia": None} for h in hosts]
