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
  templateWorkerUrl: "https://flat-lake-5b3b.gefilizzola.workers.dev",

  pages: {
    entrada: {
      title: "Entrada",
      items: [
        { label: "Criar páginas", type: "page", target: "criar_paginas", icon: "file-plus" },
        { label: "Eventos", type: "page", target: "eventos", icon: "calendar" },
        { label: "Favoritas", type: "page", target: "favoritas", icon: "star" },
        { label: "Central", type: "page", target: "central", icon: "layout-grid" },
        { label: "Categorias", type: "page", target: "categorias", icon: "category" },
        { label: "Biblioteca", type: "page", target: "biblioteca", icon: "books" }
      ]
    },

    criar_paginas: {
      title: "Criar páginas",
      items: [
        { label: "PMF", type: "page", target: "criar_pmf" }
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
            { label: "PMF - Reuniões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
            { label: "PMF - Tarefas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=e18cf9bf95e946b09c5878eb53c87c50&source=copy_link" }
          ]
        },
        {
          title: "Colegiados",
          items: [
            { label: "COMAT - Consultas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/a27c5f5c7daa4758b7b5d80de6450fda?v=8337729c5a904d23b55ca5ff8b07e49a&source=copy_link" },
            { label: "TAT – Processos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
            { label: "TAT – Sessões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" }
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
            { label: "Legislações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link" }
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

    pmf_col_tat: {
      title: "TAT",
      items: [
        { label: "Jeton", type: "notion", url: "https://app.notion.com/p/georges-filizzola/bfe39c0d1fb545058538915ab28239c4?v=2a89cc3846ea4364ac2384afa8dec3aa&source=copy_link" },
        { label: "Processos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
        { label: "Sessões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" }
      ]
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
        { label: "Legislações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link" },
        { label: "Nomeações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39d30e8b20984607b9710a1b9e7959b8?v=10667ad56cd34b079a664aaa193d7147&source=copy_link" },
        { label: "Pessoas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/cb26c076639749b798956ff5c690e90f?v=850ea52001d748d08ffeaeb4cb048392&source=copy_link" }
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
        { label: "Reuniões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
        { label: "Tarefas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=e18cf9bf95e946b09c5878eb53c87c50&source=copy_link" },
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

    pmf_ctrl_tarefas: { title: "Tarefas", items: [] },
    pmf_ctrl_reunioes: { title: "Reuniões", items: [] },
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
