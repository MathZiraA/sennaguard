"""Provedores de IA do SennaGuard, com a mesma regra do Analista IA do noc-senai-tcc:
Claude quando existir a chave da Anthropic; senão, Gemini (camada gratuita); sem chave, a IA fica desligada.

As ferramentas são funções Python com docstring e tipos: os dois SDKs montam o esquema a partir delas.
"""
import logging
import os
import time
from pathlib import Path

log = logging.getLogger("sennaguard.ia")

CHAVE_ANTHROPIC = Path(os.environ.get("SENNAGUARD_ANTHROPIC_KEY", "/etc/sennaguard/anthropic_key"))
CHAVE_GEMINI = Path(os.environ.get("SENNAGUARD_GEMINI_KEY", "/etc/sennaguard/gemini_key"))
MODELO_CLAUDE = "claude-opus-5-5"
# Aliases da camada gratuita, em ordem; a camada gratuita responde 429/503 no pico e aí tenta o próximo
MODELOS_GEMINI = ["gemini-flash-latest", "gemini-flash-lite-latest"]


def _chave(caminho: Path, variavel: str):
    if os.environ.get(variavel):
        return os.environ[variavel].strip()
    try:
        return caminho.read_text().strip() or None
    except OSError:
        return None


def provedor():
    if _chave(CHAVE_ANTHROPIC, "ANTHROPIC_API_KEY"):
        return "claude"
    if _chave(CHAVE_GEMINI, "GEMINI_API_KEY"):
        return "gemini"
    return None


class IaIndisponivel(Exception):
    pass


def conversar(system: str, mensagens: list[dict], ferramentas: list) -> str:
    """mensagens: [{"papel": "usuario"|"ia", "texto": str}], a última é do usuário."""
    p = provedor()
    if p == "claude":
        return _claude(system, mensagens, ferramentas)
    if p == "gemini":
        return _gemini(system, mensagens, ferramentas)
    raise IaIndisponivel("A IA ainda não foi configurada no servidor (chave do Gemini ou da Anthropic).")


def gerar(system: str, pedido: str) -> str:
    """Uma resposta só, sem ferramentas (rascunho de artigo, explicação de diferença de configuração)."""
    return conversar(system, [{"papel": "usuario", "texto": pedido}], [])


# ---------------------------------------------------------------- Claude (SDK oficial, tool runner)
def _claude(system, mensagens, ferramentas):
    import anthropic
    from anthropic import beta_tool

    cliente = anthropic.Anthropic(api_key=_chave(CHAVE_ANTHROPIC, "ANTHROPIC_API_KEY"))
    historico = [{"role": "user" if m["papel"] == "usuario" else "assistant", "content": m["texto"]} for m in mensagens]
    runner = cliente.beta.messages.tool_runner(
        model=MODELO_CLAUDE,
        max_tokens=16000,
        system=system,
        tools=[beta_tool(f) for f in ferramentas],
        messages=historico,
        output_config={"effort": "medium"},
        # Se o classificador de segurança recusar, o servidor tenta outro modelo sozinho
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        max_iterations=12,
    )
    final = runner.until_done()
    if final.stop_reason == "refusal":
        return "Não consigo responder a isso. Reformule a pergunta sobre a rede ou os chamados."
    return "".join(b.text for b in final.content if b.type == "text").strip()


# ---------------------------------------------------------------- Gemini (google-genai, chamada automática das funções)
def _gemini(system, mensagens, ferramentas):
    from google import genai
    from google.genai import errors, types

    cliente = genai.Client(api_key=_chave(CHAVE_GEMINI, "GEMINI_API_KEY"), http_options=types.HttpOptions(timeout=90_000))
    historico = [types.Content(role="user" if m["papel"] == "usuario" else "model", parts=[types.Part(text=m["texto"])])
                 for m in mensagens[:-1]]
    erro = None
    for modelo in MODELOS_GEMINI:
        for tentativa in range(2):
            try:
                chat = cliente.chats.create(model=modelo, history=historico, config=types.GenerateContentConfig(
                    system_instruction=system, tools=ferramentas or None, temperature=0.2,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=10)))
                return (chat.send_message(mensagens[-1]["texto"]).text or "").strip()
            except errors.APIError as e:
                if e.code not in (429, 500, 503):
                    raise
                erro = e
                log.warning("Gemini %s indisponível (%s), tentativa %d", modelo, e.code, tentativa + 1)
                time.sleep(3)
    raise IaIndisponivel(f"A IA está sobrecarregada agora, tente de novo em instantes ({erro}).")
