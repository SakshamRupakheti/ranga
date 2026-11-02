import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  MoveUpRight,
  Layers3,
  MousePointer2,
} from "lucide-react";
export default function Home() {
  return (
    <main className="landing">
      <nav className="site-nav">
        <Link href="/" className="wordmark">
          Ranga<span className="wordmark-period">.</span>
        </Link>
        <span className="nav-caption">A SPACE FOR YOUR NEXT IDEA</span>
        <Link className="button button-dark" href="/projects">
          Open workspace <ArrowUpRight size={16} />
        </Link>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-square" /> FROM FIRST THOUGHT TO FINAL FORM
          </p>
          <h1>
            Good ideas
            <br />
            deserve <em>form.</em>
          </h1>
          <p className="hero-description">
            A considered space for making graphics.
            <br />
            Bring your references. Shape your composition.
            <br />
            Make every detail yours.
          </p>
          <div className="hero-actions">
            <Link href="/editor?new=editorial" className="button button-accent">
              Start designing <ArrowUpRight size={18} />
            </Link>
            <a href="#workflow" className="text-link">
              Find your way around <ArrowRight size={16} />
            </a>
          </div>
          <p className="quiet-note">
            No account needed for this local preview.
          </p>
        </div>
        <div className="hero-work">
          <div className="specimen-caption">
            <span>ON THE DRAWING BOARD</span>
            <span>001 / EDITORIAL STUDY</span>
          </div>
          <Link
            href="/editor?new=editorial"
            className="poster-preview"
            aria-label="Open the editable Form and Field poster"
          >
            <div className="poster-meta">
              <span>
                EXPLORATIONS IN
                <br />
                ART & DESIGN
              </span>
              <span>
                VOL. 01
                <br />
                2026
              </span>
            </div>
            <div className="poster-title">
              FORM
              <br />
              <span>& FIELD</span>
            </div>
            <div className="poster-orbit">
              <i />
              <i />
              <i />
            </div>
            <div className="poster-foot">
              <span>
                A STUDY IN
                <br />
                SHAPE AND SPACE
              </span>
              <MoveUpRight size={40} />
            </div>
          </Link>
          <div className="specimen-bottom">
            <span>
              <Layers3 size={14} /> Made from editable layers
            </span>
            <Link href="/editor?new=editorial">
              Make it yours <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="canvas-tag">
            <MousePointer2 size={14} /> Your eye. Your decisions.
          </div>
        </div>
      </section>
      <section className="workflow" id="workflow">
        <div>
          <p className="eyebrow">LESS SWITCHING. MORE MAKING.</p>
          <h2>
            A little structure.
            <br />
            <em>A lot of possibility.</em>
          </h2>
        </div>
        <div className="workflow-list">
          <article>
            <span>01</span>
            <div>
              <h3>Start with a direction</h3>
              <p>
                Open a blank canvas or an editable composition. Keep your own
                visual references close.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Get your hands on it</h3>
              <p>
                Move type. Shift colors. Add your images. Every layer is yours
                to work with.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Take it into the world</h3>
              <p>
                Save your project in this browser. Export a PNG, SVG, or
                editable project backup.
              </p>
            </div>
          </article>
        </div>
      </section>
      <footer className="site-footer">
        <span className="wordmark">Ranga.</span>
        <span>Built for the process, not just the result.</span>
        <Link href="/settings">
          About this preview <ArrowUpRight size={14} />
        </Link>
      </footer>
    </main>
  );
}
