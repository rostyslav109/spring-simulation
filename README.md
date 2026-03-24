MASSES & SPRINGS
Oscillation Simulator Documentation · React + Canvas 2D

==================================================
1. OVERVIEW
============================

This project is a spring-mass oscillator simulator based on Hooke’s Law.
The system includes:

* gravity force
* spring force
* light damping

Together, these produce a realistic damped oscillation.

The architecture is divided into two layers:

1. Render Layer
   Pure Canvas 2D functions (drawSpring, drawBlock, etc.) that are independent of React.

2. React Layer
   Components (App and Simulator) manage state, physics, and pass parameters to the renderer via refs.


==================================================
2. CONSTANTS
============================

2.1 Design Resolution

All coordinates are defined in a fixed coordinate system:

BASE_W = 1280
BASE_H = 720

The App component scales the scene using:
transform: scale(...)

Parameters:

* scale   = min(realW / BASE_W, realH / BASE_H)
* offsetX / offsetY — used to center the scene

2.2 Physical Parameters

ANCHOR_X = 345     — spring anchor X position
ANCHOR_Y = 30      — spring anchor Y position

REST_LENGTH = 140  — natural (unstretched) spring length

BLOCK_W = 80
BLOCK_H = 80       — block size

GRAVITY = 980      — acceleration (px/s²)
DT = 1/60          — simulation time step (~16.67 ms)

==================================================
3. PHYSICS MODEL
============================

3.1 Equation of Motion (Euler Method)

stretch = posY − (ANCHOR_Y + REST_LENGTH)

F = −k * stretch + m * g

a = F / m

v += a * dt
v *= 0.996        (damping)

y += v * dt

The damping factor 0.996 removes ~0.4% of energy per frame.

3.2 Equilibrium Position

y_eq = ANCHOR_Y + REST_LENGTH + (m * g) / k

This is the point where the system stabilizes.

==================================================
4. RENDERING
============================

Rendering order (drawScene):

1. clearRect
2. background (gradient + dots)
3. ceiling bracket
4. spring
5. connector node
6. equilibrium line (optional)
7. displacement arrow (optional)
8. block
9. hint text

drawSpring:

* coils: 12 → 6
* amplitude: 15 → 50 px
* thickness: 2 → 6 px

drawBlock:

* size: 40 → 90 px (depends on mass)
* becomes brighter when dragging

drawArrow:

* shown when |Δy| > 8 px
* green = above equilibrium
* red = below equilibrium

==================================================
5. STATE AND REFS
============================

Problem: stale closure in requestAnimationFrame.

Solution:

* useState → for UI
* useRef → for physics

Main variables:

stiffness (state)
mass (state)
showEqLine (state)
showArrow (state)

posYRef (ref)
velYRef (ref)
isDraggingRef (ref)

==================================================
6. MOUSE INTERACTION
============================

mousedown  → start dragging
mousemove  → move or hover
mouseup    → release
mouseleave → fallback safety

Coordinate conversion:

canvasY = (clientY − rect.top) * (canvasHeight / rect.height)

==================================================
7. UI STRUCTURE
============================

Left panel   — 300 px
Canvas       — center
Right panel  — 230 px

==================================================
8. HELPER COMPONENTS
============================

ToggleButton — on/off switch
Label        — section title
Divider      — horizontal separator

==================================================
9. STYLES
============================

panelStyle
bodyText
hint
resetBtnStyle

==================================================
10. FORMULAS
============================

F = −k * x
x₀ = mg / k
T = 2π√(m/k)
f = 1 / T

==================================================
11. PHYSICS SCALING (IMPORTANT)
============================

Why is GRAVITY = 980 instead of 9.8?

In real physics:
g = 9.8 m/s²

In the simulator:
g = 980 px/s²

This is intentional.

If we used 9.8, the movement would be almost invisible (fractions of a pixel per frame).

---

## How it works

1. Initial position:

posY = ANCHOR_Y + REST_LENGTH + (mass * GRAVITY) / stiffness

Example:
m = 0.1 kg
k = 5

displacement = (0.1 * 980) / 5 = 19.6 px

In real units:
(0.1 * 9.8) / 5 = 0.196 m = 19.6 cm

→ this match is intentional

---

## Meaning of units

1 px ≈ 1 cm

---

## Units in the system

posY     → px (cm)
velY     → px/s (cm/s)
accY     → px/s² (cm/s²)

GRAVITY  → 980 px/s² (scaled gravity)

mass     → kg (real units)
stiffness→ N/m (real units)
DT       → seconds (real units)

---

## Important note

Correct displacement conversion:

cm = Δy / 10

NOT:

Δy / GRAVITY * 100

==================================================
12. FILE STRUCTURE
============================

Constants

Canvas functions:

* drawSpring
* drawBlock
* drawCeilingBracket
* drawArrow
* drawScene

App (scaling)
Simulator (physics + UI)

UI components:

* ToggleButton
* Label
* Divider

