(() => {
  const el = (id) => document.getElementById(id);
  const modes = ["quiz", "numero", "palavra", "emoji", "forca"];
  const ui = window.ETHUI;
  const drafts = new Map();
  let monitor, refreshing = false, available = false;
  let state,
    selected,
    lastMessages = "",
    lastSettings = "",
    editing = false,
    pending = false;
  const make = (tag, text, cls) => {
    const n = document.createElement(tag);
    n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const feedback = (text, kind = "") => {
    document.querySelectorAll('#panel-feedback, #settings-feedback, .operation-feedback, #confirm-feedback').forEach(n => {
      n.textContent = text;
      n.classList.toggle('error', kind === 'error');
      n.classList.toggle('loading', kind === 'loading');
    });
  };
  const current = () => state?.chats.find((c) => c.id === selected);
  const name = c => c.name === c.id ? (c.group ? 'Grupo sem nome' : c.id.split('@')[0]) : c.name;
  function selectChat(id, managing = false) {
    if (pending) return;
    if (editing && selected !== id) {
      ui.confirm('Descartar alterações?', 'As preferências ainda não foram salvas. Deseja trocar de grupo?', 'Descartar e continuar', async () => { editing = false; selectChat(id, managing); return true; });
      return;
    }
    if (selected !== id) {
      if (selected) drafts.set(selected, el('message-text').value);
      selected = id; lastMessages = ''; lastSettings = ''; editing = false;
      el('message-text').value = drafts.get(id) || '';
      el('game-variant').value = current()?.settings.variants?.[el('game-type').value] || 'classico';
      feedback('');
    }
    document.body.classList.add('chat-selected');
    if (!managing) document.body.classList.add('show-conversations');
    render();
    if (managing) ui.open('group-dialog');
    document.body.classList.remove('sidebar-open');
  }
  function list() {
    const query = el("chat-search").value.toLocaleLowerCase("pt-BR");
    const chats = [...(state?.chats || [])]
      .sort((a, b) => {
        const recent = (id) =>
          state.messages.filter((m) => m.chat === id).at(-1)?.time || 0;
        return recent(b.id) - recent(a.id);
      })
      .filter((c) =>
        `${c.name} ${c.id} ${state.messages.filter((m) => m.chat === c.id).at(-1)?.text || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(query),
      );
    el("chat-list").replaceChildren(
      ...chats.map((c) => {
        const button = make("button", "", c.id === selected ? "active" : "");
        button.type = "button";
        button.disabled = pending;
        button.setAttribute('aria-pressed', String(c.id === selected));
        const copy = make('span', '', 'list-copy');
        const recent = state.messages.filter(m => m.chat === c.id).at(-1);
        copy.append(make('strong', name(c)), make('small', recent ? recent.text : c.group ? c.allowed ? 'Autorizado' : 'Não autorizado' : 'Conversa privada'));
        button.append(ui.icon(c.group ? 'users' : 'user'),copy);
        button.onclick = () => selectChat(c.id);
        return button;
      }),
    );
    if (!chats.length)
      el("chat-list").append(make("p", "Nenhuma conversa encontrada."));
    const groups = state?.chats.filter(c => c.group) || [];
    el('group-count').textContent = '(' + groups.length + ')';
    el('groups-metric').textContent = available ? groups.filter(g=>g.allowed).length + ' / ' + groups.length : '—';
    const groupQuery = el('group-search').value.toLocaleLowerCase('pt-BR');
    el('groups').replaceChildren(...groups.filter(g => `${name(g)} ${g.id}`.toLocaleLowerCase('pt-BR').includes(groupQuery)).map(g => {
      const row = make('div','','group' + (g.id === selected ? ' active' : ''));
      const choose = make('button','','select-group'); choose.type='button'; choose.disabled=pending; choose.setAttribute('aria-pressed',String(g.id===selected));
      const copy = make('span','','list-copy'); copy.append(make('strong',name(g)),make('span',g.allowed ? 'Autorizado' : 'Não autorizado','tag' + (g.allowed ? '' : ' off')));
      choose.append(ui.icon('users'),copy); choose.onclick=()=>selectChat(g.id);
      const manage = make('button','','icon-button ghost'); manage.type='button'; manage.disabled=pending; manage.setAttribute('aria-label','Gerenciar ' + name(g)); const i=document.createElement('i'); i.dataset.lucide='ellipsis-vertical'; manage.append(i); manage.onclick=()=>selectChat(g.id,true);
      row.append(choose,manage); return row;
    }));
    if (!el('groups').children.length) el('groups').append(make('p', available ? 'Nenhum grupo encontrado.' : 'Grupos indisponíveis. Aguarde o bot.'));
    const signature=JSON.stringify(groups.map(g=>[g.id,name(g)]));
    if (el('group-picker').dataset.signature !== signature) {
      el('group-picker').replaceChildren(new Option('Selecione um grupo…',''),...groups.map(g=>new Option(name(g),g.id)));
      el('group-picker').dataset.signature=signature;
    }
    el('group-picker').value = current()?.group ? selected : '';
    el('group-picker').disabled=pending;
    ui.icons();
  }
  function variantOptions(select, value = "classico") {
    select.replaceChildren(
      ...(state?.variants || [{ id: "classico", name: "Clássico" }]).map(
        (v) => {
          const o = make("option", v.name);
          o.value = v.id;
          return o;
        },
      ),
    );
    select.value = value;
  }
  function fields(chat) {
    const s = chat.settings;
    const container = el("settings-fields");
    container.replaceChildren();
    const checkbox = (name, label, checked, parent = container) => {
      const wrapper = make("label", label);
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = name;
      input.checked = checked;
      wrapper.prepend(input);
      parent.append(wrapper);
    };
    const number = (name, label, value, min, max, parent = container) => {
      const wrapper = make("label", label);
      const input = document.createElement("input");
      Object.assign(input, {
        type: "number",
        name,
        value: String(value),
        min: String(min),
        max: String(max),
        required: true,
      });
      wrapper.append(input);
      parent.append(wrapper);
    };
    checkbox("enabled", "Jogos ativados", s.enabled);
    number("cooldown", "Intervalo entre partidas (s)", s.cooldown, 0, 3600);
    number(
      "guessCooldown",
      "Intervalo entre palpites (s)",
      s.guessCooldown,
      0,
      60,
    );
    number("numberMin", "Menor número", s.numberMin, 1, 1000000);
    number("numberMax", "Maior número", s.numberMax, 1, 1000000);
    modes.forEach((t) => {
      const f = document.createElement("fieldset");
      f.append(make("legend", t));
      checkbox("mode-" + t, "Ativado", s.modes[t], f);
      number("duration-" + t, "Duração (s)", s.duration[t], 10, 600, f);
      const label = make("label", "Variação padrão");
      const select = document.createElement("select");
      select.name = "variant-" + t;
      variantOptions(select, s.variants?.[t] || "classico");
      label.append(select);
      f.append(label);
      container.append(f);
    });
  }
  function render() {
    const connection = state?.connection;
    const ready = available && !!state?.ready;
    ui.setBusy(pending);
    ['start','stop','restart'].forEach(action => { el('bot-' + action).disabled = pending || !monitor || (action === 'start' ? monitor.running : !monitor.running); });
    el('badge').textContent = ready ? 'WhatsApp conectado' : !available ? 'WhatsApp indisponível' : connection?.status === 'qr' ? 'Aguardando QR' : connection?.status === 'connecting' ? 'Conectando…' : 'WhatsApp desconectado';
    el('connection-menu-toggle').classList.toggle('off',!ready);
    el('connection').textContent=ready ? 'Conectado' : 'Desconectado';
    if (!ready) el('since').textContent=connection?.status === 'qr' ? 'Leia o QR nas configurações' : 'Abra o menu para conectar';
    if (el("account-disconnect")) {
      el("account-disconnect").disabled = pending || !ready;
      el("account-disconnect").hidden = !ready;
      el("account-connect").hidden = ready;
      el("account-connect").disabled =
        pending || !available ||
        ["qr", "connecting", "disconnecting"].includes(connection?.status);
    }
    el("connect-status").textContent = ready
      ? "WhatsApp conectado. Escolha um grupo para gerenciar."
      : connection?.status === "qr"
        ? "Leia o QR com o celular. Ele será atualizado automaticamente."
        : connection?.status === "loggedout"
          ? "Conta desconectada. Clique em Conectar WhatsApp para ler um novo QR."
          : connection?.status === "disconnecting"
            ? "Desconectando sua conta…"
            : connection?.status === "disconnected"
              ? "WhatsApp desconectado. Clique em Conectar WhatsApp para tentar novamente."
              : "Aguardando conexão. Use Iniciar bot se o serviço estiver parado.";
    el("connect-qr").hidden = !available || !connection?.qr || ready;
    if (
      connection?.qr &&
      el("connect-qr").getAttribute("src") !== connection.qr
    )
      el("connect-qr").src = connection.qr;
    if (!connection?.qr) el("connect-qr").removeAttribute("src");
    el("connect-help").hidden = ready;
    list();
    const chat = current();
    el("chat-title").textContent = chat ? name(chat) : "Selecione uma conversa";
    el('chat-authorization').textContent=chat?.group ? chat.allowed ? 'Grupo autorizado' : 'Grupo não autorizado' : chat ? 'Conversa privada' : 'Escolha um grupo na lista.';
    el('manage-current').disabled=pending || !chat?.group;
    el('group-name').textContent=chat?.group ? name(chat) : '—';
    el('group-id').textContent=chat?.group ? chat.id : '—';
    el('group-authorization').textContent=chat?.group ? chat.allowed ? 'Autorizado' : 'Não autorizado' : '—';
    el("send-form").querySelector("button").disabled =
      pending || !chat || !ready;
    el('message-text').disabled=pending || !chat || !ready;
    el("authorize").disabled = pending || !available || !chat?.group;
    el("authorize").textContent = chat?.allowed
      ? "Remover autorização"
      : "Autorizar grupo";
    el('authorize').classList.toggle('danger',!!chat?.allowed);
    el('authorize').classList.toggle('primary',!chat?.allowed);
    el("start-game").disabled = pending || !chat?.allowed || !ready || !!chat?.session;
    el("cancel-game").disabled = pending || !chat?.allowed || !ready || !chat?.session;
    el("settings-form").hidden = !chat?.group;
    el("settings-form").querySelector('button[type="submit"]').disabled =
      pending || !available || !chat?.allowed;
    el("session-status").textContent = chat?.group
      ? chat.session
        ? `Partida: ${chat.session.type || "seleção"} · ${chat.session.status} · termina ${new Date(chat.session.expiresAt).toLocaleTimeString("pt-BR")}`
        : "Nenhuma partida em andamento."
      : "Selecione um grupo para gerenciar os jogos.";
    const settingsSignature = chat
      ? JSON.stringify([chat.id, chat.settings])
      : "";
    if (chat?.group && !editing && settingsSignature !== lastSettings) {
      fields(chat);
      lastSettings = settingsSignature;
    }
    const messages = state?.messages.filter((m) => m.chat === selected) || [];
    const signature = JSON.stringify(messages);
    if (signature !== lastMessages) {
      const box = el("messages");
      const bottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      box.replaceChildren(
        ...messages.map((m) => {
          const bubble = make(
            "div",
            "",
            "bubble" + (m.outgoing ? " outgoing" : ""),
          );
          bubble.append(
            make("small", m.outgoing ? "Você / Bot" : m.sender),
            make("div", m.text),
            make(
              "small",
              new Date(m.time).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              }),
            ),
          );
          return bubble;
        }),
      );
      if (!messages.length)
        box.append(make("p", "Nenhuma mensagem registrada nesta conversa."));
      if (bottom || !lastMessages) box.scrollTop = box.scrollHeight;
      lastMessages = signature;
    }
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    const todayMessages=state?.messages.filter(m=>new Date(m.time).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})===today) || [];
    el('messages-metric').textContent=available ? String(todayMessages.length) : '—';
    el('messages-period').textContent='Mensagens no histórico local de hoje';
  }
  async function refresh() {
    if (refreshing) return;
    refreshing=true;
    try {
      const response = await fetch("/api/panel", {signal:AbortSignal.timeout(10000)});
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      const changed =
        JSON.stringify(state?.variants) !== JSON.stringify(data.variants);
      state = data;
      available = true;
      if (changed) variantOptions(el("game-variant"));
      render();
    } catch (e) {
      available = false;
      feedback(e.message || "Não foi possível carregar as conversas.", 'error');
      render();
    } finally { refreshing=false; }
  }
  async function action(data) {
    if (pending || !selected) return false;
    pending = true;
    render();
    feedback("Processando…", 'loading');
    const target = selected;
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, chat: target }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      feedback("Operação concluída.");
      await refresh();
      return true;
    } catch (e) {
      feedback(e.message || "Falha na operação.", 'error');
      return false;
    } finally {
      pending = false;
      render();
    }
  }
  el("chat-search").oninput = list;
  el('group-search').oninput = list;
  el('group-picker').onchange = () => selectChat(el('group-picker').value, true);
  el('manage-current').onclick = () => ui.open('group-dialog');
  document.addEventListener('eth:status', event => { monitor=event.detail; if (!monitor?.running) available=false; render(); });
  document.addEventListener('eth:dialog', event => { if (event.detail === 'group-dialog') render(); });
  if (el("install-extension")) {
    el("install-extension").onclick = () => ui.open('extension-install');
    el("close-extension-install").onclick = () =>
      el("extension-install").close();
    el("copy-extension-address").onclick = async () => {
      try {
        await navigator.clipboard.writeText("chrome://extensions");
        el("extension-install-feedback").textContent =
          "Endereço copiado. Cole na barra de endereço do Chrome.";
      } catch {
        el("extension-install-feedback").textContent =
          "Digite chrome://extensions na barra de endereço do Chrome.";
      }
    };
  }
  async function accountAction(type) {
    if (pending) return;
    pending = true;
    render();
    feedback(
      type === "disconnect-account"
        ? "Desconectando WhatsApp…"
        : "Preparando conexão…",
      'loading');
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      feedback(
        type === "disconnect-account"
          ? "WhatsApp desconectado. Você pode conectar novamente pelo QR."
          : "Aguarde o QR para conectar seu WhatsApp.",
      );
      await refresh();
      return true;
    } catch (e) {
      feedback(e.message || "Não foi possível controlar a conexão.", 'error');
      return false;
    } finally {
      pending = false;
      render();
    }
  }
  if (el("account-disconnect"))
    el("account-disconnect").onclick = () =>
      ui.confirm('Desconectar WhatsApp?', 'A conexão atual será encerrada e o bot deixará de utilizar esta sessão até que uma nova conexão seja estabelecida.', 'Desconectar WhatsApp', () => accountAction('disconnect-account'));
  if (el("account-connect"))
    el("account-connect").onclick = () => accountAction("connect-account");
  async function botAction(actionName) {
        if (pending) return;
        pending = true;
        render();
        feedback("Processando controle do bot…", 'loading');
        try {
          const response = await fetch("/api/bot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: actionName }),
            signal: AbortSignal.timeout(25000),
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error);
          feedback(
            actionName === "stop"
              ? "Bot parado. Clique em Iniciar bot para retomar."
              : "Bot iniciando. Aguarde a conexão.",
          );
          await ui.refresh();
          await refresh();
          return true;
        } catch (e) {
          feedback(e.message, 'error');
          return false;
        } finally {
          pending = false;
          render();
        }
  }
  ['start','stop','restart'].forEach(actionName => el('bot-' + actionName).onclick = () => {
    if (actionName === 'start') botAction(actionName);
    else ui.confirm(actionName === 'stop' ? 'Parar bot?' : 'Reiniciar bot?', 'As partidas em andamento serão interrompidas. As credenciais e configurações serão preservadas.', actionName === 'stop' ? 'Parar bot' : 'Reiniciar bot', () => botAction(actionName));
  });
  el('tab-chat').onclick = () => { document.body.classList.toggle('show-conversations'); if (document.body.classList.contains('show-conversations')) el('conversation-workspace').scrollIntoView?.({block:'start'}); };
  el('tab-settings').onclick = () => ui.open('group-dialog');
  el("send-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = el("message-text").value;
    if (await action({ type: "send", text })) { el("message-text").value = ""; drafts.delete(selected); feedback('Mensagem enviada.'); }
  };
  el("authorize").onclick = () => {
    if (current()?.allowed) ui.confirm('Revogar autorização?', 'O bot deixará de executar jogos neste grupo. As preferências serão preservadas.', 'Revogar autorização', () => action({type:'authorize',allowed:false}));
    else action({type:'authorize',allowed:true});
  };
  el("game-type").onchange = () => {
    el("game-variant").value =
      current()?.settings.variants?.[el("game-type").value] || "classico";
  };
  el("start-game").onclick = () =>
    action({
      type: "start",
      game: el("game-type").value,
      variant: el("game-variant").value,
    });
  el("cancel-game").onclick = () => ui.confirm('Encerrar partida?', 'A partida atual deste grupo será encerrada.', 'Encerrar partida', () => action({type:'cancel'}));
  el("settings-form").oninput = () => {
    editing = true;
    feedback("Alterações ainda não salvas.");
  };
  el("settings-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const value = (name) => Number(form.elements.namedItem(name).value);
    const checked = (name) => form.elements.namedItem(name).checked;
    const settings = {
      enabled: checked("enabled"),
      cooldown: value("cooldown"),
      guessCooldown: value("guessCooldown"),
      numberMin: value("numberMin"),
      numberMax: value("numberMax"),
      modes: Object.fromEntries(modes.map((t) => [t, checked("mode-" + t)])),
      duration: Object.fromEntries(
        modes.map((t) => [t, value("duration-" + t)]),
      ),
      variants: Object.fromEntries(
        modes.map((t) => [t, form.elements.namedItem("variant-" + t).value]),
      ),
    };
    if (settings.numberMin >= settings.numberMax) { feedback('O menor número deve ser inferior ao maior número.', 'error'); return; }
    if (await action({ type: "settings", settings })) {
      editing = false;
      render();
      feedback("Configurações salvas.");
    }
  };
  refresh();
  setInterval(refresh, 3000);
})();
