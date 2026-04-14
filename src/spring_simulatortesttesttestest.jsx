import { useRef, useEffect, useState, useCallback } from "react";

const BASE_W = 1280;
const BASE_H = 720;
const ANCHOR_X = 345;
const ANCHOR_Y = 30;
const REST_LENGTH = 200;
const BLOCK_W = 80;
const BLOCK_H = 80;
const GRAVITY = 980;
const DT = 1 / 70;

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function drawSpring(ctx, x, topY, bottomY, k) {
  const t = (k - 1) / 9;
  const coils = Math.round(12 - t * 6);
  const amplitude = 20 + t * 40;
  const thickness = 2 + t * 4;
  const segH = (bottomY - topY) / (coils + 1);
  ctx.beginPath();
  ctx.moveTo(x, topY);
  for (let i = 0; i <= coils; i++) {
    const yMid = topY + segH * (i + 0.5);
    const xOff = (i % 2 === 0) ? amplitude : -amplitude;
    ctx.quadraticCurveTo(x + xOff, yMid, x, topY + segH * (i + 1));
  }
  const grad = ctx.createLinearGradient(x - amplitude, topY, x + amplitude, bottomY);
  grad.addColorStop(0, "#888"); grad.addColorStop(0.5, "#5a6070"); grad.addColorStop(1, "#bbb");
  ctx.strokeStyle = grad; ctx.lineWidth = thickness; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - thickness / 2, topY);
  for (let i = 0; i <= coils; i++) {
    const yMid = topY + segH * (i + 0.5);
    const xOff = (i % 2 === 0) ? amplitude * 0.6 : -amplitude * 0.6;
    ctx.quadraticCurveTo(x - thickness / 2 + xOff, yMid, x - thickness / 2, topY + segH * (i + 1));
  }
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.stroke();
}

function drawBlock(ctx, blockX, blockY, isDragging, massKg) {
  const size = 40 + ((massKg - 0.05) / 0.25) * 50;
  const centeredX = blockX + (BLOCK_W - size) / 2;
  const grad = ctx.createLinearGradient(centeredX, blockY, centeredX + size, blockY);
  if (isDragging) {
    grad.addColorStop(0, "#fff1c1"); grad.addColorStop(0.2, "#facc7a");
    grad.addColorStop(0.5, "#f59e0b"); grad.addColorStop(1, "#ea8c00");
  } else {
    grad.addColorStop(0, "#ffe8b5"); grad.addColorStop(0.25, "#fbc87c");
    grad.addColorStop(0.55, "#f59e0b"); grad.addColorStop(1, "#d97706");
  }
  ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(centeredX, blockY, size, size, 6); ctx.fill();
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(centeredX, blockY, size, size, 6); ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.font = `${Math.round((10 + size / 10) / 1.25)}px system-ui`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${(massKg * 1000).toFixed(0)}g`, centeredX + size / 2, blockY + size / 2);
}

function drawCeilingBracket(ctx) {
  const w = 160, h = 32, x = ANCHOR_X - 80, y = ANCHOR_Y - h;
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#1a2a4a"); bg.addColorStop(0.3, "#1e3a8a");
  bg.addColorStop(0.7, "#1d4ed8"); bg.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.97)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + .5, y + .5, w - 1, h - 1, 6); ctx.stroke();
  const rg = ctx.createLinearGradient(x, y + h / 2 - 2, x, y + h / 2 + 2);
  rg.addColorStop(0, "rgba(255,255,255,0.18)"); rg.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = rg; ctx.fillRect(x + 8, y + h / 2 - 2, w - 16, 4);
  const sg = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  sg.addColorStop(0, "rgba(255,255,255,0.22)"); sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h * 0.45, [5, 5, 0, 0]); ctx.fill();
  [[x + 12, y + h / 2], [x + w - 12, y + h / 2]].forEach(([bx, by]) => {
    ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fillStyle = "#0f1f4a"; ctx.fill();
    ctx.strokeStyle = "rgba(120,160,255,0.5)"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    const bg2 = ctx.createRadialGradient(bx - .8, by - .8, .5, bx, by, 2.5);
    bg2.addColorStop(0, "#7aa4f0"); bg2.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = bg2; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx - 1.5, by); ctx.lineTo(bx + 1.5, by);
    ctx.moveTo(bx, by - 1.5); ctx.lineTo(bx, by + 1.5); ctx.stroke();
  });
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const nx = x + 24 + i * (w - 48) / 9;
    ctx.beginPath(); ctx.moveTo(nx, y + 5); ctx.lineTo(nx, y + h - 5); ctx.stroke();
  }
  const tg = ctx.createLinearGradient(ANCHOR_X - 12, y + h, ANCHOR_X - 12, y + h + 8);
  tg.addColorStop(0, "#1d4ed8"); tg.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = tg; ctx.beginPath(); ctx.roundRect(ANCHOR_X - 12, y + h, 24, 8, [0, 0, 4, 4]); ctx.fill();
  ctx.strokeStyle = "rgba(99,140,255,0.4)"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(ANCHOR_X - 12, y + h, 24, 8, [0, 0, 4, 4]); ctx.stroke();
  ctx.beginPath(); ctx.arc(ANCHOR_X, ANCHOR_Y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = "#0a1630"; ctx.fill();
  ctx.strokeStyle = "rgba(120,160,255,0.7)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(ANCHOR_X - 1, ANCHOR_Y - 1, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(180,210,255,0.6)"; ctx.fill();
}

function drawArrow(ctx, x, fromY, toY) {
  const dir = Math.sign(toY - fromY);
  const color = dir > 0 ? "#ef4444" : "#22c55e";
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, fromY); ctx.lineTo(x, toY - dir * 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, toY); ctx.lineTo(x - 7, toY - dir * 10); ctx.lineTo(x + 7, toY - dir * 10);
  ctx.closePath(); ctx.fill();
}

// ─── PAUSE overlay drawn on canvas ───────────────────────────────────────────
function drawPauseOverlay(ctx, cw, ch) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
  ctx.beginPath(); ctx.roundRect(0, 0, cw, ch, 10); ctx.fill();
  // PAUSED badge top-center
  const bw = 90, bh = 28, bx = cw / 2 - bw / 2, by = 14;
  ctx.fillStyle = "rgba(15,23,42,0.72)";
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("⏸ PAUSED", cw / 2, by + bh / 2);
}
// //////////sa/d/asd/sad/as/dsa/d/sad/sa/da/sd/asd/sa/das/d/asd/as/da/d/asd/as/das/das/d/dsada
function drawScene(ctx, cw, ch, blockY, velY, isDragging, k, mass, showEqLine, showVelArrow, isPaused) {
  ctx.clearRect(0, 0, cw, ch);
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, "#f0f4f8"); bg.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0, 0, cw, ch, 10); ctx.fill();
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(0, 0, cw, ch, 10); ctx.stroke();
  ctx.fillStyle = "rgba(148,163,184,0.22)";
  for (let y = 18; y < ch; y += 24)
    for (let x = 18; x < cw; x += 24) {
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }
  drawCeilingBracket(ctx);
  drawSpring(ctx, ANCHOR_X, ANCHOR_Y, blockY, k);
  ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(ANCHOR_X, blockY, 5, 0, Math.PI * 2); ctx.fill();
  if (showEqLine) {
    const size = 40 + ((mass - 0.05) / 0.25) * 50;
    const eqY = ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / k;
    const cy = eqY + size / 2;
    ctx.setLineDash([14, 12]); ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(210, cy); ctx.lineTo(cw - 210, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "11px system-ui"; ctx.fillStyle = "rgba(2,1,0,0.9)";
    ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("eq.", 210, cy - 3);
  }
  if (showVelArrow) {
    const size = 40 + ((mass - 0.05) / 0.25) * 50;
    const cy = blockY + size / 2;
    const len = velY * 0.15;
    if (Math.abs(len) > 6) drawArrow(ctx, ANCHOR_X + BLOCK_W / 2 + 24, cy, cy + len);
  }
  drawBlock(ctx, ANCHOR_X - BLOCK_W / 2, blockY, isDragging, mass);
  if (isDragging) {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.font = "11px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("release to start", ANCHOR_X, blockY + BLOCK_H - 10);
  }
  if (isPaused) drawPauseOverlay(ctx, cw, ch);
}

// ─── Energy Bar Chart ─────────────────────────────────────────────────────────
function EnergyChart({ energyVals, damped }) {
  const { ke, pe, total, heat, ceiling } = energyVals;
  const scale = Math.max(ceiling, 1);

  const bars = damped
    ? [
        { label: "Kinetic", value: ke,    color: "#3b82f6" },
        { label: "Potential", value: pe,  color: "#eab308" },
        { label: "Mechanical", value: total, color: "#22c55e" },
        { label: "Heat",    value: heat,  color: "#ef4444" },
      ]
    : [
        { label: "Kinetic",    value: ke,    color: "#3b82f6" },
        { label: "Potential",  value: pe,    color: "#eab308" },
        { label: "Mechanical", value: total, color: "#22c55e" },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Bars row */}
      <div style={{ flex: 1, display: "flex", gap: damped ? 5 : 8, alignItems: "flex-end", minHeight: 0 }}>
        {bars.map(({ label, value, color }) => {
          const pct = Math.min(100, Math.max(1, (value / scale) * 100));
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ flex: 1 }} />
              <div style={{
                width: "100%",
                height: `${pct}%`,
                backgroundColor: color,
                borderRadius: "4px 4px 0 0",
                transition: "height 0.10s ease-out",
                minHeight: 2,
                boxShadow: `0 2px 6px ${color}44`,
              }} />
              {/* baseline */}
              <div style={{ width: "100%", height: 1, backgroundColor: "#d1d5db", flexShrink: 0 }} />
            </div>
          );
        })}
      </div>

      {/* Color swatches + labels */}
      <div style={{ display: "flex", gap: damped ? 5 : 8, marginTop: 6, flexShrink: 0 }}>
        {bars.map(({ label, color }) => (
          <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: 3, borderRadius: 2, background: color, opacity: 0.75 }} />
            <div style={{
              fontSize: damped ? 8 : 9,
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.25,
              fontWeight: 500,
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const fn = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    fn(); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);
  const scale = Math.min(viewport.w / BASE_W, viewport.h / BASE_H);
  const ox = Math.round((viewport.w - BASE_W * scale) / 2);
  const oy = Math.round((viewport.h - BASE_H * scale) / 2);
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#e2e8f0", position: "relative" }}>
      <div style={{ position: "absolute", top: oy, left: ox, width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Simulator />
      </div>
    </div>
  );
}

// ─── Simulator ────────────────────────────────────────────────────────────────
function Simulator() {
  const canvasRef = useRef(null);

  const [stiffness, setStiffness]   = useState(5);
  const [mass, setMass]             = useState(0.1);
  const [showEqLine, setShowEqLine] = useState(true);
  const [showArrow, setShowArrow]   = useState(true);
  const [damped, setDamped]         = useState(true);
  const [slowMo, setSlowMo]         = useState(false);
  const [paused, setPaused]         = useState(false);

  const [energyVals, setEnergyVals] = useState({ ke: 0, pe: 0, total: 0, heat: 0, ceiling: 1 });

  const stiffRef   = useRef(stiffness);
  const massRef    = useRef(mass);
  const eqLineRef  = useRef(showEqLine);
  const arrowRef   = useRef(showArrow);
  const dampedRef  = useRef(damped);
  const slowMoRef  = useRef(slowMo);
  const pausedRef  = useRef(paused);  // ← ref for rAF loop to read without stale closure

  const posYRef     = useRef(ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / stiffness);
  const velYRef     = useRef(0);
  const draggingRef = useRef(false);

  const initERef   = useRef(null);
  const heatRef    = useRef(0);
  const ceilRef    = useRef(1);
  const frameRef   = useRef(0);

  useEffect(() => { stiffRef.current  = stiffness; }, [stiffness]);
  useEffect(() => { massRef.current   = mass; },      [mass]);
  useEffect(() => { eqLineRef.current = showEqLine; },[showEqLine]);
  useEffect(() => { arrowRef.current  = showArrow; }, [showArrow]);
  useEffect(() => { dampedRef.current = damped; },    [damped]);
  useEffect(() => { slowMoRef.current = slowMo; },    [slowMo]);
  useEffect(() => { pausedRef.current = paused; },    [paused]);

  // When damping mode changes, reset heat accounting
  useEffect(() => { initERef.current = null; heatRef.current = 0; }, [damped]);

  const resetSpring = useCallback(() => {
    posYRef.current  = ANCHOR_Y + REST_LENGTH + (massRef.current * GRAVITY) / stiffRef.current;
    velYRef.current  = 0;
    initERef.current = null;
    heatRef.current  = 0;
    ceilRef.current  = 1;
    setEnergyVals({ ke: 0, pe: 0, total: 0, heat: 0, ceiling: 1 });
  }, []);

  // Toggle pause — keeps all physics state intact
  const togglePause = useCallback(() => {
    setPaused(v => !v);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const CW = canvas.width, CH = canvas.height;

    const getY = e => { const r = canvas.getBoundingClientRect(); return (e.clientY - r.top)  * (CH / r.height); };
    const getX = e => { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) * (CW / r.width); };

    const overBlock = (mx, my) => {
      const s  = 40 + ((massRef.current - 0.05) / 0.25) * 50;
      const bx = ANCHOR_X - BLOCK_W / 2 + (BLOCK_W - s) / 2;
      return my >= posYRef.current - 10 && my <= posYRef.current + s + 10
          && mx >= bx - 10 && mx <= bx + s + 10;
    };

    const onDown = e => {
      if (!pausedRef.current && overBlock(getX(e), getY(e))) {
        draggingRef.current = true;
        canvas.style.cursor = "grabbing";
      }
    };
    const onMove = e => {
      const mx = getX(e), my = getY(e);
      if (!draggingRef.current) {
        canvas.style.cursor = (!pausedRef.current && overBlock(mx, my)) ? "grab" : "default";
        return;
      }
      posYRef.current = my - BLOCK_H / 2;
      velYRef.current = 0;
    };
    const onUp = () => {
      if (draggingRef.current) {
        // Recalibrate initial energy on release
        const k = stiffRef.current, m = massRef.current;
        const eqY = ANCHOR_Y + REST_LENGTH + (m * GRAVITY) / k;
        const disp = posYRef.current - eqY;
        const ke = 0.5 * m * 0 * 0;
        const pe = 0.5 * k * disp * disp;
        initERef.current = ke + pe;
        heatRef.current  = 0;
        ceilRef.current  = Math.max(ceilRef.current, initERef.current);
      }
      draggingRef.current = false;
      canvas.style.cursor = "default";
    };

    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onUp);

    let animId;
    function animate() {
      const isPaused = pausedRef.current;

      // Only advance physics when not paused and not dragging
      if (!isPaused && !draggingRef.current) {
        const dt = slowMoRef.current ? DT * 0.25 : DT;
        const k  = stiffRef.current, m = massRef.current;
        const stretch = posYRef.current - ANCHOR_Y - REST_LENGTH;
        velYRef.current += ((-k * stretch + m * GRAVITY) / m) * dt;
        if (dampedRef.current) velYRef.current *= 0.996;
        posYRef.current += velYRef.current * dt;
      }

      // Always compute energies (so they update live even while paused/dragging)
      {
        const k = stiffRef.current, m = massRef.current;
        const eqY = ANCHOR_Y + REST_LENGTH + (m * GRAVITY) / k;
        const disp = posYRef.current - eqY;
        const ke = 0.5 * m * velYRef.current * velYRef.current;
        const pe = 0.5 * k * disp * disp;
        const mechanical = ke + pe;

        if (initERef.current === null && mechanical > 5) {
          initERef.current = mechanical;
          heatRef.current  = 0;
        }
        if (dampedRef.current && initERef.current !== null) {
          heatRef.current = Math.max(0, initERef.current - mechanical);
        }
        const ceil = Math.max(ceilRef.current, initERef.current ?? mechanical, mechanical);
        ceilRef.current = ceil;

        frameRef.current++;
        if (frameRef.current % 3 === 0) {
          setEnergyVals({
            ke:      Math.max(0, ke),
            pe:      Math.max(0, pe),
            total:   Math.max(0, mechanical),
            heat:    dampedRef.current ? Math.max(0, heatRef.current) : 0,
            ceiling: Math.max(ceil, 1),
          });
        }
      }

      drawScene(
        ctx, CW, CH,
        posYRef.current, velYRef.current, draggingRef.current,
        stiffRef.current, massRef.current,
        eqLineRef.current, arrowRef.current,
        isPaused,
      );
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onUp);
    };
  }, []);

  // ── Period / frequency ──────────────────────────────────────────────────────
  const C_COEFF  = 0.3;
  const b        = C_COEFF / (2 * mass);
  const omega0sq = stiffness / mass;
  const omegaDsq = omega0sq - b * b;
  const T_un     = (2 * Math.PI) / Math.sqrt(omega0sq);
  const T_da     = omegaDsq > 0 ? (2 * Math.PI) / Math.sqrt(omegaDsq) : null;
  const T        = damped ? T_da  : T_un;
  const f        = T ? 1 / T : null;

  const LEFT_W  = 300, RIGHT_W = 230, GAP = 10, PADDING = 10, HEADER_H = 44;
  const CANVAS_W = BASE_W - LEFT_W - RIGHT_W - GAP * 4 - PADDING * 2;
  const CANVAS_H = BASE_H - HEADER_H - PADDING * 2;

  return (
    <div style={{ width: BASE_W, height: BASE_H, background: "#e2e8f0", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <header style={{ height: HEADER_H, padding: "0 20px", flexShrink: 0, background: "#fff", borderBottom: "1px solid #d1d5db", display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111" }}>Masses &amp; Springs</h1>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>— oscillation simulator</span>
      </header>

      <div style={{ flex: 1, display: "flex", gap: GAP, padding: PADDING, overflow: "hidden", alignItems: "stretch" }}>

        {/* ── LEFT PANEL ── */}
        <aside style={{ ...panelStyle, width: LEFT_W, overflow: "hidden", gap: 8 }}>
          <Label>Formulas</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>

            <FormulaRow name="Spring Force" val={damped ? "F = −k·x − c·v" : "F = −k·x"} />
            <FormulaRow name="Equilibrium"  val="x₀ = mg / k" />
            <FormulaRow
              name="Period"
              val={damped ? "T = 2π / √(k/m − b²)" : "T = 2π√(m/k)"}
              computed={T ? `${T.toFixed(3)} s` : "overdamped"}
            />
            <FormulaRow
              name="Frequency"
              val="f = 1 / T"
              computed={f ? `${f.toFixed(3)} Hz` : "—"}
            />

            {/* Damping coefficient — only when damped */}
            {damped && (
              <div style={{ padding: "5px 10px", background: "#fef9f0", border: "1px solid #fed7aa", borderRadius: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 6, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 1 }}>Damping Coeff.</div>
                  <div style={{ fontSize: 12, color: "#111", fontFamily: "monospace", fontWeight: 600 }}>b = c / (2m)</div>
                </div>
                <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#ea580c", marginLeft: 8, whiteSpace: "nowrap" }}>
                  {b.toFixed(3)} s⁻¹
                </div>
              </div>
            )}
          </div>

          <Divider />

          {/* Energy chart */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Label>Energy</Label>
            <div style={{ flex: 1, minHeight: 0 }}>
              <EnergyChart energyVals={energyVals} damped={damped} />
            </div>
          </div>
        </aside>

        {/* ── CANVAS ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", gap: 6 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: "100%", flex: 1, display: "block", borderRadius: 10 }}
          />

          {/* ── PAUSE / RESUME button — centred below canvas ── */}
          <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <button
              onClick={togglePause}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 32px",
                borderRadius: 999,
                border: paused ? "2px solid #6366f1" : "2px solid #d1d5db",
                background: paused ? "#6366f1" : "#fff",
                color: paused ? "#fff" : "#374151",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "system-ui, sans-serif",
                boxShadow: paused ? "0 0 0 4px rgba(99,102,241,0.18)" : "0 1px 4px rgba(0,0,0,0.08)",
                transition: "all 0.15s",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={e => { if (!paused) e.currentTarget.style.background = "#f3f4f6"; }}
              onMouseLeave={e => { if (!paused) e.currentTarget.style.background = "#fff"; }}
            >
              {paused ? (
                <>
                  <span style={{ fontSize: 16 }}>▶</span>
                  Resume
                </>
              ) : (
                <>
                  <span style={{ fontSize: 16 }}>⏸</span>
                  Pause
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <aside style={{ ...panelStyle, width: RIGHT_W }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <Label>Stiffness (k)</Label>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {stiffness} <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>N/m</span>
              </span>
            </div>
            <input type="range" min={1} max={10} step={1} value={stiffness}
              onChange={e => { setStiffness(Number(e.target.value)); resetSpring(); }}
              style={{ width: "100%", cursor: "pointer", accentColor: "#374151" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={hint}>soft</span><span style={hint}>hard</span>
            </div>
          </div>

          <Divider />

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <Label>Mass (m)</Label>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {Math.round(mass * 1000)} <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>g</span>
              </span>
            </div>
            <input type="range" min={0.05} max={0.3} step={0.01} value={mass}
              onChange={e => { setMass(Number(e.target.value)); resetSpring(); }}
              style={{ width: "100%", cursor: "pointer", accentColor: "#374151" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={hint}>50 g</span><span style={hint}>300 g</span>
            </div>
          </div>

          <Divider />

          <div>
            <Label>Damping</Label>
            <ToggleButton active={damped} onToggle={() => setDamped(v => !v)} small />
            <p style={{ ...bodyText, marginTop: 4, fontSize: 10, color: "#9ca3af" }}>
              {damped ? "Energy loss per cycle (realistic)" : "No energy loss — constant amplitude"}
            </p>
          </div>

          <div>
            <Label>Equilibrium</Label>
            <ToggleButton active={showEqLine} onToggle={() => setShowEqLine(v => !v)} small />
          </div>

          <Divider />

          <div>
            <Label>Velocity</Label>
            <ToggleButton active={showArrow} onToggle={() => setShowArrow(v => !v)} small />
          </div>

          <Divider />

          <div>
            <Label>Playback</Label>
            <ToggleButton active={slowMo} onToggle={() => setSlowMo(v => !v)} labelOn="0.25×" labelOff="1×" small />
          </div>

          <Divider />

          <div>
            <Label>Position</Label>
            <button onClick={resetSpring} style={resetBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}>
              Reset
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Formula row ──────────────────────────────────────────────────────────────
function FormulaRow({ name, val, computed }) {
  return (
    <div style={{ padding: "5px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 6, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 1 }}>{name}</div>
        <div style={{ fontSize: 12, color: "#111", fontFamily: "monospace", fontWeight: 600 }}>{val}</div>
      </div>
      {computed && (
        <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#0284c7", marginLeft: 8, whiteSpace: "nowrap" }}>
          {computed}
        </div>
      )}
    </div>
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function ToggleButton({ active, onToggle, labelOn = "On", labelOff = "Off", small = false }) {
  return (
    <button onClick={onToggle} style={{
      width: "100%", padding: small ? "5px" : "8px", borderRadius: 7,
      border: "1px solid #d1d5db",
      background: active ? "#111" : "#f9fafb",
      color: active ? "#fff" : "#6b7280",
      cursor: "pointer", fontSize: small ? 11 : 12, fontWeight: 500,
      fontFamily: "system-ui, sans-serif", transition: "all 0.15s",
    }}>
      {active ? labelOn : labelOff}
    </button>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Divider() { return <div style={{ height: 1, background: "#e5e7eb" }} />; }

const panelStyle = {
  flexShrink: 0, background: "#fff", border: "1px solid #d1d5db",
  borderRadius: 10, padding: 16,
  display: "flex", flexDirection: "column", gap: 14, overflowY: "auto",
};
const bodyText = { margin: 0, fontSize: 12, color: "#4b5563", lineHeight: 1.7 };
const hint     = { fontSize: 10, color: "#9ca3af" };
const resetBtnStyle = {
  width: "100%", padding: "5px", borderRadius: 7,
  border: "1px solid #d1d5db", background: "#f9fafb",
  color: "#374151", cursor: "pointer", fontSize: 11,
  fontWeight: 500, fontFamily: "system-ui, sans-serif",
};