import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignStudio } from "./DesignStudio";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(), insert: vi.fn(), upload: vi.fn(),
  session: { user: { id: "test-owner" }, access_token: "test-token" },
}));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/BackButton", () => ({ BackButton: () => null }));
vi.mock("@/lib/use-auth", () => ({ useAuth: () => ({ session: mocks.session, loading: false }) }));
vi.mock("@/lib/accessories.functions", () => ({ suggestAccessories: vi.fn() }));
vi.mock("@/lib/use-coins", () => ({ useCoins: () => ({ data: { wallet: { balance: 100, free_used: 0 }, settings: { generation_cost: 1 } }, refetch: vi.fn() }) }));
vi.mock("@/lib/stream-image", () => ({ streamImage: mocks.stream }));
vi.mock("@/lib/fabric", () => ({
  prepareFabric: async (file: File) => ({ file, previewUrl: "data:image/png;base64,dGVzdA==", warnings: [] }),
  dataUrlToBlob: async () => new Blob(["test"]),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ insert: mocks.insert }),
  storage: { from: () => ({ upload: mocks.upload, remove: vi.fn() }) },
} }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function upload(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("Upload input missing");
  fireEvent.change(input, { target: { files: [new File(["fabric"], "fabric.jpg", { type: "image/jpeg" })] } });
  await screen.findByRole("button", { name: "Replace" });
}

describe("shoe and bag generation flows", () => {
  it.each([
    { kind: "shoes" as const, original: "Sneaker", changed: "Boot", style: "Sporty" },
    { kind: "bags" as const, original: "Tote", changed: "Clutch", style: "Elegant" },
  ])("saves $kind with original preferences after controls change", async ({ kind, original, changed, style }) => {
    mocks.stream.mockImplementation(async (_url, _form, frame) => frame("data:image/png;base64,dGVzdA==", true));
    mocks.upload.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    const { container } = render(<DesignStudio kind={kind} />);
    await upload(container);
    fireEvent.click(screen.getByRole("button", { name: "Generate 3 designs" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate again" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: changed }));
    fireEvent.click(screen.getByRole("button", { name: "Silver" }));
    const save = screen.getAllByRole("button", { name: "Save" })[0];
    if (!save) throw new Error("Save missing");
    fireEvent.click(save);
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      category: `${kind === "shoes" ? "Shoe" : "Bag"} · ${original}`,
      style: `${style} · Gold hardware`, occasion: "Everyday",
    })));
  });

  it("blocks overlapping regeneration and duplicate saves", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let finish: (() => void) | undefined;
    mocks.stream.mockImplementation(async (_url, _form, frame) => frame("data:image/png;base64,dGVzdA==", true));
    mocks.upload.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    const { container } = render(<DesignStudio kind="shoes" />);
    await upload(container);
    fireEvent.click(screen.getByRole("button", { name: "Generate 3 designs" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate again" })).toBeEnabled());
    mocks.stream.mockImplementation((_url, _form, frame) => new Promise<void>((resolve) => {
      finish = () => { frame("data:image/png;base64,dGVzdA==", true); resolve(); };
    }));
    const regenerate = screen.getAllByRole("button", { name: "Regenerate" })[0];
    if (!regenerate) throw new Error("Regenerate missing");
    fireEvent.click(regenerate);
    expect(screen.getByRole("button", { name: "Designing…" })).toBeDisabled();
    screen.getAllByRole("button", { name: "Regenerate" }).forEach((button) => {
      expect(button).toBeDisabled(); fireEvent.click(button);
    });
    expect(mocks.stream).toHaveBeenCalledTimes(4);
    if (!finish) throw new Error("Regeneration not started");
    await act(async () => { finish?.(); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate again" })).toBeEnabled());
    const save = screen.getAllByRole("button", { name: "Save" })[0];
    if (!save) throw new Error("Save missing");
    fireEvent.click(save); fireEvent.click(save);
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("allows a failed image to be regenerated without restarting the batch", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.stream.mockRejectedValue(new Error("Provider unavailable"));
    const { container } = render(<DesignStudio kind="bags" />);
    await upload(container);
    fireEvent.click(screen.getByRole("button", { name: "Generate 3 designs" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate again" })).toBeEnabled());
    expect(mocks.stream).toHaveBeenCalledTimes(3);
    mocks.stream.mockImplementation(async (_url, _form, frame) => frame("data:image/png;base64,dGVzdA==", true));
    const retry = screen.getAllByRole("button", { name: "Retry" })[0];
    if (!retry) throw new Error("Failed generation cannot be retried");
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1));
    expect(mocks.stream).toHaveBeenCalledTimes(4);
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(2);
  });

  it("limits the number of designs to between 2 and 4", async () => {
    const { container } = render(<DesignStudio kind="shoes" />);
    await upload(container);
    const more = screen.getByRole("button", { name: "More designs" });
    const fewer = screen.getByRole("button", { name: "Fewer designs" });
    fireEvent.click(more); fireEvent.click(more);
    expect(screen.getByRole("group", { name: "Number of designs" })).toHaveTextContent("4");
    expect(more).toBeDisabled();
    fireEvent.click(fewer); fireEvent.click(fewer); fireEvent.click(fewer);
    expect(screen.getByRole("group", { name: "Number of designs" })).toHaveTextContent("2");
    expect(fewer).toBeDisabled();
  });

  it("keeps finished designs when a new photo is uploaded until the user clears them", async () => {
    mocks.stream.mockImplementation(async (_url, _form, frame) => frame("data:image/png;base64,dGVzdA==", true));
    const { container } = render(<DesignStudio kind="shoes" />);
    await upload(container);
    fireEvent.click(screen.getByRole("button", { name: "Generate 3 designs" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate again" })).toBeEnabled());
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["fabric2"], "fabric2.jpg", { type: "image/jpeg" })] },
    });
    await screen.findByRole("button", { name: "Replace" });
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Clear designs" }));
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByText("Your shoe designs")).toBeInTheDocument();
  });
});