import { useRef, useEffect, useState, useCallback } from "react";

const BASE_W = 1280;   // ширина базового вікна (px)
const BASE_H = 720;    // висота базового вікна (px)

// ────────────────────
//  ФІЗИЧНІ КОНСТАНТИ
// ────────────────────
const ANCHOR_X = 345;     // X-координата точки кріплення пружини до стелі
const ANCHOR_Y = 30;      // Y-координата точки кріплення (верх пружини)
const REST_LENGTH = 200;  // довжина пружини у стані спокою без вантажу (px ≈ см)
const BLOCK_W = 80;       // ширина «хіт-бокса» блоку (для захоплення мишею)
const BLOCK_H = 80;       // висота «хіт-бокса» блоку
const GRAVITY = 980;      // прискорення вільного падіння (px/s² → імітує 9.8 м/с²·100)
const DT = 1 / 70;        // крок часу симуляції: один кадр при 60 FPS (≈16.67 мс)

// Koeficient tlmenia simulácie (velY *= 0.996 → c_eff)
// b = c / (2m), kde c_eff zodpovedá multiplikátoru 0.996 pri 60 FPS
// c = -2m * ln(0.996) * 60 ≈ 0.4797 * m  →  b = c/(2m) ≈ 0.2398 s⁻¹
const DAMPING_COEFF = 0.996; // multiplikátor rýchlosti za krok

function drawSpring(ctx, x, topY, bottomY, k) {
  // Нормалізуємо k до діапазону [0, 1] для інтерполяції візуальних параметрів
  const t = (k - 1) / (10 - 1);

  const coils = Math.round(12 - t * 6);
  const amplitude = 20 + t * 40;
  const thickness = 2 + t * 4;
  const segH = (bottomY - topY) / (coils + 1);

  // ── Основна лінія пружини ──
  ctx.beginPath();
  ctx.moveTo(x, topY);
  for (let i = 0; i <= coils; i++) {
    const yMid  = topY + segH * (i + 0.5);
    const xOff  = (i % 2 === 0) ? amplitude : -amplitude; // чергуємо ліво/право
    const yNext = topY + segH * (i + 1);
    ctx.quadraticCurveTo(x + xOff, yMid, x, yNext);
  }

  const grad = ctx.createLinearGradient(x - amplitude, topY, x + amplitude, bottomY);
  grad.addColorStop(0,   "#888");
  grad.addColorStop(0.5, "#5a6070");
  grad.addColorStop(1,   "#bbb");
  ctx.strokeStyle = grad;
  ctx.lineWidth = thickness;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
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
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
//    blockX    — X лівого краю «хіт-бокса» (не самого блоку)
//    blockY    — Y верхнього краю блоку (поточна позиція з фізики)
//    massKg    — маса в кілограмах (0.05..0.3); визначає візуальний розмір
// ─────────────────────────────────────────────────────────────────────────────
function drawBlock(ctx, blockX, blockY, isDragging, massKg) {

  const size = 40 + ((massKg - 0.05) / (0.3 - 0.05)) * 50;
  const w = size, h = size;

  // Центруємо блок у межах хіт-бокса BLOCK_W×BLOCK_H
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

  // заливку блоку
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(centeredX, blockY, w, h, 6);
  ctx.fill();

  // рамка
  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(centeredX, blockY, w, h, 6);
  ctx.stroke();

  // Підпис маси
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.font = `${Math.round((10 + size / 10) / 1.25)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${(massKg * 1000).toFixed(0)}g`, centeredX + w / 2, blockY + h / 2);
}

function drawCeilingBracket(ctx) {

  const w = 160, h = 32;
  const x = ANCHOR_X - w / 2;
  const y = ANCHOR_Y - h;

  // Основна пластина темний металевий градієнт
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0,   "#1a2a4a");
  bodyGrad.addColorStop(0.3, "#1e3a8a");
  bodyGrad.addColorStop(0.7, "#1d4ed8");
  bodyGrad.addColorStop(1,   "#1e3a8a");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  // Зовнішня рамка
  ctx.strokeStyle = "rgba(0, 0, 0, 0.97)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 6);
  ctx.stroke();

  // Горизонтальне ребро жорсткості
  const ribY = y + h / 2 - 2;
  const ribGrad = ctx.createLinearGradient(x, ribY, x, ribY + 4);
  ribGrad.addColorStop(0, "rgba(255,255,255,0.18)");
  ribGrad.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = ribGrad;
  ctx.fillRect(x + 8, ribY, w - 16, 4);

  // Верхній відблиск
  const shineGrad = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  shineGrad.addColorStop(0, "rgba(255,255,255,0.22)");
  shineGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h * 0.45, [5, 5, 0, 0]);
  ctx.fill();

  // Болти по кутах
  const boltPositions = [
    [x + 12, y + h / 2],
    [x + w - 12, y + h / 2],
  ];
  boltPositions.forEach(([bx, by]) => {
    // Зовнішнє кільце болта
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1f4a";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,160,255,0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Внутрішня голівка болта
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    const bGrad = ctx.createRadialGradient(bx - 0.8, by - 0.8, 0.5, bx, by, 2.5);
    bGrad.addColorStop(0, "#7aa4f0");
    bGrad.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = bGrad;
    ctx.fill();

    // Хрестоподібний шліц
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx - 1.5, by);
    ctx.lineTo(bx + 1.5, by);
    ctx.moveTo(bx, by - 1.5);
    ctx.lineTo(bx, by + 1.5);
    ctx.stroke();
  });

  // Вертикальні насічки
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  const notchStart = x + 24;
  const notchEnd   = x + w - 24;
  const notchCount = 10;
  const notchStep  = (notchEnd - notchStart) / (notchCount - 1);
  for (let i = 0; i < notchCount; i++) {
    const nx = notchStart + i * notchStep;
    ctx.beginPath();
    ctx.moveTo(nx, y + 5);
    ctx.lineTo(nx, y + h - 5);
    ctx.stroke();
  }

  // Нижній опорний виступ
  const tabW = 24, tabH = 8;
  const tabX = ANCHOR_X - tabW / 2;
  const tabY = y + h;

  const tabGrad = ctx.createLinearGradient(tabX, tabY, tabX, tabY + tabH);
  tabGrad.addColorStop(0, "#1d4ed8");
  tabGrad.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = tabGrad;
  ctx.beginPath();
  ctx.roundRect(tabX, tabY, tabW, tabH, [0, 0, 4, 4]);
  ctx.fill();
  ctx.strokeStyle = "rgba(99,140,255,0.4)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(tabX, tabY, tabW, tabH, [0, 0, 4, 4]);
  ctx.stroke();

  // де пружина чіпляється
  ctx.beginPath();
  ctx.arc(ANCHOR_X, ANCHOR_Y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = "#0a1630";
  ctx.fill();
  ctx.strokeStyle = "rgba(120,160,255,0.7)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Блик на кільці
  ctx.beginPath();
  ctx.arc(ANCHOR_X - 1, ANCHOR_Y - 1, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(180,210,255,0.6)";
  ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawArrow — малює стрілку зміщення між положенням рівноваги і блоком
//  Поруч виводиться відстань у сантиметрах (перерахунок: 1 cm ≈ GRAVITY/100 px).
// ─────────────────────────────────────────────────────────────────────────────
function drawArrow(ctx, x, fromY, toY) {
  const dir = Math.sign(toY - fromY);               // +1 вниз, -1 вгору
  const color = dir > 0 ? "#ef4444" : "#22c55e";
  const ah = 10;                                    // довжина голови стрілки

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  // Лінія стрілки
  ctx.beginPath();
  ctx.moveTo(x, fromY);
  ctx.lineTo(x, toY - dir * ah);
  ctx.stroke();

  // Голова стрілки
  ctx.beginPath();
  ctx.moveTo(x, toY);
  ctx.lineTo(x - 7, toY - dir * ah);
  ctx.lineTo(x + 7, toY - dir * ah);
  ctx.closePath();
  ctx.fill();

  // // Підпис відстані
  // const mid = (fromY + toY) / 2;
  // const disp = Math.abs(toY - fromY);
  // ctx.font = "bold 11px monospace";
  // ctx.textAlign = "left";
  // ctx.textBaseline = "middle";
  // ctx.fillStyle = color;
  // ctx.fillText(`${(disp).toFixed(0)} px/s`, x + 12, mid); // відстань у чомусь 
}

// ─────────────────────────────────────────────────────────────────────────────
//  перемальовка canvas у правильному порядку 
//    1. Фон (градієнт + точковий патерн)
//    2. Кронштейн стелі
//    3. Пружина
//    4. Вузлик з'єднання (кружечок)
//    5. Лінія рівноваги (опціонально)
//    6. Стрілка зміщення (опціонально)
//    7. Блок (вантаж)
//    8. Підказка «відпустіть»
//
//    cw, ch     — ширина та висота canvas
//    blockY     — поточна Y-координата верху блоку (з фізичного стану)
//    k          — жорсткість пружини
//    mass       — маса вантажу (кг)
// ─────────────────────────────────────────────────────────────────────────────
function drawScene(ctx, cw, ch, blockY,velY, isDragging, k, mass, showEqLine, showArrow) {
  // Очищаємо весь canvas перед новим кадром
  ctx.clearRect(0, 0, cw, ch);

  // ── фоновий градієнт
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, "#f0f4f8");
  bg.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 10);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 10);
  ctx.stroke();

  // ── декоративна сітка з крапок
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

  // точка з'єднання пружини і блоку
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(ANCHOR_X, blockY, 5, 0, Math.PI * 2);
  ctx.fill();

  // пунктирна лінія рівноваги
  if (showEqLine) {
    const size = 40 + ((mass - 0.05) / (0.3 - 0.05)) * 50;      // розмір блоку
    const eqY = ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / k;  // Y верху блоку в рівновазі
    const centerOfBlock = eqY + size / 2;                       // Y центру блоку

    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(210, centerOfBlock);
    ctx.lineTo(cw - 210, centerOfBlock);
    ctx.stroke();
    ctx.setLineDash([]); // скидаємо пунктир для наступних ліній

    // Підпис «eq.» 
    ctx.font         = "11px system-ui";
    ctx.fillStyle    = "rgba(2, 1, 0, 0.9)";
    ctx.textAlign    = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("eq.", 210, centerOfBlock - 3);
  }

  // стрілка зміщення від рівноваги до поточної позиції
  // лише якщо зміщення більше за 8 px (щоб уникнути мерехтіння)
  if (showArrow) {
    const size = 40 + ((mass - 0.05) / (0.3 - 0.05)) * 50;
    const blockCenter = blockY + size / 2;
    const velScale = 0.15; // px швидкості → px стрілки
    const arrowLen = velY * velScale;
    if (Math.abs(arrowLen) > 6) {
      drawArrow(ctx, ANCHOR_X + BLOCK_W / 2 + 24, blockCenter, blockCenter + arrowLen);
    }
  }

  //блок — малюємо останнім, поверх пружини 
  drawBlock(ctx, ANCHOR_X - BLOCK_W / 2, blockY, isDragging, mass);

  // підказка під час перетягування 
  if (isDragging) {
    ctx.fillStyle    = "rgba(0, 0, 0, 0.55)";
    ctx.font         = "11px system-ui";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText("release to start", ANCHOR_X, blockY + BLOCK_H - 10);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  App — кореневий компонент, що відповідає за адаптивне масштабування під розмір вікна
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight
  });

  // Слухаємо зміну розміру вікна
  useEffect(() => {
    const update = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Рівномірне масштабування: обираємо менший коефіцієнт, щоб вміщувалось по обох осях
  const scale   = Math.min(viewport.w / BASE_W, viewport.h / BASE_H);
  const offsetX = Math.round((viewport.w - BASE_W * scale) / 2);
  const offsetY = Math.round((viewport.h - BASE_H * scale) / 2);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      overflow: "hidden",
      background: "#e2e8f0",
      position: "relative",
    }}>
      {/* Контейнер масштабування: фіксований розмір BASE_W×BASE_H, трансформований під viewport */}
      <div style={{
        position: "absolute",
        top: offsetY, left: offsetX,
        width: BASE_W, height: BASE_H,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}>
        <Simulator />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Simulator — головний компонент симулятора
//  Містить:
//    • canvas (рендер сцени через requestAnimationFrame)
//    • ліву панель (опис, формули, підказка)
//    • праву панель (слайдери жорсткості і маси, перемикачі, кнопка скиду)
//
//  Стан (useState):
//    stiffness  — жорсткість k (1..10 N/m)
//    mass       — маса m (0.05..0.30 кг)
//    showEqLine — показувати лінію рівноваги
//    showArrow  — показувати стрілку зміщення
//
//  Refs (useRef, оновлюються без ре-рендеру):
//    stiffnessRef / massRef / ... — «живі» значення для циклу анімації
//    posYRef   — поточна Y-позиція блоку (фізичний стан)
//    velYRef   — поточна вертикальна швидкість блоку
//    isDraggingRef — чи захоплено блок мишею
//
//  Refs використовуються замість state у циклі анімації,
//  щоб уникнути застарілих замикань (stale closures) у requestAnimationFrame.
// ─────────────────────────────────────────────────────────────────────────────
function Simulator() {
  const canvasRef = useRef(null);

  const [stiffness, setStiffness] = useState(5);
  const [mass, setMass] = useState(0.1);
  const [showEqLine, setShowEqLine] = useState(true);
  const [showArrow, setShowArrow] = useState(true);
  const [damped, setDamped] = useState(true); // true = damped, false = undamped
  const [slowMo, setSlowMo] = useState(false);
  const slowMoRef = useRef(false);

  // ── Refs для циклу анімації — завжди містять актуальне значення ──
  const stiffnessRef = useRef(stiffness);
  const massRef = useRef(mass);
  const showEqLineRef = useRef(showEqLine);
  const showArrowRef = useRef(showArrow);
  const dampedRef = useRef(damped);

  // Початкова позиція блоку = рівноважне положення при поточних k і m
  const posYRef = useRef(ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / stiffness);
  const velYRef = useRef(0);             // початкова швидкість = 0 
  const isDraggingRef = useRef(false);   // мишу ще не натиснуто

  // Синхронізуємо refs зі state при кожному рендері
  useEffect(() => { stiffnessRef.current = stiffness;}, [stiffness]);
  useEffect(() => { massRef.current = mass; }, [mass]);
  useEffect(() => { showEqLineRef.current = showEqLine;}, [showEqLine]);
  useEffect(() => { showArrowRef.current  = showArrow;}, [showArrow]);
  useEffect(() => { dampedRef.current = damped;}, [damped]);
  useEffect(() => { slowMoRef.current = slowMo;}, [slowMo]);

  // ── resetSpring — повертає блок у положення рівноваги, обнуляє швидкість
  const resetSpring = useCallback(() => {
    posYRef.current = ANCHOR_Y + REST_LENGTH + (massRef.current * GRAVITY) / stiffnessRef.current;
    velYRef.current = 0;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  useEffect — ініціалізація canvas, обробники миші та цикл анімації
  //
  //  Виконується один раз при монтуванні компонента (порожній масив []).
  //  При розмонтуванні (return) скасовує анімацію та знімає обробники.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const CW = canvas.width, CH = canvas.height;

    // ── Допоміжні функції для перетворення координат миші ──
    // canvas.getBoundingClientRect() враховує CSS-масштабування,
    // тому ділимо на співвідношення «реальний розмір / атрибут width/height»
    function getMouseY(e) {
      const r = canvas.getBoundingClientRect();
      return (e.clientY - r.top) * (CH / r.height);
    }
    function getMouseX(e) {
      const r = canvas.getBoundingClientRect();
      return (e.clientX - r.left) * (CW / r.width);
    }

    // ── Перевірка, чи курсор знаходиться над блоком
    function isOverBlock(mx, my) {
      const m = massRef.current;
      const size = 40 + ((m - 0.05) / (0.3 - 0.05)) * 50;
      const bx = ANCHOR_X - BLOCK_W / 2 + (BLOCK_W - size) / 2;
      return my >= posYRef.current - 10 && my <= posYRef.current + size + 10
          && mx >= bx - 10 && mx <= bx + size + 10;
    }

    // Початок перетягування
    function onMouseDown(e) {
      if (isOverBlock(getMouseX(e), getMouseY(e))) {
        isDraggingRef.current = true;
        canvas.style.cursor   = "grabbing";
      }
    }

    // Переміщення: якщо не тягнемо — змінюємо курсор; якщо тягнемо — оновлюємо позицію
    function onMouseMove(e) {
      const my = getMouseY(e), mx = getMouseX(e);
      if (!isDraggingRef.current) {
        canvas.style.cursor = isOverBlock(mx, my) ? "grab" : "default";
        return;
      }
      // Центруємо блок відносно курсора миші (BLOCK_H / 2)
      posYRef.current = my - BLOCK_H / 2;
      velYRef.current = 0; // обнуляємо швидкість під час тягання
    }

    // Кінець перетягування
    function onMouseUp() {
      isDraggingRef.current = false;
      canvas.style.cursor   = "default";
    }

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp); // страховка — якщо миша залишила canvas

    // ──────────────────────────────────────────────────────────────────────
    //  Цикл анімації — запускається через requestAnimationFrame (~60 FPS)
    //
    //  Кожен кадр:
    //    1. Якщо не перетягуємо — інтегруємо рівняння руху (метод Ейлера):
    //         stretch = posY − (ANCHOR_Y + REST_LENGTH)   ← розтяг пружини
    //         F = −k·stretch + m·g                        ← сила (Гук + гравітація)
    //         a = F / m                                   ← прискорення (2-й закон Ньютона)
    //         v += a · dt                                 ← оновлення швидкості
    //         v *= 0.996                                  ← невелике затухання (демпфер)
    //         y += v · dt                                 ← оновлення позиції
    //    2. Перемальовуємо сцену з новою позицією
    //    3. Плануємо наступний кадр
    // ──────────────────────────────────────────────────────────────────────

    let animId;
    function animate() {
      if (!isDraggingRef.current) {
        const dt = slowMoRef.current ? DT * 0.25 : DT;        
        const k = stiffnessRef.current;
        const m = massRef.current;
        // const stretch = posYRef.current - ANCHOR_Y - REST_LENGTH; // поточне розтягнення пружини
        // const accY = ((-k * stretch) + m * GRAVITY) / m;          // чисте прискорення по Y
        const stretch = posYRef.current - ANCHOR_Y - REST_LENGTH;
        const accY = ((-k * stretch) + m * GRAVITY) / m;
        // velYRef.current += accY * DT;  
        velYRef.current += accY * dt; 
        if (dampedRef.current) {
          velYRef.current *= 0.996;
        }
        posYRef.current += velYRef.current * dt;       
        // if (dampedRef.current){
        //   velYRef.current *= 0.996;                              // застосовуємо затухання лише якщо увімкнено демпфер ~0.4% енергії за кадр
        // }
        // posYRef.current += velYRef.current * DT;                // оновлюємо позицію
      } // Undamped: no multiplication → velocity (and thus amplitude) is preserved exactly

      drawScene(
        ctx, CW, CH,
        posYRef.current, velYRef.current, isDraggingRef.current,
        stiffnessRef.current, massRef.current,
        showEqLineRef.current, showArrowRef.current
      );
      animId = requestAnimationFrame(animate);
    }
    animate();

    // Cleanup при розмонтуванні компонента
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
    };
  }, []); // [] — виконується лише один раз


  // ── Výpočet periódy: tlmená vs netlmená (OPRAVENÉ podľa pokynov)
  // Netlmená: T = 2π√(m/k)
  // Tlmená:   T_d = 2π / √(k/m − b²),  kde b = c/(2m), c z DAMPING_COEFF
  // c_eff ≈ -2m·ln(0.996)·60  → ale pre zobrazenie použijeme typickú hodnotu c = 0.3 N·s/m
  const C_COEFF  = 0.3; // efektívny koeficient tlmenia (N·s/m) pre vzorec
  const b        = C_COEFF / (2 * mass);
  const omega0sq = stiffness / mass;
  const omegaDsq = omega0sq - b * b;
  const T_undamped = (2 * Math.PI) / Math.sqrt(omega0sq);
  const T_damped   = omegaDsq > 0
    ? (2 * Math.PI) / Math.sqrt(omegaDsq)
    : null; // prekmitnutie (overdamped)

  // ── Розрахунок розмірів панелей та canvas ──
  const LEFT_W   = 300;   // ширина лівої інформаційної панелі
  const RIGHT_W  = 230;   // ширина правої панелі керування
  const GAP      = 10;    // відстань між елементами flex-рядка
  const PADDING  = 10;    // відступ від країв контейнера
  const HEADER_H = 44;    // висота шапки

  // Canvas займає решту місця після панелей і відступів
  const CANVAS_W = BASE_W - LEFT_W - RIGHT_W - GAP * 4 - PADDING * 2;
  const CANVAS_H = BASE_H - HEADER_H - PADDING * 2;

  return (
    <div style={{
      width: BASE_W, height: BASE_H,
      background: "#e2e8f0",
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* ── Шапка ── */}
      <header style={{
        height: HEADER_H, padding: "0 20px", flexShrink: 0,
        background: "#fff", borderBottom: "1px solid #d1d5db",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111" }}>
          Masses &amp; Springs
        </h1>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>— oscillation simulator</span>
      </header>

      <div style={{
        flex: 1, display: "flex", gap: GAP, padding: PADDING,
        overflow: "hidden", alignItems: "stretch",
      }}>
        {/* ── Ліва панель: опис, формули, підказка ── */}
        <aside style={{ ...panelStyle, width: LEFT_W }}>
          <Label>About the simulator</Label>
          <p style={bodyText}>
            A model of a spring-mass system based on Hooke's law. The system takes into account
            gravity, elastic force, and slight damping.
          </p>
          <Divider/>

          <Label>Formulas</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { name: "Spring Force", val: damped ? "F = −k·x − c·v" : "F = −k·x", highlight: true},
              { name: "Equilibrium",  val: "x₀ = mg / k" },
              { name: "Period",       val: damped ? "T = 2π / √(k/m − b²)" : "T = 2π√(m/k)", sub: "b = c/(2m)" },
              { name: "Frequency",    val: "f = 1 / T" },
            ].map(({ name, val }) => (
              <div key={name} style={{
                padding: "7px 10px",
                background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7,
              }}>
                <div style={{ fontSize: 6, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>{name}</div>
                <div style={{ fontSize: 12, color: "#111", fontFamily: "monospace", fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
          <Divider/>

          <Divider />
          <div>
            <Label>Playback</Label>
              <ToggleButton active={slowMo} onToggle={() => setSlowMo(v => !v)} labelOn="0.25×" labelOff="1×" />
          </div>
        </aside>

        {/* ── Canvas — основна зона симуляції ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: "100%", height: "100%", display: "block", borderRadius: 10 }}
          />
        </div>

        {/* ── Права панель: слайдери, перемикачі, скид ── */}
        <aside style={{ ...panelStyle, width: RIGHT_W }}>

          {/* Слайдер жорсткості пружини (k) */}
          <div>
            <Label>Stiffness (k)</Label>
            <div style={{ textAlign: "center", margin: "4px 0 8px" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#111" }}>{stiffness}</span>
              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>N/m</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={stiffness}
              onChange={e => {
                setStiffness(Number(e.target.value));
                resetSpring(); // скидаємо фізику при зміні параметра
              }}
              style={{ width: "100%", cursor: "pointer", accentColor: "#374151" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={hint}>soft</span><span style={hint}>hard</span>
            </div>
          </div>

          <Divider/>

          {/* Слайдер маси вантажу (m) */}
          <div>
            <Label>Mass (m)</Label>
            <div style={{ textAlign: "center", margin: "4px 0 8px" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#111" }}>{Math.round(mass * 1000)}</span>
              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>g</span>
            </div>
            <input type="range" min={0.05} max={0.3} step={0.01} value={mass}
              onChange={e => {
                setMass(Number(e.target.value));
                resetSpring(); // скидаємо фізику при зміні параметра
              }}
              style={{ width: "100%", cursor: "pointer", accentColor: "#374151" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={hint}>50 g</span><span style={hint}>300 g</span>
            </div>
          </div>

          <Divider/>
          {/* ── Damping ── */}
          <div>
            <Label>Damping</Label>
            <ToggleButton active={damped} onToggle={() => setDamped(v => !v)} />
              <p style={{ ...bodyText, marginTop: 6, fontSize: 10, color: "#9ca3af"}}>
                {damped
                  ? "Energy loss per cycle (realistic)"
                  : "No energy loss — constant amplitude"}
              </p>
          </div>

          {/* Перемикач: пунктирна лінія положення рівноваги */}
          <div>
            <Label>Equilibrium</Label>
            <ToggleButton active={showEqLine} onToggle={() => setShowEqLine(v => !v)} />
          </div>

          <Divider/>
          {/* Перемикач: стрілка, що показує зміщення від рівноваги */}
          <div>
            <Label>Velocity</Label>
            <ToggleButton active={showArrow} onToggle={() => setShowArrow(v => !v)} />
          </div>

          <Divider />

          {/* Кнопка скидання блоку у положення рівноваги */}
          <div>
            <Label>Position</Label>
            <button
              onClick={resetSpring}
              style={resetBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}
            >
              Reset
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  UI-атоми — дрібні допоміжні компоненти
// ─────────────────────────────────────────────────────────────────────────────

// ToggleButton — кнопка-перемикач (увімкнено/вимкнено)
// active=true → чорний фон + білий текст; false → світлий фон + сірий текст
// function ToggleButton({ active, onToggle }) {
//   return (
//     <button onClick={onToggle} style={{
//       width: "100%", padding: "8px", borderRadius: 7,
//       border: "1px solid #d1d5db",
//       background: active ? "#111" : "#f9fafb",
//       color:      active ? "#fff" : "#6b7280",
//       cursor: "pointer", fontSize: 12, fontWeight: 500,
//       fontFamily: "system-ui, sans-serif", transition: "all 0.15s",
//     }}>
//       {active ? "On" : "Off"}
//     </button>
//   );
// }
function ToggleButton({ active, onToggle, labelOn = "On", labelOff = "Off" }) {
  return (
    <button onClick={onToggle} style={{
      width: "100%", padding: "8px", borderRadius: 7,
      border: "1px solid #d1d5db",
      background: active ? "#111" : "#f9fafb",
      color:      active ? "#fff" : "#6b7280",
      cursor: "pointer", fontSize: 12, fontWeight: 500,
      fontFamily: "system-ui, sans-serif", transition: "all 0.15s",
    }}>
      {active ? labelOn : labelOff}
    </button>
  );
}

// Label — заголовок секції (дрібний, UPPERCASE, сірий)
function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: "#9ca3af",
      textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8,
    }}>{children}</div>
  );
}

// Divider — горизонтальний роздільник між секціями панелі
function Divider() {
  return <div style={{ height: 1, background: "#e5e7eb" }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Спільні стилі (об'єкти, що передаються через style={...})
// ─────────────────────────────────────────────────────────────────────────────

// panelStyle — базові стилі для лівої та правої бічних панелей
const panelStyle = {
  flexShrink: 0,
  background: "#fff", border: "1px solid #d1d5db",
  borderRadius: 10, padding: 16,
  display: "flex", flexDirection: "column", gap: 14,
  overflowY: "auto",
};

// bodyText — стиль основного тексту (опис, підказки)
const bodyText = { margin: 0, fontSize: 12, color: "#4b5563", lineHeight: 1.7 };

// hint — дрібний підпис (мітки на краях слайдера)
const hint = { fontSize: 10, color: "#9ca3af" };

// resetBtnStyle — стиль кнопки «Скинути» (без active-стану, тільки base)
const resetBtnStyle = {
  width: "100%", padding: "8px", borderRadius: 7,
  border: "1px solid #d1d5db", background: "#f9fafb",
  color: "#374151", cursor: "pointer", fontSize: 12,
  fontWeight: 500, fontFamily: "system-ui, sans-serif",
};