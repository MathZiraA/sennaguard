# SennaGuard — sistema de interface

## Direção

Sala de NOC à noite. Um rack escuro com LEDs: o violeta do patch de fibra e o teal do enlace de rádio. Quem usa:
- o operador de plantão, olhando a TV ou o notebook;
- o cliente da Filial, abrindo um chamado.

A primeira leitura de qualquer tela responde a uma pergunta: **a Filial tem redundância agora?**

Referências visuais: os dashboards ThermiQ e FleetX do Behance (escuro com lavanda, cards com borda sutil, área com gradiente e faixa de incidente).

## Assinatura: o trilho do caminho ativo

Matriz ⇄ Filial com dois trilhos. A fibra fica em cima, em violeta, e o rádio embaixo, em teal.

| Estado | Como aparece |
| --- | --- |
| Ativo | tracejado andando (`.trilho-ativo`) e halo de 6 px a 25% |
| Em espera | linha sólida a 45% |
| Fora | tracejado vermelho, cortado no meio |

O trilho aparece em:
- `Trilho` (herói da Visão);
- `TrilhoMini` (28 px, nas listas de alertas e chamados, em vermelho no enlace atingido; o assunto é o texto antes do ":");
- `Marca` (logotipo);
- a faixa do topo do Login;
- a `Foto` do enlace no chamado SG.

**Regra:** todo elemento novo que fale de um enlace usa esse desenho, nunca um ícone genérico.

## Tokens (`frontend/src/index.css`, `@theme`)

| Token | Valor | Uso |
| --- | --- | --- |
| `rack` | #111015 | fundo, inclusive a barra lateral |
| `painel` | #18171e | cards |
| `painel-alto` | #211f29 | hover, menus, diálogos, botão quieto |
| `fenda` | #0c0b10 | campos (afundados, mais escuros que o card) |
| `tinta` / `-2` / `-3` / `-4` | #ecebf3 / #b3b0c2 / #7c798f / #4f4d5e | texto: principal / apoio / meta / desligado |
| `fibra` | #9d8cfb | enlace principal **e** cor da marca/ação primária |
| `radio` | #5ccabf | enlace de backup, sinal em dBm |
| `led` | #5bd68a | link up, livro íntegro |
| `desastre` `alta` `media` `aviso` | #f0616d #f28b5e #e6b450 #e58fd0 | severidades do Zabbix. `media` também marca chamado SG aberto |
| `fio` / `fio-forte` | branco 6% / 11% | bordas |

As cores de severidade só aparecem onde há problema. A tela em estado normal é quase toda cinza com violeta.

## Profundidade e forma

- **Profundidade:** só bordas (`border-fio`), sem sombra em card. `shadow-2xl` fica só para menus e diálogos flutuantes.
- **Raio:** `rounded-md` 6 px (chips internos), `rounded-lg` 8 px (botões, campos, linhas), `rounded-xl` 12 px (blocos internos, nós do trilho), `rounded-2xl` 16 px (cards e diálogos).
- **Brilho:** o `Led` (ponto de 6 px com `box-shadow` da própria cor) é o único brilho da interface. Ele pulsa (`.respira`) só quando o estado exige atenção.

## Tipografia

- **Fontes:** Manrope Variable (interface) e JetBrains Mono (IPs, portas, `NOC-xxx`/`SG-xxx`, hashes). As duas vão empacotadas via @fontsource, porque a Filial pode estar sem internet.
- **Escala:** base de 13 px. Meta 11 · corpo 13 · título de card 15/600 · título de página 20/600 com tracking −0.02em · frase-herói 22/600 · número-herói 28/600 tabular.
- **Hierarquia:** feita por peso e tinta, não só por tamanho. Valor 600/`tinta`, rótulo 500/`tinta-2`, meta 400/`tinta-3`.
- **Números:** todo número dinâmico usa `.num` (tabular-nums).

## Espaçamento (base 4 px)

| Elemento | Medidas |
| --- | --- |
| Card | `p-5` (20 px); trilho `px-6` |
| Gap entre blocos | `gap-4` (16 px) |
| Linhas de lista | `px-3 py-2` (compactas) ou `px-5 py-3.5` (tabelas) |
| Barra lateral | 232 px; itens `h-9` |
| Cabeçalho | `h-14` |
| Conteúdo | `max-w-[1320px]` |

## Componentes (`components/ui.tsx`, `Modal.tsx`, `Atendimento.tsx`)

- **Botao:** `h-8`, `px-3`, `rounded-lg`, 12/500, `active:scale-[0.97]`. Variantes:
  - `primario`: fundo `fibra`, texto `rack`;
  - `quieto`: `painel-alto` com borda;
  - `perigo`: vermelho a 12%.
- **Campo:** `h-9` (login `h-10`), `bg-fenda`, `border-fio`, foco `border-fibra/60`.
- **Escolha em cartões** (`Opcoes`, papel do usuário): rádio nativo `sr-only`. Selecionado com `border-fibra/60 bg-fibra/10`.
- **Segmentado:** trilho `bg-fenda` p-0.5, item ativo `bg-painel-alto`.
- **Sev:** pílula com o texto na cor da severidade sobre a mesma cor a 12%.
- **StatusChamado:** Led + rótulo. Aberto = `media` (pulsa), em atendimento = `fibra`, resolvido = `led`.
- **Modal:** Radix Dialog.
  - `lado` = gaveta de 520 px para detalhe (alerta, chamado), entrada `gaveta` em 240 ms;
  - centro = 460 px para formulário, entrada `surge` em 200 ms;
  - easing `cubic-bezier(0.23,1,0.32,1)`.
- **Card de alerta na Visão:** ativo = borda da severidade a 45% e fundo a 7%; resolvido = `border-fio`.
- **Histórico** (chamado SG): linha vertical `border-fio`, ponto violeta para a equipe e âmbar para o cliente, hash em mono 10 px `tinta-4`.

## Padrões de tela

- **Título:** h1 20/600 e uma frase de apoio em `tinta-3`. A ação primária fica à direita.
- **Lista principal:** um card `!p-0` com linhas separadas por `border-fio`. Clicar abre a gaveta, com o estado na URL (`?id=` ou `?sg=`).
- **Integridade** (chamados): faixa com escudo. Íntegro = `led` a 6%, adulterado = `desastre` a 10%.
- **Perfil Cliente:** vê menos, nunca vê uma tela quebrada. Esconde a barra de contexto do host e troca Alertas por "Seus chamados" com o botão Abrir chamado.
- **Vazio:** borda tracejada `border-fio` com uma frase útil ("Nenhum chamado. Tudo certo com a Filial.").

## Movimento

- Até 240 ms, só `transform` e `opacity`.
- Pressionar: scale 0.97.
- A animação contínua (trilho, Led) é desligada com `prefers-reduced-motion`.
