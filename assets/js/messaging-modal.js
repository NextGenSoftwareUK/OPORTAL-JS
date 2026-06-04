(function () {
  var API_BASE = window.apiUrl || window.API_BASE;
  var currentSessionId = null;
  var chatPollInterval = null;

  function getById(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readAvatar() {
    try {
      var raw = localStorage.getItem('avatar');
      return (raw && raw !== 'undefined') ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function getToken(p) { return p && (p.jwtToken || p.token || ''); }
  function getAvatarId(p) { return p && (p.id || p.Id || p.avatarId || p.AvatarId || ''); }

  function extractList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.result)) return data.result.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.messages)) return data.messages;
    if (Array.isArray(data.notifications)) return data.notifications;
    if (Array.isArray(data.items)) return data.items;
    return null;
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  function renderStatus(type, msg) {
    var el = getById('messaging-modal-status');
    if (!el) return;
    el.className = 'messaging-status messaging-status--' + type;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('messaging-modal-status');
    if (el) el.hidden = true;
  }

  // ── Stat helpers ─────────────────────────────────────────────────────────────

  function setText(id, val) {
    var el = getById(id);
    if (el) el.textContent = val;
  }

  // ── Conversation row builder ──────────────────────────────────────────────────

  function buildConversationRow(msg) {
    var senderId = escapeHtml(msg.fromAvatarId || msg.FromAvatarId || msg.senderId || msg.SenderId || msg.from || msg.From || '?');
    var senderName = escapeHtml(msg.fromAvatarUsername || msg.FromAvatarUsername || msg.senderName || msg.SenderName || senderId);
    var preview = escapeHtml((msg.message || msg.Message || msg.body || msg.Body || msg.content || msg.Content || '').slice(0, 80));
    var ts = msg.createdDate || msg.CreatedDate || msg.timestamp || msg.Timestamp || msg.date || msg.Date || '';
    var unread = msg.unreadCount || msg.UnreadCount || 0;
    var isUnread = msg.read === false || msg.isRead === false || msg.IsRead === false;

    var initials = senderName.slice(0, 2).toUpperCase() || '??';

    return '<div class="msg-conversation-row' + (isUnread ? ' msg-conversation-row--unread' : '') + '">' +
      '<div class="msg-avatar-circle">' + initials + '</div>' +
      '<div class="msg-conversation-body">' +
        '<div class="msg-conversation-header">' +
          '<span class="msg-conversation-name">' + senderName + '</span>' +
          (ts ? '<span class="msg-conversation-time">' + escapeHtml(formatDate(ts)) + '</span>' : '') +
        '</div>' +
        '<div class="msg-conversation-preview">' + preview + '</div>' +
      '</div>' +
      (unread ? '<span class="msg-unread-badge">' + escapeHtml(String(unread)) + '</span>' : '') +
    '</div>';
  }

  // ── Notification row builder ──────────────────────────────────────────────────

  function buildNotificationRow(notif) {
    var text = escapeHtml(notif.message || notif.Message || notif.body || notif.Body || notif.text || notif.Text || notif.title || notif.Title || 'Notification');
    var ts = notif.createdDate || notif.CreatedDate || notif.timestamp || notif.Timestamp || notif.date || notif.Date || '';
    var isRead = notif.read === true || notif.isRead === true || notif.IsRead === true;
    var icon = notif.type === 'warning' ? '⚠️' : notif.type === 'success' ? '✅' : '🔔';

    return '<div class="msg-notification-row' + (isRead ? ' msg-notification-row--read' : '') + '">' +
      '<div class="msg-notification-icon">' + icon + '</div>' +
      '<div class="msg-notification-body">' +
        '<div class="msg-notification-text">' + text + '</div>' +
        (ts ? '<div class="msg-notification-time">' + escapeHtml(formatDate(ts)) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  // ── Chat message builder ──────────────────────────────────────────────────────

  function buildChatMessage(msg, isOwn) {
    var text = escapeHtml(msg.message || msg.Message || msg.content || msg.Content || msg.text || msg.Text || '');
    var ts = msg.createdDate || msg.CreatedDate || msg.timestamp || msg.Timestamp || '';

    return '<div class="msg-chat-bubble-wrap msg-chat-bubble-wrap--' + (isOwn ? 'own' : 'other') + '">' +
      '<div class="msg-chat-bubble">' +
        '<div class="msg-chat-bubble-text">' + text + '</div>' +
        (ts ? '<div class="msg-chat-bubble-time">' + escapeHtml(formatTime(ts)) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  // ── API helpers ───────────────────────────────────────────────────────────────

  function authHeaders(token) {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  }

  async function apiFetch(url, options) {
    try {
      var res = await fetch(url, options);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  // ── Conversations ────────────────────────────────────────────────────────────

  async function loadConversations() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    var data = await apiFetch(API_BASE + '/api/messaging/messages', {
      headers: authHeaders(token)
    });

    var messages = extractList(data);
    var list = getById('msg-conversations-list');
    if (!list) return;

    if (!messages || !messages.length) {
      list.innerHTML = '<div class="messaging-empty"><div class="messaging-empty-icon">💬</div><p>No conversations yet.<br>Send a message to start a conversation.</p></div>';
      setText('msg-stat-unread', '0');
      setText('msg-stat-chats', '0');
      return;
    }

    // Group by sender
    var byId = {};
    messages.forEach(function (m) {
      var sid = m.fromAvatarId || m.FromAvatarId || m.senderId || m.SenderId || m.from || m.From || 'unknown';
      if (!byId[sid]) byId[sid] = [];
      byId[sid].push(m);
    });

    var grouped = Object.keys(byId).map(function (sid) {
      var msgs = byId[sid];
      // Sort descending, take latest
      msgs.sort(function (a, b) {
        var ta = a.createdDate || a.CreatedDate || a.timestamp || '';
        var tb = b.createdDate || b.CreatedDate || b.timestamp || '';
        return ta < tb ? 1 : -1;
      });
      var latest = msgs[0];
      var unreadCount = msgs.filter(function (m) { return m.read === false || m.isRead === false || m.IsRead === false; }).length;
      return Object.assign({}, latest, { unreadCount: unreadCount });
    });

    var totalUnread = messages.filter(function (m) { return m.read === false || m.isRead === false || m.IsRead === false; }).length;
    setText('msg-stat-unread', String(totalUnread));
    setText('msg-stat-chats', String(Object.keys(byId).length));

    list.innerHTML = grouped.map(buildConversationRow).join('');
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  async function loadNotifications() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    var data = await apiFetch(API_BASE + '/api/messaging/notifications', {
      headers: authHeaders(token)
    });

    var notifs = extractList(data);
    var list = getById('msg-notifications-list');
    if (!list) return;

    if (!notifs || !notifs.length) {
      list.innerHTML = '<div class="messaging-empty"><div class="messaging-empty-icon">🔔</div><p>No notifications found.</p></div>';
      setText('msg-stat-notifs', '0');
      return;
    }

    var unread = notifs.filter(function (n) { return n.read === false || n.isRead === false || n.IsRead === false; }).length;
    setText('msg-stat-notifs', String(unread));
    list.innerHTML = notifs.map(buildNotificationRow).join('');
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  async function sendMessage() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { renderStatus('error', 'Not authenticated.'); return; }

    var toAvatarId = ((getById('msg-to-avatar') || {}).value || '').trim();
    var body = ((getById('msg-body') || {}).value || '').trim();

    if (!toAvatarId) { renderStatus('error', 'Please enter a recipient avatar ID.'); return; }
    if (!body) { renderStatus('error', 'Please enter a message.'); return; }

    renderStatus('loading', 'Sending message…');
    try {
      var res = await fetch(API_BASE + '/api/messaging/send-message-to-avatar/' + encodeURIComponent(toAvatarId), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ message: body })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      renderStatus('success', 'Message sent.');
      var form = getById('msg-send-form');
      if (form) form.reset();
      setTimeout(hideStatus, 3000);
    } catch (e) {
      renderStatus('error', 'Failed to send: ' + e.message);
    }
  }

  // ── Mark read ────────────────────────────────────────────────────────────────

  async function markMessagesRead() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;
    renderStatus('loading', 'Marking messages as read…');
    try {
      await fetch(API_BASE + '/api/messaging/mark-messages-read', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({})
      });
      await fetch(API_BASE + '/api/messaging/mark-notifications-read', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({})
      });
      renderStatus('success', 'All marked as read.');
      setTimeout(function () { hideStatus(); loadNotifications(); loadConversations(); }, 1500);
    } catch (e) {
      renderStatus('error', 'Could not mark as read.');
    }
  }

  // ── Chat session ─────────────────────────────────────────────────────────────

  function showChatUI(sessionId) {
    currentSessionId = sessionId;
    var sessionWrap = getById('msg-chat-session-wrap');
    var noSession = getById('msg-no-session');
    var sessionIdEl = getById('msg-chat-session-id');
    if (sessionWrap) sessionWrap.hidden = false;
    if (noSession) noSession.hidden = true;
    if (sessionIdEl) sessionIdEl.textContent = String(sessionId).slice(0, 16) + (String(sessionId).length > 16 ? '…' : '');
    setText('msg-stat-chats', '1');
    loadChatHistory();
    chatPollInterval = setInterval(loadChatHistory, 3000);
  }

  function hideChatUI() {
    currentSessionId = null;
    if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
    var sessionWrap = getById('msg-chat-session-wrap');
    var noSession = getById('msg-no-session');
    if (sessionWrap) sessionWrap.hidden = true;
    if (noSession) noSession.hidden = false;
    var messages = getById('msg-chat-messages');
    if (messages) messages.innerHTML = '';
    setText('msg-stat-chats', '0');
  }

  async function startChatSession() {
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) { renderStatus('error', 'Not authenticated.'); return; }

    renderStatus('loading', 'Starting chat session…');
    try {
      var res = await fetch(API_BASE + '/api/chat/start-new-chat-session', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({})
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var sessionId = (data && (data.sessionId || data.SessionId || data.id || data.Id || data.result)) || null;
      if (!sessionId) throw new Error('No session ID returned');
      hideStatus();
      showChatUI(sessionId);
    } catch (e) {
      renderStatus('error', 'Could not start session: ' + e.message);
    }
  }

  async function sendChatMessage() {
    if (!currentSessionId) return;
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    var input = getById('msg-chat-input');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    if (input) input.value = '';

    try {
      await fetch(API_BASE + '/api/chat/send-message/' + encodeURIComponent(currentSessionId), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ message: text })
      });
      loadChatHistory();
    } catch (e) { /* silent */ }
  }

  async function loadChatHistory() {
    if (!currentSessionId) return;
    var profile = readAvatar();
    var token = getToken(profile);
    if (!token) return;

    var data = await apiFetch(API_BASE + '/api/chat/history/' + encodeURIComponent(currentSessionId), {
      headers: authHeaders(token)
    });

    var messages = extractList(data);
    var container = getById('msg-chat-messages');
    if (!container) return;
    if (!messages || !messages.length) return;

    var avatarId = getAvatarId(profile);
    container.innerHTML = messages.map(function (msg) {
      var senderId = msg.fromAvatarId || msg.FromAvatarId || msg.senderId || msg.SenderId || '';
      var isOwn = avatarId && senderId === avatarId;
      return buildChatMessage(msg, isOwn);
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async function endChatSession() {
    hideChatUI();
    renderStatus('success', 'Chat session ended.');
    setTimeout(hideStatus, 2500);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('messaging-modal-block');
    if (!block) return;
    block.querySelectorAll('.messaging-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    block.querySelectorAll('.messaging-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'messaging-tab-' + tab;
    });

    if (tab === 'conversations') loadConversations();
    if (tab === 'notifications') loadNotifications();
  }

  // ── Open / close ─────────────────────────────────────────────────────────────

  function openMessagingModal() {
    var loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
      if (typeof window.showCheckAPIMessage === 'function') window.showCheckAPIMessage();
      return false;
    }

    var modal = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block = getById('messaging-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('conversations');
    return false;
  }

  function closeMessagingModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('messaging-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
    if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('messaging-modal-block');
    if (!block || block.dataset.messagingBound === 'true') {
      window.openMessagingModal = openMessagingModal;
      window.closeMessagingModal = closeMessagingModal;
      return;
    }

    var closeBtn = getById('messaging-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeMessagingModal(); });

    var refreshBtn = getById('msg-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { loadConversations(); });

    var sendForm = getById('msg-send-form');
    if (sendForm) sendForm.addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });

    var sendBtn = getById('msg-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', function () { sendMessage(); });

    var markReadBtn = getById('msg-mark-read-btn');
    if (markReadBtn) markReadBtn.addEventListener('click', function () { markMessagesRead(); });

    var startSessionBtn = getById('msg-start-session-btn');
    if (startSessionBtn) startSessionBtn.addEventListener('click', function () { startChatSession(); });

    var endSessionBtn = getById('msg-end-session-btn');
    if (endSessionBtn) endSessionBtn.addEventListener('click', function () { endChatSession(); });

    var chatSendBtn = getById('msg-chat-send-btn');
    if (chatSendBtn) chatSendBtn.addEventListener('click', function () { sendChatMessage(); });

    var chatInput = getById('msg-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
    }

    // Tabs
    var tabBar = block.querySelector('.messaging-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.messaging-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    block.dataset.messagingBound = 'true';
    window.openMessagingModal = openMessagingModal;
    window.closeMessagingModal = closeMessagingModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('portal-components-ready', bind);
})();
