(function () {
  var cfg = APP_CONFIG;
  var currentId = cfg.startPage;
  var parentOf = {};        // pageId -> parentPageId
  var flatIndex = [];       // { label, type, url|target, pathTitles: [..], pathIds: [..], ownerPageId }
  var selectedResult = -1;
  var expandedPages = {};   // pageId -> true if its children are shown in the sidebar tree

  function iconFor(item) {
    if (item.icon) return "ti-" + item.icon;
    return item.type === "notion" ? "ti-file-text" : "ti-folder";
  }

  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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
      (page.items || []).forEach(function (item) {
        flatIndex.push({
          label: item.label,
          type: item.type,
          url: item.url,
          target: item.target,
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

    var childItems = (page.items || []);
    var hasChildren = childItems.length > 0;
    var isOpen = !!expandedPages[pageId];

    var row = document.createElement("div");
    row.className = "tree-row" + (pageId === currentId ? " active" : "");
    row.appendChild(makeToggle(hasChildren, isOpen, function () {
      expandedPages[pageId] = !expandedPages[pageId];
      renderTree();
    }));
    var icon = document.createElement("i");
    icon.className = "ti ti-folder";
    row.appendChild(icon);
    var label = document.createElement("span");
    label.textContent = page.title;
    row.appendChild(label);
    row.addEventListener("click", function () { navigate(pageId); });
    li.appendChild(row);

    if (hasChildren && isOpen) {
      var ul = document.createElement("ul");
      childItems.forEach(function (item) {
        if (item.type === "page" && cfg.pages[item.target]) {
          ul.appendChild(buildTreeNode(item.target, visited));
        } else if (item.type === "notion") {
          var leaf = document.createElement("li");
          var leafRow = document.createElement("div");
          leafRow.className = "tree-row";
          leafRow.appendChild(makeToggle(false, false, function () {}));
          var leafIcon = document.createElement("i");
          leafIcon.className = "ti ti-external-link";
          leafRow.appendChild(leafIcon);
          var leafLabel = document.createElement("span");
          leafLabel.textContent = item.label;
          leafRow.appendChild(leafLabel);
          leafRow.addEventListener("click", function () { window.open(item.url, "_blank", "noopener"); });
          leaf.appendChild(leafRow);
          ul.appendChild(leaf);
        }
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

  // ---------------- content grid/list ----------------
  function renderContent(pageId) {
    var page = cfg.pages[pageId];
    var container = document.getElementById("content");
    container.innerHTML = "";

    if (!page.items || page.items.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Nenhum item aqui ainda. Edite config.js para adicionar.";
      container.appendChild(empty);
      return;
    }

    page.items.forEach(function (item, idx) {
      var el;
      if (item.type === "notion") {
        el = document.createElement("a");
        el.href = item.url;
        el.target = "_blank";
        el.rel = "noopener";
      } else {
        el = document.createElement("button");
        el.addEventListener("click", function () { navigate(item.target); });
      }
      el.className = "item";
      el.dataset.idx = idx;

      var left = document.createElement("span");
      left.className = "item-left";
      var icon = document.createElement("i");
      icon.className = "item-icon ti " + iconFor(item);
      var label = document.createElement("span");
      label.className = "item-label";
      label.textContent = item.label;
      left.appendChild(icon);
      left.appendChild(label);

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
      chevron.className = "item-chevron ti " + (item.type === "notion" ? "ti-external-link" : "ti-chevron-right");
      right.appendChild(chevron);

      el.appendChild(left);
      el.appendChild(right);
      container.appendChild(el);
    });
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
    var item = page.items && page.items[i];
    if (!item) return;
    if (item.type === "notion") window.open(item.url, "_blank", "noopener");
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
