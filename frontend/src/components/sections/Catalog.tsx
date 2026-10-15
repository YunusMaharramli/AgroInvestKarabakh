import React, { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import { CATEGORIES, categoryImage } from '../../data/categories';
import { Photo, Reveal } from '../ui/Bits';
import { useFormat, useLocalePath } from '../../app/i18n';
import projects from '../../mocks/projects.json';
import type { FeaturedProject } from '../../types/agro';
import { SectionHeading } from './Sections';

/* ---------- 5.2 Field category grid (REF-6 / REF-7) ---------- */
const GRID_TYPES = ['crops', 'orchards', 'greenhouse', 'livestock', 'pasture', 'nursery', 'beekeeping', 'agrotourism'];

export const CategoryGrid: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  return (
    <section className="py-20 lg:py-28 bg-cream">
      <div className="container-x">
        <SectionHeading title={title} text={text} />
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {GRID_TYPES.map((key, i) => (
            <Reveal as="li" key={key} delay={(i % 4) * 80}>
              <Link to={lp('/guides') + `#${key}`} className="group block">
                <div className="overflow-hidden rounded-[1.25rem]">
                  <Photo src={categoryImage(key)} alt={t(`fieldTypes.${key}`)} label={t('guides.photoNeeded')}
                    className="w-full aspect-[4/5] transition duration-700 group-hover:scale-[1.04]" />
                </div>
                <h3 className="font-sans font-extrabold text-lg mt-4 text-ink group-hover:text-brand">{t(`fieldTypes.${key}`)}</h3>
                <p className="text-muted text-sm mt-1">{t(`groups.${CATEGORIES.find(c => c.key === key)!.group}`)}</p>
              </Link>
            </Reveal>
          ))}
        </ul>
        <div className="text-center mt-14">
          <Link to={lp('/guides')} className="btn btn-outline px-8">{t('investments.seeAll')}</Link>
        </div>
      </div>
    </section>
  );
};

/* ---------- 5.3 Featured projects carousel (REF-8) ---------- */
function pickRandom<T>(list: T[], n: number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export const ProjectsCarousel: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const f = useFormat();
  // Random selection of completed examples on every page load (mock JSON for now — replace with an API call)
  const items = useMemo(() => pickRandom(projects as FeaturedProject[], 6), []);
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('li');
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 360) + 24), behavior: 'smooth' });
  };
  return (
    <section className="py-20 lg:py-28 bg-sage overflow-hidden" aria-roledescription="carousel" aria-label={title}>
      <div className="container-x">
        <SectionHeading title={title} text={text} action={<Link to={lp('/investments')} className="btn btn-outline rounded-full shrink-0">{t('investments.allProjects')}</Link>} />
        <div className="relative">
          <ul ref={track} className="flex gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-4 -mr-5 pr-[18%] md:pr-[28%]" tabIndex={0} aria-label={title}>
            {items.map(p => {
              const name = t('land.title', { type: t(`fieldTypes.${p.fieldType}`), region: t(`regions.${p.region}`) });
              return (
                <li key={p.id} className="snap-start shrink-0 w-[82%] sm:w-[60%] lg:w-[42%]">
                  <Link to={lp(p.link)} className="group block relative">
                    <Photo src={p.image} alt={name} className="w-full aspect-[4/3] rounded-[1.5rem]" />
                    <div className="relative -mt-16 mx-5 bg-white rounded-2xl p-5 shadow-[var(--shadow-soft)] flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl text-brand leading-snug">{name}</h3>
                        <p className="text-sm text-muted mt-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gold-dark" aria-hidden="true" />{t(`regions.${p.region}`)}</p>
                        <p className="text-sm font-semibold mt-2">{t('investments.raised', { amount: f.azn(p.amountRaised), year: p.year })}</p>
                      </div>
                      <span className="w-10 h-10 rounded-full bg-sage text-brand grid place-items-center shrink-0 group-hover:bg-brand group-hover:text-white transition"><ArrowUpRight className="w-5 h-5" aria-hidden="true" /></span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={() => scroll(-1)} className="w-12 h-12 rounded-full border-2 border-brand text-brand grid place-items-center hover:bg-brand hover:text-white" aria-label={t('investments.prev')}><ArrowLeft className="w-5 h-5" /></button>
            <button type="button" onClick={() => scroll(1)} className="w-12 h-12 rounded-full bg-brand text-white grid place-items-center hover:bg-forest" aria-label={t('investments.next')}><ArrowRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- 7.2 Field type card (REF-11) ---------- */
export const FieldTypeCard: React.FC<{ typeKey: string }> = ({ typeKey }) => {
  const { t } = useTranslation();
  return (
    <article id={typeKey} className="scroll-mt-32 h-full bg-[#F3F2EE] border border-line rounded-[1.25rem] overflow-hidden transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] flex flex-col">
      <Photo src={categoryImage(typeKey)} alt={t(`fieldTypes.${typeKey}`)} label={t('guides.photoNeeded')} className="w-full aspect-[16/10]" />
      <div className="p-6 text-center flex-1">
        <h2 className="font-display text-2xl text-leaf-dark leading-snug">{t(`fieldTypes.${typeKey}`)}</h2>
        <p className="text-muted mt-3 leading-relaxed">{t(`fieldTypeInfo.${typeKey}`)}</p>
      </div>
    </article>
  );
};
