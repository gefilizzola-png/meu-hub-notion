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

  Também é possível agrupar itens visualmente dentro de uma página, usando
  "group" (o mesmo nome de grupo em vários itens os junta numa caixa com
  título — isso é só visual, não cria uma página nova nem afeta o menu
  lateral ou a busca):
     { label: "PMF - Tarefas", type: "notion", url: "...", group: "CONTROLES - PMF" }

  "startPage" define qual página abre primeiro quando o app é aberto.
*/

const APP_CONFIG = {
  appTitle: "Meu hub",
  startPage: "entrada",

  pages: {
    entrada: {
      title: "Entrada",
      items: [
        { label: "Eventos", type: "page", target: "eventos", icon: "calendar" },
        { label: "Central", type: "page", target: "central", icon: "layout-grid" },
        { label: "Favoritas", type: "page", target: "favoritas", icon: "star" },
        { label: "Categorias", type: "page", target: "categorias", icon: "category" },
        { label: "Recentes", type: "page", target: "recentes", icon: "clock" }
      ]
    },

    // Páginas de destino dos botões acima.
    // Ainda estão vazias — vá adicionando os itens (links do Notion ou novas
    // páginas) dentro de "items" conforme for definindo cada uma.

    eventos: {
      title: "Eventos",
      items: [
        { label: "Calendário", type: "page", target: "calendario", icon: "calendar" },
        { label: "Listas", type: "page", target: "listas", icon: "list" },
        { label: "Blocos", type: "page", target: "blocos", icon: "layout-grid" },
        { label: "Por Formas", type: "page", target: "porformas" }
      ]
    },

    calendario: {
      title: "Calendário",
      items: []
    },

    listas: {
      title: "Listas",
      items: []
    },

    blocos: {
      title: "Blocos",
      items: []
    },

    porformas: {
      title: "Por Formas",
      items: []
    },

    central: {
      title: "Central",
      items: []
    },

    favoritas: {
      title: "Favoritas",
      items: [
        { label: "TAT - Processos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/88435f4ebb9849ac88664da53f13ceb6?v=8f9a3a9c068447a2aa9bb49a2d69eeb6&source=copy_link" },
        { label: "TAT - Sessões", type: "notion", url: "https://app.notion.com/p/georges-filizzola/8cfdb6aa51e14988930a98dd0793c7bf?v=1faa5782ba1d49d5a491c42261ca61e8&source=copy_link" },
        { label: "Contratos", type: "notion", url: "https://app.notion.com/p/georges-filizzola/23ccd4efa7074deab954fc3fc6625f8c?v=d715fa98fd4f44acaa057442e04e5ace&source=copy_link" },
        { label: "Legislações", type: "notion", url: "https://app.notion.com/p/georges-filizzola/39f8d5dfde534e378a108521c1978e21?v=3371b71811134e19b51c2d5ab23b211f&source=copy_link" },
        { label: "IPCA", type: "notion", url: "https://app.notion.com/p/georges-filizzola/IPCA-8df0849b030d402e9b1cf507043b3093?source=copy_link" },
        { label: "TCRS - Valores", type: "notion", url: "https://app.notion.com/p/georges-filizzola/57451e2d9853462a9517d7412cda86ec?v=21c10fb52d35481daa4ed9d2d94b5453&source=copy_link" },
        { label: "Vitor - Tarefas Escolares e Provas", type: "notion", url: "https://app.notion.com/p/georges-filizzola/24c0481486dd8117974bca8a61bddc18?v=24c0481486dd8046832d000caef8bc17&source=copy_link" },

        { label: "PMF - Reuniões", type: "notion", group: "CONTROLES - PMF", url: "https://app.notion.com/p/georges-filizzola/af1ec75c4a2b4b02a2f6880e78bc8e61?v=d48c2008a5a548ca938faf5ca8b40bfa&source=copy_link" },
        { label: "PMF - Tarefas", type: "notion", group: "CONTROLES - PMF", url: "https://app.notion.com/p/georges-filizzola/72d4cab7152b4580b88c1350c53b1a05?v=e18cf9bf95e946b09c5878eb53c87c50&source=copy_link" },

        { label: "Pessoal - Tarefas", type: "notion", group: "CONTROLES - PESSOAL", url: "https://app.notion.com/p/georges-filizzola/a0f2b9d15e244ed0b045188a10915714?v=abb77e00ab314a5e9494e0c796dfbf81&source=copy_link" },
        { label: "Aniversários", type: "notion", group: "CONTROLES - PESSOAL", url: "https://app.notion.com/p/georges-filizzola/1f60481486dd8074b921f730febc7fd1?v=1f60481486dd807f9ac2000cb1578dc8&source=copy_link" },
        { label: "Listas", type: "notion", group: "CONTROLES - PESSOAL", url: "https://app.notion.com/p/georges-filizzola/Listas-979a342580cf45299babd95808fc39b5?source=copy_link" },
        { label: "Eventos/Festas", type: "notion", group: "CONTROLES - PESSOAL", url: "https://app.notion.com/p/georges-filizzola/1270481486dd8044b41ac116a14d7caf?v=057186310de44c4fa92d20b40db38606&source=copy_link" },

        { label: "Churrasco", type: "notion", group: "LISTAS", url: "https://app.notion.com/p/georges-filizzola/Churrasco-1870481486dd8037a0bfd14598290fff?source=copy_link" },
        { label: "Remédios", type: "notion", group: "LISTAS", url: "https://app.notion.com/p/georges-filizzola/ecb015baa3b040bcbc6cde03df73ef71?v=4a1b86d1a8dd4cdd881a7d3e834c125f&source=copy_link" },
        { label: "Supermercado", type: "notion", group: "LISTAS", url: "https://app.notion.com/p/georges-filizzola/794248e1d5e6482f82aaecaf7369957a?v=e5c8a3d51bb742ce86bf2bcc5795f618&source=copy_link" }
      ]
    },

    categorias: {
      title: "Categorias",
      items: []
    },

    recentes: {
      title: "Recentes",
      items: []
    }
  }
};
