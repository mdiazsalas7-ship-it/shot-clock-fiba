import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const FULL = 24000;
const SHORT = 14000;

function playBuzzer() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;

    // Master gain
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.6, t + 0.05);  // quick attack
    master.gain.setValueAtTime(0.6, t + 1.5);             // sustain
    master.gain.linearRampToValueAtTime(0, t + 1.8);      // cut off
    master.connect(ctx.destination);

    // Distortion for harsh buzzer texture
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 20) * x / (Math.PI + 20 * Math.abs(x));
    }
    distortion.curve = curve;
    distortion.connect(master);

    // Low horn fundamental — 220 Hz
    const horn1 = ctx.createOscillator();
    horn1.type = "sawtooth";
    horn1.frequency.setValueAtTime(220, t);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.5, t);
    horn1.connect(g1);
    g1.connect(distortion);

    // Second harmonic — 440 Hz
    const horn2 = ctx.createOscillator();
    horn2.type = "sawtooth";
    horn2.frequency.setValueAtTime(440, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, t);
    horn2.connect(g2);
    g2.connect(distortion);

    // Third layer — slight detune for thickness
    const horn3 = ctx.createOscillator();
    horn3.type = "square";
    horn3.frequency.setValueAtTime(223, t);  // slightly detuned
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.2, t);
    horn3.connect(g3);
    g3.connect(distortion);

    // Sub bass rumble
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, t);
    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.3, t);
    sub.connect(gSub);
    gSub.connect(master);

    // Start and stop all
    [horn1, horn2, horn3, sub].forEach(o => {
      o.start(t);
      o.stop(t + 1.9);
    });
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
  const glow = `drop-shadow(0 0 12px ${on}) drop-shadow(0 0 30px ${on}55)`;
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

  // Giant scale — fills viewport
  const sc = 5.5;
  const dw = 44*sc, h = 76*sc, gap = 18*sc, dotGap = 12*sc;
  const vbH = h + 10;

  if (showDec) {
    const v = expired ? 0 : sec;
    const txt = v.toFixed(1);
    const w = parseInt(txt[0]), d = parseInt(txt[2]||"0");
    const tw = dw + dotGap*2 + 8*sc + dw;
    const vbW = tw + 20;
    const sx = 10;
    return (
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="led-svg">
        <Digit val={w} x={sx} y={5} sc={sc} />
        <circle cx={sx+dw+dotGap+4*sc} cy={5+h*0.85} r={5*sc}
          fill="#ff1a1a" style={{filter:"drop-shadow(0 0 10px #ff1a1a)"}} />
        <Digit val={d} x={sx+dw+dotGap*2+8*sc} y={5} sc={sc} />
      </svg>
    );
  }

  const d = Math.ceil(sec);
  const tens = Math.floor(d / 10), ones = d % 10;

  if (tens > 0) {
    const tw = dw*2 + gap;
    const vbW = tw + 20;
    return (
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="led-svg">
        <Digit val={tens} x={10} y={5} sc={sc} />
        <Digit val={ones} x={10+dw+gap} y={5} sc={sc} />
      </svg>
    );
  }

  const vbW = dw + 20;
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="led-svg">
      <Digit val={ones} x={10} y={5} sc={sc} />
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

  // PWA install
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const r = await installPrompt.userChoice;
    if (r.outcome === "accepted") setInstallPrompt(null);
  };

  // Wake Lock
  useEffect(() => {
    const req = async () => {
      try { if ("wakeLock" in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request("screen"); } catch (_) {}
    };
    req();
    const onVis = () => { if (document.visibilityState === "visible") req(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); wakeLockRef.current?.release(); };
  }, []);

  // Fullscreen on first tap
  const tryFullscreen = () => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.();
      }
    } catch (_) {}
  };

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

  // Toggle
  const toggle = useCallback(() => {
    tryFullscreen();
    if (expired) {
      setTimeMs(FULL); setExpired(false); buzzed.current = false; setRunning(false);
      return;
    }
    setRunning(r => !r);
  }, [expired]);

  // Reset
  const resetTo = useCallback((ms: number) => {
    if (ivRef.current) clearInterval(ivRef.current);
    setTimeMs(ms); setExpired(false); buzzed.current = false; setRunning(false);
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
    <div className="root" onClick={toggle}>

      {/* Giant LED — fills the screen */}
      <div className={`clock ${expired ? "clock-expired" : isLow ? "clock-low" : ""}`}>
        <LED timeMs={timeMs} expired={expired} />
      </div>

      {/* Tiny status */}
      <div className={`status ${expired ? "status-exp" : ""}`}>
        {expired ? "VIOLACIÓN" : running ? "EN JUEGO" : "PAUSA"}
      </div>

      {/* Reset circles — bottom */}
      <div className="resets" onClick={(e) => e.stopPropagation()}>
        <div className="reset-btn" onClick={() => resetTo(FULL)}>
          <span className="reset-num">24</span>
        </div>
        <div className="reset-btn" onClick={() => resetTo(SHORT)}>
          <span className="reset-num">14</span>
        </div>
      </div>

      {/* Install */}
      {installPrompt && (
        <button className="install-btn" onClick={(e) => { e.stopPropagation(); handleInstall(); }}>
          INSTALAR
        </button>
      )}
    </div>
  );
}