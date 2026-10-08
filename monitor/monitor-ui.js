(() => {
  const el = id => document.getElementById(id);
  const make = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const icons = () => window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
  const icon = name => { const tile = make('span', '', 'icon-tile'); const i = document.createElement('i'); i.dataset.lucide = name; tile.append(i); return tile; };
  const fmt = t => new Date(t).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'});
  const compact = document.body.classList.contains('compact');
  let status, paused = false, busy = false, fetching = false, eventSignature = '', legalDocuments;
  const modalHistory = [];
  let returning = false;
  function updateBack() {
    document.querySelectorAll('dialog').forEach(dialog => {
      let back = dialog.querySelector('.modal-back');
      if (!back) {
        back = document.createElement('button');
        back.type = 'button';
        back.className = 'modal-back ghost';
        back.textContent = '← Voltar';
        back.setAttribute('aria-label', 'Voltar para a tela anterior');
        back.addEventListener('click', goBack);
        const head = dialog.querySelector('.modal-head');
        if (head) head.prepend(back);
      }
      back.hidden = !dialog.open || modalHistory.length === 0 || dialog.id === 'confirm-dialog';
      back.disabled = busy;
    });
  }
  function open(id) {
    if (busy) return;
    const target = el(id);
    if (!target || target.open) return;
    const active = [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'confirm-dialog').at(-1);
    if (active) {
      modalHistory.push({id:active.id, focus:document.activeElement});
      active.close();
    } else if (!returning) modalHistory.length = 0;
    el('connection-menu').hidden = true;
    el('connection-menu-toggle').setAttribute('aria-expanded','false');
    document.body.classList.remove('sidebar-open');
    target.showModal();
    updateBack();
    document.dispatchEvent(new CustomEvent('eth:dialog', {detail:id}));
  }
  function goBack() {
    if (busy) return;
    const current = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (!current || current.id === 'confirm-dialog') return;
    current.close();
    const previous = modalHistory.pop();
    if (previous) {
      returning = true;
      open(previous.id);
      returning = false;
      if (previous.focus?.isConnected && previous.focus.closest('dialog') === el(previous.id)) previous.focus.focus();
    }
    updateBack();
  }
  function closeFlow(dialog) {
    if (busy) return;
    modalHistory.length = 0;
    dialog?.close();
    updateBack();
  }
  function setBusy(value) {
    busy = value;
    document.querySelectorAll('[data-close]').forEach(b => b.disabled = value);
    el('confirm-action').disabled = value;
    el('confirm-dialog').setAttribute('aria-busy', String(value));
  }
  function confirm(title, description, label, operation) {
    if (busy) return;
    el('confirm-title').textContent = title; el('confirm-description').textContent = description;
    el('confirm-action').textContent = label; el('confirm-feedback').textContent = '';
    // Keep the originating modal underneath so its selection and draft remain available.
    el('connection-menu').hidden = true;
    el('connection-menu-toggle').setAttribute('aria-expanded','false');
    el('confirm-dialog').showModal();
    el('confirm-cancel').focus();
    el('confirm-action').onclick = async () => {
      if (busy) return;
      setBusy(true); el('confirm-feedback').textContent = 'Processando…';
      try { if (await operation()) el('confirm-dialog').close(); }
      catch (e) { el('confirm-feedback').textContent = e.message || 'Não foi possível concluir.'; }
      finally { setBusy(false); }
    };
  }
  window.ETHUI = {icons, icon, make, open, confirm, setBusy, get status(){return status;}, refresh: refreshStatus};
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
    if (busy) return;
    const dialog = b.closest('dialog');
    if (dialog?.id === 'confirm-dialog') { dialog.close(); updateBack(); }
    else closeFlow(dialog);
  }));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('cancel', e => {
    if (busy) { e.preventDefault(); return; }
    if (d.id !== 'confirm-dialog') { e.preventDefault(); goBackOrClose(d); }
  }));
  function goBackOrClose(dialog) {
    if (modalHistory.length) goBack();
    else closeFlow(dialog);
  }
  updateBack();
  el('connection-menu-toggle').onclick = () => {
    const menu = el('connection-menu'); menu.hidden = !menu.hidden;
    el('connection-menu-toggle').setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('button').focus();
  };
  document.addEventListener('click', e => { if (!e.target.closest('.connection-menu')) { el('connection-menu').hidden = true; el('connection-menu-toggle').setAttribute('aria-expanded','false'); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el('connection-menu').hidden) { el('connection-menu').hidden = true; el('connection-menu-toggle').setAttribute('aria-expanded','false'); el('connection-menu-toggle').focus(); } });
  el('toggle-sidebar').onclick = () => document.body.classList.toggle('sidebar-open');
  el('close-sidebar').onclick = () => document.body.classList.remove('sidebar-open');
  el('chat-back').onclick = () => document.body.classList.remove('chat-selected');
  el('all-activity').onclick = () => { renderEvents(true); open('activity-dialog'); };
  el('activity-filter').onchange = () => { eventSignature = ''; renderEvents(); };
  el('pause').onclick = () => {
    paused = !paused; el('pause').setAttribute('aria-label',paused ? 'Retomar atualização da atividade' : 'Pausar atualização da atividade');
    el('pause').replaceChildren(); const i = document.createElement('i'); i.dataset.lucide = paused ? 'play' : 'pause'; el('pause').append(i); icons();
    if (!paused) { eventSignature = ''; renderEvents(); }
  };
  function eventRow(event) {
    const row = make('div', '', 'event' + (event.level >= 40 ? ' error' : ''));
    row.append(icon(event.level >= 40 ? 'triangle-alert' : /conectado|desconectado/i.test(event.text) ? 'power' : /grupo/i.test(event.text) ? 'users' : /jogo|partida/i.test(event.text) ? 'gamepad-2' : 'message-square'));
    const description = make('div',event.text,'event-description');
    if (event.group) description.append(make('span',event.group,'event-group'));
    row.append(description, make('small',event.time ? new Date(event.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}) : 'Registro'));
    const details = make('button','','icon-button ghost event-details'); details.type = 'button'; details.setAttribute('aria-label','Detalhes: ' + event.text); const i = document.createElement('i'); i.dataset.lucide='ellipsis-vertical'; details.append(i);
    details.onclick = () => { el('event-description').textContent=event.text; el('event-data').replaceChildren(); for (const [label,value] of [['Horário',event.time ? fmt(event.time) : 'Não registrado'],['Grupo',event.group || 'Sistema'],['Código',event.code ?? '—']]) el('event-data').append(make('dt',label),make('dd',String(value))); open('event-dialog'); };
    row.append(details); return row;
  }
  function renderEvents(all = false) {
    if (!status) return;
    const filter = el('activity-filter').value;
    let events = [...status.events, ...status.errors.map(text=>({text,level:50}))].reverse().filter(e => !filter || e.groupId === filter || e.group === filter);
    const signature = JSON.stringify([events,filter]);
    const target = el(all ? 'all-events' : 'events');
    if (!all && (paused || signature === eventSignature)) return;
    if (!all) eventSignature = signature;
    const top = target.scrollTop;
    if (compact && !all) events = events.slice(0,4);
    target.replaceChildren(...events.map(eventRow));
    if (!events.length) target.append(make('div','Nenhum evento registrado para este filtro.','empty'));
    target.scrollTop = top; icons();
  }
  async function refreshStatus() {
    if (fetching) return;
    fetching = true;
    try {
      const response = await fetch('/api/status', {signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error('Não foi possível recuperar o status.');
      status = await response.json();
      el('process').textContent = status.running ? 'Em execução' : 'Parado';
      el('bot-status').textContent = status.running ? 'Em execução' : 'Parado';
      el('pid').textContent = status.running ? 'PID ' + status.pid : 'Nenhum processo ativo';
      el('restarts').textContent = status.restarts + ' reinícios automáticos registrados';
      el('since').textContent = status.connection === 'connected' && status.connectedAt ? 'Desde ' + fmt(status.connectedAt) : 'Conexão aguardando confirmação';
      const seconds = status.connectedAt && status.connection === 'connected' ? Math.max(0,Math.floor((status.now - status.connectedAt)/1000)) : null;
      el('uptime-metric').textContent = seconds === null ? '—' : seconds < 60 ? seconds+'s' : seconds < 3600 ? Math.floor(seconds/60)+'min' : Math.floor(seconds/3600)+'h '+Math.floor(seconds%3600/60)+'min';
      const groups = status.groups;
      const signature = JSON.stringify(groups.map(g=>[g.id,g.name]));
      if (el('activity-filter').dataset.signature !== signature) {
        const selected = el('activity-filter').value;
        el('activity-filter').replaceChildren(new Option('Todos os grupos',''), ...groups.map(g=>new Option(g.name,g.id)));
        el('activity-filter').value = selected; el('activity-filter').dataset.signature=signature;
      }
      el('updated').textContent = 'Última atualização: ' + fmt(status.now);
      el('warning').textContent = status.supervisorError || '';
      renderEvents();
      document.dispatchEvent(new CustomEvent('eth:status', {detail:status}));
    } catch(e) {
      status = undefined;
      el('updated').textContent = 'Monitor sem resposta. Tentando novamente…';
      el('warning').textContent = e.message || 'Não foi possível recuperar o status.';
      document.dispatchEvent(new CustomEvent('eth:status', {detail:null}));
    } finally { fetching = false; }
  }
  document.querySelectorAll('[data-legal]').forEach(button => button.onclick = async () => {
    open('legal-dialog'); el('legal-dialog-title').textContent = button.textContent; el('legal-body').textContent = 'Carregando documento…';
    try {
      if (!legalDocuments) { const response=await fetch('/legal-documents.json'); if (!response.ok) throw Error(); legalDocuments=await response.json(); }
      const doc=legalDocuments.find(d=>d.id === button.dataset.legal); if (!doc) throw Error();
      el('legal-body').replaceChildren(...doc.sections.flatMap(([title,text])=>[make('h3',title),make('p',text)]));
    } catch { el('legal-body').textContent='Não foi possível carregar o documento. Feche e tente novamente.'; }
  });
  // Persistent reconnect prompt: informational, never reconnects without a click.
  const reconnect = document.createElement('aside');
  reconnect.id = 'reconnect-prompt';
  reconnect.className = 'reconnect-prompt';
  reconnect.hidden = true;
  reconnect.setAttribute('aria-label', 'Reconectar WhatsApp');
  reconnect.innerHTML = '<span class="reconnect-symbol" aria-hidden="true">↗</span><div class="reconnect-copy"><strong>WhatsApp desconectado</strong><small>Conecte para retomar os jogos e mensagens.</small></div><button type="button" class="primary" id="reconnect-now">Conectar agora</button>';
  document.body.append(reconnect);
  el('reconnect-now').addEventListener('click', () => open('connection-dialog'));
  document.addEventListener('eth:status', event => {
    const s = event.detail;
    // Distinguish loss of monitor connectivity from an actual WhatsApp logout.
    reconnect.hidden = !s || s.connection === 'connected';
    if (!reconnect.hidden) {
      reconnect.querySelector('strong').textContent = s.running ? 'WhatsApp desconectado' : 'Bot parado';
      reconnect.querySelector('small').textContent = s.running ? 'Conecte para retomar os jogos e mensagens.' : 'Inicie o bot para restabelecer a conexão.';
      el('reconnect-now').textContent = s.running ? 'Conectar agora' : 'Ver conexão';
    }
  });
  if (compact) el('install-extension').hidden = true;
  icons(); refreshStatus(); setInterval(refreshStatus,3000);
})();
