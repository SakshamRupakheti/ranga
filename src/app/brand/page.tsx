"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Check, Trash2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { ColorField } from "@/components/properties";
import { defaultBrand, type BrandKit } from "@/lib/document";
import { loadBrand, saveBrand } from "@/lib/storage";
import { readImage } from "@/lib/files";
export default function Brand() {
  const [brand, setBrand] = useState<BrandKit>(defaultBrand);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    loadBrand()
      .then(setBrand)
      .catch(() => setStatus("Could not read your saved brand kit."))
      .finally(() => setReady(true));
  }, []);
  function patch(changes: Partial<BrandKit>) {
    setBrand((previous) => ({ ...previous, ...changes }));
    setStatus("Unsaved changes");
  }
  if (!ready)
    return (
      <Shell>
        <div className="message-page" role="status">
          Opening your brand kit…
        </div>
      </Shell>
    );
  return (
    <Shell>
      <header className="page-top">
        <span className="eyebrow">THE WORKSPACE / BRAND KIT</span>
      </header>
      <section className="page-heading">
        <div>
          <h1>Make it feel like you.</h1>
          <p>Your palette, type, and logo. Ready for the next design.</p>
        </div>
        <button
          className="button button-accent"
          onClick={async () => {
            try {
              await saveBrand(brand);
              setStatus("Brand kit saved on this device.");
            } catch {
              setStatus(
                "Could not save. Browser storage may be full or unavailable.",
              );
            }
          }}
        >
          <Check size={16} /> Save brand kit
        </button>
      </section>
      <p role="status" className="brand-status">
        {status}
      </p>
      <div className="brand-layout">
        <section className="form-card">
          <p className="eyebrow">THE ESSENTIALS</p>
          <label className="field">
            <span>Brand name</span>
            <input
              value={brand.name}
              maxLength={100}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <div className="field-grid">
            <ColorField
              label="Primary color"
              value={brand.primary}
              onChange={(primary) => patch({ primary })}
            />
            <ColorField
              label="Background color"
              value={brand.secondary}
              onChange={(secondary) => patch({ secondary })}
            />
          </div>
          <label className="field">
            <span>Preferred typeface</span>
            <select
              aria-label="Preferred typeface"
              value={brand.font}
              onChange={(e) =>
                patch({ font: e.target.value as BrandKit["font"] })
              }
            >
              {["Arial", "Georgia", "Courier New", "Impact"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Logo</span>
          </label>
          <div className="logo-upload">
            {brand.logo ? (
              <>
                <Image
                  src={brand.logo}
                  width={180}
                  height={120}
                  alt="Your brand logo"
                  unoptimized
                />
                <button
                  className="button button-outline"
                  onClick={() => patch({ logo: undefined })}
                >
                  <Trash2 size={14} /> Remove logo
                </button>
              </>
            ) : (
              <>
                <Upload size={24} />
                <p>
                  A logo can come later.
                  <br />
                  You can make Ranga’s first one in the editor.
                </p>
              </>
            )}
            <button
              className="button button-outline"
              onClick={() => input.current?.click()}
            >
              Upload {brand.logo ? "replacement" : "logo"}
            </button>
            <p className="quiet-note">PNG, JPG, WebP · Up to 5 MB</p>
          </div>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                patch({ logo: (await readImage(file)).src });
              } catch (e) {
                setStatus(e instanceof Error ? e.message : "Upload failed.");
              }
            }}
          />
        </section>
        <section
          className="brand-preview"
          style={{ background: brand.secondary, color: brand.primary }}
        >
          <span className="eyebrow">YOUR BRAND, AT A GLANCE</span>
          <h2 style={{ fontFamily: brand.font }}>
            A familiar
            <br />
            feeling.
          </h2>
          <div className="brand-preview-rule" />
          <span>{brand.name || "Your brand"}</span>
          <p style={{ fontFamily: brand.font }}>
            Aa Bb Cc
            <br />
            0123456789
          </p>
          <span className="quiet-note">
            A live preview of your palette and type.
          </span>
        </section>
      </div>
    </Shell>
  );
}
