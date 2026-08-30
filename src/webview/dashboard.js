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
  framework: { framework: 'vanilla', name: 'Frontend Project' },
  port: 4000,
  sessions: [],
  isGhostMode: false,
  activeGhostSession: null
};

let selectedEndpointId = null;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupActionButtons();
  setupSearchInput();
  setupSettingsHandlers();
  
  // Request initial state
  vscode.postMessage({ type: 'GET_INITIAL_STATE' });
});

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
        switchTab('endpoints');
        selectEndpoint(message.endpointId);
      }
      break;
  }
});

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const paneId = `subtab-${btn.dataset.subtab}`;
      const pane = document.getElementById(paneId);
      if (pane) pane.classList.add('active');
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
}

function setupActionButtons() {
  document.getElementById('btnToggleServer')?.addEventListener('click', () => {
    vscode.postMessage({
      type: 'ACTION',
      payload: { action: appState.isRunning ? 'stopServer' : 'startServer' }
    });
  });

  document.getElementById('btnImportHar')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'ACTION', payload: { action: 'importHar' } });
  });

  document.getElementById('btnToggleRecord')?.addEventListener('click', () => {
    if (appState.isRecording) {
      vscode.postMessage({ type: 'ACTION', payload: { action: 'stopRecording' } });
    } else {
      vscode.postMessage({ type: 'ACTION', payload: { action: 'startRecording' } });
    }
  });

  document.getElementById('btnCreateGhostSession')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'START_GHOST_SESSION' });
  });

  document.getElementById('btnInitOverview')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'ACTION', payload: { action: 'initProject' } });
  });

  document.getElementById('btnClearHistory')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'CLEAR_HISTORY' });
  });

  // Code Gen Actions
  document.getElementById('btnGenTypes')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({ type: 'GENERATE_TYPES', payload: { endpointId: selectedEndpointId } });
    }
  });

  document.getElementById('btnGenClient')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({ type: 'GENERATE_CLIENT', payload: { endpointId: selectedEndpointId } });
    }
  });

  document.getElementById('btnGenTest')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({ type: 'GENERATE_TEST', payload: { endpointId: selectedEndpointId } });
    }
  });

  document.getElementById('btnInsertPlaceholder')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({ type: 'INSERT_API_PLACEHOLDER', payload: { endpointId: selectedEndpointId } });
    }
  });

  document.getElementById('btnGenerateIntegration')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({ type: 'GENERATE_INTEGRATION', payload: { endpointId: selectedEndpointId } });
    }
  });

  document.getElementById('btnGenResilienceTest')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({ type: 'GENERATE_RESILIENCE_TEST', payload: { endpointId: selectedEndpointId } });
    }
  });

  document.getElementById('btnReplayEndpoint')?.addEventListener('click', () => {
    if (selectedEndpointId) {
      vscode.postMessage({
        type: 'ACTION',
        payload: { action: 'replayEndpoint', data: { endpointId: selectedEndpointId } }
      });
    }
  });

  document.getElementById('btnApplyResilience')?.addEventListener('click', () => {
    if (!selectedEndpointId) return;
    
    const statusCode = parseInt(document.getElementById('inspInjectStatus').value, 10);
    const latency = parseInt(document.getElementById('inspInjectLatency').value, 10) || 0;

    // Find the endpoint
    const schema = appState.schema;
    const epIndex = schema.restEndpoints.findIndex(e => e.id === selectedEndpointId);
    if (epIndex >= 0) {
      const endpoint = schema.restEndpoints[epIndex];
      endpoint.scenarioRule = {
        activeScenario: statusCode === 200 ? 'normal' : 'server-error',
        customStatusCode: statusCode,
        customLatencyMs: latency
      };
      
      vscode.postMessage({
        type: 'UPDATE_REST_ENDPOINT',
        payload: { endpoint }
      });
    }
  });
}

function setupSearchInput() {
  document.getElementById('endpointSearch')?.addEventListener('input', (e) => {
    renderRestEndpoints(e.target.value.toLowerCase());
  });
}

function setupSettingsHandlers() {
  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    const port = parseInt(document.getElementById('settingPort').value, 10) || 4000;
    const scenario = document.getElementById('settingGlobalScenario').value;
    const latency = document.getElementById('settingLatencyEnabled').checked;

    vscode.postMessage({
      type: 'UPDATE_CONFIG',
      payload: {
        config: {
          port,
          globalScenario: scenario,
          latency: {
            enabled: latency,
            min: 100,
            max: 500
          }
        }
      }
    });
  });
}

function renderAll() {
  renderStatusPills();
  renderOverviewTab();
  renderRestEndpoints();
  renderSessionsTab();
  renderHistoryTab();
  renderSettingsTab();
}

function renderStatusPills() {
  // Mode dot
  const modeDot = document.getElementById('modeDot');
  const modeText = document.getElementById('modeText');
  if (appState.isGhostMode) {
    modeDot.className = 'dot live';
    modeText.innerText = `Ghost Mode: ${appState.activeGhostSession?.name || 'Active'}`;
  } else {
    modeDot.className = 'dot';
    modeText.innerText = 'Real Backend Mode';
  }

  // Server dot
  const serverDot = document.getElementById('serverDot');
  const serverText = document.getElementById('serverText');
  const btnToggleServer = document.getElementById('btnToggleServer');
  if (appState.isRunning) {
    serverDot.className = 'dot live';
    serverText.innerText = `Server: Running (: ${appState.port})`;
    btnToggleServer.innerText = 'Stop Server';
  } else {
    serverDot.className = 'dot stopped';
    serverText.innerText = 'Server: Offline';
    btnToggleServer.innerText = 'Start Server';
  }

  // Recording dot
  const recordingDot = document.getElementById('recordingDot');
  const recordingText = document.getElementById('recordingText');
  const btnToggleRecord = document.getElementById('btnToggleRecord');
  if (appState.isRecording) {
    recordingDot.className = 'dot live';
    recordingText.innerText = 'Recording: Capturing';
    btnToggleRecord.innerText = 'Stop Recording';
  } else {
    recordingDot.className = 'dot';
    recordingText.innerText = 'Recording: Inactive';
    btnToggleRecord.innerText = 'Record Session';
  }
}

function renderOverviewTab() {
  document.getElementById('metricRestCount').innerText = appState.schema.restEndpoints.length;
  document.getElementById('metricGqlCount').innerText = appState.schema.graphqlEndpoints.length;
  document.getElementById('metricSessionsCount').innerText = appState.sessions.length;
  document.getElementById('metricPort').innerText = `:${appState.port}`;

  const statusText = document.getElementById('schemaStatusText');
  if (statusText) {
    if (appState.schema.restEndpoints.length > 0 || appState.schema.graphqlEndpoints.length > 0) {
      statusText.innerText = `Mapped ${appState.schema.restEndpoints.length} REST endpoints and ${appState.schema.graphqlEndpoints.length} GraphQL operations. Mock backend is ready.`;
    } else {
      statusText.innerText = 'No API routes mapped yet. Import a HAR capture or record some traffic.';
    }
  }

  // Render coverage details
  const cov = appState.coverage || { percent: 0, integrated: 0, total: 0 };
  const percentElem = document.getElementById('covPercent');
  const integratedElem = document.getElementById('covIntegrated');
  const totalElem = document.getElementById('covTotal');
  const barElem = document.getElementById('covBar');

  if (percentElem) percentElem.innerText = `${cov.percent}%`;
  if (integratedElem) integratedElem.innerText = cov.integrated;
  if (totalElem) totalElem.innerText = cov.total;
  if (barElem) barElem.style.width = `${cov.percent}%`;

  // Render sensitive data alert warning
  const alertElem = document.getElementById('sensitiveDataAlert');
  if (alertElem) {
    alertElem.style.display = appState.sensitiveDataWarning ? 'block' : 'none';
  }

  // Render Integration gaps listing in Overview
  const gapsDiv = document.getElementById('overviewIntegrationGaps');
  if (gapsDiv) {
    gapsDiv.innerHTML = '';
    const unintegrated = appState.schema.restEndpoints.filter(ep => {
      const scan = appState.scanResults.find(r => r.endpointId === ep.id);
      return !scan || scan.usages.length === 0;
    });

    if (unintegrated.length === 0) {
      gapsDiv.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No integration gaps detected. All API endpoints mapped successfully.</p>';
    } else {
      unintegrated.forEach(ep => {
        const item = document.createElement('div');
        item.style.marginBottom = '12px';
        item.style.padding = '8px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '4px';
        
        const advice = appState.integrationAdvice[ep.id] || [];
        let adviceText = '';
        if (advice.length > 0) {
          const fileName = advice[0].filePath.split(/[\\/]/).pop();
          adviceText = `Suggested Integration: <code>${fileName}</code> (${advice[0].reason})`;
        } else {
          adviceText = 'No location suggested (low confidence)';
        }

        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <strong><span class="badge badge-${ep.method.toLowerCase()}">${ep.method}</span> <code>${ep.pathPattern}</code></strong>
            <span style="font-size:10px; padding:2px 6px; border-radius:3px; background-color:rgba(210, 153, 34, 0.1); color:var(--warning);">Integration Gap</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            ${adviceText}
          </div>
        `;
        gapsDiv.appendChild(item);
      });
    }
  }
}

function renderRestEndpoints(filter = '') {
  const tbody = document.getElementById('endpointsTableBody');
  const empty = document.getElementById('endpointsEmptyState');
  if (!tbody) return;

  const endpoints = appState.schema.restEndpoints;
  const filtered = endpoints.filter(ep => 
    ep.pathPattern.toLowerCase().includes(filter) || 
    ep.method.toLowerCase().includes(filter)
  );

  tbody.innerHTML = '';
  
  if (filtered.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  
  empty.style.display = 'none';

  filtered.forEach(ep => {
    const tr = document.createElement('tr');
    if (ep.id === selectedEndpointId) tr.className = 'selected';
    
    const methodLower = ep.method.toLowerCase();
    tr.innerHTML = `
      <td><span class="badge badge-${methodLower}">${ep.method}</span></td>
      <td style="font-family: var(--font-mono);">${ep.pathPattern}</td>
      <td>${ep.requestCount}</td>
    `;
    
    tr.addEventListener('click', () => {
      selectEndpoint(ep.id);
    });
    
    tbody.appendChild(tr);
  });
}

function selectEndpoint(id) {
  selectedEndpointId = id;
  
  // Highlight row in table
  document.querySelectorAll('#endpointsTableBody tr').forEach((tr, index) => {
    const ep = appState.schema.restEndpoints[index];
    if (ep && ep.id === id) {
      tr.classList.add('selected');
    } else {
      tr.classList.remove('selected');
    }
  });

  const ep = appState.schema.restEndpoints.find(e => e.id === id);
  if (!ep) return;

  document.getElementById('inspectorEmptyState').style.display = 'none';
  document.getElementById('inspectorContent').style.display = 'block';

  // Details
  document.getElementById('inspMethod').className = `badge badge-${ep.method.toLowerCase()}`;
  document.getElementById('inspMethod').innerText = ep.method;
  document.getElementById('inspPath').innerText = ep.pathPattern;

  document.getElementById('inspReqCount').innerText = ep.requestCount;
  document.getElementById('inspStatus').innerText = ep.defaultResponse?.statusCode || 200;

  const pNames = ep.parameters.map(p => `:${p.name} (${p.inferredType})`);
  document.getElementById('inspPathParams').innerText = pNames.length > 0 ? pNames.join(', ') : 'None';

  const qNames = ep.queryParameters.map(q => q.name);
  document.getElementById('inspQueryParams').innerText = qNames.length > 0 ? qNames.join(', ') : 'None';

  // Body preview
  document.getElementById('inspResponseBody').innerText = JSON.stringify(ep.defaultResponse?.body || {}, null, 2);

  // Set resilience forms defaults
  const rule = ep.scenarioRule;
  document.getElementById('inspInjectStatus').value = rule?.customStatusCode || 200;
  document.getElementById('inspInjectLatency').value = rule?.customLatencyMs || 0;

  // Render frontend references (Usage tab)
  const usageList = document.getElementById('inspUsageList');
  if (usageList) {
    usageList.innerHTML = '';
    const scan = appState.scanResults.find(r => r.endpointId === id);
    const usages = scan ? scan.usages : [];
    if (usages.length === 0) {
      usageList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No usages found in the workspace.</p>';
    } else {
      usages.forEach(u => {
        const item = document.createElement('div');
        item.style.marginBottom = '12px';
        item.style.padding = '8px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '4px';
        
        const fileName = u.filePath.split(/[\\/]/).pop();
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size:12px;">
            <strong style="color:var(--primary);">${fileName}:${u.lineNumber}</strong>
            <span style="font-size:10px; padding:2px 6px; border-radius:3px; background-color:var(--border-color); color:var(--text-primary); font-weight:bold;">${u.confidence}</span>
          </div>
          <code style="display:block; background-color:rgba(0,0,0,0.2); padding:6px; border-radius:3px; font-family:var(--font-mono); font-size:11px; overflow-x:auto; white-space:pre;">${u.lineContent}</code>
        `;
        usageList.appendChild(item);
      });
    }
  }

  // Render Integration Gap & Advice (Integration tab)
  const adviceList = document.getElementById('integrationAdviceList');
  const gapBanner = document.getElementById('integrationGapBanner');
  const scan = appState.scanResults.find(r => r.endpointId === id);
  const usages = scan ? scan.usages : [];

  if (gapBanner) {
    gapBanner.style.display = usages.length === 0 ? 'block' : 'none';
  }

  if (adviceList) {
    adviceList.innerHTML = '';
    const advice = appState.integrationAdvice[id] || [];
    if (usages.length > 0) {
      adviceList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Endpoint is already integrated in the workspace.</p>';
    } else if (advice.length === 0) {
      adviceList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No candidate files suggested. Select an integration path manually.</p>';
    } else {
      advice.forEach(ad => {
        const item = document.createElement('div');
        item.style.marginBottom = '12px';
        item.style.padding = '8px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '4px';
        
        const fileName = ad.filePath.split(/[\\/]/).pop();
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;">
            <strong>${fileName}</strong>
            <span style="font-size:10px; padding:2px 6px; border-radius:3px; background-color:rgba(210,153,34,0.1); color:var(--warning); font-weight:bold;">${ad.confidence} Confidence</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted);">${ad.reason}</div>
        `;
        adviceList.appendChild(item);
      });
    }
  }

  // Render Resilience report
  const resilienceReportList = document.getElementById('resilienceReportList');
  if (resilienceReportList) {
    resilienceReportList.innerHTML = '';
    const report = appState.resilienceReports[id];
    if (!report) {
      resilienceReportList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Resilience checks are not available for unintegrated endpoints.</p>';
    } else {
      let html = '<ul style="margin:0; padding-left:16px; font-size:13px; margin-bottom:12px; color:var(--text-secondary);">';
      report.statusGaps.forEach(g => {
        const color = g.status === 'handled' ? 'var(--primary)' : g.status === 'potentially handled' ? 'var(--warning)' : 'rgba(255, 100, 100, 0.8)';
        html += `<li style="margin-bottom:6px;"><strong>HTTP ${g.code} (${g.label}):</strong> <span style="color:${color}; font-weight:bold;">${g.status.toUpperCase()}</span></li>`;
      });
      html += '</ul>';

      if (report.reasons.length > 0) {
        html += '<h5 style="margin-top:12px; margin-bottom:6px; font-size:13px; color:var(--text-primary);">Potential Resilience Gaps</h5>';
        report.reasons.forEach(r => {
          html += `<div style="font-size:12px; color:rgba(255,100,100,0.8); margin-bottom:6px; padding: 6px; border-left:2px solid rgba(255,100,100,0.8); background-color:rgba(255,100,100,0.05); border-radius: 0 4px 4px 0;">⚠️ ${r}</div>`;
        });
      }

      resilienceReportList.innerHTML = html;
    }
  }

  // Render Performance stats
  const perfInfo = appState.performanceInsights[id];
  const perfAvg = document.getElementById('perfAvgLatency');
  const perfMin = document.getElementById('perfMinLatency');
  const perfMax = document.getElementById('perfMaxLatency');
  const perfCount = document.getElementById('perfSampleCount');
  
  if (perfAvg && perfMin && perfMax && perfCount) {
    if (perfInfo) {
      perfAvg.innerText = `${perfInfo.avg}ms`;
      perfMin.innerText = `${perfInfo.min}ms`;
      perfMax.innerText = `${perfInfo.max}ms`;
      perfCount.innerText = perfInfo.count;
    } else {
      perfAvg.innerText = 'Insufficient traffic data';
      perfMin.innerText = '-';
      perfMax.innerText = '-';
      perfCount.innerText = '0';
    }
  }
}

function renderSessionsTab() {
  const grid = document.getElementById('sessionsGrid');
  const empty = document.getElementById('sessionsEmptyState');
  if (!grid) return;

  grid.innerHTML = '';
  const sessions = appState.sessions;

  if (sessions.length === 0) {
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  sessions.forEach(sess => {
    const card = document.createElement('div');
    const isActive = appState.isGhostMode && appState.activeGhostSession?.id === sess.id;
    card.className = `session-card ${isActive ? 'active' : ''}`;

    const date = new Date(sess.createdAt).toLocaleDateString();
    
    card.innerHTML = `
      <div class="session-card-header">
        <span class="session-name">${sess.name}</span>
        <span class="session-date">${date}</span>
      </div>
      <div class="session-meta">
        <div>Captured requests: ${sess.metadata.requestCount}</div>
        <div>REST Endpoints: ${sess.metadata.restEndpointCount}</div>
        <div>GraphQL operations: ${sess.metadata.graphqlEndpointCount}</div>
      </div>
      <div class="session-actions">
        ${isActive 
          ? `<button class="btn btn-secondary" onclick="exitGhostMode()">Exit Ghost Mode</button>`
          : `<button class="btn btn-primary" onclick="enterGhostMode('${sess.id}')">Enter Ghost Mode</button>`
        }
        <button class="btn btn-secondary" onclick="renameSession('${sess.id}')">Rename</button>
        <button class="btn btn-secondary" onclick="deleteSession('${sess.id}')">Delete</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function enterGhostMode(id) {
  vscode.postMessage({ type: 'ENTER_GHOST_MODE', payload: { sessionId: id } });
}

function exitGhostMode() {
  vscode.postMessage({ type: 'EXIT_GHOST_MODE' });
}

function renameSession(id) {
  vscode.postMessage({ type: 'RENAME_GHOST_SESSION', payload: { sessionId: id } });
}

function deleteSession(id) {
  vscode.postMessage({ type: 'DELETE_GHOST_SESSION', payload: { sessionId: id } });
}

function renderHistoryTab() {
  const tbody = document.getElementById('historyTableBody');
  const empty = document.getElementById('historyEmptyState');
  if (!tbody) return;

  tbody.innerHTML = '';
  const history = appState.serverHistory;

  if (history.length === 0) {
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  history.forEach(item => {
    const tr = document.createElement('tr');
    const time = new Date(item.timestamp).toLocaleTimeString();
    
    let statusClass = 'text-primary';
    if (item.status >= 200 && item.status < 300) statusClass = 'success';
    else if (item.status >= 400) statusClass = 'danger';

    tr.innerHTML = `
      <td style="color: var(--text-muted);">${time}</td>
      <td><span class="badge badge-${item.method.toLowerCase()}">${item.method}</span></td>
      <td style="font-family: var(--font-mono);">${item.path}</td>
      <td class="${statusClass}">${item.status}</td>
      <td>${item.durationMs}ms</td>
      <td style="color: var(--text-secondary);">${item.scenario}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

function renderSettingsTab() {
  const port = document.getElementById('settingPort');
  if (port) port.value = appState.config.port || 4000;
  
  const scenario = document.getElementById('settingGlobalScenario');
  if (scenario) scenario.value = appState.config.globalScenario || 'normal';

  const latency = document.getElementById('settingLatencyEnabled');
  if (latency) latency.checked = appState.config.latency?.enabled || false;
}
