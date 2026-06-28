/**
 * AegisNode Closed-Loop AI Agent - Drone Command
 * Evaluates sensory telemetry inputs, writes reasoning thoughts, and triggers flight actions.
 */
class AegisAgent {
  constructor(apiClient, logCallback) {
    this.apiClient = apiClient;
    this.logCallback = logCallback;
    
    // Typewriter state tracking
    this.reasoningTargets = {
      drone: document.getElementById('droneAgentReasoning')
    };

    this.currentThoughts = {
      drone: ''
    };
  }

  /**
   * Run decision matrix on the latest perception data
   */
  evaluate(apiData) {
    this._evaluateDroneAgent(apiData);
  }

  /**
   * Drone Landing Loop Agent
   */
  _evaluateDroneAgent(data) {
    const vision = data.VISION;
    const spatial = data.SPATIAL;
    const environmental = data.ENVIRONMENTAL;
    const interoception = data.INTEROCEPTION;

    let thought = "";
    
    if (!spatial || !vision) {
      thought = "[DroneAgent] Flight sensory vectors offline. Halting landing sequence.";
      this._typeText('drone', thought);
      return;
    }

    const altitude = spatial.data?.altitude_m || 0;
    const speed = spatial.data?.speed_ms || 0;
    const windSpeed = environmental?.data?.wind_speed_knots || 0;
    const battery = interoception?.data?.battery_pct || 100;
    
    // Check vision obstacles
    const obstacles = this._getObstaclesList(vision);
    const isSafe = obstacles.length === 0;

    thought += `SENSING: Alt: ${altitude.toFixed(1)}m, Wind: ${windSpeed.toFixed(1)}kn, Battery: ${battery}%, Obstacles: ${isSafe ? 'NONE' : obstacles.join(', ')}. `;

    // Decision Logic
    if (battery < 20) {
      thought += `REASONING: Battery charge critical (${battery}%). Overriding flight sequence to enforce emergency landing. `;
      if (isSafe) {
        thought += `ACTION: Landing pad clear. Deploying gear and locking motor descent rate. Sending POST /api/actuation (MOVE_TO).`;
        this._triggerActuator('Motors', 'LANDING', 'active');
        this._triggerActuator('LandingGear', 'DEPLOYED', 'active');
        this.apiClient.postActuation('MOVE_TO', { altitude_m: 0 });
      } else {
        thought += `ACTION: Landing pad BLOCKED by ${obstacles.join(', ')}. Moving to safety hover hold. Actuating warning alarm.`;
        this._triggerActuator('Motors', 'HOVER', 'warning');
        this._triggerActuator('Beacon', 'BEACON_ON', 'warning');
        this.apiClient.postActuation('TRIGGER_ALARM');
      }
    } else if (windSpeed > 15) {
      thought += `REASONING: High wind speed detected (${windSpeed} knots > 15 max limit). Flight stability compromised. `;
      thought += `ACTION: Aborting landing cycle. Climbing to safety holding altitude. Actuating high wind stabilization trim.`;
      this._triggerActuator('Autopilot', 'WIND_STABILIZATION', 'warning');
      this.apiClient.postActuation('MOVE_TO', { altitude_m: 50 });
    } else {
      if (isSafe) {
        thought += `REASONING: Environment stable. Safe landing zone verified by Afferens camera feed. `;
        if (altitude > 1) {
          thought += `ACTION: Initiating automated vertical descent. Actuating motor speed correction.`;
          this._triggerActuator('Motors', 'DESCENDING', 'active');
          this._triggerActuator('LandingGear', 'DEPLOYED', 'active');
          this.apiClient.postActuation('MOVE_TO', { altitude_m: 0 });
        } else {
          thought += `ACTION: Drone touchdown complete. Powering down rotors to lock node safely.`;
          this._triggerActuator('Motors', 'OFF', '');
          this._triggerActuator('LandingGear', 'DEPLOYED', 'active');
        }
      } else {
        thought += `REASONING: Bounding box verification shows obstacle '${obstacles[0]}' inside landing envelope. Target coordinate offset required. `;
        thought += `ACTION: Safety hover hold engaged at 15m. Offsetting steering thrusters (ROTATE_CAMERA/MOVE_TO). Actuating warning strobe.`;
        this._triggerActuator('Motors', 'HOVER', 'warning');
        this._triggerActuator('Beacon', 'STROBE_ACTIVE', 'warning');
        this.apiClient.postActuation('ROTATE_CAMERA', { angle: 90 });
      }
    }

    this._typeText('drone', thought);
  }

  _getObstaclesList(vision) {
    if (!vision?.data?.objects) return [];
    const obstacleClasses = ['forklift', 'person', 'cell phone', 'cup', 'bottle', 'chair', 'laptop', 'backpack', 'remote', 'mouse', 'keyboard', 'book'];
    return vision.data.objects
      .filter(obj => obstacleClasses.includes(obj.label))
      .map(obj => obj.label);
  }

  /**
   * Custom UI actuator state update
   */
  _triggerActuator(type, text, className) {
    const statusEl = document.getElementById(`act${type.charAt(0).toUpperCase() + type.slice(1)}Status`);
    const cardEl = document.getElementById(`act${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const buttonEl = document.querySelector(`#act${type.charAt(0).toUpperCase() + type.slice(1)} button`);

    if (statusEl) {
      statusEl.textContent = text;
      if (className) {
        statusEl.className = `actuator-status ${className}`;
      } else {
        statusEl.className = 'actuator-status';
      }
    }

    if (cardEl) {
      cardEl.className = `actuator-card ${className}`;
    }

    if (buttonEl) {
      if (className === 'active' || className === 'warning') {
        buttonEl.classList.add('active');
      } else {
        buttonEl.classList.remove('active');
      }
    }
  }

  /**
   * Typewriter text print utility
   */
  _typeText(key, text) {
    const el = this.reasoningTargets[key];
    if (!el) return;

    // Initialize individual spans within the container if not present
    let sensingSpan = el.querySelector('.sensing-part');
    let decisionSpan = el.querySelector('.decision-part');
    let cursorSpan = el.querySelector('.typing-cursor');

    if (!sensingSpan || !decisionSpan || !cursorSpan) {
      el.innerHTML = '';
      sensingSpan = document.createElement('span');
      sensingSpan.className = 'sensing-part';
      decisionSpan = document.createElement('span');
      decisionSpan.className = 'decision-part';
      cursorSpan = document.createElement('span');
      cursorSpan.className = 'typing-cursor';
      
      el.appendChild(sensingSpan);
      el.appendChild(decisionSpan);
      el.appendChild(cursorSpan);
    }

    // Split text into sensing telemetry and decision logic
    let sensingPart = '';
    let decisionPart = text;

    const splitIdx = text.indexOf('REASONING:');
    if (splitIdx !== -1) {
      sensingPart = text.substring(0, splitIdx);
      decisionPart = text.substring(splitIdx);
    }

    // Update telemetry segment instantly to keep values real-time
    if (sensingSpan.textContent !== sensingPart) {
      sensingSpan.textContent = sensingPart;
    }

    // Only reset/restart typing animation if decision/action statement changes
    if (this.currentThoughts[key] === decisionPart) {
      return;
    }

    // Cancel any active typewriter recursion for this key
    if (this.typeTimeouts && this.typeTimeouts[key]) {
      clearTimeout(this.typeTimeouts[key]);
    } else if (!this.typeTimeouts) {
      this.typeTimeouts = {};
    }

    this.currentThoughts[key] = decisionPart;
    decisionSpan.textContent = '';
    cursorSpan.style.display = 'inline-block';

    let charIdx = 0;
    const typeSpeed = 20;

    const type = () => {
      if (charIdx < decisionPart.length) {
        decisionSpan.textContent += decisionPart.charAt(charIdx);
        charIdx++;
        this.typeTimeouts[key] = setTimeout(type, typeSpeed);
      } else {
        cursorSpan.style.display = 'none'; // hide blinking cursor when typing finishes
      }
    };

    type();
  }
}

window.AegisAgent = AegisAgent;
