/**
 * AegisNode Drone Command Dashboard Orchestrator
 * Coordinates: AfferensAPIClient (api.js), AegisSimulator (simulator.js), AegisAgent (agent.js)
 */
document.addEventListener('DOMContentLoaded', () => {
  const api = new AfferensAPIClient();
  const simulator = new AegisSimulator();
  const obstacleClasses = ['forklift', 'person', 'cell phone', 'cup', 'bottle', 'chair', 'laptop', 'backpack', 'remote', 'mouse', 'keyboard', 'book'];
  
  // Terminal logger
  const terminalLog = document.getElementById('terminalLog');
  const logToTerminal = (tag, message, type = 'info') => {
    if (!terminalLog) return;
    const row = document.createElement('div');
    row.className = 'terminal-row';

    const timestamp = new Date().toLocaleTimeString();
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'term-time';
    timeSpan.textContent = `[${timestamp}]`;
    
    const tagSpan = document.createElement('span');
    tagSpan.className = `term-tag ${type}`;
    tagSpan.textContent = `[${tag.toUpperCase()}]`;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'term-msg';
    msgSpan.textContent = message;

    row.appendChild(timeSpan);
    row.appendChild(tagSpan);
    row.appendChild(msgSpan);
    
    terminalLog.appendChild(row);
    terminalLog.scrollTop = terminalLog.scrollHeight;
  };

  const agent = new AegisAgent(api, logToTerminal);

  // Log model state transitions to terminal
  let modelLoadLogged = false;
  
  simulator.onDetection((objects, frameWidth, frameHeight) => {
    if (!modelLoadLogged) {
      logToTerminal('SYSTEM', 'Real-time AI object detection (COCO-SSD) model loaded and active.', 'success');
      modelLoadLogged = true;
    }
    
    // Create a real-time vision telemetry payload matching the API structure
    const visionPayload = {
      timestamp: new Date().toISOString(),
      timestamp_utc: new Date().toISOString(),
      timestamp_local: new Date().toLocaleTimeString(),
      timestamp_timezone: "UTC",
      entity_id: "WEBCAM-VIS-001",
      modality: "VISION",
      classification: objects.length > 0 ? objects[0].label : "clear_path",
      confidence: objects.length > 0 ? objects[0].confidence : 0.99,
      spatial_coords: { x: 0, y: 0, z: 0 },
      data: {
        objects: objects,
        object_count: objects.length,
        model: "coco-ssd-realtime",
        frame_width: frameWidth || 1280,
        frame_height: frameHeight || 720
      },
      sense_tokens_consumed: 0
    };

    // Update the local telemetry buffer
    telemetryData.VISION = visionPayload;

    // Run updates immediately on frame analysis for real-time confidence & labels
    calculateAndUpdateConfidence(telemetryData);
    updateTelemetryLabels();
  });

  // Connection UI Elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const connectBtn = document.getElementById('connectBtn');
  const connectionDot = document.getElementById('connectionDot');
  const connectionText = document.getElementById('connectionText');
  const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');

  // Toggle key visibility
  toggleKeyVisibility?.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyVisibility.classList.add('active');
    } else {
      apiKeyInput.type = 'password';
      toggleKeyVisibility.classList.remove('active');
    }
  });

  // Handle Connect Button click
  connectBtn?.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const apiModalityVal = document.getElementById('apiModalityVal');
    const apiModalitySub = document.getElementById('apiModalitySub');

    if (!key) {
      api.disconnect();
      connectionDot.className = 'status-dot simulated';
      connectionText.textContent = 'Simulated Telemetry';
      connectBtn.textContent = 'Connect API';
      connectBtn.className = 'btn';
      apiKeyInput.value = '';
      if (apiModalityVal) apiModalityVal.textContent = 'Simulated Loop';
      if (apiModalitySub) apiModalitySub.textContent = 'Using local mock client';
      logToTerminal('SYSTEM', 'API key removed. Reverting to local drone simulation loop.', 'warning');
      return;
    }

    const ok = api.setAPIKey(key);
    if (ok) {
      connectionDot.className = 'status-dot active';
      connectionText.textContent = 'Connected (Afferens Live)';
      connectBtn.textContent = 'Disconnect';
      connectBtn.className = 'btn btn-secondary';
      if (apiModalityVal) apiModalityVal.textContent = 'Afferens Live';
      if (apiModalitySub) {
        const maskedKey = key.slice(0, 12) + '...' + key.slice(-4);
        apiModalitySub.textContent = `Key: ${maskedKey}`;
      }
      logToTerminal('SYSTEM', 'Connecting to live Afferens drone streams...', 'info');
    } else {
      connectionDot.className = 'status-dot error';
      connectionText.textContent = 'Key Error';
      logToTerminal('ERROR', 'Invalid API key format! Keys must match "aff_live_..."', 'danger');
    }
  });

  // Clear Terminal Button
  const clearTerminalBtn = document.getElementById('clearTerminalBtn');
  clearTerminalBtn?.addEventListener('click', () => {
    if (terminalLog) {
      terminalLog.innerHTML = '';
      logToTerminal('SYSTEM', 'Terminal log cleared.');
    }
  });

  // Tab Switching Logic
  const tabBtnDashboard = document.getElementById('tabBtnDashboard');
  const tabBtnConfidence = document.getElementById('tabBtnConfidence');
  const pageDashboard = document.getElementById('pageDashboard');
  const pageConfidence = document.getElementById('pageConfidence');

  const switchTab = (activeBtn, activePage, inactiveBtn, inactivePage) => {
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
    activePage.style.display = 'grid';
    inactivePage.style.display = 'none';
    
    // Trigger canvas resize recalculations if dashboard is shown
    if (activePage === pageDashboard) {
      window.dispatchEvent(new Event('resize'));
    }
  };

  tabBtnDashboard?.addEventListener('click', () => {
    switchTab(tabBtnDashboard, pageDashboard, tabBtnConfidence, pageConfidence);
  });

  tabBtnConfidence?.addEventListener('click', () => {
    switchTab(tabBtnConfidence, pageConfidence, tabBtnDashboard, pageDashboard);
  });

  // Info Guide Banner Dismissal Logic
  const infoGuideBanner = document.getElementById('infoGuideBanner');
  const closeInfoBannerBtn = document.getElementById('closeInfoBannerBtn');
  
  if (sessionStorage.getItem('infoGuideBannerClosed') === 'true') {
    if (infoGuideBanner) infoGuideBanner.style.display = 'none';
  }

  closeInfoBannerBtn?.addEventListener('click', () => {
    if (infoGuideBanner) {
      infoGuideBanner.style.display = 'none';
      sessionStorage.setItem('infoGuideBannerClosed', 'true');
      window.dispatchEvent(new Event('resize'));
    }
  });

  // Calculate combined landing confidence rating
  const calculateAndUpdateConfidence = (data) => {
    const vision = data.VISION;
    const spatial = data.SPATIAL;
    const env = data.ENVIRONMENTAL;
    const int = data.INTEROCEPTION;

    if (!spatial || !vision || !env || !int) return;

    let score = 100;
    
    // 1. Vision modality impacts
    const objects = vision.data?.objects || [];
    const hasObstacles = objects.some(o => obstacleClasses.includes(o.label));
    let visionParamText = 'No Obstacles';
    let visionImpactText = '+35%';
    let visionClass = 'diag-score-change positive';

    if (hasObstacles) {
      score -= 70;
      const label = objects[0]?.label || 'obstacle';
      visionParamText = `Obstacle: ${label.toUpperCase()}`;
      visionImpactText = '-70%';
      visionClass = 'diag-score-change negative';
    }

    // 2. Environmental modality impacts
    const wind = env.data?.wind_speed_knots || 0;
    let envParamText = `${wind.toFixed(1)} kn`;
    let envImpactText = '+25%';
    let envClass = 'diag-score-change positive';

    if (wind > 15) {
      score -= 50;
      envImpactText = '-50%';
      envClass = 'diag-score-change negative';
    } else if (wind > 5) {
      const penalty = Math.round(((wind - 5) / 10) * 35);
      score -= penalty;
      envImpactText = `-${penalty}%`;
      envClass = 'diag-score-change negative';
    }

    // 3. Interoception modality impacts
    const battery = int.data?.battery_pct || 100;
    let intParamText = `${battery}% Battery`;
    let intImpactText = '+25%';
    let intClass = 'diag-score-change positive';

    if (battery < 20) {
      score -= 40;
      intImpactText = '-40%';
      intClass = 'diag-score-change negative';
    } else if (battery < 50) {
      const penalty = Math.round(((50 - battery) / 30) * 15);
      score -= penalty;
      intImpactText = `-${penalty}%`;
      intClass = 'diag-score-change negative';
    }

    // 4. Spatial modality impacts
    const alt = spatial.data?.altitude_m || 0;
    const speed = spatial.data?.speed_ms || 0;
    let spatialParamText = `${alt.toFixed(1)} m`;
    let spatialImpactText = '+15%';
    let spatialClass = 'diag-score-change positive';

    if (alt < 10 && speed > 3) {
      score -= 15;
      spatialImpactText = '-15%';
      spatialClass = 'diag-score-change negative';
    }

    score = Math.max(0, Math.min(100, score));

    // Force 100% on successful touchdown
    if (alt <= 0.5 && !hasObstacles && wind <= 15 && battery >= 20) {
      score = 100;
      spatialParamText = 'Touchdown (0.0 m)';
    }

    // Update circular gauge
    const percentEl = document.getElementById('confidencePercentageVal');
    const circleEl = document.getElementById('confidenceGaugeCircle');
    const badgeEl = document.getElementById('confidenceStatusBadge');

    if (percentEl) percentEl.textContent = `${score}%`;
    
    if (circleEl) {
      const circumference = 534;
      const offset = circumference - (score / 100) * circumference;
      circleEl.style.strokeDashoffset = offset;

      if (score >= 80) {
        circleEl.style.stroke = '#10b981';
      } else if (score >= 50) {
        circleEl.style.stroke = '#f59e0b';
      } else {
        circleEl.style.stroke = '#ef4444';
      }
    }

    if (badgeEl) {
      if (score >= 80) {
        badgeEl.textContent = 'Optimal Landing Zone';
        badgeEl.className = 'confidence-state-badge optimal';
      } else if (score >= 50) {
        badgeEl.textContent = 'Caution: Safety Margins Low';
        badgeEl.className = 'confidence-state-badge caution';
      } else {
        badgeEl.textContent = 'Danger: Abort Descent Enforced';
        badgeEl.className = 'confidence-state-badge critical';
      }
    }

    // Update details table
    const dVisionParam = document.getElementById('diagVisionParam');
    const dVisionImpact = document.getElementById('diagVisionImpact');
    const dEnvParam = document.getElementById('diagEnvParam');
    const dEnvImpact = document.getElementById('diagEnvImpact');
    const dIntParam = document.getElementById('diagIntParam');
    const dIntImpact = document.getElementById('diagIntImpact');
    const dSpatialParam = document.getElementById('diagSpatialParam');
    const dSpatialImpact = document.getElementById('diagSpatialImpact');

    if (dVisionParam) dVisionParam.textContent = visionParamText;
    if (dVisionImpact) {
      dVisionImpact.textContent = visionImpactText;
      dVisionImpact.className = visionClass;
    }
    if (dEnvParam) dEnvParam.textContent = envParamText;
    if (dEnvImpact) {
      dEnvImpact.textContent = envImpactText;
      dEnvImpact.className = envClass;
    }
    if (dIntParam) dIntParam.textContent = intParamText;
    if (dIntImpact) {
      dIntImpact.textContent = intImpactText;
      dIntImpact.className = intClass;
    }
    if (dSpatialParam) dSpatialParam.textContent = spatialParamText;
    if (dSpatialImpact) {
      dSpatialImpact.textContent = spatialImpactText;
      dSpatialImpact.className = spatialClass;
    }
  };

  // Setup Manual Actuator Relays Buttons Click Hooks
  const setupActuatorButton = (buttonId, actuatorId, actName, cmdOn, cmdOff) => {
    const btn = document.getElementById(buttonId);
    btn?.addEventListener('click', () => {
      const card = document.getElementById(actuatorId);
      const isCurrentlyActive = card.classList.contains('active') || card.classList.contains('warning');
      
      const newStatus = isCurrentlyActive ? 'OFF' : 'ON';
      const cmd = isCurrentlyActive ? cmdOff : cmdOn;

      logToTerminal('ACTUATOR', `Manual override: Setting ${actName} to ${newStatus}`, 'info');
      
      api.postActuation(cmd, { manual: true });
      
      const statusEl = document.getElementById(`${actuatorId}Status`);
      if (statusEl) {
        statusEl.textContent = newStatus;
        statusEl.className = `actuator-status ${isCurrentlyActive ? '' : 'active'}`;
      }
      card.className = `actuator-card ${isCurrentlyActive ? '' : 'active'}`;
      if (isCurrentlyActive) {
        btn.classList.remove('active');
      } else {
        btn.classList.add('active');
      }
    });
  };

  // Bind drone manual toggle buttons
  setupActuatorButton('toggleDroneMotors', 'actDroneMotors', 'Drone Rotors', 'MOVE_TO', 'SHUTDOWN_NODE');
  setupActuatorButton('toggleDroneLandingGear', 'actDroneLandingGear', 'Drone Landing Gear', 'ADJUST_SENSOR', 'ADJUST_SENSOR');
  setupActuatorButton('toggleDroneAutopilot', 'actDroneAutopilot', 'Drone Autopilot Override', 'ADJUST_SENSOR', 'ADJUST_SENSOR');
  setupActuatorButton('toggleDroneBeacon', 'actDroneBeacon', 'Drone Emergency Beacon', 'TRIGGER_ALARM', 'ADJUST_SENSOR');

  const viewSchematicsLink = document.getElementById('viewSchematicsLink');
  viewSchematicsLink?.addEventListener('click', (e) => {
    e.preventDefault();
    window.open('assets/schematics.svg', '_blank');
  });



  // Cached API Telemetry Data
  const telemetryData = {
    VISION: null,
    SPATIAL: null,
    ENVIRONMENTAL: null,
    INTEROCEPTION: null
  };



  // Main Telemetry Fetching Loop (1000ms frequency)
  const pollSensors = async () => {
    try {
      const isWebcamVisionActive = simulator.webcamActive && simulator.cocoModel;
      const modalities = isWebcamVisionActive 
        ? ['SPATIAL', 'ENVIRONMENTAL', 'INTEROCEPTION'] 
        : ['VISION', 'SPATIAL', 'ENVIRONMENTAL', 'INTEROCEPTION'];
      
      const promises = modalities.map(async (mod) => {
        const payload = await api.getPerception(mod);
        if (payload && payload.data && payload.data.length > 0) {
          telemetryData[mod] = payload.data[0];
        }
        return { modality: mod, payload };
      });

      const results = await Promise.all(promises);
      
      const hasCorsWarning = results.some(r => r.payload && r.payload.cors_warning);
      if (hasCorsWarning && !api.isSimulated && !window.corsWarned) {
        logToTerminal('WARN', 'Browser CORS policy blocked direct API requests. Dashboard has automatically fallen back to Local Telemetry streams.', 'warning');
        window.corsWarned = true;
      }

      // Update metrics widgets
      document.getElementById('tokensConsumedVal').textContent = api.tokensConsumed.toLocaleString();
      document.getElementById('tokensRemainingVal').textContent = `${api.tokensRemaining.toLocaleString()} tokens remaining`;
      
      const latVal = telemetryData.INTEROCEPTION?.data?.network_latency_ms || 12;
      document.getElementById('networkLatencyVal').textContent = `Latency: ${latVal}ms (${latVal < 25 ? 'Normal' : 'High'})`;
      
      const battery = telemetryData.INTEROCEPTION?.data?.battery_pct || 100;
      document.getElementById('globalHealthVal').textContent = `${battery}%`;

      // Trigger Agent perception reasoning loop
      agent.evaluate(telemetryData);
      
      // Update text values inside tab panes
      updateTelemetryLabels();

      // Update landing confidence diagnostics page
      calculateAndUpdateConfidence(telemetryData);

    } catch (err) {
      console.error("Telemetry fetch interval failure:", err);
      logToTerminal('ERROR', 'Fault detected in telemetry interface hardware: ' + err.message, 'danger');
    }
  };

  // Detail panel values updates
  const updateTelemetryLabels = () => {
    const dAlt = telemetryData.SPATIAL?.data?.altitude_m || 0;
    const dSpd = telemetryData.SPATIAL?.data?.speed_ms || 0;
    const dWind = telemetryData.ENVIRONMENTAL?.data?.wind_speed_knots || 0;
    const dBat = telemetryData.INTEROCEPTION?.data?.battery_pct || 100;

    document.getElementById('droneTelemetryAlt').textContent = `${dAlt.toFixed(1)} m`;
    document.getElementById('droneTelemetrySpeed').textContent = `${dSpd.toFixed(1)} m/s`;
    document.getElementById('droneTelemetryWind').textContent = `${dWind.toFixed(1)} kn`;
    document.getElementById('droneTelemetryBattery').textContent = `${dBat}%`;

    // Wind speed highlight warning
    const windAlertItem = document.getElementById('windSpeedAlertItem');
    if (dWind > 15 && windAlertItem) {
      windAlertItem.style.borderColor = '#b91c1c';
      windAlertItem.style.background = 'rgba(185, 28, 28, 0.04)';
    } else if (windAlertItem) {
      windAlertItem.style.borderColor = '';
      windAlertItem.style.background = '';
    }

    // Battery highlight warning
    const batteryAlertItem = document.getElementById('batteryAlertItem');
    if (dBat < 25 && batteryAlertItem) {
      batteryAlertItem.style.borderColor = '#b91c1c';
      batteryAlertItem.style.background = 'rgba(185, 28, 28, 0.04)';
    } else if (batteryAlertItem) {
      batteryAlertItem.style.borderColor = '';
      batteryAlertItem.style.background = '';
    }

    const hasObstacles = telemetryData.VISION?.data?.objects && telemetryData.VISION.data.objects.some(o => obstacleClasses.includes(o.label));
    const safetyDot = document.getElementById('droneSafetyDot');
    const safetyText = document.getElementById('droneSafetyText');
    const confSafetyDot = document.getElementById('confidenceDroneSafetyDot');
    const confSafetyText = document.getElementById('confidenceDroneSafetyText');
    
    if (hasObstacles) {
      if (safetyDot) safetyDot.className = 'status-dot error';
      if (safetyText) safetyText.textContent = 'Landing Unsafe';
      if (confSafetyDot) confSafetyDot.className = 'status-dot error';
      if (confSafetyText) confSafetyText.textContent = 'Landing Unsafe';
    } else {
      if (safetyDot) safetyDot.className = 'status-dot active';
      if (safetyText) safetyText.textContent = 'Landing Zone Clear';
      if (confSafetyDot) confSafetyDot.className = 'status-dot active';
      if (confSafetyText) confSafetyText.textContent = 'Landing Zone Clear';
    }

    // Safety Alert warning popup logic

  };

  // Start sensor polling
  pollSensors();
  const pollInterval = setInterval(pollSensors, 1000);

  // Canvas Animators Loop
  const drawLoop = () => {
    simulator.renderAll(telemetryData);
    requestAnimationFrame(drawLoop);
  };
  requestAnimationFrame(drawLoop);

  logToTerminal('SYSTEM', 'Orchestration app started. Sensors polled at 1000ms. Visualizer running at 60Hz.', 'info');
});
