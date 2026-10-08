import { expect, it, vi } from "vitest";
import { askStream } from "@/lib/ask-stream";
import { response } from "./fixtures";

it("parses chunked server events without changing the request contract", async () => {
  const events = [
    { type: "step", step: { kind: "search", label: "Recherche Sénégal", at: "2026-10-08T12:00:00Z" } },
    { type: "answer", response },
  ];
  const bytes = new TextEncoder().encode(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""));
  const body = new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }));
  const callback = vi.fn();
  const signal = new AbortController().signal;
  expect(await askStream("Population", [], callback, signal, "wo")).toEqual(response);
  expect(callback.mock.calls.map(([event]) => event)).toEqual(events);
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ question: "Population", history: [], language: "wo" });
  expect(vi.mocked(fetch).mock.calls[0][1]!.signal).toBe(signal);
});

it("surfaces transport errors without inventing a final answer", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Limite atteinte" }) }));
  await expect(askStream("Population", [], vi.fn())).rejects.toThrow("Limite atteinte");
});
