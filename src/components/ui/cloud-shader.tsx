"use client";

import React, { useEffect, useRef, useState } from 'react';

export interface CloudShaderProps {
  className?: string;
  speed?: number;
  interactive?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  lightTheme?: string;
  opacity?: number;
}

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform float u_dark;
  uniform vec3 u_themeSkyTop;
  uniform vec3 u_themeSkyBottom;
  uniform vec3 u_themeCloud;

  // Analytical 2D hash
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Smooth quintic interpolation noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Fast 3-octave FBM with matrix rotation for natural flow
  const mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    vec2 shift = vec2(13.2, 7.8);
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = rot * p * 2.02 + shift;
      a *= 0.48;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    vec2 windOffset = (u_mouse - 0.5) * 0.12;
    float time = u_time * 0.016;

    // Dark stratosphere palette
    vec3 darkSkyTop = vec3(0.03, 0.06, 0.12);
    vec3 darkSkyBottom = vec3(0.07, 0.12, 0.20);
    vec3 darkCloud = vec3(0.22, 0.32, 0.44);

    // Dynamic light palette based on selected Bright Light Theme
    vec3 skyTop = mix(u_themeSkyTop, darkSkyTop, u_dark);
    vec3 skyBottom = mix(u_themeSkyBottom, darkSkyBottom, u_dark);
    vec3 baseCloud = mix(u_themeCloud, darkCloud, u_dark);

    // Sky gradient background
    vec3 color = mix(skyBottom, skyTop, smoothstep(-0.45, 0.55, p.y));

    // Dual-layer cloud advection
    vec2 flowUv1 = p * 1.8 + vec2(time * 0.20, time * 0.02) + windOffset;
    vec2 flowUv2 = p * 3.4 + vec2(time * 0.11, -time * 0.015) - windOffset * 0.6;

    float cloud = fbm(flowUv1);
    cloud += 0.32 * fbm(flowUv2);
    cloud = smoothstep(0.42, 0.78, cloud);

    float highlight = smoothstep(-0.2, 0.65, p.y) * (1.0 - u_dark * 0.5) * 0.15;
    vec3 litCloud = baseCloud + highlight;

    float density = mix(0.72, 0.65, u_dark);
    color = mix(color, litCloud, cloud * density);

    // Gentle boundary atmospheric haze
    float haze = smoothstep(0.35, -0.48, p.y);
    vec3 hazeTint = mix(u_themeSkyBottom * 1.05, vec3(0.06, 0.10, 0.16), u_dark);
    color = mix(color, hazeTint, haze * 0.16);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[CloudShader] Shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const THEME_PALETTES: Record<string, { top: [number, number, number]; bottom: [number, number, number]; cloud: [number, number, number] }> = {
  'sky-aero': {
    top: [0.14, 0.48, 0.75],
    bottom: [0.73, 0.90, 0.98],
    cloud: [0.98, 0.99, 1.0],
  },
  'electric-azure': {
    top: [0.08, 0.40, 0.88],
    bottom: [0.62, 0.88, 0.98],
    cloud: [0.96, 0.99, 1.0],
  },
  'solar-amber': {
    top: [0.86, 0.46, 0.12],
    bottom: [0.98, 0.88, 0.68],
    cloud: [1.0, 0.97, 0.90],
  },
  'radiant-coral': {
    top: [0.88, 0.24, 0.40],
    bottom: [0.98, 0.82, 0.85],
    cloud: [1.0, 0.95, 0.96],
  },
  'aurora-emerald': {
    top: [0.08, 0.52, 0.42],
    bottom: [0.68, 0.95, 0.85],
    cloud: [0.94, 1.0, 0.96],
  },
  'lavender-breeze': {
    top: [0.44, 0.28, 0.78],
    bottom: [0.86, 0.82, 0.98],
    cloud: [0.98, 0.96, 1.0],
  },
};

export const CloudShader: React.FC<CloudShaderProps> = ({
  className = '',
  speed = 1.0,
  interactive = true,
  theme = 'auto',
  lightTheme = 'sky-aero',
  opacity = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<[number, number]>([0.5, 0.5]);
  const isVisibleRef = useRef<boolean>(true);
  const lightThemeRef = useRef<string>(lightTheme);

  useEffect(() => {
    lightThemeRef.current = lightTheme;
  }, [lightTheme]);

  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isDarkMode = () => {
      if (theme === 'dark') return true;
      if (theme === 'light') return false;
      return document.documentElement.classList.contains('dark');
    };

    let gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!gl) return;

    gl.getExtension('OES_standard_derivatives');

    let program: WebGLProgram | null = null;
    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;

    let positionLoc = -1;
    let resLoc: WebGLUniformLocation | null = null;
    let timeLoc: WebGLUniformLocation | null = null;
    let mouseLoc: WebGLUniformLocation | null = null;
    let darkLoc: WebGLUniformLocation | null = null;
    let themeTopLoc: WebGLUniformLocation | null = null;
    let themeBottomLoc: WebGLUniformLocation | null = null;
    let themeCloudLoc: WebGLUniformLocation | null = null;

    let animationFrame = 0;
    let startTime = performance.now();
    let currentDarkFactor = isDarkMode() ? 1.0 : 0.0;
    let targetDarkFactor = currentDarkFactor;

    // Smoothly interpolated theme colors
    const initPalette = THEME_PALETTES[lightTheme] || THEME_PALETTES['sky-aero'];
    let currentTop = [...initPalette.top] as [number, number, number];
    let currentBottom = [...initPalette.bottom] as [number, number, number];
    let currentCloud = [...initPalette.cloud] as [number, number, number];

    const initGL = () => {
      if (!gl) return false;
      vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      if (!vertexShader || !fragmentShader) return false;

      program = gl.createProgram();
      if (!program) return false;

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return false;
      }

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      positionLoc = gl.getAttribLocation(program, 'a_position');
      resLoc = gl.getUniformLocation(program, 'u_resolution');
      timeLoc = gl.getUniformLocation(program, 'u_time');
      mouseLoc = gl.getUniformLocation(program, 'u_mouse');
      darkLoc = gl.getUniformLocation(program, 'u_dark');
      themeTopLoc = gl.getUniformLocation(program, 'u_themeSkyTop');
      themeBottomLoc = gl.getUniformLocation(program, 'u_themeSkyBottom');
      themeCloudLoc = gl.getUniformLocation(program, 'u_themeCloud');

      return true;
    };

    if (!initGL()) return;

    let cachedWidth = 0;
    let cachedHeight = 0;

    const handleResize = () => {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (cachedWidth !== displayWidth || cachedHeight !== displayHeight) {
        cachedWidth = displayWidth;
        cachedHeight = displayHeight;
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    }, { threshold: 0.05 });
    intersectionObserver.observe(canvas);

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;
        mouseRef.current = [
          Math.max(0, Math.min(1, x)),
          Math.max(0, Math.min(1, y)),
        ];
      }
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      window.cancelAnimationFrame(animationFrame);
    };

    const handleContextRestored = () => {
      initGL();
      handleResize();
      animationFrame = window.requestAnimationFrame(renderLoop);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    let lastRenderTime = performance.now();
    const renderLoop = (now: number) => {
      animationFrame = window.requestAnimationFrame(renderLoop);

      if (!isVisibleRef.current || document.hidden) return;

      const effectiveSpeed = reducedMotion ? 0.05 : speed;
      const delta = (now - lastRenderTime) / 1000;
      lastRenderTime = now;

      targetDarkFactor = isDarkMode() ? 1.0 : 0.0;
      currentDarkFactor += (targetDarkFactor - currentDarkFactor) * Math.min(1.0, delta * 4.0);

      // Lerp theme colors smoothly
      const targetPalette = THEME_PALETTES[lightThemeRef.current] || THEME_PALETTES['sky-aero'];
      const colorLerpSpeed = Math.min(1.0, delta * 3.5);
      for (let i = 0; i < 3; i++) {
        currentTop[i] += (targetPalette.top[i] - currentTop[i]) * colorLerpSpeed;
        currentBottom[i] += (targetPalette.bottom[i] - currentBottom[i]) * colorLerpSpeed;
        currentCloud[i] += (targetPalette.cloud[i] - currentCloud[i]) * colorLerpSpeed;
      }

      if (!gl || !program || !buffer) return;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
      if (timeLoc) gl.uniform1f(timeLoc, ((now - startTime) / 1000) * effectiveSpeed);
      if (mouseLoc) gl.uniform2f(mouseLoc, mouseRef.current[0], mouseRef.current[1]);
      if (darkLoc) gl.uniform1f(darkLoc, currentDarkFactor);
      if (themeTopLoc) gl.uniform3fv(themeTopLoc, currentTop);
      if (themeBottomLoc) gl.uniform3fv(themeBottomLoc, currentBottom);
      if (themeCloudLoc) gl.uniform3fv(themeCloudLoc, currentCloud);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    animationFrame = window.requestAnimationFrame(renderLoop);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
      }
    };
  }, [speed, interactive, theme, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ opacity }}
      className={`pointer-events-none select-none transition-opacity duration-700 ${className}`}
    />
  );
};

export function CloudShaderDemo({ className, lightTheme = 'sky-aero' }: { className?: string; lightTheme?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
      <CloudShader className={className || "h-[40rem] w-full"} lightTheme={lightTheme} />
    </div>
  );
}

export default CloudShader;
