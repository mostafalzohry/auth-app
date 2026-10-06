import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WelcomeGate from "@/components/auth/welcome-gate";
import { jsonResponse, mockFetch, user } from "@/test-utils/fetch-mock";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const SAVED_URL = "/api/auth/avatar?v=1";
const REPLACED_URL = "/api/auth/avatar?v=2";
const withAvatar = (avatarUrl: string) => ({ user: { ...user, avatarUrl } });

const png = (name = "me.png", size = 10, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => {
      const url = `blob:preview-${++n}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});

afterEach(() => localStorage.clear());

async function renderHome(
  ...responses: Array<Response | Error | Promise<Response>>
) {
  const fetchMock = mockFetch(jsonResponse(200, { user }), ...responses);
  render(<WelcomeGate />);
  await screen.findByRole("heading", { level: 1 });
  return { fetchMock, u: userEvent.setup({ applyAccept: false }) };
}

const fileInput = () => screen.getByLabelText("Profile photo file");
const images = () => Array.from(document.querySelectorAll("img"));

describe("profile photo", () => {
  it("shows a saved photo in both the header and the profile", async () => {
    mockFetch(jsonResponse(200, withAvatar(SAVED_URL)));
    render(<WelcomeGate />);
    await screen.findByRole("heading", { level: 1 });

    expect(images().map((img) => img.getAttribute("src"))).toEqual([
      SAVED_URL,
      SAVED_URL,
    ]);
    expect(screen.queryByText("ME")).toBeNull();
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
  });

  it("falls back to initials when the saved image fails to load", async () => {
    mockFetch(jsonResponse(200, withAvatar(SAVED_URL)));
    render(<WelcomeGate />);
    await screen.findByRole("heading", { level: 1 });

    for (const img of images()) img.dispatchEvent(new Event("error"));

    await waitFor(() => expect(screen.getAllByText("ME")).toHaveLength(2));
  });

  it("previews a chosen photo and cancels without any request", async () => {
    const { fetchMock, u } = await renderHome();

    await u.upload(fileInput(), png());

    expect(images()).toHaveLength(1);
    expect(images()[0].getAttribute("src")).toBe("blob:preview-1");
    expect(screen.getByRole("button", { name: "Save photo" })).toBeTruthy();

    await u.click(screen.getByRole("button", { name: "Cancel" }));

    expect(images()).toHaveLength(0);
    expect(revoked).toEqual(["blob:preview-1"]);
    expect(screen.getByRole("button", { name: "Choose photo" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("revokes the old preview when another file is chosen and on unmount", async () => {
    mockFetch(jsonResponse(200, { user }));
    const view = render(<WelcomeGate />);
    await screen.findByRole("heading", { level: 1 });
    const u = userEvent.setup({ applyAccept: false });

    await u.upload(fileInput(), png("a.png"));
    await u.upload(fileInput(), png("b.png"));
    expect(revoked).toEqual(["blob:preview-1"]);

    view.unmount();
    expect(revoked).toEqual(["blob:preview-1", "blob:preview-2"]);
  });

  it.each([
    [
      "an unsupported type",
      () => png("a.gif", 10, "image/gif"),
      /JPEG, PNG or WebP/,
    ],
    ["an SVG", () => png("a.svg", 10, "image/svg+xml"), /JPEG, PNG or WebP/],
    [
      "a file over 2 MB",
      () => png("big.png", 2 * 1024 * 1024 + 1),
      /larger than 2 MB/,
    ],
    ["an empty file", () => png("empty.png", 0), /empty/],
  ])("rejects %s before any request", async (_label, make, message) => {
    const { fetchMock, u } = await renderHome();

    await u.upload(fileInput(), make());

    expect((await screen.findByRole("alert")).textContent).toMatch(message);
    expect(created).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Save photo" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uploads multipart with credentials and CSRF, then updates both avatars", async () => {
    const { fetchMock, u } = await renderHome(
      jsonResponse(200, withAvatar(SAVED_URL)),
    );
    const file = png();

    await u.upload(fileInput(), file);
    await u.click(screen.getByRole("button", { name: "Save photo" }));

    expect(await screen.findByText("Profile photo updated.")).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/auth/avatar");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "X-Auth-Request": "1" },
    });
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(Array.from(body.keys())).toEqual(["file"]);
    expect(body.get("file")).toBe(file);

    expect(images().map((img) => img.getAttribute("src"))).toEqual([
      SAVED_URL,
      SAVED_URL,
    ]);
    expect(revoked).toEqual(["blob:preview-1"]);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
  });

  it("replaces an existing photo and refreshes both avatars to the new URL", async () => {
    mockFetch(
      jsonResponse(200, withAvatar(SAVED_URL)),
      jsonResponse(200, withAvatar(REPLACED_URL)),
    );
    render(<WelcomeGate />);
    await screen.findByRole("heading", { level: 1 });
    const u = userEvent.setup({ applyAccept: false });

    await u.upload(fileInput(), png());
    await u.click(screen.getByRole("button", { name: "Save photo" }));

    await waitFor(() =>
      expect(images().map((img) => img.getAttribute("src"))).toEqual([
        REPLACED_URL,
        REPLACED_URL,
      ]),
    );
  });

  it("shows a pending state and blocks duplicate uploads", async () => {
    let resolve!: (response: Response) => void;
    const { fetchMock, u } = await renderHome(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    await u.upload(fileInput(), png());
    const save = screen.getByRole("button", { name: "Save photo" });

    await u.click(save);
    await u.click(screen.getByRole("button", { name: /saving/i }));

    const pending = screen.getByRole("button", { name: /saving/i });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect(pending.getAttribute("aria-busy")).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText("Uploading photo…")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolve(jsonResponse(200, withAvatar(SAVED_URL)));
    expect(await screen.findByText("Profile photo updated.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, /could not be read/],
    [413, /too large/],
    [415, /JPEG, PNG or WebP/],
    [429, /too many times/],
    [503, /could not be saved/],
  ])(
    "keeps the saved photo and shows a safe error for %s",
    async (status, message) => {
      mockFetch(
        jsonResponse(200, withAvatar(SAVED_URL)),
        jsonResponse(status, { message: "internal sharp/vips detail" }),
      );
      render(<WelcomeGate />);
      await screen.findByRole("heading", { level: 1 });
      const u = userEvent.setup({ applyAccept: false });

      await u.upload(fileInput(), png());
      await u.click(screen.getByRole("button", { name: "Save photo" }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(message);
      expect(alert.textContent).not.toMatch(/sharp|vips/);
      expect(screen.getByRole("button", { name: "Save photo" })).toBeTruthy();
      await u.click(screen.getByRole("button", { name: "Cancel" }));
      expect(images().map((img) => img.getAttribute("src"))).toEqual([
        SAVED_URL,
        SAVED_URL,
      ]);
    },
  );

  it("shows a network error and allows a successful retry", async () => {
    const { fetchMock, u } = await renderHome(
      new TypeError("Failed to fetch"),
      jsonResponse(200, withAvatar(SAVED_URL)),
    );
    await u.upload(fileInput(), png());

    await u.click(screen.getByRole("button", { name: "Save photo" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not reach the server/,
    );

    await u.click(screen.getByRole("button", { name: "Save photo" }));
    expect(await screen.findByText("Profile photo updated.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not persist image data in browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { u } = await renderHome(jsonResponse(200, withAvatar(SAVED_URL)));

    await u.upload(fileInput(), png());
    await u.click(screen.getByRole("button", { name: "Save photo" }));
    await screen.findByText("Profile photo updated.");

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("rejects an upload response without a valid user", async () => {
    const { u } = await renderHome(jsonResponse(200, { user: { id: 1 } }));

    await u.upload(fileInput(), png());
    await u.click(screen.getByRole("button", { name: "Save photo" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Profile photo updated.")).toBeNull();
  });

  it("keeps the sign out button and the exact welcome text", async () => {
    await renderHome();

    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByText("Welcome to the application.")).toBeTruthy();
    expect(
      within(screen.getByRole("main")).getByRole("link", {
        name: /api documentation/i,
      }),
    ).toBeTruthy();
  });
});
