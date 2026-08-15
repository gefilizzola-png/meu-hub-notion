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

  Uma página também pode ter "items" (botões fixos) JUNTO com "dynamicQuery"/
  "dynamicQueries"/"search" na mesma página — nesse caso "items" aparece no
  topo (ex: Reuniões: botões de link direto pras visualizações do Notion,
  depois as exibições ao vivo, depois a busca). Nesse caso normalmente vale
  a pena usar "itemsCompact: true" na página, senão os botões ficam altos
  demais (cartão de desktop) pra só um link direto.

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
    1) topo: "items" com itemsCompact:true — botões de link direto pro
       Notion (type:"notion") e, quando fizer sentido, atalhos de criação
       de página (type:"notion-template") pros templates mais usados
       daquela base — ambos com icon:"notion".
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

const APP_CONFIG = {
  appTitle: "Meu hub",
  startPage: "entrada",
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

  pages: {
    entrada: {
      title: "Entrada",
      items: [
        { label: "Hoje", type: "page", target: "hoje", icon: "calendar-event" },
        { label: "Criar páginas", type: "page", target: "criar_paginas", icon: "file-plus" },
        { label: "Eventos", type: "page", target: "eventos", icon: "calendar" },
        { label: "Favoritas", type: "page", target: "favoritas", icon: "star" },
        { label: "Central", type: "page", target: "central", icon: "layout-grid" },
        { label: "Categorias", type: "page", target: "categorias", icon: "category" },
        { label: "Biblioteca", type: "page", target: "biblioteca", icon: "books" }
      ]
    },

    // "dynamicQuery": em vez de "items" fixos, essa página busca ao vivo no
    // Notion (via Worker) as páginas da base indicada cujo campo de data
    // bater com a data informada (ou hoje, se "date" não for definido).
    hoje: {
      title: "Hoje",
      dynamicQuery: {
        database_id: "2310481486dd80079202fe1eaf5e14c4",
        // filtro sempre aplicado: Data/Prazo = hoje
        baseFilters: [
          { property: "📅 Data/Prazo", type: "date", condition: "equals", value: "today" }
        ],
        // filtros extras escolhidos na tela (dropdown com ícone)
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
              { label: "5 - Agendado", pageId: "4ef9e6737cea4c53ae37efe966013214", icon: "ti-refresh", color: "#4a90d9" },
              { label: "6 - Concluído", pageId: "d228224dee1d43dabb72744097f10028", icon: "ti-circle-check-filled", color: "#2f9e44" },
              { label: "9 - Cancelado", pageId: "2410481486dd80a3a8b0d819542a55c5", icon: "ti-circle-x-filled", color: "#e03131" }
            ]
          }
        ]
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

    criar_pmf: {
      title: "PMF",
      items: [
        { label: "Colegiados", type: "page", target: "criar_pmf_colegiados" },
        { label: "Controles", type: "page", target: "criar_pmf_controles" }
      ]
    },

    // "groups" aqui funciona igual em Favoritas: cada divisória (ex: "Tarefas")
    // é só uma caixa visual pra indicar de qual base de dados do Notion vêm
    // aqueles templates — não é um nível extra de navegação.
    criar_pmf_controles: {
      title: "Controles",
      groups: [
        {
          title: "Betha",
          items: [
            { label: "Sistemas - Betha Tributos - Chamados - XXXX", type: "notion-template", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "09f31cab-7036-42c2-a826-ff51dc854dfb" },
            { label: "Sistemas - Betha Tributos - Créditos Tributários - XXXX", type: "notion-template", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "3477be4a-a971-463f-ad75-e3a88de0fbc6" },
            { label: "Sistemas - Betha Tributos - Fórmulas - XXXX", type: "notion-template", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "ae170a72-fc41-4fc6-b6e2-38b643fe2380" },
            { label: "Sistemas - Betha Tributos - Scripts - XXXX", type: "notion-template", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "782d4983-e7b4-4ca4-810c-3975f2889d6b" },
            { label: "Sistemas - TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "7e1194013472498f884e7b4e759c56bf", template_id: "523e8e2e-06b7-42a2-9902-a33adc3a3f0c" }
          ]
        },
        {
          title: "Reuniões",
          items: [
            { label: "PMF - Reuniões - 2026-09-XX - IPTU 2027 (XXX)", type: "notion-template", database_id: "af1ec75c4a2b4b02a2f6880e78bc8e61", template_id: "ea112acd-f975-4d95-a892-83614e3a43e2" },
            { label: "PMF - Reuniões - 2026-XX-XX - XXX", type: "notion-template", database_id: "af1ec75c4a2b4b02a2f6880e78bc8e61", template_id: "7dc2c479-55f9-47a1-bdd4-b565638e5823" }
          ]
        },
        {
          title: "Tarefas",
          items: [
            { label: "Auditorias — TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "f0e058d6-85ce-401f-bb8a-2a7f1513ef10" },
            { label: "Consultas — TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "1809e1e4-e069-4251-9345-0ed89c664da3" },
            { label: "Fiscalização — TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "1367bf16-71d0-4560-acfa-e7a3d8a2b64e" },
            { label: "Lançamentos — TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "87c65fda-96b0-4e19-afc0-84c8eb87bb39" },
            { label: "Ofícios — TRIBUTO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "6b7c5969-1344-492c-b501-3236fe0733f4" },
            { label: "Processos — TRIBUTO - PROCESSO - ASSUNTO - CONTRIBUINTE", type: "notion-template", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "21111593-0a0c-4e6a-a744-e560879db3e0" }
          ]
        }
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
            { label: "Betha – Tarefas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/7e1194013472498f884e7b4e759c56bf?v=152de528d7aa40168640b394d3a8458e&source=copy_link" },
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
            { label: "Betha - Scripts", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Betha-Scripts-5455bb9ca1984a72b0d1b481feef03e1?source=copy_link" },
            { label: "Cargos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cecf185362f34b8ebe99daf07727096f?v=17a0481486dd8040befc000c07c349c7&source=copy_link" },
            { label: "Contratos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/23ccd4efa7074deab954fc3fc6625f8c?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link" },
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
      items: [
        { label: "Jeton", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/bfe39c0d1fb545058538915ab28239c4?v=2a89cc3846ea4364ac2384afa8dec3aa&source=copy_link" },
        { label: "Processos", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
        { label: "Sessões", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" },
        // botões de criação — mesmo mecanismo de "Criar Páginas" (POST
        // /create via database_id+template_id), confirmado com o usuário.
        // "1ª Câmara" usa o template de Titulares (existe também um de
        // Suplentes em Criar Páginas, não usado aqui).
        { label: "Sessão - Criar (1ª Câmara)", type: "notion-template", icon: "notion", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "9e4c63cf-97cf-4991-9934-9881f8da114a" },
        { label: "Sessão - Criar (Pleno)", type: "notion-template", icon: "notion", database_id: "8cfdb6aa51e14988930a98dd0793c7bf", template_id: "f36660bf-2d5c-43e8-ac9b-673206d53634" },
        { label: "Processo - Criar", type: "notion-template", icon: "notion", database_id: "88435f4ebb9849ac88664da53f13ceb6", template_id: "020ef2bf-1558-484d-b0e1-0f870dd7719a" }
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
          filters: [ANDAMENTO_FILTER, LIMIT_FILTER],
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
          filters: [ANDAMENTO_FILTER, LIMIT_FILTER],
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
        ]
      }
    },
    pmf_col_tat_processos: { title: "Processos", items: [] },
    pmf_col_tat_sessoes: { title: "Sessões", items: [] },
    pmf_col_tat_jeton: { title: "Jeton", items: [] },

    pmf_cadastros: {
      title: "Cadastros",
      items: [
        { label: "Cargos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cecf185362f34b8ebe99daf07727096f?v=17a0481486dd8040befc000c07c349c7&source=copy_link" },
        { label: "Contratos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/23ccd4efa7074deab954fc3fc6625f8c?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link" },
        { label: "Convênios", type: "notion", url: "https://app.notion.com/p/georges-filizzola/75bbbc9672b14f2d8dcd51c34f81e3d7?v=47d42a4be70f409ea8bda443c6eae771&source=copy_link" },
        { label: "Jurisprudências", type: "notion", url: "https://app.notion.com/p/georges-filizzola/24f0481486dd8094a099ec12b3a81bcf?v=24f0481486dd8150aea3000cb171d145&source=copy_link" },
        { label: "Legislações", type: "page", target: "pmf_cad_legislacoes" },
        { label: "Nomeações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39d30e8b20984607b9710a1b9e7959b8?v=10667ad56cd34b079a664aaa193d7147&source=copy_link" },
        { label: "Pessoas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cb26c076639749b798956ff5c690e90f?v=850ea52001d748d08ffeaeb4cb048392&source=copy_link" }
      ]
    },
    pmf_cad_legislacoes: {
      title: "Legislações",
      groups: [
        {
          title: "Link direto",
          // "dense: true" usa o mesmo padrão de linha (nome + botãozinho de
          // ícone) das demais divisórias da página, pra manter tudo com a
          // mesma cara.
          dense: true,
          items: [
            { label: "Central - Legislações", type: "law-links", links: [
              { label: "Abrir no Notion", url: "https://app.notion.com/p/georges-filizzola/Visualiza-o-Central-3bc0481486dd807293eae2ca01616fcc?source=copy_link", icon: "notion" }
            ] },
            { label: "Legislações", type: "law-links", links: [
              { label: "Abrir no Notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link", icon: "notion" }
            ] },
            { label: "Leis Municipais", type: "law-links", links: [
              { label: "Abrir no Leis Municipais", url: "https://leis.org/prefeitura/sc/florianopolis", icon: "leis-municipais" }
            ] }
          ]
        },
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
      ],
      // Busca ao vivo na base "Legislações" — só consulta o Notion (GET),
      // nunca escreve nada. Dispara quando o usuário digita no campo "Nome"
      // e/ou escolhe um "Tipo"; se os dois estiverem vazios, não busca.
      search: {
        title: "Pesquisar",
        placeholder: "Buscar por nome...",
        database_id: "39f8d5dfde534e378a108521c1978e21",
        nameField: { property: "Nome", type: "title", condition: "contains" },
        filters: [
          {
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
          }
        ]
      }
    },
    pmf_cad_cargos: { title: "Cargos", items: [] },
    pmf_cad_contratos: { title: "Contratos", items: [] },
    pmf_cad_convenios: { title: "Convênios", items: [] },
    pmf_cad_jurisprudencias: { title: "Jurisprudências", items: [] },
    pmf_cad_nomeacoes: { title: "Nomeações", items: [] },

    pmf_controles: {
      title: "Controles",
      items: [
        { label: "Betha", type: "page", target: "pmf_ctrl_betha" },
        { label: "Reuniões", type: "page", target: "pmf_ctrl_reunioes" },
        { label: "Tarefas", type: "page", target: "pmf_ctrl_tarefas" },
        { label: "Time Sheet", type: "notion", url: "https://app.notion.com/p/georges-filizzola/95226c82b4aa45c0bc428a3c570ce28d?v=780f9595e978455abf33cce0c934ed8d&source=copy_link" }
      ]
    },

    pmf_ctrl_betha: {
      title: "Betha",
      items: [
        { label: "Scripts", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Betha-Scripts-5455bb9ca1984a72b0d1b481feef03e1?source=copy_link" },
        { label: "Tabelas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/Betha-Tabelas-a4403e8844a64681a04525d1bcf817fc?source=copy_link" },
        { label: "Tarefas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/7e1194013472498f884e7b4e759c56bf?v=152de528d7aa40168640b394d3a8458e&source=copy_link" }
      ]
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
      // botões fixos no topo — links diretos pras visualizações já prontas
      // no Notion (mesma base "PMF - Tarefas").
      items: [
        { label: "Geral", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a2ff0d56471a4b1baab88fea288fb307&source=copy_link" },
        { label: "Ofícios", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=a080ebe059b5481aa628966a9baacfc1&source=copy_link" },
        { label: "Pendentes", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=e18cf9bf95e946b09c5878eb53c87c50&source=copy_link" },
        { label: "Central", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/2310481486dd80079202fe1eaf5e14c4?v=23a0481486dd8071bdef000c3f7ae805&source=copy_link" },
        // botões de criação — mesmos templates já usados em Criar Páginas
        // (Entrada/Criar páginas/PMF/Controles, divisória "Tarefas"), agora
        // como atalho de 1 clique aqui também (POST /create).
        { label: "Auditorias - Criar", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "f0e058d6-85ce-401f-bb8a-2a7f1513ef10" },
        { label: "Consultas - Criar", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "1809e1e4-e069-4251-9345-0ed89c664da3" },
        { label: "Fiscalização - Criar", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "1367bf16-71d0-4560-acfa-e7a3d8a2b64e" },
        { label: "Lançamentos - Criar", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "87c65fda-96b0-4e19-afc0-84c8eb87bb39" },
        { label: "Ofícios - Criar", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "6b7c5969-1344-492c-b501-3236fe0733f4" },
        { label: "Processos - Criar", type: "notion-template", icon: "notion", database_id: "72d4cab7152b4580b88c1350c53b1a05", template_id: "21111593-0a0c-4e6a-a744-e560879db3e0" }
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
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, LIMIT_FILTER],
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
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, LIMIT_FILTER],
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
          filters: [ANDAMENTO_FILTER, PRIORIDADE_FILTER, ORIGEM_FILTER, LIMIT_FILTER],
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
        ]
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
      // linha), em vez do cartão alto padrão do desktop/tablet.
      itemsCompact: true,
      // botões fixos no topo — links diretos pras visualizações já prontas
      // no Notion (mesma base "PMF - Reuniões"). Usam o logo real do Notion
      // (icon: "notion"), igual ao padrão adotado em Legislações.
      items: [
        { label: "Geral", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
        { label: "Pendentes", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=202117a77040409083c02dde7da355f2&source=copy_link" },
        { label: "Concluídas", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=728edc021780475eb43ddc8a1c97f955&source=copy_link" },
        { label: "Central", type: "notion", icon: "notion", url: "https://app.notion.com/p/georges-filizzola/2310481486dd80079202fe1eaf5e14c4?v=23a0481486dd80888552000ce77ddd24&source=copy_link" }
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
            }
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
            }
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
            }
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
        ]
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
