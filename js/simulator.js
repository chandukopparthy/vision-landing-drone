/**
 * AegisNode Visual Simulators - Drone Optics
 * Controls the HTML5 Canvas renderings for the AI Drone Landing visualizer.
 */
class AegisSimulator {
  constructor() {
    this.droneCanvas = document.getElementById('droneCanvas');
    this.droneCtx = this.droneCanvas ? this.droneCanvas.getContext('2d') : null;

    this.confCanvas = document.getElementById('confidenceDroneCanvas');
    this.confCtx = this.confCanvas ? this.confCanvas.getContext('2d') : null;

    // Simulation states
    this.scanLineY = 0;
    
    // Live Webcam Stream Setup
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsinline = true;
    this.video.muted = true;
    this.webcamActive = false;

    // COCO-SSD Real-Time AI model state
    this.cocoModel = null;
    this.loadingModel = false;
    this.onDetectionCallback = null;

    // Request webcam permissions
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
        .then(stream => {
          this.video.srcObject = stream;
          this.video.play().then(() => {
            this.webcamActive = true;
            console.log("Webcam stream active.");
          }).catch(e => console.warn("Failed to play webcam video:", e));
        })
        .catch(err => {
          console.warn("Webcam access not granted/available:", err);
          this.webcamActive = false;
        });
    }

    this._loadModel();
    this._initCanvasResizing();
  }

  _initCanvasResizing() {
    const resize = () => {
      [this.droneCanvas, this.confCanvas].forEach(canvas => {
        if (canvas) {
          // Adjust coordinate space safely based on width, defaulting to 800px if container is hidden
          const w = canvas.parentElement.clientWidth || 800;
          canvas.width = w;
          canvas.height = w * 9 / 16;
        }
      });
    };

    window.addEventListener('resize', resize);
    setTimeout(resize, 100);
  }

  _loadModel() {
    if (typeof cocoSsd !== 'undefined') {
      this.loadingModel = true;
      console.log("Loading COCO-SSD model...");
      cocoSsd.load({ base: 'lite_mobilenet_v2' })
        .then(model => {
          this.cocoModel = model;
          this.loadingModel = false;
          console.log("COCO-SSD model loaded successfully.");
          this._startDetectionLoop();
        })
        .catch(err => {
          console.error("Failed to load COCO-SSD model:", err);
          this.loadingModel = false;
        });
    } else {
      console.warn("COCO-SSD library is not defined. Retrying in 1s...");
      setTimeout(() => this._loadModel(), 1000);
    }
  }

  _startDetectionLoop() {
    const detectFrame = async () => {
      if (this.webcamActive && this.cocoModel && this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        try {
          const predictions = await this.cocoModel.detect(this.video);
          
          const objects = predictions.map(p => ({
            label: p.class,
            confidence: p.score,
            bbox_x: p.bbox[0],
            bbox_y: p.bbox[1],
            bbox_w: p.bbox[2],
            bbox_h: p.bbox[3]
          }));
          
          if (this.onDetectionCallback) {
            this.onDetectionCallback(objects, this.video.videoWidth, this.video.videoHeight);
          }
        } catch (err) {
          console.error("COCO-SSD inference execution failed:", err);
        }
      }
      setTimeout(detectFrame, 150);
    };
    detectFrame();
  }

  onDetection(callback) {
    this.onDetectionCallback = callback;
  }

  _getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      accent: style.getPropertyValue('--accent').trim() || '#1f2937',
      accentRgb: style.getPropertyValue('--accent-rgb').trim() || '31, 41, 55',
      accentDim: style.getPropertyValue('--accent-dim').trim() || 'rgba(31, 41, 55, 0.06)',
      accentBorder: style.getPropertyValue('--accent-border').trim() || 'rgba(31, 41, 55, 0.15)',
      bgMain: style.getPropertyValue('--bg-main').trim() || '#f3f4f6',
      bgCard: style.getPropertyValue('--bg-card').trim() || '#ffffff',
      textPrimary: style.getPropertyValue('--text-primary').trim() || '#111827',
      textSecondary: style.getPropertyValue('--text-secondary').trim() || '#4b5563',
      borderColor: style.getPropertyValue('--border-color').trim() || 'rgba(0, 0, 0, 0.08)',
      warning: style.getPropertyValue('--warning').trim() || '#b45309',
      danger: style.getPropertyValue('--danger').trim() || '#b91c1c',
      info: style.getPropertyValue('--info').trim() || '#1d4ed8'
    };
  }

  /**
   * Render drone footage
   */
  renderAll(apiData) {
    // Tick scanline position once per frame using the main canvas height
    const h = (this.droneCanvas && this.droneCanvas.height) || 450;
    this.scanLineY = (this.scanLineY + 1.2) % h;

    this._drawDroneSimulation(this.droneCtx, this.droneCanvas, apiData.VISION, apiData.SPATIAL, apiData.INTEROCEPTION, apiData.ENVIRONMENTAL);
    this._drawDroneSimulation(this.confCtx, this.confCanvas, apiData.VISION, apiData.SPATIAL, apiData.INTEROCEPTION, apiData.ENVIRONMENTAL);
  }

  /**
   * Drone Canvas Drawer
   */
  _drawDroneSimulation(ctx, canvas, vision, spatial, interoception, environmental) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const colors = this._getThemeColors();

    // Clear and draw background
    if (this.webcamActive && this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      ctx.drawImage(this.video, 0, 0, w, h);
      ctx.fillStyle = `rgba(${colors.accentRgb}, 0.03)`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = colors.bgMain;
      ctx.fillRect(0, 0, w, h);
      
      const alt = spatial?.data?.altitude_m || 42;
      const altScale = Math.max(0.5, Math.min(2.5, (100 - alt) / 30));
      this._drawSimulatedWarehouseBackdrop(ctx, w, h, altScale);
    }

    // Real-Time AI model loading/active status overlay
    if (this.webcamActive) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(10, h - 90, 340, 25);
      ctx.lineWidth = 1;
      
      if (this.loadingModel) {
        ctx.strokeStyle = colors.warning;
        ctx.strokeRect(10, h - 90, 340, 25);
        ctx.fillStyle = colors.warning;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText("⚡ LOADING REAL-TIME AI VISION (COCO-SSD)...", 20, h - 90 + 12.5);
      } else if (this.cocoModel) {
        ctx.strokeStyle = '#10b981';
        ctx.strokeRect(10, h - 90, 340, 25);
        ctx.fillStyle = '#10b981';
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText("📡 AI REAL-TIME FEED ACTIVE (COCO-SSD)", 20, h - 90 + 12.5);
      }
    }

    // Dynamic grid overlay
    ctx.strokeStyle = `rgba(${colors.accentRgb}, 0.04)`;
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const alt = spatial?.data?.altitude_m || 42;
    const altScale = Math.max(0.5, Math.min(2.5, (100 - alt) / 30));

    // Simulated camera image structures (landing pad outline)
    ctx.strokeStyle = `rgba(${colors.accentRgb}, 0.15)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w/2, h/2, 80 * altScale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(${colors.accentRgb}, 0.015)`;
    ctx.fill();

    // H mark
    ctx.font = `bold ${Math.floor(40 * altScale)}px 'Outfit', sans-serif`;
    ctx.fillStyle = `rgba(${colors.accentRgb}, 0.15)`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', w/2, h/2);

    // Crosshairs
    ctx.strokeStyle = `rgba(${colors.accentRgb}, 0.35)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w/2 - 20, h/2); ctx.lineTo(w/2 + 20, h/2);
    ctx.moveTo(w/2, h/2 - 20); ctx.lineTo(w/2, h/2 + 20);
    ctx.stroke();

    // Scan lines
    ctx.fillStyle = `rgba(${colors.accentRgb}, 0.025)`;
    ctx.fillRect(0, this.scanLineY, w, 2);

    // Draw tracked object bounding boxes
    const hasObjects = vision?.data?.objects && vision.data.objects.length > 0;
    let safeToLand = true;

    if (hasObjects) {
      vision.data.objects.forEach(obj => {
        const scaleX = w / 1280;
        const scaleY = h / 720;
        const bx = obj.bbox_x * scaleX;
        const by = obj.bbox_y * scaleY;
        const bw = obj.bbox_w * scaleX;
        const bh = obj.bbox_h * scaleY;

        const isObstacle = obj.label === 'forklift' || obj.label === 'person';
        if (isObstacle) safeToLand = false;

        // Draw bbox border
        ctx.strokeStyle = isObstacle ? colors.danger : colors.info;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Fill glow
        ctx.fillStyle = isObstacle ? 'rgba(185, 28, 28, 0.05)' : 'rgba(29, 78, 216, 0.05)';
        ctx.fillRect(bx, by, bw, bh);

        // Draw tags
        ctx.fillStyle = isObstacle ? colors.danger : colors.info;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${obj.label.toUpperCase()} [${Math.floor(obj.confidence * 100)}%]`, bx, by - 4);

        // Bounding box brackets
        ctx.beginPath();
        ctx.moveTo(bx, by + 15); ctx.lineTo(bx, by); ctx.lineTo(bx + 15, by);
        ctx.moveTo(bx + bw, by + 15); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - 15, by);
        ctx.moveTo(bx, by + bh - 15); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + 15, by + bh);
        ctx.moveTo(bx + bw, by + bh - 15); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw - 15, by + bh);
        ctx.stroke();
      });
    }

    // Safety Circle Overlay
    ctx.strokeStyle = safeToLand ? colors.accent : colors.danger;
    ctx.beginPath();
    ctx.arc(w/2, h/2, 100 * altScale, 0, Math.PI * 2);
    ctx.stroke();

    // Text status overlay
    ctx.fillStyle = safeToLand ? colors.accent : colors.danger;
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(
      safeToLand ? "DESCENT SEGMENT: CLEAR" : "HAZARD RANGE ALERT: LANDING DELAYED",
      w/2,
      h - 30
    );

    // Top UI telemetry panel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(10, 10, 240, 95);
    ctx.strokeStyle = colors.borderColor;
    ctx.strokeRect(10, 10, 240, 95);

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`ALTITUDE : ${alt.toFixed(1)} m`, 20, 30);
    ctx.fillText(`VELOCITY : ${(spatial?.data?.speed_ms || 0).toFixed(1)} m/s`, 20, 48);
    ctx.fillText(`WIND     : ${(environmental?.data?.wind_speed_knots || 0).toFixed(1)} kn`, 20, 66);
    
    const bat = interoception?.data?.battery_pct || 100;
    ctx.fillStyle = bat < 25 ? colors.danger : colors.textPrimary;
    ctx.fillText(`BATTERY  : ${bat}%`, 20, 84);
  }

  /**
   * Helper: Draws flight wireframe warehouse background
   */
  _drawSimulatedWarehouseBackdrop(ctx, w, h, altScale) {
    const colors = this._getThemeColors();
    ctx.strokeStyle = `rgba(${colors.accentRgb}, 0.08)`;
    ctx.lineWidth = 1.5;

    const time = Date.now();
    const driftX = Math.sin(time / 4000) * 80 * altScale;
    const cx = w / 2 + driftX;

    const corridorWidth = 160 * altScale;

    // Draw main corridor lines
    ctx.beginPath();
    ctx.moveTo(cx - corridorWidth, 0);
    ctx.lineTo(cx - corridorWidth, h);
    ctx.moveTo(cx + corridorWidth, 0);
    ctx.lineTo(cx + corridorWidth, h);
    ctx.stroke();

    // Side shelves shading
    ctx.fillStyle = `rgba(${colors.accentRgb}, 0.015)`;
    ctx.fillRect(0, 0, cx - corridorWidth, h);
    ctx.fillRect(cx + corridorWidth, 0, w - (cx + corridorWidth), h);

    // Shelves separators / storage cells
    ctx.strokeStyle = `rgba(${colors.accentRgb}, 0.035)`;
    ctx.lineWidth = 1;
    const segmentY = 120 * altScale;
    const scrollY = (time / 20) % segmentY;

    for (let y = -segmentY; y < h + segmentY; y += segmentY) {
      const drawY = y + scrollY;
      ctx.beginPath();
      ctx.moveTo(0, drawY);
      ctx.lineTo(cx - corridorWidth, drawY);
      ctx.moveTo(cx + corridorWidth, drawY);
      ctx.lineTo(w, drawY);
      ctx.stroke();

      // Draw crates outlines on shelves
      ctx.strokeRect(cx - corridorWidth - 45 * altScale, drawY + 10, 30 * altScale, 40 * altScale);
      ctx.strokeRect(cx - corridorWidth - 85 * altScale, drawY + 50, 25 * altScale, 30 * altScale);

      ctx.strokeRect(cx + corridorWidth + 15 * altScale, drawY + 20, 35 * altScale, 45 * altScale);
      ctx.strokeRect(cx + corridorWidth + 60 * altScale, drawY + 60, 20 * altScale, 20 * altScale);
    }
  }
}

window.AegisSimulator = AegisSimulator;
