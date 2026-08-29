(function () {
  var cfg = APP_CONFIG;
  // "homePage" (tela que sempre abre primeiro, ex: Início) é diferente de
  // "startPage" (raiz da árvore do menu lateral, ex: Entrada — precisa
  // continuar sendo a raiz pra "Criar páginas"/"Eventos"/etc. continuarem
  // alcançáveis pelo menu). Todo lugar abaixo que decide "qual página abre
  // /qual página é 'casa'" usa homePage; buildIndex()/buildTreeNode()
  // (raiz da árvore) continuam usando startPage puro.
  var homePageId = cfg.homePage || cfg.startPage;
  var currentId = homePageId;
  var parentOf = {};        // pageId -> parentPageId
  var flatIndex = [];       // { label, type, url|target, pathTitles: [..], pathIds: [..], ownerPageId }
  var selectedResult = -1;
  var expandedPages = {};   // pageId -> true if its children are shown in the sidebar tree

  function iconFor(item) {
    if (item.icon) return "ti-" + item.icon;
    if (item.type === "notion") return "ti-file-text";
    if (item.type === "notion-template") return "ti-file-plus";
    if (item.type === "law-links") return "ti-scale";
    return "ti-folder";
  }

  // logos reais (sem fundo) usados no lugar de um ícone genérico Tabler —
  // mesma lista usada nas linhas densas de Legislações (buildLawRow). Um
  // "item" normal usa isso quando item.icon bate com uma destas chaves (ex:
  // botões de link direto pro Notion usam icon: "notion").
  var IMG_ICONS = { notion: "icon-notion.png", "leis-municipais": "icon-leis-municipais.png", "diario-oficial": "icon-diario-oficial.png", "file-type-pdf": "icon-pdf.png", florianopolis: "icon-florianopolis.png", planalto: "icon-planalto.png", tce: "icon-tce.png", pmf: "icon-pmf.png" };

  // ---------------- chamadas ao Worker, sempre com o login anexado ----------------
  // Todo fetch pro Worker passa por aqui — acrescenta "Authorization: Bearer
  // <token do Google>" (ver auth.js) em cima dos headers que já existirem.
  // O Worker confere esse token antes de fazer qualquer coisa no Notion;
  // sem ele (ou com ele expirado/errado), a resposta vem 401.
  function authFetch(url, options) {
    options = options || {};
    var headers = {};
    Object.keys(options.headers || {}).forEach(function (k) { headers[k] = options.headers[k]; });
    var authHeader = (window.Auth && Auth.authHeader()) || {};
    Object.keys(authHeader).forEach(function (k) { headers[k] = authHeader[k]; });
    options.headers = headers;
    return fetch(url, options);
  }

  // ---------------- opções de filtro carregadas ao vivo do Notion ----------------
  // Pra filtros de propriedades com uma lista de opções que cresce com o
  // tempo (ex: "🏷️ Assuntos (PMF)", já com 90+ tags e crescendo) não dá pra
  // fixar as opções no config.js — ficaria desatualizado. Em vez disso, um
  // filtro pode ter "optionsFrom: { database_id, property }" (em vez de
  // "options" fixo): busca a lista de opções (nome + cor) direto do Notion
  // via GET /schema (só leitura) toda vez que a página abre.
  function fetchSchemaOptions(databaseId, propertyName) {
    var url = cfg.templateWorkerUrl + "/schema?database_id=" + encodeURIComponent(databaseId);
    return authFetch(url)
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 401 && window.Auth) { Auth.signOut(); throw new Error("Faça login de novo pra continuar."); }
        if (!result.ok) throw new Error((result.data && result.data.error) || "Falha ao buscar opções");
        var props = (result.data && result.data.properties) || [];
        var propDef = props.filter(function (p) { return p.name === propertyName; })[0];
        var rawOptions = (propDef && propDef.options) || [];
        return rawOptions
          .map(function (o) { return { label: o.name, pageId: o.name, icon: "ti-tag", color: NOTION_COLOR[o.color] || "" }; })
          .sort(function (a, b) { return a.label.localeCompare(b.label, "pt-BR"); });
      });
  }

  // ---------------- criação de página via template (Cloudflare Worker) ----------------
  // Chama o Worker configurado em cfg.templateWorkerUrl, que cria uma página nova no
  // Notion a partir de um template e devolve a URL da página criada.
  function requestTemplatePage(item) {
    return authFetch(cfg.templateWorkerUrl + "/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database_id: item.database_id, template_id: item.template_id })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (res.status === 401 && window.Auth) { Auth.signOut(); throw new Error("Faça login de novo pra continuar."); }
        if (!res.ok) throw new Error((data && data.error) || "Falha ao criar página");
        return data.url;
      });
    });
  }

  // versão com feedback visual (troca o texto do botão por "Criando…" enquanto espera)
  function triggerTemplateCreate(item, containerEl, labelEl) {
    if (containerEl.dataset.loading === "1") return;
    containerEl.dataset.loading = "1";
    var originalText = labelEl ? labelEl.textContent : "";
    if (labelEl) labelEl.textContent = "Criando…";
    containerEl.classList.add("loading");
    requestTemplatePage(item)
      .then(function (url) { window.open(url, "_blank", "noopener"); })
      .catch(function (err) { alert("Não foi possível criar a página: " + err.message); })
      .finally(function () {
        containerEl.dataset.loading = "";
        if (labelEl) labelEl.textContent = originalText;
        containerEl.classList.remove("loading");
      });
  }

  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // Uma página pode ter "items" (lista simples, sem caixa) E/OU "groups"
  // (lista de grupos, cada um com "title" + "items" — caixa visual dentro
  // da MESMA página, sem criar subpáginas). Quando os dois existem juntos,
  // os "items" aparecem soltos no topo e os "groups" aparecem depois, numa
  // linha separadora (ex: Criar páginas → PMF, com "Acesso Rápido" embaixo).
  // Esta função devolve sempre a lista plana de items, na ordem em que
  // aparecem (items soltos primeiro, depois os grupos concatenados).
  function pageItems(page) {
    var out = (page.items || []).slice();
    // "itemGroups" (opcional) — mesma ideia de "items" soltos no topo, só
    // que divididos em pequenos subgrupos rotulados (ex: "Abrir no Notion"
    // / "Criar no Notion"). Entra na indexação igual a "items"/"groups".
    if (page.itemGroups) {
      page.itemGroups.forEach(function (g) {
        (g.items || []).forEach(function (it) { out.push(it); });
      });
    }
    if (page.groups) {
      page.groups.forEach(function (g) {
        (g.items || []).forEach(function (it) { out.push(it); });
      });
    }
    return out;
  }

  // ---- build parent map + search index (guards against cycles) ----
  function buildIndex() {
    parentOf = {};
    flatIndex = [];
    var visited = {};

    function walk(pageId, pathIds, pathTitles) {
      if (visited[pageId]) return;
      visited[pageId] = true;
      var page = cfg.pages[pageId];
      if (!page) return;
      pageItems(page).forEach(function (item) {
        flatIndex.push({
          label: item.label,
          type: item.type,
          url: item.url,
          target: item.target,
          databaseId: item.database_id,
          templateId: item.template_id,
          links: item.links,
          icon: iconFor(item),
          ownerPageId: pageId,
          pathTitles: pathTitles.concat([page.title])
        });
        if (item.type === "page" && cfg.pages[item.target]) {
          if (!(item.target in parentOf)) parentOf[item.target] = pageId;
          walk(item.target, pathIds.concat([item.target]), pathTitles.concat([page.title]));
        }
      });
    }
    walk(cfg.startPage, [cfg.startPage], []);
  }

  function pathToPage(pageId) {
    var chain = [pageId];
    var guard = 0;
    while (parentOf[chain[0]] !== undefined && guard < 50) {
      chain.unshift(parentOf[chain[0]]);
      guard++;
    }
    return chain;
  }

  // keep the path down to the given page visible in the sidebar (its ancestors,
  // plus the page itself so its own children show up too)
  function expandAncestors(pageId) {
    pathToPage(pageId).forEach(function (id) { expandedPages[id] = true; });
  }

  function makeToggle(hasChildren, isOpen, onToggle) {
    var toggle = document.createElement("span");
    toggle.className = "tree-toggle" + (hasChildren ? "" : " empty");
    if (hasChildren) {
      toggle.innerHTML = '<i class="ti ti-chevron-right"></i>';
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("role", "button");
      toggle.setAttribute("aria-label", isOpen ? "Recolher" : "Expandir");
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        onToggle();
      });
    }
    return toggle;
  }

  // ---------------- sidebar tree (collapsible, Explorer-style) ----------------
  function renderTree() {
    var tree = document.getElementById("tree");
    tree.innerHTML = "";
    var rootUl = document.createElement("ul");
    rootUl.appendChild(buildTreeNode(cfg.startPage, {}));
    tree.appendChild(rootUl);
  }

  function buildTreeNode(pageId, visited) {
    var page = cfg.pages[pageId];
    var li = document.createElement("li");
    if (!page || visited[pageId]) return li;
    visited = Object.assign({}, visited);
    visited[pageId] = true;

    var childItems = pageItems(page);
    var hasContent = childItems.length > 0;
    var subfolders = childItems.filter(function (item) {
      return item.type === "page" && cfg.pages[item.target];
    });
    var hasSubfolders = subfolders.length > 0;
    var isOpen = !!expandedPages[pageId];

    var row = document.createElement("div");
    row.className = "tree-row" + (pageId === currentId ? " active" : "");
    row.appendChild(makeToggle(hasSubfolders, isOpen, function () {
      expandedPages[pageId] = !expandedPages[pageId];
      renderTree();
    }));
    // o nome da pasta é um <a href="#pageId"> de verdade (não uma div/botão
    // com só onclick) — assim o navegador trata nativamente Ctrl/Cmd+clique,
    // clique do meio e "Abrir link em nova aba" do menu de botão direito.
    // Clique normal (botão esquerdo, sem modificador) continua fazendo a
    // navegação client-side de sempre, via preventDefault + navigate().
    var link = document.createElement("a");
    link.className = "tree-row-link";
    link.href = "#" + pageId;
    var icon = document.createElement("i");
    if (page.dynamicQuery || page.dynamicQueries) {
      icon.className = "ti ti-calendar-event";
    } else {
      icon.className = "ti ti-folder" + (hasContent ? "" : " icon-empty");
    }
    link.appendChild(icon);
    var label = document.createElement("span");
    label.textContent = page.title;
    link.appendChild(label);
    link.addEventListener("click", function (e) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(pageId);
    });
    row.appendChild(link);
    li.appendChild(row);

    if (hasSubfolders && isOpen) {
      var ul = document.createElement("ul");
      subfolders.forEach(function (item) {
        ul.appendChild(buildTreeNode(item.target, visited));
      });
      li.appendChild(ul);
    }
    return li;
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ---------------- breadcrumb ----------------
  function renderBreadcrumb() {
    var el = document.getElementById("breadcrumb");
    el.innerHTML = "";
    var chain = pathToPage(currentId);
    chain.forEach(function (id, i) {
      var page = cfg.pages[id];
      if (!page) return;
      var isLast = i === chain.length - 1;
      // o item atual (último) não é link (não tem pra onde ir); os
      // anteriores viram <a href="#id"> de verdade, mesmo motivo do
      // menu lateral — permite Ctrl/Cmd+clique abrir em nova aba.
      var span = document.createElement(isLast ? "span" : "a");
      span.className = "crumb" + (isLast ? " current" : "");
      span.textContent = page.title;
      if (!isLast) {
        span.href = "#" + id;
        span.addEventListener("click", function (e) {
          if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate(id);
        });
      }
      el.appendChild(span);
      if (i !== chain.length - 1) {
        var sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "/";
        el.appendChild(sep);
      }
    });
  }

  // ---------------- single button/link element for one item ----------------
  function buildItemEl(item, idx) {
    var el;
    if (item.type === "notion") {
      el = document.createElement("a");
      if (item.url) {
        el.href = item.url;
        el.target = "_blank";
        el.rel = "noopener";
      } else {
        // botão "reservado" pra um link que ainda vai ser preenchido (ex:
        // "Central" em Contratos) — fica visível na tela, mas sem clicar
        // em nada, em vez de virar um link quebrado ou recarregar a página.
        el.href = "#";
        el.classList.add("item-pending");
        el.title = "Link ainda não definido";
        el.addEventListener("click", function (e) { e.preventDefault(); });
      }
    } else if (item.type === "notion-template") {
      el = document.createElement("button");
    } else {
      // botão de pasta/subpágina interna — <a href="#target"> de verdade
      // (mesmo motivo do menu lateral): clique normal continua SPA, mas
      // Ctrl/Cmd+clique, clique do meio e "abrir em nova aba" passam a
      // funcionar nativamente.
      el = document.createElement("a");
      el.href = "#" + item.target;
      el.addEventListener("click", function (e) {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(item.target);
      });
    }
    el.className = "item";
    el.dataset.idx = idx;

    var left = document.createElement("span");
    left.className = "item-left";
    var icon;
    if (item.icon && IMG_ICONS[item.icon]) {
      // logo real (ex: cubo do Notion) em vez de um ícone Tabler genérico —
      // mesmo tratamento visual usado nos botões de Legislações.
      icon = document.createElement("img");
      icon.className = "item-icon-img";
      icon.src = IMG_ICONS[item.icon];
      icon.alt = "";
      icon.width = 18;
      icon.height = 18;
    } else {
      icon = document.createElement("i");
      icon.className = "item-icon ti " + iconFor(item);
    }
    var label = document.createElement("span");
    label.className = "item-label";
    label.textContent = item.label;
    left.appendChild(icon);

    // "item.sub" (opcional) — lista de badges pra mostrar numa linha abaixo
    // do label (ex: data/hora da reunião, status de andamento colorido).
    // Usado pelos resultados de "dynamicQuery"/"dynamicQueries" com
    // "cardFields" configurado — nunca vem de "items" normais do config.js.
    if (item.sub && item.sub.length) {
      var textCol = document.createElement("span");
      textCol.className = "item-text";
      textCol.appendChild(label);
      var subRow = document.createElement("span");
      subRow.className = "item-sub";
      item.sub.forEach(function (s) {
        var badge = document.createElement("span");
        badge.className = s.stacked ? "item-sub-badge item-sub-badge-stacked" : "item-sub-badge";
        if (s.color) badge.style.color = s.color;
        badge.textContent = s.text;
        // se o texto for cortado (ellipsis) por ser muito longo, o título
        // completo ainda aparece passando o mouse por cima. Badges
        // "stacked" (ver buildCardSub) não cortam — não precisam do title,
        // mas não custa deixar por consistência.
        badge.title = s.text;
        subRow.appendChild(badge);
      });
      textCol.appendChild(subRow);
      left.appendChild(textCol);
      el.classList.add("has-sub");
    } else {
      left.appendChild(label);
    }

    if (item.type === "notion-template") {
      el.addEventListener("click", function () { triggerTemplateCreate(item, el, label); });
    }

    var right = document.createElement("span");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";
    if (idx < 9) {
      var kbd = document.createElement("span");
      kbd.className = "kbd-num";
      kbd.textContent = String(idx + 1);
      right.appendChild(kbd);
    }
    var chevron = document.createElement("i");
    chevron.className = "item-chevron ti " + (
      item.type === "notion" ? "ti-external-link" :
      item.type === "notion-template" ? "ti-file-plus" : "ti-chevron-right"
    );
    right.appendChild(chevron);

    el.appendChild(left);
    el.appendChild(right);
    return el;
  }

  // ---------------- dropdown customizado com ícone (select nativo não mostra ícone) ----------------
  // filterDef: { property, type, condition, label, options: [{label, pageId, icon, color}],
  //              multi (opcional, default true), default (opcional, pageId de 1 opção) }
  // Por padrão permite marcar VÁRIAS opções ao mesmo tempo (clique liga/desliga
  // e o menu continua aberto) — onChange(opts) é sempre chamado com a LISTA de
  // opções marcadas (array vazio = "Todos"). Use "multi: false" pra voltar ao
  // comportamento de seleção única (1 clique escolhe e fecha o menu) — é o
  // caso do LIMIT_FILTER, onde marcar mais de um valor não faz sentido.
  function buildIconDropdown(filterDef, onChange) {
    var multi = filterDef.multi !== false;
    var wrap = document.createElement("div");
    wrap.className = "filter-dropdown";

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "filter-trigger";

    var triggerIcon = document.createElement("i");
    triggerIcon.className = "ti ti-filter";
    var triggerLabel = document.createElement("span");
    triggerLabel.textContent = filterDef.label + ": Todos";
    var chevron = document.createElement("i");
    chevron.className = "ti ti-chevron-down";

    trigger.appendChild(triggerIcon);
    trigger.appendChild(triggerLabel);
    trigger.appendChild(chevron);

    var menu = document.createElement("div");
    menu.className = "filter-menu";

    var selected = []; // opções marcadas no momento
    var rowEntries = []; // [{ opt, row }] — pra marcar/desmarcar visualmente

    // "filterDef.andOrToggle" (opcional) — pra filtros de seleção múltipla
    // onde faz sentido escolher se 2+ opções marcadas devem bater com
    // QUALQUER uma delas ("OU", padrão) ou com TODAS ao mesmo tempo ("E").
    // Hoje só usado no filtro de Assuntos. "mode" começa sempre em "or" ao
    // abrir a página — é um ajuste pontual daquela pesquisa, não é lembrado.
    var mode = "or";

    // só atualiza a aparência do botão (ícone/cor/texto): nenhuma marcada =
    // "Todos"; 1 marcada = ícone/cor/label dela; 2+ marcadas = "N selecionados"
    // (não dá pra mostrar um ícone/cor só quando são de status diferentes).
    function updateTriggerUI() {
      if (!selected.length) {
        triggerIcon.className = "ti ti-filter";
        triggerIcon.style.color = "";
        triggerLabel.textContent = filterDef.label + ": Todos";
      } else if (selected.length === 1) {
        triggerIcon.className = "ti " + selected[0].icon;
        triggerIcon.style.color = selected[0].color || "";
        triggerLabel.textContent = filterDef.label + ": " + selected[0].label;
      } else {
        triggerIcon.className = "ti ti-filter";
        triggerIcon.style.color = "";
        triggerLabel.textContent = filterDef.label + ": " + selected.length + " selecionados" + (mode === "and" ? " (E)" : "");
      }
    }

    function updateRowsUI() {
      rowEntries.forEach(function (entry) {
        entry.row.classList.toggle("selected", selected.indexOf(entry.opt) !== -1);
      });
    }

    // "filterDef.searchable" — filtros com MUITAS opções (ex: Assuntos, 90+
    // tags): depois de marcar uma opção lá embaixo na lista, ela sobe pro
    // topo (logo abaixo da caixa de busca/"Todos"), junto das outras já
    // marcadas — assim dá pra ver e desmarcar sem precisar rolar a lista de
    // novo. Reordena o DOM de verdade (appendChild move o nó existente),
    // mantendo a ordem original dentro de cada grupo (marcadas / não
    // marcadas). Só roda nesses filtros — nos demais (poucas opções) a
    // ordem sempre igual à do config.js é mais previsível.
    function reorderRows() {
      if (!filterDef.searchable) return;
      var selectedEntries = [];
      var restEntries = [];
      rowEntries.forEach(function (entry) {
        entry.row.classList.remove("filter-option-divider");
        (selected.indexOf(entry.opt) !== -1 ? selectedEntries : restEntries).push(entry);
      });
      selectedEntries.concat(restEntries).forEach(function (entry) {
        menu.appendChild(entry.row);
      });
      // linha separando o "grupo de marcadas" (agora no topo) do resto da
      // lista — só aparece quando há as duas coisas ao mesmo tempo.
      if (selectedEntries.length && restEntries.length) {
        selectedEntries[selectedEntries.length - 1].row.classList.add("filter-option-divider");
      }
    }

    function setSelected(next) {
      selected = next;
      updateTriggerUI();
      updateRowsUI();
      reorderRows();
      // manda a lista de opções inteira (não só o pageId) — assim quem
      // escuta pode usar opt.condition/opt.value pra sobrescrever o filtro
      // padrão (necessário pros filtros de data relativa: cada opção tem
      // sua própria condition, ex: "equals" pra Hoje/Amanhã, "next_week"
      // pra Esta semana). "mode" ("or"/"and") vai pendurado na própria
      // lista — filterStateFromOpts lê "opts.mode" pra decidir orPairs x
      // andPairs sem precisar mudar a assinatura de onChange em quem chama.
      var arr = selected.slice();
      arr.mode = mode;
      onChange(arr);
    }

    // "filterDef.searchable" (opcional) — pra filtros com MUITAS opções (ex:
    // "Assuntos", 90+ tags), mostra uma caixa de texto no topo do dropdown
    // que esconde/mostra as linhas conforme o usuário digita (comparação
    // sem acento/maiúscula, igual a busca geral do app). Depois de marcar
    // uma opção, a caixa limpa sozinha e a lista volta a mostrar tudo — pra
    // digitar o próximo termo sem precisar apagar o anterior na mão.
    var searchBox = null;
    if (filterDef.searchable) {
      var searchWrap = document.createElement("div");
      searchWrap.className = "filter-search-wrap";
      var searchIcon2 = document.createElement("i");
      searchIcon2.className = "ti ti-search";
      searchBox = document.createElement("input");
      searchBox.type = "text";
      searchBox.className = "filter-search-input";
      searchBox.placeholder = "Buscar " + (filterDef.label || "").toLowerCase() + "…";
      searchWrap.appendChild(searchIcon2);
      searchWrap.appendChild(searchBox);
      menu.appendChild(searchWrap);
      searchBox.addEventListener("click", function (e) { e.stopPropagation(); });
      searchBox.addEventListener("input", function () { filterRows(searchBox.value); });
    }

    function filterRows(query) {
      var nq = normalize(query).trim();
      rowEntries.forEach(function (entry) {
        var match = !nq || normalize(entry.opt.label).indexOf(nq) !== -1;
        entry.row.style.display = match ? "" : "none";
      });
    }

    var allRow = document.createElement("div");
    allRow.className = "filter-option filter-option-all";
    var allLabel = document.createElement("span");
    allLabel.textContent = "Todos";
    allRow.appendChild(allLabel);
    allRow.addEventListener("click", function (e) {
      e.stopPropagation(); // não deixa o listener global (fecha menus abertos) atrapalhar
      menu.classList.remove("open");
      setSelected([]);
    });

    // "filterDef.andOrToggle" — botão discreto do lado direito da linha
    // "Todos" pra alternar, só naquela pesquisa/naquele dropdown, se 2+
    // opções marcadas devem bater com QUALQUER uma ("OU", padrão) ou com
    // TODAS ao mesmo tempo ("E"). stopPropagation pra não disparar o clique
    // da linha "Todos" (que zeraria a seleção) nem fechar o menu.
    if (filterDef.andOrToggle) {
      var modeBtn = document.createElement("button");
      modeBtn.type = "button";
      modeBtn.className = "filter-mode-toggle";
      modeBtn.textContent = "OU";
      modeBtn.title = "Alternar: OU (qualquer opção marcada) / E (todas ao mesmo tempo)";
      modeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        mode = mode === "or" ? "and" : "or";
        modeBtn.textContent = mode === "and" ? "E" : "OU";
        modeBtn.classList.toggle("mode-and", mode === "and");
        updateTriggerUI();
        if (selected.length > 1) {
          var arr = selected.slice();
          arr.mode = mode;
          onChange(arr);
        }
      });
      allRow.appendChild(modeBtn);
    }

    menu.appendChild(allRow);

    (filterDef.options || []).forEach(function (opt) {
      var row = document.createElement("div");
      row.className = "filter-option";
      var ic = document.createElement("i");
      ic.className = "ti " + opt.icon;
      ic.style.color = opt.color || "";
      var lbl = document.createElement("span");
      lbl.textContent = opt.label;
      row.appendChild(ic);
      row.appendChild(lbl);
      if (multi) {
        var check = document.createElement("i");
        check.className = "ti ti-check filter-option-check";
        row.appendChild(check);
      }
      row.addEventListener("click", function (e) {
        e.stopPropagation(); // não deixa o listener global (fecha menus abertos) atrapalhar
        if (multi) {
          var idx = selected.indexOf(opt);
          var next = selected.slice();
          if (idx === -1) next.push(opt); else next.splice(idx, 1);
          setSelected(next);
          // menu continua aberto — dá pra marcar mais de uma opção seguida
          if (searchBox) {
            searchBox.value = "";
            filterRows("");
            searchBox.focus();
          }
        } else {
          menu.classList.remove("open");
          setSelected([opt]);
        }
      });
      menu.appendChild(row);
      rowEntries.push({ opt: opt, row: row });
    });

    // "filterDef.default" (opcional) — pageId de UMA opção, OU lista de
    // pageIds (array) pra marcar VÁRIAS de uma vez, já vindo marcado quando
    // a página abre (ex: "Últimas Reuniões" já abre com "Última semana";
    // "Situação" em Contratos já abre com "Em licitação" + "Vigente"). Só
    // atualiza a aparência aqui — quem chama essa função já seeda o filtro
    // real antes da 1ª busca.
    if (filterDef.default) {
      var defIds = Array.isArray(filterDef.default) ? filterDef.default : [filterDef.default];
      var defOpts = (filterDef.options || []).filter(function (o) { return defIds.indexOf(o.pageId) !== -1; });
      if (defOpts.length) { selected = defOpts; updateTriggerUI(); updateRowsUI(); reorderRows(); }
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    return wrap;
  }

  // filtro de intervalo de data — usado pelos campos "date"/"created_time"/
  // "last_edited_time" (ex: Data/Prazo, Data de Conclusão, Data de Criação,
  // Última edição na busca de Central em Início). Mesmo visual/mecanismo do
  // buildIconDropdown (botão + menu suspenso, mesmas classes CSS), só que
  // com 2 campos de data (De/Até) em vez de lista de opções. Só "De"
  // preenchido = data fixa (equals); só "Até" = data fixa também; os dois
  // juntos = intervalo (on_or_after De + on_or_before Até, combinados com
  // "e"). O objeto montado em onChange já sai no formato
  // { type, property, mode, pairs } que filterStateToFilterEntry espera —
  // mesmo "contrato" que filterStateFromOpts produz pros filtros de opção,
  // por isso runQuery() não precisa saber a diferença.
  function buildDateRangeFilter(filterDef, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "filter-dropdown";

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "filter-trigger";
    var triggerIcon = document.createElement("i");
    triggerIcon.className = "ti ti-calendar";
    var triggerLabel = document.createElement("span");
    triggerLabel.textContent = filterDef.label + ": Todos";
    var chevron = document.createElement("i");
    chevron.className = "ti ti-chevron-down";
    trigger.appendChild(triggerIcon);
    trigger.appendChild(triggerLabel);
    trigger.appendChild(chevron);

    var menu = document.createElement("div");
    menu.className = "filter-menu filter-date-menu";

    function makeRow(labelText) {
      var row = document.createElement("label");
      row.className = "filter-date-row";
      var lbl = document.createElement("span");
      lbl.textContent = labelText;
      var input = document.createElement("input");
      input.type = "date";
      input.className = "filter-date-input";
      row.appendChild(lbl);
      row.appendChild(input);
      row.addEventListener("click", function (e) { e.stopPropagation(); });
      menu.appendChild(row);
      return input;
    }

    var fromInput = makeRow("De");
    var toInput = makeRow("Até");

    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "filter-date-clear";
    clearBtn.textContent = "Limpar";
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      fromInput.value = "";
      toInput.value = "";
      menu.classList.remove("open");
      emit();
    });
    menu.appendChild(clearBtn);

    function fmtBR(iso) {
      var parts = iso.split("-");
      return parts.length === 3 ? parts[2] + "/" + parts[1] : iso;
    }

    function emit() {
      var from = fromInput.value;
      var to = toInput.value;
      if (!from && !to) {
        triggerIcon.style.color = "";
        triggerLabel.textContent = filterDef.label + ": Todos";
        onChange(null);
        return;
      }
      var pairs;
      if (from && to) {
        pairs = [{ condition: "on_or_after", value: from }, { condition: "on_or_before", value: to }];
        triggerLabel.textContent = filterDef.label + ": " + fmtBR(from) + "–" + fmtBR(to);
      } else {
        var only = from || to;
        pairs = [{ condition: "equals", value: only }];
        triggerLabel.textContent = filterDef.label + ": " + fmtBR(only);
      }
      triggerIcon.style.color = "#4a90d9";
      onChange({ type: filterDef.type, property: filterDef.property, mode: "and", pairs: pairs });
    }

    fromInput.addEventListener("change", emit);
    toInput.addEventListener("change", emit);

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    return wrap;
  }

  document.addEventListener("click", function () {
    document.querySelectorAll(".filter-menu.open").forEach(function (m) { m.classList.remove("open"); });
  });
  // fecha qualquer dropdown de filtro aberto ao rolar (a página OU um
  // container com scroll próprio, ex: ".priorities-table-wrap") — sem isso,
  // um menu posicionado como "fixed" (ver buildMultiCheckDropdown, usado na
  // Lista de Prioridades) ficaria "descolado" do botão que o abriu depois
  // de rolar. "capture: true" pega o evento mesmo vindo de um scroll
  // interno (esses não borbulham (bubble) até o document normalmente).
  document.addEventListener("scroll", function (e) {
    document.querySelectorAll(".filter-menu.open").forEach(function (m) {
      // rolando a própria lista de opções (".filter-menu" tem overflow-y:
      // auto, pra listas compridas tipo Forma) NÃO deve fechar o menu — só
      // rolagem de FORA dele (a página, ou ".priorities-table-wrap") deve.
      // "m.contains(e.target)" cobre os dois casos de dentro (o scroll
      // dispara com e.target = o próprio ".filter-menu", já que é ele quem
      // tem a barra de rolagem).
      if (m.contains(e.target)) return;
      m.classList.remove("open");
    });
  }, true);

  // ---------------- helpers pra montar filtros a partir de um buildIconDropdown ----------------
  // buildIconDropdown sempre devolve a LISTA de opções marcadas (0, 1 ou
  // várias). Esses dois helpers convertem essa lista no formato guardado no
  // filterState de cada página (property -> { type, pairs }) e depois no
  // formato de filtro mandado ao Worker — 1 par vira um filtro simples, 2+
  // vira "orPairs" (o Worker combina com "or").

  // opts vazio/null → null (remove o filtro); senão → { type, pairs }
  // "formulaType"/"rollupTargetType" (quando o filtro tiver) são copiados
  // aqui pra sobreviverem até virar a entrada mandada pro Worker — sem isso,
  // filtros de fórmula/rollup até funcionam por coincidência (o worker.js
  // usa "string"/"multi_select" como padrão), mas quebrariam silenciosamente
  // pra qualquer fórmula/rollup de outro tipo.
  function filterStateFromOpts(f, opts) {
    if (!opts || !opts.length) return null;
    return {
      type: f.type,
      formulaType: f.formulaType,
      rollupTargetType: f.rollupTargetType,
      // "f.property" viaja aqui dentro pra filterStateToFilterEntry poder
      // usar o property REAL do Notion, em vez da chave usada só pra guardar
      // esse estado no mapa "filterState" (ver "f.stateKey" abaixo) — sem
      // isso, dois filtros diferentes que miram a MESMA propriedade do
      // Notion (ex: "Categoria" e "Página de Origem", ambos sobre "📚
      // Página de Origem" em Atrasados e Prioritários) se sobrescreveriam
      // um ao outro no mapa.
      property: f.property,
      // "opts.mode" ("or"/"and") vem pendurado na lista por buildIconDropdown
      // quando o filtro tem "andOrToggle" — default "or" pros demais filtros
      // (Andamento, Prioridade etc.), que continuam sempre "qualquer uma".
      mode: opts.mode || "or",
      // cada opção normalmente vira 1 par — MAS uma opção pode trazer sua
      // própria lista "pairs" (ex: "Categoria: PMF" expande pra várias
      // "📚 Página de Origem" reais, combinadas com "ou" por trás); nesse
      // caso todos os pares dela entram soltos na lista final.
      pairs: opts.reduce(function (acc, o) {
        if (Array.isArray(o.pairs)) {
          o.pairs.forEach(function (p) { acc.push({ condition: p.condition || f.condition, value: p.value }); });
        } else {
          acc.push({ condition: o.condition || f.condition, value: o.value !== undefined ? o.value : o.pageId });
        }
        return acc;
      }, [])
    };
  }

  // { type, pairs, mode, property } de um item do filterState → entrada da
  // lista "filters" do Worker. 1 par vira filtro simples; 2+ vira "orPairs"
  // (qualquer um bate) ou "andPairs" (todos precisam bater), conforme
  // "mode". "stateKey" é a chave usada no mapa "filterState" (pra não
  // colidir quando 2 filtros miram a mesma propriedade do Notion) — o
  // property de verdade mandado pro Worker é sempre "fs.property" (cai de
  // volta pro "stateKey" nos filtros antigos, onde os dois sempre foram
  // iguais).
  function filterStateToFilterEntry(stateKey, fs) {
    var out = { property: fs.property || stateKey, type: fs.type };
    if (fs.formulaType) out.formulaType = fs.formulaType;
    if (fs.rollupTargetType) out.rollupTargetType = fs.rollupTargetType;
    if (fs.pairs.length === 1) {
      out.condition = fs.pairs[0].condition;
      out.value = fs.pairs[0].value;
    } else if (fs.mode === "and") {
      out.andPairs = fs.pairs;
    } else {
      out.orPairs = fs.pairs;
    }
    return out;
  }

  // ---------------- página de busca dinâmica (ex: "Hoje") ----------------
  // Em vez de "items" fixos no config.js, a página tem um "dynamicQuery" que
  // busca no Worker (rota /query) as páginas do Notion que baterem com os
  // filtros (ex: campo de data = hoje, + filtros extras escolhidos na tela).
  // Refaz a busca toda vez que a página é aberta ou um filtro muda.
  function renderDynamicQuery(page, pageId, container) {
    var q = page.dynamicQuery;
    var filterState = {}; // property -> { type, pairs: [{condition,value}, ...] }

    if (q.filters && q.filters.length) {
      var filterBar = document.createElement("div");
      filterBar.className = "filter-bar";
      q.filters.forEach(function (f) {
        filterBar.appendChild(buildIconDropdown(f, function (opts) {
          var fs = filterStateFromOpts(f, opts);
          var key = f.stateKey || f.property;
          if (fs) filterState[key] = fs;
          else delete filterState[key];
          runQuery();
        }));
      });
      container.appendChild(filterBar);
    }

    var resultsWrap = document.createElement("div");
    container.appendChild(resultsWrap);

    function runQuery() {
      resultsWrap.innerHTML = "";
      var loading = document.createElement("p");
      loading.className = "empty";
      loading.textContent = "Buscando…";
      resultsWrap.appendChild(loading);

      var filters = (q.baseFilters || []).map(function (f) { return f; });
      Object.keys(filterState).forEach(function (prop) {
        filters.push(filterStateToFilterEntry(prop, filterState[prop]));
      });

      var url = cfg.templateWorkerUrl + "/query?database_id=" + encodeURIComponent(q.database_id) +
        "&filters=" + encodeURIComponent(JSON.stringify(filters));

      authFetch(url)
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); })
        .then(function (result) {
          if (currentId !== pageId) return; // usuário já navegou pra outro lugar enquanto buscava
          resultsWrap.innerHTML = "";
          // login expirado/inválido — volta pra tela de login em vez de
          // mostrar "falha ao buscar" (que pareceria um erro de rede).
          if (result.status === 401 && window.Auth) { Auth.signOut(); return; }
          if (!result.ok) throw new Error((result.data && result.data.error) || "Falha ao buscar");
          var pages = result.data.pages || [];
          if (!pages.length) {
            var empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "Nada encontrado.";
            resultsWrap.appendChild(empty);
            return;
          }
          pages.forEach(function (p, idx) {
            resultsWrap.appendChild(buildItemEl({ label: p.title, type: "notion", url: p.url }, idx));
          });
        })
        .catch(function (err) {
          if (currentId !== pageId) return;
          resultsWrap.innerHTML = "";
          var errEl = document.createElement("p");
          errEl.className = "empty";
          errEl.textContent = "Erro ao buscar: " + err.message;
          resultsWrap.appendChild(errEl);
        });
    }

    runQuery();
  }

  // ---------------- "cardFields": subtítulo (data/hora, status) nos cards de resultado ----------------
  // Transforma o "extra" que o Worker devolve (valores crus de propriedades
  // do Notion) em texto pronto pra exibir. Só leitura — nada disso escreve
  // no Notion, é só formatação do que já veio na busca.

  // formata um valor de campo "date" do Notion (extra) como "dd/mm hh:mm →
  // hh:mm" — mostra hora só se o campo realmente tiver hora (não só data).
  // Campo só com data (sem "T" na string) é tratado como UTC na formatação
  // (em vez do fuso de São Paulo) — datas "soltas" do Notion não têm hora
  // de verdade, então convertê-las pro fuso de SP às vezes "volta um dia"
  // (ex: meia-noite UTC vira 21h do dia anterior em SP).
  function formatDateRangeExtra(val) {
    if (!val || !val.start) return null;
    var startHasTime = val.start.indexOf("T") !== -1;
    var fmtDateTZ = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
    var fmtTimeTZ = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    var fmtDateUTC = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
    var start = new Date(val.start);
    var text = startHasTime ? fmtDateTZ.format(start) : fmtDateUTC.format(start);
    if (startHasTime) text += " " + fmtTimeTZ.format(start);
    if (val.end) {
      var end = new Date(val.end);
      var endHasTime = val.end.indexOf("T") !== -1;
      if (endHasTime) text += " → " + fmtTimeTZ.format(end);
    }
    return text;
  }

  // acha, numa lista mestre (cfg.andamentoOptions, cfg.prioridadeOptions...),
  // o status que bate com os ids devolvidos por um campo "relation" (extra)
  // — pra pegar rótulo/cor. O Notion devolve o id de uma relação SEMPRE com
  // hífen (formato UUID), mas os "pageId" salvos em config.js vieram sem
  // hífen (copiados da URL do Notion, que omite os hífens) — por isso
  // compara sem hífen dos dois lados, senão nunca bate.
  function stripDashes(id) { return (id || "").replace(/-/g, ""); }
  function findRelationOption(ids, list) {
    if (!ids || !ids.length || !list) return null;
    var normIds = ids.map(stripDashes);
    for (var i = 0; i < list.length; i++) {
      if (normIds.indexOf(stripDashes(list[i].pageId)) !== -1) return list[i];
    }
    return null;
  }
  // formata só a data (dia/mês/ANO) de um valor { start, end } — usado pra
  // juntar DUAS propriedades de data separadas num intervalo só (ex: "Prazo
  // Inicial" + "Prazo Final" de um Contrato), diferente de
  // formatDateRangeExtra (que mostra dia/mês só, pensado pra prazos dentro
  // do mesmo ano — aqui o intervalo pode passar de um ano pro outro).
  function formatDateOnlyExtra(val) {
    if (!val || !val.start) return null;
    var fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
    return fmt.format(new Date(val.start));
  }

  function findAndamentoOption(ids) { return findRelationOption(ids, cfg.andamentoOptions); }
  function findPrioridadeOption(ids) { return findRelationOption(ids, cfg.prioridadeOptions); }

  // cores nomeadas do Notion (campos "select"/"multi_select") traduzidas
  // pra hex — usado só pra colorir o selo de um cardField tipo "select"
  // (ex: "🧾 Origem"), já que a API do Notion devolve o NOME da cor, não o
  // valor hex.
  var NOTION_COLOR = {
    default: "#8a8a86", gray: "#9b9a97", brown: "#8d6e5c", orange: "#d9730d",
    yellow: "#cb9a08", green: "#448361", blue: "#3b82c4", purple: "#9065b0",
    pink: "#c14c8a", red: "#d44c47"
  };

  // monta a lista "sub" (badges) de um card a partir de qDef.cardFields +
  // p.extra (devolvido pelo Worker quando a busca pede "extra=[...]").
  function buildCardSub(cardFields, extra) {
    var sub = [];
    if (!cardFields || !extra) return sub;
    cardFields.forEach(function (cf) {
      var raw = extra[cf.property];
      if (cf.type === "date") {
        var text = formatDateRangeExtra(raw);
        if (text) sub.push({ text: text });
      } else if (cf.type === "date-range-pair") {
        // junta DUAS propriedades de data (cf.property = início, cf.property2
        // = fim) num badge só "dd/mm/aaaa - dd/mm/aaaa" — ex: "Prazo Inicial"
        // + "Prazo Final" de um Contrato (datas separadas no Notion, não um
        // único campo de intervalo).
        var d1 = formatDateOnlyExtra(raw);
        var d2 = formatDateOnlyExtra(extra[cf.property2]);
        if (d1 && d2) sub.push({ text: d1 + " - " + d2 });
        else if (d1) sub.push({ text: d1 });
        else if (d2) sub.push({ text: d2 });
      } else if (cf.type === "relation" && cf.lookup === "andamento") {
        var opt = findAndamentoOption(raw);
        if (opt) sub.push({ text: opt.label, color: opt.color });
      } else if (cf.type === "relation" && cf.lookup === "prioridade") {
        var pOpt = findPrioridadeOption(raw);
        if (pOpt) sub.push({ text: pOpt.label, color: pOpt.color });
      } else if (cf.type === "select") {
        if (raw && raw.name) sub.push({ text: raw.name, color: NOTION_COLOR[raw.color] || "" });
      } else if (cf.type === "rollup") {
        // rollup de relação (ex: "Providência TAT - Sessões"/"...Processos",
        // "🏷️ Assuntos (PMF)") — vem como array (0..N itens relacionados).
        // Cada item pode ser um valor "select" direto ({name,color}) OU, se
        // o campo de origem for "multi_select" (ex: "Providência TAT -
        // Sessões", ou "🏷️ Assuntos (PMF)" — cada Legislação pode ter várias
        // tags), vem como um array aninhado de {name,color}. Achata os dois
        // formatos e junta TODOS os valores não vazios num badge só (igual
        // ao badge de "multi_select" abaixo) — mostrar só o 1º bastava pra
        // Providência TAT (sempre 1 valor na prática), mas não pra Assuntos.
        var ruArr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        var ruFlat = [];
        ruArr.forEach(function (v) {
          if (Array.isArray(v)) ruFlat = ruFlat.concat(v);
          else if (v) ruFlat.push(v);
        });
        if (ruFlat.length) {
          if (cf.stacked) {
            // "stacked" (ex: "📖 Contrato" em Contratos, quase sempre com 2
            // valores marcados) — em vez de juntar tudo num badge só (que
            // cortava/estourava a largura do card), 1 badge POR valor, cada
            // um na sua própria linha (ver .item-sub-badge-stacked no CSS).
            ruFlat.forEach(function (v) {
              if (v && v.name) sub.push({ text: v.name, color: NOTION_COLOR[v.color] || "", stacked: true });
            });
          } else {
            var ruNames = ruFlat.map(function (v) { return v.name; }).filter(Boolean).join(", ");
            if (ruNames) sub.push({ text: ruNames, color: NOTION_COLOR[ruFlat[0].color] || "" });
          }
        }
      } else if (cf.type === "formula") {
        // valor de uma fórmula "string" (ex: "⭐ Focus") — já vem como texto
        // puro (não pageId), então a cor sai batendo o texto direto contra
        // "cfg.focusOptions" (ver config.js), sem precisar de lookup por id
        // como Andamento/Prioridade acima.
        if (raw) {
          var focusOpt = (cfg.focusOptions || []).filter(function (o) { return o.label === raw; })[0];
          sub.push({ text: raw, color: focusOpt ? focusOpt.color : "" });
        }
      } else if (cf.type === "multi_select") {
        // ex: "📖 Processo/Chamado" em Betha — array de {name,color}; junta
        // todas as tags marcadas num badge só (na prática quase sempre só
        // 1), com a cor da primeira. "stacked" (ver rollup acima) faz o
        // mesmo tratamento pra esse tipo, se precisar no futuro.
        if (raw && raw.length) {
          if (cf.stacked) {
            raw.forEach(function (v) {
              if (v && v.name) sub.push({ text: v.name, color: NOTION_COLOR[v.color] || "", stacked: true });
            });
          } else {
            var names = raw.map(function (v) { return v.name; }).filter(Boolean).join(", ");
            if (names) sub.push({ text: names, color: NOTION_COLOR[raw[0].color] || "" });
          }
        }
      }
    });
    return sub;
  }

  // ---------------- várias exibições fixas numa página (ex: Reuniões) ----------------
  // Diferente de "dynamicQuery" (uma busca só, com filtros escolhidos na
  // tela), "dynamicQueries" é uma LISTA de buscas prontas (baseFilters +
  // sorts fixos), cada uma com seu título. Cada exibição pode opcionalmente
  // ter seu próprio "filters" (dropdown com ícone, igual ao de "dynamicQuery")
  // — ex: um filtro de intervalo de data em "Próximas/Últimas Reuniões".
  // Cada opção do dropdown pode sobrescrever a condition/value do filtro
  // (ex: "Esta semana" usa condition "next_week" com value {} em vez de uma
  // data específica). Sempre GET /query — nunca escreve nada no Notion.
  //
  // Se algum filtro tiver "optionsFrom" (em vez de "options" fixo — ver
  // fetchSchemaOptions acima), busca a lista de opções ao vivo ANTES de
  // montar a exibição (mostra "Carregando filtros…" nesse meio-tempo).
  // Sem isso, filtrar teria que ficar preso a uma lista fixa no config.js —
  // inviável pra campos com dezenas/centenas de opções que crescem com o
  // tempo (ex: "🏷️ Assuntos (PMF)").
  function renderDynamicQueryBlock(qDef, ownerPageId, container) {
    var pending = (qDef.filters || []).filter(function (f) { return f.optionsFrom && !f.options; });
    if (pending.length) {
      var placeholder = document.createElement("div");
      placeholder.className = "query-block";
      if (qDef.bg) placeholder.style.background = qDef.bg;
      var loadingMsg = document.createElement("p");
      loadingMsg.className = "empty";
      loadingMsg.textContent = "Carregando filtros…";
      placeholder.appendChild(loadingMsg);
      container.appendChild(placeholder);

      Promise.all(pending.map(function (f) {
        return fetchSchemaOptions(f.optionsFrom.database_id, f.optionsFrom.property).then(function (opts) {
          f.options = opts;
        });
      }))
        .then(function () {
          if (currentId !== ownerPageId) return; // já navegou pra outro lugar enquanto buscava
          // insere no lugar EXATO do placeholder (container.insertBefore),
          // em vez de container.appendChild — que jogaria a exibição pro
          // fim de "container", depois de blocos que já tinham sido
          // desenhados de forma síncrona nesse meio-tempo (ex: "groups"/
          // "groupsSectionTitle" logo abaixo, em renderContent). Sem isso,
          // a ordem na tela dependia de quão rápido o /schema respondia —
          // 1ª visita (busca de verdade) caía embaixo, revisita na mesma
          // sessão (opções já em cache no filtro) ficava no lugar certo.
          renderDynamicQueryBlockReady(qDef, ownerPageId, container, placeholder);
          container.removeChild(placeholder);
        })
        .catch(function (err) {
          if (currentId !== ownerPageId) return;
          placeholder.innerHTML = "";
          var errEl = document.createElement("p");
          errEl.className = "empty";
          errEl.textContent = "Não foi possível carregar os filtros: " + err.message;
          placeholder.appendChild(errEl);
        });
      return;
    }
    renderDynamicQueryBlockReady(qDef, ownerPageId, container);
  }

  function renderDynamicQueryBlockReady(qDef, ownerPageId, container, beforeNode) {
    // envolve a exibição inteira (título + filtros + resultados) numa caixa
    // própria — permite colorir o fundo por exibição via "qDef.bg" (ex:
    // Pendentes/Atrasadas/Concluídas em Tarefas, cada uma com uma cor).
    var section = document.createElement("div");
    section.className = "query-block";
    if (qDef.bg) section.style.background = qDef.bg;
    // "beforeNode" (opcional) — quando vem do caminho assíncrono acima,
    // insere no lugar do placeholder em vez de ir pro fim de "container".
    if (beforeNode) container.insertBefore(section, beforeNode);
    else container.appendChild(section);

    var title = document.createElement("h3");
    // exibição com "nameSearch" funciona como um bloco de seção inteiro na
    // página (ex: "Todas as legislações"), não uma caixinha de exibição
    // dentro de outra seção (ex: "Pendentes" em Tarefas) — usa o mesmo
    // estilo maior de ".content-section-title" (ver "groupsSectionTitle"
    // em renderContent) pra manter o mesmo padrão visual entre os dois.
    title.className = qDef.nameSearch ? "content-section-title" : "group-title";
    var titleText = document.createElement("span");
    titleText.textContent = qDef.title;
    title.appendChild(titleText);
    // atalhos (Notion/app) + botão de recolher, os dois juntos num ÚNICO
    // wrapper (".query-title-actions") — ".group-title"/".content-section-
    // title" usam "justify-content:space-between" com só 2 filhos em
    // mente (texto de um lado, ações do outro); com titleLinks e
    // collapseBtn como filhos SEPARADOS do title, o space-between jogava
    // um pra cada canto (esticado, longe do nome). Um wrapper só resolve:
    // title text na ponta esquerda, tudo o mais junto na direita, coladinho.
    var titleActions = null;
    function titleActionsWrap() {
      if (!titleActions) {
        titleActions = document.createElement("span");
        titleActions.className = "query-title-actions";
        title.appendChild(titleActions);
      }
      return titleActions;
    }
    // "qDef.titleLinks" (opcional) — atalhos pequenos ao lado do título da
    // exibição (ex: "📅 Reuniões" em Início ganha um cubo do Notion + um
    // ícone do app, cada um levando pra o lugar de sempre daquele assunto —
    // Notion abre em aba nova, "page" navega dentro do próprio app).
    if (qDef.titleLinks && qDef.titleLinks.length) {
      var titleLinksWrap = document.createElement("span");
      titleLinksWrap.className = "query-title-links";
      qDef.titleLinks.forEach(function (tl) {
        var a = document.createElement("a");
        a.className = "query-title-link";
        a.title = tl.title || "";
        if (tl.type === "notion") {
          a.href = tl.url;
          a.target = "_blank";
          a.rel = "noopener";
          var img = document.createElement("img");
          img.src = IMG_ICONS.notion;
          img.alt = "";
          a.appendChild(img);
        } else {
          a.href = "#" + tl.target;
          a.addEventListener("click", function (e) {
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate(tl.target);
          });
          var ic = document.createElement("i");
          ic.className = "ti ti-apps";
          a.appendChild(ic);
        }
        titleLinksWrap.appendChild(a);
      });
      titleActionsWrap().appendChild(titleLinksWrap);
    }
    // "qDef.collapsible" (opcional) — botão de recolher/expandir só essa
    // exibição, ao lado do título. Junto com "collapseAllQueryBlocks"
    // (botões globais "Recolher tudo"/"Expandir tudo", ver renderContent)
    // e o auto-recolhimento na 1ª busca sem resultado (ver dentro de
    // runQuery mais abaixo). ".query-block-collapsible" marca a seção pra
    // esses botões globais encontrarem via querySelectorAll — sem isso
    // ela é ignorada por eles (mantém o comportamento de sempre nas
    // demais páginas, que não passam "collapsible").
    var collapseBtn = null;
    if (qDef.collapsible) {
      section.classList.add("query-block-collapsible");
      collapseBtn = document.createElement("button");
      collapseBtn.type = "button";
      collapseBtn.className = "query-collapse-btn";
      collapseBtn.setAttribute("aria-label", "Recolher/expandir");
      var collapseIcon = document.createElement("i");
      collapseIcon.className = "ti ti-chevron-down";
      collapseBtn.appendChild(collapseIcon);
      collapseBtn.addEventListener("click", function () {
        var willCollapse = !section.classList.contains("collapsed");
        section.classList.toggle("collapsed", willCollapse);
        collapseIcon.className = willCollapse ? "ti ti-chevron-right" : "ti ti-chevron-down";
      });
      titleActionsWrap().appendChild(collapseBtn);
    }
    section.appendChild(title);

    // tudo que vem depois do título (busca por nome/filtros/resultados)
    // mora dentro de ".query-block-body" — é esse wrapper que
    // "collapsed" (CSS) esconde, deixando só o título+botão visíveis
    // quando a exibição está recolhida.
    var body = document.createElement("div");
    body.className = "query-block-body";
    section.appendChild(body);

    var filterState = {}; // property -> { type, pairs: [{condition,value}, ...] }
    // "type: 'limit'" é diferente dos outros filtros — não é uma condição do
    // Notion, é só quantos cards mostrar. Nunca entra em "filters" enviado
    // ao Worker; corta o array de resultados no cliente, depois de buscar.
    // Sempre single-select (config.js marca "multi: false" nele).
    var displayLimit = null;
    // controla se o auto-recolhimento (vazio = recolhido) já rodou — só
    // na 1ª resposta de runQuery, ver dentro dela mais abaixo.
    var autoCollapseApplied = false;

    // "qDef.nameSearch" (opcional) — junta uma caixa de texto (igual ao
    // "search" de sempre) NA MESMA exibição, em vez de uma caixa de busca
    // separada no fim da página. Fica na mesma linha dos botões de filtro
    // (reaproveita o layout de ".search-block-row") — texto e filtros
    // combinam entre si (E lógico), cumulativo ou alternativo, e a
    // exibição já mostra tudo mesmo sem nada digitado/filtrado (graças ao
    // "baseFilters" sempre-verdadeiro).
    var nameText = "";
    var nameDebounce = null;
    // só cria a linha combinada (".search-block-row") quando a exibição tem
    // "nameSearch" — nas demais páginas (Tarefas/Reuniões/Betha/TAT, sem
    // nameSearch) o filterBar continua exatamente como antes, direto dentro
    // de "section", sem essa caixa extra.
    var row = qDef.nameSearch ? (function () {
      var r = document.createElement("div");
      r.className = "search-block-row";
      body.appendChild(r);
      return r;
    })() : body;

    if (qDef.nameSearch) {
      var nameWrap = document.createElement("div");
      nameWrap.className = "search-field-wrap search-block-input-wrap";
      var nameIcon = document.createElement("i");
      nameIcon.className = "ti ti-search";
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "search-block-input";
      nameInput.placeholder = qDef.nameSearch.placeholder || "Buscar por nome...";
      nameWrap.appendChild(nameIcon);
      nameWrap.appendChild(nameInput);
      row.appendChild(nameWrap);
      nameInput.addEventListener("input", function () {
        nameText = nameInput.value;
        clearTimeout(nameDebounce);
        nameDebounce = setTimeout(runQuery, 350);
      });
    }

    if (qDef.filters && qDef.filters.length) {
      var filterBar = document.createElement("div");
      filterBar.className = "filter-bar" + (qDef.nameSearch ? " search-block-filter-bar" : "");
      qDef.filters.forEach(function (f) {
        if (f.type === "limit") {
          filterBar.appendChild(buildIconDropdown(f, function (opts) {
            var opt = opts && opts[0];
            displayLimit = opt ? parseInt(opt.pageId, 10) : null;
            runQuery();
          }));
          if (f.default) displayLimit = parseInt(f.default, 10);
          return;
        }
        filterBar.appendChild(buildIconDropdown(f, function (opts) {
          var fs = filterStateFromOpts(f, opts);
          var key = f.stateKey || f.property;
          if (fs) filterState[key] = fs;
          else delete filterState[key];
          runQuery();
        }));
        // "f.default" (opcional) — já seeda o filtro real ANTES da 1ª busca,
        // pra a página abrir direto com esse filtro aplicado (ex: "Últimas
        // Reuniões" abre já em "Última semana", sem precisar clicar; ou
        // "Situação" em Contratos, que já abre marcada em "Em licitação" +
        // "Vigente" — nesse caso "default" é uma LISTA de pageIds).
        if (f.default) {
          var defIds = Array.isArray(f.default) ? f.default : [f.default];
          var defOpts = (f.options || []).filter(function (o) { return defIds.indexOf(o.pageId) !== -1; });
          if (defOpts.length) filterState[f.stateKey || f.property] = filterStateFromOpts(f, defOpts);
        }
      });
      row.appendChild(filterBar);
    }

    var resultsWrap = document.createElement("div");
    resultsWrap.className = "content-plain";
    body.appendChild(resultsWrap);

    function runQuery() {
      resultsWrap.innerHTML = "";
      var loading = document.createElement("p");
      loading.className = "empty";
      loading.textContent = "Buscando…";
      resultsWrap.appendChild(loading);

      var filters = (qDef.baseFilters || []).map(function (f) { return f; });
      if (qDef.nameSearch && nameText.trim()) {
        filters.push({
          property: qDef.nameSearch.property, type: qDef.nameSearch.type,
          condition: qDef.nameSearch.condition, value: nameText.trim()
        });
      }
      Object.keys(filterState).forEach(function (prop) {
        filters.push(filterStateToFilterEntry(prop, filterState[prop]));
      });

      var url = cfg.templateWorkerUrl + "/query?database_id=" + encodeURIComponent(qDef.database_id) +
        "&filters=" + encodeURIComponent(JSON.stringify(filters));
      if (qDef.sorts && qDef.sorts.length) {
        url += "&sorts=" + encodeURIComponent(JSON.stringify(qDef.sorts));
      }
      if (qDef.cardFields && qDef.cardFields.length) {
        var extraProps = [];
        // "crossRelation" (opcional em cardFields) — pra campos que não
        // existem na própria Central, só numa página RELACIONADA (ex:
        // "Grupo" mora na base Aniversários, não na Central; chega até um
        // card de Aniversários pela relação "🎉 Aniversários"). Em vez de
        // pedir isso como "extra" normal (que só lê propriedades da própria
        // Central), monta uma lista separada "crossExtra" — o Worker busca
        // a página relacionada e devolve o valor já pronto, no mesmo
        // formato de "extra" de sempre (ver handleQuery em worker.js).
        var crossExtra = [];
        qDef.cardFields.forEach(function (cf) {
          if (cf.crossRelation) {
            crossExtra.push({
              relationProperty: cf.crossRelation.relationProperty,
              targetProperty: cf.crossRelation.targetProperty,
              as: cf.property
            });
            return;
          }
          extraProps.push(cf.property);
          if (cf.property2) extraProps.push(cf.property2); // ex: "date-range-pair" (Prazo Inicial + Prazo Final)
        });
        if (extraProps.length) url += "&extra=" + encodeURIComponent(JSON.stringify(extraProps));
        if (crossExtra.length) url += "&crossExtra=" + encodeURIComponent(JSON.stringify(crossExtra));
      }

      authFetch(url)
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); })
        .then(function (result) {
          if (currentId !== ownerPageId) return; // usuário já navegou pra outro lugar enquanto buscava
          resultsWrap.innerHTML = "";
          // login expirado/inválido — volta pra tela de login em vez de
          // mostrar "falha ao buscar" (que pareceria um erro de rede).
          if (result.status === 401 && window.Auth) { Auth.signOut(); return; }
          if (!result.ok) throw new Error((result.data && result.data.error) || "Falha ao buscar");
          var pages = result.data.pages || [];
          // auto-recolhe/expande só na 1ª busca de verdade (antes de
          // qualquer filtro manual) — exibição vazia (ex: Aniversários
          // sem ninguém fazendo aniversário hoje) já abre recolhida; com
          // algum item, já abre expandida. Trocar um filtro depois NÃO
          // mexe mais nisso — aí quem manda é só o botão (individual ou
          // "Recolher/Expandir tudo").
          if (qDef.collapsible && !autoCollapseApplied) {
            autoCollapseApplied = true;
            var shouldCollapse = pages.length === 0;
            section.classList.toggle("collapsed", shouldCollapse);
            if (collapseBtn) {
              var ic = collapseBtn.querySelector(".ti");
              if (ic) ic.className = shouldCollapse ? "ti ti-chevron-right" : "ti ti-chevron-down";
            }
          }
          if (!pages.length) {
            var empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "Nada encontrado.";
            resultsWrap.appendChild(empty);
            return;
          }
          if (displayLimit) pages = pages.slice(0, displayLimit);
          pages.forEach(function (p) {
            var sub = buildCardSub(qDef.cardFields, p.extra);
            resultsWrap.appendChild(buildItemEl({ label: p.title, type: "notion", url: p.url, sub: sub }, 100));
          });
        })
        .catch(function (err) {
          if (currentId !== ownerPageId) return;
          resultsWrap.innerHTML = "";
          var errEl = document.createElement("p");
          errEl.className = "empty";
          errEl.textContent = "Erro ao buscar: " + err.message;
          resultsWrap.appendChild(errEl);
        });
    }

    runQuery();
  }

  // botões globais "Recolher tudo"/"Expandir tudo" (page.collapseAllControls,
  // ver renderContent) — acham TODAS as exibições marcadas
  // ".query-block-collapsible" dentro de "#content" (inclusive as que
  // estão escondidas dentro da aba não-ativa no momento — não tem
  // problema, elas só não aparecem até o usuário trocar de aba de novo)
  // e forçam o mesmo estado em todas de uma vez, direto via classList —
  // não precisa guardar referência a cada bloco individualmente.
  function collapseAllQueryBlocks(collapsed) {
    document.querySelectorAll("#content .query-block-collapsible").forEach(function (sec) {
      sec.classList.toggle("collapsed", collapsed);
      var ic = sec.querySelector(".query-collapse-btn .ti");
      if (ic) ic.className = collapsed ? "ti ti-chevron-right" : "ti ti-chevron-down";
    });
  }

  // "law-links": linha densa com o nome da lei + um botãozinho de ícone pra
  // cada link (Notion, Leis Municipais, Arquivo...). Usado em grupos com
  // "dense: true" — ex: as leis mais comuns em Legislações, organizadas por
  // assunto. Cada botão abre seu link numa aba nova.
  function buildLawRow(item) {
    var row = document.createElement("div");
    row.className = "law-row";
    var label = document.createElement("span");
    label.className = "law-label";
    label.textContent = item.label;
    row.appendChild(label);
    var linksWrap = document.createElement("span");
    linksWrap.className = "law-links";
    (item.links || []).forEach(function (link) {
      var isImg = !!IMG_ICONS[link.icon];
      var a = document.createElement("a");
      a.className = "law-link-btn" + (isImg ? " icon-img" : "");
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = link.label;
      if (isImg) {
        var img = document.createElement("img");
        img.src = IMG_ICONS[link.icon];
        img.alt = link.label;
        // largura/altura fixas no próprio elemento — assim o ícone não fica
        // gigante mesmo se o styles.css não tiver carregado a versão nova.
        img.width = 18;
        img.height = 18;
        a.appendChild(img);
      } else {
        var i = document.createElement("i");
        i.className = "ti ti-" + (link.icon || "external-link");
        a.appendChild(i);
      }
      linksWrap.appendChild(a);
    });
    row.appendChild(linksWrap);
    return row;
  }

  // ---------------- caixa de busca "search" (texto livre + filtro opcional) ----------------
  // Diferente do "dynamicQuery" (que busca sozinho assim que a página abre),
  // o "search" só dispara uma consulta quando o usuário digita algo ou
  // escolhe um filtro — nunca traz a base inteira de uma vez. Sempre GET
  // /query no Worker — nunca escreve nada no Notion.
  function renderSearchBlock(page, container) {
    var s = page.search;
    // "optionsFrom" pendente (ex: Assuntos/Processo-Chamado, que buscam a
    // lista de opções ao vivo — ver fetchSchemaOptions) precisa resolver
    // ANTES de montar os dropdowns, mesmo esquema do "renderDynamicQueryBlock"
    // pras exibições — mostra um placeholder enquanto isso.
    var pending = (s.filters || []).filter(function (f) { return f.optionsFrom && !f.options; });
    if (pending.length) {
      var placeholder = document.createElement("div");
      placeholder.className = "search-block";
      var loadingMsg = document.createElement("p");
      loadingMsg.className = "empty";
      loadingMsg.textContent = "Carregando filtros…";
      placeholder.appendChild(loadingMsg);
      container.appendChild(placeholder);

      Promise.all(pending.map(function (f) {
        return fetchSchemaOptions(f.optionsFrom.database_id, f.optionsFrom.property).then(function (opts) {
          f.options = opts;
        });
      }))
        .then(function () {
          // insere no lugar EXATO do placeholder (container.insertBefore),
          // igual ao mesmo bug já corrigido em renderDynamicQueryBlock —
          // um "container.appendChild" aqui jogaria o bloco de Pesquisar
          // pro FIM de "container", depois de "Anotações rápidas" (que já
          // tinha sido desenhada de forma síncrona nesse meio-tempo, logo
          // depois do "return" abaixo). Batia exatamente com o relato do
          // Georges: só na 1ª visita da sessão (quando as opções ainda não
          // estavam em cache no filtro), Anotações aparecia ACIMA de
          // Pesquisar — revisitas na mesma sessão (opções já cacheadas,
          // sem essa espera) sempre ficavam na ordem certa.
          renderSearchBlockReady(page, container, placeholder);
          container.removeChild(placeholder);
        })
        .catch(function () {
          loadingMsg.textContent = "Não foi possível carregar os filtros.";
        });
      return;
    }
    renderSearchBlockReady(page, container);
  }

  function renderSearchBlockReady(page, container, beforeNode) {
    var s = page.search;
    // "filterState" — um por PROPRIEDADE (igual "renderDynamicQueryBlockReady"),
    // não mais um único {type,pairs} — senão, com 2+ filtros no mesmo bloco
    // de busca (ex: Assuntos + Processo/Chamado), escolher um apagava o
    // outro (cada dropdown sobrescrevia a mesma variável).
    var state = { text: "", filterState: {} }; // filterState: { [property]: {type, pairs} }
    var debounceTimer = null;
    var requestSeq = 0;

    var section = document.createElement("div");
    // "search-block-accent" só entra na Início (Pesquisar) — dá destaque
    // visual pra separar essa seção de "Anotações rápidas" logo abaixo
    // (mesma ideia de ".notes-block-accent", ver renderNotesBlock). Nas
    // demais páginas (Betha/Tarefas/Reuniões/TAT) o bloco de busca
    // continua no visual simples de sempre.
    section.className = "search-block" + (page === cfg.pages.inicio ? " search-block-accent" : "");
    var title = document.createElement("h3");
    title.className = "group-title";
    var titleText = document.createElement("span");
    titleText.textContent = s.title || "Pesquisar";
    title.appendChild(titleText);

    var row = document.createElement("div");
    row.className = "search-block-row";

    var inputWrap = document.createElement("div");
    inputWrap.className = "search-field-wrap search-block-input-wrap";
    var searchIcon = document.createElement("i");
    searchIcon.className = "ti ti-search";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "search-block-input";
    input.placeholder = s.placeholder || "Buscar…";
    inputWrap.appendChild(searchIcon);
    inputWrap.appendChild(input);
    row.appendChild(inputWrap);

    // "Limpar filtros" — zera texto + todos os filtros ativos de uma vez.
    // Reconstrói a barra de filtros do zero (buildFilterBar) em vez de
    // tentar resetar cada dropdown/campo de data na mão, porque
    // buildIconDropdown/buildDateRangeFilter guardam o próprio estado
    // interno (marcados, aberto/fechado) dentro do closure — recriar o
    // elemento é a forma mais simples de garantir que tudo volta pro
    // estado inicial de verdade.
    if (s.filters && s.filters.length) {
      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "search-clear-btn";
      clearBtn.innerHTML = '<i class="ti ti-filter-off"></i> Limpar filtros';
      clearBtn.addEventListener("click", function () {
        state.text = "";
        input.value = "";
        state.filterState = {};
        buildFilterBar();
        runQuery();
      });
      title.appendChild(clearBtn);
    }
    section.appendChild(title);

    var filterBar = null;
    function buildFilterBar() {
      if (filterBar) filterBar.remove();
      if (!(s.filters && s.filters.length)) return;
      filterBar = document.createElement("div");
      filterBar.className = "filter-bar search-block-filter-bar";
      s.filters.forEach(function (f) {
        var key = f.stateKey || f.property;
        // filtros de data (Data/Prazo, Data de Conclusão, Data de Criação,
        // Última edição) usam um widget diferente (2 campos De/Até) em vez
        // do dropdown de opções — ver buildDateRangeFilter.
        var isDateType = f.type === "date" || f.type === "created_time" || f.type === "last_edited_time";
        if (isDateType) {
          filterBar.appendChild(buildDateRangeFilter(f, function (fs) {
            if (fs) state.filterState[key] = fs;
            else delete state.filterState[key];
            runQuery();
          }));
        } else {
          filterBar.appendChild(buildIconDropdown(f, function (opts) {
            var fs = filterStateFromOpts(f, opts);
            if (fs) state.filterState[key] = fs;
            else delete state.filterState[key];
            runQuery();
          }));
        }
      });
      row.appendChild(filterBar);
    }
    buildFilterBar();

    section.appendChild(row);

    var resultsWrap = document.createElement("div");
    resultsWrap.className = "content-plain search-block-results";
    section.appendChild(resultsWrap);

    input.addEventListener("input", function () {
      state.text = input.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runQuery, 350);
    });

    function runQuery() {
      // "hasInput" decide se busca ou não — independente de "s.baseFilters"
      // (filtro fixo sempre aplicado, ex: escopar a base inteira só aos
      // registros de "PMF - Reuniões"), que sozinho não conta como busca.
      var filterProps = Object.keys(state.filterState);
      var hasInput = !!state.text.trim() || filterProps.length > 0;
      var filters = (s.baseFilters || []).map(function (f) { return f; });
      if (state.text.trim()) {
        filters.push({
          property: s.nameField.property, type: s.nameField.type,
          condition: s.nameField.condition, value: state.text.trim()
        });
      }
      filterProps.forEach(function (prop) {
        filters.push(filterStateToFilterEntry(prop, state.filterState[prop]));
      });
      var mySeq = ++requestSeq;
      resultsWrap.innerHTML = "";
      if (!hasInput) return; // nada digitado/selecionado ainda — não busca

      var loading = document.createElement("p");
      loading.className = "empty";
      loading.textContent = "Buscando…";
      resultsWrap.appendChild(loading);

      var url = cfg.templateWorkerUrl + "/query?database_id=" + encodeURIComponent(s.database_id) +
        "&filters=" + encodeURIComponent(JSON.stringify(filters));

      authFetch(url)
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); })
        .then(function (result) {
          if (mySeq !== requestSeq) return; // resposta desatualizada (usuário já digitou outra coisa)
          resultsWrap.innerHTML = "";
          // login expirado/inválido — volta pra tela de login em vez de
          // mostrar "falha ao buscar" (que pareceria um erro de rede).
          if (result.status === 401 && window.Auth) { Auth.signOut(); return; }
          if (!result.ok) throw new Error((result.data && result.data.error) || "Falha ao buscar");
          var pages = result.data.pages || [];
          if (!pages.length) {
            var empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "Nada encontrado.";
            resultsWrap.appendChild(empty);
            return;
          }
          pages.forEach(function (p) {
            // idx alto só pra não ativar os atalhos de teclado 1-9 da página
            resultsWrap.appendChild(buildItemEl({ label: p.title, type: "notion", url: p.url }, 100));
          });
        })
        .catch(function (err) {
          if (mySeq !== requestSeq) return;
          resultsWrap.innerHTML = "";
          var errEl = document.createElement("p");
          errEl.className = "empty";
          errEl.textContent = "Erro ao buscar: " + err.message;
          resultsWrap.appendChild(errEl);
        });
    }

    if (beforeNode) container.insertBefore(section, beforeNode);
    else container.appendChild(section);
  }

  // ---------------- content grid/list ----------------
  // "page.weather" (opcional — "true"/1 pra hoje, "2" pra amanhã, etc — dia
  // 0-based a partir de hoje) — widget pequeno com a previsão do dia
  // (mín/máx + chance de chuva e o horário mais provável). Usa a API
  // pública da Open-Meteo — sem chave, sem custo, e é SÓ LEITURA (nunca
  // escreve nada, nem no Notion nem em outro lugar). Coordenadas fixas de
  // Florianópolis/SC. Se a busca falhar (sem internet, API fora do ar etc.)
  // o widget simplesmente some — não quebra o resto da página.
  function renderWeatherWidget(container, dayOffset) {
    dayOffset = dayOffset || 0;
    var wrap = document.createElement("div");
    wrap.className = "weather-widget weather-widget-loading";
    wrap.textContent = "Carregando previsão do tempo…";
    container.appendChild(wrap);

    var url = "https://api.open-meteo.com/v1/forecast?latitude=-27.5954&longitude=-48.5480"
      + "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"
      + "&hourly=precipitation_probability"
      + "&timezone=America%2FSao_Paulo&forecast_days=" + (dayOffset + 1);

    fetch(url).then(function (r) {
      if (!r.ok) throw new Error("weather http " + r.status);
      return r.json();
    }).then(function (data) {
      wrap.classList.remove("weather-widget-loading");
      wrap.innerHTML = "";

      var daily = data.daily || {};
      var max = (daily.temperature_2m_max || [])[dayOffset];
      var min = (daily.temperature_2m_min || [])[dayOffset];
      var chance = (daily.precipitation_probability_max || [])[dayOffset];
      var targetDate = (daily.time || [])[dayOffset]; // "YYYY-MM-DD" do dia certo

      // acha a hora de maior chance de chuva NAQUELE dia (o array "hourly"
      // cobre todos os dias pedidos, então filtra só as horas com a mesma
      // data de "targetDate") — só quando a chance máxima do dia já é
      // relevante (>=30%); abaixo disso, "sem previsão de chuva" já basta.
      var rainHourLabel = "";
      if (chance >= 30 && data.hourly && data.hourly.time && data.hourly.precipitation_probability) {
        var bestIdx = -1, bestVal = -1;
        data.hourly.time.forEach(function (t, i) {
          if (targetDate && t.slice(0, 10) !== targetDate) return;
          var v = data.hourly.precipitation_probability[i];
          if (v > bestVal) { bestVal = v; bestIdx = i; }
        });
        if (bestIdx !== -1 && data.hourly.time[bestIdx]) {
          rainHourLabel = " por volta das " + data.hourly.time[bestIdx].slice(11, 13) + "h";
        }
      }

      var icon = document.createElement("i");
      icon.className = "ti " + (chance >= 50 ? "ti-cloud-rain" : chance >= 20 ? "ti-cloud" : "ti-sun");

      var text = document.createElement("span");
      var parts = [];
      if (min != null && max != null) parts.push("Mín " + Math.round(min) + "° · Máx " + Math.round(max) + "°");
      if (chance != null) {
        parts.push(chance >= 30 ? "🌧 " + chance + "% de chuva" + rainHourLabel : "Sem previsão de chuva");
      }
      text.textContent = parts.join(" · ") || "Previsão indisponível";

      wrap.appendChild(icon);
      wrap.appendChild(text);
    }).catch(function () {
      wrap.remove();
    });
  }

  // ---------------- data de hoje em São Paulo (só a parte Y/M/D) ----------------
  // Usado pra rotular as abas de "page.tabs" com a data real (ex: "Hoje
  // (18/08)") — pega a data no fuso de São Paulo (não o fuso do navegador
  // do usuário) via Intl, depois monta um Date "local" só com essa Y/M/D
  // (meia-noite), seguro pra somar dias sem se preocupar com fuso/DST.
  function saoPauloToday() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    var y, m, d;
    parts.forEach(function (p) {
      if (p.type === "year") y = p.value;
      if (p.type === "month") m = p.value;
      if (p.type === "day") d = p.value;
    });
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDDMM(date) { return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1); }

  // "tab.dateRange" — [offset] pra um dia só (ex: [0] = hoje, [1] = amanhã)
  // ou [offsetInicio, offsetFim] pra um intervalo (ex: [0,6] = hoje até
  // hoje+6, os "próximos 7 dias" que a aba busca). Formata "18/08" (dia
  // único), "18-24/08" (intervalo no mesmo mês) ou "27/08-02/09" (intervalo
  // cruzando o mês).
  function tabDateLabel(range) {
    var today = saoPauloToday();
    var start = addDays(today, range[0]);
    if (range.length < 2 || range[1] === range[0]) return fmtDDMM(start);
    var end = addDays(today, range[1]);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return pad2(start.getDate()) + "-" + pad2(end.getDate()) + "/" + pad2(start.getMonth() + 1);
    }
    return fmtDDMM(start) + "-" + fmtDDMM(end);
  }

  // "page.tabs" — grupo de botões que troca TODO um conjunto de
  // "dynamicQueries" de uma vez (ex: Início: Hoje / Amanhã / Próximos 7
  // dias). Cada item de "page.tabs" tem { label, dynamicQueries: [...] } —
  // a mesma forma de "page.dynamicQueries" normal, só que agrupada por aba.
  // Só a aba ativa é buscada/desenhada; trocar de aba refaz do zero (sem
  // guardar cache das outras) — como cada busca é rápida e o Worker é só
  // leitura, não há necessidade de complicar com cache aqui.
  // "tab.weatherDay" (opcional) — dia (offset) do widget de previsão do
  // tempo, agora ACIMA da barra de botões Hoje/Amanhã/Próximos 7 dias
  // (pedido do Georges — antes ficava dentro do corpo da aba, abaixo dos
  // botões). Continua reagindo à troca de aba (renderWeather() é chamada
  // junto com renderBody() no clique), só que mora num wrapper PRÓPRIO
  // (weatherWrap), fora do "body" que renderBody() limpa/remonta.
  function renderTabs(page, pageId, container) {
    var weatherWrap = document.createElement("div");
    var tabsBar = document.createElement("div");
    tabsBar.className = "page-tabs";
    var tabsButtons = document.createElement("div");
    tabsButtons.className = "page-tabs-buttons";
    var body = document.createElement("div");

    var activeIdx = 0;

    function renderWeather() {
      weatherWrap.innerHTML = "";
      var tab = page.tabs[activeIdx];
      if (typeof tab.weatherDay === "number") renderWeatherWidget(weatherWrap, tab.weatherDay);
    }

    // sem linha divisória entre as exibições de uma mesma aba (Reuniões/
    // Sessões/Tarefas/Aniversários/Outros eventos) nem entre o fim delas
    // e "Itens Prioritários" logo abaixo — pedido do Georges pra deixar
    // esse bloco todo mais compacto/contínuo. As únicas divisórias que
    // sobram ficam FORA daqui: uma antes da barra de abas (logo abaixo,
    // ver dividerBeforeTabs) e outras já cuidadas por renderContent (antes
    // de Pesquisar e antes de Anotações rápidas).
    function renderBody() {
      body.innerHTML = "";
      var tab = page.tabs[activeIdx];
      (tab.dynamicQueries || []).forEach(function (qDef) {
        renderDynamicQueryBlock(qDef, pageId, body);
      });
    }

    page.tabs.forEach(function (tab, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-tab-btn" + (idx === 0 ? " active" : "");
      btn.textContent = tab.label + (tab.dateRange ? " (" + tabDateLabel(tab.dateRange) + ")" : "");
      btn.addEventListener("click", function () {
        if (activeIdx === idx) return;
        activeIdx = idx;
        tabsButtons.querySelectorAll(".page-tab-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderBody();
        renderWeather();
      });
      tabsButtons.appendChild(btn);
    });
    tabsBar.appendChild(tabsButtons);

    // "page.collapseAllControls" (opcional) — ícones "Recolher tudo"/
    // "Expandir tudo" (só ícone, sem texto, pra caber justo), agora na
    // MESMA linha dos botões de dia, ao lado de "Próximos 7 dias" —
    // antes ficavam numa barra própria acima das abas.
    if (page.collapseAllControls) {
      var tabsActions = document.createElement("div");
      tabsActions.className = "page-tabs-actions";
      var collapseAllBtn = document.createElement("button");
      collapseAllBtn.type = "button";
      collapseAllBtn.className = "toolbar-icon-btn";
      collapseAllBtn.title = "Recolher tudo";
      collapseAllBtn.setAttribute("aria-label", "Recolher tudo");
      collapseAllBtn.innerHTML = '<i class="ti ti-arrows-minimize"></i>';
      collapseAllBtn.addEventListener("click", function () { collapseAllQueryBlocks(true); });
      var expandAllBtn = document.createElement("button");
      expandAllBtn.type = "button";
      expandAllBtn.className = "toolbar-icon-btn";
      expandAllBtn.title = "Expandir tudo";
      expandAllBtn.setAttribute("aria-label", "Expandir tudo");
      expandAllBtn.innerHTML = '<i class="ti ti-arrows-maximize"></i>';
      expandAllBtn.addEventListener("click", function () { collapseAllQueryBlocks(false); });
      tabsActions.appendChild(collapseAllBtn);
      tabsActions.appendChild(expandAllBtn);
      tabsBar.appendChild(tabsActions);
    }

    // divisória única entre a previsão do tempo e o início das abas
    // (antes dos botões Hoje/Amanhã/Próximos 7 dias) — pedido do Georges.
    var dividerBeforeTabs = document.createElement("hr");
    dividerBeforeTabs.className = "content-divider";

    container.appendChild(weatherWrap);
    container.appendChild(dividerBeforeTabs);
    container.appendChild(tabsBar);
    container.appendChild(body);
    renderWeather();
    renderBody();
  }

  // estrela da estrela de "sinalizar" — SVG desenhado à mão (path clássico
  // de estrela de 5 pontas, mesmo usado por várias libs de ícone) em vez de
  // ícone de fonte, pra não depender de "ti-star-filled" existir na fonte
  // carregada (ver comentário em renderList mais abaixo). ".notes-item-star"
  // (CSS) desenha o contorno por padrão (fill:none + stroke) e preenche
  // sólido quando a classe "flagged" está presente.
  var STAR_SVG_PATH = "M12 17.75l-6.172 3.245 1.179 -6.873 -5 -4.867 6.9 -1.002 3.086 -6.253 3.086 6.253 6.9 1.002 -5 4.867 1.179 6.873z";
  function makeStarSvg() {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    var path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", STAR_SVG_PATH);
    svg.appendChild(path);
    return svg;
  }

  // ícone de "nota" (página com a quina dobrada) — mesmíssimo motivo do
  // star acima: SVG desenhado à mão em vez de ícone de fonte, porque
  // "tabler-icons.min.css" só traz os ícones OUTLINE (não tem "ti-note-
  // filled"), e o Georges pediu o ícone TOTALMENTE preenchido quando a nota
  // tem conteúdo, pra dar mais destaque (mesma ideia da estrela: contorno
  // vazio por padrão, sólido quando marcado). 1º subpath = contorno da
  // página com a quina superior direita cortada na diagonal (fechado, por
  // isso funciona preenchido); 2º subpath = a "dobrinha" da quina (só um
  // traço a mais, útil no contorno — em modo preenchido fica dentro da
  // área já preenchida, sem prejudicar nada). Classe ".has-note" (mesma já
  // usada nos botões de nota do item/subitem) troca contorno por
  // preenchimento, igual ".notes-item-star.flagged" faz com a estrela.
  var NOTE_SVG_PATH = "M7,3 L15,3 L19,7 L19,21 L7,21 Z M15,3 L15,7 L19,7";
  function makeNoteSvg() {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("class", "note-icon-svg");
    var path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", NOTE_SVG_PATH);
    svg.appendChild(path);
    return svg;
  }

  // "dd/mm hh:mm" bem pequeno, pro selo de data de criação de cada
  // anotação — mesmo formato usado em formatDateRangeExtra, só que a
  // partir de um ISO simples (n.createdAt), não de um objeto {start,end}
  // do Notion.
  function formatNoteDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return dd + "/" + mm + " " + hh + ":" + mi;
  }

  // "page.notes" — bloco de anotações rápidas/lista de tarefas (texto livre
  // + tags), guardado no Cloudflare KV via Worker (rotas /notes) — nada a
  // ver com o Notion, é um bloco à parte. Marcar/desmarcar concluída não
  // apaga a nota (fica riscada, mas continua na lista pra consultar
  // depois); o "x" apaga de vez.
  function renderNotesBlock(container) {
    var section = document.createElement("div");
    // "notes-block-accent" — mesmo esquema de destaque de
    // "search-block-accent" (cor diferente, âmbar em vez de azul), pra
    // marcar visualmente que essa seção é separada/independente da busca
    // acima (não usa o Notion — fica só no Cloudflare KV).
    section.className = "notes-block notes-block-accent";

    var title = document.createElement("h3");
    title.className = "group-title";
    var titleText = document.createElement("span");
    titleText.textContent = "Anotações rápidas";
    title.appendChild(titleText);
    // atalho pra página própria de Anotações Rápidas (mesmo padrão visual
    // das outras divisórias de Início — ver "qDef.titleLinks" em
    // renderDynamicQueryBlockReady) — só o ícone do app, já que esse bloco
    // não vem do Notion (não tem link equivalente lá). Só aparece fora da
    // própria página "anotacoes" (lá seria um link pra ela mesma, sem
    // sentido) — "currentId" é a página atual, ver render()/navigate().
    if (currentId !== "anotacoes") {
      var notesTitleLinks = document.createElement("span");
      notesTitleLinks.className = "query-title-links";
      var notesTitleLink = document.createElement("a");
      notesTitleLink.className = "query-title-link";
      notesTitleLink.title = "Abrir Anotações Rápidas no app";
      notesTitleLink.href = "#anotacoes";
      notesTitleLink.addEventListener("click", function (e) {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate("anotacoes");
      });
      var notesTitleLinkIcon = document.createElement("i");
      notesTitleLinkIcon.className = "ti ti-apps";
      notesTitleLink.appendChild(notesTitleLinkIcon);
      notesTitleLinks.appendChild(notesTitleLink);
      title.appendChild(notesTitleLinks);
    }
    section.appendChild(title);

    // linha de criação — "notes-text-input" ficou mais estreita/baixa (era
    // igual à barra de tags antes) pra sobrar espaço pra barra de filtros
    // logo abaixo, sem deixar o bloco todo pesado visualmente.
    var formRow = document.createElement("div");
    formRow.className = "notes-form-row";
    var textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "notes-text-input";
    textInput.placeholder = "Nova anotação...";
    var tagsInput = document.createElement("input");
    tagsInput.type = "text";
    tagsInput.className = "notes-tags-input";
    tagsInput.placeholder = "tags (vírgula)";
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "notes-add-btn";
    addBtn.innerHTML = '<i class="ti ti-plus"></i> Adicionar';
    formRow.appendChild(textInput);
    formRow.appendChild(tagsInput);
    formRow.appendChild(addBtn);
    section.appendChild(formRow);

    // barra de filtros — texto (pesquisa no corpo da anotação), tag (lista
    // montada a partir das tags que já existem nas anotações carregadas) e
    // status (todas/pendentes/concluídas). Filtra em cima do que já foi
    // buscado (sem chamada nova ao Worker a cada letra digitada).
    var filterRow = document.createElement("div");
    filterRow.className = "notes-filter-row";
    var searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "notes-filter-input";
    searchInput.placeholder = "Pesquisar...";
    // cada <select> ganha o NOME do filtro dentro de cada opção (ex: "Tag:
    // Todas", "Status: Pendentes") — sem isso o rótulo escolhido sozinho
    // ("Todas"/"Pendentes"/"Sinalizadas") não dizia do que se tratava sem
    // clicar pra abrir e ver as outras opções ao lado.
    var tagSelect = document.createElement("select");
    tagSelect.className = "notes-filter-select";
    tagSelect.title = "Filtrar por tag";
    // "Status: Pendentes" já vem marcado por padrão (pedido do Georges) —
    // "populateTagSelect"/"applyFilters" leem ".value" na hora, então só
    // precisa estar certo ANTES da 1ª chamada de loadNotes() lá embaixo.
    var statusSelect = document.createElement("select");
    statusSelect.className = "notes-filter-select";
    statusSelect.title = "Filtrar por status";
    [["all", "Status: Todas"], ["pending", "Status: Pendentes"], ["done", "Status: Concluídas"]].forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      statusSelect.appendChild(opt);
    });
    statusSelect.value = "pending";
    // "sinalizadas" (estrela preenchida, cor do Focus) — filtro à parte de
    // "concluída/pendente", pode combinar os dois ao mesmo tempo.
    var flaggedSelect = document.createElement("select");
    flaggedSelect.className = "notes-filter-select";
    flaggedSelect.title = "Filtrar por sinalização";
    [["all", "Sinalização: Todas"], ["flagged", "Sinalização: Sinalizadas"], ["unflagged", "Sinalização: Não sinalizadas"]].forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      flaggedSelect.appendChild(opt);
    });
    // ordenar — "Prioridade" = sinalizadas primeiro (não é o mesmo campo
    // "🚩 Prioridade" do Notion, que nem existe aqui; é só a estrela desta
    // anotação). Já vem marcado por padrão (pedido do Georges), pra ver as
    // sinalizadas no topo assim que a página abre.
    var sortSelect = document.createElement("select");
    sortSelect.className = "notes-filter-select";
    sortSelect.title = "Ordenar lista";
    [["created", "Ordenar: Data de criação"], ["name", "Ordenar: Nome"], ["priority", "Ordenar: Prioridade"], ["tag", "Ordenar: Tag"]].forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      sortSelect.appendChild(opt);
    });
    sortSelect.value = "priority";
    filterRow.appendChild(searchInput);
    filterRow.appendChild(tagSelect);
    filterRow.appendChild(statusSelect);
    filterRow.appendChild(flaggedSelect);
    filterRow.appendChild(sortSelect);
    section.appendChild(filterRow);

    // aviso de erro (escondido por padrão) — criar/editar/apagar uma
    // anotação sem isso falhava CALADO quando a chamada ao Worker dava
    // errado (sem internet, sessão expirada, Worker fora do ar etc.): a
    // lista simplesmente não atualizava e não tinha nenhum sinal na tela
    // do motivo, então parecia que só um F5 "resolvia" (na real só
    // recarregava do KV, mostrando o estado real — se a escrita tinha
    // falhado mesmo, o F5 nem mostraria a mudança). Agora qualquer falha
    // aparece aqui, com o motivo, em vez de sumir sem avisar.
    var errorMsg = document.createElement("p");
    errorMsg.className = "notes-error";
    errorMsg.style.display = "none";
    section.appendChild(errorMsg);

    function showNotesError(err) {
      errorMsg.textContent = "Não foi possível salvar: " + ((err && err.message) || "erro desconhecido") + ". Tente de novo.";
      errorMsg.style.display = "block";
    }
    function hideNotesError() {
      errorMsg.style.display = "none";
    }

    var listWrap = document.createElement("div");
    listWrap.className = "notes-list";
    section.appendChild(listWrap);
    container.appendChild(section);

    // guarda a última lista buscada no Worker — os 3 filtros acima mexem só
    // nisso aqui na tela, sem recarregar do KV a cada mudança.
    var allNotes = [];

    function parseTags(v) {
      return v.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    }

    function handle401(res) {
      if (res.status === 401 && window.Auth) { Auth.signOut(); throw new Error("Faça login de novo pra continuar."); }
      return res;
    }

    // reconstrói as opções do dropdown de tags a partir das anotações
    // carregadas (sem lista fixa em lugar nenhum) — tenta manter a tag
    // selecionada se ela continuar existindo depois de recarregar.
    function populateTagSelect() {
      var seen = {};
      allNotes.forEach(function (n) { (n.tags || []).forEach(function (t) { seen[t] = true; }); });
      var current = tagSelect.value;
      tagSelect.innerHTML = "";
      var allOpt = document.createElement("option");
      allOpt.value = "";
      allOpt.textContent = "Tag: Todas";
      tagSelect.appendChild(allOpt);
      Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }).forEach(function (t) {
        var opt = document.createElement("option");
        opt.value = t;
        opt.textContent = "Tag: " + t;
        tagSelect.appendChild(opt);
      });
      if (Object.prototype.hasOwnProperty.call(seen, current)) tagSelect.value = current;
    }

    function sortNotes(notes) {
      var mode = sortSelect.value;
      var copy = notes.slice();
      if (mode === "name") {
        copy.sort(function (a, b) { return a.text.localeCompare(b.text, "pt-BR"); });
      } else if (mode === "priority") {
        // sinalizadas (flagged) primeiro; dentro de cada grupo, mantém a
        // ordem que já veio (mais recente primeiro).
        copy.sort(function (a, b) { return (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0); });
      } else if (mode === "tag") {
        copy.sort(function (a, b) {
          var ta = (a.tags && a.tags[0]) || "";
          var tb = (b.tags && b.tags[0]) || "";
          if (!ta && tb) return 1;
          if (ta && !tb) return -1;
          return ta.localeCompare(tb, "pt-BR");
        });
      }
      // "created" — já vem nessa ordem do Worker (mais recente primeiro),
      // não precisa reordenar de novo.
      return copy;
    }

    function applyFilters() {
      var q = searchInput.value.trim().toLowerCase();
      var tag = tagSelect.value;
      var status = statusSelect.value;
      var flag = flaggedSelect.value;
      var filtered = allNotes.filter(function (n) {
        if (q && n.text.toLowerCase().indexOf(q) === -1) return false;
        if (tag && (n.tags || []).indexOf(tag) === -1) return false;
        if (status === "pending" && n.done) return false;
        if (status === "done" && !n.done) return false;
        if (flag === "flagged" && !n.flagged) return false;
        if (flag === "unflagged" && n.flagged) return false;
        return true;
      });
      renderList(sortNotes(filtered));
    }

    function renderList(notes) {
      listWrap.innerHTML = "";
      if (!notes.length) {
        var empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = allNotes.length ? "Nenhuma anotação bate com o filtro." : "Nenhuma anotação ainda.";
        listWrap.appendChild(empty);
        return;
      }
      notes.forEach(function (n) {
        var row = document.createElement("div");
        row.className = "notes-item" + (n.done ? " done" : "");

        var check = document.createElement("input");
        check.type = "checkbox";
        check.className = "notes-item-check";
        check.checked = !!n.done;
        check.addEventListener("change", function () { toggleDone(n.id, check.checked); });
        row.appendChild(check);

        // estrela — sinaliza a anotação como prioritária. Contorno vazio
        // quando não sinalizada, preenchida em amarelo (mesma cor do Focus,
        // #f08c00) quando sinalizada. Clique alterna e já reflete na hora
        // (sem esperar o reload da lista). Usa um SVG desenhado à mão (ver
        // makeStarSvg), não o ícone "ti-star-filled" da fonte — esse
        // ícone "preenchido" simplesmente não existe no arquivo de fonte
        // carregado (tabler-icons.min.css só traz os ícones OUTLINE; a
        // versão preenchida é um arquivo à parte que este app não carrega),
        // por isso ficava em branco. "ti-star" (contorno) continua sendo
        // usado só como referência de estilo, não mais renderizado direto.
        var starBtn = document.createElement("button");
        starBtn.type = "button";
        starBtn.className = "notes-item-star" + (n.flagged ? " flagged" : "");
        starBtn.appendChild(makeStarSvg());
        starBtn.title = n.flagged ? "Remover sinalização" : "Sinalizar como prioritária";
        starBtn.addEventListener("click", function () { toggleFlagged(n.id, !n.flagged); });
        row.appendChild(starBtn);

        var textSpan = document.createElement("span");
        textSpan.className = "notes-item-text";
        textSpan.textContent = n.text;
        row.appendChild(textSpan);

        (n.tags || []).forEach(function (t) {
          var tag = document.createElement("span");
          tag.className = "notes-item-tag";
          tag.textContent = t;
          row.appendChild(tag);
        });

        // data de criação — bem pequena, só pra referência (não é o foco
        // do card). "n.createdAt" é ISO (ver handleNotesCreate no worker.js).
        var dateBadge = document.createElement("span");
        dateBadge.className = "notes-item-date";
        dateBadge.textContent = formatNoteDate(n.createdAt);
        row.appendChild(dateBadge);

        // "+" — adiciona tag numa anotação que já existe (não só na hora de
        // criar). Clique abre um campinho de texto inline; Enter confirma
        // (manda a lista de tags COMPLETA pro Worker — a rota PUT /notes
        // substitui "tags" inteiro, não faz merge sozinha), Escape/perder o
        // foco sem digitar nada cancela.
        var addTagBtn = document.createElement("button");
        addTagBtn.type = "button";
        addTagBtn.className = "notes-item-addtag";
        addTagBtn.innerHTML = '<i class="ti ti-tag-plus"></i>';
        addTagBtn.title = "Adicionar tag";

        // "+" — adiciona um sub-item (checklist DENTRO da anotação, ex:
        // "Levantar dados"/"Montar slides" dentro de "Preparar reunião X").
        // Mesmo padrão de interação do botão de tag acima (campo inline,
        // Enter confirma) — ver addSubitemBtn.addEventListener mais abaixo,
        // depois que "subitemsWrap" já existe.
        var addSubitemBtn = document.createElement("button");
        addSubitemBtn.type = "button";
        addSubitemBtn.className = "notes-item-addtag";
        addSubitemBtn.innerHTML = '<i class="ti ti-list-check"></i>';
        addSubitemBtn.title = "Adicionar item à checklist";

        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "notes-item-del";
        delBtn.innerHTML = '<i class="ti ti-x"></i>';
        delBtn.title = "Apagar";
        delBtn.addEventListener("click", function () { removeNote(n.id); });

        addTagBtn.addEventListener("click", function () {
          if (row.querySelector(".notes-item-addtag-input")) return;
          var tagInput = document.createElement("input");
          tagInput.type = "text";
          tagInput.className = "notes-item-addtag-input";
          tagInput.placeholder = "nova tag";
          var done = false;
          function commit() {
            if (done) return;
            done = true;
            var v = tagInput.value.trim();
            if (v) addTagToNote(n, v);
            tagInput.remove();
          }
          tagInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") { done = true; tagInput.remove(); }
          });
          tagInput.addEventListener("blur", function () { commit(); });
          row.insertBefore(tagInput, delBtn);
          tagInput.focus();
        });

        row.appendChild(addTagBtn);
        row.appendChild(addSubitemBtn);
        row.appendChild(delBtn);

        // checklist da anotação — cada sub-item numa linha própria (check +
        // texto + apagar), recuada pra alinhar embaixo do texto da
        // anotação (não embaixo do checkbox/estrela dela). Sempre existe
        // (mesmo vazia) — é onde o campo de "novo item" entra quando o
        // botão acima é clicado.
        var subitemsWrap = document.createElement("div");
        subitemsWrap.className = "notes-subitems";

        function renderSubitems() {
          subitemsWrap.innerHTML = "";
          (n.subitems || []).forEach(function (s) {
            var subRow = document.createElement("div");
            subRow.className = "notes-subitem" + (s.done ? " done" : "");

            var subCheck = document.createElement("input");
            subCheck.type = "checkbox";
            subCheck.className = "notes-subitem-check";
            subCheck.checked = !!s.done;
            subCheck.addEventListener("change", function () { toggleSubitem(n, s.id, subCheck.checked); });
            subRow.appendChild(subCheck);

            var subText = document.createElement("span");
            subText.className = "notes-subitem-text";
            subText.textContent = s.text;
            subRow.appendChild(subText);

            var subDelBtn = document.createElement("button");
            subDelBtn.type = "button";
            subDelBtn.className = "notes-subitem-del";
            subDelBtn.innerHTML = '<i class="ti ti-x"></i>';
            subDelBtn.title = "Apagar item";
            subDelBtn.addEventListener("click", function () { removeSubitem(n, s.id); });
            subRow.appendChild(subDelBtn);

            subitemsWrap.appendChild(subRow);
          });
        }
        renderSubitems();

        addSubitemBtn.addEventListener("click", function () {
          if (subitemsWrap.querySelector(".notes-subitem-add-input")) return;
          var subInput = document.createElement("input");
          subInput.type = "text";
          subInput.className = "notes-subitem-add-input";
          subInput.placeholder = "novo item da checklist";
          var done = false;
          function commit() {
            if (done) return;
            done = true;
            var v = subInput.value.trim();
            subInput.remove();
            if (v) addSubitem(n, v);
          }
          subInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") { done = true; subInput.remove(); }
          });
          subInput.addEventListener("blur", function () { commit(); });
          subitemsWrap.appendChild(subInput);
          subInput.focus();
        });

        var itemWrap = document.createElement("div");
        itemWrap.className = "notes-item-wrap";
        itemWrap.appendChild(row);
        itemWrap.appendChild(subitemsWrap);
        listWrap.appendChild(itemWrap);
      });
    }

    function loadNotes() {
      listWrap.innerHTML = '<p class="empty">Carregando…</p>';
      authFetch(cfg.templateWorkerUrl + "/notes")
        .then(handle401)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          allNotes = data.notes || [];
          populateTagSelect();
          applyFilters();
          hideNotesError();
        })
        .catch(function () { listWrap.innerHTML = '<p class="empty">Não foi possível carregar as anotações.</p>'; });
    }

    // as 4 ações abaixo (marcar feita, sinalizar, apagar, adicionar tag)
    // sempre chamavam loadNotes() no final — em teoria já deveriam
    // atualizar a lista sozinhas, sem precisar de F5. O problema real era
    // a FALTA de ".catch()" aqui: se a chamada ao Worker falhasse (sem
    // internet, sessão expirada, Worker fora do ar), a Promise ficava
    // "rejeitada" em silêncio — loadNotes() nunca rodava, a tela
    // simplesmente não mudava, e não tinha nenhum aviso do motivo. Agora
    // qualquer falha aparece em ".notes-error" (ver showNotesError acima).
    function toggleDone(id, done) {
      authFetch(cfg.templateWorkerUrl + "/notes?id=" + encodeURIComponent(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: done })
      }).then(handle401).then(loadNotes).catch(showNotesError);
    }

    function toggleFlagged(id, flagged) {
      authFetch(cfg.templateWorkerUrl + "/notes?id=" + encodeURIComponent(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: flagged })
      }).then(handle401).then(loadNotes).catch(showNotesError);
    }

    function removeNote(id) {
      authFetch(cfg.templateWorkerUrl + "/notes?id=" + encodeURIComponent(id), { method: "DELETE" })
        .then(handle401).then(loadNotes).catch(showNotesError);
    }

    function addTagToNote(note, tagValue) {
      var newTags = (note.tags || []).slice();
      if (newTags.indexOf(tagValue) === -1) newTags.push(tagValue);
      authFetch(cfg.templateWorkerUrl + "/notes?id=" + encodeURIComponent(note.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags })
      }).then(handle401).then(loadNotes).catch(showNotesError);
    }

    // checklist (page.subitems) — mesmo padrão de addTagToNote acima: monta
    // a lista COMPLETA já com a mudança aplicada e manda inteira pro Worker
    // (PUT /notes substitui "subitems", não faz merge sozinho).
    function putSubitems(note, subitems) {
      authFetch(cfg.templateWorkerUrl + "/notes?id=" + encodeURIComponent(note.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subitems: subitems })
      }).then(handle401).then(loadNotes).catch(showNotesError);
    }
    function addSubitem(note, text) {
      var newSubitems = (note.subitems || []).slice();
      newSubitems.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), text: text, done: false });
      putSubitems(note, newSubitems);
    }
    function toggleSubitem(note, subitemId, done) {
      var newSubitems = (note.subitems || []).map(function (s) {
        return s.id === subitemId ? { id: s.id, text: s.text, done: done } : s;
      });
      putSubitems(note, newSubitems);
    }
    function removeSubitem(note, subitemId) {
      var newSubitems = (note.subitems || []).filter(function (s) { return s.id !== subitemId; });
      putSubitems(note, newSubitems);
    }

    function addNote() {
      var text = textInput.value.trim();
      if (!text) { textInput.focus(); return; }
      var tags = parseTags(tagsInput.value);
      addBtn.disabled = true;
      authFetch(cfg.templateWorkerUrl + "/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text, tags: tags })
      }).then(handle401).then(function () {
        textInput.value = "";
        tagsInput.value = "";
        textInput.focus();
        loadNotes();
      }).catch(showNotesError).finally(function () { addBtn.disabled = false; });
    }

    addBtn.addEventListener("click", addNote);
    textInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addNote(); });
    tagsInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addNote(); });
    searchInput.addEventListener("input", applyFilters);
    tagSelect.addEventListener("change", applyFilters);
    statusSelect.addEventListener("change", applyFilters);
    flaggedSelect.addEventListener("change", applyFilters);
    sortSelect.addEventListener("change", applyFilters);

    loadNotes();
  }

  // "page.priorities" — tabela "Lista de Prioridades" (pedido do Georges):
  // mesmo esquema de renderNotesBlock acima (guardado à parte no Cloudflare
  // KV via Worker, rotas /priorities, nada a ver com o Notion), mas com 9
  // colunas por item (6 "de opção" editáveis por <select>, 3 de texto
  // livre) em vez de só texto+tags, e reaproveitando O MESMO mecanismo de
  // checklist/subitens (mesmas classes CSS "notes-subitem*", mesmo padrão
  // de "putSubitems substitui a lista inteira") já usado em Anotações
  // Rápidas — daí não precisar de CSS novo pra essa parte.
  function renderPrioritiesTable(container, page) {
    var fieldDefs = page.priorityFields || {};
    var fieldKeys = ["tipo", "prioridade", "tempo", "forma", "programacao", "tributo"];
    // "providencia" foi REMOVIDA como coluna (pedido do Georges — o texto
    // que estava nela agora entra como subitem da checklist; ver migração
    // migrateProvidenciaToSubitem no worker.js, roda sozinha no primeiro
    // GET/PUT de cada item depois do deploy).
    var textKeys = ["origem", "assunto"];
    var textLabels = { origem: "Origem", assunto: "Assunto" };

    // as opções de cada uma das 6 colunas acima começam com o que vem do
    // config.js (fieldDefs[key].options — os valores "de fábrica"), mas o
    // Georges pode editá-las pela própria página (ícone de engrenagem no
    // cabeçalho — ver buildFieldOptionsPanel mais abaixo), e nesse caso o
    // Worker (/priorities-options) passa a valer. Busca a versão salva UMA
    // vez, aqui no início; se vier diferente do que já está desenhado (1ª
    // vez que essa página é montada usando os valores de fábrica), remonta
    // a página inteira UMA vez só com os valores certos — mesmo truque de
    // "trocar tudo" já usado depois de salvar um filtro rápido ou uma
    // opção. "page._priorityOptionsLoaded" evita fazer essa busca nas
    // vezes seguintes (depois de editar um item, por exemplo) — só roda de
    // novo se o Georges editar as opções pelo painel, que já chega com a
    // resposta fresca em mãos e não precisa desse GET.
    if (!page._priorityOptionsLoaded) {
      authFetch(cfg.templateWorkerUrl + "/priorities-options")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var liveOpts = (data && data.options) || {};
          var changed = false;
          fieldKeys.forEach(function (key) {
            if (Array.isArray(liveOpts[key]) && fieldDefs[key]) {
              if (JSON.stringify(fieldDefs[key].options || []) !== JSON.stringify(liveOpts[key])) changed = true;
              fieldDefs[key].options = liveOpts[key];
            }
          });
          page._priorityOptionsLoaded = true;
          if (changed) { container.innerHTML = ""; renderPrioritiesTable(container, page); }
        })
        .catch(function () { page._priorityOptionsLoaded = true; });
    }

    var section = document.createElement("div");
    section.className = "notes-block notes-block-accent priorities-block";

    var title = document.createElement("h3");
    title.className = "group-title";
    title.textContent = "Lista de Prioridades";
    section.appendChild(title);

    // ---- "Filtros rápidos" (pedido do Georges): seção de botões-atalho no
    // TOPO da página, um bloco por grupo (Tipo/Prioridade/Tempo/Forma/
    // Programação/Tributo) — clicar um botão filtra a tabela mais abaixo.
    // Vários botões ativos no MESMO grupo se somam com "OU" (ex: Forma =
    // Chrome OU WhatsApp); grupos diferentes se combinam entre si com "E"
    // (ex: Tipo = PMF E Forma = Chrome). É tudo INDEPENDENTE dos filtros
    // por coluna da barra mais abaixo — os dois conjuntos se combinam
    // também com "E" (ver applyFilters). "Editar filtros" liga um modo em
    // que dá pra criar/renomear/trocar as opções/excluir cada botão — some
    // pra /priorities-quickfilters no Worker (mesmo KV, chave fixa) assim
    // que salvo, então já fica valendo em qualquer aparelho.
    var qfConfig = page.quickFilters || { groups: [], defaults: {} };
    var qfGroups = qfConfig.groups || [];
    var qfData = null; // só preenchido depois do GET (ou dos "defaults" se nunca foi salvo nada no Worker)
    var qfActive = {}; // { grupoKey: [índice, índice, ...] } — botões ativos agora, "OU" dentro do grupo
    qfGroups.forEach(function (g) { qfActive[g.key] = []; });
    var qfEditMode = false;
    var qfEditing = null; // { key, index } do botão sendo criado/editado agora (index === -1 = "criando novo"), ou null = nenhum editor aberto
    // recolhido por padrão em tela pequena (pedido do Georges — no celular
    // essa seção sozinha já ocupa uma tela inteira de rolagem antes de
    // chegar na tabela); em tela larga começa aberta, como sempre foi.
    // Só olha o tamanho UMA vez, na hora de montar a página (não fica
    // ouvindo resize — vira a mesma ideia de "abre expandido/recolhido"
    // já usada pelas divisórias de Início, não precisa ser reativo).
    var qfCollapsed = !!(window.matchMedia && window.matchMedia("(max-width: 1023px)").matches);

    var qfSection = document.createElement("div");
    qfSection.className = "priorities-quickfilters";
    section.appendChild(qfSection);

    // devolve a lista (sem repetição) de valores brutos que os botões
    // ATIVOS daquele grupo representam, ou null se nenhum botão do grupo
    // estiver ativo (== sem restrição nenhuma vinda dos filtros rápidos
    // pra essa coluna, deixa applyFilters decidir só pelos outros filtros).
    function qfActiveValues(key) {
      var idxs = qfActive[key] || [];
      if (!idxs.length || !qfData || !qfData[key]) return null;
      var union = [];
      idxs.forEach(function (idx) {
        var btn = qfData[key][idx];
        if (!btn) return;
        btn.values.forEach(function (v) { if (union.indexOf(v) === -1) union.push(v); });
      });
      return union.length ? union : null;
    }

    function qfCloneDefaults() {
      var out = {};
      qfGroups.forEach(function (g) {
        var src = (qfConfig.defaults && qfConfig.defaults[g.key]) || [];
        out[g.key] = src.map(function (b) { return { label: b.label, values: b.values.slice() }; });
      });
      return out;
    }

    // ordem alfabética SEMPRE dentro de cada divisória (pedido do Georges) —
    // roda toda vez que "qfData" é (re)atribuído: 1ª carga (qfLoad, tanto no
    // sucesso quanto no fallback de erro) e depois de salvar (qfSave, com o
    // que volta do Worker). Não precisa reordenar em NENHUM outro momento
    // (clicar pra ativar/desativar um botão não muda a lista, só
    // qfActive) — mudar a ordem só quando a LISTA de botões muda evita
    // reordenar o grid embaixo do dedo do usuário à toa. É seguro mexer nos
    // ÍNDICES aqui porque "qfSave" já zera "qfActive[changedKey]" sempre que
    // a lista daquele grupo muda (índice antigo podia não valer mais de
    // qualquer forma, ver comentário lá) — os outros grupos nem mudam de
    // conteúdo, então reordenar de novo dá o MESMO array de antes.
    // EXCEÇÃO: "tempo" fica de fora — o Georges prefere a ordem
    // CRONOLÓGICA (5min → 15min → 45min → 1h30 → 2h+) que já vem de
    // config.js, e ordem alfabética bagunçaria essa sequência (ex: "Até 45
    // minutos" viria antes de "Até 5 minutos" só por causa do texto).
    var QF_GROUPS_NOT_ALPHA = ["tempo"];
    function sortQfData(data) {
      qfGroups.forEach(function (g) {
        if (QF_GROUPS_NOT_ALPHA.indexOf(g.key) !== -1) return;
        if (Array.isArray(data[g.key])) {
          data[g.key].sort(function (a, b) { return (a.label || "").localeCompare(b.label || "", "pt-BR"); });
        }
      });
      return data;
    }

    // PUT substitui a config INTEIRA no Worker (mesmo padrão de "subitems"/
    // "forma" — nunca faz merge no servidor). Depois de salvar, some com a
    // seleção ATIVA do grupo mexido: os índices dos botões podem ter mudado
    // (um botão apagado desloca os que vêm depois dele) — mais simples e
    // seguro que tentar recasar é só limpar, evita aplicar um filtro sem
    // querer num botão que não é mais o que o usuário pensa que é.
    function qfSave(changedKey) {
      return authFetch(cfg.templateWorkerUrl + "/priorities-quickfilters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qfData)
      }).then(handle401).then(function (r) { return r.json(); }).then(function (data) {
        qfData = sortQfData((data && data.quickFilters) || qfCloneDefaults());
        if (changedKey) qfActive[changedKey] = [];
        qfEditing = null;
        renderQfSection();
        applyFilters();
      }).catch(showErr);
    }

    // conta quantos botões estão ativos ao todo (soma de todos os grupos)
    // — mostrado do lado do título quando a seção está RECOLHIDA, pra dar
    // pra ver de relance se tem algum filtro rápido valendo sem precisar
    // abrir de novo.
    function qfActiveCount() {
      var total = 0;
      qfGroups.forEach(function (g) { total += (qfActive[g.key] || []).length; });
      return total;
    }

    function renderQfSection() {
      qfSection.innerHTML = "";
      qfSection.classList.toggle("collapsed", qfCollapsed);

      var header = document.createElement("div");
      header.className = "priorities-quickfilters-header";

      // botão de recolher/expandir — mesmo visual/mecanismo já usado nas
      // exibições com "qDef.collapsible" (".query-collapse-btn", seta que
      // vira de baixo pra direita); aqui é sempre exibido (a seção inteira
      // é sempre recolhível, não é opcional por página).
      var collapseToggle = document.createElement("button");
      collapseToggle.type = "button";
      collapseToggle.className = "query-collapse-btn priorities-quickfilters-collapse-btn";
      collapseToggle.setAttribute("aria-label", "Recolher/expandir Filtros rápidos");
      var collapseIcon = document.createElement("i");
      collapseIcon.className = qfCollapsed ? "ti ti-chevron-right" : "ti ti-chevron-down";
      collapseToggle.appendChild(collapseIcon);
      collapseToggle.addEventListener("click", function () {
        qfCollapsed = !qfCollapsed;
        renderQfSection();
      });
      header.appendChild(collapseToggle);

      var heading = document.createElement("h4");
      heading.className = "priorities-quickfilters-title";
      heading.textContent = "Filtros rápidos";
      header.appendChild(heading);

      var activeCount = qfActiveCount();
      if (qfCollapsed && activeCount) {
        var countBadge = document.createElement("span");
        countBadge.className = "priorities-quickfilters-count";
        countBadge.textContent = activeCount === 1 ? "1 ativo" : activeCount + " ativos";
        header.appendChild(countBadge);
      }

      var editToggle = document.createElement("button");
      editToggle.type = "button";
      editToggle.className = "priorities-quickfilters-edit-toggle" + (qfEditMode ? " active" : "");
      editToggle.innerHTML = qfEditMode
        ? '<i class="ti ti-check"></i> Concluir edição'
        : '<i class="ti ti-pencil"></i> Editar filtros';
      editToggle.addEventListener("click", function () {
        qfEditMode = !qfEditMode;
        qfEditing = null;
        // entrar no modo de edição sempre expande a seção — não dá pra
        // editar os botões sem ver eles.
        if (qfEditMode) qfCollapsed = false;
        renderQfSection();
      });
      header.appendChild(editToggle);
      qfSection.appendChild(header);

      // tudo abaixo do cabeçalho mora dentro de ".priorities-quickfilters-
      // body" — é esse wrapper que o CSS esconde quando a seção está
      // ".collapsed" (mesma ideia de ".query-block-body" já usada nas
      // exibições recolhíveis).
      var body = document.createElement("div");
      body.className = "priorities-quickfilters-body";
      qfSection.appendChild(body);

      if (!qfData) {
        var loading = document.createElement("p");
        loading.className = "priorities-quickfilters-loading";
        loading.textContent = "Carregando…";
        body.appendChild(loading);
        return;
      }

      qfGroups.forEach(function (g) {
        var groupRow = document.createElement("div");
        groupRow.className = "priorities-quickfilter-group";
        var groupLabel = document.createElement("span");
        groupLabel.className = "priorities-quickfilter-group-label";
        groupLabel.textContent = g.label;
        groupRow.appendChild(groupLabel);

        var btnsWrap = document.createElement("div");
        btnsWrap.className = "priorities-quickfilter-buttons";

        (qfData[g.key] || []).forEach(function (btn, idx) {
          var pill = document.createElement("button");
          pill.type = "button";
          var isActive = qfActive[g.key].indexOf(idx) !== -1;
          pill.className = "priorities-quickfilter-btn" + (isActive ? " active" : "");
          var pillLabel = document.createElement("span");
          pillLabel.textContent = btn.label;
          pill.appendChild(pillLabel);
          if (qfEditMode) {
            var removeX = document.createElement("i");
            removeX.className = "ti ti-x priorities-quickfilter-btn-remove";
            removeX.title = "Excluir";
            removeX.addEventListener("click", function (e) {
              e.stopPropagation();
              qfData[g.key] = qfData[g.key].filter(function (_, i2) { return i2 !== idx; });
              qfSave(g.key);
            });
            pill.appendChild(removeX);
          }
          pill.addEventListener("click", function () {
            if (qfEditMode) {
              qfEditing = { key: g.key, index: idx };
              renderQfSection();
              return;
            }
            var pos = qfActive[g.key].indexOf(idx);
            if (pos === -1) qfActive[g.key].push(idx); else qfActive[g.key].splice(pos, 1);
            renderQfSection();
            applyFilters();
          });
          btnsWrap.appendChild(pill);
        });

        if (qfEditMode) {
          var addBtnQf = document.createElement("button");
          addBtnQf.type = "button";
          addBtnQf.className = "priorities-quickfilter-btn priorities-quickfilter-btn-add";
          addBtnQf.innerHTML = '<i class="ti ti-plus"></i> Novo';
          addBtnQf.addEventListener("click", function () {
            qfEditing = { key: g.key, index: -1 };
            renderQfSection();
          });
          btnsWrap.appendChild(addBtnQf);
        }

        groupRow.appendChild(btnsWrap);
        body.appendChild(groupRow);

        if (qfEditMode && qfEditing && qfEditing.key === g.key) {
          groupRow.appendChild(buildQfEditor(g, qfEditing.index));
        }
      });
    }

    // caixinha de criar/editar 1 botão — nome + checkboxes com as opções
    // FIXAS daquele grupo (fieldDefs[key].options, a mesma lista usada na
    // tabela). Salvar manda a config INTEIRA pro Worker (ver qfSave).
    function buildQfEditor(g, index) {
      var isNew = index === -1;
      var existing = isNew ? null : qfData[g.key][index];
      // "field" (quando existe) diz qual coluna de verdade esse grupo de
      // botões representa — hoje só "grupo" tem isso (aponta pra
      // "programacao", já que "Grupo" não é uma coluna própria; ver
      // comentário em page.quickFilters no config.js). Os demais grupos
      // não têm "field" e usam a própria "key" (comportamento de sempre).
      var options = (fieldDefs[g.field || g.key] && fieldDefs[g.field || g.key].options) || [];

      var editor = document.createElement("div");
      editor.className = "priorities-quickfilter-editor";

      var labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "priorities-quickfilter-editor-label";
      labelInput.placeholder = "Nome do botão";
      labelInput.value = existing ? existing.label : "";
      editor.appendChild(labelInput);

      var optsWrap = document.createElement("div");
      optsWrap.className = "priorities-quickfilter-editor-options";
      var checked = {};
      (existing ? existing.values : []).forEach(function (v) { checked[v] = true; });
      var checkboxes = [];
      options.forEach(function (opt) {
        var optLabel = document.createElement("label");
        optLabel.className = "priorities-quickfilter-editor-opt";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!checked[opt];
        optLabel.appendChild(cb);
        optLabel.appendChild(document.createTextNode(" " + opt));
        optsWrap.appendChild(optLabel);
        checkboxes.push({ opt: opt, cb: cb });
      });
      editor.appendChild(optsWrap);

      var editorErr = document.createElement("p");
      editorErr.className = "priorities-quickfilter-editor-error";
      editorErr.style.display = "none";
      editor.appendChild(editorErr);

      var actions = document.createElement("div");
      actions.className = "priorities-quickfilter-editor-actions";
      var saveBtnQf = document.createElement("button");
      saveBtnQf.type = "button";
      saveBtnQf.className = "notes-add-btn";
      saveBtnQf.textContent = "Salvar";
      saveBtnQf.addEventListener("click", function () {
        var label = labelInput.value.trim();
        var values = checkboxes.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.opt; });
        if (!label || !values.length) {
          editorErr.textContent = "Escolha um nome e pelo menos uma opção.";
          editorErr.style.display = "block";
          return;
        }
        var newBtn = { label: label, values: values };
        if (isNew) qfData[g.key] = (qfData[g.key] || []).concat([newBtn]);
        else qfData[g.key][index] = newBtn;
        qfSave(g.key);
      });
      var cancelBtnQf = document.createElement("button");
      cancelBtnQf.type = "button";
      cancelBtnQf.className = "priorities-clear-btn";
      cancelBtnQf.textContent = "Cancelar";
      cancelBtnQf.addEventListener("click", function () {
        qfEditing = null;
        renderQfSection();
      });
      actions.appendChild(saveBtnQf);
      actions.appendChild(cancelBtnQf);
      editor.appendChild(actions);

      return editor;
    }

    function qfLoad() {
      authFetch(cfg.templateWorkerUrl + "/priorities-quickfilters")
        .then(handle401)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          qfData = (data && data.quickFilters) || qfCloneDefaults();
          qfGroups.forEach(function (g) { if (!Array.isArray(qfData[g.key])) qfData[g.key] = []; });
          sortQfData(qfData);
          renderQfSection();
        })
        .catch(function () {
          qfData = sortQfData(qfCloneDefaults());
          renderQfSection();
        });
    }

    renderQfSection();
    qfLoad();

    function makeSelect(cls, key, includeEmpty, emptyLabel) {
      var sel = document.createElement("select");
      sel.className = cls;
      if (includeEmpty) {
        var emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = emptyLabel;
        sel.appendChild(emptyOpt);
      }
      ((fieldDefs[key] && fieldDefs[key].options) || []).forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      return sel;
    }

    function isMultiField(key) { return !!(fieldDefs[key] && fieldDefs[key].multi); }

    // controle "genérico" que trata <select> (seleção única) e o
    // checkbox-dropdown abaixo (seleção múltipla, só "forma" hoje) da mesma
    // forma — quem usa não precisa saber qual dos dois é.
    function getControlValue(control) {
      return typeof control.getValues === "function" ? control.getValues() : control.value;
    }
    function resetControl(control) {
      if (typeof control.setValues === "function") control.setValues([]);
      else control.value = "";
    }

    // checkbox-dropdown de seleção múltipla (hoje só "forma") — mesmo
    // esquema visual/mecanismo do menu suspenso de filtro já usado no resto
    // do app (buildIconDropdown, ver mais acima): reaproveita as classes
    // ".filter-dropdown/.filter-trigger/.filter-menu/.filter-option", que
    // inclusive já fecham sozinhas ao clicar fora (ver o
    // "document.addEventListener('click', ...)" global que target
    // ".filter-menu.open" — nenhum código novo precisa disso aqui).
    // "sizeClass" é a MESMA classe que o <select> normal usaria no mesmo
    // lugar (linha de criação/filtro/célula da tabela), pra ficar do
    // mesmo tamanho.
    function buildMultiCheckDropdown(key, placeholderText, sizeClass) {
      var options = (fieldDefs[key] && fieldDefs[key].options) || [];
      var wrap = document.createElement("div");
      wrap.className = "filter-dropdown priorities-multiselect";

      var trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "priorities-multiselect-trigger" + (sizeClass ? " " + sizeClass : "");
      var triggerLabel = document.createElement("span");
      triggerLabel.className = "priorities-multiselect-label";
      var chevron = document.createElement("i");
      chevron.className = "ti ti-chevron-down";
      trigger.appendChild(triggerLabel);
      trigger.appendChild(chevron);

      var menu = document.createElement("div");
      menu.className = "filter-menu";

      var values = [];
      var rowEntries = [];
      var onChangeCb = null;
      var onCloseCb = null;
      var wasOpen = false;

      function updateTrigger() {
        if (!values.length) triggerLabel.textContent = placeholderText;
        else if (values.length <= 2) triggerLabel.textContent = values.join(", ");
        else triggerLabel.textContent = values.length + " selecionadas";
      }
      function updateRowsUI() {
        rowEntries.forEach(function (entry) {
          entry.row.classList.toggle("selected", values.indexOf(entry.opt) !== -1);
        });
      }
      function setValues(next, silent) {
        values = (next || []).slice();
        updateTrigger();
        updateRowsUI();
        if (!silent && onChangeCb) onChangeCb(values.slice());
      }

      var allRow = document.createElement("div");
      allRow.className = "filter-option filter-option-all";
      var allLabel = document.createElement("span");
      allLabel.textContent = "Nenhuma";
      allRow.appendChild(allLabel);
      allRow.addEventListener("click", function (e) {
        e.stopPropagation();
        menu.classList.remove("open");
        setValues([]);
      });
      menu.appendChild(allRow);

      options.forEach(function (opt) {
        var row = document.createElement("div");
        row.className = "filter-option";
        var lbl = document.createElement("span");
        lbl.textContent = opt;
        var check = document.createElement("i");
        check.className = "ti ti-check filter-option-check";
        row.appendChild(lbl);
        row.appendChild(check);
        row.addEventListener("click", function (e) {
          e.stopPropagation();
          var idx = values.indexOf(opt);
          var next = values.slice();
          if (idx === -1) next.push(opt); else next.splice(idx, 1);
          setValues(next);
        });
        menu.appendChild(row);
        rowEntries.push({ opt: opt, row: row });
      });

      // dentro de uma célula da tabela, o menu (posicionado normalmente
      // "absolute" relativo ao ".priorities-multiselect") ficava PRESO
      // dentro de ".priorities-table-wrap" (que rola na horizontal — ver
      // styles.css — e por isso, sem querer, também vira uma "caixa que
      // recorta" o que passa da borda dela, inclusive pra baixo), então o
      // menu abria escondido/cortado atrás da própria linha. Aqui ele vira
      // "fixed" (posição calculada a partir do botão, em pixels da tela) só
      // na hora de abrir — isso faz o menu "escapar" de QUALQUER container
      // com scroll no caminho e aparecer por cima de tudo, do tamanho certo
      // (nunca mais estreito que o botão). Fecha sozinho ao rolar (ver o
      // listener global de "scroll" mais acima) pra nunca ficar "flutuando"
      // longe do botão que abriu.
      function positionMenu() {
        var rect = trigger.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.left = rect.left + "px";
        menu.style.minWidth = Math.max(rect.width, 200) + "px";
        // Quando a tabela tem poucas linhas (ex: filtro deixando só 1 item),
        // o botão fica perto do topo da página, mas isso não impede que ele
        // esteja perto do FIM da JANELA (barra de filtros/criação acima
        // empurra tudo pra baixo). O menu é "fixed" (escapa do scroll
        // horizontal da tabela — ver comentário acima), então o que passar
        // da borda de baixo da janela simplesmente some, sem jeito de rolar
        // até lá (posição fixed não participa do scroll da página). Aqui a
        // gente mede o espaço livre embaixo x em cima do botão: se não
        // couber pelo menos o "teto" de sempre (320px, ver CSS
        // ".filter-menu") nem uma altura mínima razoável embaixo, o menu
        // abre pra CIMA em vez de pra baixo; em qualquer um dos dois casos,
        // a altura máxima é limitada ao espaço realmente disponível, então
        // o scroll interno dele (".filter-menu { overflow-y: auto }") tem
        // como aparecer e funcionar de verdade.
        var margin = 8;
        var spaceBelow = window.innerHeight - rect.bottom - margin;
        var spaceAbove = rect.top - margin;
        var maxHeightCap = 320;
        // BUG real (Georges: "não exibe a lista" no caso de abrir pra cima):
        // limpar "menu.style.top" com "" não REMOVE o "top: calc(100% + 4px)"
        // que o CSS (".filter-menu") já define por padrão — só tira o valor
        // inline, deixando a regra do CSS valer nesse caso. Resultado: no
        // ramo "abre pra cima" a gente definia SÓ "bottom" (inline), mas
        // "top" voltava a valer "calc(100% + 4px)" relativo à JANELA (não ao
        // botão, já que é "fixed") — ou seja, quase 100% da altura da tela,
        // BEM abaixo de onde "bottom" posicionava a base do menu. Com "top"
        // abaixo de "bottom", a altura calculada (bottom menos top) dá
        // negativa, o navegador zera a caixa e o menu simplesmente some,
        // mesmo com ".open" aplicada. Precisa OVERPOR o CSS de propósito com
        // "auto" (não limpar), nunca deixar os dois "top"/"bottom" com
        // valor ao mesmo tempo.
        if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
          menu.style.top = (rect.bottom + 4) + "px";
          menu.style.bottom = "auto";
          menu.style.maxHeight = Math.max(120, Math.min(maxHeightCap, spaceBelow)) + "px";
        } else {
          menu.style.top = "auto";
          menu.style.bottom = (window.innerHeight - rect.top + 4) + "px";
          menu.style.maxHeight = Math.max(120, Math.min(maxHeightCap, spaceAbove)) + "px";
        }
      }

      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = menu.classList.contains("open");
        if (isOpen) {
          menu.classList.remove("open");
        } else {
          positionMenu();
          menu.classList.add("open");
          wasOpen = true;
        }
      });

      // avisa quando o menu FECHA — não quando cada opção é marcada/
      // desmarcada (ver "onChange" abaixo, esse sim dispara a cada clique).
      // Precisa disso separado porque o menu pode fechar de 3 jeitos
      // diferentes (clicar de novo no botão, clicar fora — listener global
      // de "click" — ou rolar fora dele — listener global de "scroll"), e
      // só o primeiro passa por aqui; um MutationObserver na classe do menu
      // pega os 3 casos de uma vez só, sem precisar mexer nos listeners
      // globais.
      if (window.MutationObserver) {
        new MutationObserver(function () {
          if (wasOpen && !menu.classList.contains("open")) {
            wasOpen = false;
            if (onCloseCb) onCloseCb(values.slice());
          }
        }).observe(menu, { attributes: true, attributeFilter: ["class"] });
      }

      wrap.appendChild(trigger);
      wrap.appendChild(menu);

      wrap.getValues = function () { return values.slice(); };
      wrap.setValues = function (arr) { setValues(arr, true); };
      // dispara a CADA marcar/desmarcar (ex: filtro por coluna, que só
      // refiltra em memória — sem chamada ao Worker, sem problema nenhum
      // em disparar toda hora).
      wrap.onChange = function (fn) { onChangeCb = fn; };
      // dispara só quando o menu FECHA, com o valor final (ex: célula
      // editável da tabela, que salva no Worker e recarrega a lista
      // inteira — se disparasse a cada clique, a lista recarregava no meio
      // da seleção e derrubava o próprio menu que o usuário estava usando).
      wrap.onClose = function (fn) { onCloseCb = fn; };

      updateTrigger();
      return wrap;
    }

    // ---- "Criação" e "Pesquisa e Filtros Gerais" (pedido do Georges):
    // mesma ideia de divisória recolhível de "Filtros rápidos" (botão de
    // seta + recolhida por padrão no celular), só que pra linha de criação
    // e pra barra de filtros por coluna/busca — que ANTES ficavam soltas,
    // sempre visíveis, ocupando espaço mesmo quando não estão em uso.
    // Helper genérico (não usado por "Filtros rápidos", que já tinha o
    // próprio mecanismo pronto de antes — ver qfSection acima, não mexido).
    function buildCollapsibleSection(titleText) {
      var collapsed = !!(window.matchMedia && window.matchMedia("(max-width: 1023px)").matches);
      var sec = document.createElement("div");
      sec.className = "priorities-subsection";
      var header = document.createElement("div");
      header.className = "priorities-subsection-header";
      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "query-collapse-btn priorities-subsection-collapse-btn";
      toggleBtn.setAttribute("aria-label", "Recolher/expandir " + titleText);
      var icon = document.createElement("i");
      header.appendChild(toggleBtn);
      toggleBtn.appendChild(icon);
      var h = document.createElement("h4");
      h.className = "priorities-subsection-title";
      h.textContent = titleText;
      header.appendChild(h);
      var body = document.createElement("div");
      body.className = "priorities-subsection-body";
      function applyCollapsed() {
        sec.classList.toggle("collapsed", collapsed);
        icon.className = collapsed ? "ti ti-chevron-right" : "ti ti-chevron-down";
      }
      toggleBtn.addEventListener("click", function () { collapsed = !collapsed; applyCollapsed(); });
      applyCollapsed();
      sec.appendChild(header);
      sec.appendChild(body);
      return { section: sec, body: body };
    }
    var creationSection = buildCollapsibleSection("Criação");
    var searchSection = buildCollapsibleSection("Pesquisa e Filtros Gerais");

    // ---- linha de criação — um <select> (ou checkbox-dropdown, pra "forma")
    // por coluna de opção + 3 campos de texto (Assunto é o único
    // obrigatório, igual "text" em Anotações Rápidas) + botão Adicionar.
    var formRow = document.createElement("div");
    formRow.className = "priorities-form-grid";
    var formSelects = {};
    fieldKeys.forEach(function (key) {
      var label = (fieldDefs[key] && fieldDefs[key].label) || key;
      var control = isMultiField(key)
        ? buildMultiCheckDropdown(key, label, "priorities-form-select")
        : makeSelect("priorities-form-select", key, true, label);
      formSelects[key] = control;
      formRow.appendChild(control);
    });
    var formTextInputs = {};
    textKeys.forEach(function (key) {
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "priorities-form-text";
      inp.placeholder = textLabels[key] + (key === "assunto" ? " *" : "");
      formTextInputs[key] = inp;
      formRow.appendChild(inp);
    });
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "notes-add-btn priorities-add-btn";
    addBtn.innerHTML = '<i class="ti ti-plus"></i> Adicionar';
    formRow.appendChild(addBtn);
    creationSection.body.appendChild(formRow);
    section.appendChild(creationSection.section);

    // ---- barra de filtros — um <select> por coluna de opção (+ "Todos"),
    // status (Todas/Pendentes/Concluídas) e busca textual (Origem/Assunto).
    var filterRow = document.createElement("div");
    filterRow.className = "priorities-form-grid priorities-filter-row";
    var filterSelects = {};
    fieldKeys.forEach(function (key) {
      var label = (fieldDefs[key] && fieldDefs[key].label) || key;
      if (isMultiField(key)) {
        var control = buildMultiCheckDropdown(key, label + ": Todos", "notes-filter-select");
        filterSelects[key] = control;
        filterRow.appendChild(control);
        return;
      }
      var sel = makeSelect("notes-filter-select", key, true, label + ": Todos");
      // prefixa cada opção com o nome do filtro, igual aos filtros de
      // Anotações Rápidas (ex: "Tipo: PMF"), pra não ficar sem contexto.
      Array.prototype.forEach.call(sel.options, function (o) {
        if (o.value) o.textContent = label + ": " + o.value;
      });
      filterSelects[key] = sel;
      filterRow.appendChild(sel);
    });
    var statusSelect = document.createElement("select");
    statusSelect.className = "notes-filter-select";
    [["all", "Status: Todas"], ["pending", "Status: Pendentes"], ["done", "Status: Concluídas"]].forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      statusSelect.appendChild(opt);
    });
    statusSelect.value = "pending";
    filterRow.appendChild(statusSelect);
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "notes-add-btn priorities-clear-btn";
    clearBtn.textContent = "Limpar filtros";
    filterRow.appendChild(clearBtn);
    // busca vai por último e numa linha própria (".priorities-search-input"
    // força quebra abaixo dos demais filtros — ver CSS) — pedido do Georges
    // pra separar a busca textual dos filtros de coluna.
    var searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "notes-filter-input priorities-search-input";
    searchInput.placeholder = "Pesquisar (Origem/Assunto)...";
    filterRow.appendChild(searchInput);
    searchSection.body.appendChild(filterRow);
    section.appendChild(searchSection.section);

    var errorMsg = document.createElement("p");
    errorMsg.className = "notes-error";
    errorMsg.style.display = "none";
    section.appendChild(errorMsg);
    function showErr(err) {
      errorMsg.textContent = "Não foi possível salvar: " + ((err && err.message) || "erro desconhecido") + ". Tente de novo.";
      errorMsg.style.display = "block";
    }
    function hideErr() { errorMsg.style.display = "none"; }

    // ---- tabela de verdade (cabeçalho fixo com nome de cada coluna,
    // clicável pra classificar — pedido do Georges) em vez da lista de
    // cartões usada em Anotações Rápidas. "priorities-table-wrap" dá o
    // scroll horizontal no celular (a tabela não encolhe, ela desliza).
    var columns = [
      { key: "tipo", label: (fieldDefs.tipo && fieldDefs.tipo.label) || "Tipo" },
      { key: "prioridade", label: (fieldDefs.prioridade && fieldDefs.prioridade.label) || "Prioridade" },
      { key: "tempo", label: (fieldDefs.tempo && fieldDefs.tempo.label) || "Tempo" },
      { key: "forma", label: (fieldDefs.forma && fieldDefs.forma.label) || "Forma" },
      { key: "programacao", label: (fieldDefs.programacao && fieldDefs.programacao.label) || "Programação" },
      { key: "tributo", label: (fieldDefs.tributo && fieldDefs.tributo.label) || "Tributo" },
      { key: "origem", label: "Origem" },
      { key: "assunto", label: "Assunto" }
    ];
    // colunas "de opção" ordenam pela posição na lista fixa (ex: "1 -
    // Imediato" antes de "2 - Urgente"), não por ordem alfabética — pra
    // Prioridade e Tempo isso é o que faz sentido; as de texto livre
    // ordenam por ordem alfabética normal. Vazio sempre vai pro final.
    // Padrão (pedido do Georges): a lista sempre abre ordenada por
    // Prioridade, independente dos filtros aplicados — só muda se ele
    // clicar em cima do nome de outra coluna (comportamento de sempre,
    // ver o clique no "th" mais abaixo).
    var sortState = { key: "prioridade", dir: 1 };

    // ---- "Editar opções" de cada coluna (pedido do Georges — diferente
    // dos botões de "Filtros rápidos" lá em cima, isso aqui edita a lista
    // de opções DE VERDADE de cada campo, a mesma usada nos <select>/
    // checkboxes de criar e editar item). Um ícone de engrenagem no
    // cabeçalho de cada uma das 7 colunas "de opção" abre um painel
    // flutuante (mesma classe ".filter-menu" das outras listas suspensas
    // do app — reaproveita o posicionamento "fixed" que já escapa do
    // scroll horizontal da tabela, e os listeners globais de clicar fora/
    // rolar que já fecham ".filter-menu.open" sozinhos).
    var optionsPanelOpenKey = null;

    function toggleOptionsPanel(key, anchorEl) {
      var existing = document.querySelector(".priorities-options-panel.open");
      if (existing) {
        var wasKey = existing.dataset.fieldKey;
        existing.classList.remove("open");
        existing.remove();
        optionsPanelOpenKey = null;
        if (wasKey === key) return; // só clicou pra fechar o mesmo painel
      }
      optionsPanelOpenKey = key;
      var panel = buildFieldOptionsPanel(key);
      panel.dataset.fieldKey = key;
      document.body.appendChild(panel);
      var rect = anchorEl.getBoundingClientRect();
      panel.style.position = "fixed";
      panel.style.top = (rect.bottom + 6) + "px";
      panel.style.left = Math.max(8, Math.min(rect.left - 200, window.innerWidth - 300)) + "px";
    }

    // caixinha de gerenciar as opções de UM campo — lista com renomear (i)/
    // excluir (x) por opção, mais uma linha de adicionar no final. Cada
    // ação chama /priorities-options na hora (uma ação por vez — ver
    // worker.js) e, se der certo, atualiza fieldDefs[key].options com a
    // resposta fresca do Worker e remonta a página inteira (mesmo truque
    // já usado depois de salvar um filtro rápido) — assim a linha de
    // criação, a barra de filtros, a tabela E os outros painéis de opção
    // ficam todos sincronizados de uma vez, sem precisar mexer em cada um
    // na mão.
    function buildFieldOptionsPanel(key) {
      var label = (fieldDefs[key] && fieldDefs[key].label) || key;
      var panel = document.createElement("div");
      panel.className = "filter-menu priorities-options-panel open";

      var title = document.createElement("div");
      title.className = "priorities-options-panel-title";
      title.textContent = "Opções de " + label;
      panel.appendChild(title);

      var errBox = document.createElement("p");
      errBox.className = "priorities-options-panel-error";
      errBox.style.display = "none";
      panel.appendChild(errBox);
      function showPanelErr(msg) { errBox.textContent = msg; errBox.style.display = "block"; }
      function hidePanelErr() { errBox.style.display = "none"; }

      var list = document.createElement("div");
      list.className = "priorities-options-panel-list";
      panel.appendChild(list);

      var renamingValue = null; // valor da opção sendo renomeada agora, ou null

      function callApi(body) {
        return authFetch(cfg.templateWorkerUrl + "/priorities-options", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then(handle401).then(function (r) { return r.json(); });
      }

      function applyFreshOptions(opts) {
        if (opts && Array.isArray(opts[key]) && fieldDefs[key]) fieldDefs[key].options = opts[key];
        panel.remove();
        optionsPanelOpenKey = null;
        container.innerHTML = "";
        renderPrioritiesTable(container, page);
      }

      function renderPanelList() {
        list.innerHTML = "";
        var options = (fieldDefs[key] && fieldDefs[key].options) || [];
        options.forEach(function (opt) {
          var row = document.createElement("div");
          row.className = "priorities-options-panel-row";
          if (renamingValue === opt) {
            var input = document.createElement("input");
            input.type = "text";
            input.className = "priorities-options-panel-input";
            input.value = opt;
            row.appendChild(input);
            var saveBtnOpt = document.createElement("button");
            saveBtnOpt.type = "button";
            saveBtnOpt.className = "notes-add-btn";
            saveBtnOpt.textContent = "Salvar";
            saveBtnOpt.addEventListener("click", function () {
              var newValue = input.value.trim();
              if (!newValue || newValue === opt) { renamingValue = null; renderPanelList(); return; }
              hidePanelErr();
              callApi({ field: key, action: "rename", value: opt, newValue: newValue }).then(function (data) {
                if (data && data.error) { showPanelErr(data.error); return; }
                applyFreshOptions(data.options);
              }).catch(function () { showPanelErr("Não foi possível salvar. Tente de novo."); });
            });
            input.addEventListener("keydown", function (e) { if (e.key === "Enter") saveBtnOpt.click(); });
            var cancelBtnOpt = document.createElement("button");
            cancelBtnOpt.type = "button";
            cancelBtnOpt.className = "priorities-clear-btn";
            cancelBtnOpt.textContent = "Cancelar";
            cancelBtnOpt.addEventListener("click", function () { renamingValue = null; hidePanelErr(); renderPanelList(); });
            row.appendChild(saveBtnOpt);
            row.appendChild(cancelBtnOpt);
          } else {
            var span = document.createElement("span");
            span.className = "priorities-options-panel-label";
            span.textContent = opt;
            row.appendChild(span);
            var renameIcon = document.createElement("i");
            renameIcon.className = "ti ti-pencil priorities-options-panel-action";
            renameIcon.title = "Renomear";
            renameIcon.addEventListener("click", function () { renamingValue = opt; hidePanelErr(); renderPanelList(); });
            row.appendChild(renameIcon);
            var delIcon = document.createElement("i");
            delIcon.className = "ti ti-x priorities-options-panel-action";
            delIcon.title = "Excluir";
            delIcon.addEventListener("click", function () {
              hidePanelErr();
              callApi({ field: key, action: "delete", value: opt }).then(function (data) {
                if (data && data.error) { showPanelErr(data.error); return; }
                applyFreshOptions(data.options);
              }).catch(function () { showPanelErr("Não foi possível excluir. Tente de novo."); });
            });
            row.appendChild(delIcon);
          }
          list.appendChild(row);
        });
      }
      renderPanelList();

      var addRow = document.createElement("div");
      addRow.className = "priorities-options-panel-add";
      var addInput = document.createElement("input");
      addInput.type = "text";
      addInput.className = "priorities-options-panel-input";
      addInput.placeholder = "Nova opção...";
      var addBtnOpt = document.createElement("button");
      addBtnOpt.type = "button";
      addBtnOpt.className = "notes-add-btn";
      addBtnOpt.innerHTML = '<i class="ti ti-plus"></i>';
      function doAddOption() {
        var value = addInput.value.trim();
        if (!value) return;
        hidePanelErr();
        callApi({ field: key, action: "add", value: value }).then(function (data) {
          if (data && data.error) { showPanelErr(data.error); return; }
          applyFreshOptions(data.options);
        }).catch(function () { showPanelErr("Não foi possível adicionar. Tente de novo."); });
      }
      addBtnOpt.addEventListener("click", doAddOption);
      addInput.addEventListener("keydown", function (e) { if (e.key === "Enter") doAddOption(); });
      addRow.appendChild(addInput);
      addRow.appendChild(addBtnOpt);
      panel.appendChild(addRow);

      // some sozinho quando os listeners globais de clicar fora/rolar
      // tiram a classe "open" (mesmo mecanismo do menu de buildMultiCheck
      // Dropdown lá em cima) — sem isso o painel ficaria "fechado" (CSS
      // display:none) mas continuaria pendurado no <body> pra sempre.
      if (window.MutationObserver) {
        new MutationObserver(function () {
          if (!panel.classList.contains("open")) {
            panel.remove();
            if (optionsPanelOpenKey === key) optionsPanelOpenKey = null;
          }
        }).observe(panel, { attributes: true, attributeFilter: ["class"] });
      }

      return panel;
    }

    // ---- Recolher/expandir colunas (pedido do Georges) — por padrão só
    // mostra ALGUMAS colunas (menos numa tela pequena, mais numa tela
    // grande — só olha o tamanho UMA vez, na hora de montar a página,
    // mesma ideia das outras divisórias). Um botão mostra TODAS de uma vez
    // (e volta a recolher pro padrão de novo, clicando outra vez). Além
    // disso, aplicar um filtro (rápido OU geral) numa coluna que estava
    // escondida REVELA ela sozinha, mesmo sem apertar o botão — faz
    // sentido ver a coluna que você acabou de filtrar.
    var allColumnKeys = columns.map(function (c) { return c.key; });
    var defaultVisibleColumnKeys;
    if (window.matchMedia && window.matchMedia("(min-width: 1024px)").matches) {
      defaultVisibleColumnKeys = allColumnKeys.slice(); // tela grande: tudo visível já de cara
    } else if (window.matchMedia && window.matchMedia("(min-width: 640px)").matches) {
      // celular "aberto" (na horizontal/maior), tablet, ou tela menor de
      // computador (pedido do Georges).
      defaultVisibleColumnKeys = ["tipo", "prioridade", "tributo", "origem", "assunto"];
    } else {
      // celular fechado/tela pequena (pedido do Georges).
      defaultVisibleColumnKeys = ["prioridade", "tributo", "origem", "assunto"];
    }
    var columnsExpanded = false;

    // uma coluna conta como "tem filtro aplicado" se o <select>/checkbox
    // dela (barra de "Pesquisa e Filtros Gerais") estiver com algo
    // marcado, OU se algum botão de "Filtros rápidos" que aponta pra ela
    // estiver ativo (inclusive "Grupo", que apesar do nome mira a coluna
    // Programação — ver "field" em page.quickFilters no config.js).
    function hasActiveFilterForColumn(key) {
      if (fieldKeys.indexOf(key) !== -1 && filterSelects[key]) {
        if (isMultiField(key)) { if (filterSelects[key].getValues().length) return true; }
        else if (filterSelects[key].value) return true;
      }
      for (var gi = 0; gi < qfGroups.length; gi++) {
        var group = qfGroups[gi];
        var groupField = group.field || group.key;
        if (groupField === key && (qfActive[group.key] || []).length) return true;
      }
      return false;
    }

    function getEffectiveVisibleColumns() {
      if (columnsExpanded) return allColumnKeys.slice();
      var visible = defaultVisibleColumnKeys.slice();
      allColumnKeys.forEach(function (key) {
        if (visible.indexOf(key) === -1 && hasActiveFilterForColumn(key)) visible.push(key);
      });
      return visible;
    }

    // some/aparece via CSS (".priorities-table.hide-<key> .priorities-col-
    // <key>") — mais barato que reconstruir a tabela, e não bagunça o
    // scroll horizontal que já existe. Chamada de novo toda vez que um
    // filtro muda (ver applyFilters) e ao clicar no botão de expandir.
    function updateColumnVisibility() {
      var visible = getEffectiveVisibleColumns();
      allColumnKeys.forEach(function (key) {
        table.classList.toggle("hide-" + key, visible.indexOf(key) === -1);
      });
      var hiddenCount = allColumnKeys.length - visible.length;
      columnsToggleBtn.innerHTML = columnsExpanded
        ? '<i class="ti ti-chevron-up"></i> Mostrar menos colunas'
        : '<i class="ti ti-chevron-down"></i> Mostrar todas as colunas' + (hiddenCount ? " (+" + hiddenCount + ")" : "");
    }

    var columnsToolbar = document.createElement("div");
    columnsToolbar.className = "priorities-columns-toolbar";
    var columnsToggleBtn = document.createElement("button");
    columnsToggleBtn.type = "button";
    columnsToggleBtn.className = "priorities-clear-btn priorities-columns-toggle-btn";
    columnsToggleBtn.addEventListener("click", function () {
      columnsExpanded = !columnsExpanded;
      updateColumnVisibility();
    });
    columnsToolbar.appendChild(columnsToggleBtn);
    // não faz sentido mostrar o botão se o padrão da tela já é "tudo
    // visível" (telas grandes) — não teria o que expandir.
    if (defaultVisibleColumnKeys.length < allColumnKeys.length) {
      section.appendChild(columnsToolbar);
    }

    var tableWrap = document.createElement("div");
    tableWrap.className = "priorities-table-wrap";
    var table = document.createElement("table");
    table.className = "priorities-table";
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");

    // coluna vazia mais à ESQUERDA de tudo — só existe pra abrigar o botão
    // de expandir/recolher a checklist de cada linha (pedido do Georges:
    // "à esquerda inclusive do checkbox"). Mesmo tratamento visual de
    // th-check/th-actions (largura mínima, sem título).
    var thToggle = document.createElement("th");
    thToggle.className = "priorities-th priorities-th-toggle";
    headRow.appendChild(thToggle);

    var thCheck = document.createElement("th");
    thCheck.className = "priorities-th priorities-th-check";
    headRow.appendChild(thCheck);

    columns.forEach(function (col) {
      var th = document.createElement("th");
      th.className = "priorities-th priorities-th-sortable priorities-col-" + col.key;
      th.dataset.key = col.key;
      th.title = "Clique para classificar por " + col.label;
      var thLabel = document.createElement("span");
      thLabel.className = "priorities-th-label";
      thLabel.textContent = col.label;
      var thArrow = document.createElement("span");
      thArrow.className = "priorities-th-arrow";
      th.appendChild(thLabel);
      // engrenagem de "editar opções" — só nas 6 colunas de opção (as 2 de
      // texto livre, Origem/Assunto, não têm lista fixa pra editar).
      // "stopPropagation" pra não disparar o clique de ordenar.
      if (fieldKeys.indexOf(col.key) !== -1) {
        var editIcon = document.createElement("i");
        editIcon.className = "ti ti-settings priorities-th-edit-options";
        editIcon.title = "Editar opções de " + col.label;
        editIcon.addEventListener("click", function (e) {
          e.stopPropagation();
          toggleOptionsPanel(col.key, editIcon);
        });
        th.appendChild(editIcon);
      }
      th.appendChild(thArrow);
      th.addEventListener("click", function () {
        if (sortState.key === col.key) sortState.dir = sortState.dir * -1;
        else { sortState.key = col.key; sortState.dir = 1; }
        refreshHeaderIndicators();
        applyFilters();
      });
      headRow.appendChild(th);
    });

    var thActions = document.createElement("th");
    thActions.className = "priorities-th priorities-th-actions";
    headRow.appendChild(thActions);

    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    section.appendChild(tableWrap);
    container.appendChild(section);

    function refreshHeaderIndicators() {
      Array.prototype.forEach.call(headRow.querySelectorAll(".priorities-th-sortable"), function (th) {
        var arrow = th.querySelector(".priorities-th-arrow");
        if (th.dataset.key === sortState.key) {
          th.classList.add("active");
          arrow.textContent = sortState.dir === 1 ? "▲" : "▼";
        } else {
          th.classList.remove("active");
          arrow.textContent = "";
        }
      });
    }
    // já mostra a seta em "Prioridade" desde o início (sortState já nasce
    // apontando pra ela, ver acima) — sem isso o cabeçalho ficaria "mudo"
    // até o primeiro clique, mesmo já ordenando por Prioridade por baixo.
    refreshHeaderIndicators();
    // já aplica o padrão de colunas visíveis dessa tela desde o início —
    // sem isso a tabela abriria com TODAS as colunas por um instante antes
    // de esconder as que não são padrão.
    updateColumnVisibility();

    var allItems = [];
    // id do item cujo campo "novo subitem" deve receber o foco de volta
    // assim que a tabela terminar de recarregar (ver renderList mais abaixo
    // e o addRow dentro de renderSubitems) — pra dar pra digitar vários
    // subitens seguidos sem precisar clicar de novo a cada um.
    var pendingFocusSubitemAddId = null;

    function handle401(res) {
      if (res.status === 401 && window.Auth) { Auth.signOut(); throw new Error("Faça login de novo pra continuar."); }
      return res;
    }

    // pra campo de seleção múltipla (só "forma"), usa a posição do valor
    // "mais prioritário" (menor índice na lista fixa) dentre os marcados —
    // ex: item com Forma = ["Notion","Chrome"] ordena pela posição de
    // "Chrome" (vem antes de "Notion" na lista). Sem nenhum marcado, vai
    // pro final, igual campo vazio nos de seleção única.
    function minOptionIndex(arr, opts) {
      arr = arr || [];
      if (!arr.length) return opts.length;
      var min = opts.length;
      arr.forEach(function (v) {
        var idx = opts.indexOf(v);
        if (idx === -1) idx = opts.length;
        if (idx < min) min = idx;
      });
      return min;
    }

    function sortItems(items) {
      if (!sortState.key) return items;
      var key = sortState.key;
      var opts = (fieldDefs[key] && fieldDefs[key].options) || null;
      var multi = isMultiField(key);
      var copy = items.slice();
      copy.sort(function (a, b) {
        var av, bv, cmp;
        if (opts && multi) {
          av = minOptionIndex(a[key], opts);
          bv = minOptionIndex(b[key], opts);
          cmp = av - bv;
        } else if (opts) {
          av = opts.indexOf(a[key] || ""); if (av === -1) av = opts.length;
          bv = opts.indexOf(b[key] || ""); if (bv === -1) bv = opts.length;
          cmp = av - bv;
        } else {
          av = (a[key] || "");
          bv = (b[key] || "");
          if (!av && bv) return 1;
          if (av && !bv) return -1;
          cmp = av.localeCompare(bv, "pt-BR");
        }
        return cmp * sortState.dir;
      });
      return copy;
    }

    function applyFilters() {
      // roda ANTES de filtrar/desenhar a lista — reflete na hora qualquer
      // coluna que passou a ter filtro ativo (ver hasActiveFilterForColumn),
      // pra ela já aparecer revelada junto com o resultado filtrado.
      updateColumnVisibility();
      var q = searchInput.value.trim().toLowerCase();
      var status = statusSelect.value;
      var filtered = allItems.filter(function (it) {
        if (status === "pending" && it.done) return false;
        if (status === "done" && !it.done) return false;
        for (var i = 0; i < fieldKeys.length; i++) {
          var key = fieldKeys[i];
          if (isMultiField(key)) {
            var wantList = filterSelects[key].getValues();
            if (wantList.length) {
              var have = it[key] || [];
              var anyMatch = wantList.some(function (w) { return have.indexOf(w) !== -1; });
              if (!anyMatch) return false;
            }
          } else {
            var want = filterSelects[key].value;
            if (want && it[key] !== want) return false;
          }
        }
        // "Filtros rápidos" (ver qfActiveValues acima) — INDEPENDENTE do
        // filtro por coluna de cima, os dois se combinam com "E". Percorre
        // os GRUPOS de atalho (não "fieldKeys") porque um grupo pode
        // representar uma coluna diferente do seu próprio nome — hoje só
        // "Grupo" faz isso (field: "programacao", ver page.quickFilters no
        // config.js); os demais grupos usam a própria "key" como campo.
        for (var gi = 0; gi < qfGroups.length; gi++) {
          var group = qfGroups[gi];
          var groupField = group.field || group.key;
          var qWant = qfActiveValues(group.key);
          if (qWant) {
            var qHave = isMultiField(groupField) ? (it[groupField] || []) : [it[groupField]];
            var qMatch = qWant.some(function (w) { return qHave.indexOf(w) !== -1; });
            if (!qMatch) return false;
          }
        }
        if (q) {
          var hay = ((it.origem || "") + " " + (it.assunto || "")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
      renderList(sortItems(filtered));
    }

    function renderList(items) {
      tbody.innerHTML = "";
      if (!items.length) {
        var emptyRow = document.createElement("tr");
        var emptyCell = document.createElement("td");
        emptyCell.className = "empty";
        emptyCell.colSpan = columns.length + 3;
        emptyCell.textContent = allItems.length ? "Nenhum item bate com o filtro." : "Nenhum item ainda.";
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
      }
      items.forEach(function (it) {
        var row = document.createElement("tr");
        row.className = "priorities-row" + (it.done ? " done" : "");

        // botão de expandir/recolher a checklist — coluna própria, a mais à
        // ESQUERDA de tudo (pedido do Georges: "à esquerda inclusive do
        // checkbox"). Só o BOTÃO nasce aqui (perto do checkbox, mesma
        // "linha de raciocínio" de antes); a lógica de show/hide
        // (applySubitemsCollapsed) só pode ser montada mais abaixo, depois
        // que "subitemsRow"/"subitemsWrap" existirem — o listener de clique
        // é ligado lá, não aqui.
        var toggleCell = document.createElement("td");
        toggleCell.className = "priorities-toggle-cell";
        var toggleSubitemsBtn = document.createElement("button");
        toggleSubitemsBtn.type = "button";
        toggleSubitemsBtn.className = "notes-item-addtag priorities-subitems-toggle";
        toggleCell.appendChild(toggleSubitemsBtn);
        row.appendChild(toggleCell);

        var checkCell = document.createElement("td");
        var check = document.createElement("input");
        check.type = "checkbox";
        check.className = "notes-item-check";
        check.checked = !!it.done;
        check.title = "Marcar como concluída";
        check.addEventListener("change", function () { updateItem(it.id, { done: check.checked }); });
        checkCell.appendChild(check);
        row.appendChild(checkCell);

        fieldKeys.forEach(function (key) {
          var cell = document.createElement("td");
          cell.className = "priorities-col-" + key;
          var label = (fieldDefs[key] && fieldDefs[key].label) || key;
          if (isMultiField(key)) {
            var control = buildMultiCheckDropdown(key, label, "priorities-cell-select");
            control.setValues(it[key] || []);
            // "onClose" (não "onChange") — salva só quando o menu fecha,
            // com o valor final já com todas as marcações feitas. Salvar a
            // CADA clique recarregaria a lista inteira no meio da seleção
            // (updateItem -> loadItems -> tbody reconstruído do zero),
            // derrubando o próprio menu que o usuário estava usando.
            control.onClose(function (vals) {
              var patch = {};
              patch[key] = vals;
              updateItem(it.id, patch);
            });
            cell.appendChild(control);
          } else {
            var sel = makeSelect("priorities-cell-select", key, true, label);
            sel.value = it[key] || "";
            sel.addEventListener("change", function () {
              var patch = {};
              patch[key] = sel.value;
              updateItem(it.id, patch);
            });
            cell.appendChild(sel);
          }
          row.appendChild(cell);
        });

        textKeys.forEach(function (key) {
          var cell = document.createElement("td");
          cell.className = "priorities-col-" + key;
          var inp = document.createElement("input");
          inp.type = "text";
          inp.className = "priorities-cell-text";
          inp.placeholder = textLabels[key];
          inp.value = it[key] || "";
          function commit() {
            var v = inp.value.trim();
            if (key === "assunto" && !v) { inp.value = it.assunto || ""; return; }
            if (v === (it[key] || "")) return;
            var patch = {};
            patch[key] = v;
            updateItem(it.id, patch);
          }
          inp.addEventListener("blur", commit);
          inp.addEventListener("keydown", function (e) { if (e.key === "Enter") inp.blur(); });
          cell.appendChild(inp);
          row.appendChild(cell);
        });

        var actionsCell = document.createElement("td");
        actionsCell.className = "priorities-actions";

        // botão de criar/editar nota do item (pedido do Georges — "além do
        // botão de criar tasks, queria poder criar nota também, para
        // alguns casos"). Diferente da checklist (que é uma LISTA de
        // subitens), a nota é UM campo de texto livre por item ("it.nota"
        // — ver handlePrioritiesCreate/Update no worker.js), pensado pra
        // observação/contexto solto, não pra tarefa. "has-note" agora
        // preenche o ícone TOTALMENTE (pedido do Georges — antes só mudava
        // a cor do contorno, pouco destaque) — mesmo SVG desenhado à mão da
        // estrela (ver makeNoteSvg acima), já que o ícone de fonte não tem
        // versão preenchida.
        var addNoteBtn = document.createElement("button");
        addNoteBtn.type = "button";
        addNoteBtn.className = "notes-item-addtag priorities-note-toggle" + ((it.nota || "").trim() ? " has-note" : "");
        addNoteBtn.appendChild(makeNoteSvg());
        addNoteBtn.title = (it.nota || "").trim() ? "Ver/editar nota" : "Criar nota";
        addNoteBtn.addEventListener("click", function () {
          noteExpanded = !noteExpanded;
          applyNoteCollapsed();
          if (noteExpanded) { noteTextarea.focus(); }
        });

        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "notes-item-del";
        delBtn.innerHTML = '<i class="ti ti-x"></i>';
        delBtn.title = "Apagar";
        delBtn.addEventListener("click", function () { removeItem(it.id); });

        actionsCell.appendChild(addNoteBtn);
        actionsCell.appendChild(delBtn);
        row.appendChild(actionsCell);
        tbody.appendChild(row);

        // checklist — linha própria logo abaixo, ocupando todas as colunas
        // (mesmíssimo mecanismo/classes de Anotações Rápidas). "data-item-id"
        // só serve pra recuperar essa linha depois de um reload completo da
        // tabela (ver "pendingFocusSubitemAddId" mais abaixo — devolve o
        // foco pro campo de novo subitem depois de adicionar um, já que
        // updateItem sempre recarrega a lista inteira do zero).
        var subitemsRow = document.createElement("tr");
        subitemsRow.className = "priorities-subitems-row";
        subitemsRow.dataset.itemId = it.id;
        var subitemsCell = document.createElement("td");
        subitemsCell.colSpan = columns.length + 3;
        var subitemsWrap = document.createElement("div");
        subitemsWrap.className = "notes-subitems";
        subitemsCell.appendChild(subitemsWrap);
        subitemsRow.appendChild(subitemsCell);
        tbody.appendChild(subitemsRow);

        // nota do item — linha própria, sempre recolhida ao abrir (mesmo
        // padrão da checklist), com uma <textarea> só (não é lista); salva
        // ao perder o foco, só se o texto realmente mudou.
        var noteRow = document.createElement("tr");
        noteRow.className = "priorities-note-row collapsed";
        var noteCell = document.createElement("td");
        noteCell.colSpan = columns.length + 3;
        var noteTextarea = document.createElement("textarea");
        noteTextarea.className = "priorities-note-textarea";
        noteTextarea.placeholder = "Nota do item...";
        noteTextarea.value = it.nota || "";
        noteTextarea.addEventListener("blur", function () {
          var v = noteTextarea.value.trim();
          if (v !== (it.nota || "")) updateItem(it.id, { nota: v });
        });
        noteCell.appendChild(noteTextarea);
        noteRow.appendChild(noteCell);
        tbody.appendChild(noteRow);

        var noteExpanded = false;
        function applyNoteCollapsed() {
          noteRow.classList.toggle("collapsed", !noteExpanded);
        }

        // "sempre recolhido como padrão" (pedido do Georges) — recomeça
        // recolhido a cada renderização (recarregar a lista, filtrar etc.),
        // não é um estado guardado no item.
        var subitemsExpanded = false;

        // listener do botão — só dá pra ligar aqui (não lá na criação do
        // botão, mais acima) porque "applySubitemsCollapsed" só existe a
        // partir desta linha. Sempre visível agora (pedido do Georges —
        // antes só aparecia quando já existia pelo menos 1 subitem; agora é
        // ele mesmo quem "abre a porta" pro campo de criar o 1º subitem,
        // já que o botão avulso de "+" foi removido — ver renderSubitems
        // mais abaixo). Ao ABRIR, foca direto no campo de novo subitem, pra
        // já poder digitar sem precisar clicar de novo em nada.
        toggleSubitemsBtn.addEventListener("click", function () {
          subitemsExpanded = !subitemsExpanded;
          applySubitemsCollapsed();
          if (subitemsExpanded) {
            var addInput = subitemsWrap.querySelector(".notes-subitem-add-input");
            if (addInput) addInput.focus();
          }
        });

        function applySubitemsCollapsed() {
          var count = (it.subitems || []).length;
          subitemsRow.classList.toggle("collapsed", !subitemsExpanded);
          toggleSubitemsBtn.innerHTML = '<i class="ti ti-chevron-' + (subitemsExpanded ? "up" : "down") + '"></i>' + (count ? " " + count : "");
          toggleSubitemsBtn.title = subitemsExpanded
            ? "Ocultar checklist"
            : (count ? "Exibir checklist (" + count + (count === 1 ? " item" : " itens") + ")" : "Exibir checklist / adicionar item");
        }

        function renderSubitems() {
          subitemsWrap.innerHTML = "";
          // sinalizadas primeiro (mesmo critério de ordenação usado em
          // Anotações Rápidas — ver "flagged ? 1 : 0" no renderNotesBlock),
          // sem mexer na ordem relativa das demais.
          var sortedSubitems = (it.subitems || []).slice().sort(function (a, b) {
            return (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0);
          });
          sortedSubitems.forEach(function (s) {
            var subRow = document.createElement("div");
            subRow.className = "notes-subitem" + (s.done ? " done" : "");

            var subCheck = document.createElement("input");
            subCheck.type = "checkbox";
            subCheck.className = "notes-subitem-check";
            subCheck.checked = !!s.done;
            subCheck.addEventListener("change", function () { toggleSubitem(it, s.id, subCheck.checked); });
            subRow.appendChild(subCheck);

            // estrela pra destacar o subitem mais relevante dentro do item
            // (pedido do Georges — "assim como fizemos em Anotações
            // Rápidas") — mesmíssimo mecanismo/ícone (makeStarSvg), só que
            // por SUBITEM em vez de por anotação.
            var subStarBtn = document.createElement("button");
            subStarBtn.type = "button";
            subStarBtn.className = "notes-item-star notes-subitem-star" + (s.flagged ? " flagged" : "");
            subStarBtn.appendChild(makeStarSvg());
            subStarBtn.title = s.flagged ? "Remover destaque" : "Destacar subitem";
            subStarBtn.addEventListener("click", function () { toggleSubitemFlag(it, s.id, !s.flagged); });
            subRow.appendChild(subStarBtn);

            // texto agora é editável (pedido do Georges — antes só dava pra
            // marcar como feito ou excluir): clique entra em modo edição
            // (vira <input>), Enter/blur salva, Escape cancela sem salvar.
            var subText = document.createElement("span");
            subText.className = "notes-subitem-text";
            subText.textContent = s.text;
            subText.title = "Clique para editar";
            subText.addEventListener("click", function () {
              if (subRow.querySelector(".notes-subitem-edit-input")) return;
              var editInput = document.createElement("input");
              editInput.type = "text";
              editInput.className = "notes-subitem-edit-input";
              editInput.value = s.text;
              subText.replaceWith(editInput);
              editInput.focus();
              editInput.select();
              var doneEditing = false;
              function commitEdit() {
                if (doneEditing) return;
                doneEditing = true;
                var v = editInput.value.trim();
                if (v && v !== s.text) editSubitem(it, s.id, v);
                else renderSubitems(); // sem mudança (ou vazio) — só redesenha, sem chamar o Worker à toa
              }
              editInput.addEventListener("keydown", function (e) {
                if (e.key === "Enter") commitEdit();
                else if (e.key === "Escape") { doneEditing = true; renderSubitems(); }
              });
              editInput.addEventListener("blur", function () { commitEdit(); });
            });
            subRow.appendChild(subText);

            // nota do SUBITEM (pedido do Georges — "conseguimos criar notas
            // vinculadas aos subitens... ícone de nota pra exibir as notas
            // existentes em cada subitem"). Mesmíssimo padrão da nota do
            // item (texto livre solto, "has-note" agora PREENCHE o ícone —
            // ver makeNoteSvg acima), só que a linha da textarea fica dentro
            // da própria checklist, logo abaixo desse subitem (não lá
            // embaixo da tabela como a nota do item) — ver subNoteRow mais
            // abaixo.
            var subNoteBtn = document.createElement("button");
            subNoteBtn.type = "button";
            subNoteBtn.className = "notes-subitem-del notes-subitem-note-toggle" + ((s.nota || "").trim() ? " has-note" : "");
            subNoteBtn.appendChild(makeNoteSvg());
            subNoteBtn.title = (s.nota || "").trim() ? "Ver/editar nota do subitem" : "Criar nota no subitem";
            subRow.appendChild(subNoteBtn);

            var subDelBtn = document.createElement("button");
            subDelBtn.type = "button";
            subDelBtn.className = "notes-subitem-del";
            subDelBtn.innerHTML = '<i class="ti ti-x"></i>';
            subDelBtn.title = "Apagar item";
            subDelBtn.addEventListener("click", function () { removeSubitem(it, s.id); });
            subRow.appendChild(subDelBtn);

            subitemsWrap.appendChild(subRow);

            // linha da nota do subitem — própria, logo abaixo dele, recolhida
            // por padrão (mesmo mecanismo de "collapsed" do noteRow do item,
            // só que por subitem). O botão acima só alterna essa classe.
            var subNoteRow = document.createElement("div");
            subNoteRow.className = "notes-subitem-note-row collapsed";
            var subNoteTextarea = document.createElement("textarea");
            subNoteTextarea.className = "notes-subitem-note-textarea";
            subNoteTextarea.placeholder = "Nota do subitem...";
            subNoteTextarea.value = s.nota || "";
            subNoteTextarea.addEventListener("blur", function () {
              var v = subNoteTextarea.value.trim();
              if (v !== (s.nota || "")) editSubitemNote(it, s.id, v);
            });
            subNoteRow.appendChild(subNoteTextarea);
            subitemsWrap.appendChild(subNoteRow);

            subNoteBtn.addEventListener("click", function () {
              var expanding = subNoteRow.classList.contains("collapsed");
              subNoteRow.classList.toggle("collapsed", !expanding);
              if (expanding) subNoteTextarea.focus();
            });
          });

          // linha vazia SEMPRE presente depois do último subitem (pedido do
          // Georges — substitui o antigo botão "+" avulso: agora é só clicar
          // no botão de expandir a checklist — ver toggleSubitemsBtn acima —
          // que essa linha já está lá, pronta pra digitar). Enter ou perder
          // o foco com texto cria o subitem; updateItem recarrega a tabela
          // inteira, o que naturalmente já recria essa linha vazia de novo
          // no final (pronta pro próximo).
          var addRow = document.createElement("div");
          addRow.className = "notes-subitem-add-row";
          var addInput = document.createElement("input");
          addInput.type = "text";
          addInput.className = "notes-subitem-add-input";
          addInput.placeholder = "Novo item da checklist...";
          var addSubmitted = false;
          function commitAdd() {
            if (addSubmitted) return;
            var v = addInput.value.trim();
            if (!v) return; // nada digitado — deixa a linha vazia como está, sem chamar o Worker à toa
            addSubmitted = true;
            pendingFocusSubitemAddId = it.id; // ver comment no topo de renderList
            addSubitem(it, v);
          }
          addInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); commitAdd(); }
          });
          addInput.addEventListener("blur", function () { commitAdd(); });
          addRow.appendChild(addInput);
          subitemsWrap.appendChild(addRow);
        }
        renderSubitems();
        applySubitemsCollapsed();
      });

      // devolve o foco pro campo de "novo subitem" depois de um reload
      // completo da tabela (updateItem -> loadItems -> renderList de novo),
      // se a última ação tiver sido criar um subitem via essa linha —
      // assim dá pra digitar vários itens seguidos sem precisar clicar de
      // novo no botão de expandir a cada um.
      if (pendingFocusSubitemAddId) {
        var focusId = pendingFocusSubitemAddId;
        pendingFocusSubitemAddId = null;
        var targetRow = tbody.querySelector('.priorities-subitems-row[data-item-id="' + focusId + '"]');
        var targetInput = targetRow && targetRow.querySelector(".notes-subitem-add-input");
        if (targetInput) targetInput.focus();
      }
    }

    function loadItems() {
      tbody.innerHTML = '<tr><td class="empty" colspan="' + (columns.length + 3) + '">Carregando…</td></tr>';
      authFetch(cfg.templateWorkerUrl + "/priorities")
        .then(handle401)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          allItems = data.priorities || [];
          applyFilters();
          hideErr();
        })
        .catch(function () { tbody.innerHTML = '<tr><td class="empty" colspan="' + (columns.length + 3) + '">Não foi possível carregar a lista.</td></tr>'; });
    }

    function updateItem(id, patch) {
      authFetch(cfg.templateWorkerUrl + "/priorities?id=" + encodeURIComponent(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      }).then(handle401).then(loadItems).catch(showErr);
    }

    function removeItem(id) {
      authFetch(cfg.templateWorkerUrl + "/priorities?id=" + encodeURIComponent(id), { method: "DELETE" })
        .then(handle401).then(loadItems).catch(showErr);
    }

    function putSubitems(it, subitems) {
      updateItem(it.id, { subitems: subitems });
    }
    function addSubitem(it, text) {
      var newSubitems = (it.subitems || []).slice();
      newSubitems.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), text: text, done: false, flagged: false, nota: "" });
      putSubitems(it, newSubitems);
    }
    // IMPORTANTE: toggleSubitem/editSubitem/toggleSubitemFlag/editSubitemNote
    // reconstroem o subitem inteiro (PUT substitui a lista toda, sem merge
    // no servidor — ver worker.js). Cada uma dessas 4 funções PRECISA
    // preservar TODOS os campos que não está mudando (mesmo bug que já
    // aconteceu 1x com "flagged" sendo derrubado silenciosamente por
    // toggleSubitem/editSubitem antes de existir — não repetir com "nota").
    function toggleSubitem(it, subitemId, done) {
      var newSubitems = (it.subitems || []).map(function (s) {
        return s.id === subitemId ? { id: s.id, text: s.text, done: done, flagged: !!s.flagged, nota: s.nota || "" } : s;
      });
      putSubitems(it, newSubitems);
    }
    // edição do texto de um subitem já existente (pedido do Georges — antes
    // só dava pra marcar como feito ou excluir). Mesmo padrão de
    // toggleSubitem: substitui a lista inteira via putSubitems (PUT já
    // sanitiza { id, text, done, flagged, nota } no worker.js).
    function editSubitem(it, subitemId, newText) {
      var newSubitems = (it.subitems || []).map(function (s) {
        return s.id === subitemId ? { id: s.id, text: newText, done: s.done, flagged: !!s.flagged, nota: s.nota || "" } : s;
      });
      putSubitems(it, newSubitems);
    }
    // estrela de destaque por subitem (pedido do Georges — "assim como
    // fizemos em Anotações Rápidas", só que por subitem em vez de por
    // anotação inteira). Mesmo padrão de toggleSubitem/editSubitem.
    function toggleSubitemFlag(it, subitemId, flagged) {
      var newSubitems = (it.subitems || []).map(function (s) {
        return s.id === subitemId ? { id: s.id, text: s.text, done: s.done, flagged: flagged, nota: s.nota || "" } : s;
      });
      putSubitems(it, newSubitems);
    }
    // nota do subitem (pedido do Georges — "notas vinculadas aos subitens").
    // Mesmíssimo padrão das outras 3 funções acima.
    function editSubitemNote(it, subitemId, newNota) {
      var newSubitems = (it.subitems || []).map(function (s) {
        return s.id === subitemId ? { id: s.id, text: s.text, done: s.done, flagged: !!s.flagged, nota: newNota } : s;
      });
      putSubitems(it, newSubitems);
    }
    function removeSubitem(it, subitemId) {
      var newSubitems = (it.subitems || []).filter(function (s) { return s.id !== subitemId; });
      putSubitems(it, newSubitems);
    }

    function addItem() {
      var assunto = formTextInputs.assunto.value.trim();
      if (!assunto) { formTextInputs.assunto.focus(); return; }
      var body = { assunto: assunto };
      fieldKeys.forEach(function (key) { body[key] = getControlValue(formSelects[key]); });
      textKeys.forEach(function (key) { if (key !== "assunto") body[key] = formTextInputs[key].value.trim(); });
      addBtn.disabled = true;
      authFetch(cfg.templateWorkerUrl + "/priorities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(handle401).then(function () {
        fieldKeys.forEach(function (key) { resetControl(formSelects[key]); });
        textKeys.forEach(function (key) { formTextInputs[key].value = ""; });
        loadItems();
      }).catch(showErr).finally(function () { addBtn.disabled = false; });
    }

    addBtn.addEventListener("click", addItem);
    textKeys.forEach(function (key) {
      formTextInputs[key].addEventListener("keydown", function (e) { if (e.key === "Enter") addItem(); });
    });
    searchInput.addEventListener("input", applyFilters);
    statusSelect.addEventListener("change", applyFilters);
    fieldKeys.forEach(function (key) {
      if (isMultiField(key)) filterSelects[key].onChange(applyFilters);
      else filterSelects[key].addEventListener("change", applyFilters);
    });
    clearBtn.addEventListener("click", function () {
      searchInput.value = "";
      statusSelect.value = "all";
      fieldKeys.forEach(function (key) { resetControl(filterSelects[key]); });
      // "Limpar filtros" também solta os botões de "Filtros rápidos" que
      // estiverem apertados (senão a tabela continuava filtrada mesmo com
      // a barra de filtros de cima toda limpa — ia confundir).
      qfGroups.forEach(function (g) { qfActive[g.key] = []; });
      renderQfSection();
      applyFilters();
    });

    loadItems();
  }

  function renderContent(pageId) {
    var page = cfg.pages[pageId];
    var container = document.getElementById("content");
    container.innerHTML = "";

    if (page.weather) renderWeatherWidget(container, typeof page.weather === "number" ? page.weather : 0);

    if (page.dynamicQuery) {
      renderDynamicQuery(page, pageId, container);
      return;
    }

    var flatItems = page.items || [];
    var itemGroups = (page.itemGroups || []).filter(function (g) { return (g.items || []).length > 0; });
    var groups = (page.groups || []).filter(function (g) { return (g.items || []).length > 0; });
    var hasDynamicQueries = !!(page.dynamicQueries && page.dynamicQueries.length);
    var hasTabs = !!(page.tabs && page.tabs.length);

    if (!flatItems.length && !itemGroups.length && !groups.length && !page.search && !hasDynamicQueries && !hasTabs && !page.notes && !page.priorities) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Nenhum item aqui ainda. Edite config.js para adicionar.";
      container.appendChild(empty);
      return;
    }

    var globalIdx = 0;
    var renderedSomething = false;

    // "items" soltos (sem caixa) — comportamento de sempre. Numa página com
    // "dynamicQueries" (ex: Reuniões), serve pra botões fixos no topo (ex:
    // links diretos pras visualizações do Notion).
    if (flatItems.length) {
      var plainWrap = document.createElement("div");
      // "page.itemsCompact" (opcional) — botões baixos em vez do cartão alto
      // padrão (ex: os 4 links de visualização no topo de Reuniões).
      plainWrap.className = "content-plain" + (page.itemsCompact ? " items-compact" : "");
      flatItems.forEach(function (item) {
        plainWrap.appendChild(buildItemEl(item, globalIdx));
        globalIdx++;
      });
      container.appendChild(plainWrap);
      renderedSomething = true;
    }

    // "itemGroups" — igual "items" soltos, só que divididos em pequenas
    // caixinhas rotuladas (ex: "Abrir no Notion" / "Criar no Notion"), pra
    // separar visualmente botões de tipos diferentes no topo de uma página
    // sem o peso visual de "groups" (que é pra caixas maiores, tipo
    // Favoritas). Sempre no estilo "items-compact" (linha baixa, ícone +
    // texto) — não depende de "page.itemsCompact".
    if (itemGroups.length) {
      var itemGroupsWrap = document.createElement("div");
      itemGroupsWrap.className = "items-compact-groups";
      itemGroups.forEach(function (g) {
        var box = document.createElement("div");
        box.className = "items-compact-group";
        var boxTitle = document.createElement("h4");
        boxTitle.className = "group-title";
        boxTitle.textContent = g.title;
        box.appendChild(boxTitle);
        var boxItems = document.createElement("div");
        boxItems.className = "content-plain items-compact";
        g.items.forEach(function (item) {
          boxItems.appendChild(buildItemEl(item, globalIdx));
          globalIdx++;
        });
        box.appendChild(boxItems);
        itemGroupsWrap.appendChild(box);
      });
      container.appendChild(itemGroupsWrap);
      renderedSomething = true;
    }

    // "page.tabs" — botões que trocam TODO um conjunto de "dynamicQueries"
    // de uma vez (ex: Início: Hoje / Amanhã / Próximos 7 dias) — cada aba já
    // é uma lista de exibições completa, igual "page.dynamicQueries"
    // normal, só que só a aba ativa é desenhada por vez. Diferente de
    // "page.dynamicQueries" (que fica sempre visível, não depende de aba —
    // ex: "Itens Prioritários" em Início, que não muda com o dia). Os
    // botões "Recolher tudo"/"Expandir tudo" (page.collapseAllControls)
    // agora são montados DENTRO de renderTabs, na mesma linha das abas —
    // não tem mais um toolbar separado aqui.
    if (hasTabs) {
      if (renderedSomething) {
        var dividerTabs = document.createElement("hr");
        dividerTabs.className = "content-divider";
        container.appendChild(dividerTabs);
      }
      renderTabs(page, pageId, container);
      renderedSomething = true;
    }

    // "dynamicQueries" — várias exibições fixas (baseFilters + sorts), cada
    // uma buscando sozinha ao abrir a página. Só leitura (GET /query).
    // Sem linha divisória antes quando vem logo depois de "hasTabs" —
    // caso do "Itens Prioritários" em Início, que continua direto depois
    // das 5 exibições da aba ativa, sem separação (pedido do Georges).
    if (hasDynamicQueries) {
      if (renderedSomething && !hasTabs) {
        var dividerDQ = document.createElement("hr");
        dividerDQ.className = "content-divider";
        container.appendChild(dividerDQ);
      }
      page.dynamicQueries.forEach(function (qDef, i) {
        if (i > 0) {
          var divider0 = document.createElement("hr");
          divider0.className = "content-divider";
          container.appendChild(divider0);
        }
        renderDynamicQueryBlock(qDef, pageId, container);
      });
      renderedSomething = true;
    }

    // "groups" = caixas visuais dentro da MESMA página; os botões ficam
    // acessíveis direto, sem precisar clicar no título do grupo. Se já
    // houver algo acima, uma linha separa os blocos.
    if (groups.length) {
      if (renderedSomething) {
        var divider = document.createElement("hr");
        divider.className = "content-divider";
        container.appendChild(divider);
      }
      // "page.groupsSectionTitle" (opcional) — rótulo maior acima da grade
      // de "groups" (ex: "LEGISLAÇÃO POR ASSUNTO" em Legislações), pra
      // separar visualmente esse bloco do que vem antes (busca/exibições)
      // sem precisar aninhar mais um nível de página.
      if (page.groupsSectionTitle) {
        var sectionTitle = document.createElement("h2");
        sectionTitle.className = "content-section-title";
        sectionTitle.textContent = page.groupsSectionTitle;
        container.appendChild(sectionTitle);
      }
      var groupedWrap = document.createElement("div");
      groupedWrap.className = "content-grouped";
      groups.forEach(function (group) {
        var section = document.createElement("div");
        section.className = "group-section" + (group.compact ? " compact" : "") + (group.dense ? " dense" : "");
        var title = document.createElement("h3");
        title.className = "group-title";
        title.textContent = group.title;
        section.appendChild(title);
        var itemsWrap = document.createElement("div");
        itemsWrap.className = "group-items";
        (group.items || []).forEach(function (item) {
          if (group.dense && item.type === "law-links") {
            itemsWrap.appendChild(buildLawRow(item));
          } else {
            itemsWrap.appendChild(buildItemEl(item, globalIdx));
          }
          globalIdx++;
        });
        section.appendChild(itemsWrap);
        groupedWrap.appendChild(section);
      });
      container.appendChild(groupedWrap);
      renderedSomething = true;
    }

    // "search" = caixa de busca ao vivo (opcional), sempre por último na
    // página. Só consulta o Notion quando o usuário digita/filtra algo.
    if (page.search) {
      if (renderedSomething) {
        var divider2 = document.createElement("hr");
        divider2.className = "content-divider";
        container.appendChild(divider2);
      }
      renderSearchBlock(page, container);
      renderedSomething = true;
    }

    // "page.notes" (opcional) — bloco de anotações rápidas/lista de tarefas
    // (texto livre + tags), sempre por último na página (depois até da
    // busca). Guardado à parte no Cloudflare KV via Worker — sem NENHUMA
    // relação com o Notion.
    if (page.notes) {
      if (renderedSomething) {
        var dividerNotes = document.createElement("hr");
        dividerNotes.className = "content-divider";
        container.appendChild(dividerNotes);
      }
      renderNotesBlock(container);
      renderedSomething = true;
    }

    // "page.priorities" (opcional) — tabela "Lista de Prioridades", mesmo
    // esquema de "page.notes" acima (KV à parte, nada a ver com Notion),
    // também sempre por último na página. Ver renderPrioritiesTable.
    if (page.priorities) {
      if (renderedSomething) {
        var dividerPriorities = document.createElement("hr");
        dividerPriorities.className = "content-divider";
        container.appendChild(dividerPriorities);
      }
      renderPrioritiesTable(container, page);
    }
  }

  // ---------------- painel retrátil do lado direito ----------------
  // "page.sidePanel" (opcional, ver config.js) — hoje só em Início. Aba
  // discreta fixa na borda direita (#sidePanelTab) + painel que desliza da
  // direita (#sidePanel), ambos escondidos por padrão via CSS/atributo
  // "display:none" inline no index.html. Estado inicial (aberto/fechado)
  // segue o tamanho da tela — igual ao menu lateral esquerdo, ver
  // applySidePanelDefault()/isNarrowScreen mais abaixo — e dali em diante
  // é o botão quem manda; só volta a recolher sozinho em tela estreita
  // depois de navegar (closeSidePanelOnNarrowScreen, chamado em
  // navigate()).
  // "#content .side-panel-open" (CSS) — só entra em telas largas
  // (>=1024px, ver styles.css): abre espaço à direita (padding) pra
  // Pesquisar/Anotações rápidas/exibições não ficarem parcialmente atrás
  // do painel quando ele abre por padrão (applySidePanelDefault). Em
  // tela estreita o painel é sempre uma camada por CIMA do conteúdo
  // (comportamento de gaveta) — não empurra nada, então essa classe não
  // faz diferença lá (a regra CSS só existe dentro do media query largo).
  function updateContentPanelSpacing() {
    var panel = document.getElementById("sidePanel");
    var content = document.getElementById("content");
    if (!panel || !content) return;
    var open = panel.classList.contains("open") && panel.style.display !== "none";
    content.classList.toggle("side-panel-open", open);
  }

  function closeSidePanel() {
    var tab = document.getElementById("sidePanelTab");
    var panel = document.getElementById("sidePanel");
    var backdrop = document.getElementById("sidePanelBackdrop");
    if (!tab || !panel) return;
    panel.classList.remove("open");
    tab.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    tab.setAttribute("aria-expanded", "false");
    var icon = tab.querySelector(".ti");
    if (icon) icon.className = "ti ti-chevron-left";
    updateContentPanelSpacing();
  }

  function toggleSidePanel() {
    var tab = document.getElementById("sidePanelTab");
    var panel = document.getElementById("sidePanel");
    var backdrop = document.getElementById("sidePanelBackdrop");
    if (!tab || !panel) return;
    var open = !panel.classList.contains("open");
    panel.classList.toggle("open", open);
    tab.classList.toggle("open", open);
    if (backdrop) backdrop.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    var icon = tab.querySelector(".ti");
    if (icon) icon.className = open ? "ti ti-chevron-right" : "ti ti-chevron-left";
    updateContentPanelSpacing();
  }

  // Estado inicial do painel depende do tamanho da tela — igual ao menu
  // lateral (ver "isNarrowScreen"/setSidebarVisible mais abaixo): tela
  // estreita (celular fechado) começa RECOLHIDO; tela larga (celular
  // aberto tipo Z Fold, tablet, computador) começa AMOSTRANDO por
  // padrão. Só aplica isso UMA vez (na 1ª vez que o painel aparece) —
  // dali em diante o botão manda, e só volta a recolher sozinho em tela
  // estreita depois de navegar (closeSidePanelOnNarrowScreen, chamado em
  // navigate()), nunca força abrir de novo em tela larga.
  var sidePanelDefaultApplied = false;
  function applySidePanelDefault() {
    if (sidePanelDefaultApplied) return;
    sidePanelDefaultApplied = true;
    if (!isNarrowScreen.matches) toggleSidePanel();
  }

  function closeSidePanelOnNarrowScreen() {
    if (isNarrowScreen.matches) closeSidePanel();
  }

  function renderSidePanel(pageId) {
    var page = cfg.pages[pageId];
    var tab = document.getElementById("sidePanelTab");
    var panel = document.getElementById("sidePanel");
    if (!tab || !panel) return;
    if (!page || !page.sidePanel || !page.sidePanel.length) {
      tab.style.display = "none";
      panel.style.display = "none";
      updateContentPanelSpacing();
      return;
    }
    tab.style.display = "";
    panel.style.display = "";
    applySidePanelDefault();
    updateContentPanelSpacing();
    panel.innerHTML = "";
    page.sidePanel.forEach(function (group) {
      var g = document.createElement("div");
      g.className = "side-panel-group";
      var title = document.createElement("div");
      title.className = "side-panel-group-title";
      title.textContent = group.title;
      g.appendChild(title);
      var row = document.createElement("div");
      row.className = "side-panel-buttons";
      group.items.forEach(function (it) {
        var a = document.createElement("a");
        a.className = "side-panel-btn";
        // só ícone (sem texto "Notion"/"App" do lado) — a legenda vira
        // tooltip, montada a partir do título da divisória (ou de
        // "it.label", quando o grupo tem mais de um botão do MESMO tipo —
        // ex: TAT com Processos + Sessões, os dois do Notion).
        if (it.type === "notion") {
          a.title = (it.label || group.title) + " no Notion";
          a.href = it.url;
          a.target = "_blank";
          a.rel = "noopener";
          var img = document.createElement("img");
          img.src = IMG_ICONS.notion;
          img.alt = "";
          a.appendChild(img);
        } else {
          a.title = (it.label || group.title) + " no app";
          a.href = "#" + it.target;
          a.addEventListener("click", function (e) {
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate(it.target);
          });
          var ic = document.createElement("i");
          ic.className = "ti ti-apps";
          a.appendChild(ic);
        }
        row.appendChild(a);
      });
      g.appendChild(row);
      panel.appendChild(g);
    });
  }

  var sidePanelTabBtn = document.getElementById("sidePanelTab");
  if (sidePanelTabBtn) {
    sidePanelTabBtn.addEventListener("click", toggleSidePanel);
  }
  // clicar fora (no fundo escuro) fecha o painel — só aparece em telas
  // estreitas (ver ".side-panel-backdrop.open" em styles.css); em telas
  // largas o backdrop nem chega a ficar visível, então o clique não tem
  // efeito nenhum lá (não tem como "clicar fora" de algo que já convive
  // lado a lado com o conteúdo).
  var sidePanelBackdrop = document.getElementById("sidePanelBackdrop");
  if (sidePanelBackdrop) {
    sidePanelBackdrop.addEventListener("click", closeSidePanel);
  }

  // ---------------- page render / navigation ----------------
  function render(pageId, push) {
    var page = cfg.pages[pageId];
    if (!page) { pageId = homePageId; page = cfg.pages[pageId]; }
    currentId = pageId;

    document.title = page.title + " · " + cfg.appTitle;
    document.getElementById("backBtn").classList.toggle("hidden", pageId === homePageId);

    expandAncestors(pageId);
    renderBreadcrumb();
    renderContent(pageId);
    renderTree();
    renderSidePanel(pageId);

    if (push) history.pushState({ pageId: pageId }, "", "#" + pageId);
  }

  function navigate(pageId) {
    closeSearch();
    render(pageId, true);
    closeSidebarOnNarrowScreen();
    closeSidePanelOnNarrowScreen();
  }

  // ---------------- menu lateral: mostrar/recolher (qualquer tamanho de tela) ----------------
  // Antes disso, o menu simplesmente não aparecia em telas estreitas (só a
  // media query "min-width:1024px" mostrava). Agora a visibilidade é 100%
  // controlada pela classe "sidebar-visible" no #shell — o botão liga/
  // desliga essa classe, e o estado INICIAL (só na abertura do app) segue
  // imitando o comportamento de antes: aberto em telas largas, fechado em
  // estreitas — dali em diante, quem manda é o botão.
  var isNarrowScreen = window.matchMedia("(max-width: 1023px)");

  function setSidebarVisible(visible) {
    document.getElementById("shell").classList.toggle("sidebar-visible", visible);
  }

  function isSidebarVisible() {
    return document.getElementById("shell").classList.contains("sidebar-visible");
  }

  // depois de navegar pra uma página (clique num item do menu, por exemplo),
  // fecha o menu automaticamente SE estiver em tela estreita — lá ele é uma
  // camada por cima do conteúdo, então continuar aberto esconderia a página
  // que acabou de abrir. Em tela larga (lado a lado com o conteúdo) não
  // mexe em nada.
  function closeSidebarOnNarrowScreen() {
    if (isNarrowScreen.matches) setSidebarVisible(false);
  }

  var menuToggleBtn = document.getElementById("menuToggleBtn");
  if (menuToggleBtn) {
    menuToggleBtn.addEventListener("click", function () {
      setSidebarVisible(!isSidebarVisible());
    });
  }
  var sidebarBackdrop = document.getElementById("sidebarBackdrop");
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", function () { setSidebarVisible(false); });
  }
  // estado inicial: aberto em telas largas (>=1024px), fechado nas estreitas
  // — chamado aqui (fora do boot()) pra já valer antes do 1º render.
  setSidebarVisible(!isNarrowScreen.matches);

  document.getElementById("backBtn").addEventListener("click", function () { history.back(); });
  window.addEventListener("popstate", function (e) {
    var pageId = (e.state && e.state.pageId) || location.hash.replace("#", "") || homePageId;
    render(pageId, false);
  });

  // ---------------- activate an item by index within current page (keyboard 1-9) ----------------
  function activateIndex(i) {
    var page = cfg.pages[currentId];
    var items = pageItems(page);
    var item = items[i];
    if (!item) return;
    if (item.type === "notion") window.open(item.url, "_blank", "noopener");
    else if (item.type === "notion-template") {
      var el = document.querySelector('.item[data-idx="' + i + '"]');
      var labelEl = el ? el.querySelector(".item-label") : null;
      if (el) triggerTemplateCreate(item, el, labelEl);
    }
    else if (item.type === "law-links") {
      if (item.links && item.links[0]) window.open(item.links[0].url, "_blank", "noopener");
    }
    else navigate(item.target);
  }

  // ---------------- search ----------------
  var searchInputs = [];
  var resultsBox = document.getElementById("searchResults");
  var currentMatches = [];

  function collectSearchInputs() {
    searchInputs = Array.prototype.slice.call(document.querySelectorAll(".js-search-input"));
    searchInputs.forEach(function (inp) {
      inp.addEventListener("input", function () { runSearch(inp.value, inp); });
      inp.addEventListener("keydown", onSearchKeydown);
      inp.addEventListener("focus", function () { if (inp.value) runSearch(inp.value, inp); });
    });
  }

  function runSearch(q, anchorInput) {
    var nq = normalize(q).trim();
    if (!nq) { closeSearch(); return; }
    currentMatches = flatIndex.filter(function (e) { return normalize(e.label).indexOf(nq) !== -1; }).slice(0, 30);
    selectedResult = currentMatches.length ? 0 : -1;
    openSearch(anchorInput);
    paintResults();
  }

  function openSearch(anchorInput) {
    var rect = anchorInput.getBoundingClientRect();
    resultsBox.style.left = rect.left + "px";
    resultsBox.style.top = (rect.bottom + 6) + "px";
    resultsBox.style.width = Math.max(rect.width, 260) + "px";
    resultsBox.classList.add("open");
  }

  function closeSearch() {
    resultsBox.classList.remove("open");
    resultsBox.innerHTML = "";
    currentMatches = [];
    selectedResult = -1;
  }

  function paintResults() {
    resultsBox.innerHTML = "";
    if (!currentMatches.length) {
      var e = document.createElement("div");
      e.className = "sr-empty";
      e.textContent = "Nada encontrado.";
      resultsBox.appendChild(e);
      return;
    }
    currentMatches.forEach(function (m, i) {
      var row = document.createElement("div");
      row.className = "sr-item" + (i === selectedResult ? " sel" : "");
      row.innerHTML =
        '<span class="sr-label"><i class="ti ' + m.icon + '"></i>' + escapeHtml(m.label) + "</span>" +
        '<span class="sr-path">' + escapeHtml(m.pathTitles.join(" / ")) + "</span>";
      row.addEventListener("mouseenter", function () { selectedResult = i; paintResults(); });
      row.addEventListener("click", function () { activateMatch(m); });
      resultsBox.appendChild(row);
    });
  }

  function activateMatch(m) {
    if (m.type === "notion") window.open(m.url, "_blank", "noopener");
    else if (m.type === "notion-template") {
      requestTemplatePage({ database_id: m.databaseId, template_id: m.templateId })
        .then(function (url) { window.open(url, "_blank", "noopener"); })
        .catch(function (err) { alert("Não foi possível criar a página: " + err.message); });
    }
    else if (m.type === "law-links") {
      if (m.links && m.links[0]) window.open(m.links[0].url, "_blank", "noopener");
    }
    else navigate(m.target);
    searchInputs.forEach(function (inp) { inp.value = ""; inp.blur(); });
    closeSearch();
  }

  function onSearchKeydown(e) {
    if (e.key === "Escape") { e.target.value = ""; e.target.blur(); closeSearch(); return; }
    if (!currentMatches.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); selectedResult = Math.min(selectedResult + 1, currentMatches.length - 1); paintResults(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selectedResult = Math.max(selectedResult - 1, 0); paintResults(); }
    else if (e.key === "Enter") { e.preventDefault(); if (selectedResult >= 0) activateMatch(currentMatches[selectedResult]); }
  }

  document.addEventListener("click", function (e) {
    if (!resultsBox.contains(e.target) && !e.target.classList.contains("js-search-input")) closeSearch();
  });

  // ---------------- global keyboard shortcuts (desktop) ----------------
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea";

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      var target = searchInputs.filter(function (i) { return i.offsetParent !== null; })[0];
      if (target) target.focus();
      return;
    }
    if (!typing && e.key === "/") {
      e.preventDefault();
      var target2 = searchInputs.filter(function (i) { return i.offsetParent !== null; })[0];
      if (target2) target2.focus();
      return;
    }
    if (!typing && e.key === "Escape") {
      if (currentId !== homePageId) history.back();
      return;
    }
    if (!typing && e.key >= "1" && e.key <= "9") {
      activateIndex(parseInt(e.key, 10) - 1);
    }
  });

  // ---------------- boot ----------------
  // Só roda de verdade depois de confirmar login (Auth.init chama esta
  // função quando já tem um token do Google válido — ver auth.js). Sem
  // isso, o app nem monta a árvore/conteúdo até a pessoa logar.
  function boot() {
    var titleEl = document.getElementById("sidebarTitle");
    if (titleEl) {
      titleEl.textContent = cfg.appTitle;
      // Carimbo pequeno do lado do título — só pra dar pra conferir, com uma
      // olhada rápida, se o navegador já está servindo o último push feito
      // no GitHub (o valor vem de config.js, atualizado a cada entrega).
      if (cfg.appVersion) {
        var v = document.createElement("span");
        v.className = "app-version";
        v.textContent = cfg.appVersion;
        titleEl.appendChild(v);
      }
    }

    buildIndex();
    collectSearchInputs();
    var initial = location.hash.replace("#", "") || homePageId;
    history.replaceState({ pageId: initial }, "", "#" + initial);
    render(initial, false);
  }

  if (window.Auth) {
    Auth.init(boot);
  } else {
    // auth.js não carregou por algum motivo — não trava o app, só avisa.
    console.warn("auth.js não encontrado; abrindo sem exigir login.");
    boot();
  }
})();
