
(() => {
  const KEY = 'saldoa_data_v1';
  let data = load(), currentId = null;
  let formMode = 'add', txMode = 'sale';
  let editingTxId = null;

  const $ = id => document.getElementById(id);
  const money = n => Number(n || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved && Array.isArray(saved.customers)
        ? saved : { customers: [] };
    } catch {
      return { customers: [] };
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random();
  }

  function balance(c) {
    return c.transactions.reduce(
      (s,t) => s + (t.type === 'sale' ? t.amount : -t.amount), 0
    );
  }

  function customer(id) {
    return data.customers.find(c => c.id === id);
  }

  function toast(msg) {
    $('toast').textContent = msg;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 2400);
  }

  function show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(id).classList.add('active');
    document.querySelectorAll('.nav button[data-tab]').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === id)
    );
    window.scrollTo(0, 0);
  }

  function render() {
    const total = data.customers.reduce(
      (s,c) => s + Math.max(0,balance(c)), 0
    );
    const debtors = data.customers.filter(c => balance(c) > 0.004).length;

    $('totalDebt').textContent = money(total);
    $('debtors').textContent = debtors;
    $('reportDebt').textContent = money(total);
    $('reportCustomers').textContent = data.customers.length;

    const q = $('search').value.toLowerCase();
    const list = data.customers
      .filter(c => (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q))
      .sort((a,b) => a.name.localeCompare(b.name));

    $('customerList').innerHTML = list.length
      ? list.map(c => {
          const b = balance(c);
          return `<button class="customer" data-open="${esc(c.id)}" style="text-align:left;width:100%;color:inherit">
            <span class="person">
              <span class="avatar">${esc(c.name.trim().charAt(0).toUpperCase())}</span>
              <span style="min-width:0">
                <strong>${esc(c.name)}</strong>
                <small>${c.phone ? esc(c.phone) : 'Sem telefone'}</small>
              </span>
            </span>
            <span class="amount">
              <strong class="${b>0?'negative':'positive'}">${money(Math.max(0,b))}</strong>
              <small>${b>0?'Em aberto':'Sem dívida'}</small>
            </span>
          </button>`;
        }).join('')
      : '<div class="empty"><b>Nenhum cliente por aqui</b>Cadastre seu primeiro cliente para começar.</div>';

    document.querySelectorAll('[data-open]').forEach(el =>
      el.addEventListener('click', () => openDetail(el.dataset.open))
    );
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;',
      '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function openDetail(id) {
    currentId = id;
    const c = customer(id);
    if (!c) return;

    $('detailName').textContent = c.name;
    $('detailPhone').textContent = c.phone || 'Telefone não informado';
    $('detailBalance').textContent = money(Math.max(0,balance(c)));

    const tx = [...c.transactions].sort(
      (a,b) => b.date.localeCompare(a.date) ||
      (b.createdAt || 0) - (a.createdAt || 0)
    );

    $('transactions').innerHTML = tx.length
      ? tx.map(t => `
        <div class="tx">
          <div style="min-width:0">
            <strong>${t.type === 'sale' ? 'Venda' : 'Pagamento'}</strong>
            <small>${esc(t.description || 'Sem descrição')} · ${formatDate(t.date)}</small>
          </div>
          <div style="text-align:right;min-width:120px">
            <strong class="${t.type === 'sale' ? 'negative' : 'positive'}">
              ${t.type === 'sale' ? '+' : '−'} ${money(t.amount)}
            </strong>
            <div class="actions" style="justify-content:flex-end;margin-top:8px">
              <button type="button" class="btn ghost small" data-edit-tx="${esc(t.id)}">Editar</button>
              <button type="button" class="btn danger small" data-delete-tx="${esc(t.id)}">Excluir</button>
            </div>
          </div>
        </div>
      `).join('')
      : '<div class="empty">Nenhuma movimentação registrada.</div>';

    document.querySelectorAll('[data-edit-tx]').forEach(el =>
      el.addEventListener('click', () => startTxEdit(el.dataset.editTx))
    );

    document.querySelectorAll('[data-delete-tx]').forEach(el =>
      el.addEventListener('click', () => deleteTx(el.dataset.deleteTx))
    );

    show('detailView');
  }

  function formatDate(s) {
    if (!s) return '';
    const [y,m,d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  function startCustomer(mode) {
    formMode = mode;
    const c = mode === 'edit' ? customer(currentId) : null;
    $('formTitle').textContent = c ? 'Editar cliente' : 'Novo cliente';
    $('customerName').value = c?.name || '';
    $('customerPhone').value = c?.phone || '';
    show('formView');
  }

  function startTx(mode) {
    txMode = mode;
    editingTxId = null;
    $('txTitle').textContent = mode === 'sale'
      ? 'Lançar venda' : 'Registrar pagamento';
    $('txAmount').value = '';
    $('txDescription').value = mode === 'sale' ? '' : 'Pagamento';
    $('txDate').value = today();
    $('txForm').querySelector('button[type="submit"]').textContent =
      'Confirmar lançamento';
    show('txFormView');
  }

  function startTxEdit(id) {
    const c = customer(currentId);
    const t = c?.transactions.find(x => x.id === id);
    if (!t) return;

    editingTxId = id;
    txMode = t.type;
    $('txTitle').textContent = 'Editar movimentação';
    $('txAmount').value = Number(t.amount).toFixed(2).replace('.', ',');
    $('txDescription').value = t.description || '';
    $('txDate').value = t.date || today();
    $('txForm').querySelector('button[type="submit"]').textContent =
      'Salvar alterações';
    show('txFormView');
  }

  function deleteTx(id) {
    const c = customer(currentId);
    if (!c) return;

    const t = c.transactions.find(x => x.id === id);
    if (!t) return;

    if (!confirm('Excluir esta movimentação? O saldo será recalculado.')) return;

    c.transactions = c.transactions.filter(x => x.id !== id);
    save();
    openDetail(currentId);
    toast('Movimentação excluída.');
  }

  $('addCustomerBtn').onclick = () => startCustomer('add');
  $('backBtn').onclick = () => show('homeView');
  $('formBackBtn').onclick = () =>
    currentId ? openDetail(currentId) : show('homeView');
  $('txBackBtn').onclick = () => openDetail(currentId);

  $('addSaleBtn').onclick = () => startTx('sale');
  $('addPaymentBtn').onclick = () => startTx('payment');
  $('editCustomerBtn').onclick = () => startCustomer('edit');

  $('deleteCustomerBtn').onclick = () => {
    const c = customer(currentId);
    if (!c) return;

    if (confirm(`Excluir ${c.name} e todo o histórico? Esta ação não pode ser desfeita.`)) {
      data.customers = data.customers.filter(x => x.id !== currentId);
      currentId = null;
      save();
      show('homeView');
      toast('Cliente excluído.');
    }
  };

  $('customerForm').onsubmit = e => {
    e.preventDefault();

    const name = $('customerName').value.trim();
    const phone = $('customerPhone').value.trim();
    if (!name) return;

    if (formMode === 'edit') {
      const c = customer(currentId);
      if (!c) return;
      c.name = name;
      c.phone = phone;
    } else {
      data.customers.push({
        id: uid(), name, phone, transactions: []
      });
    }

    save();

    if (formMode === 'edit') openDetail(currentId);
    else show('homeView');

    toast('Cliente salvo.');
  };

  $('txForm').onsubmit = e => {
    e.preventDefault();

    const raw = $('txAmount').value.trim()
      .replace(/\./g, '').replace(',', '.');
    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Informe um valor válido.');
      return;
    }

    const c = customer(currentId);
    if (!c) return;

    const old = editingTxId
      ? c.transactions.find(t => t.id === editingTxId)
      : null;

    const balanceWithoutOld = old
      ? balance(c) - (old.type === 'sale' ? old.amount : -old.amount)
      : balance(c);

    if (txMode === 'payment' && amount > balanceWithoutOld + 0.004) {
      if (!confirm('O pagamento é maior que o saldo atual. Deseja registrar mesmo assim?')) {
        return;
      }
    }

    const transaction = {
      id: old ? old.id : uid(),
      type: txMode,
      amount,
      description: $('txDescription').value.trim(),
      date: $('txDate').value || today(),
      createdAt: old ? old.createdAt : Date.now()
    };

    if (old) {
      const index = c.transactions.findIndex(t => t.id === editingTxId);
      c.transactions[index] = transaction;
    } else {
      c.transactions.push(transaction);
    }

    const wasEditing = !!old;
    editingTxId = null;
    save();
    openDetail(currentId);
    toast(wasEditing ? 'Movimentação atualizada.' :
      txMode === 'sale' ? 'Venda registrada.' : 'Pagamento registrado.');
  };

  $('search').addEventListener('input', render);

  document.querySelectorAll('[data-tab]').forEach(b =>
    b.onclick = () => show(b.dataset.tab)
  );

  $('exportBtn').onclick = () => {
    const blob = new Blob([
      JSON.stringify({
        ...data,
        exportedAt: new Date().toISOString(),
        app: 'Saldoa'
      }, null, 2)
    ], { type: 'application/json' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saldoa-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado.');
  };

  $('importBtn').onclick = () => $('importFile').click();

  $('importFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;

    try {
      const obj = JSON.parse(await f.text());

      if (!Array.isArray(obj.customers) ||
          !confirm('Importar este backup substituirá os dados atuais. Continuar?')) {
        return;
      }

      data = { customers: obj.customers };
      save();
      toast('Backup restaurado.');
    } catch {
      toast('Arquivo de backup inválido.');
    }

    e.target.value = '';
  };

  function net() {
    const online = navigator.onLine;
    $('netStatus').textContent = online ? '● Conectado' : '● Offline';
    $('netStatus').style.color = online ? '#d8e9df' : '#ffe0a3';
  }

  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  net();

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $('installBtn').classList.remove('hidden');
  });

  $('installBtn').onclick = async () => {
    if (!deferredPrompt) {
      toast('Use o menu do navegador e toque em “Adicionar à tela inicial”.');
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('installBtn').classList.add('hidden');
  };

  if ('serviceWorker' in navigator &&
      location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  render();
})();
