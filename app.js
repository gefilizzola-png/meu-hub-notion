(function () {
  var cfg = APP_CONFIG;
  var currentId = cfg.startPage;
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
  var IMG_ICONS = { notion: "icon-notion.png", "leis-municipais": "icon-leis-municipais.png", "diario-oficial": "icon-diario-oficial.png", "file-type-pdf": "icon-pdf.png" };

  // ---------------- criação de página via template (Cloudflare Worker) ----------------
  // Chama o Worker configurado em cfg.templateWorkerUrl, que cria uma página nova no
  // Notion a partir de um template e devolve a URL da página criada.
  function requestTemplatePage(item) {
    return fetch(cfg.templateWorkerUrl + "/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database_id: item.database_id, template_id: item.template_id })
    }).then(function (res) {
      return res.json().then(function (data) {
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
    var icon = document.createElement("i");
    if (page.dynamicQuery || page.dynamicQueries) {
      icon.className = "ti ti-calendar-event";
    } else {
      icon.className = "ti ti-folder" + (hasContent ? "" : " icon-empty");
    }
    row.appendChild(icon);
    var label = document.createElement("span");
    label.textContent = page.title;
    row.appendChild(label);
    row.addEventListener("click", function () { navigate(pageId); });
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
      var span = document.createElement("span");
      span.className = "crumb" + (i === chain.length - 1 ? " current" : "");
      span.textContent = page.title;
      if (i !== chain.length - 1) span.addEventListener("click", function () { navigate(id); });
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
      el.href = item.url;
      el.target = "_blank";
      el.rel = "noopener";
    } else if (item.type === "notion-template") {
      el = document.createElement("button");
    } else {
      el = document.createElement("button");
      el.addEventListener("click", function () { navigate(item.target); });
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
        badge.className = "item-sub-badge";
        if (s.color) badge.style.color = s.color;
        badge.textContent = s.text;
        // se o texto for cortado (ellipsis) por ser muito longo, o título
        // completo ainda aparece passando o mouse por cima.
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
        triggerLabel.textContent = filterDef.label + ": " + selected.length + " selecionados";
      }
    }

    function updateRowsUI() {
      rowEntries.forEach(function (entry) {
        entry.row.classList.toggle("selected", selected.indexOf(entry.opt) !== -1);
      });
    }

    function setSelected(next) {
      selected = next;
      updateTriggerUI();
      updateRowsUI();
      // manda a lista de opções inteira (não só o pageId) — assim quem
      // escuta pode usar opt.condition/opt.value pra sobrescrever o filtro
      // padrão (necessário pros filtros de data relativa: cada opção tem
      // sua própria condition, ex: "equals" pra Hoje/Amanhã, "next_week"
      // pra Esta semana).
      onChange(selected.slice());
    }

    var allRow = document.createElement("div");
    allRow.className = "filter-option filter-option-all";
    allRow.textContent = "Todos";
    allRow.addEventListener("click", function (e) {
      e.stopPropagation(); // não deixa o listener global (fecha menus abertos) atrapalhar
      menu.classList.remove("open");
      setSelected([]);
    });
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
        } else {
          menu.classList.remove("open");
          setSelected([opt]);
        }
      });
      menu.appendChild(row);
      rowEntries.push({ opt: opt, row: row });
    });

    // "filterDef.default" (opcional) — pageId de uma opção pra já vir
    // marcada quando a página abre (ex: "Últimas Reuniões" já abrir com
    // "Última semana"). Só atualiza a aparência aqui — quem chama essa
    // função já seeda o filtro real antes da 1ª busca.
    if (filterDef.default) {
      var defOpt = (filterDef.options || []).filter(function (o) { return o.pageId === filterDef.default; })[0];
      if (defOpt) { selected = [defOpt]; updateTriggerUI(); updateRowsUI(); }
    }

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

  // ---------------- helpers pra montar filtros a partir de um buildIconDropdown ----------------
  // buildIconDropdown sempre devolve a LISTA de opções marcadas (0, 1 ou
  // várias). Esses dois helpers convertem essa lista no formato guardado no
  // filterState de cada página (property -> { type, pairs }) e depois no
  // formato de filtro mandado ao Worker — 1 par vira um filtro simples, 2+
  // vira "orPairs" (o Worker combina com "or").

  // opts vazio/null → null (remove o filtro); senão → { type, pairs }
  function filterStateFromOpts(f, opts) {
    if (!opts || !opts.length) return null;
    return {
      type: f.type,
      pairs: opts.map(function (o) {
        return { condition: o.condition || f.condition, value: o.value !== undefined ? o.value : o.pageId };
      })
    };
  }

  // { type, pairs } de uma propriedade → entrada da lista "filters" do Worker
  function filterStateToFilterEntry(property, fs) {
    if (fs.pairs.length === 1) {
      return { property: property, type: fs.type, condition: fs.pairs[0].condition, value: fs.pairs[0].value };
    }
    return { property: property, type: fs.type, orPairs: fs.pairs };
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
          if (fs) filterState[f.property] = fs;
          else delete filterState[f.property];
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

      fetch(url)
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (currentId !== pageId) return; // usuário já navegou pra outro lugar enquanto buscava
          resultsWrap.innerHTML = "";
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
      } else if (cf.type === "relation" && cf.lookup === "andamento") {
        var opt = findAndamentoOption(raw);
        if (opt) sub.push({ text: opt.label, color: opt.color });
      } else if (cf.type === "relation" && cf.lookup === "prioridade") {
        var pOpt = findPrioridadeOption(raw);
        if (pOpt) sub.push({ text: pOpt.label, color: pOpt.color });
      } else if (cf.type === "select") {
        if (raw && raw.name) sub.push({ text: raw.name, color: NOTION_COLOR[raw.color] || "" });
      } else if (cf.type === "rollup") {
        // rollup de relação (ex: "Providência TAT - Sessões"/"...Processos")
        // — vem como array (0..N itens relacionados); o card mostra o
        // primeiro valor não vazio, igual a um badge de "select" comum.
        var ruVal = Array.isArray(raw) ? raw[0] : raw;
        if (ruVal && ruVal.name) sub.push({ text: ruVal.name, color: NOTION_COLOR[ruVal.color] || "" });
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
  function renderDynamicQueryBlock(qDef, ownerPageId, container) {
    // envolve a exibição inteira (título + filtros + resultados) numa caixa
    // própria — permite colorir o fundo por exibição via "qDef.bg" (ex:
    // Pendentes/Atrasadas/Concluídas em Tarefas, cada uma com uma cor).
    var section = document.createElement("div");
    section.className = "query-block";
    if (qDef.bg) section.style.background = qDef.bg;
    container.appendChild(section);

    var title = document.createElement("h3");
    title.className = "group-title";
    title.textContent = qDef.title;
    section.appendChild(title);

    var filterState = {}; // property -> { type, pairs: [{condition,value}, ...] }
    // "type: 'limit'" é diferente dos outros filtros — não é uma condição do
    // Notion, é só quantos cards mostrar. Nunca entra em "filters" enviado
    // ao Worker; corta o array de resultados no cliente, depois de buscar.
    // Sempre single-select (config.js marca "multi: false" nele).
    var displayLimit = null;

    if (qDef.filters && qDef.filters.length) {
      var filterBar = document.createElement("div");
      filterBar.className = "filter-bar";
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
          if (fs) filterState[f.property] = fs;
          else delete filterState[f.property];
          runQuery();
        }));
        // "f.default" (opcional) — já seeda o filtro real ANTES da 1ª busca,
        // pra a página abrir direto com esse filtro aplicado (ex: "Últimas
        // Reuniões" abre já em "Última semana", sem precisar clicar).
        if (f.default) {
          var defOpt = (f.options || []).filter(function (o) { return o.pageId === f.default; })[0];
          if (defOpt) filterState[f.property] = filterStateFromOpts(f, [defOpt]);
        }
      });
      section.appendChild(filterBar);
    }

    var resultsWrap = document.createElement("div");
    resultsWrap.className = "content-plain";
    section.appendChild(resultsWrap);

    function runQuery() {
      resultsWrap.innerHTML = "";
      var loading = document.createElement("p");
      loading.className = "empty";
      loading.textContent = "Buscando…";
      resultsWrap.appendChild(loading);

      var filters = (qDef.baseFilters || []).map(function (f) { return f; });
      Object.keys(filterState).forEach(function (prop) {
        filters.push(filterStateToFilterEntry(prop, filterState[prop]));
      });

      var url = cfg.templateWorkerUrl + "/query?database_id=" + encodeURIComponent(qDef.database_id) +
        "&filters=" + encodeURIComponent(JSON.stringify(filters));
      if (qDef.sorts && qDef.sorts.length) {
        url += "&sorts=" + encodeURIComponent(JSON.stringify(qDef.sorts));
      }
      if (qDef.cardFields && qDef.cardFields.length) {
        var extraProps = qDef.cardFields.map(function (cf) { return cf.property; });
        url += "&extra=" + encodeURIComponent(JSON.stringify(extraProps));
      }

      fetch(url)
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (currentId !== ownerPageId) return; // usuário já navegou pra outro lugar enquanto buscava
          resultsWrap.innerHTML = "";
          if (!result.ok) throw new Error((result.data && result.data.error) || "Falha ao buscar");
          var pages = result.data.pages || [];
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
    var state = { text: "", filterState: null, filterProp: null }; // filterState: null | { type, pairs }
    var debounceTimer = null;
    var requestSeq = 0;

    var section = document.createElement("div");
    section.className = "search-block";
    var title = document.createElement("h3");
    title.className = "group-title";
    title.textContent = s.title || "Pesquisar";
    section.appendChild(title);

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

    if (s.filters && s.filters.length) {
      var filterBar = document.createElement("div");
      filterBar.className = "filter-bar search-block-filter-bar";
      s.filters.forEach(function (f) {
        filterBar.appendChild(buildIconDropdown(f, function (opts) {
          state.filterState = filterStateFromOpts(f, opts);
          state.filterProp = f;
          runQuery();
        }));
      });
      row.appendChild(filterBar);
    }

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
      var hasInput = !!state.text.trim() || !!(state.filterState && state.filterProp);
      var filters = (s.baseFilters || []).map(function (f) { return f; });
      if (state.text.trim()) {
        filters.push({
          property: s.nameField.property, type: s.nameField.type,
          condition: s.nameField.condition, value: state.text.trim()
        });
      }
      if (state.filterState && state.filterProp) {
        filters.push(filterStateToFilterEntry(state.filterProp.property, state.filterState));
      }
      var mySeq = ++requestSeq;
      resultsWrap.innerHTML = "";
      if (!hasInput) return; // nada digitado/selecionado ainda — não busca

      var loading = document.createElement("p");
      loading.className = "empty";
      loading.textContent = "Buscando…";
      resultsWrap.appendChild(loading);

      var url = cfg.templateWorkerUrl + "/query?database_id=" + encodeURIComponent(s.database_id) +
        "&filters=" + encodeURIComponent(JSON.stringify(filters));

      fetch(url)
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (mySeq !== requestSeq) return; // resposta desatualizada (usuário já digitou outra coisa)
          resultsWrap.innerHTML = "";
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

    container.appendChild(section);
  }

  // ---------------- content grid/list ----------------
  function renderContent(pageId) {
    var page = cfg.pages[pageId];
    var container = document.getElementById("content");
    container.innerHTML = "";

    if (page.dynamicQuery) {
      renderDynamicQuery(page, pageId, container);
      return;
    }

    var flatItems = page.items || [];
    var groups = (page.groups || []).filter(function (g) { return (g.items || []).length > 0; });
    var hasDynamicQueries = !!(page.dynamicQueries && page.dynamicQueries.length);

    if (!flatItems.length && !groups.length && !page.search && !hasDynamicQueries) {
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

    // "dynamicQueries" — várias exibições fixas (baseFilters + sorts), cada
    // uma buscando sozinha ao abrir a página. Só leitura (GET /query).
    if (hasDynamicQueries) {
      if (renderedSomething) {
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
    }
  }

  // ---------------- page render / navigation ----------------
  function render(pageId, push) {
    var page = cfg.pages[pageId];
    if (!page) { pageId = cfg.startPage; page = cfg.pages[pageId]; }
    currentId = pageId;

    document.title = page.title + " · " + cfg.appTitle;
    document.getElementById("backBtn").classList.toggle("hidden", pageId === cfg.startPage);

    expandAncestors(pageId);
    renderBreadcrumb();
    renderContent(pageId);
    renderTree();

    if (push) history.pushState({ pageId: pageId }, "", "#" + pageId);
  }

  function navigate(pageId) {
    closeSearch();
    render(pageId, true);
  }

  document.getElementById("backBtn").addEventListener("click", function () { history.back(); });
  window.addEventListener("popstate", function (e) {
    var pageId = (e.state && e.state.pageId) || location.hash.replace("#", "") || cfg.startPage;
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
      if (currentId !== cfg.startPage) history.back();
      return;
    }
    if (!typing && e.key >= "1" && e.key <= "9") {
      activateIndex(parseInt(e.key, 10) - 1);
    }
  });

  // ---------------- boot ----------------
  var titleEl = document.getElementById("sidebarTitle");
  if (titleEl) titleEl.textContent = cfg.appTitle;

  buildIndex();
  collectSearchInputs();
  var initial = location.hash.replace("#", "") || cfg.startPage;
  history.replaceState({ pageId: initial }, "", "#" + initial);
  render(initial, false);
})();
