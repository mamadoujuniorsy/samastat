import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { AskEvent, AskResponse } from "@/lib/types";
import { Chat } from "@/components/chat";
import { askStream } from "@/lib/ask-stream";
import { response } from "./fixtures";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params }));
vi.mock("@/lib/ask-stream", () => ({ askStream: vi.fn() }));
vi.mock("@/lib/actions", () => ({
  citationFor: vi.fn(), copyText: vi.fn(), shareOrCopy: vi.fn(), shareText: vi.fn(), speak: vi.fn(),
}));

beforeEach(() => {
  navigation.params = new URLSearchParams();
  vi.mocked(askStream).mockReset();
});

it("shows real SSE progress, preserves sources/exports, and passes conversation history", async () => {
  let emit!: (event: AskEvent) => void;
  let finish!: (value: AskResponse) => void;
  vi.mocked(askStream).mockImplementation((_q, _h, callback) => {
    emit = callback;
    return new Promise((resolve) => { finish = resolve; });
  });
  render(<Chat />);
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), "Population du Sénégal ?{Enter}");
  expect(askStream).toHaveBeenCalledOnce();
  act(() => emit({ type: "step", step: { kind: "search", label: "Recherche des indicateurs…", at: "2026-10-08T12:00:00Z" } }));
  expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Recherche des indicateurs"))).toBe(true);
  const scrollCount = vi.mocked(Element.prototype.scrollIntoView).mock.calls.length;
  act(() => emit({ type: "step", step: { kind: "fetch", label: "Récupération des valeurs", at: "2026-10-08T12:00:01Z" } }));
  expect(vi.mocked(Element.prototype.scrollIntoView).mock.calls.length).toBe(scrollCount);
  await act(async () => finish(response));
  expect(screen.getByText("Réponse disponible. Retrouvez le résultat et les sources dans la conversation.")).toBeDefined();
  expect(screen.getByText("2 étapes de traitement").closest("details")?.open).toBe(false);
  expect(screen.getByRole("link", { name: "Page d'origine (ANSD)" }).getAttribute("href")).toBe("https://www.ansd.sn");
  expect(screen.getByRole("link", { name: "CSV" }).getAttribute("href")).toContain("pop-sen-2023");
  expect(JSON.parse(localStorage.getItem("samastat.session.v2")!)[0].steps).toHaveLength(2);
  await user.type(screen.getByRole("textbox"), "Et à Thiès ?{Enter}");
  expect(vi.mocked(askStream).mock.calls[1][1]).toEqual([
    { role: "user", text: "Population du Sénégal ?" }, { role: "assistant", text: response.answer },
  ]);
});

it("restores a saved session without overwriting it during initialization", () => {
  localStorage.setItem("samastat.session.v2", JSON.stringify([{ id: "saved", question: response.question, response }]));
  render(<Chat />);
  expect(screen.getByRole("heading", { name: response.question })).toBeDefined();
  expect(JSON.parse(localStorage.getItem("samastat.session.v2")!)).toHaveLength(1);
});

it("starts a new session on same-page navigation and applies catalogue question links", () => {
  localStorage.setItem("samastat.session.v2", JSON.stringify([{ id: "saved", question: response.question, response }]));
  const { rerender } = render(<Chat />);
  navigation.params = new URLSearchParams("new=1");
  rerender(<Chat />);
  expect(screen.queryByRole("heading", { name: response.question })).toBeNull();
  expect(JSON.parse(localStorage.getItem("samastat.session.v2")!)).toEqual([]);
  navigation.params = new URLSearchParams("q=Inflation");
  rerender(<Chat />);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Inflation");
});

it("interrupts a pending answer and allows retry without overlapping requests", async () => {
  vi.mocked(askStream).mockImplementation((_q, _h, _cb, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  render(<Chat />);
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), "Population{Enter}");
  await user.click(screen.getByRole("button", { name: "Arrêter la question en cours" }));
  expect(await screen.findByText("Question interrompue avant la réponse.")).toBeDefined();
  vi.mocked(askStream).mockResolvedValue(response);
  await user.click(screen.getByRole("button", { name: "Relancer" }));
  await waitFor(() => expect(screen.getByRole("article")).toBeDefined());
  expect(askStream).toHaveBeenCalledTimes(2);
});

it("keeps Enter, Shift+Enter and IME composition safe", async () => {
  vi.mocked(askStream).mockResolvedValue(response);
  render(<Chat />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Population" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(askStream).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(askStream).toHaveBeenCalledOnce());
});

it("shows no-data suggestions and transport errors without losing the conversation", async () => {
  vi.mocked(askStream).mockResolvedValue({ ...response, status: "no_data", answer: "Aucune valeur disponible.",
    data: [], suggestions: ["Population du Sénégal ?"], meta: { ...response.meta, guard: null, permalink: null } });
  render(<Chat />);
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), "Question sans donnée{Enter}");
  expect(await screen.findByText("Aucune valeur disponible.")).toBeDefined();
  vi.mocked(askStream).mockRejectedValue(new Error("Connexion interrompue"));
  await user.click(screen.getByRole("button", { name: "Population du Sénégal ?" }));
  expect(await screen.findByText("Connexion interrompue")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Question sans donnée" })).toBeDefined();
  vi.mocked(askStream).mockResolvedValue(response);
  await user.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByRole("region", { name: "Sources des valeurs" })).toBeDefined();
});
