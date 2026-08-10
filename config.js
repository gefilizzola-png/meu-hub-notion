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

  Opcionalmente cada item pode ter um ícone (nome do Tabler Icons, sem o
  prefixo "ti-"). Lista de ícones: https://tabler.io/icons
     { label: "Calendário", type: "page", target: "calendario", icon: "calendar" }

  "startPage" define qual página abre primeiro quando o app é aberto.

  REGRA ADOTADA: quando uma página interna tem um único botão (um único link
  do Notion, sem mais nada), o botão que leva até ela some — o botão do nível
  anterior aponta direto para o link do Notion (type: "notion"), evitando
  clique duplo. A página interna correspondente (ex: "calendario") continua
  definida abaixo, só não é referenciada por enquanto — assim, se um dia
  quiser abrir níveis dentro dela (mais de um botão), é só trocar o item do
  nível anterior de volta para type: "page" apontando pra ela.
*/

const APP_CONFIG = {
  appTitle: "Meu hub",
  startPage: "entrada",

  pages: {
    entrada: {
      title: "Entrada",
      items: [
        { label: "Eventos", type: "page", target: "eventos", icon: "calendar" },
        { label: "Favoritas", type: "page", target: "favoritas", icon: "star" },
        { label: "Central", type: "page", target: "central", icon: "layout-grid" },
        { label: "Categorias", type: "page", target: "categorias", icon: "category" },
        { label: "Biblioteca", type: "page", target: "biblioteca", icon: "books" }
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
            { label: "PMF - Tarefas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=e18cf9bf95e946b09c5878eb53c87c50&source=copy_link" },
            { label: "PMF - Reuniões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
            { label: "Betha – Tarefas", type: "page", target: "fav_ctrl_bethatarefas" },
            { label: "IPTU - Lançamento Anual", type: "page", target: "fav_ctrl_iptulancamentoanual" }
          ]
        },
        {
          title: "Colegiados",
          items: [
            { label: "TAT – Processos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
            { label: "TAT – Sessões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" }
          ]
        },
        {
          title: "Cadastros",
          items: [
            { label: "Contratos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/23ccd4efa7074deab954fc3fc6625f8c?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link" },
            { label: "Legislações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link" },
            { label: "IPCA", type: "notion", url: "https://app.notion.com/p/georges-filizzola/IPCA-8df0849b030d402e9b1cf507043b3093?source=copy_link" }
          ]
        },
        {
          title: "Tributos",
          items: [
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
            { label: "Tarefas Escolares", type: "page", target: "fav_vitor_tarefasescolares" },
            { label: "Provas", type: "page", target: "fav_vitor_provas" },
            { label: "Horários", type: "page", target: "fav_vitor_horarios" }
          ]
        }
      ]
    },

    // Folhas de Favoritas — ainda vazias, aguardando os links do Notion.
    // (fav_ctrl_pmftarefas, fav_ctrl_pmfreunioes, fav_col_tatprocessos etc.
    // saíram daqui porque já viraram link direto lá em cima, seguindo a
    // REGRA ADOTADA — ficam sem uso por enquanto.)
    fav_ctrl_pmftarefas: { title: "PMF - Tarefas", items: [] },
    fav_ctrl_pmfreunioes: { title: "PMF - Reuniões", items: [] },
    fav_ctrl_bethatarefas: { title: "Betha – Tarefas", items: [] },
    fav_ctrl_iptulancamentoanual: { title: "IPTU - Lançamento Anual", items: [] },
    fav_ctrl_pessoaltarefas: { title: "Pessoal – Tarefas", items: [] },
    fav_col_tatprocessos: { title: "TAT – Processos", items: [] },
    fav_col_tatsessoes: { title: "TAT – Sessões", items: [] },
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
        { label: "AGO/CTP", type: "page", target: "pmf_col_abrasf_agoctp" },
        { label: "Membros de FLN", type: "page", target: "pmf_col_abrasf_membrosfln" },
        { label: "Reuniões", type: "page", target: "pmf_col_abrasf_reunioes" }
      ]
    },
    pmf_col_abrasf_agoctp: { title: "AGO/CTP", items: [] },
    pmf_col_abrasf_membrosfln: { title: "Membros de FLN", items: [] },
    pmf_col_abrasf_reunioes: { title: "Reuniões", items: [] },

    pmf_col_comat: {
      title: "COMAT",
      items: [
        { label: "Processos", type: "page", target: "pmf_col_comat_processos" },
        { label: "Reuniões", type: "page", target: "pmf_col_comat_reunioes" },
        { label: "Soluções de Consulta", type: "page", target: "pmf_col_comat_solucoesconsulta" }
      ]
    },
    pmf_col_comat_processos: { title: "Processos", items: [] },
    pmf_col_comat_reunioes: { title: "Reuniões", items: [] },
    pmf_col_comat_solucoesconsulta: { title: "Soluções de Consulta", items: [] },

    pmf_col_jart: {
      title: "JART",
      items: [
        { label: "Processos", type: "page", target: "pmf_col_jart_processos" },
        { label: "Sessões", type: "page", target: "pmf_col_jart_sessoes" },
        { label: "Jeton", type: "page", target: "pmf_col_jart_jeton" }
      ]
    },
    pmf_col_jart_processos: { title: "Processos", items: [] },
    pmf_col_jart_sessoes: { title: "Sessões", items: [] },
    pmf_col_jart_jeton: { title: "Jeton", items: [] },

    pmf_col_tat: {
      title: "TAT",
      items: [
        { label: "Processos", type: "page", target: "pmf_col_tat_processos" },
        { label: "Sessões", type: "page", target: "pmf_col_tat_sessoes" },
        { label: "Jeton", type: "page", target: "pmf_col_tat_jeton" }
      ]
    },
    pmf_col_tat_processos: { title: "Processos", items: [] },
    pmf_col_tat_sessoes: { title: "Sessões", items: [] },
    pmf_col_tat_jeton: { title: "Jeton", items: [] },

    pmf_cadastros: {
      title: "Cadastros",
      items: [
        { label: "Cargos", type: "page", target: "pmf_cad_cargos" },
        { label: "Contratos", type: "page", target: "pmf_cad_contratos" },
        { label: "Convênios", type: "page", target: "pmf_cad_convenios" },
        { label: "Jurisprudências", type: "page", target: "pmf_cad_jurisprudencias" },
        { label: "Legislações", type: "page", target: "pmf_cad_legislacoes" },
        { label: "Nomeações", type: "page", target: "pmf_cad_nomeacoes" }
      ]
    },
    pmf_cad_cargos: { title: "Cargos", items: [] },
    pmf_cad_contratos: { title: "Contratos", items: [] },
    pmf_cad_convenios: { title: "Convênios", items: [] },
    pmf_cad_jurisprudencias: { title: "Jurisprudências", items: [] },
    pmf_cad_legislacoes: { title: "Legislações", items: [] },
    pmf_cad_nomeacoes: { title: "Nomeações", items: [] },

    pmf_controles: {
      title: "Controles",
      items: [
        { label: "Betha", type: "page", target: "pmf_ctrl_betha" },
        { label: "Tarefas", type: "page", target: "pmf_ctrl_tarefas" },
        { label: "Reuniões", type: "page", target: "pmf_ctrl_reunioes" },
        { label: "Time Sheet", type: "page", target: "pmf_ctrl_timesheet" }
      ]
    },

    pmf_ctrl_betha: {
      title: "Betha",
      items: [
        { label: "Tarefas", type: "page", target: "pmf_ctrl_betha_tarefas" },
        { label: "Scripts", type: "page", target: "pmf_ctrl_betha_scripts" },
        { label: "Tabelas", type: "page", target: "pmf_ctrl_betha_tabelas" }
      ]
    },
    pmf_ctrl_betha_tarefas: { title: "Tarefas", items: [] },
    pmf_ctrl_betha_scripts: { title: "Scripts", items: [] },
    pmf_ctrl_betha_tabelas: { title: "Tabelas", items: [] },

    pmf_ctrl_tarefas: { title: "Tarefas", items: [] },
    pmf_ctrl_reunioes: { title: "Reuniões", items: [] },
    pmf_ctrl_timesheet: { title: "Time Sheet", items: [] },

    pmf_funcional: {
      title: "Funcional",
      items: [
        { label: "AFIFI", type: "page", target: "pmf_func_afifi" },
        { label: "Diárias", type: "page", target: "pmf_func_diarias" }
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
        { label: "ISSQN", type: "page", target: "pmf_trib_issqn" }
      ]
    },

    pmf_trib_geral: {
      title: "Geral",
      items: [
        { label: "IPCA", type: "page", target: "pmf_trib_geral_ipca" },
        { label: "Valores Lançados", type: "page", target: "pmf_trib_geral_valoreslancados" }
      ]
    },
    pmf_trib_geral_ipca: { title: "IPCA", items: [] },
    pmf_trib_geral_valoreslancados: { title: "Valores Lançados", items: [] },

    pmf_trib_iptutcrs: {
      title: "IPTU/TCRS",
      items: [
        { label: "Benefícios Fiscais", type: "page", target: "pmf_trib_iptutcrs_beneficiosfiscais" },
        { label: "Lançamento Anual", type: "page", target: "pmf_trib_iptutcrs_lancamentoanual" },
        { label: "Resumos", type: "page", target: "pmf_trib_iptutcrs_resumos" },
        { label: "Tabelas", type: "page", target: "pmf_trib_iptutcrs_tabelas" },
        { label: "Valores (TCRS)", type: "page", target: "pmf_trib_iptutcrs_valorestcrs" }
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
