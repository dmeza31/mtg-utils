"use client";

/**
 * SPEC-A Task A-9/A-10 — the composition root. This is the one place that
 * instantiates the production `ScryfallCardRepository` (client + cache) and
 * hands it to the UI through React context, so swapping the client-side
 * Scryfall client for a v2 server proxy touches this file only — `features`
 * never imports `adapters` directly (CLAUDE.md's layering rule).
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStore } from "zustand";
import { createIdFactory, type IdFactory } from "../domain/model/ids";
import type { CardRepository } from "../domain/ports/CardRepository";
import { CardCache } from "../adapters/scryfall/CardCache";
import { ScryfallCardRepository } from "../adapters/scryfall/ScryfallCardRepository";
import { ScryfallClient } from "../adapters/scryfall/ScryfallClient";
import { createWorkspaceStore, type WorkspaceState } from "./workspaceStore";

type WorkspaceStoreApi = ReturnType<typeof createWorkspaceStore>;

interface WorkspaceContextValue {
  readonly store: WorkspaceStoreApi;
  readonly repository: CardRepository;
  readonly idFactory: IdFactory;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function createWorkspaceContextValue(): WorkspaceContextValue {
  const idFactory = createIdFactory(() => crypto.randomUUID());
  const store = createWorkspaceStore(idFactory);
  const repository = new ScryfallCardRepository(new ScryfallClient(), new CardCache());
  return { store, repository, idFactory };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => createWorkspaceContextValue(), []);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (ctx === undefined) {
    throw new Error("Workspace hooks must be used within a <WorkspaceProvider>");
  }
  return ctx;
}

export function useWorkspaceState<T>(selector: (state: WorkspaceState) => T): T {
  const { store } = useWorkspaceContext();
  return useStore(store, selector);
}

export function useWorkspaceStoreApi(): WorkspaceStoreApi {
  return useWorkspaceContext().store;
}

export function useCardRepository(): CardRepository {
  return useWorkspaceContext().repository;
}

export function useIdFactory(): IdFactory {
  return useWorkspaceContext().idFactory;
}
