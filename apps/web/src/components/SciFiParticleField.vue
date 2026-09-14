<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

type MotionLevel = "full" | "subtle" | "reduced";
type ThemePreference = "light" | "dark" | "system";
type VisualMood = "cyber" | "fusion" | "soft";
type Rgb = readonly [number, number, number];

interface Props {
  enabled?: boolean;
  intensity?: number;
  motionLevel?: MotionLevel;
  theme?: ThemePreference;
  accent?: string;
  mood?: VisualMood;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorIndex: number;
  opacityBias: number;
}

interface PerformanceProfile {
  mobile: boolean;
  constrained: boolean;
  particleScale: number;
  dprCap: number;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  intensity: 55,
  motionLevel: "full",
  theme: "system",
  accent: "emerald",
  mood: "cyber"
});

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const isStatic = ref(false);

const accentColors: Record<string, Rgb> = {
  emerald: [22, 123, 111],
  blue: [59, 101, 217],
  violet: [117, 82, 207],
  coral: [210, 92, 80],
  rose: [184, 59, 105],
  champagne: [159, 97, 41]
};

const classNames = computed(() => [
  `is-${props.mood}`,
  { "is-disabled": !props.enabled, "is-static": isStatic.value }
]);

let context: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;
let darkModeQuery: MediaQueryList | null = null;
let reducedMotionQuery: MediaQueryList | null = null;
let animationFrame = 0;
let width = 0;
let height = 0;
let dpr = 1;
let lastFrameTime = 0;
let lastDrawTime = 0;
let renderedFrameCount = 0;
let hasRenderedFrame = false;
let particles: Particle[] = [];
let palette: Rgb[] = [];
let profile: PerformanceProfile = {
  mobile: false,
  constrained: false,
  particleScale: 1,
  dprCap: 1.75
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizedIntensity() {
  const value = Number.isFinite(props.intensity) ? props.intensity : 55;
  return clamp(value, 0, 100) / 100;
}

function resolvedDarkTheme() {
  if (props.theme === "dark") return true;
  if (props.theme === "light") return false;
  return darkModeQuery?.matches ?? false;
}

function buildPalette() {
  const previousPaletteLength = palette.length;
  const accent = accentColors[props.accent.toLocaleLowerCase()] ?? accentColors.emerald;
  const dark = resolvedDarkTheme();
  const cyan: Rgb = dark ? [84, 201, 212] : [34, 137, 151];
  const blue: Rgb = dark ? [112, 147, 225] : [67, 100, 178];
  const rose: Rgb = dark ? [223, 136, 167] : [177, 75, 114];
  const lilac: Rgb = dark ? [170, 152, 213] : [126, 103, 176];
  const aqua: Rgb = dark ? [115, 190, 193] : [55, 142, 149];

  if (props.mood === "fusion") palette = [accent, aqua, lilac, rose];
  else if (props.mood === "soft") palette = [accent, rose, lilac, aqua];
  else palette = [accent, cyan, blue];

  if (previousPaletteLength && previousPaletteLength !== palette.length) {
    for (let index = 0; index < particles.length; index += 1) {
      particles[index].colorIndex = index % palette.length;
    }
  }
}

function detectPerformanceProfile() {
  const navigatorWithMemory = navigator as NavigatorWithMemory;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigatorWithMemory.deviceMemory;
  const mobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const constrained = cores <= 4 || (typeof memory === "number" && memory <= 4);

  profile = {
    mobile,
    constrained,
    particleScale: mobile && constrained ? 0.52 : mobile ? 0.72 : constrained ? 0.64 : 1,
    dprCap: mobile && constrained ? 1 : mobile || constrained ? 1.25 : 1.75
  };
}

function targetParticleCount() {
  if (!width || !height) return 0;
  if (normalizedIntensity() === 0) return 0;

  const area = width * height;
  const strength = 0.3 + normalizedIntensity() * 0.7;
  const densityArea = profile.mobile ? 10500 : 16500;
  const minimum = profile.mobile ? 10 : profile.constrained ? 14 : 18;
  const maximum = profile.mobile ? 34 : profile.constrained ? 68 : 116;
  return Math.round(clamp((area / densityArea) * strength * profile.particleScale, minimum, maximum));
}

function createParticle(): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 2.8 + Math.random() * 5.6;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 0.65 + Math.random() * 1.05,
    colorIndex: Math.floor(Math.random() * Math.max(1, palette.length)),
    opacityBias: 0.7 + Math.random() * 0.3
  };
}

function reconcileParticles() {
  const target = targetParticleCount();
  while (particles.length < target) particles.push(createParticle());
  if (particles.length > target) particles.length = target;
  if (!target) hasRenderedFrame = false;

  const paletteLength = Math.max(1, palette.length);
  for (const particle of particles) particle.colorIndex %= paletteLength;
  updateDiagnostics(true);
}

function updateDiagnostics(force = false) {
  const element = container.value;
  if (!element || (!force && renderedFrameCount % 12 !== 0)) return;

  element.dataset.particleCount = String(props.enabled && context ? particles.length : 0);
  element.dataset.renderCount = String(renderedFrameCount);
  element.dataset.rendered = String(Boolean(props.enabled && hasRenderedFrame && context && width && height && particles.length));
  element.dataset.performance = profile.mobile ? "mobile" : profile.constrained ? "constrained" : "full";
}

function resizeCanvas(nextWidth: number, nextHeight: number) {
  const element = canvas.value;
  if (!element) return;

  const safeWidth = Math.max(0, Math.round(nextWidth));
  const safeHeight = Math.max(0, Math.round(nextHeight));
  if (!safeWidth || !safeHeight) {
    stopAnimation();
    context?.clearRect(0, 0, width, height);
    element.width = 1;
    element.height = 1;
    width = 0;
    height = 0;
    particles = [];
    hasRenderedFrame = false;
    updateDiagnostics(true);
    return;
  }

  const previousWidth = width;
  const previousHeight = height;
  width = safeWidth;
  height = safeHeight;
  dpr = Math.min(window.devicePixelRatio || 1, profile.dprCap);

  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (element.width !== backingWidth) element.width = backingWidth;
  if (element.height !== backingHeight) element.height = backingHeight;

  context = element.getContext("2d", { alpha: true, desynchronized: true }) ?? element.getContext("2d");
  hasRenderedFrame = false;
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (previousWidth && previousHeight) {
    const scaleX = width / previousWidth;
    const scaleY = height / previousHeight;
    for (const particle of particles) {
      particle.x *= scaleX;
      particle.y *= scaleY;
    }
  }

  reconcileParticles();
  restartRendering();
}

function measureAndResize() {
  const element = container.value;
  if (!element) return;
  detectPerformanceProfile();
  const bounds = element.getBoundingClientRect();
  resizeCanvas(bounds.width, bounds.height);
}

function updateParticles(deltaSeconds: number) {
  const motionScale = props.motionLevel === "subtle" ? 0.34 : 1;
  const margin = 4;

  for (const particle of particles) {
    particle.x += particle.vx * deltaSeconds * motionScale;
    particle.y += particle.vy * deltaSeconds * motionScale;

    if (particle.x < -margin) particle.x = width + margin;
    else if (particle.x > width + margin) particle.x = -margin;
    if (particle.y < -margin) particle.y = height + margin;
    else if (particle.y > height + margin) particle.y = -margin;
  }
}

function rgb(color: Rgb) {
  return `rgb(${color[0]} ${color[1]} ${color[2]})`;
}

function draw() {
  if (!context || !width || !height || !props.enabled) return;

  const ctx = context;
  const wasRendered = hasRenderedFrame;
  const dark = resolvedDarkTheme();
  const strength = 0.38 + normalizedIntensity() * 0.62;
  const moodScale = props.mood === "soft" ? 0.78 : props.mood === "fusion" ? 0.94 : 1;
  const linkDistance = (profile.mobile ? 84 : 116) + normalizedIntensity() * (profile.mobile ? 20 : 34);
  const pointAlpha = (dark ? 0.46 : 0.34) * strength * moodScale;
  const lineAlpha = (dark ? 0.18 : 0.13) * strength * moodScale;

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 0.55;
  ctx.lineCap = "round";

  for (let i = 0; i < particles.length; i += 1) {
    const source = particles[i];
    let links = 0;

    for (let j = i + 1; j < particles.length && links < 2; j += 1) {
      const target = particles[j];
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared >= linkDistance * linkDistance) continue;

      const distance = Math.sqrt(distanceSquared);
      ctx.globalAlpha = lineAlpha * (1 - distance / linkDistance);
      ctx.strokeStyle = rgb(palette[source.colorIndex] ?? palette[0]);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      links += 1;
    }
  }

  for (const particle of particles) {
    ctx.globalAlpha = pointAlpha * particle.opacityBias;
    ctx.fillStyle = rgb(palette[particle.colorIndex] ?? palette[0]);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  hasRenderedFrame = particles.length > 0;
  renderedFrameCount += 1;
  updateDiagnostics(!wasRendered && hasRenderedFrame);
}

function frameInterval() {
  if (profile.mobile || profile.constrained) return props.motionLevel === "subtle" ? 1000 / 16 : 1000 / 24;
  return props.motionLevel === "subtle" ? 1000 / 24 : 1000 / 45;
}

function animate(timestamp: number) {
  animationFrame = 0;
  if (!props.enabled || document.hidden || isStatic.value) return;

  const interval = frameInterval();
  const timeSinceDraw = lastDrawTime ? timestamp - lastDrawTime : interval;
  if (!lastDrawTime || timeSinceDraw >= interval) {
    const elapsed = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : interval / 1000;
    updateParticles(Math.min(elapsed, 0.05));
    draw();
    lastFrameTime = timestamp;
    lastDrawTime = lastDrawTime ? timestamp - (timeSinceDraw % interval) : timestamp;
  }

  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastFrameTime = 0;
  lastDrawTime = 0;
}

function refreshMotionPreference() {
  isStatic.value = props.motionLevel === "reduced" || Boolean(reducedMotionQuery?.matches);
}

function restartRendering() {
  stopAnimation();
  refreshMotionPreference();

  if (!props.enabled || normalizedIntensity() === 0) {
    context?.clearRect(0, 0, width, height);
    hasRenderedFrame = false;
    updateDiagnostics(true);
    return;
  }

  if (!context || !width || !height) {
    hasRenderedFrame = false;
    updateDiagnostics(true);
    return;
  }

  draw();
  if (!isStatic.value && !document.hidden) animationFrame = requestAnimationFrame(animate);
}

function handleVisibilityChange() {
  if (document.hidden) stopAnimation();
  else restartRendering();
}

function handleColorSchemeChange() {
  if (props.theme !== "system") return;
  buildPalette();
  restartRendering();
}

function handleReducedMotionChange() {
  restartRendering();
}

watch(
  () => [props.enabled, props.intensity, props.motionLevel, props.theme, props.accent, props.mood] as const,
  async () => {
    buildPalette();
    reconcileParticles();
    await nextTick();
    if (props.enabled && (!width || !height)) measureAndResize();
    else restartRendering();
  }
);

onMounted(() => {
  darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  darkModeQuery.addEventListener("change", handleColorSchemeChange);
  reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("resize", measureAndResize, { passive: true });

  detectPerformanceProfile();
  buildPalette();
  refreshMotionPreference();

  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) resizeCanvas(entry.contentRect.width, entry.contentRect.height);
  });
  if (container.value) resizeObserver.observe(container.value);
  measureAndResize();
});

onBeforeUnmount(() => {
  stopAnimation();
  resizeObserver?.disconnect();
  darkModeQuery?.removeEventListener("change", handleColorSchemeChange);
  reducedMotionQuery?.removeEventListener("change", handleReducedMotionChange);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("resize", measureAndResize);
  particles = [];
  palette = [];
  context = null;
});
</script>

<template>
  <div
    ref="container"
    class="sci-fi-particle-field"
    :class="classNames"
    :data-motion="motionLevel"
    data-rendered="false"
    data-particle-count="0"
    data-render-count="0"
    aria-hidden="true"
  >
    <canvas ref="canvas" class="sci-fi-particle-field__canvas" aria-hidden="true" />
  </div>
</template>

<style scoped>
.sci-fi-particle-field {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  contain: paint;
  pointer-events: none;
  user-select: none;
}

.sci-fi-particle-field__canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.sci-fi-particle-field.is-disabled {
  visibility: hidden;
}

.sci-fi-particle-field.is-soft .sci-fi-particle-field__canvas {
  opacity: 0.82;
}

@media (max-width: 760px) {
  .sci-fi-particle-field__canvas {
    opacity: 0.78;
  }

  .sci-fi-particle-field.is-soft .sci-fi-particle-field__canvas {
    opacity: 0.66;
  }
}
</style>
