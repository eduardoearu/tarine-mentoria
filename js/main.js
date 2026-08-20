/* ============================================================
   SITE MOTION STARTER — motor de animação
   Lenis (scroll suave) + GSAP ScrollTrigger (âncoras)
   + sequência de frames no hero + partículas.
   ============================================================ */

/* ---------- CONFIG: o que você mexe ---------- */
const CONFIG = {
  /* quantos arquivos existem em assets/frames/.
     Confira com: ls assets/frames | wc -l                      */
  frameCount: 108,
  framePath: (i) => `assets/frames/hero_${String(i).padStart(4, '0')}.jpg`,

  /* quanto scroll o hero segura enquanto o filme roda.
     180% = uma tela e oito décimos. Menos = passa rápido demais. */
  heroScrollLength: '+=180%',

  /* abaixo desta largura o hero troca a sequência pelo vídeo em loop.
     Tem que ser o mesmo valor do @media do css.                */
  breakpointMobile: 768,

  /* cor das partículas, em rgb. Use o mesmo accent do CSS.      */
  particleRGB: '192,138,94',
  particleCountDesktop: 55,
  particleCountMobile: 26
};

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqMobile = window.matchMedia(`(max-width: ${CONFIG.breakpointMobile}px)`);

/* ============================================================
   Lenis + GSAP: um loop de animação só
   Dois requestAnimationFrame concorrentes causam engasgo.
   ============================================================ */
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ duration: 1.25, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* âncoras do menu passam pelo Lenis, senão o scroll pula seco */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- header muda de cara depois de 80px ---------- */
const header = document.getElementById('header');
ScrollTrigger.create({
  start: 80,
  onUpdate: (self) => header.classList.toggle('scrolled', self.scroll() > 80)
});

/* ============================================================
   EFEITO 6 · SCROLL PACING
   O hero fica preso na tela enquanto a sequência de frames roda.
   É isso que dá a sensação de "o scroll está conduzindo um filme".

   Desktop: canvas pintando frame por frame.
   Mobile:  vídeo em loop (96 imagens no 4G não é opção).
   ============================================================ */
const heroCanvas = document.getElementById('hero-canvas');
const heroVideo = document.getElementById('hero-video');
let sequenciaMontada = false;

function iniciarHero() {
  if (reducedMotion || mqMobile.matches) {
    tocarVideo();
    return;                             /* não marca como montado: se virar desktop, monta */
  }
  if (sequenciaMontada) return;
  sequenciaMontada = true;
  montarSequencia();
}

/* Autoplay de vídeo falha calado em várias situações: elemento ainda sem dados,
   aba aberta em segundo plano, política do navegador. Por isso tenta várias vezes. */
function tocarVideo() {
  const tentar = () => heroVideo.play().catch(() => {});
  tentar();
  heroVideo.addEventListener('canplay', tentar, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tentar(); });
  document.addEventListener('touchstart', tentar, { once: true });
  document.addEventListener('click', tentar, { once: true });
}

function montarSequencia() {
  const ctx = heroCanvas.getContext('2d');
  const imgs = [];
  let loaded = 0;

  for (let i = 1; i <= CONFIG.frameCount; i++) {
    const im = new Image();
    im.src = CONFIG.framePath(i);
    im.onload = () => { loaded++; if (loaded === 1) sizeCanvas(); };
    imgs.push(im);
  }

  const state = { f: 0 };

  function sizeCanvas() {
    const w = heroCanvas.clientWidth, h = heroCanvas.clientHeight;
    if (!w || !h) return;   /* ainda sem layout: o ResizeObserver chama de novo */
    /* devicePixelRatio limitado a 2: acima disso só gasta GPU */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    heroCanvas.width = w * dpr;
    heroCanvas.height = h * dpr;
    drawFrame(state.f);
  }

  function drawFrame(index) {
    const im = imgs[Math.round(index)];
    if (!im || !im.complete || !im.naturalWidth) return;
    const cw = heroCanvas.width, ch = heroCanvas.height;
    const iw = im.naturalWidth, ih = im.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);   /* comportamento de object-fit: cover */
    const w = iw * scale, h = ih * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  /* O ResizeObserver é o que garante o dimensionamento: dispara quando o canvas
     ganha tamanho de verdade, inclusive se a página abriu numa aba escondida.
     Só o evento 'resize' da janela não cobre esse caso, e aí o hero fica preto. */
  if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe(heroCanvas);
  window.addEventListener('resize', sizeCanvas);
  sizeCanvas();

  /* Uma timeline só, de duração 1, mapeada no pin.
     Frames e fades andam no mesmo progresso: nada dessincroniza. */
  const heroTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: CONFIG.heroScrollLength,
      scrub: 0.6,          /* 0.6s de inércia: cola no scroll sem ficar duro */
      pin: true,
      anticipatePin: 1
    }
  });
  heroTl
    .to(state, {
      f: CONFIG.frameCount - 1, snap: 'f', duration: 1,
      onUpdate: () => drawFrame(state.f)
    }, 0)
    .to('.scroll-hint', { opacity: 0, duration: 0.08 }, 0.02)
    .to('.hero-content', { opacity: 0, y: -60, duration: 0.3 }, 0.65);
}

iniciarHero();
/* girou o celular ou arrastou a janela pra outro tamanho: reavalia */
mqMobile.addEventListener('change', iniciarHero);

/* ---------- entrada do hero, disparada quando o preloader sai ---------- */
const heroIntro = gsap.timeline({ paused: true });
heroIntro.from('.reveal-hero', {
  opacity: 0, y: 46, duration: 1.1, stagger: 0.14, ease: 'power3.out'
});

/* ---------- preloader ---------- */
const preloader = document.getElementById('preloader');
function liberarPreloader() {
  if (preloader.classList.contains('done')) return;
  preloader.classList.add('done');
  heroIntro.play();
}
window.addEventListener('load', () => setTimeout(liberarPreloader, 500));
setTimeout(liberarPreloader, 2500);   /* rede lenta não pode travar o site */

/* ---------- reveals genéricos: qualquer .reveal sobe ao entrar na tela ---------- */
gsap.utils.toArray('.reveal').forEach((el) => {
  gsap.from(el, {
    opacity: 0, y: 56, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' }
  });
});

/* ---------- partículas ---------- */
(function particles() {
  if (reducedMotion) return;
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  const dots = [];
  const N = mqMobile.matches ? CONFIG.particleCountMobile : CONFIG.particleCountDesktop;

  function resize() {
    W = canvas.width = window.innerWidth || document.documentElement.clientWidth;
    H = canvas.height = window.innerHeight || document.documentElement.clientHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < N; i++) {
    dots.push({
      x: Math.random(), y: Math.random(),   /* posição em fração da tela, vira pixel no tick */
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -(Math.random() * 0.18 + 0.04),   /* sobem devagar, como poeira na luz */
      a: Math.random() * 0.35 + 0.08,
      tw: Math.random() * Math.PI * 2       /* fase do piscar */
    });
  }
  /* converte as frações em pixels assim que a tela tiver tamanho */
  let posicionado = false;
  function posicionar() {
    if (posicionado || !W) return;
    posicionado = true;
    for (const d of dots) { d.x *= W; d.y *= H; }
  }

  function tick() {
    if (!W) resize();
    posicionar();
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy; d.tw += 0.02;
      if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
      if (d.x < -10) d.x = W + 10;
      if (d.x > W + 10) d.x = -10;
      const alpha = d.a * (0.65 + 0.35 * Math.sin(d.tw));
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${CONFIG.particleRGB},${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ---------- FAQ: abrir um fecha os outros ---------- */
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (item.open) faqItems.forEach((o) => { if (o !== item) o.open = false; });
  });
});

/* ---------- ano do rodapé ---------- */
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- FAQ: abrir uma fecha as outras ----------
   Item da checklist de qa-e-entrega.md. Sem isso o usuário abre cinco
   respostas e perde a referência de onde estava.                      */
const faqItens = document.querySelectorAll('.faq-item');
faqItens.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    faqItens.forEach((outro) => { if (outro !== item) outro.open = false; });
  });
});
