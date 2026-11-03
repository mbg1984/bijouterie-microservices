// =============================================================================
// Frontend de la bijouterie — logique de l'interface
// Le navigateur appelle uniquement des URL relatives (/api/...) : c'est Nginx
// qui relaie ces appels vers le microservice backend.
// =============================================================================
(() => {
  'use strict';

  const API = '/api';
  const LIBELLES_CATEGORIES = {
    bague: 'Bagues',
    collier: 'Colliers',
    bracelet: 'Bracelets',
    boucles: "Boucles d'oreilles",
    pendentif: 'Pendentifs',
    montre: 'Montres',
  };

  const state = {
    config: { shopName: 'Bijouterie', currency: 'EUR', maxFileSizeMb: 5, categories: Object.keys(LIBELLES_CATEGORIES), carats: [9, 14, 18, 22, 24] },
    bijoux: [],
    categorie: '',
    q: '',
    editing: null, // bijou en cours de modification (null = création)
  };

  const $ = (sel) => document.querySelector(sel);
  const el = {
    shopName: $('#shopName'), grid: $('#grid'), status: $('#status'), chips: $('#chips'),
    search: $('#search'), servedBy: $('#servedBy'), toast: $('#toast'),
    dialog: $('#dialog'), form: $('#form'), dialogTitle: $('#dialogTitle'), formError: $('#formError'),
    photo: $('#photo'), preview: $('#preview'), previewEmpty: $('#previewEmpty'), photoHint: $('#photoHint'),
    removeWrap: $('#removeWrap'), supprimerPhoto: $('#supprimerPhoto'), btnSave: $('#btnSave'),
    categorie: $('#categorie'), carat: $('#carat'),
  };

  // --- Utilitaires ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const formatPrix = (n) => {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: state.config.currency }).format(n);
    } catch {
      return `${Number(n).toFixed(2)} ${state.config.currency}`;
    }
  };

  // Illustration utilisée quand un bijou n'a pas encore de photo
  const placeholder = (categorie) => {
    const label = LIBELLES_CATEGORIES[categorie] || 'Bijou';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f7ecd0"/><stop offset="1" stop-color="#e9d39c"/></linearGradient>
        <linearGradient id="o" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e2b955"/><stop offset=".5" stop-color="#b8892d"/><stop offset="1" stop-color="#f0d68a"/></linearGradient></defs>
      <rect width="400" height="400" fill="url(#g)"/>
      <circle cx="200" cy="185" r="78" fill="none" stroke="url(#o)" stroke-width="22"/>
      <path d="M200 92 l16 -22 h-32z" fill="url(#o)"/>
      <text x="200" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#8f6618">${label}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  let toastTimer;
  function toast(message, isError = false) {
    el.toast.textContent = message;
    el.toast.classList.toggle('error', isError);
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3200);
  }

  async function api(path, options = {}) {
    const res = await fetch(API + path, options);
    if (res.status === 204) return null;
    let body = null;
    try { body = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error((body && body.error) || `Erreur HTTP ${res.status}`);
    return body;
  }

  // --- Chargement -------------------------------------------------------------
  async function loadConfig() {
    try {
      state.config = { ...state.config, ...(await api('/config')) };
    } catch (e) {
      console.warn('Configuration indisponible, valeurs par défaut utilisées', e);
    }
    el.shopName.textContent = state.config.shopName;
    document.title = `${state.config.shopName} — Bijoux en or`;
    el.servedBy.textContent = state.config.servedBy ? `Réponse API servie par : ${state.config.servedBy}` : '';
    el.photoHint.textContent = `JPEG, PNG ou WEBP · ${state.config.maxFileSizeMb} Mo max.`;

    el.categorie.innerHTML = state.config.categories
      .map((c) => `<option value="${c}">${escapeHtml(LIBELLES_CATEGORIES[c] || c)}</option>`).join('');
    el.carat.innerHTML = state.config.carats
      .map((c) => `<option value="${c}" ${c === 18 ? 'selected' : ''}>${c} carats</option>`).join('');

    const chips = [['', 'Tout'], ...state.config.categories.map((c) => [c, LIBELLES_CATEGORIES[c] || c])];
    el.chips.innerHTML = chips
      .map(([v, l]) => `<button type="button" class="chip" role="tab" data-cat="${v}" aria-selected="${v === state.categorie}">${escapeHtml(l)}</button>`)
      .join('');
  }

  async function loadBijoux() {
    el.status.textContent = 'Chargement…';
    const params = new URLSearchParams();
    if (state.categorie) params.set('categorie', state.categorie);
    if (state.q) params.set('q', state.q);
    try {
      state.bijoux = await api('/bijoux' + (params.toString() ? `?${params}` : ''));
      el.status.textContent = `${state.bijoux.length} bijou${state.bijoux.length > 1 ? 'x' : ''}`;
      render();
    } catch (e) {
      el.status.textContent = '';
      el.grid.innerHTML = `<div class="empty">Impossible de charger le catalogue.<br><small>${escapeHtml(e.message)}</small></div>`;
    }
  }

  function render() {
    if (!state.bijoux.length) {
      el.grid.innerHTML = '<div class="empty">Aucun bijou pour le moment. Ajoutez-en un !</div>';
      return;
    }
    el.grid.innerHTML = state.bijoux.map((b) => {
      const img = b.has_photo ? `${API}/bijoux/${b.id}/photo?v=${encodeURIComponent(b.updated_at)}` : placeholder(b.categorie);
      return `
        <article class="card">
          <img class="card-img" src="${img}" alt="${escapeHtml(b.nom)}" loading="lazy">
          <div class="card-body">
            <div class="card-cat">${escapeHtml(LIBELLES_CATEGORIES[b.categorie] || b.categorie)}</div>
            <h3>${escapeHtml(b.nom)}</h3>
            ${b.description ? `<p class="desc">${escapeHtml(b.description)}</p>` : ''}
            <div class="meta">
              <span class="badge">Or ${b.carat} ct</span>
              <span>${Number(b.poids_g).toLocaleString('fr-FR')} g</span>
              <span class="${b.stock <= 3 ? 'stock-low' : ''}">Stock : ${b.stock}</span>
            </div>
            <p class="price">${formatPrix(b.prix)}</p>
          </div>
          <div class="card-actions">
            <button class="btn btn-ghost" data-action="edit" data-id="${b.id}">Modifier</button>
            <button class="btn btn-danger" data-action="delete" data-id="${b.id}">Supprimer</button>
          </div>
        </article>`;
    }).join('');
  }

  // --- Formulaire -------------------------------------------------------------
  function setPreview(src) {
    el.preview.hidden = !src;
    el.previewEmpty.hidden = Boolean(src);
    if (src) el.preview.src = src;
  }

  function openForm(bijou = null) {
    state.editing = bijou;
    el.form.reset();
    el.formError.textContent = '';
    el.dialogTitle.textContent = bijou ? 'Modifier le bijou' : 'Nouveau bijou';
    el.removeWrap.hidden = !(bijou && bijou.has_photo);

    if (bijou) {
      for (const k of ['nom', 'description', 'categorie', 'carat', 'poids_g', 'prix', 'stock']) {
        el.form.elements[k].value = bijou[k] ?? '';
      }
      setPreview(bijou.has_photo ? `${API}/bijoux/${bijou.id}/photo?v=${encodeURIComponent(bijou.updated_at)}` : null);
    } else {
      el.carat.value = '18';
      setPreview(null);
    }
    el.dialog.showModal();
  }

  el.photo.addEventListener('change', () => {
    const file = el.photo.files[0];
    if (!file) return;
    if (file.size > state.config.maxFileSizeMb * 1024 * 1024) {
      el.formError.textContent = `Photo trop volumineuse (max ${state.config.maxFileSizeMb} Mo)`;
      el.photo.value = '';
      return;
    }
    el.formError.textContent = '';
    el.supprimerPhoto.checked = false;
    setPreview(URL.createObjectURL(file));
  });

  el.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!el.form.checkValidity()) {
      el.formError.textContent = 'Merci de remplir correctement tous les champs obligatoires.';
      el.form.reportValidity();
      return;
    }
    const fd = new FormData(el.form);
    if (!el.photo.files[0]) fd.delete('photo');
    if (state.editing && el.supprimerPhoto.checked) fd.set('supprimerPhoto', 'true');

    el.btnSave.disabled = true;
    try {
      if (state.editing) {
        await api(`/bijoux/${state.editing.id}`, { method: 'PUT', body: fd });
        toast('Bijou modifié');
      } else {
        await api('/bijoux', { method: 'POST', body: fd });
        toast('Bijou ajouté au catalogue');
      }
      el.dialog.close();
      await loadBijoux();
    } catch (e) {
      el.formError.textContent = e.message;
    } finally {
      el.btnSave.disabled = false;
    }
  });

  async function supprimer(id) {
    const b = state.bijoux.find((x) => x.id === id);
    if (!confirm(`Supprimer définitivement « ${b ? b.nom : 'ce bijou'} » ?`)) return;
    try {
      await api(`/bijoux/${id}`, { method: 'DELETE' });
      toast('Bijou supprimé');
      await loadBijoux();
    } catch (e) {
      toast(e.message, true);
    }
  }

  // --- Événements ---------------------------------------------------------------
  $('#btnAdd').addEventListener('click', () => openForm());
  $('#btnClose').addEventListener('click', () => el.dialog.close());
  $('#btnCancel').addEventListener('click', () => el.dialog.close());

  el.grid.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit') openForm(state.bijoux.find((b) => b.id === id));
    if (btn.dataset.action === 'delete') supprimer(id);
  });

  el.chips.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    state.categorie = chip.dataset.cat;
    el.chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-selected', String(c === chip)));
    loadBijoux();
  });

  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = el.search.value.trim(); loadBijoux(); }, 300);
  });

  // --- Démarrage ---------------------------------------------------------------
  loadConfig().then(loadBijoux);
})();
