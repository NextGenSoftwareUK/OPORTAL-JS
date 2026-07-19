(function () {
  'use strict';

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function showStatus(type, msg) { var el = getById('inventory-status'); if (!el) return; el.className = 'inventory-status inventory-status--' + type; el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : ''); el.hidden = false; }
  function hideStatus() { var el = getById('inventory-status'); if (el) el.hidden = true; }
  function setText(id, v) { var el = getById(id); if (el) el.textContent = v; }
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    return [];
  }

  var _allItems = [];

  function buildItemCard(item) {
    var name  = item.name  || item.Name  || item.title || item.Title || 'Unnamed Item';
    var desc  = item.description || item.Description || '';
    var type  = item.itemType || item.ItemType || item.type || item.Type || '';
    var rarity= item.rarity || item.Rarity || '';
    var thumb = item.thumbnailUrl || item.ThumbnailUrl || item.imageUrl || '';
    var icon  = type.toLowerCase().includes('weapon') ? '⚔️' : type.toLowerCase().includes('armor') ? '🛡️' : type.toLowerCase().includes('potion') ? '🧪' : '📦';
    return '<div class="modal-game-card">' +
      (thumb ? '<img class="modal-game-thumb" src="' + escHtml(thumb) + '" alt="" loading="lazy">' : '<div class="modal-game-thumb-placeholder">' + icon + '</div>') +
      '<div class="modal-game-info">' +
        '<div class="modal-game-title">' + escHtml(name) + '</div>' +
        (type   ? '<div class="modal-game-genre">' + escHtml(type) + (rarity ? ' · ' + escHtml(rarity) : '') + '</div>' : '') +
        (desc   ? '<div class="modal-game-desc">' + escHtml(desc.substring(0, 100) + (desc.length > 100 ? '…' : '')) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function applySearch(items) {
    var searchEl = getById('inv-search');
    if (!searchEl || !searchEl.value.trim()) return items;
    var q = searchEl.value.trim().toLowerCase();
    return items.filter(function(item) {
      var name = (item.name || item.Name || item.title || '').toLowerCase();
      var type = (item.itemType || item.type || '').toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }

  function renderAllItems(items) {
    var list = getById('inv-all-list');
    if (!list) return;
    var filtered = applySearch(items);
    if (!filtered.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🎒</div><p>No items match your search.</p></div>'; return; }
    list.innerHTML = filtered.map(buildItemCard).join('');
  }

  async function loadAllItems() {
    var list = getById('inv-all-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.starClient) { if (list) list.innerHTML = '<div class="map-empty"><p>Web5 SDK not ready.</p></div>'; return; }
    try {
      // SDK: @oasisomniverse/web5-api
      var sdkRes = await window.starClient.inventoryItems.getAllInventoryItems();
      _allItems = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('inv-stat-total', _allItems.length || '0');
      renderAllItems(_allItems);
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load items.</p></div>'; }
  }

  async function loadMyItems() {
    var list = getById('inv-mine-list');
    if (list) list.innerHTML = '<div class="map-empty"><p>Loading…</p></div>';
    if (!window.starClient) return;
    try {
      var sdkRes = await window.starClient.inventoryItems.loadAllInventoryItemsForAvatar();
      var items = extractList(sdkRes && !sdkRes.isError ? sdkRes.result : null);
      setText('inv-stat-mine', items.length || '0');
      if (!list) return;
      if (!items.length) { list.innerHTML = '<div class="map-empty"><div class="map-empty-icon">🎒</div><p>Your inventory is empty.</p></div>'; return; }
      list.innerHTML = items.map(buildItemCard).join('');
    } catch(e) { if (list) list.innerHTML = '<div class="map-empty"><p>Could not load your items.</p></div>'; }
  }

  function switchTab(tab) {
    var block = getById('inventory-modal-block');
    if (!block) return;
    block.querySelectorAll('.map-tab').forEach(function(t) { t.classList.toggle('is-active', t.dataset.tab === tab); });
    block.querySelectorAll('.map-tab-panel').forEach(function(p) { p.hidden = p.id !== 'inv-tab-' + tab; });
    if (tab === 'mine') loadMyItems();
  }

  function openInventoryModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('inventory-modal-block');
    if (!modal || !block) return false;
    document.querySelectorAll('.js-modal-block').forEach(function(b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');
    switchTab('all'); loadAllItems();
    return false;
  }

  function closeInventoryModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('inventory-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  function bind() {
    var block = getById('inventory-modal-block');
    if (!block || block.dataset.invBound === 'true') { window.openInventoryModal = openInventoryModal; window.closeInventoryModal = closeInventoryModal; return; }
    var closeBtn = getById('inventory-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.preventDefault(); closeInventoryModal(); });
    var tabBar = block.querySelector('.map-tabs');
    if (tabBar) tabBar.addEventListener('click', function(e) { var t = e.target.closest('.map-tab'); if (t) switchTab(t.dataset.tab); });
    var refreshBtn = getById('inv-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAllItems);
    var searchEl = getById('inv-search');
    if (searchEl) searchEl.addEventListener('input', function() { renderAllItems(_allItems); });
    block.dataset.invBound = 'true';
    window.openInventoryModal = openInventoryModal; window.closeInventoryModal = closeInventoryModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
