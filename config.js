/*
  CONFIG.JS — edite este arquivo para adicionar, remover ou mudar botões e páginas.
  Não é preciso mexer no index.html.

  Cada página tem um "id" (nome interno, sem espaços/acentos, usado como chave
  dentro de "pages"), um "title" (nome que aparece na tela) e uma lista "items"
  com os botões daquela página.

  Cada item pode ser de dois tipos:

  1) Link direto para uma página do Notion:
     { label: "Nome do botão", type: "notion", url: "https://notion.so/..." }

  2) Botão que abre outra página DESTE app (navegação interna):
     { label: "Nome do botão", type: "page", target: "id_da_pagina" }

  3) Botão que cria uma página nova no Notion a partir de um template
     (usa o Cloudflare Worker configurado em "templateWorkerUrl" abaixo):
     { label: "Nome do botão", type: "notion-template", database_id: "...", template_id: "..." }
     Pra achar o database_id e o template_id de um template, use o endpoint
     GET <templateWorkerUrl>/templates?database_id=XXXX (veja resumo-projeto.md).

  Além de "items"/"groups", uma página pode ter "dynamicQuery" no lugar
  (ex: a página "hoje"): busca ao vivo, toda vez que a página é aberta (ou
  quando um filtro na tela muda), as páginas de uma base do Notion que
  baterem com os filtros indicados.
     dynamicQuery: {
       database_id: "...",
       baseFilters: [ { property: "Nome do campo", type: "date", condition: "equals", value: "today" } ],
       filters: [   // opcional — vira um dropdown com ícone na tela
         {
           property: "Nome do campo", type: "relation" (ou "select"/"multi_select"),
           condition: "contains" (ou "equals"), label: "Nome do filtro",
           options: [ { label: "...", pageId/value: "...", icon: "ti-nome-do-icone", color: "#hex" }, ... ]
         }
       ]
     }
     (usa o endpoint GET <templateWorkerUrl>/query?database_id=X&filters=[...])

     Por padrão, todo filtro permite marcar VÁRIAS opções ao mesmo tempo
     (clique liga/desliga, sem fechar o menu) — as opções marcadas viram um
     "ou" entre si (ex: Andamento = A OU Andamento = B), combinado com "e"
     junto dos outros filtros/baseFilters. Pra voltar a permitir só 1 opção
     por vez, adicione "multi: false" no filtro (ex: o "LIMIT_FILTER" de
     Tarefas, onde marcar "5 e 20" ao mesmo tempo não faz sentido).

     Numa opção de filtro, "pageId" é o valor padrão (junto com a "condition"
     do filtro). Pra sobrescrever ambos numa opção específica, use "condition"
     e "value" direto na opção — usado nos filtros de data relativa (ex: "Esta
     semana" usa condition:"next_week", value:{}, em vez de comparar com uma
     data exata). Pra campos "date", "value"/"pageId" também aceita as
     palavras especiais "today"/"tomorrow"/"yesterday" (o Worker resolve pra
     data exata no fuso de São Paulo).

  Uma página também pode ter "dynamicQueries" (no plural) em vez de
  "dynamicQuery": uma LISTA de exibições fixas na mesma página (ex: a página
  "Reuniões", com "Próximas Reuniões"/"Últimas Reuniões"/"Andamento
  pendente"), cada uma com seu próprio title/database_id/baseFilters/sorts e,
  opcionalmente, seu próprio "filters" (mesmo formato do "dynamicQuery" acima
  — vira um dropdown só daquela exibição), opcionalmente "bg" (cor de fundo
  em hex pra caixa inteira daquela exibição — ex: um vermelho bem claro pra
  "Atrasadas"; sem "bg" fica sem fundo, igual antes), e opcionalmente "cardFields":
  uma lista de propriedades da base pra mostrar como subtítulo em cada card
  de resultado (ex: data/hora, status). Cada entrada é
  { property, type: "date"|"relation", lookup: "andamento" (opcional) } —
  "date" formata como "dd/mm hh:mm → hh:mm"; "relation" com
  lookup:"andamento" mostra o rótulo/cor de "andamentoOptions" (lista mestre
  lá em cima). Sempre só leitura (Worker: /query?...&extra=[...]).

  Um "filters" (de "dynamicQuery" ou "dynamicQueries") pode ter "default":
  o "pageId" de uma opção pra já vir selecionada quando a página abre (ex:
  "Última semana" em vez de "Todos"). Se quiser voltar a "Todos" ou trocar,
  é só clicar no filtro na tela — o "default" só define o estado inicial.

  Um filtro normalmente tem "options" fixo no config.js. Mas quando o campo
  do Notion tem uma lista de opções grande/crescente (ex: "🏷️ Assuntos
  (PMF)", com 90+ tags) fixar no config.js ficaria desatualizado — nesse
  caso use "optionsFrom: { database_id, property }" no lugar de "options":
  o app.js busca a lista ao vivo (nome + cor de cada opção) via GET /schema
  (só leitura) toda vez que a exibição abre, mostrando "Carregando
  filtros…" nesse meio-tempo (só implementado em "dynamicQueries" por
  enquanto, não em "dynamicQuery"/"search"). Propriedades do tipo "rollup"
  (que não são campo nativo da base, tipo "🏷️ Assuntos (PMF)" em
  Legislações — é rollup da relação "Central") usam type:"rollup" +
  "rollupTargetType" (o tipo do campo de origem do rollup, ex:
  "multi_select" — o worker.js monta o filtro aninhado
  {rollup:{any:{multi_select:{...}}}} que o Notion exige).

  Uma página também pode ter "items" (botões fixos) JUNTO com "dynamicQuery"/
  "dynamicQueries"/"search" na mesma página — nesse caso "items" aparece no
  topo (ex: Reuniões: botões de link direto pras visualizações do Notion,
  depois as exibições ao vivo, depois a busca). Nesse caso normalmente vale
  a pena usar "itemsCompact: true" na página, senão os botões ficam altos
  demais (cartão de desktop) pra só um link direto.

  "itemGroups" é uma variação de "items" pro mesmo lugar (topo da página),
  só que divide os botões em pequenos subgrupos com um rótulo cada — uma
  caixinha fina ao redor, bem mais leve que "groups" (que é pra caixas
  maiores, tipo Favoritas). Cada entrada é { title, items: [...] } e os
  itens dentro sempre saem no estilo "items-compact" (não depende de
  "page.itemsCompact"). Usado pra separar visualmente "Abrir no Notion"
  (type:"notion") de "Criar no Notion" (type:"notion-template") no topo de
  Reuniões/Tarefas/TAT — se uma página só tem um dos dois tipos, é só criar
  um subgrupo só (ex: Reuniões, que ainda não tem nenhum "Criar no Notion").
     itemGroups: [
       { title: "Abrir no Notion", items: [ { label:"...", type:"notion", icon:"notion", url:"..." } ] },
       { title: "Criar no Notion", items: [ { label:"...", type:"notion-template", icon:"notion", database_id:"...", template_id:"..." } ] }
     ]

  "search" (mesmo formato usado em Legislações) também aceita "baseFilters"
  (opcional): filtro sempre aplicado à busca (ex: escopar a base Central só
  aos registros de "PMF - Reuniões"), sem contar como "algo digitado" — a
  busca só dispara de verdade quando o usuário digita ou escolhe um filtro.

  Opcionalmente cada item pode ter um ícone (nome do Tabler Icons, sem o
  prefixo "ti-"). Lista de ícones: https://tabler.io/icons
     { label: "Calendário", type: "page", target: "calendario", icon: "calendar" }

  Pra um botão de link direto pro Notion (type: "notion") OU de criação de
  página (type: "notion-template"), use icon: "notion" pra mostrar o logo
  real do Notion em vez de um ícone Tabler genérico (mesmo tratamento visual
  usado em Legislações) — é o padrão a seguir sempre que criarmos um botão
  assim, dos dois tipos (fácil de esquecer no "notion-template" já que ele
  tem seu próprio ícone de chevron "file-plus" à direita — mas o ícone da
  esquerda também deve ser o logo do Notion, igual aos botões de link).
  Outras chaves de logo real disponíveis: "leis-municipais",
  "diario-oficial", "file-type-pdf".

  LEIAUTE PADRÃO das páginas "funcionais" (uma base do Notion com view no
  app) que criarmos/mudarmos daqui pra frente — ex: Reuniões, Tarefas, TAT:
    1) topo: "itemGroups" (ver abaixo) — botões de link direto pro Notion
       (type:"notion") e, quando fizer sentido, atalhos de criação de
       página (type:"notion-template") pros templates mais usados daquela
       base — ambos com icon:"notion", cada tipo no seu próprio subgrupo
       ("Abrir no Notion" / "Criar no Notion").
    2) meio: "dynamicQueries" — uma exibição por status/categoria relevante
       (ex: Pendentes/Concluídas), cada uma com "bg" (cor de fundo clara:
       amarelo pra pendente/em aberto, verde pra concluído, vermelho pra
       atrasado quando for uma exibição própria, azul claro pra "próximas"/
       agendado), filtro de Andamento (e outros que fizerem sentido: Origem,
       Prioridade...) sempre multi-select, e LIMIT_FILTER ("Exibir: 5/10/
       20/50") pra controlar quantos cards aparecem. Pendentes/em aberto
       primeiro, concluídas depois (mais relevante pra cima).
    3) final: "search" — busca por nome, com baseFilters escopando pra base
       certa (e "orPairs" quando a busca precisar cobrir mais de uma origem
       ao mesmo tempo, como em TAT: Sessões + Processos juntos).

  Cada grupo dentro de "groups" pode ter "compact: true", que deixa os
  botões daquele separador menores e lado a lado (2 colunas) — bom pra
  caixas com poucos links diretos (ex: "Link direto" em Legislações).

  "startPage" define qual página abre primeiro quando o app é aberto.

  REGRA ADOTADA: quando uma página interna tem um único botão (um único link
  do Notion, sem mais nada), o botão que leva até ela some — o botão do nível
  anterior aponta direto para o link do Notion (type: "notion"), evitando
  clique duplo. A página interna correspondente (ex: "calendario") continua
  definida abaixo, só não é referenciada por enquanto — assim, se um dia
  quiser abrir níveis dentro dela (mais de um botão), é só trocar o item do
  nível anterior de volta para type: "page" apontando pra ela.
*/

// Definições de filtro reaproveitadas em mais de uma exibição (ex: as 3
// exibições de Tarefas usam os MESMOS 3 dropdowns) — evita repetir a mesma
// lista de opções várias vezes. São só descrições (lidas, nunca alteradas
// pelo app), então é seguro compartilhar o mesmo objeto entre exibições.

// Andamento — os mesmos 8 status usados em Hoje/Reuniões.
var ANDAMENTO_FILTER = {
  property: "🧲 Andamento", type: "relation", condition: "contains", label: "Andamento",
  options: [
    { label: "0 - Iniciar agora", pageId: "9ff8db6d456d43f39e70e14786c1fe6d", icon: "ti-player-skip-forward-filled", color: "#4a90d9" },
    { label: "1 - Em andamento", pageId: "2030481486dd80d386a1cf7522b3deb1", icon: "ti-player-play-filled", color: "#4a90d9" },
    { label: "2 - Iniciar assim que possível", pageId: "d18f7c0ac312422cbc14a3ae1bc82399", icon: "ti-player-track-next-filled", color: "#4a90d9" },
    { label: "3 - Aguardando terceiros", pageId: "08cb3ec723ef41b19e6c6472ee9d9a75", icon: "ti-player-pause-filled", color: "#4a90d9" },
    { label: "4 - Iniciar quando possível", pageId: "959d289339c440a492612c70ea8ed1c9", icon: "ti-arrows-left-right", color: "#4a90d9" },
    { label: "5 - Agendado", pageId: "4ef9e6737cea4c53ae37efe966013214", icon: "ti-refresh", color: "#4a90d9" },
    { label: "6 - Concluído", pageId: "d228224dee1d43dabb72744097f10028", icon: "ti-circle-check-filled", color: "#2f9e44" },
    { label: "9 - Cancelado", pageId: "2410481486dd80a3a8b0d819542a55c5", icon: "ti-circle-x-filled", color: "#e03131" }
  ]
};

// Igual ANDAMENTO_FILTER acima, mas já vem com todos os status MENOS "6 -
// Concluído" pré-marcados — usado nas divisórias de cards de Início
// (Reuniões, Sessões, Tarefas, Aniversários, Outros eventos e Itens
// Prioritários), pra esconder itens já concluídos por padrão, sem esconder
// mais nada além disso (Cancelado, por ex., continua aparecendo). Pra ver
// algum item concluído em Início, é só marcar "6 - Concluído" nesse
// filtro (ou desmarcar os outros, se quiser ver só concluídos). Não mexe
// no ANDAMENTO_FILTER original — reaproveita as mesmas opções.
var INICIO_ANDAMENTO_FILTER = {
  property: "🧲 Andamento", type: "relation", condition: "contains", label: "Andamento",
  default: [
    "9ff8db6d456d43f39e70e14786c1fe6d", // 0 - Iniciar agora
    "2030481486dd80d386a1cf7522b3deb1", // 1 - Em andamento
    "d18f7c0ac312422cbc14a3ae1bc82399", // 2 - Iniciar assim que possível
    "08cb3ec723ef41b19e6c6472ee9d9a75", // 3 - Aguardando terceiros
    "959d289339c440a492612c70ea8ed1c9", // 4 - Iniciar quando possível
    "4ef9e6737cea4c53ae37efe966013214", // 5 - Agendado
    "2410481486dd80a3a8b0d819542a55c5"  // 9 - Cancelado
    // "d228224dee1d43dabb72744097f10028" (6 - Concluído) fica de fora do
    // default de propósito — é o único status escondido por padrão.
  ],
  options: ANDAMENTO_FILTER.options
};

// Prioridade — relação com a base "Prioridade" (6 níveis, 1 = mais urgente).
var PRIORIDADE_FILTER = {
  property: " 🚩 Prioridade", type: "relation", condition: "contains", label: "Prioridade",
  options: [
    { label: "1 - Imediato", pageId: "2460481486dd80b19d7edb3a9eccba08", icon: "ti-flame", color: "#e03131" },
    { label: "2 - Urgente", pageId: "2330481486dd801981efc913350a8034", icon: "ti-alert-triangle", color: "#e8590c" },
    { label: "3 - Alta", pageId: "2330481486dd807e9f21c4ed2c3c8e88", icon: "ti-arrow-up", color: "#f08c00" },
    { label: "4 - Média", pageId: "2330481486dd80ef94f9dae36b42b39f", icon: "ti-minus", color: "#4a90d9" },
    { label: "5 - Baixa", pageId: "2330481486dd80029cb6e049f84b8198", icon: "ti-arrow-down", color: "#868e96" },
    { label: "6 - Sem prioridade", pageId: "2330481486dd80d2bc15f5017684326f", icon: "ti-circle-dashed", color: "#c4c4c0" }
  ]
};

// Igual PRIORIDADE_FILTER acima, mas já vem com "1 - Imediato"/"2 -
// Urgente"/"3 - Alta" marcados quando a página abre — usado só em
// "Atrasados e Prioritários". Não mexe no PRIORIDADE_FILTER original (que
// segue sem nada marcado nas demais páginas); reaproveita as mesmas opções.
var PRIORITARIOS_PRIORIDADE_FILTER = {
  property: " 🚩 Prioridade", type: "relation", condition: "contains", label: "Prioridade",
  default: ["2460481486dd80b19d7edb3a9eccba08", "2330481486dd801981efc913350a8034", "2330481486dd807e9f21c4ed2c3c8e88"],
  options: PRIORIDADE_FILTER.options
};

// Origem — campo "select" (não relação): o "pageId" de cada opção é o
// próprio texto da opção no Notion (é o valor usado no filtro "equals").
var ORIGEM_FILTER = {
  property: "🧾 Origem", type: "select", condition: "equals", label: "Origem",
  options: [
    { label: "ABRASF", pageId: "ABRASF", icon: "ti-tag", color: "#3b82c4" },
    { label: "AFIFI", pageId: "AFIFI", icon: "ti-tag", color: "#8d6e5c" },
    { label: "Aniversários", pageId: "Aniversários", icon: "ti-tag", color: "#d44c47" },
    { label: "Atendimentos", pageId: "Atendimentos", icon: "ti-tag", color: "#c14c8a" },
    { label: "Auditorias", pageId: "Auditorias", icon: "ti-tag", color: "#cb9a08" },
    { label: "Betha", pageId: "Betha", icon: "ti-tag", color: "#448361" },
    { label: "Consultas", pageId: "Consultas", icon: "ti-tag", color: "#cb9a08" },
    { label: "Contratos e Convênios", pageId: "Contratos e Convênios", icon: "ti-tag", color: "#d44c47" },
    { label: "Fiscalização", pageId: "Fiscalização", icon: "ti-tag", color: "#d9730d" },
    { label: "Funcional", pageId: "Funcional", icon: "ti-tag", color: "#cb9a08" },
    { label: "JART", pageId: "JART", icon: "ti-tag", color: "#d44c47" },
    { label: "Jurisprudências", pageId: "Jurisprudências", icon: "ti-tag", color: "#d9730d" },
    { label: "Lançamentos", pageId: "Lançamentos", icon: "ti-tag", color: "#8d6e5c" },
    { label: "Legislação", pageId: "Legislação", icon: "ti-tag", color: "#cb9a08" },
    { label: "Letícia", pageId: "Letícia", icon: "ti-tag", color: "#d44c47" },
    { label: "Ofícios", pageId: "Ofícios", icon: "ti-tag", color: "#9065b0" },
    { label: "Pessoal", pageId: "Pessoal", icon: "ti-tag", color: "#8a8a86" },
    { label: "Processos", pageId: "Processos", icon: "ti-tag", color: "#3b82c4" },
    { label: "Reuniões", pageId: "Reuniões", icon: "ti-tag", color: "#448361" },
    { label: "Sistemas", pageId: "Sistemas", icon: "ti-tag", color: "#c14c8a" },
    { label: "TAT", pageId: "TAT", icon: "ti-tag", color: "#3b82c4" },
    { label: "Vitor", pageId: "Vitor", icon: "ti-tag", color: "#9b9a97" },
    { label: "Saúde", pageId: "Saúde", icon: "ti-tag", color: "#8a8a86" }
  ]
};

// "Exibir" — não é um filtro do Notion, é só quantos cards mostrar (corta
// a lista no próprio app, depois de buscar). "type: 'limit'" avisa o app.js
// pra NÃO mandar isso como filtro pro Worker. Começa em 10 ("default").
var LIMIT_FILTER = {
  property: "__limit__", type: "limit", label: "Exibir", default: "10",
  // seleção única — não faz sentido marcar "5 e 20" ao mesmo tempo.
  multi: false,
  options: [
    { label: "5", pageId: "5", icon: "ti-list-numbers", color: "#4a90d9" },
    { label: "10", pageId: "10", icon: "ti-list-numbers", color: "#4a90d9" },
    { label: "20", pageId: "20", icon: "ti-list-numbers", color: "#4a90d9" },
    { label: "50", pageId: "50", icon: "ti-list-numbers", color: "#4a90d9" }
  ]
};

// cardFields comuns às 3 exibições de Tarefas — data, andamento, origem e
// prioridade abaixo do nome de cada card.
var TAREFAS_CARD_FIELDS = [
  { property: "📅 Data/Prazo", type: "date" },
  { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
  { property: "🧾 Origem", type: "select" },
  { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" }
];

// cardFields das 3 exibições de Betha — igual Tarefas, mas sem Origem e
// trazendo "📖 Processo/Chamado" no lugar (é multi_select — confirmado por
// consulta direta na Central, mesmo tendo sempre 1 só valor na prática).
var BETHA_CARD_FIELDS = [
  { property: "📅 Data/Prazo", type: "date" },
  { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
  { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" },
  { property: "📖 Processo/Chamado", type: "multi_select" }
];

// Focus — fórmula da Central (⭐ Focus) que combina Andamento + Prazo/
// Prioridade/Importância do Pointer num rótulo só. É "formula" (não
// select/relation), então o filtro usa "formulaType: 'string'" (ver
// worker.js: filtro de fórmula precisa do formato aninhado
// {formula:{string:{...}}}). Os 3 rótulos abaixo são exatamente os que a
// fórmula devolve (fora eles, só devolve texto vazio — sem opção "vazio"
// aqui, não faz sentido filtrar "por nada"). Reaproveitado nas exibições
// de Tarefas, Reuniões e Betha.
// "condition: 'contains'" (não "equals") de propósito: a fórmula usa
// style(...) pra colorir o texto no Notion, e não dá pra confirmar (com as
// ferramentas disponíveis pra consultar o Notion nesta conversa) se o valor
// que a API devolve pra filtro é exatamente igual ao texto visível ou se
// carrega algum metadado extra de formatação junto. "contains" é uma
// combinação estritamente mais permissiva que "equals" pros mesmos 3
// rótulos (bem específicos, sem risco de bater com outra coisa por engano)
// — se o valor real tiver algo além do texto puro, "contains" ainda
// encontra; "equals" não encontraria.
var FOCUS_FILTER = {
  property: "⭐ Focus", type: "formula", formulaType: "string", condition: "contains", label: "Focus",
  options: [
    { label: "⭐ 1 - Focus", pageId: "⭐ 1 - Focus", icon: "ti-star-filled", color: "#f08c00" },
    { label: "⚠️ 2 - Atenção", pageId: "⚠️ 2 - Atenção", icon: "ti-alert-triangle", color: "#e8590c" },
    { label: "📅 3 - Verificar prazo", pageId: "📅 3 - Verificar prazo", icon: "ti-calendar-exclamation", color: "#4a90d9" }
  ]
};

// Igual FOCUS_FILTER acima, mas já vem com "⭐ 1 - Focus" e "⚠️ 2 -
// Atenção" marcados quando a página abre — usado só na seção "Itens
// Prioritários" de "Início" (o Focus já junta prazo+prioridade+importância
// na própria fórmula do Notion, por isso não precisa de mais nenhum filtro
// de data aqui — pega tanto o que está em dia quanto o que já atrasou). Não
// mexe no FOCUS_FILTER original, que segue sem nada marcado nas demais
// páginas.
var INICIO_FOCUS_FILTER = {
  property: "⭐ Focus", type: "formula", formulaType: "string", condition: "contains", label: "Focus",
  default: ["⭐ 1 - Focus", "⚠️ 2 - Atenção"],
  options: FOCUS_FILTER.options
};

// Categoria (só em Betha) — não é um campo do Notion, é um filtro por
// TRECHO do nome da tarefa (title "contains"), pra separar os 4 padrões de
// nomenclatura usados em "PMF - Betha - Tarefas" (ex: "Sistemas - Betha
// Tributos - Chamados - Arrecadação - PIX" bate com "Chamados"). Confirmado
// por consulta direta na Central que os 4 padrões batem com tarefas reais
// (Chamados: 41, Créditos Tributários: 6, Relatórios: 7, Scripts: 28).
var BETHA_CATEGORIA_FILTER = {
  property: "Nome", type: "title", condition: "contains", label: "Categoria",
  options: [
    { label: "Chamados", pageId: "Chamados", icon: "ti-tag", color: "#4a90d9" },
    { label: "Créditos Tributários", pageId: "Créditos Tributários", icon: "ti-tag", color: "#448361" },
    { label: "Relatórios", pageId: "Relatórios", icon: "ti-tag", color: "#9065b0" },
    { label: "Scripts", pageId: "Scripts", icon: "ti-tag", color: "#d9730d" }
  ]
};

// Tipo (campo "select" nativo de Legislações) — mesma lista usada tanto na
// busca ao final da página "Legislações" quanto no filtro da visualização
// "Todas as legislações" (reaproveitada pra não duplicar as 10 opções).
var LEGISLACOES_TIPO_FILTER = {
  property: "Tipo", type: "select", condition: "equals", label: "Tipo",
  options: [
    { label: "Decreto", pageId: "Decreto", icon: "ti-tag", color: "#ad1a72" },
    { label: "Edital", pageId: "Edital", icon: "ti-tag", color: "#6940a5" },
    { label: "Emenda Constitucional", pageId: "Emenda Constitucional", icon: "ti-tag", color: "#64473a" },
    { label: "Instrução Normativa", pageId: "Instrução Normativa", icon: "ti-tag", color: "#0b6e99" },
    { label: "Lei Complementar Municipal", pageId: "Lei Complementar Municipal", icon: "ti-tag", color: "#e03e3e" },
    { label: "Lei Complementar Nacional", pageId: "Lei Complementar Nacional", icon: "ti-tag", color: "#787774" },
    { label: "Lei Ordinária", pageId: "Lei Ordinária", icon: "ti-tag", color: "#dfab01" },
    { label: "Lei Promulgada", pageId: "Lei Promulgada", icon: "ti-tag", color: "#9b9a97" },
    { label: "Portaria", pageId: "Portaria", icon: "ti-tag", color: "#0f7b6c" },
    { label: "Resolução", pageId: "Resolução", icon: "ti-tag", color: "#d9730d" }
  ]
};

// Assuntos (🏷️ Assuntos (PMF)) — NÃO é campo nativo de Legislações, é um
// rollup da relação "Central" (confirmado via consulta direta: em
// Legislações o schema mostra type "rollup"/targetPropertyType
// "multi_select"; na própria Central é o multi_select de verdade, com 90+
// tags já cadastradas e crescendo). Uma lista dessas não dá pra fixar aqui
// (ficaria desatualizada) — "optionsFrom" busca as opções ao vivo (GET
// /schema, só leitura) na base Central toda vez que a página abre, em vez
// de "options" fixo. "rollupTargetType" avisa o worker.js que o filtro
// precisa do formato aninhado {rollup:{any:{multi_select:{...}}}}.
// "searchable: true" — mostra uma caixa de texto dentro do próprio dropdown
// pra filtrar as opções visíveis (90+ tags não cabem só rolando); depois de
// marcar uma, a caixa limpa sozinha pra já digitar o próximo termo.
var LEGISLACOES_ASSUNTOS_FILTER = {
  property: "🏷️ Assuntos (PMF)", type: "rollup", rollupTargetType: "multi_select", condition: "contains", label: "Assuntos",
  searchable: true, andOrToggle: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "🏷️ Assuntos (PMF)" }
};

// "📖 Contrato" — mesmo esquema do Assuntos acima (rollup multi_select da
// relação "Central" em Contratos), usado só na página de Contratos. O NOME
// do filtro ("property") é o apelido do rollup em Contratos ("📖 Contrato"),
// mas o campo de origem na própria Central se chama "📖 Processo/Chamado"
// (mesmo campo já usado em BETHA_CARD_FIELDS) — confirmado consultando o
// schema da Central direto; "optionsFrom" tem que apontar pro nome de lá,
// senão a lista de opções vem vazia (era o que estava quebrando o filtro).
var CONTRATOS_CONTRATO_FILTER = {
  property: "📖 Contrato", type: "rollup", rollupTargetType: "multi_select", condition: "contains", label: "Contrato",
  searchable: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "📖 Processo/Chamado" }
};

// Versões pra páginas que consultam a Central DIRETO (Betha, Reuniões,
// Tarefas, TAT — todas usam database_id da própria Central, ver
// pmf_ctrl_betha/pmf_ctrl_reunioes/pmf_ctrl_tarefas/pmf_col_tat abaixo), ao
// contrário de Legislações/Contratos (bases PRÓPRIAS, que só enxergam esses
// campos como ROLLUP da relação "Central"). Aqui, tanto "🏷️ Assuntos (PMF)"
// quanto "📖 Processo/Chamado" já são multi_select NATIVOS da própria
// Central — mesmo campo/mesma lista de opções de CONTRATOS_CONTRATO_FILTER/
// LEGISLACOES_ASSUNTOS_FILTER acima, só que sem precisar do "rollup" a mais.
var CENTRAL_ASSUNTOS_FILTER = {
  property: "🏷️ Assuntos (PMF)", type: "multi_select", condition: "contains", label: "Assuntos",
  searchable: true, andOrToggle: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "🏷️ Assuntos (PMF)" }
};
var CENTRAL_PROCESSO_FILTER = {
  property: "📖 Processo/Chamado", type: "multi_select", condition: "contains", label: "Processo/Chamado",
  searchable: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "📖 Processo/Chamado" }
};

// "📚 Página de Origem" — usado só em "Atrasados e Prioritários", pra ver
// tudo o que a Central junta (Tarefas/Reuniões/Betha/TAT/JART/COMAT/
// Aniversários/Pessoal/etc — confirmado consultando a Central direto, tem
// quase 30 valores diferentes). É campo NATIVO "select" (não multi_select),
// então cada registro só tem UM valor — por isso não tem "andOrToggle" aqui
// como em Assuntos: marcar 2+ opções sempre vira "ou" (qualquer uma bate);
// "e" nunca bateria com nada, já que nenhum registro tem 2 origens ao mesmo
// tempo.
var PRIORITARIOS_ORIGEM_FILTER = {
  property: "📚 Página de Origem", type: "select", condition: "equals", label: "Página de Origem",
  searchable: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "📚 Página de Origem" }
};

// monta uma lista de "pairs" (todas "equals") a partir de uma lista de
// valores de texto — usado só no filtro "Categoria" abaixo, que precisa
// expandir CADA opção (PMF/Pessoal) numa lista de valores reais de "📚
// Página de Origem" combinados com "ou".
function pairsFromValues(values) {
  return values.map(function (v) { return { condition: "equals", value: v }; });
}

// "Categoria" — não é campo do Notion, é um agrupamento manual dos valores
// de "📚 Página de Origem" em 2 baldes (PMF/Pessoal), levantado consultando
// a Central direto. "stateKey" (diferente de "property") é só a chave usada
// pra guardar o estado desse filtro no app — sem ela colidiria com
// PRIORITARIOS_ORIGEM_FILTER acima (os dois miram a MESMA propriedade do
// Notion). Os dois filtros se combinam com "e": ex. Categoria=PMF +
// Página de Origem=Tarefas só dá Tarefas (que já é PMF); Categoria=Pessoal
// + Página de Origem=Tarefas não bate com nada.
var PRIORITARIOS_CATEGORIA_FILTER = {
  property: "📚 Página de Origem", type: "select", label: "Categoria", stateKey: "categoria",
  options: [
    {
      label: "PMF", pageId: "PMF", icon: "ti-building", color: "#4a90d9",
      pairs: pairsFromValues([
        "PMF - Tarefas", "PMF - Diárias", "PMF - Betha - Tarefas", "PMF - Reuniões", "PMF - Convênios",
        "PMF - Legislações", "PMF - IPTU - Lançamento Anual", "PMF - TAT - Sessões", "PMF - TAT - Processos",
        "PMF - Time Sheet", "PMF - JART - Processos", "PMF - JART - Sessões", "PMF - Auditoria TCE",
        "PMF - TAT - Jeton", "PMF - Jurisprudências", "PMF - JART - Jeton", "PMF - COMAT - Consultas",
        "PMF - COMAT - Processos", "PMF - COMAT - Reuniões", "PMF - Contratos"
      ])
    },
    {
      // "Vitor - ..." (eventos/saúde/tarefas de um familiar) entram aqui
      // dentro de "Pessoal" — não tem um prefixo "Pessoal -" próprio, mas
      // conceitualmente é vida pessoal, não PMF.
      label: "Pessoal", pageId: "Pessoal", icon: "ti-user", color: "#37b24d",
      pairs: pairsFromValues([
        "Pessoal - Despesas Fixas", "Pessoal - Judicial", "Pessoal - AFIFI", "Pessoal - Aniversários",
        "Pessoal - Tarefas", "Vitor - Festas/Eventos", "Vitor - Saúde", "Vitor - Tarefas/Provas"
      ])
    }
  ]
};

// "Situação" é campo nativo (select) da própria base Contratos — cores
// exatas conferidas no schema (Em licitação=pink, Expirado=brown,
// Revogado=yellow, Vigente=green). "default" já vem marcado em "Em
// licitação" + "Vigente" quando a página abre (os 2 estados "ativos"); pode
// desmarcar/marcar à vontade na tela, é só o ponto de partida.
var CONTRATOS_SITUACAO_FILTER = {
  property: "Situação", type: "select", condition: "equals", label: "Situação",
  default: ["Em licitação", "Vigente"],
  options: [
    { label: "Em licitação", pageId: "Em licitação", icon: "ti-tag", color: "#c14c8a" },
    { label: "Expirado", pageId: "Expirado", icon: "ti-tag", color: "#8d6e5c" },
    { label: "Revogado", pageId: "Revogado", icon: "ti-tag", color: "#cb9a08" },
    { label: "Vigente", pageId: "Vigente", icon: "ti-tag", color: "#448361" }
  ]
};

// ---- filtros da busca "Pesquisar" de Início (varre a Central inteira) ----
// Todos com prefixo "BUSCA_" — são CÓPIAS (não os mesmos objetos) dos
// filtros compartilhados equivalentes (Focus/Prioridade/Origem/Processo),
// só que com "andOrToggle: true" ligado (pedido do Georges pra essa busca
// específica). Copiar em vez de ligar direto no objeto original evita
// mudar o comportamento das páginas que já usavam esses filtros antes
// (Betha/Reuniões/Tarefas/TAT), que continuam exatamente como estavam.
// Observação sobre "📚 Página de Origem" e "🧾 Origem": os dois são campos
// "select" (não multi_select) — cada página só tem UM valor. O botão E/OU
// aparece porque foi pedido pra TODOS os filtros de opção aqui, mas
// marcando "E" com esses dois nunca vai encontrar nada (nenhuma página tem
// 2 origens ao mesmo tempo) — é só uma limitação do próprio campo, não um
// bug. "OU" (padrão) funciona normalmente.
var BUSCA_FOCUS_FILTER = {
  property: "⭐ Focus", type: "formula", formulaType: "string", condition: "contains", label: "Focus",
  andOrToggle: true,
  options: FOCUS_FILTER.options
};
var BUSCA_PRIORIDADE_FILTER = {
  property: " 🚩 Prioridade", type: "relation", condition: "contains", label: "Prioridade",
  andOrToggle: true,
  options: PRIORIDADE_FILTER.options
};
// "⚠️ Importância" — relação com a base "Importância" (5 níveis, confirmado
// consultando a base direto: 1-Extrema, 2-Alta, 3-Média, 4-Baixa, 5-Sem
// importância). Não tinha filtro compartilhado ainda porque esse campo não
// era usado em nenhuma página até agora.
var BUSCA_IMPORTANCIA_FILTER = {
  property: "⚠️ Importância", type: "relation", condition: "contains", label: "Importância",
  andOrToggle: true,
  options: [
    { label: "1 - Extrema", pageId: "2470481486dd80ee803fec5406b3691a", icon: "ti-flame", color: "#e03131" },
    { label: "2 - Alta", pageId: "2470481486dd800e8090d1b900cb098d", icon: "ti-alert-triangle", color: "#e8590c" },
    { label: "3 - Média", pageId: "2470481486dd809687ade2e3d7b437d3", icon: "ti-minus", color: "#f08c00" },
    { label: "4 - Baixa", pageId: "2470481486dd80fc8102c2b0065f04f7", icon: "ti-arrow-down", color: "#4a90d9" },
    { label: "5 - Sem importância", pageId: "2470481486dd80919590c381e45c6352", icon: "ti-circle-dashed", color: "#868e96" }
  ]
};
var BUSCA_PROCESSO_FILTER = {
  property: "📖 Processo/Chamado", type: "multi_select", condition: "contains", label: "Processo/Chamado",
  searchable: true, andOrToggle: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "📖 Processo/Chamado" }
};
var BUSCA_PAGINA_ORIGEM_FILTER = {
  property: "📚 Página de Origem", type: "select", condition: "equals", label: "Página de Origem",
  searchable: true, andOrToggle: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "📚 Página de Origem" }
};
var BUSCA_ORIGEM_FILTER = {
  property: "🧾 Origem", type: "select", condition: "equals", label: "Origem",
  searchable: true, andOrToggle: true,
  options: ORIGEM_FILTER.options
};
// "🖥 Formas" — só 2 opções conhecidas (mesmas usadas em "Outros eventos"
// de Início), por isso sem "searchable" (não pedido pra esse campo).
var BUSCA_FORMAS_FILTER = {
  property: "🖥 Formas", type: "relation", condition: "contains", label: "Formas",
  andOrToggle: true,
  options: [
    { label: "Virtual (Meet)", pageId: "24104814-86dd-8086-9dd7-d3541def817b", icon: "ti-video", color: "#4a90d9" },
    { label: "Presencial", pageId: "23a04814-86dd-808a-8515-edcd72b5ac49", icon: "ti-map-pin", color: "#448361" }
  ]
};
// "🧑🏻‍💼 Contribuintes" e "🏠 Inscrições Imobiliárias" — multi_select
// NATIVOS da Central, com centenas de opções cada (366 e 484 — confirmado
// consultando o schema direto), por isso sempre via "optionsFrom" (nunca
// lista fixa) + "searchable".
var BUSCA_CONTRIBUINTES_FILTER = {
  property: "🧑🏻‍💼 Contribuintes", type: "multi_select", condition: "contains", label: "Contribuintes",
  searchable: true, andOrToggle: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "🧑🏻‍💼 Contribuintes" }
};
var BUSCA_INSCRICAO_FILTER = {
  property: "🏠 Inscrições Imobiliárias", type: "multi_select", condition: "contains", label: "Inscrição Imobiliária",
  searchable: true, andOrToggle: true,
  optionsFrom: { database_id: "2310481486dd80079202fe1eaf5e14c4", property: "🏠 Inscrições Imobiliárias" }
};
// Filtros de data (tipo NOVO — "date"/"created_time"/"last_edited_time",
// sem "options": em vez de lista de opções, o app.js desenha 2 campos de
// data (De/Até) — ver buildDateRangeFilter. Só "De" preenchido = data fixa
// (equals); só "Até" = data fixa também; os dois = intervalo (on_or_after
// De + on_or_before Até). "✨ Criado em"/"✏️ Última edição" são campos
// NATIVOS da Central do tipo created_time/last_edited_time (não são a
// data/hora "de sistema" implícita da página — são propriedades de
// verdade, filtráveis do mesmo jeito que qualquer outra).
// ---- atalhos ao lado dos títulos "📅 Reuniões"/"✅ Tarefas"/"🎂
// Aniversários" nas 3 abas de Início (Hoje/Amanhã/Próximos 7 dias) — cada
// item é { type: "notion", url, title } (abre em aba nova) ou
// { type: "page", target, title } (navega dentro do próprio app, ver
// app.js). Reuniões e Tarefas já têm página própria no app
// (pmf_ctrl_reunioes/pmf_ctrl_tarefas), por isso ganham os dois; Aniversários
// só o link do Notion — ainda não existe página própria pra ela no app.
var TITLELINKS_REUNIOES = [
  { type: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link", title: "Abrir Reuniões no Notion" },
  { type: "page", target: "pmf_ctrl_reunioes", title: "Abrir Reuniões no app" }
];
var TITLELINKS_TAREFAS = [
  { type: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a2ff0d56471a4b1baab88fea288fb307&source=copy_link", title: "Abrir Tarefas no Notion" },
  { type: "page", target: "pmf_ctrl_tarefas", title: "Abrir Tarefas no app" }
];
var TITLELINKS_ANIVERSARIOS = [
  { type: "notion", url: "https://app.notion.com/p/georges-filizzola/1f60481486dd8074b921f730febc7fd1?v=1f60481486dd807f9ac2000cb1578dc8&source=copy_link", title: "Abrir Aniversários no Notion" }
];

// "page.sidePanel" (opcional) — painel retrátil do lado direito, só na
// página Início por enquanto. Cada divisória é { title, items: [...] },
// cada item é { type:"notion", url } (abre em aba nova, ícone do cubo
// Notion) ou { type:"page", target } (navega dentro do próprio app,
// ícone "ti-apps") — botões só com ícone (sem texto "Notion"/"App" ao
// lado, pra caber mais estreito); a legenda de cada um vira só o
// tooltip (title="") do botão, montado em app.js a partir do título da
// divisória (ex: "Reuniões no Notion"). Ordem das divisórias: alfabética
// (padrão adotado quando não há um motivo pra fugir disso). Dentro de
// cada divisória: Notion primeiro, depois App — mesma ordem de
// TITLELINKS_* acima. Páginas sem uma view única no Notion (Favoritas/
// Atrasados e Prioritários/Eventos são páginas de menu/curadoria, não
// uma database só) ganham só o botão do App.
var SIDEPANEL_LINKS = [
  {
    title: "Aniversários",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/1f60481486dd8074b921f730febc7fd1?v=1f60481486dd807f9ac2000cb1578dc8&source=copy_link" }
    ]
  },
  {
    title: "Atrasados e Prioritários",
    items: [
      { type: "page", target: "pmf_ctrl_atrasados" }
    ]
  },
  {
    title: "Betha",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a2ff0d56471a4b1baab88fea288fb307&source=copy_link" },
      { type: "page", target: "pmf_ctrl_betha" }
    ]
  },
  {
    title: "Central",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/2310481486dd80079202fe1eaf5e14c4?v=23a0481486dd80888552000ce77ddd24&source=copy_link" },
      { type: "page", target: "central" }
    ]
  },
  {
    title: "Contratos",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/23ccd4efa7074deab954fc3fc6625f8c?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link" },
      { type: "page", target: "pmf_cad_contratos" }
    ]
  },
  {
    title: "Eventos",
    items: [
      { type: "page", target: "eventos" }
    ]
  },
  {
    title: "Favoritas",
    items: [
      { type: "page", target: "favoritas" }
    ]
  },
  {
    title: "Jurisprudências",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/24f0481486dd8094a099ec12b3a81bcf?v=24f0481486dd8150aea3000cb171d145&source=copy_link" },
      // "pmf_cad_jurisprudencias" ainda é uma página vazia (placeholder,
      // igual Time Sheet) — o botão do app existe mas não leva a nada
      // útil por enquanto, até essa página ser montada de verdade.
      { type: "page", target: "pmf_cad_jurisprudencias" }
    ]
  },
  {
    title: "Legislações",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link" },
      { type: "page", target: "pmf_cad_legislacoes" }
    ]
  },
  {
    title: "Reuniões",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
      { type: "page", target: "pmf_ctrl_reunioes" }
    ]
  },
  {
    title: "Tarefas",
    items: [
      { type: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a2ff0d56471a4b1baab88fea288fb307&source=copy_link" },
      { type: "page", target: "pmf_ctrl_tarefas" }
    ]
  },
  {
    title: "TAT",
    // 2 links do Notion (Processos + Sessões, mesmos usados no "Abrir no
    // Notion" da própria página TAT) + 1 do app — 3 botões numa linha só,
    // cabe de boa nos 144px do painel. "label" em cada item (opcional,
    // só usado quando tem mais de um botão do MESMO tipo no grupo) vira
    // o tooltip específico daquele botão — sem isso os dois botões do
    // Notion mostrariam o mesmo tooltip genérico "TAT no Notion", sem dar
    // pra diferenciar Processos de Sessões antes de clicar.
    items: [
      { type: "notion", label: "Processos", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
      { type: "notion", label: "Sessões", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" },
      { type: "page", target: "pmf_col_tat" }
    ]
  }
];

var BUSCA_DATA_PRAZO_FILTER = { property: "📅 Data/Prazo", type: "date", label: "Data/Prazo" };
var BUSCA_DATA_CONCLUSAO_FILTER = { property: "📅 Data de Conclusão", type: "date", label: "Data de Conclusão" };
var BUSCA_DATA_CRIACAO_FILTER = { property: "✨ Criado em", type: "created_time", label: "Data de Criação" };
var BUSCA_ULTIMA_EDICAO_FILTER = { property: "✏️ Última edição", type: "last_edited_time", label: "Última edição" };

// ---------------- Lista de Prioridades (página própria, sem Notion) ----------------
// Listas fixas de opção pras colunas "de opção" da tabela de Lista de
// Prioridades (ver pages.prioridades mais abaixo e renderPrioritiesTable no
// app.js) — Origem é a única EXCEÇÃO, sem lista fixa (ver
// PRIORIDADES_ORIGEM_OPTIONS mais abaixo). Isso NÃO é um filtro de
// propriedade do Notion (não tem "property"/"type" — são arrays simples de
// string) — é só pra montar os <select>/dropdown da tabela e dos filtros
// por coluna. Precisam bater EXATAMENTE (mesmo texto, mesma ordem) com as
// constantes PRIORITIES_* no worker.js, que são quem de fato valida/aceita
// os valores no servidor — se um valor mudar aqui, tem que mudar lá também
// (arquivos/runtimes separados).
var PRIORIDADES_TIPO_OPTIONS = ["PMF", "Pessoal"];
var PRIORIDADES_PRIORIDADE_OPTIONS = ["1 - Imediato", "2 - Urgente", "3 - Alta", "4 - Média", "5 - Baixa", "6 - Sem prioridade"];
var PRIORIDADES_TEMPO_OPTIONS = ["Menos do que 5 minutos", "5 minutos", "10 minutos", "15 minutos", "30 minutos", "45 minutos", "1 hora", "1 hora e meia", "2 horas", "Mais do que 2 horas"];
var PRIORIDADES_FORMA_OPTIONS = ["Chrome", "Claude", "E-mail", "Excel", "Explorer", "Notion", "Presencial", "Solar", "SQL", "Tributos", "WhatsApp", "Word"];
// "Estudos" adicionado (pedido do Georges) — precisa existir como valor
// válido de Programação pro botão "Legislação / Estudos" de "Filtros
// rápidos" (grupo "Grupo" — ver mais abaixo) funcionar. "Arquivos"
// adicionado depois (pedido do Georges — nova divisória "Programação" mais
// abaixo, slot "Legislação / Notion / IA / Arquivos" precisa desse valor).
var PRIORIDADES_PROGRAMACAO_OPTIONS = ["Arquivos", "Auditorias", "DOI", "Estudos", "Fiscalização", "IA", "Legislação", "Notion", "Ofícios", "Pessoal", "Planilhas", "Processos", "Sistemas", "TCE"];
var PRIORIDADES_TRIBUTO_OPTIONS = ["Amigos", "CadImob", "CadMob", "Casa", "Eletrônicos", "Família", "Financeiro", "Financeiros", "Funcional", "Geral", "IPTU", "IPTU/ITBI", "ITBI", "Notion", "OODC", "Profissional", "Saúde", "TCRS", "Vitor"];
// Origem virou multi_select também (pedido do Georges) — SEM lista "de
// fábrica" aqui de propósito: sempre foi texto livre, então começa vazia;
// quem realmente preenche na prática é o self-heal do worker.js
// (seedOrigemOptionsFromItems, dentro de handlePrioritiesGet), que
// autopreenche a partir dos valores DISTINTOS já usados nos itens
// existentes assim que a página é aberta pela 1ª vez depois do deploy —
// dali em diante o Georges cria/renomeia/exclui pelo ícone de engrenagem da
// própria coluna, igual aos outros 6 campos.
var PRIORIDADES_ORIGEM_OPTIONS = [];

// ---------------- "Programação" — slots fixos do dia (pedido do Georges) ----------------
// Divisória nova (ver pages.prioridades.scheduleSlots mais abaixo e o bloco
// "Programação" dentro de renderPrioritiesTable no app.js — função
// renderScheduleBody) — uma agenda de blocos de tempo
// FIXOS que o Georges tenta cumprir todo dia (baseado no print que ele
// mandou: 3h TCE, 1h DOI, 1h30 Ofícios/Processos, 1h Sistemas/Planilhas, 1h
// Fiscalização/Auditorias, 30min Legislação/Notion/IA/Arquivos — soma 8h,
// o expediente inteiro). A ORDEM em que os slots são iniciados no dia é
// livre (o Georges escolhe qual começar a seguir, não precisa ser essa
// ordem daqui) — só a DURAÇÃO de cada um é fixa.
//
// Cada slot: { id (identificador ESTÁVEL, nunca muda mesmo se o label for
// editado futuramente — é o que o Worker guarda em priority_schedule),
// label (texto exibido), minutes (duração do timer), values (1 ou mais
// valores da coluna Programação que esse slot representa — precisam
// existir em PRIORIDADES_PROGRAMACAO_OPTIONS acima) }. Slot com mais de 1
// "values" (ex: "Ofícios / Processos") pede pro Georges escolher QUAL dos
// 2 valores vale pro timer que tá começando, antes de iniciar (ver
// renderScheduleBody no app.js) — é assim que ele consegue ver os itens certos
// (top 5 por Prioridade) filtrados pelo valor específico escolhido, não
// os 2 misturados.
var PRIORIDADES_SCHEDULE_SLOTS = [
  { id: "tce", label: "TCE", minutes: 180, values: ["TCE"] },
  { id: "doi", label: "DOI", minutes: 60, values: ["DOI"] },
  { id: "oficios_processos", label: "Ofícios / Processos", minutes: 90, values: ["Ofícios", "Processos"] },
  { id: "sistemas_planilhas", label: "Sistemas / Planilhas", minutes: 60, values: ["Sistemas", "Planilhas"] },
  { id: "fiscalizacao_auditorias", label: "Fiscalização / Auditorias", minutes: 60, values: ["Fiscalização", "Auditorias"] },
  { id: "legislacao_notion_ia_arquivos", label: "Legislação / Notion / IA / Arquivos", minutes: 30, values: ["Legislação", "Notion", "IA", "Arquivos"] },
];

// Padrão inicial dos botões de "Filtros rápidos" (topo da Lista de
// Prioridades — ver renderPrioritiesQuickFilters no app.js), usado só
// enquanto NADA ainda foi salvo no Worker (GET /priorities-quickfilters
// devolvendo quickFilters: null) — depois da primeira vez que o Georges
// editar/salvar um botão, o que vem do Worker manda, isso aqui vira só
// referência. Cada grupo é uma lista de botões { label, values: [...] } —
// "values" tem que ser um subconjunto EXATO dos valores nas listas
// PRIORIDADES_*_OPTIONS acima (mesmo texto). Em "tempo"/"grupo", cada
// botão junta uma faixa de 2 valores brutos vizinhos (não existe um valor
// bruto "até 5 minutos" nem "TCE / DOI" — é sempre um agrupamento).
var DEFAULT_QUICKFILTERS = {
  // "Status" (pedido do Georges) — só 2 botões fixos possíveis, sempre os
  // mesmos (ver priorityFields.status acima, que limita o editor de botões
  // a exatamente essas 2 opções). Ordem Pendente antes de Concluído de
  // propósito (mesma ordem do <select> de "Filtros Gerais" — "app.js" tem
  // "status" na lista QF_GROUPS_NOT_ALPHA pra não deixar a ordenação
  // alfabética de sempre inverter isso).
  status: [
    { label: "Pendente", values: ["Pendente"] },
    { label: "Concluído", values: ["Concluído"] },
  ],
  tipo: [
    { label: "PMF", values: ["PMF"] },
    { label: "Pessoal", values: ["Pessoal"] },
  ],
  // "Grupo" (pedido do Georges) — NÃO é uma propriedade própria do item,
  // é um recorte/categorização da coluna Programação (ver PRIORIDADES_
  // PROGRAMACAO_OPTIONS acima e PRIORITIES_QUICKFILTER_GROUP_FIELDS no
  // worker.js) — cada botão aqui junta 2 valores BRUTOS de Programação
  // numa categoria maior. Pra ver um valor individual (só "TCE", por
  // exemplo), usa o filtro "Programação" ao lado ou o filtro por coluna.
  grupo: [
    { label: "TCE / DOI", values: ["TCE", "DOI"] },
    { label: "Processos / Ofícios", values: ["Processos", "Ofícios"] },
    { label: "Sistemas / Planilhas", values: ["Sistemas", "Planilhas"] },
    { label: "Fiscalização / Auditorias", values: ["Fiscalização", "Auditorias"] },
    { label: "Legislação / Estudos", values: ["Legislação", "Estudos"] },
    { label: "Notion / IA", values: ["Notion", "IA"] },
    { label: "Pessoal", values: ["Pessoal"] },
  ],
  prioridade: [
    { label: "1 - Imediato", values: ["1 - Imediato"] },
    { label: "2 - Urgente", values: ["2 - Urgente"] },
    { label: "3 - Alta", values: ["3 - Alta"] },
    { label: "4 - Média", values: ["4 - Média"] },
    { label: "5 - Baixa", values: ["5 - Baixa"] },
    { label: "6 - Sem prioridade", values: ["6 - Sem prioridade"] },
  ],
  tempo: [
    { label: "Até 5 minutos", values: ["Menos do que 5 minutos", "5 minutos"] },
    { label: "Até 15 minutos", values: ["10 minutos", "15 minutos"] },
    { label: "Até 45 minutos", values: ["30 minutos", "45 minutos"] },
    { label: "Até 1 hora e meia", values: ["1 hora", "1 hora e meia"] },
    { label: "2 horas ou mais", values: ["2 horas", "Mais do que 2 horas"] },
  ],
  forma: [
    { label: "Chrome", values: ["Chrome"] },
    { label: "WhatsApp", values: ["WhatsApp"] },
    { label: "Tributos", values: ["Tributos"] },
    { label: "Presencial", values: ["Presencial"] },
    { label: "Excel", values: ["Excel"] },
    { label: "Notion", values: ["Notion"] },
  ],
  programacao: [
    { label: "Processos", values: ["Processos"] },
    { label: "Ofícios", values: ["Ofícios"] },
    { label: "Sistemas", values: ["Sistemas"] },
    { label: "IA", values: ["IA"] },
    { label: "Notion", values: ["Notion"] },
  ],
  tributo: [
    { label: "IPTU", values: ["IPTU"] },
    { label: "CadImob", values: ["CadImob"] },
    { label: "Vitor", values: ["Vitor"] },
  ],
  // "Origem" (pedido do Georges — "criar a opção de pesquisar com as
  // opções de Origem, já que se tornou lista de opções") — começa VAZIO de
  // propósito: diferente dos outros campos, Origem nunca teve uma lista
  // fixa "de fábrica" (PRIORIDADES_ORIGEM_OPTIONS = [], self-heal do
  // worker.js autopreenche com os valores que já existiam nos itens — ver
  // seedOrigemOptionsFromItems). Sem saber esses valores de antemão aqui,
  // fica pro Georges criar os botões que quiser em "Editar filtros" (já vai
  // achar as opções certas no editor, elas já existem a essa altura).
  origem: [],
};

const APP_CONFIG = {
  appTitle: "Meu hub",
  // Carimbo de "quando esse config.js foi editado por último" (data + hora,
  // fuso de SP), atualizado à mão a cada entrega — aparece pequeno do lado
  // de "Meu hub" no topo do menu, só pra dar pra conferir rapidinho se o
  // GitHub Pages já está servindo a versão mais recente depois de um push
  // (às vezes o cache do navegador/GitHub demora um pouco pra atualizar).
  appVersion: "2026-08-31 00:44",
  // "startPage" continua sendo a RAIZ da árvore do menu lateral — a página
  // com KEY "entrada" (título "Início" desde a rodada da página inicial
  // configurável — era "Entrada" antes) tem que seguir sendo a raiz: é
  // dela que "Criar páginas"/"Eventos"/"Central"/"Categorias"/"Biblioteca"
  // são alcançados; se startPage virasse "inicio" aqui, essas páginas
  // ficariam inacessíveis pelo menu, porque buildIndex()/buildTreeNode()
  // só percorrem a árvore a partir de "startPage". "homePage" é o valor
  // PADRÃO (usado quando ninguém nunca clicou em "Definir como página
  // inicial" — ver #setHomeBtn no app.js/GET /home-page no worker.js, que
  // sobrescreve isso em tempo real via KV, sem precisar editar aqui) — só
  // decide qual tela abre primeiro (e quando o botão "voltar"/Esc
  // consideram "já estou na home") sem mexer na raiz da árvore. Aponta pra
  // key "inicio" (título "Painel do Dia" hoje, era "Início").
  startPage: "entrada",
  homePage: "inicio",
  templateWorkerUrl: "https://flat-lake-5b3b.gefilizzola.workers.dev",

  // Lista mestre dos status de "🧲 Andamento" (id da página no Notion +
  // rótulo + cor) — usada pra colorir o selo de status que aparece no
  // subtítulo de cada card de resultado (via "cardFields" com
  // lookup:"andamento"). Os dropdowns de filtro (Hoje, Reuniões) têm sua
  // própria lista de opções — se um status mudar de nome/cor no Notion,
  // atualize aqui e nos dropdowns também.
  andamentoOptions: [
    { pageId: "9ff8db6d456d43f39e70e14786c1fe6d", label: "0 - Iniciar agora", color: "#4a90d9" },
    { pageId: "2030481486dd80d386a1cf7522b3deb1", label: "1 - Em andamento", color: "#4a90d9" },
    { pageId: "d18f7c0ac312422cbc14a3ae1bc82399", label: "2 - Iniciar assim que possível", color: "#4a90d9" },
    { pageId: "08cb3ec723ef41b19e6c6472ee9d9a75", label: "3 - Aguardando terceiros", color: "#4a90d9" },
    { pageId: "959d289339c440a492612c70ea8ed1c9", label: "4 - Iniciar quando possível", color: "#4a90d9" },
    { pageId: "4ef9e6737cea4c53ae37efe966013214", label: "5 - Agendado", color: "#4a90d9" },
    { pageId: "d228224dee1d43dabb72744097f10028", label: "6 - Concluído", color: "#2f9e44" },
    { pageId: "2410481486dd80a3a8b0d819542a55c5", label: "9 - Cancelado", color: "#e03131" }
  ],

  // Lista mestre dos 6 níveis de "🚩 Prioridade" — mesmo papel de
  // "andamentoOptions" acima, mas pro selo de prioridade nos cards.
  prioridadeOptions: [
    { pageId: "2460481486dd80b19d7edb3a9eccba08", label: "1 - Imediato", color: "#e03131" },
    { pageId: "2330481486dd801981efc913350a8034", label: "2 - Urgente", color: "#e8590c" },
    { pageId: "2330481486dd807e9f21c4ed2c3c8e88", label: "3 - Alta", color: "#f08c00" },
    { pageId: "2330481486dd80ef94f9dae36b42b39f", label: "4 - Média", color: "#4a90d9" },
    { pageId: "2330481486dd80029cb6e049f84b8198", label: "5 - Baixa", color: "#868e96" },
    { pageId: "2330481486dd80d2bc15f5017684326f", label: "6 - Sem prioridade", color: "#c4c4c0" }
  ],

  // Rótulos/cores dos 3 valores possíveis de "⭐ Focus" (fórmula da
  // Central) — mesmo papel de "andamentoOptions"/"prioridadeOptions"
  // acima, mas pro selo de Focus nos cards (ex: "Itens Prioritários" em
  // Início). Como Focus é "formula" (não "relation"), o valor bruto que
  // vem do Notion já é o texto do rótulo (não um pageId) — por isso aqui
  // a "chave" de busca é "label", não "pageId" (ver buildCardSub no
  // app.js). Mesmos 3 rótulos/cores de FOCUS_FILTER, só que num formato
  // mais direto pra exibição no card.
  focusOptions: [
    { label: "⭐ 1 - Focus", color: "#f08c00" },
    { label: "⚠️ 2 - Atenção", color: "#e8590c" },
    { label: "📅 3 - Verificar prazo", color: "#4a90d9" }
  ],

  pages: {
    // era "Entrada" — pedido do Georges: essa é a página que agora se
    // chama "Início" (o antigo "Início", com o resumo do dia, virou
    // "Painel do Dia", ver mais abaixo). A KEY interna continua "entrada"
    // de propósito (só o "title" mudou) — trocar a key exigiria atualizar
    // TODO "target: 'entrada'" espalhado pelo config.js/app.js (startPage,
    // etc.) à toa, risco sem benefício nenhum já que ninguém vê a key, só o
    // title. "items" continua com a lista COMPLETA de sempre (inclusive
    // Criar páginas/Eventos/Central/Categorias/Biblioteca) — é dela que a
    // árvore do menu lateral e a busca alcançam essas páginas (ver
    // buildIndex/buildTreeNode, que percorrem a partir de "startPage"); só
    // o CONTEÚDO da página ganhou "quickButtons" (grade de botões grandes,
    // ver renderContent em app.js) com um recorte de 4 links "principais",
    // pedido explicitamente do Georges — os outros continuam acessíveis
    // pelo menu/busca, só não aparecem nos botões grandes.
    entrada: {
      title: "Início",
      quickButtons: [
        { label: "Painel do Dia", target: "inicio", icon: "home", color: "#4a90d9" },
        { label: "Lista de Prioridades", target: "prioridades", icon: "list-check", color: "#8a63d2" },
        { label: "Anotações Rápidas", target: "anotacoes", icon: "notes", color: "#2f9e44" },
        { label: "Favoritas", target: "favoritas", icon: "star", color: "#f08c00" }
      ],
      items: [
        { label: "Painel do Dia", type: "page", target: "inicio", icon: "home" },
        { label: "Anotações Rápidas", type: "page", target: "anotacoes", icon: "notes" },
        { label: "Lista de Prioridades", type: "page", target: "prioridades", icon: "list-check" },
        { label: "Criar páginas", type: "page", target: "criar_paginas", icon: "file-plus" },
        { label: "Eventos", type: "page", target: "eventos", icon: "calendar" },
        { label: "Favoritas", type: "page", target: "favoritas", icon: "star" },
        { label: "Central", type: "page", target: "central", icon: "layout-grid" },
        { label: "Categorias", type: "page", target: "categorias", icon: "category" },
        { label: "Biblioteca", type: "page", target: "biblioteca", icon: "books" }
      ]
    },

    // "Resumo dos resumos" — cada seção junta HOJE + AMANHÃ num só lugar
    // (Data/Prazo = hoje OU amanhã), com a data aparecendo no card pra
    // diferenciar qual é qual. NÃO muda "startPage" (o app continua abrindo
    // em "Entrada" como sempre) — só um item novo no topo do menu. Ainda
    // não tem o bloco de anotações rápidas (isso depende de decidir onde
    // guardar as notas — perguntei ao Georges antes de mexer nisso).
    // Fundiu "Hoje" e "Amanhã" numa página só — 3 abas (page.tabs) trocam
    // TODO o conjunto de exibições de uma vez (Reuniões/Sessões/Tarefas/
    // Aniversários/Outros eventos), cada uma com o recorte de data certo.
    // "Itens Prioritários" e o bloco de anotações ficam FORA das abas (não
    // mudam com o dia — Focus já embute prazo+prioridade+importância na
    // própria fórmula do Notion). Botão "Favoritas" no topo leva pra
    // Favoritas sem sair do app (navegação interna, mesmo destino do link
    // https://gefilizzola-png.github.io/meu-hub-notion/#favoritas que o
    // Georges pediu). "weather: true" = previsão de hoje.
    // era "Início" — pedido do Georges: essa página (resumo do dia: tempo,
    // Hoje/Amanhã, Itens Prioritários, Anotações Rápidas) passou a se
    // chamar "Painel do Dia", já que o nome "Início" foi pra "entrada"
    // acima. KEY interna continua "inicio" de propósito (mesma lógica do
    // comentário de "entrada" acima — só o "title" mudou, ninguém vê a
    // key). "homePage" no topo do config.js continua apontando pra essa
    // key ("inicio") — o Georges pode trocar isso a qualquer momento pelo
    // botão "Definir como página inicial" (ver handleHomePage* no
    // worker.js / setHomeBtn no app.js), sem precisar editar aqui.
    inicio: {
      title: "Painel do Dia",
      itemsCompact: true,
      // painel retrátil do lado direito — ver comentário de SIDEPANEL_LINKS
      // acima. Só existe nessa página por enquanto.
      sidePanel: SIDEPANEL_LINKS,
      // botões "Recolher tudo"/"Expandir tudo" no topo — mexem em toda
      // exibição com "collapsible: true" (as 5 de cada aba + Itens
      // Prioritários), pra chegar mais rápido em Pesquisar/Anotações
      // rápidas sem rolar por tudo. Ver collapseAllQueryBlocks no app.js.
      collapseAllControls: true,
      // A caixinha "Abrir no Notion" (Central + Favoritas) que existia aqui
      // foi removida — ficou redundante depois do painel retrátil do lado
      // direito (sidePanel acima), que já tem as duas como divisórias
      // próprias (com botão de Notion E de app, no caso de Central).
      // Cada aba agora carrega também "dateRange" (pra mostrar a data ao
      // lado do rótulo do botão, ex: "Hoje (18/08)") e "weatherDay" (pro
      // widget de previsão do tempo, que mudou de lugar: antes ficava fixo
      // no topo da página inteira, agora mora DENTRO de cada aba — logo
      // abaixo da barra Hoje/Amanhã/Próximos 7 dias — e atualiza sozinho
      // trocando de aba (ver renderTabs no app.js). "dateRange: [0]" = só
      // hoje; "[0,6]" = intervalo de 7 dias (hoje + 6) formatado como
      // "18-24/08" (mesmo mês) ou "27/08-02/09" (virando o mês) por
      // tabDateLabel() no app.js.
      tabs: [
        {
          label: "Hoje",
          dateRange: [0],
          weatherDay: 0,
          dynamicQueries: [
            {
              title: "📅 Reuniões",
              collapsible: true,
              titleLinks: TITLELINKS_REUNIOES,
              bg: "#eaf2fb",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "today" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" }
              ]
            },
            {
              title: "⚖️ Sessões (TAT / JART / COMAT)",
              collapsible: true,
              bg: "#fdf6e3",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "📚 Página de Origem", type: "select",
                  orPairs: [
                    { condition: "equals", value: "PMF - TAT - Sessões" },
                    { condition: "equals", value: "PMF - JART - Sessões" },
                    { condition: "equals", value: "PMF - COMAT - Reuniões" }
                  ]
                },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "today" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            },
            {
              title: "✅ Tarefas",
              collapsible: true,
              titleLinks: TITLELINKS_TAREFAS,
              bg: "#eaf7ed",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "📚 Página de Origem", type: "select",
                  orPairs: [
                    { condition: "equals", value: "PMF - Tarefas" },
                    { condition: "equals", value: "PMF - Betha - Tarefas" },
                    { condition: "equals", value: "Pessoal - Tarefas" }
                  ]
                },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "today" }
              ],
              sorts: [{ property: "Nome", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, FOCUS_FILTER, LIMIT_FILTER],
              cardFields: [
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            },
            {
              title: "🎂 Aniversários",
              collapsible: true,
              titleLinks: TITLELINKS_ANIVERSARIOS,
              bg: "#fdf2f8",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                { property: "📚 Página de Origem", type: "select", condition: "equals", value: "Pessoal - Aniversários" },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "today" }
              ],
              sorts: [{ property: "Nome", direction: "ascending" }],
              // Sem INICIO_ANDAMENTO_FILTER de propósito — os itens de
              // Aniversários ficam sempre em "6 - Concluído" (não fazem
              // sentido com outro status), então filtrar por Andamento aqui
              // só escondia tudo por padrão. Mostra sempre, independente do
              // Andamento (pedido do Georges).
              cardFields: [
                // "Grupo" não existe na Central — mora na própria página de
                // Aniversários, e chega até aqui pela relação "🎉
                // Aniversários" (crossRelation, ver worker.js/app.js).
                {
                  property: "Grupo", type: "select",
                  crossRelation: { relationProperty: "🎉 Aniversários", targetProperty: "Grupo" }
                }
              ]
            },
            {
              title: "🗓️ Outros eventos",
              collapsible: true,
              bg: "#f3eefc",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "🖥 Formas", type: "relation",
                  orPairs: [
                    { condition: "contains", value: "24104814-86dd-8086-9dd7-d3541def817b" },
                    { condition: "contains", value: "23a04814-86dd-808a-8515-edcd72b5ac49" }
                  ]
                },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - Reuniões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - TAT - Sessões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - JART - Sessões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - COMAT - Reuniões" },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "today" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            }
          ]
        },
        {
          label: "Amanhã",
          dateRange: [1],
          weatherDay: 1,
          dynamicQueries: [
            {
              title: "📅 Reuniões",
              collapsible: true,
              titleLinks: TITLELINKS_REUNIOES,
              bg: "#eaf2fb",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "tomorrow" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" }
              ]
            },
            {
              title: "⚖️ Sessões (TAT / JART / COMAT)",
              collapsible: true,
              bg: "#fdf6e3",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "📚 Página de Origem", type: "select",
                  orPairs: [
                    { condition: "equals", value: "PMF - TAT - Sessões" },
                    { condition: "equals", value: "PMF - JART - Sessões" },
                    { condition: "equals", value: "PMF - COMAT - Reuniões" }
                  ]
                },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "tomorrow" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            },
            {
              title: "✅ Tarefas",
              collapsible: true,
              titleLinks: TITLELINKS_TAREFAS,
              bg: "#eaf7ed",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "📚 Página de Origem", type: "select",
                  orPairs: [
                    { condition: "equals", value: "PMF - Tarefas" },
                    { condition: "equals", value: "PMF - Betha - Tarefas" },
                    { condition: "equals", value: "Pessoal - Tarefas" }
                  ]
                },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "tomorrow" }
              ],
              sorts: [{ property: "Nome", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, FOCUS_FILTER, LIMIT_FILTER],
              cardFields: [
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            },
            {
              title: "🎂 Aniversários",
              collapsible: true,
              titleLinks: TITLELINKS_ANIVERSARIOS,
              bg: "#fdf2f8",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                { property: "📚 Página de Origem", type: "select", condition: "equals", value: "Pessoal - Aniversários" },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "tomorrow" }
              ],
              sorts: [{ property: "Nome", direction: "ascending" }],
              // Sem INICIO_ANDAMENTO_FILTER de propósito — ver comentário na
              // aba "Hoje" acima.
              cardFields: [
                // "Grupo" via crossRelation — ver comentário na aba "Hoje".
                {
                  property: "Grupo", type: "select",
                  crossRelation: { relationProperty: "🎉 Aniversários", targetProperty: "Grupo" }
                }
              ]
            },
            {
              title: "🗓️ Outros eventos",
              collapsible: true,
              bg: "#f3eefc",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "🖥 Formas", type: "relation",
                  orPairs: [
                    { condition: "contains", value: "24104814-86dd-8086-9dd7-d3541def817b" },
                    { condition: "contains", value: "23a04814-86dd-808a-8515-edcd72b5ac49" }
                  ]
                },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - Reuniões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - TAT - Sessões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - JART - Sessões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - COMAT - Reuniões" },
                { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "tomorrow" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            }
          ]
        },
        {
          label: "Próximos 7 dias",
          dateRange: [0, 6],
          weatherDay: 0,
          dynamicQueries: [
            {
              title: "📅 Reuniões",
              collapsible: true,
              titleLinks: TITLELINKS_REUNIOES,
              bg: "#eaf2fb",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" },
                { property: "📅 Data/Prazo", type: "date", condition: "on_or_after", value: "today" },
                { property: "📅 Data/Prazo", type: "date", condition: "before", value: "next_7_days" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" }
              ]
            },
            {
              title: "⚖️ Sessões (TAT / JART / COMAT)",
              collapsible: true,
              bg: "#fdf6e3",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "📚 Página de Origem", type: "select",
                  orPairs: [
                    { condition: "equals", value: "PMF - TAT - Sessões" },
                    { condition: "equals", value: "PMF - JART - Sessões" },
                    { condition: "equals", value: "PMF - COMAT - Reuniões" }
                  ]
                },
                { property: "📅 Data/Prazo", type: "date", condition: "on_or_after", value: "today" },
                { property: "📅 Data/Prazo", type: "date", condition: "before", value: "next_7_days" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            },
            {
              title: "✅ Tarefas",
              collapsible: true,
              titleLinks: TITLELINKS_TAREFAS,
              bg: "#eaf7ed",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "📚 Página de Origem", type: "select",
                  orPairs: [
                    { condition: "equals", value: "PMF - Tarefas" },
                    { condition: "equals", value: "PMF - Betha - Tarefas" },
                    { condition: "equals", value: "Pessoal - Tarefas" }
                  ]
                },
                { property: "📅 Data/Prazo", type: "date", condition: "on_or_after", value: "today" },
                { property: "📅 Data/Prazo", type: "date", condition: "before", value: "next_7_days" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, FOCUS_FILTER, LIMIT_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            },
            {
              title: "🎂 Aniversários",
              collapsible: true,
              titleLinks: TITLELINKS_ANIVERSARIOS,
              bg: "#fdf2f8",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                { property: "📚 Página de Origem", type: "select", condition: "equals", value: "Pessoal - Aniversários" },
                { property: "📅 Data/Prazo", type: "date", condition: "on_or_after", value: "today" },
                { property: "📅 Data/Prazo", type: "date", condition: "before", value: "next_7_days" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              // Sem INICIO_ANDAMENTO_FILTER de propósito — ver comentário na
              // aba "Hoje" acima.
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                // "Grupo" via crossRelation — ver comentário na aba "Hoje".
                {
                  property: "Grupo", type: "select",
                  crossRelation: { relationProperty: "🎉 Aniversários", targetProperty: "Grupo" }
                }
              ]
            },
            {
              title: "🗓️ Outros eventos",
              collapsible: true,
              bg: "#f3eefc",
              database_id: "2310481486dd80079202fe1eaf5e14c4",
              baseFilters: [
                {
                  property: "🖥 Formas", type: "relation",
                  orPairs: [
                    { condition: "contains", value: "24104814-86dd-8086-9dd7-d3541def817b" },
                    { condition: "contains", value: "23a04814-86dd-808a-8515-edcd72b5ac49" }
                  ]
                },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - Reuniões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - TAT - Sessões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - JART - Sessões" },
                { property: "📚 Página de Origem", type: "select", condition: "does_not_equal", value: "PMF - COMAT - Reuniões" },
                { property: "📅 Data/Prazo", type: "date", condition: "on_or_after", value: "today" },
                { property: "📅 Data/Prazo", type: "date", condition: "before", value: "next_7_days" }
              ],
              sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
              filters: [INICIO_ANDAMENTO_FILTER],
              cardFields: [
                { property: "📅 Data/Prazo", type: "date" },
                { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
                { property: "📚 Página de Origem", type: "select" }
              ]
            }
          ]
        }
      ],
      // Fora das abas de propósito — Focus já embute prazo+prioridade+
      // importância na própria fórmula do Notion, então não depende de
      // "hoje"/"amanhã"/"7 dias" pra fazer sentido (ver INICIO_FOCUS_FILTER).
      dynamicQueries: [
        {
          title: "⭐ Itens Prioritários",
          collapsible: true,
          bg: "#fdecea",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          // Andamento != Concluído/Cancelado ERA fixo aqui (baseFilters);
          // virou o filtro visível INICIO_ANDAMENTO_FILTER abaixo (default
          // só esconde Concluído, ajustável pela pessoa) — sem baseFilters
          // de Andamento sobrando, senão o filtro visível não conseguiria
          // "reexibir" nada (baseFilters sempre vale, filters é opcional).
          baseFilters: [],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          // Prioridade entrou como filtro COMPLEMENTAR ao Focus (pedido do
          // Georges) — útil quando vários itens caem no mesmo Focus (1 ou
          // 2) e ele quer restringir só aos de prioridade mais alta. Sem
          // "default": não vem nada pré-marcado, filtra em cima do que o
          // Focus já trouxe.
          filters: [INICIO_ANDAMENTO_FILTER, INICIO_FOCUS_FILTER, PRIORIDADE_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
            { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" },
            { property: "📚 Página de Origem", type: "select" },
            { property: "⭐ Focus", type: "formula" }
          ]
        }
      ],
      // Busca geral na Central inteira (sem baseFilters — nenhum recorte
      // fixo, varre tudo) — sempre vazia até o usuário digitar um nome OU
      // ativar qualquer filtro (ver renderSearchBlockReady: "hasInput" =
      // texto OU algum filtro marcado). Pedido do Georges: ficar entre
      // "Itens Prioritários" e "Anotações rápidas" — já cai exatamente
      // nessa posição sem precisar mexer no app.js, porque renderContent já
      // desenha "search" depois de "dynamicQueries" e antes de "notes".
      search: {
        title: "Pesquisar",
        placeholder: "Buscar na Central por nome...",
        database_id: "2310481486dd80079202fe1eaf5e14c4",
        nameField: { property: "Nome", type: "title", condition: "contains" },
        filters: [
          BUSCA_DATA_PRAZO_FILTER,
          BUSCA_DATA_CONCLUSAO_FILTER,
          BUSCA_FOCUS_FILTER,
          BUSCA_PRIORIDADE_FILTER,
          BUSCA_IMPORTANCIA_FILTER,
          CENTRAL_ASSUNTOS_FILTER,
          BUSCA_PROCESSO_FILTER,
          BUSCA_PAGINA_ORIGEM_FILTER,
          BUSCA_ORIGEM_FILTER,
          BUSCA_FORMAS_FILTER,
          BUSCA_CONTRIBUINTES_FILTER,
          BUSCA_INSCRICAO_FILTER,
          BUSCA_DATA_CRIACAO_FILTER,
          BUSCA_ULTIMA_EDICAO_FILTER
        ]
      },
      // Bloco de anotações rápidas/lista de tarefas (texto livre + tags),
      // guardado à parte no Cloudflare KV via Worker — nunca no Notion. Ver
      // renderNotesBlock no app.js e as rotas /notes no worker.js.
      notes: true
    },

    // Página própria pra Anotações Rápidas (pedido do Georges): mesmo bloco
    // de sempre ("page.notes: true", genérico — não é preso a Início),
    // então é a MESMA lista/dados de lá, só com mais espaço pra visualizar e
    // usar os filtros (Início continua com o bloco dela também, sem
    // mudança nenhuma; as duas telas ficam sempre em sincronia porque leem
    // do mesmo KV no Worker). Sem "items"/"dynamicQueries"/"search" —
    // renderContent já sabe mostrar uma página só com "notes" (mesmo
    // tratamento de página vazia-exceto-notas que Início já passava antes
    // de ganhar Hoje/Amanhã).
    anotacoes: {
      title: "Anotações Rápidas",
      notes: true
    },

    // "Lista de Prioridades" (pedido do Georges): tabela própria do app,
    // NADA a ver com o Notion — guardada à parte no Cloudflare KV via
    // Worker (rotas /priorities, mesmo namespace de /notes, prefixo
    // diferente). "priorities: true" é o flag genérico que renderContent
    // usa pra chamar renderPrioritiesTable no app.js (mesmo padrão de
    // "notes: true" acima). As 6 listas de opção (Tipo/Prioridade/Tempo/
    // Forma/Programação/Tributo) usadas nos <select> da tabela vêm das
    // constantes PRIORIDADES_*_OPTIONS lá em cima — têm que bater com as
    // PRIORITIES_* do worker.js.
    prioridades: {
      title: "Lista de Prioridades",
      priorities: true,
      // "Programação" (pedido do Georges): agenda fixa dos slots do dia
      // (ver PRIORIDADES_SCHEDULE_SLOTS acima e renderScheduleBody no
      // app.js) — igual o resto daqui, pendurado no objeto da página pra
      // manter o app.js genérico.
      scheduleSlots: PRIORIDADES_SCHEDULE_SLOTS,
      // listas de opção de cada coluna "de opção" — passadas explicitamente
      // aqui (em vez de renderPrioritiesTable ler as constantes globais
      // direto) pra seguir o mesmo padrão do resto do config.js: tudo que
      // uma página precisa pra se desenhar vem PENDURADO no objeto da
      // página, o app.js só lê "page.*" de forma genérica.
      priorityFields: {
        tipo: { label: "Tipo", options: PRIORIDADES_TIPO_OPTIONS },
        prioridade: { label: "Prioridade", options: PRIORIDADES_PRIORIDADE_OPTIONS },
        tempo: { label: "Tempo", options: PRIORIDADES_TEMPO_OPTIONS },
        // "multi: true" — colunas de seleção múltipla (pedido do Georges);
        // vem/vai como array (ver PRIORITIES_MULTI_FIELDS/sanitizeOptionList
        // no worker.js). As outras 4 continuam de seleção única.
        forma: { label: "Forma", options: PRIORIDADES_FORMA_OPTIONS, multi: true },
        programacao: { label: "Programação", options: PRIORIDADES_PROGRAMACAO_OPTIONS },
        tributo: { label: "Tributo", options: PRIORIDADES_TRIBUTO_OPTIONS, multi: true },
        // Origem virou multi_select (pedido do Georges — "transformar Origem
        // em lista múltipla, com a mesma possibilidade de eu editar as
        // opções"): antes era texto livre (textKeys, no app.js); options
        // começa vazia aqui (ver PRIORIDADES_ORIGEM_OPTIONS acima) — o
        // self-heal do worker.js autopreenche na 1ª listagem, e a partir daí
        // a fonte de verdade é o KV priority_options, igual aos outros.
        origem: { label: "Origem", options: PRIORIDADES_ORIGEM_OPTIONS, multi: true },
        // "status" (pedido do Georges: "incluir a opção de filtrar pelo
        // status, pendente ou concluído" em Filtros Rápidos) — campo
        // VIRTUAL, só existe aqui pra alimentar o editor de botões do
        // Filtro Rápido "Status" (buildQfEditor no app.js lê
        // fieldDefs[key].options pra montar os checkboxes); NÃO é uma
        // coluna de verdade do item (o item tem "done" booleano, não um
        // campo "status" string) — por isso não entra em fieldKeys (não
        // vira coluna da tabela nem ganha engrenagem de "editar opções").
        // A tradução done<->"Pendente"/"Concluído" mora só no app.js
        // (applyFilters, casamento do Filtro Rápido) e no worker.js
        // (validação do PUT /priorities-quickfilters).
        status: { label: "Status", options: ["Pendente", "Concluído"] }
      },
      // "Filtros rápidos" (pedido do Georges): seção de botões no topo da
      // página, um bloco por grupo — ver renderPrioritiesQuickFilters no
      // app.js. Cada "key" abaixo é IGUAL ao nome do campo em priorityFields
      // acima (tipo/prioridade/tempo/forma/programacao/tributo) que aquele
      // grupo de botões filtra — EXCETO "grupo" ("Grupo"), que não é uma
      // coluna própria: é um recorte de Programação, por isso tem "field:
      // 'programacao'" explícito (os outros usam a própria "key" como
      // campo, não precisam do "field"). "defaults" é o ponto de partida
      // (ver DEFAULT_QUICKFILTERS lá em cima); o que o Georges editar/
      // salvar depois fica no Worker (rota /priorities-quickfilters) e
      // passa a mandar, isso aqui só é usado enquanto nada ainda foi salvo.
      quickFilters: {
        groups: [
          // "Status" (pedido do Georges) vem PRIMEIRO — é o recorte mais
          // básico (pendente/concluído), faz sentido ser o 1º a decidir.
          { key: "status", label: "Status" },
          { key: "tipo", label: "Tipo" },
          { key: "grupo", label: "Grupo", field: "programacao" },
          { key: "prioridade", label: "Prioridade" },
          { key: "tempo", label: "Tempo" },
          { key: "forma", label: "Forma" },
          { key: "programacao", label: "Programação" },
          { key: "tributo", label: "Tributo" },
          // "Origem" (pedido do Georges — "já que se tornou lista de
          // opções") — igual Tributo/Programação, sem "field" (a própria
          // chave "origem" já é o campo real do item).
          { key: "origem", label: "Origem" }
        ],
        defaults: DEFAULT_QUICKFILTERS
      }
    },

    criar_paginas: {
      title: "Criar páginas",
      items: [
        { label: "PMF", type: "page", target: "criar_pmf" }
      ],
      // "Acesso Rápido" — atalhos pra páginas de template que você cria com
      // frequência, pra não precisar navegar até a pasta original. Aparece
      // como uma caixa separada por uma linha, abaixo do item "PMF" acima.
      groups: [
        {
          title: "Acesso Rápido",
          items: [
            { label: "Ofícios — TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "6b7c5969-1344-492c-b501-3236fe0733f4" },
            { label: "PMF - Reuniões - 2026-XX-XX - XXX", type: "notion-template", database_id: "af1ec75c4a2b4b02a2f6880e78bc8e61", template_id: "7dc2c479-55f9-47a1-bdd4-b565638e5823" },
            { label: "Processos — TRIBUTO - PROCESSO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "21111593-0a0c-4e6a-a744-e560879db3e0" },
            { label: "Sistemas - Betha Tributos - Chamados - XXXX", type: "notion-template", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "09f31cab-7036-42c2-a826-ff51dc854dfb" },
            { label: "TAT - Sessões - 1ª Câmara (Titulares)", type: "notion-template", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "9e4c63cf-97cf-4991-9934-9881f8da114a" }
          ]
        }
      ]
    },

    // "Controles" saiu daqui — cada base (Betha/Reuniões/Tarefas) já tem sua
    // própria página funcional com botões de criar (pmf_ctrl_betha/
    // pmf_ctrl_reunioes/pmf_ctrl_tarefas), então essa lista redundante de
    // templates foi removida. Ideia é ir esvaziando "Criar páginas" assim,
    // um Controle/Colegiado de cada vez, até poder tirar a página inteira.
    criar_pmf: {
      title: "PMF",
      items: [
        { label: "Colegiados", type: "page", target: "criar_pmf_colegiados" }
      ]
    },

    criar_pmf_colegiados: {
      title: "Colegiados",
      groups: [
        {
          title: "ABRASF",
          items: [
            { label: "PMF - ABRASF - Xª AGO - 2024-XX - XXX (XX)", type: "notion-template", database_id: "3455e80ac9de4d7084613a651a5e72d2", template_id: "71242694-6d75-4a5b-9688-051b6103fbad" }
          ]
        },
        {
          title: "COMAT",
          items: [
            { label: "COMAT - Reuniões - DATA", type: "notion-template", database_id: "0672e4ca4c554b5ab1f2ce0ae48e9954", template_id: "bc90ae45-6388-4b84-9c4e-43bd9c6e4880" },
            { label: "COMAT - Soluções - NÚM/ANO - ASSUNTO", type: "notion-template", database_id: "a27c5f5c7daa4758b7b5d80de6450fda", template_id: "f3cbcedf-9b31-4cd4-9635-b9a89a095e21" },
            { label: "PMF - COMAT - Processos - PROCESSO - CONTRIBUINTE", type: "notion-template", database_id: "5fda7ad2aa2148b3b2de62cc0389f8be", template_id: "7254ab2e-c682-443e-9f01-8a4c2c555f56" }
          ]
        },
        {
          title: "JART",
          items: [
            { label: "JART - Sessões - DATA", type: "notion-template", database_id: "90ef43ee26604ebd8114610c29b60949", template_id: "610f5d9f-b8f0-4728-9e35-d9df455d6979" },
            { label: "PMF - JART - Processos - PROCESSO - CONTRIBUINTE", type: "notion-template", database_id: "9f1e9961c3e047d1910ea70fdd2291e4", template_id: "da508100-9e44-437f-8393-b1cd46b538a1" }
          ]
        },
        {
          title: "TAT",
          items: [
            { label: "PMF - TAT - Processos - PROCESSO - CONTRIBUINTE", type: "notion-template", database_id: "88435f4ebb9849ac88664da53f13ceb6", template_id: "020ef2bf-1558-484d-b0e1-0f870dd7719a" },
            { label: "TAT - Sessões - 1ª Câmara (Suplentes)", type: "notion-template", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "f87873e8-f9f5-4289-9418-e734f8564352" },
            { label: "TAT - Sessões - 1ª Câmara (Titulares)", type: "notion-template", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "9e4c63cf-97cf-4991-9934-9881f8da114a" },
            { label: "TAT - Sessões - 2ª Câmara (Suplentes)", type: "notion-template", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "767cb091-3816-4761-a659-8895fb5f98c7" },
            { label: "TAT - Sessões - 2ª Câmara (Titulares)", type: "notion-template", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "6b9558e7-fea6-4652-b20b-5a1d94d79cba" },
            { label: "TAT - Sessões - Pleno", type: "notion-template", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "f36660bf-2d5c-43e8-ac9b-673206d53634" }
          ]
        }
      ]
    },

    biblioteca: {
      title: "Biblioteca",
      items: [
        { label: "Recentes", type: "notion", url: "https://app.notion.com/library/recents?space=georges-filizzola", icon: "clock" }
      ]
    },

    // Páginas de destino dos botões acima.
    // Ainda estão vazias — vá adicionando os itens (links do Notion ou novas
    // páginas) dentro de "items" conforme for definindo cada uma.

    eventos: {
      title: "Eventos",
      items: [
        { label: "Calendário", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Calend-rio-3b60481486dd80299a01f7e5c3d2a321?source=copy_link", icon: "calendar" },
        { label: "Listas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Listas-3b60481486dd801ea254cedab932b18e?source=copy_link", icon: "list" },
        { label: "Blocos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Blocos-3b60481486dd80dba8aacb93d340f685?source=copy_link", icon: "layout-grid" }
      ]
    },

    calendario: {
      title: "Calendário",
      items: [
        { label: "Calendário", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Calend-rio-3b60481486dd80299a01f7e5c3d2a321?source=copy_link", icon: "calendar" }
      ]
    },

    listas: {
      title: "Listas",
      items: [
        { label: "Listas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Listas-3b60481486dd801ea254cedab932b18e?source=copy_link", icon: "list" }
      ]
    },

    blocos: {
      title: "Blocos",
      items: [
        { label: "Blocos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Blocos-3b60481486dd80dba8aacb93d340f685?source=copy_link", icon: "layout-grid" }
      ]
    },

    central: {
      title: "Central",
      items: [
        { label: "Visualizações", type: "page", target: "visualizacoes", icon: "list-details" },
        { label: "Pesquisar", type: "page", target: "pesquisar", icon: "search" }
      ]
    },

    visualizacoes: {
      title: "Visualizações",
      items: [
        { label: "Completa", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Completa-3b60481486dd80998301f8a013f42c8b?source=copy_link", icon: "file-text" },
        { label: "Por Andamento", type: "page", target: "vis_porandamento", icon: "file-text" },
        { label: "Por Assuntos", type: "page", target: "vis_porassuntos", icon: "file-text" },
        { label: "Por Prioridade", type: "page", target: "vis_porprioridade", icon: "file-text" },
        { label: "Por Data (Prazo)", type: "page", target: "vis_pordataprazo", icon: "file-text" },
        { label: "Por Data de Criação", type: "page", target: "vis_pordatacriacao", icon: "file-text" },
        { label: "Por Forma", type: "page", target: "vis_porforma", icon: "file-text" },
        { label: "Por Origem", type: "page", target: "vis_pororigem", icon: "file-text" },
        { label: "Por Prazo (fórmula)", type: "page", target: "vis_porprazoformula", icon: "file-text" }
      ]
    },

    vis_completa: { title: "Completa", items: [] },
    vis_porandamento: {
      title: "Por Andamento",
      items: [
        { label: "Lista", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Lista-3b60481486dd8000bbf6d7e67ed0e78e?source=copy_link" },
        { label: "Quadro", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Quadro-3b80481486dd804e9867ffd0fb73357d?source=copy_link" },
        { label: "Tabela", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Tabela-3b80481486dd80b1a709ddd7b951be58?source=copy_link" }
      ]
    },
    vis_porassuntos: {
      title: "Por Assuntos",
      items: [
        { label: "Lista", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Lista-3b80481486dd804f8339c2458031dc43?source=copy_link" },
        { label: "Quadro", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Quadro-3b80481486dd805aa11fc917b3c02b09?source=copy_link" },
        { label: "Tabela", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Tabela-3b80481486dd8038bbdadc89ce958a06?source=copy_link" }
      ]
    },
    vis_porprioridade: { title: "Por Prioridade", items: [] },
    vis_pordataprazo: { title: "Por Data (Prazo)", items: [] },
    vis_pordatacriacao: { title: "Por Data de Criação", items: [] },
    vis_porforma: { title: "Por Forma", items: [] },
    vis_pororigem: { title: "Por Origem", items: [] },
    vis_porprazoformula: { title: "Por Prazo (fórmula)", items: [] },

    pesquisar: {
      title: "Pesquisar",
      items: [
        { label: "Por Assuntos - Pessoal", type: "page", target: "pesq_porassuntospessoal", icon: "file-text" },
        { label: "Por Assuntos - PMF", type: "page", target: "pesq_porassuntospmf", icon: "file-text" },
        { label: "Por Inscrição Imobiliária", type: "page", target: "pesq_porinscricaoimobiliaria", icon: "file-text" },
        { label: "Por Contribuinte", type: "page", target: "pesq_porcontribuinte", icon: "file-text" },
        { label: "Por Origem", type: "page", target: "pesq_pororigem", icon: "file-text" },
        { label: "Por Processo/Chamado", type: "page", target: "pesq_porprocessochamado", icon: "file-text" }
      ]
    },

    pesq_porassuntospessoal: { title: "Por Assuntos - Pessoal", items: [] },
    pesq_porassuntospmf: { title: "Por Assuntos - PMF", items: [] },
    pesq_porinscricaoimobiliaria: { title: "Por Inscrição Imobiliária", items: [] },
    pesq_porcontribuinte: { title: "Por Contribuinte", items: [] },
    pesq_pororigem: { title: "Por Origem", items: [] },
    pesq_porprocessochamado: { title: "Por Processo/Chamado", items: [] },

    // Favoritas usa "groups" em vez de "items": cada grupo vira uma caixa
    // visual com título (ex: "CONTROLES - PMF"), mas os botões dentro dela
    // ficam direto na página Favoritas — não é preciso clicar no grupo para
    // "entrar" nele, é só uma divisão visual.
    favoritas: {
      title: "Favoritas",
      groups: [
        {
          title: "CONTROLES - PMF",
          items: [
            { label: "Betha", type: "page", target: "pmf_ctrl_betha" },
            { label: "PMF - Reuniões", type: "page", target: "pmf_ctrl_reunioes" },
            { label: "PMF - Tarefas", type: "page", target: "pmf_ctrl_tarefas" }
          ]
        },
        {
          title: "Colegiados",
          items: [
            { label: "COMAT - Consultas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/a27c5f5c7daa4758b7b5d80de6450fda?v=8337729c5a904d23b55ca5ff8b07e49a&source=copy_link" },
            { label: "TAT", type: "page", target: "pmf_col_tat" }
          ]
        },
        {
          title: "Cadastros",
          items: [
            { label: "Cargos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cecf185362f34b8ebe99daf07727096f?v=17a0481486dd8040befc000c07c349c7&source=copy_link" },
            { label: "Contratos", type: "page", target: "pmf_cad_contratos" },
            { label: "Convênios", type: "notion", url: "https://app.notion.com/p/georges-filizzola/75bbbc9672b14f2d8dcd51c34f81e3d7?v=47d42a4be70f409ea8bda443c6eae771&source=copy_link" },
            { label: "IPCA", type: "notion", url: "https://app.notion.com/p/georges-filizzola/IPCA-8df0849b030d402e9b1cf507043b3093?source=copy_link" },
            { label: "Jurisprudências", type: "notion", url: "https://app.notion.com/p/georges-filizzola/24f0481486dd8094a099ec12b3a81bcf?v=24f0481486dd8150aea3000cb171d145&source=copy_link" },
            { label: "Legislações", type: "page", target: "pmf_cad_legislacoes" }
          ]
        },
        {
          title: "Tributos",
          items: [
            { label: "IPTU - Lançamento Anual", type: "notion", url: "https://app.notion.com/p/georges-filizzola/4390ef948f0345f1b0a581a152c32f57?v=a379d98f46a547c6bc8f0536c3cae333&source=copy_link" },
            { label: "TCRS – Valores", type: "notion", url: "https://app.notion.com/p/georges-filizzola/57451e2d9853462a9517d7412cda86ec?v=21c10fb52d35481daa4ed9d2d94b5453&source=copy_link" }
          ]
        },
        {
          title: "CONTROLES - PESSOAL",
          items: [
            { label: "Pessoal – Tarefas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/a0f2b9d15e244ed0b045188a10915714?v=abb77e00ab314a5e9494e0c796dfbf81&source=copy_link" },
            { label: "Aniversários", type: "notion", url: "https://app.notion.com/p/georges-filizzola/1f60481486dd8074b921f730febc7fd1?v=1f60481486dd807f9ac2000cb1578dc8&source=copy_link" },
            { label: "Listas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Listas-979a342580cf45299babd95808fc39b5?source=copy_link" },
            { label: "Eventos/Festas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/1270481486dd8044b41ac116a14d7caf?v=057186310de44c4fa92d20b40db38606&source=copy_link" }
          ]
        },
        {
          title: "LISTAS",
          items: [
            { label: "Churrasco", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Churrasco-1870481486dd8037a0bfd14598290fff?source=copy_link" },
            { label: "Remédios", type: "notion", url: "https://app.notion.com/p/georges-filizzola/ecb015baa3b040bcbc6cde03df73ef71?v=4a1b86d1a8dd4cdd881a7d3e834c125f&source=copy_link" },
            { label: "Supermercado", type: "notion", url: "https://app.notion.com/p/georges-filizzola/794248e1d5e6482f82aaecaf7369957a?v=e5c8a3d51bb742ce86bf2bcc5795f618&source=copy_link" }
          ]
        },
        {
          title: "Vitor - Estudos",
          items: [
            { label: "Horários", type: "page", target: "fav_vitor_horarios" },
            { label: "Provas", type: "page", target: "fav_vitor_provas" },
            { label: "Tarefas Escolares", type: "notion", url: "https://app.notion.com/p/georges-filizzola/7100481486dd83408ca281e5ae087a92?v=5f40481486dd83f38d9708b3f37b2733&source=copy_link" }
          ]
        }
      ]
    },

    // Folhas de Favoritas — ainda vazias, aguardando os links do Notion.
    // (fav_ctrl_pmftarefas, fav_ctrl_pmfreunioes etc. saíram daqui porque já
    // viraram link direto/pasta lá em cima, seguindo a REGRA ADOTADA —
    // ficam sem uso por enquanto. TAT também deixou de usar
    // fav_col_tatprocessos/fav_col_tatsessoes: virou um único link pra
    // pmf_col_tat, removidos.)
    fav_ctrl_pmftarefas: { title: "PMF - Tarefas", items: [] },
    fav_ctrl_pmfreunioes: { title: "PMF - Reuniões", items: [] },
    fav_ctrl_bethatarefas: { title: "Betha – Tarefas", items: [] },
    fav_ctrl_iptulancamentoanual: { title: "IPTU - Lançamento Anual", items: [] },
    fav_ctrl_pessoaltarefas: { title: "Pessoal – Tarefas", items: [] },
    fav_cad_contratos: { title: "Contratos", items: [] },
    fav_cad_legislacoes: { title: "Legislações", items: [] },
    fav_cad_ipca: { title: "IPCA", items: [] },
    fav_trib_tcrsvalores: { title: "TCRS – Valores", items: [] },
    fav_vitor_tarefasescolares: { title: "Tarefas Escolares", items: [] },
    fav_vitor_provas: { title: "Provas", items: [] },
    fav_vitor_horarios: { title: "Horários", items: [] },

    categorias: {
      title: "Categorias",
      items: [
        { label: "Pessoal", type: "page", target: "cat_pessoal" },
        { label: "Profissional", type: "page", target: "cat_profissional" }
      ]
    },

    cat_pessoal: { title: "Pessoal", items: [] },

    cat_profissional: {
      title: "Profissional",
      items: [
        { label: "PMF", type: "page", target: "pmf" }
      ]
    },

    pmf: {
      title: "PMF",
      items: [
        { label: "Colegiados", type: "page", target: "pmf_colegiados" },
        { label: "Cadastros", type: "page", target: "pmf_cadastros" },
        { label: "Controles", type: "page", target: "pmf_controles" },
        { label: "Funcional", type: "page", target: "pmf_funcional" },
        { label: "Tributos", type: "page", target: "pmf_tributos" }
      ]
    },

    pmf_colegiados: {
      title: "Colegiados",
      items: [
        { label: "ABRASF", type: "page", target: "pmf_col_abrasf" },
        { label: "COMAT", type: "page", target: "pmf_col_comat" },
        { label: "JART", type: "page", target: "pmf_col_jart" },
        { label: "TAT", type: "page", target: "pmf_col_tat" }
      ]
    },

    pmf_col_abrasf: {
      title: "ABRASF",
      items: [
        { label: "AGO/CTP", type: "notion", url: "https://app.notion.com/p/georges-filizzola/7100481486dd83408ca281e5ae087a92?v=5f40481486dd83f38d9708b3f37b2733&source=copy_link" },
        { label: "Membros de FLN", type: "notion", url: "https://app.notion.com/p/georges-filizzola/14cc9286f2404e6892db6a232d03b49a?v=fb83c0ee15134001a6fe7e20b4ade1d1&source=copy_link" },
        { label: "Reuniões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/169e89372a9c441683d8a2786d186b8b?v=0a8323765ff640b19492a5eee2f7decc&source=copy_link" }
      ]
    },
    pmf_col_abrasf_agoctp: { title: "AGO/CTP", items: [] },
    pmf_col_abrasf_membrosfln: { title: "Membros de FLN", items: [] },
    pmf_col_abrasf_reunioes: { title: "Reuniões", items: [] },

    pmf_col_comat: {
      title: "COMAT",
      items: [
        { label: "Consultas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/a27c5f5c7daa4758b7b5d80de6450fda?v=8337729c5a904d23b55ca5ff8b07e49a&source=copy_link" },
        { label: "Processos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/5fda7ad2aa2148b3b2de62cc0389f8be?v=c8d25b11c6664589b5f79b6d19307cfd&source=copy_link" },
        { label: "Reuniões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/0672e4ca4c554b5ab1f2ce0ae48e9954?v=ad6046d0fe5f408fa1ad3a9f12da054c&source=copy_link" }
      ]
    },
    pmf_col_comat_processos: { title: "Processos", items: [] },
    pmf_col_comat_reunioes: { title: "Reuniões", items: [] },
    pmf_col_comat_solucoesconsulta: { title: "Soluções de Consulta", items: [] },

    pmf_col_jart: {
      title: "JART",
      items: [
        { label: "Jeton", type: "notion", url: "https://app.notion.com/p/georges-filizzola/3f76609b693c437ea1816d9f3782b9b9?v=cbd83dbec46240e2b46b297110d7bdeb&source=copy_link" },
        { label: "Processos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/9f1e9961c3e047d1910ea70fdd2291e4?v=8f059312496f45ee93be5413fcb0d438&source=copy_link" },
        { label: "Sessões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/90ef43ee26604ebd8114610c29b60949?v=d62cf35cdf174a6cb98f01652a387795&source=copy_link" }
      ]
    },
    pmf_col_jart_processos: { title: "Processos", items: [] },
    pmf_col_jart_sessoes: { title: "Sessões", items: [] },
    pmf_col_jart_jeton: { title: "Jeton", items: [] },

    // Sessões e Processos do TAT seguem o mesmo padrão de Reuniões/Tarefas:
    // 📅 Data/Prazo e 🧲 Andamento vêm da Central (rollup via a relação
    // "Central"), não são campos nativos de "TAT - Sessões"/"TAT -
    // Processos" — por isso as exibições consultam a Central diretamente,
    // filtrando por "📚 Página de Origem". Só leitura (GET /query).
    pmf_col_tat: {
      title: "TAT",
      itemsCompact: true,
      itemGroups: [
        {
          title: "Abrir no Notion",
          items: [
            { label: "Jeton", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/bfe39c0d1fb545058538915ab28239c4?v=2a89cc3846ea4364ac2384afa8dec3aa&source=copy_link" },
            { label: "Processos", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
            { label: "Sessões", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" }
          ]
        },
        {
          title: "Criar no Notion",
          // mesmo mecanismo de "Criar Páginas" (POST /create via
          // database_id+template_id), confirmado com o usuário. "1ª Câmara"
          // usa o template de Titulares (existe também um de Suplentes em
          // Criar Páginas, não usado aqui).
          items: [
            { label: "Sessão (1ª Câmara)", type: "notion-template", icon: "notion", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "9e4c63cf-97cf-4991-9934-9881f8da114a" },
            { label: "Sessão (Pleno)", type: "notion-template", icon: "notion", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "f36660bf-2d5c-43e8-ac9b-673206d53634" },
            { label: "Processo", type: "notion-template", icon: "notion", database_id: "88435f4ebb9849ac88664da53f13ceb6", template_id: "020ef2bf-1558-484d-b0e1-0f870dd7719a" }
          ]
        }
      ],
      // Ordem: as duas exibições PENDENTES primeiro (Sessões, depois
      // Processos), pra ficarem mais visíveis no topo, e só depois as duas
      // CONCLUÍDAS — por pedido do usuário, pra facilitar visualização do
      // que ainda está em aberto.
      dynamicQueries: [
        {
          title: "Sessões pendentes",
          bg: "#fdf6e3",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - TAT - Sessões" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          // ordem por data crescente já traz os atrasados (data mais antiga)
          // pro topo — "pendente" aqui inclui atrasado, sem exibição separada.
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [ANDAMENTO_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
            { property: "Providência TAT - Sessões", type: "rollup" }
          ]
        },
        {
          title: "Processos pendentes",
          bg: "#fdf6e3",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - TAT - Processos" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [ANDAMENTO_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
            { property: "Providência TAT - Processos", type: "rollup" }
          ]
        },
        {
          title: "Sessões concluídas",
          bg: "#eaf7ed",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - TAT - Sessões" },
            { property: "🧲 Andamento", type: "relation", condition: "contains", value: "d228224dee1d43dabb72744097f10028" }
          ],
          sorts: [{ property: "📅 Data de Conclusão", direction: "descending" }],
          filters: [ANDAMENTO_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
            { property: "Providência TAT - Sessões", type: "rollup" }
          ]
        },
        {
          title: "Processos concluídos",
          bg: "#eaf7ed",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - TAT - Processos" },
            { property: "🧲 Andamento", type: "relation", condition: "contains", value: "d228224dee1d43dabb72744097f10028" }
          ],
          sorts: [{ property: "📅 Data de Conclusão", direction: "descending" }],
          filters: [ANDAMENTO_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
            { property: "Providência TAT - Processos", type: "rollup" }
          ]
        }
      ],
      // busca ao vivo por nome, sempre por último — cobre Sessões E
      // Processos juntos (orPairs = "ou" entre as duas origens).
      search: {
        title: "Pesquisar",
        placeholder: "Buscar por nome...",
        database_id: "2310481486dd80079202fe1eaf5e14c4",
        nameField: { property: "Nome", type: "title", condition: "contains" },
        baseFilters: [
          {
            property: "📚 Página de Origem", type: "select",
            orPairs: [
              { condition: "equals", value: "PMF - TAT - Sessões" },
              { condition: "equals", value: "PMF - TAT - Processos" }
            ]
          }
        ],
        filters: [CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER]
      }
    },
    pmf_col_tat_processos: { title: "Processos", items: [] },
    pmf_col_tat_sessoes: { title: "Sessões", items: [] },
    pmf_col_tat_jeton: { title: "Jeton", items: [] },

    pmf_cadastros: {
      title: "Cadastros",
      items: [
        { label: "Cargos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cecf185362f34b8ebe99daf07727096f?v=17a0481486dd8040befc000c07c349c7&source=copy_link" },
        { label: "Contratos", type: "page", target: "pmf_cad_contratos" },
        { label: "Convênios", type: "notion", url: "https://app.notion.com/p/georges-filizzola/75bbbc9672b14f2d8dcd51c34f81e3d7?v=47d42a4be70f409ea8bda443c6eae771&source=copy_link" },
        { label: "Jurisprudências", type: "notion", url: "https://app.notion.com/p/georges-filizzola/24f0481486dd8094a099ec12b3a81bcf?v=24f0481486dd8150aea3000cb171d145&source=copy_link" },
        { label: "Legislações", type: "page", target: "pmf_cad_legislacoes" },
        { label: "Nomeações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39d30e8b20984607b9710a1b9e7959b8?v=10667ad56cd34b079a664aaa193d7147&source=copy_link" },
        { label: "Pessoas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cb26c076639749b798956ff5c690e90f?v=850ea52001d748d08ffeaeb4cb048392&source=copy_link" }
      ]
    },
    pmf_cad_legislacoes: {
      title: "Legislações",
      itemsCompact: true,
      // "Abrir" (link direto pro Notion OU pra fora — Planalto/CMF não são
      // Notion, por isso o nome não é mais "Abrir no Notion" igual nas
      // outras páginas) + "Criar no Notion" (template padrão de
      // Legislações — POST /create, única exceção que escreve no Notion,
      // igual nas outras páginas). Itens em ordem alfabética.
      itemGroups: [
        {
          title: "Abrir",
          items: [
            { label: "Central - Legislações", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/Visualiza-o-Central-3bc0481486dd807293eae2ca01616fcc?source=copy_link" },
            { label: "CMF - Legislação", type: "notion", icon: "florianopolis", url: "https://www.cmf.sc.gov.br/proposicoes/Leis-Complementares/2026" },
            { label: "CMF - Proposições", type: "notion", icon: "florianopolis", url: "https://www.cmf.sc.gov.br/proposicoes/Projetos-de-Leis-Complementares/2026" },
            { label: "Legislações", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link" },
            { label: "Leis Municipais", type: "notion", icon: "leis-municipais", url: "https://leis.org/prefeitura/sc/florianopolis" },
            { label: "Planalto", type: "notion", icon: "planalto", url: "https://legislacao.presidencia.gov.br/" }
          ]
        },
        {
          title: "Criar no Notion",
          items: [
            { label: "Legislação", type: "notion-template", icon: "notion", database_id: "39f8d5dfde534e378a108521c1978e21", template_id: "b5a81d35-7544-40db-9d01-4381d829d3dd" }
          ]
        }
      ],
      // Visualização única com TODOS os itens da base "Legislações",
      // unindo a busca por nome com a visualização/filtros na MESMA caixa
      // (em vez de duas seções separadas) — texto e filtros (Tipo,
      // Assuntos) combinam entre si, cumulativo ou alternativo, e a
      // exibição já mostra tudo mesmo com a caixa de texto vazia. Fica
      // ACIMA das divisórias por assunto (ver "groupsSectionTitle" abaixo).
      // "baseFilters" usa "Nome" (título) "is_not_empty" só pra ter um
      // filtro sempre-verdadeiro (o Worker exige pelo menos 1 filtro em
      // "/query") — na prática mostra tudo, sem excluir nada por padrão.
      dynamicQueries: [
        {
          title: "Todas as legislações",
          database_id: "39f8d5dfde534e378a108521c1978e21",
          baseFilters: [
            { property: "Nome", type: "title", condition: "is_not_empty", value: true }
          ],
          sorts: [{ property: "Nome", direction: "ascending" }],
          nameSearch: { property: "Nome", type: "title", condition: "contains", placeholder: "Buscar por nome..." },
          filters: [LEGISLACOES_TIPO_FILTER, LEGISLACOES_ASSUNTOS_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "Tipo", type: "select" },
            { property: "Situação", type: "select" },
            { property: "🏷️ Assuntos (PMF)", type: "rollup" }
          ]
        }
      ],
      // "groupsSectionTitle" — rótulo acima do bloco de divisórias por
      // assunto abaixo, separando visualmente da busca/visualização acima.
      groupsSectionTitle: "Legislação por assunto",
      groups: [
        // A partir daqui: divisórias por ASSUNTO (ordem alfabética), cada uma
        // com as leis mais usadas daquele assunto. "dense: true" faz cada lei
        // virar uma linha só, com o nome e os botõezinhos de link (Notion +
        // Leis Municipais/Arquivo) lado a lado — pensado pra caber bem tanto
        // no celular dobrado quanto no monitor wide.
        {
          title: "AFTM",
          dense: true,
          items: [
            { label: "Altera Carreira (LC751/2023)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2023/751/lei-complementar-n-751-2023-altera-a-lei-complementar-n-483-de-2014-que-dispoe-sobre-a-organizacao-da-carreira-de-auditoria-da-fazenda-municipal-e-adota-outras", icon: "leis-municipais" }
            ] },
            { label: "Cria Carreira (LC483/2014)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2014/483/lei-complementar-n-483-2014-dispoe-sobre-a-organizacao-da-carreira-de-auditoria-da-fazenda-municipal-e-adota-outras/", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "Arrecadação",
          dense: true,
          items: [
            { label: "Arrecadação via PIX (L11283/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LO11283-2023-Arrecada-o-PIX-76381d51a0fa4854b3bbdec1d9a1ccd8?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/lei-ordinaria/2024/11283/lei-ordinaria-n-11283-2024-institui-o-pagamento-via-pix-para-quitacao-de-debitos-de-natureza-tributaria-multas-e-tarifas-no-municipio-de", icon: "leis-municipais" }
            ] },
            { label: "Compensação (D8072/2010)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/decreto/2010/8072/decreto-n-8072-2010-admitida-a-compensacao-de-creditos-do-sujeito-passivo-perante-a-secretaria-da-municipal-da-receita-conforme", icon: "leis-municipais" }
            ] },
            { label: "Incentivo à Cultura (D5207/2007)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/decreto/2007/5207/decreto-n-5207-2007-institui-o-novo-regulamento-da-lei-3659-91-adequando-o-as-inovacoes-da-lei-7385-07-e-da-outras", icon: "leis-municipais" }
            ] },
            { label: "Incentivo à Cultura (L3659/1991)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/lei-ordinaria/1991/3659/lei-ordinaria-n-3659-1991-dispoe-sobre-incentivo-fiscal-para-a-realizacao-de-projetos-culturais-no-mbito-do-municipio-de", icon: "leis-municipais" }
            ] },
            { label: "Incentivo à Cultura (Port-11/2025)", type: "law-links", links: [
              { label: "Diário Oficial", url: "https://edicao.dom.sc.gov.br/2025/12/1766096579_edicao_146_4083_assinada.pdf#page=43", icon: "diario-oficial" }
            ] },
            { label: "Incentivo à Inovação (D17097/2017)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/decreto/2017/17097/decreto-n-17097-2017-regulamenta-a-lei-complementar-n-432-de-2012-que-dispoe-sobre-sistemas-mecanismos-e-incentivos-a-atividade-tecnologica-e-inovativa-visando-o-desenvolvimento-sustentavel-do-municipio-de-florianopolis-e-estabelece-outras", icon: "leis-municipais" }
            ] },
            { label: "Incentivo à Inovação (LC432/2012)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/lei-complementar/2012/432/lei-complementar-n-432-2012-dispoe-sobre-sistemas-mecanismos-e-incentivos-a-atividade-tecnologica-e-inovativa-visando-o-desenvolvimento-sustentavel-do-municipio-de", icon: "leis-municipais" }
            ] },
            { label: "Transação (LC777/2025)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2025/777/lei-complementar-n-777-2025-institui-o-programa-floripa-em-dia-que-regulamenta-a-transacao-tributaria-no-municipio-de-florianopolis-e-da-outras/?termo=transa%C3%A7%C3%A3o", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "Cadastro Imobiliário",
          dense: true,
          items: [
            { label: "Alterações Cadastrais (IN-Conj-001/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-Conj-001-SMF-SMPIU-2023-CAD_IMOB-Procedimentos-de-altera-o-cadastral-1030481486dd8073bdc7e9640fe4fd7c?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/f5aa2273-e224-4827-a414-3a22f8cc8ff2/PMF_-_Legislao_-_SMF-SMPIU_-_IN_-_2023_-_001_-_Alteraes_Cadastrais.pdf?table=block&id=10304814-86dd-8092-8f17-c87943980649&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=KMxQgdrvBhUFvJU62JuV3O686Fec_A22tIXZQua-vu0&downloadName=PMF+-+Legisla%C3%A7%C3%A3o+-+SMF-SMPIU+-+IN+-+2023+-+001+-+Altera%C3%A7%C3%B5es+Cadastrais.pdf", icon: "file-type-pdf" }
            ] },
            { label: "Cadastramento (IN003/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-03-SMF-2023-CAD_IMOB-Procedimentos-de-altera-o-1030481486dd800bad56f572bebc1865?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/4e313e85-89d2-4fec-97c3-44272e145d0d/PMF_-_Legislao_-_SMF_-_IN_-_2023_-_003_-_Alteraes_Cadastrais.pdf?table=block&id=10304814-86dd-80c6-96e8-fdc3efefacfc&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=KlSwOmXmUPyGrXsFDG3Y374oLrApzSYTj9oKMmHj8TI&downloadName=PMF+-+Legisla%C3%A7%C3%A3o+-+SMF+-+IN+-+2023+-+003+-+Altera%C3%A7%C3%B5es+Cadastrais.pdf", icon: "file-type-pdf" }
            ] },
            { label: "Declaratório - Utilização (D25057/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D25057-2023-CAD-IMOB-Utiliza-o-Institui-Autodeclara-o-dcd04ff64e954f6da5350d481ce90cd3?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2023/25057/decreto-n-25057-2023-dispoe-sobre-a-desburocratizacao-no-procedimento-de-alteracao-cadastral-para-utilizacao-do-imovel-institui-a-autodeclaracao-de-utilizacao-por-meio-de-processo/", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "Colegiados",
          dense: true,
          items: [
            { label: "COMAT - Estrutura (D23206/2021)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D23206-2021-COMAT-Estrutura-d10b9774b0f042ed937e0ea73a0fcd43?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2021/23206/decreto-n-23206-2021-dispoe-sobre-a-estrutura-da-comissao-municipal-de-assuntos-tributarios-comat-e-estabelece-a-rotina-administrativa-para-formalizacao-de-consultas-sobre-a-interpretacao-e-a-aplicacao-da-legislacao-tributaria/", icon: "leis-municipais" }
            ] },
            { label: "JART - Criação (D25297/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D25297-2023-JART-Institui-a-JART-8b2f7d6f2c9a40adb74ee4c55b5d7529?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2023/25297/decreto-n-25297-2023-institui-e-disciplina-a-junta-de-analise-de-reclamacoes-de-taxa-de-coleta-de-residuos-solidos-jart-do-municipio-de/", icon: "leis-municipais" }
            ] },
            { label: "TAT - Criação (LC574/2016)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC574-2016-TAT-Institui-o-3203a2b4a4c14fafb0787a9b4e31041d?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2016/574/lei-complementar-n-574-2016-cria-o-tribunal-administrativo-tributario-do-municipio-de-florianopolis-institui-o-programa-de-racionalizacao-da-cobranca-da-divida-ativa-do-municipio-de-florianopolis-autoriza-o-municipio-de-florianopolis-a-participar-do-consorcio-de-informatica-na-gestao-publica-municipal-ciga-altera-os-arts-60-78-os-incisos-i-e-ii-do-art-92-e-os-arts-182-183-184-185-e-186-acrescenta-capitulo-v-a-da-cobranca-da-divida-ativa-e-altera-os-arts-187-188-189-190-240-244-473-e-479-da-lei-complementar-n-007-de-1997-acrescenta-os-arts-189-a-190-a-190-b-190-c-190-d-190-e-190-f-e-190-g-a-lei-complementar-n-007-de-1997-acrescenta-o-paragrafo-unico-ao-art-2-da-lei-n-7083-de-2006-revoga-o-2-do-art-78-os-1-e-2-do-art-123-os-arts-132-a-158-163/", icon: "leis-municipais" }
            ] },
            { label: "TAT - Regimento (D16498/2016)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D16498-2016-TAT-Regimento-871eb187f74a4004b9dcfd68509b0eea?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2016/16498/decreto-n-16498-2016-aprova-o-regimento-interno-do-tribunal-administrativo-tributario-do-municipio-de-florianopolis/", icon: "leis-municipais" }
            ] },
            { label: "TAT - Suspensão Exigibilidade (IN003/2025)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-003-SMF-2025-TAT-Suspens-o-da-Exigibilidade-1e60481486dd80728d15d01ae03837b8?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/988248f5-644e-4b69-80f8-2fd1d0f4026e/1745933353_instruo_normativa_n._003.smf.2025.pdf?table=block&id=1e604814-86dd-80b6-bf87-d1ba00e5bc22&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=hWp1VOi2TYtBI0RRCTH5NkdSJ5J8oBCNWhgWff6VoOI&downloadName=1745933353_instruo_normativa_n._003.smf.2025.pdf", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "COSISP",
          dense: true,
          items: [
            { label: "Instituição (LC790/2026)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC-790-2026-COSISP-Institui-o-37a0481486dd803f8129d6c89646ac35?source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2026/790/lei-complementar-n-790-2026-institui-no-mbito-do-municipio-de-florianopolis-a-contribuicao-para-o-custeio-dos-servicos-de-iluminacao-publica-e-de-sistemas-de-monitoramento-para-seguranca-e-preservacao-de-logradouros-publicos-cosisp-e-da-outras/", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "Estrutura Administrativa",
          dense: true,
          items: [
            { label: "Estrutura SMF (LC770/2024)", type: "law-links", links: [
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/lei-complementar/2024/770/lei-complementar-n-770-2024-dispoe-sobre-a-estrutura-organizacional-da-administracao-publica-do-poder-executivo-municipal-de-florianopolis-reestrutura-os-cargos-e-funcoes-gratificadas-estabelece-principios-e-diretrizes-de-gestao-e-adota-outras-providencias", icon: "leis-municipais" }
            ] },
            { label: "Regimento SMF (D27398)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D27398-2025-Regimento-Interno-SMF-1c20481486dd80fd88e3feb3c9443ae4?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/decreto/2025/27398/decreto-n-27398-2025-aprova-o-regimento-interno-da-secretaria-municipal-da-fazenda-de", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "IPTU",
          dense: true,
          items: [
            { label: "Apuração e IPCA (LC230/2006)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC230-2006-IPTU-Crit-rios-de-Apura-o-e-IPCA-c1a9164632524765b6d9cf1b31650cb3?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2006/230/lei-complementar-n-230-2006-altera-dispositivo-da-lei-complementar-n-007-de-1997-relativamente-ao-imposto-sobre-a-propriedade-predial-e-territorial-urbana-iptu-e-da-outras/", icon: "leis-municipais" }
            ] },
            { label: "Imunidade-Locado para Templos - Declaratório (D25272/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D25272-2023-IPTU-Imunidade-Locado-para-templos-Procedimento-autodeclarat--33389a13d0e946f4b5767039006df733?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/municipais/sc/florianopolis/lei/decreto/2023/25272/decreto-n-25272-2023-estabelece-a-autodeclaracao-de-nao-incidencia-do-iptu-e-de-isencao-da-tcrs-para-imovel-locado-por-entidade-religiosa-visando-garantir-seguranca-juridica-e-agilidade-no", icon: "leis-municipais" }
            ] },
            { label: "Isenção-Adoção - Declaratório (IN004/2025)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-004-SMF-GAB-2025-IPTU-Isen-Ado-o-Procedimento-declarat-rio-2500481486dd8035b24bfa29a188e211?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/450e4ce9-0581-4624-8382-2f75af8b8c5a/IN-004-SMF-GAB-2025_-_IPTU-Isen-Adoo_-_Procedimento_Declaratrio.pdf?table=block&id=25004814-86dd-805d-8804-c2e791e0c4fb&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=yGJ7zMFE0BukTG1JVNkCqHJDBW3HG3SeEzmsCu0q2iQ&downloadName=IN-004-SMF-GAB-2025+-+IPTU-Isen-Ado%C3%A7%C3%A3o+-+Procedimento+Declarat%C3%B3rio.pdf", icon: "file-type-pdf" }
            ] },
            { label: "Isenção-Economia Criativa - Criação (LC686/2020)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC686-2020-IPTU-ISSQN-Isen-o-Economia-Criativa-Start-up-Inova-o-1260481486dd80269face91cd3169ae7?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2020/686/lei-complementar-n-686-2020-dispoe-sobre-a-concessao-de-incentivos-fiscais-no-municipio-de-florianopolis-as-empresas-enquadradas-como/", icon: "leis-municipais" }
            ] },
            { label: "Isenção-Economia Criativa - Declaratório (D28345/2025)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D28345-2025-IPTU-Isen-o-Economia-Criativa-23f0481486dd807aafeef1dacbd24913?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2025/28345/decreto-n-28345-2025-regulamenta-o-incentivo-fiscal-referente-ao-imposto-sobre-a-propriedade-predial-e-territorial-urbana-iptu-previsto-nos-incisos-i-e-ii-do-art-3-da-lei-complementar-n-686-de-2020-e-da-outras/", icon: "leis-municipais" }
            ] },
            { label: "Isenção-Suspensão da Exigibilidade (IN001/2026)", type: "law-links", links: [
              { label: "Diário Oficial", url: "https://edicao.dom.sc.gov.br/2026/03/1774399817_edicao_146_4143_assinada.pdf#page=48", icon: "diario-oficial" }
            ] },
            { label: "Isenções/RevVV (D12608/2014)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D12608-2014-IPTU-Regulamenta-isen-es-e-RevVV-2800481486dd80be89fdeae8c79c6e40?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2014/12608/decreto-n-12608-2014-regulamenta-os-incisos-vi-x-xi-xii-e-xiii-do-artigo-225-1-2-3-e-4-e-do-artigo-244-da-lei-complementar-n-007-de-1997-com-as-alteracoes-da-lei-complementar-n-480-de-2013-que-dispoem-sobre-as-hipoteses-de-isencao-do-imposto-sobre-a-propriedade-predial-e-territorial-urbana-iptu-e-sobre-o-desconto-para-edificacoes-de-uso/", icon: "leis-municipais" }
            ] },
            { label: "Nova PGV (LC480/2013)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC480-2013-IPTU-Nova-PGV-IPTU-Social-ITBI-Al-quotas-4c3b3f05b3d6460297de2f594c75de19?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2013/480/lei-complementar-n-480-2013-altera-o-anexo-i-do-art-233-e-da-nova-redacao-aos-arts-225-240-244-ao-inciso-iv-do-art-279-aos-arts-280-285-aos-incisos-iii-e-iv-do-art-288-aos-arts-479-e-507-e-inclui-o-4-ao-art-56-a-lei-complementar-n-007-de-06-de-janeiro-de-1997-e-da-outras/", icon: "leis-municipais" }
            ] },
            { label: "Regulamento Cad e IPTU (D5156/2007)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D5156-2007-Regulamento-CAD_IMOB-e-IPTU-2800481486dd800e9c40ea068a1d1b81?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2007/5156/decreto-n-5156-2007-aprova-o-regulamento-do-cadastro-imobiliario-e-do-imposto-sobre-a-propriedade-predial-e-territorial/", icon: "leis-municipais" }
            ] }
          ]
        },
        {
          title: "ITBI",
          dense: true,
          items: [
            { label: "Imunidade-Recíproca - Declaratório (IN002/2021)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-02-SMF-GAB-2021-ITBI-Imunidade-Rec-proca-3210481486dd807595fdee6d7bc3e878?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/9c821c32-447f-4206-b3aa-1bea9642f2ed/1_-_ITBI-Imun-Recip_-_Instruo_Normativa_(ass_SMF).pdf?table=block&id=32104814-86dd-8080-8e47-e1a2fca883e5&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=qyhwgaW9Os6r_aoAL8lBjv3kBqtCfc0nZ9s1Xtfm39Y&downloadName=1+-+ITBI-Imun-Recip+-+Instru%C3%A7%C3%A3o+Normativa+%28ass+SMF%29.pdf", icon: "file-type-pdf" }
            ] },
            { label: "Imunidade-Templos - Declaratório (IN004/2021)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-04-SMF-GAB-2021-ITBI-Imunidade-Templos-3210481486dd8044a49eeabd16eba50d?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/ae421c5e-3fa0-43c2-86ab-32fb041de1e7/ITBI-Imun-Templos_-_Instruo_Normativa_(assinada).pdf?table=block&id=32104814-86dd-8035-8536-cb183fec6b22&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=4IdxTDzXDwOMpOrnuguQbZERazP08yi-5HxI7fI2jqA&downloadName=ITBI-Imun-Templos+-+Instru%C3%A7%C3%A3o+Normativa+%28assinada%29.pdf", icon: "file-type-pdf" }
            ] },
            { label: "Informações DOI (D25228/2023)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D25228-2023-ITBI-Transfer-ncias-Registro-de-Im-veis-d28a45d7ec864f7abefe6e00ad6cc616?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2023/25228/decreto-n-25228-2023-regulamenta-o-art-291-da-lei-complementar-n-007-de-1997-que-dispoe-sobre-o-envio-ao-orgao-fazendario-municipal-da-relacao-de-imoveis-transmitidos-ou/", icon: "leis-municipais" }
            ] },
            { label: "NI-IntCS e demais - Declaratório (IN001/2021)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-01-SMF-GAB-2021-ITBI-N-o-incid-ncia-Institui-Autodeclara-o-07d5a4954747480687c4bd291254d16c?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/7d76197a-4101-4f59-a19a-03a6839aa213/1_-ITBI-NI-Instruo_Normativa(ass_SMF).pdf?table=block&id=282a0398-4020-4b15-bfe7-c723c8bb6af4&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=6FM38DaaIX5W1IRht7o5LEwsPJ6VeAgSrYbwEvaf7n8&downloadName=1+-+ITBI-NI+-+Instru%C3%A7%C3%A3o+Normativa+%28ass+SMF%29.pdf", icon: "file-type-pdf" }
            ] },
            { label: "NI-Marinha(Ocup)/Posse - Dispensa (IN002/2022)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-IN-002-SMF-GAB-2022-ITBI-N-o-incid-ncia-Marinha-ocup-e-posse-2f1e0e4eba6e47bf9380ec9e12e0595e?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Arquivo", url: "https://file.notion.com/f/f/cc15729f-b8f1-4e73-a2a1-42531da36a54/aeaa5b07-e69a-4c87-9c02-0eaf6a99ee19/ITBI-NI-Posse_e_Marinha_-Instruo_Normativa(DOEM).pdf?table=block&id=146ea615-bf81-41ee-af84-6f8ea12d1a76&spaceId=cc15729f-b8f1-4e73-a2a1-42531da36a54&expirationTimestamp=1786701600000&signature=tqghw9G8bL6yvrEQjXBBAh-bN8KkRGraUwvlOXbZk-M&downloadName=ITBI-NI-Posse+e+Marinha+-+Instru%C3%A7%C3%A3o+Normativa+%28DOEM%29.pdf", icon: "file-type-pdf" }
            ] }
          ]
        },
        {
          title: "TCRS",
          dense: true,
          items: [
            { label: "Apuração (LC132/2003)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC132-2003-TCRS-Crit-rios-de-Apura-o-b44d4375c3fe4b71b8ec9b35fb0beedd?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2003/132/lei-complementar-n-132-2003-altera-dispositivos-da-lei-complementar-n-007-97-relativamente-a-taxa-de-coleta-de-residuos-solidos-e-da-outras/", icon: "leis-municipais" }
            ] },
            { label: "Limitador (LC136/2004)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-LC136-2004-TCRS-Limitador-de-Aumento-f4d4bd1e9efb4ebabc1f77694501377f?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/lei-complementar/2004/136/lei-complementar-n-136-2004-dispoe-sobre-o-lancamento-da-taxa-de-coleta-de-residuos-solidos-a-ser-paga-pelas-unidades-produtivas-ou-institucionais-e-da-outras/", icon: "leis-municipais" }
            ] },
            { label: "Redutor (D2215/2004)", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Legisla-o-PMF-D2215-2004-TCRS-Redutor-ff979c7db99746e2b30fce3552a5b219?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" },
              { label: "Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis/lei/decreto/2004/2215/decreto-n-2215-2004-determina-providencias-quanto-a-cobranca-da-taxa-de-que-trata-o-artigo-315-da-consolidacao-das-leis-tributarias-aprovada-pela-lei-complementar-n-007-97-com-alteracoes-no-exercicio-de/", icon: "leis-municipais" }
            ] }
          ]
        }
      ]
    },
    pmf_cad_cargos: { title: "Cargos", items: [] },
    pmf_cad_contratos: {
      title: "Contratos",
      itemsCompact: true,
      itemGroups: [
        {
          title: "Abrir",
          items: [
            // "Central" ainda sem link — botão fica visível mas apagado
            // (ver app.js: item sem "url" vira um botão "reservado", não
            // clicável) até você me passar o link certo.
            { label: "Central", type: "notion", icon: "notion", url: "" },
            { label: "Contratos", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/23ccd4efa7074deab954fc3fc6625f8c?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link" },
            { label: "PMF - Licitações", type: "notion", icon: "pmf", url: "https://wbc.pmf.sc.gov.br/portal/Mural.aspx" },
            { label: "TCE - Farol", type: "notion", icon: "tce", url: "https://paineistransparencia.tce.sc.gov.br/extensions/AppLicitacoesExterno/index.html" }
          ]
        },
        {
          title: "Criar no Notion",
          items: [
            { label: "Contrato", type: "notion-template", icon: "notion", database_id: "23ccd4efa7074deab954fc3fc6625f8c", template_id: "f1b6abf0-cf92-4a38-8045-c865e4ed9860" }
          ]
        }
      ],
      dynamicQueries: [
        {
          title: "Todos os Contratos",
          database_id: "23ccd4efa7074deab954fc3fc6625f8c",
          baseFilters: [
            { property: "Nome", type: "title", condition: "is_not_empty", value: true }
          ],
          sorts: [{ property: "Nome", direction: "ascending" }],
          nameSearch: { property: "Nome", type: "title", condition: "contains", placeholder: "Buscar por nome..." },
          filters: [LEGISLACOES_ASSUNTOS_FILTER, CONTRATOS_CONTRATO_FILTER, CONTRATOS_SITUACAO_FILTER, LIMIT_FILTER],
          cardFields: [
            { property: "📖 Contrato", type: "rollup", stacked: true },
            { property: "Prazo Inicial", property2: "Prazo Final", type: "date-range-pair" },
            { property: "Situação", type: "select" }
          ]
        }
      ],
      groupsSectionTitle: "Contratos por assunto",
      groups: [
        {
          title: "Sistemas",
          dense: true,
          items: [
            { label: "Tributário - Betha - 356/SMF/2026", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2026-SMF-356-Sistemas-Gest-o-Tribut-ria-Betha-Sistemas-Ltda-2460481486dd8060bf29ef2e83b659bb?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "Tributário - Pública - 307/SMF/2023", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2023-SMF-307-Sistemas-Gest-o-Tribut-ria-SEFINNet-NFPS-e-P-blica-097fd089ab514161bba96260d879bdf7?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "Tributário - Betha - 87/SMF/2021", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2021-SMF-87-Sistemas-Gest-o-Tribut-ria-Betha-Sistemas-Ltda-e2c1779262c54a7b86ed80d597d49a79?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "SOLAR - Softplan - 361/SMA/2023", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2023-SMA-361-Sistemas-Gest-o-de-Processos-SOLAR-Softplan-1000481486dd80d9bdb2c6464e3403a8?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "Geoprocessamento - Engefoto - 1066/IPUF/2019", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2019-IPUF-1066-Sistemas-Geoprocessamento-Engefoto-759ee0104630499682e8c3922e5cccb3?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "G-SIMPLES - Ciga - 1/SMF/2023", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2023-SMF-1-Sistemas-G-Simples-CIGA-1230481486dd8084843de7657d51dea2?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] }
          ]
        },
        {
          title: "Serviços diversos",
          dense: true,
          items: [
            { label: "Gráfica - Postmix - 794/SMFPO/2022", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2022-SMFPO-794-Impress-o-Gr-fica-Carn-s-IPTU-MEI-TLP-Postmix-4f3f78bd11604cf98e2234e4bb6622dc?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "Postagens - Correios - 980/SMA/2018", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2018-SMA-980-Servi-os-Postais-Correios-44247565ead542b7b693f034be9fc627?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] },
            { label: "Instituições Financeiras - CEF - 750/SMF/2023", type: "law-links", links: [
              { label: "Notion", url: "https://app.notion.com/p/georges-filizzola/Contratos-2023-SMF-750-Institui-o-Financeira-Arrecada-o-FP-CEF-a27ed235cb9e4361837aaf84ac99d4f5?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link", icon: "notion" }
            ] }
          ]
        }
      ]
    },
    pmf_cad_convenios: { title: "Convênios", items: [] },
    pmf_cad_jurisprudencias: { title: "Jurisprudências", items: [] },
    pmf_cad_nomeacoes: { title: "Nomeações", items: [] },

    pmf_controles: {
      title: "Controles",
      items: [
        { label: "Atrasados e Prioritários", type: "page", target: "pmf_ctrl_atrasados" },
        { label: "Betha", type: "page", target: "pmf_ctrl_betha" },
        { label: "Reuniões", type: "page", target: "pmf_ctrl_reunioes" },
        { label: "Tarefas", type: "page", target: "pmf_ctrl_tarefas" },
        { label: "Time Sheet", type: "notion", url: "https://app.notion.com/p/georges-filizzola/95226c82b4aa45c0bc428a3c570ce28d?v=780f9595e978455abf33cce0c934ed8d&source=copy_link" }
      ]
    },

    // Junta TUDO que está atrasado (📅 Data/Prazo já passou) na Central,
    // não travado numa origem específica (ao contrário de Betha/Reuniões/
    // Tarefas/TAT) — é a página de "pendências gerais", primeiro passo do
    // que o Georges pensou em fazer (Hoje/Amanhã/Início vêm depois, ainda
    // em aberto). Só leitura (GET /query), igual as demais.
    pmf_ctrl_atrasados: {
      title: "Atrasados e Prioritários",
      itemsCompact: true,
      itemGroups: [
        {
          title: "Abrir no Notion",
          items: [
            { label: "Central", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/2310481486dd80079202fe1eaf5e14c4?v=23a0481486dd80888552000ce77ddd24&source=copy_link" }
          ]
        }
      ],
      dynamicQueries: [
        {
          title: "Atrasados",
          bg: "#fdecea",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📅 Data/Prazo", type: "date", condition: "before", value: "today" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [
            {
              // faixa de quanto tempo atrás venceu — combinada com "antes de
              // hoje" acima (baseFilters), então cada opção aqui só limita o
              // início da faixa (ex: "Última semana" = venceu nos últimos 7
              // dias, sem contar hoje).
              property: "📅 Data/Prazo",
              type: "date",
              condition: "on_or_after",
              label: "Prazo",
              default: "past_week",
              options: [
                { label: "Ontem", pageId: "yesterday", condition: "equals", value: "yesterday", icon: "ti-calendar-minus", color: "#4a90d9" },
                { label: "Últimos 3 dias", pageId: "past_3_days", condition: "on_or_after", value: "past_3_days", icon: "ti-calendar-minus", color: "#4a90d9" },
                { label: "Semana passada", pageId: "past_week", condition: "past_week", value: {}, icon: "ti-calendar-week", color: "#4a90d9" },
                { label: "Últimos 15 dias", pageId: "past_15_days", condition: "on_or_after", value: "past_15_days", icon: "ti-calendar-minus", color: "#4a90d9" },
                { label: "Último mês", pageId: "past_month", condition: "past_month", value: {}, icon: "ti-calendar-month", color: "#4a90d9" }
              ]
            },
            PRIORITARIOS_PRIORIDADE_FILTER,
            PRIORITARIOS_ORIGEM_FILTER,
            PRIORITARIOS_CATEGORIA_FILTER,
            ANDAMENTO_FILTER,
            FOCUS_FILTER,
            LIMIT_FILTER
          ],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" },
            { property: " 🚩 Prioridade", type: "relation", lookup: "prioridade" },
            { property: "📚 Página de Origem", type: "select" }
          ]
        }
      ]
    },

    // Igual Tarefas: 📅 Data/Prazo, 🧲 Andamento, 🚩 Prioridade, ⭐ Focus e
    // 📖 Processo/Chamado não são campos nativos de "PMF - Betha - Tarefas"
    // — as exibições consultam a Central direto, filtrando por "📚 Página
    // de Origem". Só leitura (GET /query) nas exibições/busca; os botões de
    // "Criar no Notion" continuam sendo a única exceção que escreve
    // (POST /create), igual em Tarefas/TAT.
    pmf_ctrl_betha: {
      title: "Betha",
      itemsCompact: true,
      itemGroups: [
        {
          title: "Abrir no Notion",
          items: [
            { label: "Tarefas", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/7e1194013472498f884e7b4e759c56bf?v=152de528d7aa40168640b394d3a8458e&source=copy_link" },
            { label: "Scripts", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/Betha-Scripts-5455bb9ca1984a72b0d1b481feef03e1?source=copy_link" },
            { label: "Tabelas", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/Betha-Tabelas-a4403e8844a64681a04525d1bcf817fc?source=copy_link" }
          ]
        },
        {
          title: "Criar no Notion",
          // mesmos templates já usados em Criar Páginas → Entrada/Criar
          // páginas/PMF/Controles → divisória "Betha" — exceto "Sistemas -
          // TRIBUTO - ASSUNTO - CONTRIBUINTE", deixado de fora por pedido.
          items: [
            { label: "Chamados", type: "notion-template", icon: "notion", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "09f31cab-7036-42c2-a826-ff51dc854dfb" },
            { label: "Créditos Tributários", type: "notion-template", icon: "notion", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "3477be4a-a971-463f-ad75-e3a88de0fbc6" },
            { label: "Fórmulas", type: "notion-template", icon: "notion", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "ae170a72-fc41-4fc6-b6e2-38b643fe2380" },
            { label: "Scripts", type: "notion-template", icon: "notion", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "782d4983-e7b4-4ca4-810c-3975f2889d6b" }
          ]
        }
      ],
      dynamicQueries: [
        {
          title: "Pendentes",
          bg: "#fdf6e3",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Betha - Tarefas" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, BETHA_CATEGORIA_FILTER, FOCUS_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: BETHA_CARD_FIELDS
        },
        {
          title: "Atrasadas",
          bg: "#fdecea",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Betha - Tarefas" },
            { property: "📅 Data/Prazo", type: "date", condition: "before", value: "today" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, BETHA_CATEGORIA_FILTER, FOCUS_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: BETHA_CARD_FIELDS
        },
        {
          title: "Concluídas",
          bg: "#eaf7ed",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Betha - Tarefas" },
            { property: "🧲 Andamento", type: "relation", condition: "contains", value: "d228224dee1d43dabb72744097f10028" }
          ],
          sorts: [{ property: "📅 Data de Conclusão", direction: "descending" }],
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, BETHA_CATEGORIA_FILTER, FOCUS_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: BETHA_CARD_FIELDS
        }
      ],
      search: {
        title: "Pesquisar",
        placeholder: "Buscar tarefa por nome...",
        database_id: "2310481486dd80079202fe1eaf5e14c4",
        nameField: { property: "Nome", type: "title", condition: "contains" },
        baseFilters: [
          { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Betha - Tarefas" }
        ],
        filters: [CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER]
      }
    },
    pmf_ctrl_betha_tarefas: { title: "Tarefas", items: [] },
    pmf_ctrl_betha_scripts: { title: "Scripts", items: [] },
    pmf_ctrl_betha_tabelas: { title: "Tabelas", items: [] },

    // "PMF - Tarefas" segue o mesmo padrão de Reuniões: 📅 Data/Prazo,
    // 🧲 Andamento, 🧾 Origem e 🚩 Prioridade são todos ROLLUPS (vêm da
    // Central via a relação "Central"), não campos nativos da base
    // "PMF - Tarefas" — por isso as exibições consultam a Central
    // diretamente, filtrando por "📚 Página de Origem" = "PMF - Tarefas".
    // Só leitura (GET /query) — nunca escreve nada no Notion.
    pmf_ctrl_tarefas: {
      title: "Tarefas",
      itemsCompact: true,
      // botões fixos no topo, divididos em 2 subgrupos (caixinha fina ao
      // redor de cada um): links diretos pras visualizações já prontas no
      // Notion, e atalhos de criação de página (mesmos templates já usados
      // em Criar Páginas → Entrada/Criar páginas/PMF/Controles → divisória
      // "Tarefas", agora com 1 clique aqui também via POST /create).
      itemGroups: [
        {
          title: "Abrir no Notion",
          items: [
            { label: "Geral", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a2ff0d56471a4b1baab88fea288fb307&source=copy_link" },
            { label: "Ofícios", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a080ebe059b5481aa628966a9baacfc1&source=copy_link" },
            { label: "Pendentes", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=e18cf9bf95e946b09c5878eb53c87c50&source=copy_link" },
            { label: "Central", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/2310481486dd80079202fe1eaf5e14c4?v=23a0481486dd8071bdef000c3f7ae805&source=copy_link" }
          ]
        },
        {
          title: "Criar no Notion",
          items: [
            { label: "Auditorias", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "f0e058d6-85ce-401f-bb8a-2a7f1513ef10" },
            { label: "Consultas", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "1809e1e4-e069-4251-9345-0ed89c664da3" },
            { label: "Fiscalização", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "1367bf16-71d0-4560-acfa-e7a3d8a2b64e" },
            { label: "Lançamentos", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "87c65fda-96b0-4e19-afc0-84c8eb87bb39" },
            { label: "Ofícios", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "6b7c5969-1344-492c-b501-3236fe0733f4" },
            { label: "Processos", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "21111593-0a0c-4e6a-a744-e560879db3e0" }
          ]
        }
      ],
      dynamicQueries: [
        {
          title: "Pendentes",
          bg: "#fdf6e3",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Tarefas" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, FOCUS_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: TAREFAS_CARD_FIELDS
        },
        {
          title: "Atrasadas",
          bg: "#fdecea",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Tarefas" },
            { property: "📅 Data/Prazo", type: "date", condition: "before", value: "today" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, FOCUS_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: TAREFAS_CARD_FIELDS
        },
        {
          title: "Concluídas",
          bg: "#eaf7ed",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Tarefas" },
            { property: "🧲 Andamento", type: "relation", condition: "contains", value: "d228224dee1d43dabb72744097f10028" }
          ],
          sorts: [{ property: "📅 Data de Conclusão", direction: "descending" }],
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, FOCUS_FILTER, CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER, LIMIT_FILTER],
          cardFields: TAREFAS_CARD_FIELDS
        }
      ],
      // busca ao vivo por nome, sempre por último na página — igual à de
      // Legislações/Reuniões.
      search: {
        title: "Pesquisar",
        placeholder: "Buscar tarefa por nome...",
        database_id: "2310481486dd80079202fe1eaf5e14c4",
        nameField: { property: "Nome", type: "title", condition: "contains" },
        baseFilters: [
          { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Tarefas" }
        ],
        filters: [CENTRAL_ASSUNTOS_FILTER, CENTRAL_PROCESSO_FILTER]
      }
    },
    // "dynamicQueries" — várias exibições fixas (baseFilters + sorts) numa
    // página só, cada uma buscando sozinha ao abrir. Todas consultam a base
    // Central (mesma da página "Hoje"), filtrando por
    // "📚 Página de Origem" = "PMF - Reuniões" pra trazer só as reuniões.
    // Só leitura (GET /query) — nunca escreve nada no Notion.
    pmf_ctrl_reunioes: {
      title: "Reuniões",
      // "itemsCompact" — deixa os botões abaixo baixos (ícone + texto numa
      // linha), em vez do cartão alto padrão do desktop/tablet. Continua
      // valendo mesmo usando "itemGroups" abaixo (que já é compact por
      // padrão), mas não custa deixar explícito.
      itemsCompact: true,
      // botões fixos no topo, divididos em subgrupos rotulados (caixinha
      // fina ao redor de cada um). Usam o logo real do Notion (icon:
      // "notion"), igual ao padrão de Legislações.
      itemGroups: [
        {
          title: "Abrir no Notion",
          items: [
            { label: "Geral", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
            { label: "Pendentes", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=202117a77040409083c02dde7da355f2&source=copy_link" },
            { label: "Concluídas", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=728edc021780475eb43ddc8a1c97f955&source=copy_link" },
            { label: "Central", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/2310481486dd80079202fe1eaf5e14c4?v=23a0481486dd80888552000ce77ddd24&source=copy_link" }
          ]
        },
        {
          title: "Criar no Notion",
          // mesmos templates já usados em Criar Páginas → Entrada/Criar
          // páginas/PMF/Controles → divisória "Reuniões" (POST /create).
          items: [
            { label: "2026-09-XX - IPTU 2027 (XXX)", type: "notion-template", icon: "notion", database_id: "af1ec75c4a2b4b02a2f6880e78bc8e61", template_id: "ea112acd-f975-4d95-a892-83614e3a43e2" },
            { label: "2026-XX-XX - XXX", type: "notion-template", icon: "notion", database_id: "af1ec75c4a2b4b02a2f6880e78bc8e61", template_id: "7dc2c479-55f9-47a1-bdd4-b565638e5823" }
          ]
        }
      ],
      dynamicQueries: [
        {
          title: "Próximas Reuniões",
          bg: "#eaf2fb",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" },
            { property: "📅 Data/Prazo", type: "date", condition: "on_or_after", value: "today" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          // filtro extra de intervalo — cada opção pode sobrescrever a
          // condition/value do filtro padrão (ex: "Esta semana" usa a
          // condição relativa nativa do Notion "next_week", com value {}
          // em vez de uma data específica)
          filters: [
            {
              property: "📅 Data/Prazo",
              type: "date",
              condition: "equals",
              label: "Quando",
              options: [
                { label: "Hoje", pageId: "today", condition: "equals", icon: "ti-calendar-event", color: "#4a90d9" },
                { label: "Amanhã", pageId: "tomorrow", condition: "equals", icon: "ti-calendar-plus", color: "#4a90d9" },
                { label: "Esta semana", pageId: "next_week", condition: "next_week", value: {}, icon: "ti-calendar-week", color: "#4a90d9" },
                { label: "Este mês", pageId: "next_month", condition: "next_month", value: {}, icon: "ti-calendar-month", color: "#4a90d9" }
              ]
            },
            FOCUS_FILTER,
            CENTRAL_ASSUNTOS_FILTER
          ],
          // campos extras mostrados como subtítulo em cada card de resultado
          // (data/hora + status de andamento) — só leitura, vem junto da
          // própria busca (Worker: /query?...&extra=[...])
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" }
          ]
        },
        {
          title: "Últimas Reuniões",
          bg: "#eaf7ed",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" },
            { property: "📅 Data/Prazo", type: "date", condition: "before", value: "today" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "descending" }],
          filters: [
            {
              property: "📅 Data/Prazo",
              type: "date",
              condition: "equals",
              label: "Quando",
              // já abre filtrado em "Última semana" — clique no filtro pra
              // trocar (ex: voltar pra "Todos", "Ontem"...)
              default: "past_week",
              options: [
                { label: "Hoje", pageId: "today", condition: "equals", icon: "ti-calendar-event", color: "#4a90d9" },
                { label: "Ontem", pageId: "yesterday", condition: "equals", icon: "ti-calendar-minus", color: "#4a90d9" },
                { label: "Última semana", pageId: "past_week", condition: "past_week", value: {}, icon: "ti-calendar-week", color: "#4a90d9" },
                { label: "Último mês", pageId: "past_month", condition: "past_month", value: {}, icon: "ti-calendar-month", color: "#4a90d9" }
              ]
            },
            FOCUS_FILTER,
            CENTRAL_ASSUNTOS_FILTER
          ],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" }
          ]
        },
        {
          title: "Andamento pendente",
          bg: "#fdf6e3",
          database_id: "2310481486dd80079202fe1eaf5e14c4",
          baseFilters: [
            { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "d228224dee1d43dabb72744097f10028" },
            { property: "🧲 Andamento", type: "relation", condition: "does_not_contain", value: "2410481486dd80a3a8b0d819542a55c5" }
          ],
          sorts: [{ property: "📅 Data/Prazo", direction: "ascending" }],
          // filtro extra pra ver só um status específico (dentro dos que já
          // não são Concluído/Cancelado, já excluídos acima)
          filters: [
            {
              property: "🧲 Andamento",
              type: "relation",
              condition: "contains",
              label: "Andamento",
              options: [
                { label: "0 - Iniciar agora", pageId: "9ff8db6d456d43f39e70e14786c1fe6d", icon: "ti-player-skip-forward-filled", color: "#4a90d9" },
                { label: "1 - Em andamento", pageId: "2030481486dd80d386a1cf7522b3deb1", icon: "ti-player-play-filled", color: "#4a90d9" },
                { label: "2 - Iniciar assim que possível", pageId: "d18f7c0ac312422cbc14a3ae1bc82399", icon: "ti-player-track-next-filled", color: "#4a90d9" },
                { label: "3 - Aguardando terceiros", pageId: "08cb3ec723ef41b19e6c6472ee9d9a75", icon: "ti-player-pause-filled", color: "#4a90d9" },
                { label: "4 - Iniciar quando possível", pageId: "959d289339c440a492612c70ea8ed1c9", icon: "ti-arrows-left-right", color: "#4a90d9" },
                { label: "5 - Agendado", pageId: "4ef9e6737cea4c53ae37efe966013214", icon: "ti-refresh", color: "#4a90d9" }
              ]
            },
            FOCUS_FILTER,
            CENTRAL_ASSUNTOS_FILTER
          ],
          cardFields: [
            { property: "📅 Data/Prazo", type: "date" },
            { property: "🧲 Andamento", type: "relation", lookup: "andamento" }
          ]
        }
      ],
      // busca ao vivo por nome, sempre por último na página — igual à de
      // Legislações. "baseFilters" fica sempre aplicado (escopa a base
      // Central inteira só aos registros de "PMF - Reuniões"), mas só busca
      // quando o usuário digita algo.
      search: {
        title: "Pesquisar",
        placeholder: "Buscar reunião por nome...",
        database_id: "2310481486dd80079202fe1eaf5e14c4",
        nameField: { property: "Nome", type: "title", condition: "contains" },
        baseFilters: [
          { property: "📚 Página de Origem", type: "select", condition: "equals", value: "PMF - Reuniões" }
        ],
        filters: [CENTRAL_ASSUNTOS_FILTER]
      }
    },
    pmf_ctrl_timesheet: { title: "Time Sheet", items: [] },

    pmf_funcional: {
      title: "Funcional",
      items: [
        { label: "AFIFI - Jantares", type: "notion", url: "https://app.notion.com/p/georges-filizzola/13c0481486dd801c93f6e4dc26e718ff?v=ff6456efb9ec448d9c18c665962e5aa0&source=copy_link" },
        { label: "Diárias", type: "notion", url: "https://app.notion.com/p/georges-filizzola/980aea13aee94b1eb94cdd62267df905?v=d224d2a61e5c4aa9961ba71ffe24b6b7&source=copy_link" }
      ]
    },
    pmf_func_afifi: {
      title: "AFIFI",
      items: [
        { label: "Jantares", type: "page", target: "pmf_func_afifi_jantares" }
      ]
    },
    pmf_func_afifi_jantares: { title: "Jantares", items: [] },
    pmf_func_diarias: { title: "Diárias", items: [] },

    pmf_tributos: {
      title: "Tributos",
      items: [
        { label: "Geral", type: "page", target: "pmf_trib_geral" },
        { label: "IPTU/TCRS", type: "page", target: "pmf_trib_iptutcrs" },
        { label: "ISSQN", type: "notion", url: "https://app.notion.com/p/georges-filizzola/1120481486dd808093dffa5545b4bdee?v=19a68e4f0bc84d388c7b5efe8f9ad6d4&source=copy_link" }
      ]
    },

    pmf_trib_geral: {
      title: "Geral",
      items: [
        { label: "IPCA", type: "notion", url: "https://app.notion.com/p/georges-filizzola/IPCA-8df0849b030d402e9b1cf507043b3093?source=copy_link" },
        { label: "Valores Lançados", type: "notion", url: "https://app.notion.com/p/georges-filizzola/a61fe05ad95d4b0397f8c2d87f5fcd22?v=9a3b5eb93a1e4b3bb43b998cca4a1a7f&source=copy_link" }
      ]
    },
    pmf_trib_geral_ipca: { title: "IPCA", items: [] },
    pmf_trib_geral_valoreslancados: { title: "Valores Lançados", items: [] },

    pmf_trib_iptutcrs: {
      title: "IPTU/TCRS",
      items: [
        { label: "Benefícios Fiscais", type: "notion", url: "https://app.notion.com/p/georges-filizzola/2800481486dd809f90c9c5c0bf349601?v=2800481486dd80d9926a000ce937104e&source=copy_link" },
        { label: "Lançamento Anual", type: "notion", url: "https://app.notion.com/p/georges-filizzola/4390ef948f0345f1b0a581a152c32f57?v=a87fb3e62a834df89996281daec7c823&source=copy_link" },
        { label: "Resumos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Resumos-IPTU-dd41797e874b4b1097d363f19038b3cb?source=copy_link" },
        { label: "Tabelas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Tabelas-IPTU-0dcbb585216f4bc0a6ca416595e2f7fc?source=copy_link" },
        { label: "Valores (TCRS)", type: "notion", url: "https://app.notion.com/p/georges-filizzola/57451e2d9853462a9517d7412cda86ec?v=21c10fb52d35481daa4ed9d2d94b5453&source=copy_link" }
      ]
    },
    pmf_trib_iptutcrs_beneficiosfiscais: { title: "Benefícios Fiscais", items: [] },
    pmf_trib_iptutcrs_lancamentoanual: { title: "Lançamento Anual", items: [] },
    pmf_trib_iptutcrs_resumos: { title: "Resumos", items: [] },
    pmf_trib_iptutcrs_tabelas: { title: "Tabelas", items: [] },
    pmf_trib_iptutcrs_valorestcrs: { title: "Valores (TCRS)", items: [] },

    pmf_trib_issqn: {
      title: "ISSQN",
      items: [
        { label: "Lista de Serviços e Alíquotas", type: "page", target: "pmf_trib_issqn_listaservicosaliquotas" }
      ]
    },
    pmf_trib_issqn_listaservicosaliquotas: { title: "Lista de Serviços e Alíquotas", items: [] },

    recentes: {
      title: "Recentes",
      items: [
        { label: "Recentes", type: "notion", url: "https://app.notion.com/library/recents?space=georges-filizzola", icon: "clock" }
      ]
    }
  }
};
