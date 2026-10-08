import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { Chat } from "@/components/chat";
import { askStream } from "@/lib/ask-stream";
import { response } from "./fixtures";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params }));
vi.mock("@/lib/ask-stream", () => ({ askStream: vi.fn() }));
vi.mock("@/lib/actions", () => ({
  citationFor: vi.fn(), copyText: vi.fn(), shareOrCopy: vi.fn(), shareText: vi.fn(), speak: vi.fn(),
}));

class Recorder {
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio".repeat(500)], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
beforeEach(() => {
  navigation.params = new URLSearchParams();
  vi.mocked(askStream).mockReset().mockResolvedValue(response);
  stopTrack.mockReset();
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Ñaata nit ñoo dëkk Sénégal ?", language: "wo" }) }));
});

async function dictate() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Dicter une question" }));
  await user.click(await screen.findByRole("button", { name: "Terminer l’enregistrement" }));
  return user;
}

it("allows review and correction of a Wolof transcription before sending with its detected language", async () => {
  render(<Chat />);
  const user = await dictate();
  await screen.findByText("Texte reconnu. Relisez et corrigez avant d’envoyer.");
  expect(askStream).not.toHaveBeenCalled();
  expect(stopTrack).toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Ñaata nit ñoo dëkk Sénégal ?");
  await user.type(screen.getByRole("textbox"), " Corrigé");
  await user.click(screen.getByRole("button", { name: "Envoyer la question" }));
  await waitFor(() => expect(askStream).toHaveBeenCalledOnce());
  expect(vi.mocked(askStream).mock.calls[0][0]).toContain("Corrigé");
  expect(vi.mocked(askStream).mock.calls[0][4]).toBe("wo");
});

it("retains opt-in automatic sending and its preference", async () => {
  render(<Chat />);
  await userEvent.setup().click(screen.getByRole("checkbox", { name: "Envoyer automatiquement après la dictée" }));
  expect(localStorage.getItem("samastat.voice.autoSend")).toBe("true");
  await dictate();
  await waitFor(() => expect(askStream).toHaveBeenCalledOnce());
  expect(vi.mocked(askStream).mock.calls[0][4]).toBe("wo");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
});

it("does not transcribe or send when leaving during recording", async () => {
  const { unmount } = render(<Chat />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Dicter une question" }));
  unmount();
  expect(stopTrack).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(askStream).not.toHaveBeenCalled();
});

it("requires review when a dictation exceeds the question limit, even with automatic sending enabled", async () => {
  localStorage.setItem("samastat.voice.autoSend", "true");
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ text: "Longue question ".repeat(50), language: "fr" }) } as Response);
  render(<Chat />);
  await dictate();
  await screen.findByText("Texte limité à 500 caractères. Relisez et corrigez avant d’envoyer.");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toHaveLength(500);
  expect(askStream).not.toHaveBeenCalled();
});

it("shows a transcription error without losing the existing draft", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("Service indisponible"));
  render(<Chat />);
  await userEvent.setup().type(screen.getByRole("textbox"), "Mon brouillon");
  await dictate();
  await screen.findByText("Service indisponible");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Mon brouillon");
  expect(askStream).not.toHaveBeenCalled();
});

it("stops a late microphone stream after unmount", async () => {
  let grant!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
  const { unmount } = render(<Chat />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Dicter une question" }));
  unmount();
  await act(async () => grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream));
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
