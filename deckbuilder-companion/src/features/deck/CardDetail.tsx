"use client";

/**
 * SPEC-B Task B-9 (story B4, FR-3.7). Wraps a `CardTile` with two ways to
 * see more: a desktop hover popover (Radix HoverCard, opens after a short
 * delay) and a click/tap modal dialog (Radix Dialog, for touch where hover
 * doesn't exist and for keyboard users). Both render the same detail body.
 *
 * The trigger is a `role="button"` div, not a real `<button>` — `CardTile`
 * already renders its own flip `<button>` for DFCs, and nesting a `<button>`
 * inside a `<button>` is invalid HTML. The flip button stops propagation so
 * flipping the grid image doesn't also open the detail dialog.
 */
import * as Dialog from "@radix-ui/react-dialog";
import * as HoverCard from "@radix-ui/react-hover-card";
import { useState, type KeyboardEvent } from "react";
import { copiesOf } from "@/domain/deck/queries";
import type { Card, CardId, Deck } from "@/domain/model/types";
import { CardTile } from "./CardTile";

export interface CardDetailProps {
  readonly cardId: CardId;
  readonly card: Card | undefined;
  readonly quantity: number;
  readonly deck: Deck;
}

function DetailBody({
  card,
  faceIndex,
  onFlip,
  maindeckQty,
  sideboardQty,
}: {
  card: Card;
  faceIndex: 0 | 1;
  onFlip: () => void;
  maindeckQty: number;
  sideboardQty: number;
}) {
  const faces = card.faces;
  const isFlippable = faces !== undefined && faces.length === 2;
  const face = isFlippable ? faces[faceIndex] : undefined;

  const displayName = face?.name ?? card.name;
  const displayTypeLine = face?.typeLine ?? card.typeLine;
  const displayManaCost = face?.manaCost ?? card.manaCost;
  const displayOracleText = face?.oracleText ?? card.oracleText;
  const imageUris = face?.imageUris ?? card.imageUris;
  const largeImage = imageUris?.large ?? imageUris?.normal ?? imageUris?.small;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-foreground text-lg font-semibold">{displayName}</p>
          <p className="text-muted-foreground text-sm">{displayTypeLine}</p>
        </div>
        {displayManaCost !== undefined ? (
          <span className="text-muted-foreground text-sm">{displayManaCost}</span>
        ) : null}
      </div>
      {largeImage !== undefined ? (
        <img src={largeImage} alt={displayName} className="w-full rounded-lg" />
      ) : null}
      {displayOracleText !== undefined ? (
        <p
          className="text-foreground text-sm whitespace-pre-line"
          data-testid="card-detail-oracle-text"
        >
          {displayOracleText}
        </p>
      ) : null}
      <div className="text-muted-foreground text-sm" data-testid="card-detail-zones">
        {maindeckQty > 0 ? <p>Maindeck: {maindeckQty}</p> : null}
        {sideboardQty > 0 ? <p>Sideboard: {sideboardQty}</p> : null}
      </div>
      {isFlippable ? (
        <button
          type="button"
          data-testid="card-detail-flip"
          className="text-sm underline underline-offset-2"
          onClick={onFlip}
        >
          Show{" "}
          {faceIndex === 0 ? (faces?.[1]?.name ?? "back face") : (faces?.[0]?.name ?? "front face")}
        </button>
      ) : null}
    </div>
  );
}

export function CardDetail({ cardId, card, quantity, deck }: CardDetailProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [faceIndex, setFaceIndex] = useState<0 | 1>(0);

  if (card === undefined) {
    return <CardTile cardId={cardId} card={card} quantity={quantity} />;
  }

  const maindeckQty = copiesOf(deck, cardId, "maindeck");
  const sideboardQty = copiesOf(deck, cardId, "sideboard");

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only handle Enter/Space when the trigger div itself is focused — not
    // when the event is merely bubbling up from CardTile's own flip button.
    // Calling preventDefault() on a bubbled keydown would cancel the flip
    // button's native "Enter activates the focused button" behaviour.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setDialogOpen(true);
    }
  };

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
      <HoverCard.Root openDelay={400}>
        <HoverCard.Trigger asChild>
          <Dialog.Trigger asChild>
            <div
              role="button"
              tabIndex={0}
              data-testid="card-detail-trigger"
              aria-haspopup="dialog"
              onKeyDown={onTriggerKeyDown}
            >
              <CardTile cardId={cardId} card={card} quantity={quantity} />
            </div>
          </Dialog.Trigger>
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            data-testid="card-detail-hovercard"
            className="bg-background border-border z-50 w-80 rounded-lg border p-4 shadow-lg"
            sideOffset={8}
          >
            <DetailBody
              card={card}
              faceIndex={faceIndex}
              onFlip={() => setFaceIndex((i) => (i === 0 ? 1 : 0))}
              maindeckQty={maindeckQty}
              sideboardQty={sideboardQty}
            />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          data-testid="card-detail-dialog"
          className="bg-background border-border fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-4 shadow-xl"
        >
          <Dialog.Title className="sr-only">{card.name}</Dialog.Title>
          <Dialog.Description className="sr-only">Card detail for {card.name}</Dialog.Description>
          <DetailBody
            card={card}
            faceIndex={faceIndex}
            onFlip={() => setFaceIndex((i) => (i === 0 ? 1 : 0))}
            maindeckQty={maindeckQty}
            sideboardQty={sideboardQty}
          />
          <Dialog.Close asChild>
            <button
              type="button"
              data-testid="card-detail-close"
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
            >
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
