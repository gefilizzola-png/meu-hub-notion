/*
  AUTH.JS — login com Google ("Sign In With Google" / Google Identity
  Services) pra fechar o acesso ao app.

  IMPORTANTE sobre o que isso protege de verdade: o GitHub Pages é
  hospedagem ESTÁTICA e PÚBLICA — não tem como exigir login pra baixar o
  HTML/JS/CSS em si. A proteção de verdade acontece no Worker (worker.js):
  toda chamada ao Worker leva o token de login no cabeçalho
  "Authorization: Bearer <token>" (via authFetch(), em app.js), e o Worker
  confere a assinatura do token + o e-mail antes de deixar passar pro
  Notion. Sem login válido, o Worker responde 401 e o Notion nunca é
  chamado — é só isso que fecha o app na prática (a tela de login aqui é
  só a experiência de uso; não é, sozinha, a barreira de segurança).

  PRA ATIVAR (depois de colar este arquivo):
  1) Crie um Client ID OAuth no Google Cloud Console (console.cloud.google.com
     → APIs & Services → Credentials/Clients → Create OAuth client →
     Web application → em "Authorized JavaScript origins" adicione
     https://gefilizzola-png.github.io). É de graça, não precisa cartão.
  2) Troque GOOGLE_CLIENT_ID abaixo pelo Client ID gerado (algo como
     "123456789-abc.apps.googleusercontent.com").
  3) Configure a MESMA informação no Worker (variáveis de ambiente
     GOOGLE_CLIENT_ID e ALLOWED_EMAILS — veja o comentário no topo do
     worker.js) e faça o redeploy do Worker.
  Enquanto o app OAuth estiver em modo "Testing" no Google Cloud Console
  (o normal pra uso pessoal, sem precisar de verificação do Google), você
  precisa se adicionar como "Test user" na tela de configuração do
  consentimento (OAuth consent screen) com o mesmo e-mail que vai usar
  pra logar — senão o Google recusa o login com uma tela de aviso.

  SESSÃO PRÓPRIA (login mais longo, sem precisar renovar toda hora): o
  token do Google ("credential" acima) dura só ~1h — é fixo assim pela
  própria Google, não dá pra configurar diferente. Por isso, assim que
  esse token chega aqui, a gente troca ele por uma sessão NOSSA (emitida
  pelo Worker, POST /session), válida por 30 dias — ver exchangeForSession()
  abaixo e a rota /session em worker.js. Isso exige um novo segredo no
  Worker (SESSION_SECRET, ver comentário no topo do worker.js); enquanto
  esse segredo não for configurado lá, a troca falha silenciosamente e o
  app volta a usar o token do Google puro (1h), sem quebrar o login.
*/
var GOOGLE_CLIENT_ID = "900562279481-h40rkjbkk92958ivcrjfa27d24fj6t3h.apps.googleusercontent.com";

var Auth = (function () {
  var STORAGE_KEY = "meuhub_google_id_token";
  // Guarda quando foi a última troca por sessão própria bem-sucedida, só
  // pra não ficar chamando /session toda hora — ver maybeRefreshSession().
  var LAST_REFRESH_KEY = "meuhub_session_last_refresh";
  var REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 dia
  // localStorage (não sessionStorage) — sessionStorage é isolado POR ABA,
  // então uma aba nova (ex: Ctrl+clique num link) sempre nascia sem o token
  // e pedia login de novo, mesmo já logado em outra aba do mesmo navegador.
  // localStorage é compartilhado entre todas as abas da mesma origem, então
  // uma aba nova já nasce logada se alguma outra aba (do mesmo navegador)
  // tiver um login válido guardado. Continua expirando sozinho (isExpired)
  // e sendo apagado no "Sair" — só passou a valer pra TODAS as abas juntas.
  var token = null;
  var pendingReady = null;
  var initedGis = false;

  function base64UrlDecode(str) {
    var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var bin = atob(b64);
    try {
      return decodeURIComponent(
        bin.split("").map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join("")
      );
    } catch (e) {
      return bin;
    }
  }

  function decodeJwt(t) {
    try {
      var parts = t.split(".");
      return JSON.parse(base64UrlDecode(parts[1]));
    } catch (e) {
      return null;
    }
  }

  function isExpired(t) {
    var payload = decodeJwt(t);
    if (!payload || !payload.exp) return true;
    // 30s de folga pra evitar expirar bem na hora de uma chamada em curso
    return Date.now() >= payload.exp * 1000 - 30000;
  }

  // display explícito nos dois estados (não usa "" pra "voltar ao padrão do
  // CSS") porque #loginGate/#shell já nascem com display:none/flex fixo no
  // próprio CSS pra evitar um flash da tela toda antes do JS decidir o que
  // mostrar — depender do fallback pro valor da stylesheet aqui seria frágil.
  function showGate() {
    var gate = document.getElementById("loginGate");
    var shell = document.getElementById("shell");
    if (gate) gate.style.display = "flex";
    if (shell) shell.style.display = "none";
  }

  function hideGate() {
    var gate = document.getElementById("loginGate");
    var shell = document.getElementById("shell");
    if (gate) gate.style.display = "none";
    if (shell) shell.style.display = "flex";
  }

  function paintUserLabel() {
    var payload = token ? decodeJwt(token) : null;
    var label = document.getElementById("authUserLabel");
    var box = document.getElementById("authUser");
    if (label) label.textContent = payload ? (payload.email || payload.name || "") : "";
    // display explícito (não ""), mesmo motivo do showGate/hideGate acima —
    // .auth-user já nasce com display:none fixo no CSS.
    if (box) box.style.display = payload ? "flex" : "none";
  }

  function setToken(t) {
    token = t;
    try { localStorage.setItem(STORAGE_KEY, t); } catch (e) { /* modo privado etc — segue sem persistir */ }
    hideGate();
    paintUserLabel();
    if (pendingReady) {
      var cb = pendingReady;
      pendingReady = null;
      cb();
    }
  }

  // Troca um login válido (token do Google ou sessão própria ainda
  // válida) por uma sessão nossa nova, de 30 dias — POST /session no
  // Worker (ver worker.js). Usa o token PASSADO como parâmetro pro
  // cabeçalho Authorization (não o `token` da closure), porque na hora do
  // login inicial ainda nem gravamos o token do Google como o "atual".
  function exchangeForSession(bearerToken) {
    var cfg = (typeof APP_CONFIG !== "undefined") ? APP_CONFIG : null;
    var base = cfg && cfg.templateWorkerUrl;
    if (!base || !bearerToken) return Promise.reject(new Error("sem worker/token"));
    return fetch(base + "/session", {
      method: "POST",
      headers: { "Authorization": "Bearer " + bearerToken }
    }).then(function (res) {
      if (!res.ok) throw new Error("falha ao trocar sessão (" + res.status + ")");
      return res.json();
    }).then(function (data) {
      if (!data || !data.token) throw new Error("resposta sem token");
      return data.token;
    });
  }

  function markRefreshed() {
    try { localStorage.setItem(LAST_REFRESH_KEY, String(Date.now())); } catch (e) {}
  }

  // Só tenta trocar de novo se já faz um tempo desde a última troca —
  // evita bater no Worker a cada navegação/reload. Falha em silêncio: se
  // o SESSION_SECRET ainda não tiver sido configurado no Worker, ou a
  // rede cair, o login atual (o que já está em `token`) continua valendo
  // normalmente até expirar sozinho.
  function maybeRefreshSession() {
    if (!token) return;
    var last = 0;
    try { last = parseInt(localStorage.getItem(LAST_REFRESH_KEY), 10) || 0; } catch (e) {}
    if (Date.now() - last < REFRESH_INTERVAL_MS) return;
    exchangeForSession(token).then(function (newToken) {
      setToken(newToken);
      markRefreshed();
    }).catch(function () { /* segue com o token atual, sem quebrar nada */ });
  }

  function handleCredentialResponse(response) {
    // Mostra a tela principal imediatamente com o token do Google (como
    // sempre foi) — a troca pela sessão de 30 dias acontece por trás, sem
    // atrasar o login nem exigir nada extra da pessoa.
    setToken(response.credential);
    exchangeForSession(response.credential).then(function (newToken) {
      setToken(newToken);
      markRefreshed();
    }).catch(function () { /* sem SESSION_SECRET configurado ainda, ou erro de rede — segue com o token do Google (dura ~1h) */ });
  }

  function signOut() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { localStorage.removeItem(LAST_REFRESH_KEY); } catch (e) {}
    token = null;
    paintUserLabel();
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    showGate();
    renderSignInButton();
  }

  function renderSignInButton() {
    var btnBox = document.getElementById("g_id_signin_btn");
    if (!btnBox || !window.google || !google.accounts || !google.accounts.id) return;
    btnBox.innerHTML = "";
    google.accounts.id.renderButton(btnBox, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      locale: "pt-BR"
    });
  }

  function ensureGisReady(cb, elapsedMs) {
    elapsedMs = elapsedMs || 0;
    if (window.google && google.accounts && google.accounts.id) { cb(); return; }
    // depois de ~10s sem carregar (bloqueador de anúncios, rede, etc.),
    // desiste de ficar tentando em silêncio e avisa na própria tela de
    // login em vez de deixar a pessoa travada olhando pro nada.
    if (elapsedMs >= 10000) {
      var p = document.querySelector("#loginGate p");
      if (p) p.textContent = "Não consegui carregar o login do Google. Verifique sua conexão ou um bloqueador de anúncios/scripts e recarregue a página.";
      return;
    }
    setTimeout(function () { ensureGisReady(cb, elapsedMs + 250); }, 250);
  }

  // onReady é chamado uma vez, quando já tem um login válido — é aí que o
  // app.js segue com o boot normal dele (buildIndex/render/etc).
  function init(onReady) {
    pendingReady = onReady;

    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved && !isExpired(saved)) {
      token = saved;
    } else if (saved) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    ensureGisReady(function () {
      if (initedGis) return;
      initedGis = true;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true
      });

      if (token) {
        hideGate();
        paintUserLabel();
        var cb = pendingReady;
        pendingReady = null;
        if (cb) cb();
        // já tinha login válido salvo (sessão de 30 dias ou, no pior caso,
        // um token do Google ainda dentro da 1h) — aproveita e desliza a
        // janela da sessão própria pra frente, sem pedir nada da pessoa.
        maybeRefreshSession();
      } else {
        showGate();
        renderSignInButton();
        // tenta o "One Tap" também, além do botão — se o navegador bloquear
        // (ex: sem cookies de terceiros), o botão continua funcionando.
        google.accounts.id.prompt();
      }
    });

    var signOutBtn = document.getElementById("authSignOutBtn");
    if (signOutBtn) signOutBtn.addEventListener("click", signOut);

    // Sincroniza abas já abertas entre si: o evento "storage" dispara nas
    // OUTRAS abas (nunca na que fez a mudança) sempre que o localStorage
    // muda. Assim, se você clicar "Sair" numa aba, as outras já abertas
    // também voltam pra tela de login sozinhas — sem esperar um F5.
    window.addEventListener("storage", function (e) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue && !isExpired(e.newValue)) {
        token = e.newValue;
        hideGate();
        paintUserLabel();
        if (pendingReady) { var cb = pendingReady; pendingReady = null; cb(); }
      } else {
        token = null;
        paintUserLabel();
        showGate();
        renderSignInButton();
      }
    });
  }

  function authHeader() {
    if (!token || isExpired(token)) return {};
    return { "Authorization": "Bearer " + token };
  }

  function isSignedIn() {
    return !!token && !isExpired(token);
  }

  return { init: init, authHeader: authHeader, signOut: signOut, isSignedIn: isSignedIn };
})();
