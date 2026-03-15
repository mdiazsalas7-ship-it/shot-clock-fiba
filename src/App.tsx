import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const FULL = 24000;
const SHORT = 14000;

function playBuzzer() {
  try {
    const c = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o1.type = "square"; o2.type = "square";
    o1.frequency.setValueAtTime(520, c.currentTime);
    o2.frequency.setValueAtTime(380, c.currentTime);
    g.gain.setValueAtTime(0.25, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 1.4);
    o1.connect(g); o2.connect(g); g.connect(c.destination);
    o1.start(); o2.start();
    o1.stop(c.currentTime + 1.4); o2.stop(c.currentTime + 1.4);
  } catch (_) {}
}

// ── 7-Segment ──
const SEGS: Record<number, number[]> = {
  0:[1,1,1,1,1,1,0], 1:[0,1,1,0,0,0,0], 2:[1,1,0,1,1,0,1],
  3:[1,1,1,1,0,0,1], 4:[0,1,1,0,0,1,1], 5:[1,0,1,1,0,1,1],
  6:[1,0,1,1,1,1,1], 7:[1,1,1,0,0,0,0], 8:[1,1,1,1,1,1,1],
  9:[1,1,1,1,0,1,1],
};

function hP(sx:number,sy:number,hw:number,t:number) {
  const p=t/2;
  return `${sx+p},${sy} ${sx+hw-p},${sy} ${sx+hw},${sy+t/2} ${sx+hw-p},${sy+t} ${sx+p},${sy+t} ${sx},${sy+t/2}`;
}
function vP(sx:number,sy:number,t:number,vw:number) {
  const p=t/2;
  return `${sx},${sy+p} ${sx+t/2},${sy} ${sx+t},${sy+p} ${sx+t},${sy+vw-p} ${sx+t/2},${sy+vw} ${sx},${sy+vw-p}`;
}

function Digit({ val, x, y, sc }: { val:number; x:number; y:number; sc:number }) {
  const s = SEGS[val] || [0,0,0,0,0,0,0];
  const w=44*sc, h=76*sc, t=6*sc, g=2*sc, hw=w-2*g, vw=(h-t)/2-g;
  const on = "#ff1a1a", off = "#1a0000";
  const glow = `drop-shadow(0 0 8px ${on}) drop-shadow(0 0 20px ${on}44)`;
  const pts = [
    hP(g,0,hw,t), vP(w-t-g,g,t,vw), vP(w-t-g,(h-t)/2+g,t,vw),
    hP(g,h-t,hw,t), vP(g,(h-t)/2+g,t,vw), vP(g,g,t,vw), hP(g,(h-t)/2,hw,t),
  ];
  return (
    <g transform={`translate(${x},${y})`}>
      {pts.map((p,i) => (
        <polygon key={i} points={p} fill={s[i]?on:off}
          style={s[i]?{filter:glow}:undefined} />
      ))}
    </g>
  );
}

function LED({ timeMs, expired }: { timeMs:number; expired:boolean }) {
  const sec = timeMs / 1000;
  const showDec = (sec < 5 && sec > 0) || expired;
  const sc = 2.2;
  const dw = 44*sc, h = 76*sc, gap = 14*sc, dotGap = 10*sc;
  const vbW = 440, vbH = h + 24;
  const cy = (vbH - h) / 2;

  if (showDec) {
    const v = expired ? 0 : sec;
    const txt = v.toFixed(1);
    const w = parseInt(txt[0]), d = parseInt(txt[2]||"0");
    const tw = dw + dotGap*2 + 6*sc + dw;
    const sx = (vbW - tw) / 2;
    return (
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="led-svg">
        <Digit val={w} x={sx} y={cy} sc={sc} />
        <circle cx={sx+dw+dotGap+3*sc} cy={cy+h*0.85} r={4*sc}
          fill="#ff1a1a" style={{filter:"drop-shadow(0 0 6px #ff1a1a)"}} />
        <Digit val={d} x={sx+dw+dotGap*2+6*sc} y={cy} sc={sc} />
      </svg>
    );
  }

  const d = Math.ceil(sec);
  const tens = Math.floor(d / 10), ones = d % 10;
  if (tens > 0) {
    const tw = dw*2 + gap, sx = (vbW - tw) / 2;
    return (
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="led-svg">
        <Digit val={tens} x={sx} y={cy} sc={sc} />
        <Digit val={ones} x={sx+dw+gap} y={cy} sc={sc} />
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="led-svg">
      <Digit val={ones} x={(vbW-dw)/2} y={cy} sc={sc} />
    </svg>
  );
}

export default function App() {
  const [timeMs, setTimeMs] = useState(FULL);
  const [running, setRunning] = useState(false);
  const [expired, setExpired] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const ivRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const ltRef = useRef(0);
  const buzzed = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstallPrompt(null);
  };

  // Wake Lock — keep screen on
  useEffect(() => {
    const requestWake = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (_) {}
    };
    requestWake();
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestWake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  // Countdown
  useEffect(() => {
    if (running && timeMs > 0) {
      ltRef.current = performance.now();
      ivRef.current = setInterval(() => {
        const now = performance.now();
        const delta = now - ltRef.current;
        ltRef.current = now;
        setTimeMs(prev => Math.max(0, prev - delta));
      }, 10);
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [running, timeMs > 0]);

  // Buzzer
  useEffect(() => {
    if (timeMs <= 0 && !buzzed.current) {
      buzzed.current = true;
      setRunning(false);
      setExpired(true);
      playBuzzer();
    }
  }, [timeMs]);

  // Toggle start/stop
  const toggle = useCallback(() => {
    if (expired) {
      // If expired, tap resets to 24 paused
      setTimeMs(FULL);
      setExpired(false);
      buzzed.current = false;
      setRunning(false);
      return;
    }
    setRunning(r => !r);
  }, [expired]);

  // Reset
  const resetTo = useCallback((ms: number) => {
    if (ivRef.current) clearInterval(ivRef.current);
    setTimeMs(ms);
    setExpired(false);
    buzzed.current = false;
    setRunning(false);
  }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (e.key === "2") resetTo(FULL);
      if (e.key === "1") resetTo(SHORT);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, resetTo]);

  const sec = timeMs / 1000;
  const isLow = sec <= 5 && sec > 0;

  return (
    <div className="root">
      <div className="scanlines" />

      {/* Main clock — tap to start/stop */}
      <div
        className={`clock ${expired ? "clock-expired" : isLow ? "clock-low" : ""}`}
        onClick={toggle}
      >
        <LED timeMs={timeMs} expired={expired} />

        <div className={`status ${expired ? "status-exp" : ""}`}>
          {expired ? "VIOLACIÓN · TOCA PARA RESET" : running ? "▶ EN JUEGO" : "⏸ TOCA PARA INICIAR"}
        </div>
      </div>

      {/* Reset buttons */}
      <div className="resets">
        <div className="reset-btn" onClick={() => resetTo(FULL)}>
          <span className="reset-num">24</span>
        </div>
        <div className="reset-btn" onClick={() => resetTo(SHORT)}>
          <span className="reset-num">14</span>
        </div>
      </div>

      {/* Install PWA */}
      {installPrompt && (
        <button className="install-btn" onClick={handleInstall}>
          INSTALAR APP
        </button>
      )}
    </div>
  );
}