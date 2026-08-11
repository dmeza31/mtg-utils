"use client";

/**
 * SPEC-B Task B-4 (story B1). Aspect ratio locked to real card proportions
 * (745:1040) so the grid never reflows as images arrive — the border/muted
 * background box is the skeleton; there's no separate loading state to
 * track because the box is already the right shape before the image loads.
 */
import { useState } from "react";
import type { Card, CardId } from "@/domain/model/types";

export interface CardTileProps {
  readonly cardId: CardId;
  /** `undefined` when the repository can't resolve this card (FR-2.11). */
  readonly card: Card | undefined;
  readonly quantity: number;
}

function QuantityBadge({ quantity }: { quantity: number }) {
  return (
    <span
      aria-hidden="true"
      className="bg-foreground text-background absolute top-1 right-1 rounded-full px-1.5 py-0.5 text-xs font-bold shadow"
    >
      {quantity}×
    </span>
  );
}

export function CardTile({ cardId, card, quantity }: CardTileProps) {
  const [faceIndex, setFaceIndex] = useState<0 | 1>(0);

  if (card === undefined) {
    return (
      <div
        data-testid="card-tile"
        data-card-id={cardId}
        data-card-name=""
        data-quantity={quantity}
        className="border-border bg-muted relative flex aspect-[745/1040] flex-col items-center justify-center rounded-lg border p-2 text-center"
      >
        <span className="text-muted-foreground text-xs">Unresolved card</span>
        <QuantityBadge quantity={quantity} />
      </div>
    );
  }

  // Split cards (Fire // Ice) share one image and aren't flippable in the
  // UI sense; only cards where each face carries its own art are (FR-2.9).
  const faces = card.faces;
  const isFlippable =
    faces !== undefined && faces.length === 2 && faces.every((f) => f.imageUris !== undefined);
  const face = isFlippable ? faces[faceIndex] : undefined;

  const displayName = face?.name ?? card.name;
  const displayTypeLine = face?.typeLine ?? card.typeLine;
  const displayManaCost = face?.manaCost ?? card.manaCost;
  const imageUris = face?.imageUris ?? card.imageUris;
  const imageSrc = imageUris?.small ?? imageUris?.normal;

  return (
    <div
      className="relative"
      data-testid="card-tile"
      data-card-id={card.oracleId}
      data-card-name={card.name}
      data-quantity={quantity}
    >
      <div className="border-border bg-muted relative aspect-[745/1040] overflow-hidden rounded-lg border">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`${quantity}× ${displayName}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col justify-between p-2 text-left"
            role="img"
            aria-label={`${quantity}× ${displayName}`}
          >
            <div>
              <p className="text-foreground text-xs font-semibold">{displayName}</p>
              <p className="text-muted-foreground text-[10px]">{displayTypeLine}</p>
            </div>
            {displayManaCost !== undefined ? (
              <p className="text-muted-foreground text-[10px]">{displayManaCost}</p>
            ) : null}
          </div>
        )}
        <QuantityBadge quantity={quantity} />
      </div>

      {isFlippable ? (
        <>
          <button
            type="button"
            data-testid="card-tile-flip"
            aria-pressed={faceIndex === 1}
            aria-label={`Flip ${card.name}`}
            className="border-border bg-background hover:bg-muted absolute right-1 bottom-1 rounded-full border p-1 text-xs shadow"
            onClick={(event) => {
              // CardTile is often wrapped in a CardDetail trigger (B-9);
              // flipping the grid image must not also open the detail view.
              event.stopPropagation();
              setFaceIndex((i) => (i === 0 ? 1 : 0));
            }}
          >
            <span aria-hidden="true">⇄</span>
          </button>
          <span className="sr-only" role="status">
            {faceIndex === 1
              ? `Showing back face: ${displayName}`
              : `Showing front face: ${displayName}`}
          </span>
        </>
      ) : null}
    </div>
  );
}
