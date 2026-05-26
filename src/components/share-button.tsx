"use client";

import { useCallback, useEffect, useState } from "react";
import { SOCIAL_CARDS, type SocialCardType } from "@/lib/social/types";

type ShareButtonProps = {
  username: string;
  total: number;
  date: string;
};

function buildShareText(total: number) {
  if (total > 0) {
    return `+${total.toLocaleString("en-US")} lines shipped on ShipRank`;
  }
  return `tracking lines shipped on ShipRank`;
}

async function svgToPngBlob(svg: string) {
  const svgUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("could not render image"));
    });
    image.src = svgUrl;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image export is not supported here");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("could not export image"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function ShareButton({ username, total, date }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<SocialCardType>("today");
  const [status, setStatus] = useState<string | null>(null);
  const [loadedPreviews, setLoadedPreviews] = useState<Set<SocialCardType>>(
    () => new Set(),
  );
  const [generating, setGenerating] = useState<{
    type: SocialCardType;
    action: "copy" | "download";
  } | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 3600);
  }, []);

  const buildSrc = useCallback(
    (type: SocialCardType) =>
      `/api/users/${encodeURIComponent(username)}/social/${type}`,
    [username],
  );

  const openSharePanel = useCallback(() => {
    setActiveType("today");
    setStatus((currentStatus) => currentStatus ?? "generating preview");
    setOpen(true);
  }, []);

  const shareText = useCallback(async () => {
    const text = buildShareText(total);
    const url = `https://shiprank.dev/${username}`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `@${username} · ${date}`, text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", url);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  }, [username, total, date]);

  const fetchCardPng = useCallback(
    async (type: SocialCardType) => {
      const response = await fetch(buildSrc(type));
      if (!response.ok) {
        throw new Error(`Could not generate ${type} card.`);
      }
      return svgToPngBlob(await response.text());
    },
    [buildSrc],
  );

  const downloadCard = useCallback(
    async (type: SocialCardType) => {
      try {
        setGenerating({ type, action: "download" });
        setStatus("generating image");
        const blob = await fetchCardPng(type);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `shiprank-${username}-${type}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showStatus("downloaded");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "download failed");
      } finally {
        setGenerating(null);
      }
    },
    [fetchCardPng, showStatus, username],
  );

  const copyCard = useCallback(
    async (type: SocialCardType) => {
      try {
        setGenerating({ type, action: "copy" });
        setStatus("generating image");
        const blob = await fetchCardPng(type);
        if (
          typeof ClipboardItem === "undefined" ||
          !navigator.clipboard?.write
        ) {
          throw new Error("image copy is not supported here");
        }
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        showStatus("copied");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "copy failed");
      } finally {
        setGenerating(null);
      }
    },
    [fetchCardPng, showStatus],
  );

  const markPreviewLoaded = useCallback((type: SocialCardType) => {
    setLoadedPreviews((current) => new Set(current).add(type));
    setStatus((currentStatus) =>
      currentStatus === "generating preview" ? null : currentStatus,
    );
  }, []);

  const selectCard = useCallback(
    (type: SocialCardType) => {
      setActiveType(type);
      if (!loadedPreviews.has(type)) setStatus("generating preview");
    },
    [loadedPreviews],
  );

  const activeMeta =
    SOCIAL_CARDS.find((card) => card.type === activeType) ?? SOCIAL_CARDS[0];

  return (
    <>
      <button className="button" type="button" onClick={openSharePanel}>
        share
      </button>

      {open ? (
        <div className="share-layer" role="presentation">
          <button
            aria-label="close share panel"
            className="share-backdrop"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            aria-modal="true"
            className="share-panel"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="share-panel-head">
              <div>
                <div className="profile-kicker">share image</div>
                <h2>{activeMeta.title}</h2>
              </div>
              <button
                aria-label="close"
                className="icon-button share-close"
                onClick={() => setOpen(false)}
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="share-card-grid">
              {SOCIAL_CARDS.map((card) => {
                const selected = card.type === activeType;
                const hasLoaded = loadedPreviews.has(card.type);
                const shouldRenderPreview = open && (selected || hasLoaded);
                const loading = shouldRenderPreview && !hasLoaded;
                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected ? "share-card-option active" : "share-card-option"
                    }
                    key={card.type}
                    onClick={() => selectCard(card.type)}
                    type="button"
                  >
                    <div className="share-card-preview">
                      {loading ? (
                        <div className="share-card-loading" aria-hidden="true">
                          <span />
                        </div>
                      ) : null}
                      {shouldRenderPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={loading ? "is-loading" : ""}
                          src={buildSrc(card.type)}
                          alt={card.title}
                          onLoad={() => markPreviewLoaded(card.type)}
                          onError={() => markPreviewLoaded(card.type)}
                        />
                      ) : (
                        <div className="share-card-placeholder" aria-hidden="true">
                          {card.title}
                        </div>
                      )}
                    </div>
                    <span>{card.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="share-actions">
              <button
                className="button cta-button"
                disabled={Boolean(generating)}
                onClick={() => downloadCard(activeType)}
                type="button"
              >
                {generating?.action === "download" ? "generating" : "download"}
              </button>
              <button
                className="button"
                disabled={Boolean(generating)}
                onClick={() => copyCard(activeType)}
                type="button"
              >
                {generating?.action === "copy" ? "generating" : "copy image"}
              </button>
              <button
                className="button button-secondary"
                disabled={Boolean(generating)}
                onClick={shareText}
                type="button"
              >
                post link
              </button>
              {status ? <span className="share-status">{status}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
