import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Pause, Play, PlayCircle, Film } from 'lucide-react';
import { Reveal, Photo } from '../ui/Bits';

/* ---------- parallax hook (off for reduced motion and small screens) ---------- */
export function useParallax(speed = 0.35) {
  const frame = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || window.innerWidth < 640) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const f = frame.current, l = layer.current;
      if (!f || !l) return;
      const rect = f.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      l.style.transform = `translate3d(0, ${(-rect.top * speed).toFixed(1)}px, 0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [speed]);
  return { frame, layer };
}

/* ---------- 3.1 / 3.2 Hero slider with crossfade + parallax ---------- */
export interface Slide { image: string; title: string; text: string; cta: string; to: string }

export const HeroSlider: React.FC<{ slides: Slide[] }> = ({ slides }) => {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // Keep the hero still on first load; visitors can start rotation with the play control.
  const [userPaused, setUserPaused] = useState(true);
  const { frame, layer } = useParallax(0.35);
  useEffect(() => {
    if (paused || userPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI(x => (x + 1) % slides.length), 5500);
    return () => window.clearInterval(id);
  }, [paused, userPaused, slides.length]);
  const s = slides[i];
  return (
    <section ref={frame as React.RefObject<HTMLElement>} className="relative h-[100svh] min-h-[560px] overflow-hidden bg-forest" aria-roledescription="carousel" aria-label={s.title}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div ref={layer} className="absolute inset-x-0 -top-[8%] h-[124%] will-change-transform">
        {slides.map((sl, k) => (
          <img key={sl.image} src={sl.image} alt="" aria-hidden="true" loading={k === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ease-in-out ${k === i ? 'opacity-100' : 'opacity-0'}`} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-forest/80 via-forest/45 to-forest/10" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-forest/60 via-transparent to-transparent" aria-hidden="true" />
      <div className="relative h-full container-x flex items-center pt-24 xl:pt-32">
        <div key={i} className="max-w-2xl text-cream animate-[fadeUp_.9s_ease]" aria-live={userPaused ? 'polite' : 'off'}>
          <span className="gold-rule block mb-6" aria-hidden="true" />
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">{s.title}</h1>
          <p className="mt-5 text-lg sm:text-xl text-cream/90 max-w-xl">{s.text}</p>
          <Link to={s.to} className="btn btn-gold mt-8 text-base px-7">{s.cta}<ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="absolute bottom-8 inset-x-0 container-x flex items-center gap-4">
        <div className="flex gap-2">
          {slides.map((sl, k) => (
            <button key={k} type="button" onClick={() => setI(k)} aria-label={t('home.slideLabel', { n: k + 1, total: slides.length })} aria-current={k === i}
              className={`h-2.5 rounded-full transition-all ${k === i ? 'w-8 bg-gold' : 'w-2.5 bg-white/60 hover:bg-white'}`} />
          ))}
        </div>
        <button type="button" onClick={() => setUserPaused(p => !p)} aria-label={userPaused ? t('home.play') : t('home.pause')} className="p-2 rounded-full text-white/85 hover:text-white hover:bg-white/10">
          {userPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
      <style>{'@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}'}</style>
    </section>
  );
};

/* ---------- Page hero (Investment / Owners page, REF-5) ---------- */
export const PageHero: React.FC<{ image: string; title: string; text: string; children?: React.ReactNode }> = ({ image, title, text, children }) => {
  const { frame, layer } = useParallax(0.25);
  return (
    <section ref={frame as React.RefObject<HTMLElement>} className="relative min-h-[88svh] overflow-hidden bg-forest flex items-end">
      <div ref={layer} className="absolute inset-x-0 -top-[6%] h-[118%]"><img src={image} alt="" aria-hidden="true" className="w-full h-full object-cover" /></div>
      <div className="absolute inset-0 bg-gradient-to-r from-forest/85 via-forest/50 to-forest/5" aria-hidden="true" />
      <div className="relative container-x pb-20 pt-40">
        <div className="max-w-3xl text-cream">
          <span className="gold-rule block mb-6" aria-hidden="true" />
          <h1 className="font-display text-5xl sm:text-6xl lg:text-[5.2rem] leading-[1.02]">{title}</h1>
          <p className="mt-6 text-lg sm:text-xl text-cream/90 max-w-2xl">{text}</p>
          {children}
        </div>
      </div>
    </section>
  );
};

/* ---------- 3.3 / 3.6 / 3.7 Split section ---------- */
export const SplitSection: React.FC<{
  image: string; imageAlt: string; eyebrow?: string; title: string; text: string; reverse?: boolean; cta?: { label: string; to: string }; tone?: 'cream' | 'sage';
  headingLevel?: 'h1' | 'h2';
}> = ({ image, imageAlt, eyebrow, title, text, reverse, cta, tone = 'cream', headingLevel = 'h2' }) => {
  const H = headingLevel;
  return (
    <section className={`py-20 lg:py-28 ${tone === 'sage' ? 'bg-sage' : 'bg-cream'}`}>
      <div className="container-x grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
        <Reveal className={reverse ? 'lg:order-2' : ''}>
          <Photo src={image} alt={imageAlt} className="w-full aspect-[4/3] rounded-[1.75rem] shadow-[var(--shadow-lift)]" />
        </Reveal>
        <Reveal delay={120}>
          {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
          <H className="font-display text-4xl lg:text-5xl text-brand leading-tight">{title}</H>
          <span className="gold-rule block my-6" aria-hidden="true" />
          <p className="text-lg text-ink/80 leading-relaxed">{text}</p>
          {cta && <Link to={cta.to} className="btn btn-primary mt-8">{cta.label}<ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>}
        </Reveal>
      </div>
    </section>
  );
};

/* ---------- Video player (poster + play button; placeholder when the file is missing) ---------- */
export const VideoPlayer: React.FC<{ src?: string; poster: string; title: string }> = ({ src, poster, title }) => {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  if (playing && src) {
    return <video className="w-full aspect-video rounded-[1.5rem] bg-black" src={src} controls autoPlay preload="none" title={title} />;
  }
  return (
    <div className="relative w-full aspect-video rounded-[1.5rem] overflow-hidden shadow-[var(--shadow-lift)] group">
      <img src={poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-forest/45" />
      {src ? (
        <button type="button" onClick={() => setPlaying(true)} className="absolute inset-0 grid place-items-center" aria-label={`${t('video.play')}: ${title}`}>
          <span className="w-20 h-20 rounded-full bg-cream/95 text-brand grid place-items-center shadow-xl group-hover:scale-105 transition"><PlayCircle className="w-11 h-11" /></span>
        </button>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-cream text-center px-6" role="img" aria-label={t('video.missing')}>
          <span className="w-20 h-20 rounded-full bg-cream/90 text-brand grid place-items-center mb-4"><Film className="w-9 h-9" aria-hidden="true" /></span>
          <p className="font-display text-2xl">{t('video.missing')}</p>
          <p className="text-sm text-cream/80 mt-1">{t('video.missingHint')}</p>
        </div>
      )}
    </div>
  );
};

/** 3.4 centred video section */
export const VideoSection: React.FC<{ eyebrow?: string; title: string; text?: string; poster: string; src?: string; tone?: 'cream' | 'sage' }> = ({ eyebrow, title, text, poster, src, tone = 'sage' }) => (
  <section className={`py-20 lg:py-28 ${tone === 'sage' ? 'bg-sage' : 'bg-cream'}`}>
    <div className="container-x max-w-5xl text-center">
      <Reveal>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 className="font-display text-4xl lg:text-5xl text-brand">{title}</h2>
        {text && <p className="text-lg text-muted mt-4 max-w-2xl mx-auto">{text}</p>}
      </Reveal>
      <Reveal className="mt-10" delay={120}><VideoPlayer src={src} poster={poster} title={title} /></Reveal>
    </div>
  </section>
);

/** 4.3 dark split video section (REF-4) */
export const VideoSplitDark: React.FC<{ eyebrow: string; text: string; caption: string; poster: string; src?: string }> = ({ eyebrow, text, caption, poster, src }) => (
  <section className="bg-forest text-cream py-20 lg:py-28">
    <div className="container-x grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">
      <Reveal><VideoPlayer src={src} poster={poster} title={eyebrow} /></Reveal>
      <Reveal delay={120}>
        <p className="eyebrow eyebrow-light mb-5">{eyebrow}</p>
        <p className="font-display text-2xl lg:text-3xl leading-snug">{text}</p>
        <p className="italic text-cream/70 mt-6 text-sm">{caption}</p>
      </Reveal>
    </div>
  </section>
);

/* ---------- 3.5 Parallax banner with fixed text ---------- */
export const ParallaxBanner: React.FC<{ image: string; text: string }> = ({ image, text }) => {
  const { frame, layer } = useParallax(0.45);
  return (
    <section ref={frame as React.RefObject<HTMLElement>} className="relative h-[70vh] min-h-[380px] overflow-hidden bg-forest" aria-label={text}>
      <div ref={layer} className="absolute inset-x-0 -top-[25%] h-[150%]"><img src={image} alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover" /></div>
      <div className="absolute inset-0 bg-forest/45" aria-hidden="true" />
      <div className="absolute inset-0 grid place-items-center px-6">
        <p className="font-display text-cream text-5xl sm:text-6xl lg:text-8xl text-center leading-none drop-shadow-lg">{text}</p>
      </div>
    </section>
  );
};

/* ---------- 7.3 CTA banner (REF-12) ---------- */
export const CTABanner: React.FC<{ title: string; text: string; cta: string; to: string }> = ({ title, text, cta, to }) => (
  <section className="bg-[#EFEDE7] py-20">
    <Reveal className="container-x max-w-3xl text-center">
      <h2 className="font-display text-4xl lg:text-5xl text-brand">{title}</h2>
      <p className="text-lg text-muted mt-4">{text}</p>
      <Link to={to} className="btn btn-primary mt-8 px-8">{cta}</Link>
    </Reveal>
  </section>
);

export const SectionHeading: React.FC<{ eyebrow?: string; title: string; text?: string; center?: boolean; action?: React.ReactNode }> = ({ eyebrow, title, text, center, action }) => (
  <Reveal className={`flex flex-col ${center ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between'} gap-6 mb-10`}>
    <div className={center ? '' : 'max-w-2xl'}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="font-display text-4xl lg:text-5xl text-brand leading-tight">{title}</h2>
      {text && <p className="text-lg text-muted mt-4">{text}</p>}
    </div>
    {action}
  </Reveal>
);
