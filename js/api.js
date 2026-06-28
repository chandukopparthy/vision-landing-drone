/**
 * Afferens API Client & Local Sensory Synthesizer - Drone Command
 * 
 * Maps to:
 * - GET  https://afferens.com/api/perception
 * - POST https://afferens.com/api/actuation
 */
class AfferensAPIClient {
  constructor() {
    this.apiKey = '';
    this.isSimulated = true;
    this.tokensRemaining = 10000;
    this.tokensConsumed = 0;
    this.simulatedStats = {
      battery: 91,
      cpu: 14.2,
      memory: 38.7,
      latency: 12,
      uptime: 86400
    };
    
    // Modality token costs matching official docs
    this.tokenCosts = {
      'VISION': 14,
      'SPATIAL': 10,
      'ENVIRONMENTAL': 6,
      'INTEROCEPTION': 5
    };
  }

  setAPIKey(key) {
    if (key && key.trim().startsWith('aff_live_')) {
      this.apiKey = key.trim();
      this.isSimulated = false;
      return true;
    }
    this.apiKey = '';
    this.isSimulated = true;
    return false;
  }

  disconnect() {
    this.apiKey = '';
    this.isSimulated = true;
  }

  /**
   * Fetches perception data for a specific modality.
   */
  async getPerception(modality = '', limit = 1) {
    if (this.isSimulated) {
      const cost = this.tokenCosts[modality] || 10;
      this.tokensConsumed += cost;
      this.tokensRemaining = Math.max(0, this.tokensRemaining - cost);
      
      return this._generateSimulatedTelemetry(modality);
    }

    try {
      const url = new URL('https://afferens.com/api/perception');
      if (modality) url.searchParams.append('modality', modality);
      url.searchParams.append('limit', limit.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Afferens API Error: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      
      if (payload.data && payload.data.length > 0) {
        const cost = payload.data.reduce((sum, item) => sum + (item.sense_tokens_consumed || 0), 0);
        this.tokensConsumed += cost;
      }
      if (payload.tokens_remaining !== undefined) {
        this.tokensRemaining = payload.tokens_remaining;
      }

      return payload;
    } catch (error) {
      console.error('Fetch failed, falling back to simulated data:', error);
      const simulatedPayload = this._generateSimulatedTelemetry(modality);
      simulatedPayload.cors_warning = true;
      return simulatedPayload;
    }
  }

  /**
   * Sends actuator commands.
   */
  async postActuation(commandType, parameters = {}, targetNodeId = '') {
    const cost = 5;
    this.tokensConsumed += cost;
    this.tokensRemaining = Math.max(0, this.tokensRemaining - cost);

    if (this.isSimulated) {
      return {
        status: 200,
        success: true,
        node_id: targetNodeId || 'SIM-DRONE-01',
        command: commandType,
        parameters: parameters,
        tokens_remaining: this.tokensRemaining
      };
    }

    try {
      const response = await fetch('https://afferens.com/api/actuation', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command_type: commandType,
          parameters: parameters,
          target_node_id: targetNodeId || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Actuation Failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Actuation API POST failed:', error);
      return {
        status: 500,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generates simulated telemetry payloads mirroring drone sensor matrices
   */
  _generateSimulatedTelemetry(modality) {
    const timestamp = new Date().toISOString();
    const timestampLocal = new Date().toLocaleString();
    let dataList = [];

    // Fluctuating status metrics
    this.simulatedStats.uptime += 1;
    this.simulatedStats.latency = Math.floor(10 + Math.random() * 8);
    this.simulatedStats.cpu = parseFloat((12 + Math.sin(Date.now() / 10000) * 3 + Math.random()).toFixed(1));
    this.simulatedStats.memory = parseFloat((32 + Math.sin(Date.now() / 15000) * 2).toFixed(1));

    switch (modality) {
      case 'VISION':
        const cycle = Date.now() / 8000;
        const forkliftX = Math.floor(140 + Math.sin(cycle) * 30);
        const forkliftY = Math.floor(90 + Math.cos(cycle) * 15);
        const forkliftVisible = Math.sin(cycle * 1.5) > -0.5;
        
        const objects = [];
        if (forkliftVisible) {
          objects.push({
            label: "forklift",
            confidence: parseFloat((0.92 + Math.random() * 0.03).toFixed(3)),
            bbox_x: forkliftX,
            bbox_y: forkliftY,
            bbox_w: 210,
            bbox_h: 180
          });
        }
        
        // Occasional pedestrian check
        if (Math.sin(cycle * 0.4) > 0.3) {
          objects.push({
            label: "person",
            confidence: parseFloat((0.85 + Math.random() * 0.04).toFixed(3)),
            bbox_x: Math.floor(350 + Math.sin(cycle * 2) * 50),
            bbox_y: 120,
            bbox_w: 60,
            bbox_h: 140
          });
        }

        dataList.push({
          timestamp: timestamp,
          timestamp_utc: timestamp,
          timestamp_local: timestampLocal,
          timestamp_timezone: "UTC",
          entity_id: "DEMO-VIS-001",
          modality: "VISION",
          classification: objects.length > 0 ? objects[0].label : "clear_path",
          confidence: objects.length > 0 ? objects[0].confidence : 0.99,
          spatial_coords: { x: 12.4, y: -3.2, z: 0 },
          data: {
            objects: objects,
            object_count: objects.length,
            model: "afferens-vision-v1",
            frame_width: 1280,
            frame_height: 720
          },
          sense_tokens_consumed: 14
        });
        break;

      case 'SPATIAL':
        const spatialCycle = Date.now() / 25000;
        const baseLat = 3.073;
        const baseLng = 101.518;
        const lat = baseLat + Math.sin(spatialCycle) * 0.002;
        const lng = baseLng + Math.cos(spatialCycle) * 0.002;
        const alt = parseFloat((35.0 + Math.sin(Date.now() / 5000) * 5).toFixed(1));
        const heading = parseFloat(((180 + Math.cos(spatialCycle) * 90) % 360).toFixed(1));
        const speed = parseFloat((2.0 + Math.abs(Math.sin(spatialCycle)) * 2).toFixed(1));

        dataList.push({
          timestamp: timestamp,
          timestamp_utc: timestamp,
          timestamp_local: timestampLocal,
          timestamp_timezone: "UTC",
          entity_id: "DEMO-SPT-001",
          modality: "SPATIAL",
          classification: "gps_reading",
          confidence: 0.95,
          spatial_coords: { lat: lat, lng: lng, altitude_m: alt },
          data: {
            lat: lat,
            lng: lng,
            altitude_m: alt,
            speed_ms: speed,
            heading_deg: heading,
            accuracy_m: 1.8
          },
          sense_tokens_consumed: 10
        });
        break;

      case 'ENVIRONMENTAL':
        const tempCycle = Date.now() / 60000;
        const temp = parseFloat((25.5 + Math.sin(tempCycle) * 1.5).toFixed(1));
        const humidity = parseFloat((68.0 + Math.cos(tempCycle) * 5.0).toFixed(1));
        // Wind gusts
        const wind = parseFloat((4.0 + Math.max(0, Math.sin(Date.now() / 6000) * 10)).toFixed(1));

        dataList.push({
          timestamp: timestamp,
          timestamp_utc: timestamp,
          timestamp_local: timestampLocal,
          timestamp_timezone: "UTC",
          entity_id: "DEMO-ENV-001",
          modality: "ENVIRONMENTAL",
          classification: "ambient_reading",
          confidence: 0.7,
          spatial_coords: null,
          data: {
            temperature_c: temp,
            humidity_pct: humidity,
            pressure_hpa: 1013.2,
            wind_speed_knots: wind,
            wind_direction_deg: 180
          },
          sense_tokens_consumed: 6
        });
        break;

      case 'INTEROCEPTION':
        dataList.push({
          timestamp: timestamp,
          timestamp_utc: timestamp,
          timestamp_local: timestampLocal,
          timestamp_timezone: "UTC",
          entity_id: "DEMO-INT-001",
          modality: "INTEROCEPTION",
          classification: "node_health",
          confidence: 0.95,
          spatial_coords: null,
          data: {
            cpu_pct: this.simulatedStats.cpu,
            mem_pct: this.simulatedStats.memory,
            battery_pct: this.simulatedStats.battery,
            uptime_s: this.simulatedStats.uptime,
            sensor_errors: 0,
            network_latency_ms: this.simulatedStats.latency
          },
          sense_tokens_consumed: 5
        });
        break;

      default:
        break;
    }

    return {
      status: 200,
      demo: true,
      data: dataList,
      count: dataList.length,
      tokens_remaining: this.tokensRemaining,
      api_version: "v1.0.0"
    };
  }
}

window.AfferensAPIClient = AfferensAPIClient;
