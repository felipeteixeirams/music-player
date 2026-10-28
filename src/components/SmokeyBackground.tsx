import React, { useEffect, useRef, useState } from 'react';
import { allowsWebGlBackground } from '../utils/webglBackground';

const VERTEX = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

// Layered sine distortion: a slow wavy glow that follows the pointer a little
const FRAGMENT = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void main() {
  vec2 centeredUV = (2.0 * gl_FragCoord.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
  float time = iTime * 0.5;
  vec2 rippleCenter = 2.0 * (iMouse / iResolution) - 1.0;

  vec2 distortion = centeredUV;
  for (float i = 1.0; i < 8.0; i++) {
    distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
    distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
  }

  float wave = abs(sin(distortion.x + distortion.y + time));
  float glow = smoothstep(0.9, 0.2, wave);
  gl_FragColor = vec4(u_color * glow, 1.0);
}
`;

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255
];

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

/** Frames per second: smoke is slow, and a phone's battery is not. */
const FRAME_MS = 1000 / 30;
/** The glow is blurry by nature, so it is drawn small and stretched by the browser. */
const RESOLUTION_SCALE = 0.5;

interface SmokeyBackgroundProps {
  className?: string;
}

const FALLBACK_COLOR = '#eb4854';

/** The glow takes the app's accent color, whatever the theme in force on the element. */
function accentOf(element: Element): string {
  const value = getComputedStyle(element).getPropertyValue('--color-accent').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : FALLBACK_COLOR;
}

/**
 * An animated smoke glow drawn with WebGL, for hero screens. It stops with the component and while the page is
 * hidden, draws a single still frame under "reduce motion", and without WebGL leaves the CSS glow behind it.
 */
export const SmokeyBackground: React.FC<SmokeyBackgroundProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Without WebGL (not allowed here, unavailable, or lost while the app was away) only the CSS glow stays, no canvas at all
  const [useCanvas, setUseCanvas] = useState(() => allowsWebGlBackground(navigator.userAgent));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!useCanvas || !canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'low-power' });
    } catch {
      gl = null;
    }
    if (!gl) {
      setUseCanvas(false);
      return;
    }
    // The system may take the context back (memory pressure, the app going to the background): drop the canvas
    // instead of leaving a black layer over the glow
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setUseCanvas(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      setUseCanvas(false);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setUseCanvas(false);
      return;
    }
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, 'iResolution');
    const time = gl.getUniformLocation(program, 'iTime');
    const mouse = gl.getUniformLocation(program, 'iMouse');
    gl.uniform3f(gl.getUniformLocation(program, 'u_color'), ...hexToRgb(accentOf(canvas)));

    // Where the pointer is, as a fraction of the canvas; the glow leans toward it
    const pointer = { x: 0.5, y: 0.5 };
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      pointer.y = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const start = performance.now();
    let lastFrame = 0;
    let frameId = 0;

    const draw = (now: number) => {
      const width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION_SCALE));
      const height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION_SCALE));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, (now - start) / 1000);
      gl.uniform2f(mouse, pointer.x * width, pointer.y * height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      draw(now);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) draw(start + 4000);
    else frameId = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [useCanvas]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* The still version of the glow: what shows without WebGL, and under the canvas while it starts */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(60% 50% at 50% 38%, color-mix(in srgb, var(--color-accent) 33%, transparent), transparent 70%)' }}
      />
      {useCanvas && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-60 mix-blend-screen" />}
    </div>
  );
};
