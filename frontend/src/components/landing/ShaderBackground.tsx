"use client";

import { useEffect, useRef } from "react";

// unicorn.studio 풍의 흐르는 메시 그라데이션 — 외부 의존성 없는 ~1 파일 WebGL.
// 랜딩 라우트에서만 dynamic import(ssr:false). prefers-reduced-motion이면 1프레임만 렌더.
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

const vec3 c1 = vec3(0.486, 0.361, 0.988); // #7c5cfc 보라
const vec3 c2 = vec3(0.176, 0.435, 0.882); // 파랑
const vec3 c3 = vec3(0.180, 0.651, 0.420); // 초록
const vec3 c4 = vec3(0.043, 0.055, 0.118); // 짙은 남색(가장자리)

float wave(vec2 p, float t, float f, vec2 dir) {
  return 0.5 + 0.5 * sin(dot(p, dir) * f + t);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  float t = u_time * 0.09;
  float a = wave(p, t, 3.0, vec2(0.8, 0.6));
  float b = wave(p, t * 1.3 + 1.7, 4.2, vec2(-0.5, 0.9));
  float c = wave(p, t * 0.7 + 4.2, 2.3, vec2(0.3, -0.8));
  vec3 col = mix(c1, c2, a);
  col = mix(col, c3, b * 0.55);
  // 중앙은 밝게, 가장자리는 짙게(텍스트 대비 + 비네팅).
  float d = distance(uv, vec2(0.5, 0.42));
  col = mix(col, c4, smoothstep(0.35, 1.15, d) * 0.85);
  col += (c - 0.5) * 0.04; // 미세 결.
  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      resize();
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    if (reduce) {
      resize();
      gl.uniform1f(uTime, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
