// Acquire VS Code API bridge
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : {
  postMessage: (msg) => console.log('postMessage:', msg),
  setState: () => {},
  getState: () => ({})
};

let appState = {
  schema: { restEndpoints: [], graphqlEndpoints: [], globalScenario: 'normal' },
  config: { port: 4000, latency: { enabled: false, min: 100, max: 500 }, redactHeaders: [] },
  isRunning: false,
  isRecording: false,
  capturedCount: 0,
  capturedRequests: [],
  serverHistory: [],
  framework: { framework: 'vite', name: 'Vite / React' },
  port: 4000
};

let selectedRequestId = null;
let selectedRestEndpointId = null;
let selectedGqlEndpointId = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupSubTabs();
  setupActionButtons();
  setupScenarioButtons();
  setupSearchInputs();
  setupSettingsHandlers();

  // Request initial state from extension
  vscode.postMessage({ type: 'GET_INITIAL_STATE' });
});

// Handle incoming messages from extension host
window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message) return;

  switch (message.type) {
    case 'SYNC_STATE':
      appState = { ...appState, ...message.state };
      renderAll();
      break;

    case 'SELECT_ENDPOINT':
      if (message.endpointId) {
        if (message.endpointId.startsWith('rest_')) {
          switchTab('rest');
          selectRestEndpoint(message.endpointId);
        } else if (message.endpointId.startsWith('gql_')) {
          switchTab('graphql');
          selectGqlEndpoint(message.endpointId);
        }
      }
      break;
  }
});

function renderAll() {
  renderHeaderAndStatus();
  renderOverviewMetrics();
  renderTrafficList();
  renderRestEndpoints();
  renderGqlOperations();
  renderScenariosTab();
  renderSettings();
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === `tab-${tabId}`));
}

function setupTabs() {
  document.querySelectorAll('.tab-nav .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

function setupSubTabs() {
  document.querySelectorAll('.sub-tabs .sub-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.inspector-pane');
      if (!parent) return;
      parent.querySelectorAll('.sub-tab-btn').forEach((b) => b.classList.remove('active'));
      parent.querySelectorAll('.subtab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = `subtab-${btn.dataset.subtab}`;
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

function setupActionButtons() {
  const btnToggleServer = document.getElementById('btnToggleServer');
  btnToggleServer.addEventListener('click', () => {
    if (appState.isRunning) {
      vscode.postMessage({ type: 'ACTION', payload: { action: 'stopServer' } });
    } else {
      vscode.postMessage({ type: 'ACTION', payload: { action: 'startServer' } });
    }
  });

  const btnImportHar = document.getElementById('btnImportHar');
  btnImportHar.addEventListener('click', () => {
    vscode.postMessage({ type: 'ACTION', payload: { action: 'importHar' } });
  });

  const btnToggleRecord = document.getElementById('btnToggleRecord');
  btnToggleRecord.addEventListener('click', () => {
    if (appState.isRecording) {
      vscode.postMessage({ type: 'ACTION', payload: { action: 'stopRecording' } });
    } else {
      vscode.postMessage({ type: 'ACTION', payload: { action: 'startRecording' } });
    }
  });

  const btnCopyEnv = document.getElementById('btnCopyEnv');
  btnCopyEnv.addEventListener('click', () => {
    const code = document.getElementById('frontendEnvSnippet').innerText;
    navigator.clipboard?.writeText(code);
    btnCopyEnv.innerText = 'Copied!';
    setTimeout(() => { btnCopyEnv.innerText = 'Copy'; }, 1500);
  });

  const btnClearTraffic = document.getElementById('btnClearTraffic');
  btnClearTraffic.addEventListener('click', () => {
    vscode.postMessage({ type: 'CLEAR_HISTORY' });
  });
}

function setupScenarioButtons() {
  document.querySelectorAll('.scenario-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scenario = btn.dataset.scenario;
      vscode.postMessage({ type: 'UPDATE_SCENARIO', payload: { scenario } });
    });
  });

  document.querySelectorAll('input[name="globalScenRadio"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const scenario = e.target.value;
      vscode.postMessage({ type: 'UPDATE_SCENARIO', payload: { scenario } });
    });
  });

  document.querySelectorAll('.scenario-card').forEach((card) => {
    card.addEventListener('click', () => {
      const scen = card.dataset.scen;
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        vscode.postMessage({ type: 'UPDATE_SCENARIO', payload: { scenario: scen } });
      }
    });
  });
}

function setupSearchInputs() {
  document.getElementById('trafficSearchInput')?.addEventListener('input', () => renderTrafficList());
  document.getElementById('restSearchInput')?.addEventListener('input', () => renderRestEndpoints());
  document.getElementById('gqlSearchInput')?.addEventListener('input', () => renderGqlOperations());
}

function setupSettingsHandlers() {
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  btnSaveConfig?.addEventListener('click', () => {
    const port = parseInt(document.getElementById('inputServerPort').value, 10) || 4000;
    const latencyEnabled = document.getElementById('checkEnableLatency').checked;
    const latencyMin = parseInt(document.getElementById('inputLatencyMin').value, 10) || 100;
    const latencyMax = parseInt(document.getElementById('inputLatencyMax').value, 10) || 500;

    vscode.postMessage({
      type: 'UPDATE_CONFIG',
      payload: {
        config: {
          port,
          latency: {
            enabled: latencyEnabled,
            min: latencyMin,
            max: latencyMax
          }
        }
      }
    });
  });

  document.getElementById('checkEnableLatency')?.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    vscode.postMessage({
      type: 'UPDATE_CONFIG',
      payload: {
        config: {
          latency: {
            ...appState.config.latency,
            enabled
          }
        }
      }
    });
  });
}

function renderHeaderAndStatus() {
  // Server Status
  const serverBadge = document.getElementById('serverStatusBadge');
  const btnToggleServer = document.getElementById('btnToggleServer');
  const btnToggleServerText = document.getElementById('btnToggleServerText');

  if (appState.isRunning) {
    serverBadge.innerHTML = `<span class="dot running"></span><span class="status-text">Server: :${appState.port} Running</span>`;
    btnToggleServer.className = 'btn btn-primary btn-stop';
    btnToggleServerText.innerText = 'Stop Server';
  } else {
    serverBadge.innerHTML = `<span class="dot stopped"></span><span class="status-text">Server: Stopped</span>`;
    btnToggleServer.className = 'btn btn-primary';
    btnToggleServerText.innerText = 'Start Server';
  }

  // Recording Status
  const recordingBadge = document.getElementById('recordingStatusBadge');
  const btnToggleRecord = document.getElementById('btnToggleRecord');
  const btnToggleRecordText = document.getElementById('btnToggleRecordText');

  if (appState.isRecording) {
    recordingBadge.innerHTML = `<span class="dot recording"></span><span class="status-text">Recorder: Active</span>`;
    btnToggleRecord.className = 'btn btn-secondary recording-active';
    btnToggleRecordText.innerText = 'Stop Recording';
  } else {
    recordingBadge.innerHTML = `<span class="dot idle"></span><span class="status-text">Recorder: Inactive</span>`;
    btnToggleRecord.className = 'btn btn-secondary';
    btnToggleRecordText.innerText = 'Record Browser';
  }

  // Scenario Badge
  const currentScenario = appState.config.globalScenario || 'normal';
  document.getElementById('badgeScenarioName').innerText = currentScenario.toUpperCase();

  // Navigation badge counts
  document.getElementById('navCapturedCount').innerText = appState.capturedCount;
  document.getElementById('navRestCount').innerText = appState.schema.restEndpoints.length;
  document.getElementById('navGqlCount').innerText = appState.schema.graphqlEndpoints.length;
}

function renderOverviewMetrics() {
  document.getElementById('metricCaptured').innerText = appState.capturedCount;
  document.getElementById('metricRest').innerText = appState.schema.restEndpoints.length;
  document.getElementById('metricGql').innerText = appState.schema.graphqlEndpoints.length;
  document.getElementById('metricPort').innerText = `:${appState.port}`;

  // Update scenario buttons active state
  const currentScenario = appState.config.globalScenario || 'normal';
  document.querySelectorAll('.scenario-select-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.scenario === currentScenario);
  });

  // Framework tag
  if (appState.framework?.name) {
    document.getElementById('detectedFrameworkTag').innerText = appState.framework.name;
  }
}

function renderTrafficList() {
  const tbody = document.getElementById('trafficTableBody');
  const filter = (document.getElementById('trafficSearchInput')?.value || '').toLowerCase();

  // Combine captured requests and live server history
  const allEvents = [...appState.capturedRequests];

  const filtered = allEvents.filter((item) => {
    if (!filter) return true;
    return (item.url && item.url.toLowerCase().includes(filter)) ||
           (item.path && item.path.toLowerCase().includes(filter)) ||
           (item.method && item.method.toLowerCase().includes(filter));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No requests found matching filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((req) => {
    const isSelected = req.id === selectedRequestId;
    const methodClass = `method-${(req.method || 'GET').toLowerCase()}`;
    const status = req.response?.status || req.status || 200;
    const statusClass = status >= 400 ? 'status-err' : '';
    const duration = req.timing?.duration || req.durationMs || 50;

    return `
      <tr class="${isSelected ? 'active' : ''}" onclick="selectTrafficRequest('${req.id}')">
        <td><span class="method-badge ${methodClass}">${req.method}</span></td>
        <td style="font-family: var(--font-mono); font-size: 11px;">${req.path || req.url}</td>
        <td><span class="insp-status-badge ${statusClass}">${status}</span></td>
        <td style="color: var(--text-muted); font-size: 11px;">${duration}ms</td>
      </tr>
    `;
  }).join('');
}

window.selectTrafficRequest = function(reqId) {
  selectedRequestId = reqId;
  renderTrafficList();

  const req = appState.capturedRequests.find((r) => r.id === reqId);
  if (!req) return;

  document.getElementById('inspectorEmptyState').style.display = 'none';
  document.getElementById('inspectorContent').style.display = 'flex';

  document.getElementById('inspMethod').className = `method-badge method-${req.method.toLowerCase()}`;
  document.getElementById('inspMethod').innerText = req.method;
  document.getElementById('inspPath').innerText = req.path || req.url;

  const status = req.response?.status || 200;
  const statusEl = document.getElementById('inspStatus');
  statusEl.className = `insp-status-badge ${status >= 400 ? 'status-err' : ''}`;
  statusEl.innerText = `${status} ${req.response?.statusText || ''}`;

  // Headers
  const reqHeadersEl = document.getElementById('inspReqHeaders');
  reqHeadersEl.innerHTML = Object.entries(req.headers || {}).map(([k, v]) => `
    <div class="kv-item"><span class="kv-key">${k}:</span><span class="kv-val">${v}</span></div>
  `).join('') || '<div class="kv-item"><span class="kv-val">No request headers</span></div>';

  const resHeadersEl = document.getElementById('inspResHeaders');
  resHeadersEl.innerHTML = Object.entries(req.response?.headers || {}).map(([k, v]) => `
    <div class="kv-item"><span class="kv-key">${k}:</span><span class="kv-val">${v}</span></div>
  `).join('') || '<div class="kv-item"><span class="kv-val">No response headers</span></div>';

  // Query Params
  const queryEl = document.getElementById('inspQueryParams');
  queryEl.innerHTML = Object.entries(req.query || {}).map(([k, v]) => `
    <div class="kv-item"><span class="kv-key">${k}:</span><span class="kv-val">${Array.isArray(v) ? v.join(', ') : v}</span></div>
  `).join('') || '<div class="kv-item"><span class="kv-val">No query parameters</span></div>';

  // Request Body
  document.getElementById('inspReqBodyCode').innerText = req.body
    ? (typeof req.body === 'object' ? JSON.stringify(req.body, null, 2) : String(req.body))
    : 'null';

  // Response Body
  document.getElementById('inspResBodyCode').innerText = req.response?.body !== undefined
    ? (typeof req.response.body === 'object' ? JSON.stringify(req.response.body, null, 2) : String(req.response.body))
    : 'null';

  // Timing
  const timingEl = document.getElementById('inspTimingBreakdown');
  const t = req.timing || { duration: 50 };
  timingEl.innerHTML = `
    <div class="key-value-list">
      <div class="kv-item"><span class="kv-key">Total Duration:</span><span class="kv-val">${t.duration}ms</span></div>
      ${t.dns ? `<div class="kv-item"><span class="kv-key">DNS Lookup:</span><span class="kv-val">${t.dns}ms</span></div>` : ''}
      ${t.connect ? `<div class="kv-item"><span class="kv-key">TCP Connect:</span><span class="kv-val">${t.connect}ms</span></div>` : ''}
      ${t.wait ? `<div class="kv-item"><span class="kv-key">Server Wait (TTFB):</span><span class="kv-val">${t.wait}ms</span></div>` : ''}
      ${t.receive ? `<div class="kv-item"><span class="kv-key">Content Download:</span><span class="kv-val">${t.receive}ms</span></div>` : ''}
    </div>
  `;
};

function renderRestEndpoints() {
  const container = document.getElementById('restEndpointsList');
  const filter = (document.getElementById('restSearchInput')?.value || '').toLowerCase();

  const filtered = appState.schema.restEndpoints.filter((ep) => {
    if (!filter) return true;
    return ep.pathPattern.toLowerCase().includes(filter) || ep.method.toLowerCase().includes(filter);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No REST endpoints found matching search.</div>';
    return;
  }

  container.innerHTML = filtered.map((ep) => {
    const isSelected = ep.id === selectedRestEndpointId;
    const methodClass = `method-${ep.method.toLowerCase()}`;
    return `
      <div class="endpoint-card-item ${isSelected ? 'active' : ''}" onclick="selectRestEndpoint('${ep.id}')">
        <div class="endpoint-card-left">
          <span class="method-badge ${methodClass}">${ep.method}</span>
          <span class="endpoint-pattern">${ep.pathPattern}</span>
        </div>
        <span class="endpoint-count-badge">${ep.requestCount} calls</span>
      </div>
    `;
  }).join('');
}

window.selectRestEndpoint = function(endpointId) {
  selectedRestEndpointId = endpointId;
  renderRestEndpoints();

  const ep = appState.schema.restEndpoints.find((e) => e.id === endpointId);
  if (!ep) return;

  document.getElementById('restEditorEmptyState').style.display = 'none';
  document.getElementById('restEditorContent').style.display = 'block';

  const methodEl = document.getElementById('editRestMethod');
  methodEl.className = `method-badge method-${ep.method.toLowerCase()}`;
  methodEl.innerText = ep.method;
  document.getElementById('editRestPath').value = ep.pathPattern;

  // Parameters
  const paramsBox = document.getElementById('editRestParamsBox');
  const tagsEl = document.getElementById('editRestParamTags');
  if (ep.parameters && ep.parameters.length > 0) {
    paramsBox.style.display = 'block';
    tagsEl.innerHTML = ep.parameters.map((p) => `
      <span class="param-tag">:${p.name} <small>(${p.inferredType})</small></span>
    `).join('');
  } else {
    paramsBox.style.display = 'none';
  }

  // Pagination
  const pagBox = document.getElementById('editRestPaginationBox');
  const pagDetails = document.getElementById('editRestPaginationDetails');
  if (ep.pagination?.enabled) {
    pagBox.style.display = 'block';
    pagDetails.innerHTML = `
      <div class="key-value-list">
        <div class="kv-item"><span class="kv-key">Page Param:</span><span class="kv-val">${ep.pagination.pageParam || 'page'}</span></div>
        <div class="kv-item"><span class="kv-key">Limit Param:</span><span class="kv-val">${ep.pagination.limitParam || ep.pagination.pageSizeParam || 'limit'}</span></div>
        <div class="kv-item"><span class="kv-key">Items Property:</span><span class="kv-val">${ep.pagination.itemsPath ? `obj.${ep.pagination.itemsPath}` : 'Root Array'}</span></div>
      </div>
    `;
  } else {
    pagBox.style.display = 'none';
  }

  // Scenario override
  const scenSelect = document.getElementById('editRestScenarioSelect');
  scenSelect.value = ep.scenarioRule?.activeScenario || 'default';

  const errRate = document.getElementById('editRestErrorRate');
  const errRateVal = document.getElementById('editRestErrorRateVal');
  const pVal = Math.round((ep.scenarioRule?.errorProbability || 0) * 100);
  errRate.value = pVal;
  errRateVal.innerText = `${pVal}%`;

  errRate.oninput = (e) => {
    errRateVal.innerText = `${e.target.value}%`;
  };

  // Response Payload Textarea
  const body = ep.defaultResponse?.body;
  document.getElementById('editRestBodyText').value = body !== undefined
    ? (typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body))
    : '{}';

  // Save handler
  document.getElementById('btnSaveRestEndpoint').onclick = () => {
    try {
      const parsedBody = JSON.parse(document.getElementById('editRestBodyText').value);
      const selectedScen = scenSelect.value;
      const errorProb = parseInt(errRate.value, 10) / 100;

      const updatedEp = {
        ...ep,
        defaultResponse: {
          ...ep.defaultResponse,
          body: parsedBody
        },
        scenarioRule: selectedScen !== 'default' || errorProb > 0 ? {
          activeScenario: selectedScen !== 'default' ? selectedScen : 'normal',
          errorProbability: errorProb
        } : undefined
      };

      vscode.postMessage({
        type: 'UPDATE_REST_ENDPOINT',
        payload: { endpoint: updatedEp }
      });
      alert('Endpoint mock response updated!');
    } catch (err) {
      alert('Invalid JSON in mock response body: ' + err.message);
    }
  };
};

function renderGqlOperations() {
  const container = document.getElementById('gqlOperationsList');
  const filter = (document.getElementById('gqlSearchInput')?.value || '').toLowerCase();

  const filtered = appState.schema.graphqlEndpoints.filter((g) => {
    if (!filter) return true;
    return g.operationName.toLowerCase().includes(filter) || g.operationType.toLowerCase().includes(filter);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No GraphQL operations found matching search.</div>';
    return;
  }

  container.innerHTML = filtered.map((g) => {
    const isSelected = g.id === selectedGqlEndpointId;
    return `
      <div class="endpoint-card-item ${isSelected ? 'active' : ''}" onclick="selectGqlEndpoint('${g.id}')">
        <div class="endpoint-card-left">
          <span class="method-badge method-gql">${g.operationType.toUpperCase()}</span>
          <span class="endpoint-pattern">${g.operationName}</span>
        </div>
        <span class="endpoint-count-badge">${g.requestCount} calls</span>
      </div>
    `;
  }).join('');
}

window.selectGqlEndpoint = function(gId) {
  selectedGqlEndpointId = gId;
  renderGqlOperations();

  const g = appState.schema.graphqlEndpoints.find((item) => item.id === gId);
  if (!g) return;

  document.getElementById('gqlEditorEmptyState').style.display = 'none';
  document.getElementById('gqlEditorContent').style.display = 'block';

  document.getElementById('editGqlType').innerText = g.operationType.toUpperCase();
  document.getElementById('editGqlOpName').innerText = g.operationName;
  document.getElementById('editGqlQueryText').innerText = g.queryText || `${g.operationType} ${g.operationName} { ... }`;

  const body = g.defaultResponse?.body || { data: {} };
  document.getElementById('editGqlBodyText').value = JSON.stringify(body, null, 2);

  document.getElementById('btnSaveGqlEndpoint').onclick = () => {
    try {
      const parsedBody = JSON.parse(document.getElementById('editGqlBodyText').value);
      const updatedGql = {
        ...g,
        defaultResponse: {
          ...g.defaultResponse,
          body: parsedBody
        }
      };

      vscode.postMessage({
        type: 'UPDATE_GRAPHQL_ENDPOINT',
        payload: { endpoint: updatedGql }
      });
      alert('GraphQL mock response updated!');
    } catch (err) {
      alert('Invalid JSON in GraphQL response body: ' + err.message);
    }
  };
};

function renderScenariosTab() {
  const currentScenario = appState.config.globalScenario || 'normal';
  document.querySelectorAll('input[name="globalScenRadio"]').forEach((r) => {
    r.checked = r.value === currentScenario;
  });
  document.querySelectorAll('.scenario-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.scen === currentScenario);
  });

  const checkLatency = document.getElementById('checkEnableLatency');
  if (checkLatency) {
    checkLatency.checked = Boolean(appState.config.latency?.enabled);
  }
  const minEl = document.getElementById('inputLatencyMin');
  if (minEl) minEl.value = appState.config.latency?.min ?? 100;
  const maxEl = document.getElementById('inputLatencyMax');
  if (maxEl) maxEl.value = appState.config.latency?.max ?? 500;
}

function renderSettings() {
  const portEl = document.getElementById('inputServerPort');
  if (portEl) portEl.value = appState.config.port || 4000;

  const redactionContainer = document.getElementById('redactionTags');
  if (redactionContainer) {
    const list = appState.config.redactHeaders || ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
    redactionContainer.innerHTML = list.map((h) => `<span class="tag-badge">${h}</span>`).join('');
  }
}
