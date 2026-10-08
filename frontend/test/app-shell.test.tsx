import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

it("opens a native modal, exposes public navigation, and restores focus on Escape", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  const show = vi.spyOn(HTMLDialogElement.prototype, "showModal");
  render(<AppShell current="/catalogue"><main>Catalogue</main></AppShell>);
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: "Ouvrir le menu" });
  await user.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Menu SamaStat" });
  expect(show).toHaveBeenCalledOnce();
  expect(document.body.style.overflow).toBe("hidden");
  expect(within(dialog).getByRole("link", { name: "Catalogue des données" }).getAttribute("aria-current")).toBe("page");
  expect(within(dialog).getByRole("link", { name: "Méthode et sources" }).getAttribute("href")).toBe("/methode");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Fermer le menu");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe("");
});

it("cycles and persists system/light/dark themes and synchronizes browser chrome", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
  const { unmount } = render(<AppShell current="/"><main>Chat</main></AppShell>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ouvrir le menu" }));
  await user.click(screen.getByRole("button", { name: "Thème système" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(meta.content).toBe("#f6f4ee");
  await user.click(screen.getByRole("button", { name: "Thème clair" }));
  expect(localStorage.getItem("samastat.theme")).toBe("dark");
  expect(meta.content).toBe("#141517");
  await user.click(screen.getByRole("button", { name: "Thème sombre" }));
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(localStorage.getItem("samastat.theme")).toBeNull();
  const media = vi.mocked(window.matchMedia).mock.results.find((r) => r.value.addEventListener.mock.calls.length)?.value;
  media.matches = true;
  act(() => media.addEventListener.mock.calls[0][1]());
  expect(meta.content).toBe("#141517");
  unmount();
  meta.remove();
});

it("keeps staff and admin-only links behind the existing role checks", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Agent", role: "analyste" }) }));
  render(<AppShell current="/usage"><main>Usage</main></AppShell>);
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le menu" }));
  expect(await screen.findByRole("link", { name: "Tableau de bord ANSD" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Gestion du personnel" })).toBeNull();
});
