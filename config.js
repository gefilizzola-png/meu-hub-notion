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
      items: []
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
