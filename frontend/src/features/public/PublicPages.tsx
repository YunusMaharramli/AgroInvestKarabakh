import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../../data/categories';
import { REGIONS } from '../../data/regions';
import { useLocalePath } from '../../app/i18n';
import { HeroSlider, PageHero, SplitSection, VideoSection, ParallaxBanner, CTABanner, VideoSplitDark, SectionHeading } from '../../components/sections/Sections';
import { CategoryGrid, ProjectsCarousel, FieldTypeCard } from '../../components/sections/Catalog';
import { LandsMap } from '../../components/map/LandsMap';
import { landService, useDbValue } from '../../services/api';
import { LandSearchBar, matchesLandSearch } from '../shared/LandSearch';
import { Reveal } from '../../components/ui/Bits';

const IMG = (n: string) => `/images/site/${n}.jpg`;
const CAT = (n: string) => `/images/categories/${n}.jpg`;

/** Uploaded videos go here (frontend/public/videos/...). Leave undefined to show the "video coming soon" placeholder. */
export const VIDEOS: { howItWorks?: string; about?: string; investors?: string; owners?: string } = {};

function usePageTitle(key: string) {
  const { t, i18n } = useTranslation();
  useEffect(() => { document.title = `${t(key)} · AGROInvest`; }, [key, i18n.language]);
}

/* ---------------- Home (section 3) ---------------- */
export const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lp = useLocalePath();
  useEffect(() => { document.title = t('meta.title'); }, [i18n.language]);
  const slides = t('home.slides', { returnObjects: true }) as unknown as { title: string; text: string; cta: string }[];
  const targets = ['/investments', '/owners', '/about'];
  const images = [IMG('photo-08'), IMG('photo-18'), CAT('crops-11')];
  return (
    <>
      <HeroSlider slides={slides.map((s, i) => ({ ...s, to: lp(targets[i]), image: images[i] }))} />
      <SplitSection image={IMG('photo-10')} imageAlt="" eyebrow={t('home.whatEyebrow')} title={t('home.whatTitle')} text={t('home.whatText')} />
      <VideoSection eyebrow={t('home.videoEyebrow')} title={t('home.videoTitle')} text={t('home.videoText')} poster={IMG('photo-21')} src={VIDEOS.howItWorks} />
      <ParallaxBanner image={IMG('photo-24')} text={t('home.banner')} />
      <SplitSection image={IMG('photo-11')} imageAlt="" eyebrow={t('home.ownersEyebrow')} title={t('home.ownersTitle')} text={t('home.ownersText')}
        cta={{ label: t('home.learnMore'), to: lp('/owners') }} />
      <SplitSection image={IMG('photo-03')} imageAlt="" eyebrow={t('home.investorsEyebrow')} title={t('home.investorsTitle')} text={t('home.investorsText')}
        cta={{ label: t('home.learnMore'), to: lp('/investments') }} reverse tone="sage" />
    </>
  );
};

/* ---------------- About (section 4) ---------------- */
export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  usePageTitle('nav.about');
  const facts = t('about.facts', { returnObjects: true }) as unknown as { title: string; text: string }[];
  const lands = useDbValue(() => landService.publicLands().length);
  const stats = [
    { value: '2025', label: t('about.stats.founded') },
    { value: `${lands}+`, label: t('about.stats.fields') },
    { value: '140+', label: t('about.stats.investors') },
    { value: String(REGIONS.length), label: t('about.stats.regions') },
  ];
  return (
    <>
      {/* 4.1 intro split (REF-3) */}
      <section className="bg-sage">
        <div className="container-x grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-16 lg:py-24">
          <Reveal>
            <h1 className="font-display uppercase text-5xl sm:text-6xl lg:text-7xl text-brand leading-[1.02] tracking-tight">{t('about.title')}</h1>
            <span className="gold-rule block my-8" aria-hidden="true" />
            <p className="text-xl lg:text-2xl text-ink/80 leading-relaxed">{t('about.intro')}</p>
          </Reveal>
          <Reveal delay={150}><img src="/images/categories/orchards-4.jpg" alt="" className="w-full aspect-[4/5] object-cover rounded-[2rem] shadow-[var(--shadow-lift)]" /></Reveal>
        </div>
      </section>

      {/* 4.2 story / key facts */}
      <section className="py-20 lg:py-28 bg-cream">
        <div className="container-x">
          <SectionHeading eyebrow={t('about.storyEyebrow')} title={t('about.storyTitle')} />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {stats.map((s, i) => (
              <Reveal as="li" key={s.label} delay={i * 80} className="card p-6 text-center">
                <p className="font-display text-5xl text-brand">{s.value}</p>
                <p className="text-muted font-semibold mt-2">{s.label}</p>
              </Reveal>
            ))}
          </ul>
          <div className="grid md:grid-cols-2 gap-x-14 gap-y-10">
            {facts.map((f, i) => (
              <Reveal key={f.title} delay={i * 60} className="flex gap-5">
                <span className="font-display text-3xl text-gold-dark w-10 shrink-0">0{i + 1}</span>
                <div><h3 className="font-display text-2xl text-brand">{f.title}</h3><p className="text-ink/80 mt-2 leading-relaxed">{f.text}</p></div>
              </Reveal>
            ))}
          </div>
          {import.meta.env.DEV && (
            <Reveal className="mt-14 rounded-2xl bg-sand p-6">
              <h3 className="font-display text-2xl text-brand">{t('about.teamTitle')}</h3>
              <p className="mt-2 text-ink/80">{t('about.team')} <span className="text-xs text-muted">({t('meta.placeholderNote')})</span></p>
            </Reveal>
          )}
        </div>
      </section>

      {/* 4.3 video (REF-4) */}
      <VideoSplitDark eyebrow={t('about.videoEyebrow')} text={t('about.videoText')} caption={t('about.videoCaption')} poster={IMG('photo-02')} src={VIDEOS.about} />
    </>
  );
};

/* ---------------- Investment Opportunities (section 5) & For Owners (section 6) ---------------- */
const MarketPage: React.FC<{ audience: 'investments' | 'owners' }> = ({ audience }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  usePageTitle(audience === 'owners' ? 'nav.owners' : 'nav.investments');
  const lands = useDbValue(() => landService.publicLands());
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const found = lands.filter(l => matchesLandSearch(l, q, type));
  const k = (x: string) => t(`${audience}.${x}`);
  return (
    <>
      <PageHero image={audience === 'owners' ? IMG('photo-23') : CAT('crops-16')} title={k('heroTitle')} text={k('heroText')}>
        {audience === 'owners' && <Link to={lp('/signup')} className="btn btn-gold mt-8">{t('owners.cta')}</Link>}
      </PageHero>
      <CategoryGrid title={k('gridTitle')} text={k('gridText')} />
      <VideoSection title={k('videoTitle')} text={k('videoText')} poster={audience === 'owners' ? IMG('photo-11') : IMG('photo-07')} src={audience === 'owners' ? VIDEOS.owners : VIDEOS.investors} tone="cream" />
      <ProjectsCarousel title={k('projectsTitle')} text={k('projectsText')} />
      <section id="map" className="py-20 lg:py-28 bg-cream scroll-mt-24">
        <div className="container-x">
          <SectionHeading title={k('mapTitle')} text={k('mapText')} />
          <LandSearchBar value={q} onChange={setQ} type={type} onTypeChange={setType} className="mb-3" />
          <p className="text-sm text-muted mb-5" aria-live="polite">{t('search.found', { count: found.length })}</p>
          <Reveal><LandsMap lands={found} /></Reveal>
        </div>
      </section>
    </>
  );
};
export const InvestmentsPage: React.FC = () => <MarketPage audience="investments" />;
export const OwnersPage: React.FC = () => <MarketPage audience="owners" />;

/* ---------------- Picking Guides (section 7) ---------------- */
export const GuidesPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  usePageTitle('guides.title');
  return (
    <>
      <section className="bg-cream pt-16 pb-12 text-center">
        <div className="container-x max-w-3xl">
          <p className="eyebrow !text-leaf-dark mb-4">{t('guides.eyebrow')}</p>
          <h1 className="font-display text-5xl lg:text-6xl text-brand">{t('guides.title')}</h1>
          <p className="text-lg text-muted mt-4">{t('guides.subtitle')}</p>
        </div>
      </section>
      <section className="bg-cream pb-24">
        <ul className="container-x grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {CATEGORIES.map((c, i) => <Reveal as="li" key={c.key} delay={(i % 3) * 70}><FieldTypeCard typeKey={c.key} /></Reveal>)}
        </ul>
      </section>
      <CTABanner title={t('guides.ctaTitle')} text={t('guides.ctaText')} cta={t('guides.ctaButton')} to={lp('/signup')} />
    </>
  );
};

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  return (
    <section className="py-32 text-center container-x">
      <h1 className="font-display text-5xl text-brand">{t('common.notFound')}</h1>
      <p className="text-muted mt-4">{t('common.notFoundText')}</p>
      <Link to={lp('/')} className="btn btn-primary mt-8">{t('common.home')}</Link>
    </section>
  );
};
