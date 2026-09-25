import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("./api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api-client")>()),
  apiRequest,
}));

import { transcreverAudio } from "./voz.functions";

describe("transcrição do lançamento por áudio", () => {
  beforeEach(() => apiRequest.mockReset());

  it("envia o blob como multipart com extensão compatível", async () => {
    apiRequest.mockResolvedValue({ texto: "Paguei a conta de energia" });
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mp4" });

    await expect(transcreverAudio({ data: audio })).resolves.toEqual({
      texto: "Paguei a conta de energia",
    });
    expect(apiRequest).toHaveBeenCalledOnce();
    const request = apiRequest.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe("POST");
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("audio")).toMatchObject({ name: "lancamento.m4a" });
  });

  it("rejeita gravação vazia antes de chamar a API", async () => {
    await expect(transcreverAudio({ data: new Blob([], { type: "audio/webm" }) })).rejects.toThrow(
      "gravação de áudio está vazia",
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
