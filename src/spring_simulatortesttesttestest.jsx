import { useRef, useEffect, useState, useCallback } from "react";

// ── Fixed design resolution (PhET approach) ──
const BASE_W = 1280;
const BASE_H = 720;

// ── Physics constants (from user's code) ──
const ANCHOR_X    = 480;
const ANCHOR_Y    = 30;
const REST_LENGTH = 140;
const BLOCK_W     = 80;
const BLOCK_H     = 80;
const GRAVITY     = 980;
const DT          = 1 / 60;

// ─────────────────────────────────────────────
//  Canvas drawing helpers (user's originals)
// ─────────────────────────────────────────────
function drawSpring(ctx, x, topY, bottomY, k) {
  const t         = (k - 1) / (10 - 1);
  const coils     = Math.round(12 - t * 6);
  const amplitude = 15 + t * 35;
  const thickness = 2 + t * 4;
  const segH      = (bottomY - topY) / (coils + 1);

  ctx.beginPath();
  ctx.moveTo(x, topY);
  for (let i = 0; i <= coils; i++) {
    const yMid  = topY + segH * (i + 0.5);
    const xOff  = (i % 2 === 0) ? amplitude : -amplitude;
    const yNext = topY + segH * (i + 1);
    ctx.quadraticCurveTo(x + xOff, yMid, x, yNext);
  }
  const grad = ctx.createLinearGradient(x - amplitude, topY, x + amplitude, bottomY);
  grad.addColorStop(0,   "#888");
  grad.addColorStop(0.5, "#5a6070");
  grad.addColorStop(1,   "#bbb");
  ctx.strokeStyle = grad;
  ctx.lineWidth   = thickness;
  ctx.lineJoin    = "round";
  ctx.lineCap     = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - thickness / 2, topY);
  for (let i = 0; i <= coils; i++) {
    const yMid  = topY + segH * (i + 0.5);
    const xOff  = (i % 2 === 0) ? amplitude * 0.6 : -amplitude * 0.6;
    const yNext = topY + segH * (i + 1);
    ctx.quadraticCurveTo(x - thickness / 2 + xOff, yMid, x - thickness / 2, yNext);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth   = 1;
  ctx.stroke();
}

function drawBlock(ctx, blockX, blockY, isDragging, massKg) {
  const size      = 40 + ((massKg - 0.05) / (0.3 - 0.05)) * 50;
  const w = size, h = size;
  const centeredX = blockX + (BLOCK_W - w) / 2;

  const gradient = ctx.createLinearGradient(centeredX, blockY, centeredX + w, blockY);
  if (isDragging) {
    gradient.addColorStop(0,   "#fff1c1");
    gradient.addColorStop(0.2, "#facc7a");
    gradient.addColorStop(0.5, "#f59e0b");
    gradient.addColorStop(1,   "#ea8c00");
  } else {
    gradient.addColorStop(0,    "#ffe8b5");
    gradient.addColorStop(0.25, "#fbc87c");
    gradient.addColorStop(0.55, "#f59e0b");
    gradient.addColorStop(1,    "#d97706");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(centeredX, blockY, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(centeredX, blockY, w, h, 6);
  ctx.stroke();

  ctx.fillStyle    = "rgba(0,0,0,0.85)";
  ctx.font         = `bold ${Math.round((10 + size / 10) / 1.25)}px system-ui`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${(massKg * 1000).toFixed(0)}g`, centeredX + w / 2, blockY + h / 2);
}

function drawCeilingBracket(ctx) {
  const w = 110, h = 20;
  const x = ANCHOR_X - w / 2;
  const y = ANCHOR_Y - h;

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0,   "#1e3a8a");
  grad.addColorStop(0.5, "#2563eb");
  grad.addColorStop(1,   "#3b82f6");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth   = 1;
  for (let i = 0; i < 9; i++) {
    const hx = x + 4 + i * 13;
    ctx.beginPath();
    ctx.moveTo(hx, y);
    ctx.lineTo(hx - 8, ANCHOR_Y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(x, ANCHOR_Y);
  ctx.lineTo(x + w, ANCHOR_Y);
  ctx.stroke();
}

function drawArrow(ctx, x, fromY, toY) {
  const dir   = Math.sign(toY - fromY);
  const color = dir > 0 ? "#ef4444" : "#22c55e";
  const ah    = 10;

  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = "round";

  ctx.beginPath();
  ctx.moveTo(x, fromY);
  ctx.lineTo(x, toY - dir * ah);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x,     toY);
  ctx.lineTo(x - 7, toY - dir * ah);
  ctx.lineTo(x + 7, toY - dir * ah);
  ctx.closePath();
  ctx.fill();

  const mid  = (fromY + toY) / 2;
  const disp = Math.abs(toY - fromY);
  ctx.font         = "bold 11px monospace";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = color;
  ctx.fillText(`${(disp / GRAVITY * 100).toFixed(1)} cm`, x + 12, mid);
}

function drawScene(ctx, cw, ch, blockY, isDragging, k, mass, showEqLine, showArrow) {
  ctx.clearRect(0, 0, cw, ch);

  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, "#f0f4f8");
  bg.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 10);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 10);
  ctx.stroke();

  ctx.fillStyle = "rgba(148,163,184,0.22)";
  for (let y = 18; y < ch; y += 24) {
    for (let x = 18; x < cw; x += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCeilingBracket(ctx);
  drawSpring(ctx, ANCHOR_X, ANCHOR_Y, blockY, k);

  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(ANCHOR_X, blockY, 5, 0, Math.PI * 2);
  ctx.fill();

  if (showEqLine) {
    const size          = 40 + ((mass - 0.05) / (0.3 - 0.05)) * 50;
    const eqY           = ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / k;
    const centerOfBlock = eqY + size / 2;
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = "rgba(234,179,8,0.85)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(50, centerOfBlock);
    ctx.lineTo(cw - 50, centerOfBlock);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font         = "11px system-ui";
    ctx.fillStyle    = "rgba(161,120,0,0.9)";
    ctx.textAlign    = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("рівновага", 56, centerOfBlock - 3);
  }

  if (showArrow) {
    const size      = 40 + ((mass - 0.05) / (0.3 - 0.05)) * 50;
    const eqY       = ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / k;
    const eqCenter  = eqY + size / 2;
    const blockCenter = blockY + size / 2;
    if (Math.abs(blockCenter - eqCenter) > 8) {
      drawArrow(ctx, ANCHOR_X + BLOCK_W / 2 + 24, eqCenter, blockCenter);
    }
  }

  drawBlock(ctx, ANCHOR_X - BLOCK_W / 2, blockY, isDragging, mass);

  if (isDragging) {
    ctx.fillStyle    = "rgba(100,60,0,0.55)";
    ctx.font         = "11px system-ui";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText("відпустіть щоб запустити", ANCHOR_X, blockY + BLOCK_H + 12);
  }
}

// ─────────────────────────────────────────────
//  Root — PhET-style uniform scaling
// ─────────────────────────────────────────────
export default function App() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      overflow: "hidden", background: "#d1d5db",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: BASE_W, height: BASE_H,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        flexShrink: 0,
      }}>
        <Simulator />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Simulator
// ─────────────────────────────────────────────
function Simulator() {
  const canvasRef = useRef(null);

  const [stiffness,  setStiffness]  = useState(5);
  const [mass,       setMass]       = useState(0.1);
  const [showEqLine, setShowEqLine] = useState(true);
  const [showArrow,  setShowArrow]  = useState(true);

  const stiffnessRef  = useRef(stiffness);
  const massRef       = useRef(mass);
  const showEqLineRef = useRef(showEqLine);
  const showArrowRef  = useRef(showArrow);
  const posYRef       = useRef(ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / stiffness);
  const velYRef       = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => { stiffnessRef.current  = stiffness;  }, [stiffness]);
  useEffect(() => { massRef.current       = mass;       }, [mass]);
  useEffect(() => { showEqLineRef.current = showEqLine; }, [showEqLine]);
  useEffect(() => { showArrowRef.current  = showArrow;  }, [showArrow]);

  const resetSpring = useCallback(() => {
    posYRef.current = ANCHOR_Y + REST_LENGTH + (massRef.current * GRAVITY) / stiffnessRef.current;
    velYRef.current = 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const CW = canvas.width, CH = canvas.height;

    function getMouseY(e) {
      const r = canvas.getBoundingClientRect();
      return (e.clientY - r.top) * (CH / r.height);
    }
    function getMouseX(e) {
      const r = canvas.getBoundingClientRect();
      return (e.clientX - r.left) * (CW / r.width);
    }
    function isOverBlock(mx, my) {
      const m    = massRef.current;
      const size = 40 + ((m - 0.05) / (0.3 - 0.05)) * 50;
      const bx   = ANCHOR_X - BLOCK_W / 2 + (BLOCK_W - size) / 2;
      return my >= posYRef.current - 10 && my <= posYRef.current + size + 10
          && mx >= bx - 10 && mx <= bx + size + 10;
    }
    function onMouseDown(e) {
      if (isOverBlock(getMouseX(e), getMouseY(e))) {
        isDraggingRef.current = true;
        canvas.style.cursor   = "grabbing";
      }
    }
    function onMouseMove(e) {
      const my = getMouseY(e), mx = getMouseX(e);
      if (!isDraggingRef.current) {
        canvas.style.cursor = isOverBlock(mx, my) ? "grab" : "default";
        return;
      }
      posYRef.current = my - BLOCK_H / 2;
      velYRef.current = 0;
    }
    function onMouseUp() {
      isDraggingRef.current = false;
      canvas.style.cursor   = "default";
    }

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);

    let animId;
    function animate() {
      if (!isDraggingRef.current) {
        const k       = stiffnessRef.current;
        const m       = massRef.current;
        const stretch = posYRef.current - ANCHOR_Y - REST_LENGTH;
        const accY    = ((-k * stretch) + m * GRAVITY) / m;
        velYRef.current += accY * DT;
        velYRef.current *= 0.996;
        posYRef.current += velYRef.current * DT;
      }
      drawScene(
        ctx, CW, CH,
        posYRef.current, isDraggingRef.current,
        stiffnessRef.current, massRef.current,
        showEqLineRef.current, showArrowRef.current
      );
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
    };
  }, []);

  const CANVAS_W = BASE_W - 230 * 2 - 10 * 4;
  const CANVAS_H = BASE_H - 44 - 20;

  return (
    <div style={{
      width: BASE_W, height: BASE_H,
      background: "#e2e8f0",
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
    }}>
      <header style={{
        height: 44, padding: "0 20px", flexShrink: 0,
        background: "#fff", borderBottom: "1px solid #d1d5db",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111" }}>
          Маси &amp; Пружини
        </h1>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>— симулятор коливань</span>
      </header>

      <div style={{
        flex: 1, display: "flex", gap: 10, padding: 10,
        overflow: "hidden", alignItems: "stretch",
      }}>
        {/* LEFT PANEL */}
        <aside style={panelStyle}>
          <Label>Про симулятор</Label>
          <p style={bodyText}>
            Модель пружинного маятника на основі закону Гука. Система враховує
            силу тяжіння, пружну силу та невелике затухання.
          </p>
          <Divider />
          <Label>Формули</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { name: "Сила пружини", val: "F = −k · x" },
              { name: "Рівновага",    val: "x₀ = mg / k" },
              { name: "Період",       val: "T = 2π√(m/k)" },
              { name: "Частота",      val: "f = 1 / T" },
            ].map(({ name, val }) => (
              <div key={name} style={{
                padding: "7px 10px",
                background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7,
              }}>
                <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>{name}</div>
                <div style={{ fontSize: 12, color: "#111", fontFamily: "monospace", fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
          <Divider />
          <Label>Підказка</Label>
          <p style={bodyText}>
            Перетягніть блок мишею щоб змістити пружину. Відпустіть — система
            почне коливатись.
          </p>
        </aside>

        {/* CANVAS */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: "100%", height: "100%", display: "block", borderRadius: 10 }}
          />
        </div>

        {/* RIGHT PANEL */}
        <aside style={panelStyle}>
          <div>
            <Label>Жорсткість (k)</Label>
            <div style={{ textAlign: "center", margin: "4px 0 8px" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#111" }}>{stiffness}</span>
              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>N/m</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={stiffness}
              onChange={e => { setStiffness(Number(e.target.value)); resetSpring(); }}
              style={{ width: "100%", cursor: "pointer", accentColor: "#374151" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={hint}>м'яка</span><span style={hint}>жорстка</span>
            </div>
          </div>

          <Divider />

          <div>
            <Label>Маса (m)</Label>
            <div style={{ textAlign: "center", margin: "4px 0 8px" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#111" }}>{Math.round(mass * 1000)}</span>
              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>g</span>
            </div>
            <input type="range" min={0.05} max={0.3} step={0.01} value={mass}
              onChange={e => { setMass(Number(e.target.value)); resetSpring(); }}
              style={{ width: "100%", cursor: "pointer", accentColor: "#374151" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={hint}>50 g</span><span style={hint}>300 g</span>
            </div>
          </div>

          <Divider />

          <div>
            <Label>Лінія рівноваги</Label>
            <ToggleButton active={showEqLine} onToggle={() => setShowEqLine(v => !v)} />
          </div>

          <Divider />

          <div>
            <Label>Стрілка зміщення</Label>
            <ToggleButton active={showArrow} onToggle={() => setShowArrow(v => !v)} />
          </div>

          <Divider />

          <div>
            <Label>Позиція</Label>
            <button
              onClick={resetSpring}
              style={resetBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}
            >
              Скинути
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── UI atoms ──
function ToggleButton({ active, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width: "100%", padding: "8px", borderRadius: 7,
      border: "1px solid #d1d5db",
      background: active ? "#111" : "#f9fafb",
      color: active ? "#fff" : "#6b7280",
      cursor: "pointer", fontSize: 12, fontWeight: 500,
      fontFamily: "system-ui, sans-serif", transition: "all 0.15s",
    }}>
      {active ? "Увімкнено" : "Вимкнено"}
    </button>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: "#9ca3af",
      textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8,
    }}>{children}</div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#e5e7eb" }} />;
}

const panelStyle = {
  width: 230, flexShrink: 0,
  background: "#fff", border: "1px solid #d1d5db",
  borderRadius: 10, padding: 16,
  display: "flex", flexDirection: "column", gap: 14,
  overflowY: "auto",
};

const bodyText = { margin: 0, fontSize: 12, color: "#4b5563", lineHeight: 1.7 };
const hint     = { fontSize: 10, color: "#9ca3af" };
const resetBtnStyle = {
  width: "100%", padding: "8px", borderRadius: 7,
  border: "1px solid #d1d5db", background: "#f9fafb",
  color: "#374151", cursor: "pointer", fontSize: 12,
  fontWeight: 500, fontFamily: "system-ui, sans-serif",
};
