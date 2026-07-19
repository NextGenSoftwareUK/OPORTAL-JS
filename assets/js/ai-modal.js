(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getById(id) { return document.getElementById(id); }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showStatus(type, msg) {
    var el = getById('ai-modal-status');
    if (!el) return;
    el.className = 'ai-modal-status ai-modal-status--' + type;
    el.innerHTML = msg + (type === 'loading' ? ' <span class="modal-spinner"></span>' : '');
    el.hidden = false;
  }

  function hideStatus() {
    var el = getById('ai-modal-status');
    if (el) el.hidden = true;
  }

  function showStatusBrief(type, msg) {
    showStatus(type, msg);
    setTimeout(hideStatus, 3500);
  }

  function readAvatar() {
    try { var r = localStorage.getItem('avatar'); return (r && r !== 'undefined') ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  function getAvatarId(p) { return p && (p.id || p.Id || p.avatarId || p.AvatarId || ''); }

  // ── Chat state ────────────────────────────────────────────────────────────────

  var chatMessages = []; // { role: 'user'|'assistant', content: string }

  function appendChatBubble(role, content) {
    var box = getById('ai-chat-messages');
    if (!box) return;
    // Remove welcome message on first real message
    var welcome = box.querySelector('.ai-chat-welcome');
    if (welcome) welcome.remove();

    var div = document.createElement('div');
    div.className = 'ai-chat-bubble ai-chat-bubble--' + role;
    div.innerHTML = '<div class="ai-chat-bubble-content">' + escHtml(content) + '</div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function appendThinking() {
    var box = getById('ai-chat-messages');
    if (!box) return null;
    var div = document.createElement('div');
    div.className = 'ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--thinking';
    div.innerHTML = '<div class="ai-chat-bubble-content"><span class="ai-thinking-dots"><span>.</span><span>.</span><span>.</span></span></div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  // ── Load available models ─────────────────────────────────────────────────────

  async function loadModels() {
    var sel = getById('ai-chat-model');
    if (!sel || !window.aiClient) return;
    try {
      // SDK: @oasisomniverse/web6-api
      var sdkRes = await window.aiClient.completion.openServModels();
      var models = sdkRes && !sdkRes.isError && sdkRes.result;
      if (Array.isArray(models) && models.length) {
        sel.innerHTML = models.map(function (m) {
          var id = m.id || m.Id || m.modelId || m.name || m;
          var label = m.name || m.displayName || id;
          return '<option value="' + escHtml(String(id)) + '">' + escHtml(String(label)) + '</option>';
        }).join('');
      } else {
        sel.innerHTML = '<option value="gpt-4o">GPT-4o</option><option value="gpt-4">GPT-4</option><option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>';
      }
    } catch (e) {
      sel.innerHTML = '<option value="gpt-4o">GPT-4o</option><option value="gpt-4">GPT-4</option><option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>';
    }
  }

  // ── Send chat message ─────────────────────────────────────────────────────────

  async function sendChat() {
    var input = getById('ai-chat-input');
    var modelSel = getById('ai-chat-model');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    if (!window.aiClient) { showStatusBrief('error', 'AI client not initialised. Please refresh the page.'); return; }

    var profile = readAvatar();
    var avatarId = getAvatarId(profile);

    input.value = '';
    input.disabled = true;
    var sendBtn = getById('ai-chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    chatMessages.push({ role: 'user', content: text });
    appendChatBubble('user', text);
    var thinkingEl = appendThinking();

    try {
      var model = modelSel ? modelSel.value : '';
      var payload = {
        messages: chatMessages.map(function (m) { return { role: m.role, content: m.content }; }),
      };
      if (model) payload.model = model;
      if (avatarId) payload.avatarId = avatarId;

      // SDK: @oasisomniverse/web6-api
      var sdkRes = await window.aiClient.completion.complete(payload);
      /* OLD fetch: POST /v1/complete */

      if (thinkingEl) thinkingEl.remove();

      if (sdkRes && !sdkRes.isError && sdkRes.result) {
        var reply = sdkRes.result;
        var replyText = typeof reply === 'string' ? reply
          : reply.content || reply.message || reply.text || reply.choices && reply.choices[0] && (reply.choices[0].message && reply.choices[0].message.content || reply.choices[0].text) || JSON.stringify(reply);
        chatMessages.push({ role: 'assistant', content: replyText });
        appendChatBubble('assistant', replyText);
      } else {
        var errMsg = sdkRes && sdkRes.message ? sdkRes.message : 'AI did not return a response.';
        appendChatBubble('assistant', '⚠️ ' + errMsg);
      }
    } catch (e) {
      if (thinkingEl) thinkingEl.remove();
      appendChatBubble('assistant', '⚠️ Error communicating with AI. Please try again.');
    }

    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }

  // ── Image generation ──────────────────────────────────────────────────────────

  async function generateImage() {
    var promptEl = getById('ai-img-prompt');
    var modelEl  = getById('ai-img-model');
    var sizeEl   = getById('ai-img-size');
    var resultEl = getById('ai-img-result');
    var btn      = getById('ai-img-generate-btn');

    if (!promptEl) return;
    var prompt = promptEl.value.trim();
    if (!prompt) { showStatusBrief('warn', 'Please enter a prompt.'); return; }

    if (!window.aiClient) { showStatusBrief('error', 'AI client not initialised. Please refresh the page.'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }

    try {
      var payload = { prompt: prompt };
      if (modelEl && modelEl.value) payload.model = modelEl.value;
      if (sizeEl && sizeEl.value)   payload.size  = sizeEl.value;

      // SDK: @oasisomniverse/web6-api
      var sdkRes = await window.aiClient.images.generate(payload);
      /* OLD fetch: POST /v1/images/generate */

      if (sdkRes && !sdkRes.isError && sdkRes.result) {
        var res = sdkRes.result;
        var url = typeof res === 'string' ? res
          : res.url || res.imageUrl || res.data && Array.isArray(res.data) && res.data[0] && res.data[0].url || null;
        if (url) {
          resultEl.innerHTML = '<img src="' + escHtml(url) + '" alt="Generated image" class="ai-generated-img">' +
            '<p class="ai-img-caption">' + escHtml(prompt) + '</p>';
          resultEl.hidden = false;
        } else {
          showStatusBrief('warn', 'Image generated but no URL returned.');
        }
      } else {
        var errMsg = sdkRes && sdkRes.message ? sdkRes.message : 'Image generation failed.';
        showStatusBrief('error', errMsg);
      }
    } catch (e) {
      showStatusBrief('error', 'Error generating image. Please try again.');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Generate Image'; }
  }

  // ── Holonic Memory ────────────────────────────────────────────────────────────

  async function loadEarthHolon() {
    var container = getById('ai-memory-earth');
    if (!container || !window.aiClient) return;
    container.innerHTML = '<div class="ai-empty"><p>Loading Earth Holon…</p></div>';
    try {
      // SDK: @oasisomniverse/web6-api
      var sdkRes = await window.aiClient.holonicMemory.getEarthHolon();
      /* OLD fetch: GET /v1/holonic-memory/earth */
      if (sdkRes && !sdkRes.isError && sdkRes.result) {
        var h = sdkRes.result;
        var name = h.name || h.Name || 'Earth';
        var desc = h.description || h.Description || '';
        var level = h.level || h.Level || '';
        container.innerHTML =
          '<div class="ai-memory-holon-card">' +
            '<div class="ai-memory-holon-icon">🌍</div>' +
            '<div class="ai-memory-holon-info">' +
              '<div class="ai-memory-holon-name">' + escHtml(name) + '</div>' +
              (level ? '<div class="ai-memory-holon-level">Level: ' + escHtml(String(level)) + '</div>' : '') +
              (desc ? '<div class="ai-memory-holon-desc">' + escHtml(desc) + '</div>' : '') +
            '</div>' +
          '</div>';
      } else {
        container.innerHTML = '<div class="ai-empty"><p>Earth Holon unavailable.</p></div>';
      }
    } catch (e) {
      container.innerHTML = '<div class="ai-empty"><p>Could not load Earth Holon.</p></div>';
    }
  }

  async function recordMemory() {
    var input   = getById('ai-memory-input');
    var typeEl  = getById('ai-memory-type');
    var btn     = getById('ai-memory-record-btn');
    if (!input) return;
    var content = input.value.trim();
    if (!content) { showStatusBrief('warn', 'Please enter a memory or insight.'); return; }

    if (!window.aiClient) { showStatusBrief('error', 'AI client not initialised. Please refresh the page.'); return; }

    var profile = readAvatar();
    var avatarId = getAvatarId(profile);

    if (btn) { btn.disabled = true; btn.textContent = 'Recording…'; }

    try {
      var payload = { content: content };
      if (typeEl && typeEl.value)   payload.memoryType = typeEl.value;
      if (avatarId)                 payload.avatarId   = avatarId;

      // SDK: @oasisomniverse/web6-api — recordMemory requires holonId; use earth holon or omit
      var sdkRes = await window.aiClient.holonicMemory.recordMemory(payload);
      /* OLD fetch: POST /v1/holonic-memory/record */

      if (sdkRes && !sdkRes.isError) {
        showStatusBrief('success', 'Memory recorded in the Holonic layer!');
        input.value = '';
      } else {
        var errMsg = sdkRes && sdkRes.message ? sdkRes.message : 'Could not record memory.';
        showStatusBrief('error', errMsg);
      }
    } catch (e) {
      showStatusBrief('error', 'Error recording memory. Please try again.');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Record Memory'; }
  }

  // ── Orchestrator ──────────────────────────────────────────────────────────────

  async function loadAdapters() {
    var container = getById('ai-orch-adapters');
    if (!container || !window.aiClient) return;
    container.innerHTML = '<p>Loading…</p>';
    try {
      var sdkRes = await window.aiClient.orchestrator.getAdapters();
      var adapters = sdkRes && !sdkRes.isError && sdkRes.result;
      if (Array.isArray(adapters) && adapters.length) {
        container.innerHTML = adapters.map(function(a) {
          var name = a.name || a.Name || a.adapterId || a.id || String(a);
          var type = a.type || a.Type || a.adapterType || '';
          return '<div class="ai-adapter-row"><span class="ai-adapter-name">' + escHtml(name) + '</span>' +
            (type ? '<span class="ai-adapter-type">' + escHtml(type) + '</span>' : '') + '</div>';
        }).join('');
      } else {
        container.innerHTML = '<p class="ai-empty">No adapters registered.</p>';
      }
    } catch(e) { container.innerHTML = '<p class="ai-empty">Could not load adapters.</p>'; }
  }

  async function invokeAdapter() {
    var adapterEl = getById('ai-orch-adapter');
    var inputEl   = getById('ai-orch-input');
    var resultEl  = getById('ai-orch-result');
    var btn       = getById('ai-orch-invoke-btn');
    if (!adapterEl || !adapterEl.value.trim()) { showStatusBrief('warn', 'Enter an adapter name.'); return; }
    if (!window.aiClient) { showStatusBrief('error', 'AI client not ready.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Invoking…'; }
    if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
    try {
      var inputStr = inputEl ? inputEl.value.trim() : '';
      var inputPayload;
      try { inputPayload = JSON.parse(inputStr); } catch(e) { inputPayload = { input: inputStr }; }
      var payload = Object.assign({ adapter: adapterEl.value.trim() }, inputPayload);
      var sdkRes = await window.aiClient.orchestrator.invoke(payload);
      if (sdkRes && !sdkRes.isError) {
        var out = sdkRes.result;
        var text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
        resultEl.innerHTML = '<pre class="ai-result-pre">' + escHtml(text) + '</pre>';
        resultEl.hidden = false;
      } else {
        showStatusBrief('error', (sdkRes && sdkRes.message) || 'Invocation failed.');
      }
    } catch(e) { showStatusBrief('error', 'Error invoking adapter.'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Invoke Adapter'; }
  }

  // ── Reasoning Network ─────────────────────────────────────────────────────────

  async function loadAgents() {
    var container = getById('ai-rn-agents');
    var sel       = getById('ai-rn-agent-sel');
    if (!container || !window.aiClient) return;
    container.innerHTML = '<p>Loading…</p>';
    try {
      var sdkRes = await window.aiClient.reasoningNetwork.getAgents();
      var agents = sdkRes && !sdkRes.isError && sdkRes.result;
      if (Array.isArray(agents) && agents.length) {
        container.innerHTML = agents.map(function(a) {
          var name = a.name || a.Name || a.agentId || a.id || String(a);
          var role = a.role || a.Role || a.type || '';
          return '<div class="ai-adapter-row"><span class="ai-adapter-name">' + escHtml(name) + '</span>' +
            (role ? '<span class="ai-adapter-type">' + escHtml(role) + '</span>' : '') + '</div>';
        }).join('');
        if (sel) {
          var opts = agents.map(function(a) {
            var id   = a.id || a.agentId || a.name || String(a);
            var name = a.name || a.Name || id;
            return '<option value="' + escHtml(String(id)) + '">' + escHtml(String(name)) + '</option>';
          });
          sel.innerHTML = '<option value="">Any available agent</option>' + opts.join('');
        }
      } else {
        container.innerHTML = '<p class="ai-empty">No agents registered.</p>';
      }
    } catch(e) { container.innerHTML = '<p class="ai-empty">Could not load agents.</p>'; }
  }

  async function dispatchTask() {
    var taskEl   = getById('ai-rn-task');
    var agentSel = getById('ai-rn-agent-sel');
    var resultEl = getById('ai-rn-result');
    var btn      = getById('ai-rn-dispatch-btn');
    if (!taskEl || !taskEl.value.trim()) { showStatusBrief('warn', 'Enter a task to dispatch.'); return; }
    if (!window.aiClient) { showStatusBrief('error', 'AI client not ready.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Dispatching…'; }
    if (resultEl) { resultEl.hidden = true; }
    try {
      var payload = { task: taskEl.value.trim() };
      if (agentSel && agentSel.value) payload.agentId = agentSel.value;
      var sdkRes = await window.aiClient.reasoningNetwork.dispatch(payload);
      if (sdkRes && !sdkRes.isError) {
        var out  = sdkRes.result;
        var text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
        resultEl.innerHTML = '<pre class="ai-result-pre">' + escHtml(text) + '</pre>';
        resultEl.hidden = false;
      } else {
        showStatusBrief('error', (sdkRes && sdkRes.message) || 'Dispatch failed.');
      }
    } catch(e) { showStatusBrief('error', 'Error dispatching task.'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Dispatch Task'; }
  }

  // ── Holonic Braid ─────────────────────────────────────────────────────────────

  async function loadBraidGraph() {
    var taskTypeEl = getById('ai-braid-task-type');
    var graphEl    = getById('ai-braid-graph');
    var statusEl   = getById('ai-braid-status');
    if (!taskTypeEl || !taskTypeEl.value.trim()) { showStatusBrief('warn', 'Enter a task type.'); return; }
    if (!window.aiClient) { showStatusBrief('error', 'AI client not ready.'); return; }
    if (statusEl) { statusEl.textContent = 'Loading graph…'; statusEl.hidden = false; }
    try {
      var sdkRes = await window.aiClient.holonicBraid.getGraph({ taskType: taskTypeEl.value.trim() });
      if (sdkRes && !sdkRes.isError && sdkRes.result) {
        if (graphEl) graphEl.value = JSON.stringify(sdkRes.result, null, 2);
        if (statusEl) { statusEl.textContent = 'Graph loaded.'; setTimeout(function(){ statusEl.hidden = true; }, 2000); }
      } else {
        if (statusEl) { statusEl.textContent = 'No graph found for this task type.'; setTimeout(function(){ statusEl.hidden = true; }, 3000); }
      }
    } catch(e) {
      if (statusEl) { statusEl.textContent = 'Error loading graph.'; setTimeout(function(){ statusEl.hidden = true; }, 3000); }
    }
  }

  async function saveBraidGraph() {
    var taskTypeEl = getById('ai-braid-task-type');
    var graphEl    = getById('ai-braid-graph');
    var statusEl   = getById('ai-braid-status');
    var btn        = getById('ai-braid-save-btn');
    if (!taskTypeEl || !taskTypeEl.value.trim()) { showStatusBrief('warn', 'Enter a task type.'); return; }
    if (!graphEl || !graphEl.value.trim()) { showStatusBrief('warn', 'Enter graph JSON.'); return; }
    if (!window.aiClient) { showStatusBrief('error', 'AI client not ready.'); return; }
    var graphData;
    try { graphData = JSON.parse(graphEl.value); } catch(e) { showStatusBrief('error', 'Invalid JSON in graph field.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      var sdkRes = await window.aiClient.holonicBraid.saveGraph(Object.assign({ taskType: taskTypeEl.value.trim() }, graphData));
      if (sdkRes && !sdkRes.isError) {
        if (statusEl) { statusEl.textContent = 'Graph saved.'; statusEl.hidden = false; setTimeout(function(){ statusEl.hidden = true; }, 2000); }
      } else {
        showStatusBrief('error', (sdkRes && sdkRes.message) || 'Could not save graph.');
      }
    } catch(e) { showStatusBrief('error', 'Error saving graph.'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Save Graph'; }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  function switchTab(tab) {
    var block = getById('ai-modal-block');
    if (!block) return;
    block.querySelectorAll('.ai-tab').forEach(function (t) {
      var active = t.dataset.tab === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    block.querySelectorAll('.ai-tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'ai-tab-' + tab;
    });
    if (tab === 'memory')       loadEarthHolon();
    if (tab === 'orchestrator') loadAdapters();
    if (tab === 'reasoning')    loadAgents();
  }

  // ── Open / close ──────────────────────────────────────────────────────────────

  function openAiModal() {
    var modal  = document.querySelector('.js-modal');
    var blocks = document.querySelectorAll('.js-modal-block');
    var block  = getById('ai-modal-block');
    if (!modal || !block) return false;

    blocks.forEach(function (b) { b.classList.remove('is-selected'); });
    modal.classList.add('is-visible');
    block.classList.add('is-selected');

    switchTab('chat');
    loadModels();
    return false;
  }

  function closeAiModal() {
    var modal = document.querySelector('.js-modal');
    var block = getById('ai-modal-block');
    if (modal) modal.classList.remove('is-visible');
    if (block) block.classList.remove('is-selected');
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    var block = getById('ai-modal-block');
    if (!block || block.dataset.aiBound === 'true') {
      window.openAiModal  = openAiModal;
      window.closeAiModal = closeAiModal;
      return;
    }

    var closeBtn = getById('ai-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeAiModal(); });

    var tabBar = block.querySelector('.ai-tabs');
    if (tabBar) {
      tabBar.addEventListener('click', function (e) {
        var tab = e.target.closest('.ai-tab');
        if (tab) switchTab(tab.dataset.tab);
      });
    }

    var sendBtn = getById('ai-chat-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', sendChat);

    var chatInput = getById('ai-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
      });
    }

    var genBtn = getById('ai-img-generate-btn');
    if (genBtn) genBtn.addEventListener('click', generateImage);

    var memBtn = getById('ai-memory-record-btn');
    if (memBtn) memBtn.addEventListener('click', recordMemory);

    var orchInvokeBtn = getById('ai-orch-invoke-btn');
    if (orchInvokeBtn) orchInvokeBtn.addEventListener('click', invokeAdapter);

    var rnDispatchBtn = getById('ai-rn-dispatch-btn');
    if (rnDispatchBtn) rnDispatchBtn.addEventListener('click', dispatchTask);

    var braidLoadBtn = getById('ai-braid-load-btn');
    if (braidLoadBtn) braidLoadBtn.addEventListener('click', loadBraidGraph);

    var braidSaveBtn = getById('ai-braid-save-btn');
    if (braidSaveBtn) braidSaveBtn.addEventListener('click', saveBraidGraph);

    block.dataset.aiBound = 'true';
    window.openAiModal  = openAiModal;
    window.closeAiModal = closeAiModal;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  window.addEventListener('portal-components-ready', bind);
})();
