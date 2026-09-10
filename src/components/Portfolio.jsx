import { useState, useMemo } from "react";
import AppearOnScroll from "./AppearOnScroll";
import "../assets/scss/ui/_Portfolio.scss";

const PROJECTS = [
  {
    id: "spacevr", title: "Space VR Plus", url: "https://spacevrplus.netlify.app/",
    img: "/projects/spacevr/spacevr.PNG.jpg", cat: "react", tags: ["react", "js", "css"], coord: "SX-001",
    desc: "Landing page designed and built for SPACE VR PLUS — a virtual reality company. Custom visual identity, immersive sections, and a tailored design system aligned with the brand.",
    styleguide: "/projects/spacevr/styleguide.html",
  },
  {
    id: "subinvoxa", title: "SubInvoxa", url: "https://subinvoxa.com/",
    img: "/projects/subinvoxa/subinvoxa.jpg", cat: "react", tags: ["react", "js", "css", "CONVEX", "CLERK"], coord: "AX-014",
    desc: "Full-stack development for the Subinvoxa platform (electronic invoicing for DIAN)",
    styleguide: "/projects/subinvoxa/styleguide.html",
  },
   

  {
    id: "lou-reed", title: "Lou Reed Archive", url: "https://lou-reed-archive.netlify.app/",
    img: "/projects/lou-reed/lou-reed.jpg", cat: "react", tags: ["react", "js", "css", "python"], coord: "JX-420",
    desc: "A website created for Velvet Underground and Lou Reed fans, where you can find all songs with tabs, lyrics, and chords. Data scraped with Python, frontend built with React.",
  },
   {
    id: "arquitec", title: "Arquitectura Bosque", url: "/projects/arquitectura/index.html",
    img: "/projects/arquitectura/arquitectura.jpg", cat: "sass", tags: ["css", "html"], coord: "HX-010",
    desc: "Landing page showcasing Arquitectura Bosque — Basic, Premier, and Elite models highlighted dynamically.",
    styleguide: "/projects/arquitectura/styleguide.html",
  },
  {
    id: "animal", title: "Animal Gambling", url: "https://gambling-katz.netlify.app/",
    img: "/img/animal.PNG", cat: "react", tags: ["react", "js", "css"], coord: "JX-108",
    desc: "Online multiplayer dice game for 2-4 players. React + Convex for real-time rooms, Three.js physics for the die. Push your luck or lose it all — first to 60 wins.",
    styleguide: "/projects/AnimalGambling/styleguide.html",
  },
  {
    id: "moonframe", title: "MoonFrame", url: "https://moonframe.netlify.app/",
    img: "/projects/moonframe/moonframe.jpg", cat: "react", tags: ["react", "js", "css"], coord: "BX-027",
    desc: "Interactive app to search, rate and save favorite movies. Login system and local storage persist the user's personal library.",
    styleguide: "/projects/moonframe/index.html",
  },
 
 
  {
    id: "guess", title: "Guess my number!", url: "/projects/score/index.html",
    img: "/img/number.PNG", cat: "javascript", tags: ["js", "css", "html"], coord: "JX-330",
    desc: "Small desktop game in JS/HTML/CSS — guess a random number before your attempts run out.",
    maintenance: true,
  },

  {
    id: "guitar", title: "Guitar LA", url: "/projects/guitarLa/index.html",
    img: "/img/portfolio/guitar.PNG", cat: "sass", tags: ["css", "html"], coord: "HX-024",
    desc: "E-commerce for iconic guitars from Los Angeles, with subtle CSS animations and a considered color palette.",
    maintenance: true,
  },
];

const FILTERS = [
  { id: "all", label: "Show all" },
  { id: "react", label: "React" },
  { id: "javascript", label: "JavaScript" },
  { id: "sass", label: "Sass / CSS + HTML" },
];

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="4.5" r="0.7" fill="currentColor" />
      <circle cx="7.5" cy="4" r="0.7" fill="currentColor" />
      <circle cx="8.5" cy="7" r="0.7" fill="currentColor" />
    </svg>
  );
}

function ProjectCard({ p }) {
  const hasStyleguide = Boolean(p.styleguide);
  return (
    <article className={`project-card${p.maintenance ? " project-card--maintenance" : ""}`}>
      <a
        className="project-card__thumb"
        href={p.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Visit ${p.title}`}
      >
        {p.img ? (
          <img src={p.img} alt={p.title} className="project-card__thumb-img" />
        ) : (
          <div className="project-card__thumb-grid" />
        )}
        <div className="project-card__thumb-meta">PROJECT · {p.coord}</div>
        {p.maintenance && (
          <div className="project-card__maintenance-badge" aria-label="Under maintenance">
            ⚙ maintenance
          </div>
        )}
        <div className="project-card__thumb-coords">[ {p.id.toUpperCase()} ]</div>
        {!p.img && <div className="project-card__thumb-label">{p.title}</div>}
        <div className="project-card__link-indicator" aria-hidden="true">
          <ArrowIcon />
        </div>
      </a>
      <div className="project-card__body">
        <h3 className="project-card__title">{p.title}</h3>
        <p className="project-card__desc">{p.desc}</p>
        <div className="project-card__tags">
          {p.tags.map((t) => (
            <span key={t} className={`project-tag project-tag--${t}`}>#{t}</span>
          ))}
        </div>
        <div className="project-card__actions">
          <a
            className="project-card__btn project-card__btn--primary"
            href={p.url}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowIcon />
            <span>Visit project</span>
          </a>
          {hasStyleguide ? (
            <a
              className="project-card__btn project-card__btn--ghost"
              href={p.styleguide}
              target="_blank"
              rel="noreferrer"
            >
              <PaletteIcon />
              <span>Style guide</span>
            </a>
          ) : (
            <button
              type="button"
              className="project-card__btn project-card__btn--ghost project-card__btn--disabled"
              aria-disabled="true"
              title="Style guide coming soon"
              onClick={(e) => e.preventDefault()}
            >
              <PaletteIcon />
              <span>Style guide</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Portfolio() {
  const [filter, setFilter] = useState("all");
  const list = useMemo(
    () => filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.cat === filter),
    [filter]
  );

  return (
    <section className="section portfolio-section" id="sec-portfolio">
      <div className="section__inner">
        <AppearOnScroll>
          <div className="section-chip">
            <span className="section-chip__num">04 /</span>
            <span>Portfolio · Constellation</span>
          </div>
        </AppearOnScroll>
        <AppearOnScroll delay={100}>
          <h2 className="section-title">
            My <span className="section-title__accent">projects</span>
          </h2>
        </AppearOnScroll>
        <AppearOnScroll delay={200}>
          <p className="section-sub">
            Here are some of my projects that showcase my skills and creativity.
            Each card is a mission — tap to dock into the live deployment.
          </p>
        </AppearOnScroll>
        <AppearOnScroll delay={300}>
          <div className="portfolio__filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`portfolio__filter ${filter === f.id ? "portfolio__filter--active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </AppearOnScroll>

        <div className="portfolio__grid">
          {list.map((p, i) => (
            <AppearOnScroll key={p.id} delay={Math.min(i * 40, 400)}>
              <ProjectCard p={p} />
            </AppearOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
