# Resumo — app de acesso rápido ao Notion

## Objetivo
App HTML/CSS/JS estático (sem backend, sem banco de dados) que funciona como um launcher visual: botões que abrem páginas do Notion do usuário em nova aba, ou navegam para outras "páginas" internas do próprio app. Roda no navegador, no computador e no celular.

## Arquivos do projeto
- `index.html` — estrutura da página (sidebar + área principal + busca).
- `styles.css` — todo o visual, com breakpoints responsivos.
- `app.js` — toda a lógica (renderização, navegação, árvore lateral, busca, atalhos de teclado).
- `config.js` — **o único arquivo que precisa ser editado no dia a dia.** Define as páginas do app e os botões de cada uma. Comentado em português, com exemplos de como adicionar links do Notion ou novas páginas internas.

Nenhum dado do Notion é carregado pelo app — ele só guarda links de saída. Publicar o app não expõe conteúdo do Notion; quem clicar cai na tela de login do Notion normalmente.

## Decisões de layout (responsivo, 3 faixas)
- **Celular (< 640px):** lista vertical com divisórias entre os itens, uma página por vez, botão de voltar no topo. *(Obs: ao abrir o `index.html` direto pelo app Arquivos do Android via `content://`, os arquivos irmãos — config.js, app.js, styles.css — não carregam e a página aparece sem estilo. Ainda não resolvido; combinamos de deixar esse ajuste para depois.)*
- **Tablet / Galaxy Fold desdobrado (640–1023px):** mesma navegação por página, mas em grade de botões maiores (cards com ícone + rótulo).
- **Computador (≥ 1024px):** layout aproveitando a tela toda —
  - Menu lateral fixo (sidebar) com a árvore inteira do app, estilo Windows Explorer: setinha para expandir/recolher cada pasta, separada do clique no nome (que navega). Só o caminho até a página atual fica expandido por padrão.
  - **Altura fixa de 26px por linha da árvore — manter sempre esse valor em edições futuras.** Fonte 12.5px, ícones 13px, indentação 14px por nível. Visual minimalista, bem compacto.
  - Breadcrumb no topo da área principal.
  - Grade de botões maiores na área principal (cards com ícone, rótulo, atalho numérico 1–9 visível).
  - Busca rápida (Ctrl+K ou "/" para focar), com resultados de qualquer nível da árvore, navegação por setas/Enter.
  - Atalhos de teclado: Ctrl+K ou "/" abre a busca; Esc volta um nível; teclas 1–9 ativam o botão correspondente da página atual.

## Estilo visual
Claro e minimalista: fundo branco, textos em cinza-escuro, ícones Tabler Icons (webfont via CDN, cdnjs.cloudflare.com, versão 3.44.0 — atenção: a URL correta é `https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.44.0/tabler-icons.min.css`, sem a pasta `iconfont/`). Sem gradientes, sombras pesadas ou cores fortes — só cinzas neutros e bordas finas (0.5px).

## Estrutura de páginas definida até agora
```
Entrada (página inicial)
├── Eventos
│   ├── Calendário   (vazia)
│   ├── Listas       (vazia)
│   ├── Blocos       (vazia)
│   └── Por Formas   (vazia)
├── Central          (vazia)
├── Favoritas        (vazia)
├── Categorias       (vazia)
└── Recentes         (vazia)
```
Todas as páginas "vazias" já existem no `config.js`, prontas para receber links do Notion ou novas subpáginas — é só editar o array `items` de cada uma.

## Pendências / próximos passos
1. Preencher o conteúdo real de Central, Favoritas, Categorias, Recentes e das 4 subpáginas de Eventos (links do Notion e/ou mais páginas internas).
2. Resolver a visualização no celular (o problema do `content://` ao abrir via app Arquivos do Android).
3. Na hora de publicar, decidir hospedagem:
   - **GitHub Pages ou Netlify** — mais simples, mas o link fica público para quem tiver a URL (sem senha nativa gratuita).
   - **Cloudflare Pages + Cloudflare Access** — única opção realmente privada e gratuita (até 50 usuários), exige login antes de mostrar o app. Configuração inicial um pouco mais longa.
   - Nenhuma escolha de hospedagem exige mudar o código — é só configuração no momento da publicação.

## Preferências registradas do usuário
- Quer o app usável tanto no computador (telas 3440×1440 e 1920×1080) quanto no celular (Samsung Galaxy Z Fold 7, com modo dobrado e desdobrado).
- No computador, quer aproveitar a tela cheia com recursos que não caberiam no celular (sidebar, busca, atalhos de teclado) — já implementado.
- Prefere seguir construindo o app aos poucos, página por página, sem ter tudo mapeado de antemão.
- Estilo de resposta: direto e conciso, sem formatação excessiva.
