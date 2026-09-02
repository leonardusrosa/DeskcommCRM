// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizarErroDoProvedor } from "@/lib/ai/erros/normalizador";
import { classificarResposta } from "@/lib/instalacao/prova-de-credito";

describe("Provider Error Normalization & Friendly Messages", () => {
  it("1. normalizes OpenCode Zen FreeUsageLimitError JSON payload into FREE_QUOTA_EXHAUSTED", () => {
    const rawZenError = '{"type":"error","error":{"type":"FreeUsageLimitError","message":"Error from provider (Console): Rate limit exceeded. Please try again later."}}';
    
    const res = normalizarErroDoProvedor(rawZenError, 429, "mimo-v2.5-free");
    
    expect(res.categoria).toBe("FREE_QUOTA_EXHAUSTED");
    expect(res.titulo).toBe("Limite gratuito atingido");
    expect(res.mensagem).toBe("Este modelo gratuito está temporariamente sem cota disponível. Tente novamente mais tarde ou escolha outro modelo.");
    expect(res.acaoSugerida).toBe("trocar_modelo");
    expect(res.httpStatus).toBe(429);
    // Never leaks raw json as titulo or mensagem
    expect(res.mensagem).not.toContain("FreeUsageLimitError");
    expect(res.mensagem).not.toContain("{");
  });

  it("2. normalizes rate limit errors into RATE_LIMIT (non-free model)", () => {
    const rateLimitError = '{"error":{"message":"Rate limit reached for requests per minute (RPM)","type":"requests","code":"rate_limit_exceeded"}}';
    
    const res = normalizarErroDoProvedor(rateLimitError, 429, "gpt-5.4");
    
    expect(res.categoria).toBe("RATE_LIMIT");
    expect(res.titulo).toBe("Limite de requisições excedido");
    expect(res.mensagem).toContain("Aguarde alguns instantes e tente novamente.");
    expect(res.acaoSugerida).toBe("tentar_novamente");
  });

  it("3. normalizes invalid API key errors into INVALID_API_KEY", () => {
    const authError = '{"error":{"message":"Incorrect API key provided: sk-ant-***","type":"invalid_request_error","code":"invalid_api_key"}}';
    
    const res = normalizarErroDoProvedor(authError, 401, "claude-sonnet-5");
    
    expect(res.categoria).toBe("INVALID_API_KEY");
    expect(res.titulo).toBe("Chave de API inválida ou rejeitada");
    expect(res.mensagem).toContain("O provedor não reconheceu a chave de API informada.");
    expect(res.acaoSugerida).toBe("atualizar_chave");
  });

  it("4. normalizes insufficient credits errors into INSUFFICIENT_CREDITS", () => {
    const creditError = '{"type":"error","error":{"type":"CreditsError","message":"Credit balance is too low to fulfill request"}}';
    
    const res = normalizarErroDoProvedor(creditError, 402, "gpt-5.4");
    
    expect(res.categoria).toBe("INSUFFICIENT_CREDITS");
    expect(res.titulo).toBe("Saldo insuficiente no provedor");
    expect(res.mensagem).toContain("Recarregue os créditos no painel do provedor.");
    expect(res.acaoSugerida).toBe("painel_provedor");
  });

  it("5. normalizes model unavailable errors into MODEL_UNAVAILABLE", () => {
    const modelError = '{"error":{"message":"The model deepseek-chat does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';
    
    const res = normalizarErroDoProvedor(modelError, 404, "deepseek-chat");
    
    expect(res.categoria).toBe("MODEL_UNAVAILABLE");
    expect(res.titulo).toBe("Modelo indisponível no provedor");
    expect(res.mensagem).toContain("O modelo selecionado não está disponível");
    expect(res.acaoSugerida).toBe("trocar_modelo");
  });

  it("6. normalizes timeout and 5xx errors into TIMEOUT and PROVIDER_TEMPORARILY_UNAVAILABLE", () => {
    const timeoutErr = new Error("fetch failed: timeout exceeded after 8000ms");
    const timeoutRes = normalizarErroDoProvedor(timeoutErr, 408);
    expect(timeoutRes.categoria).toBe("TIMEOUT");
    expect(timeoutRes.titulo).toBe("Tempo de resposta esgotado");

    const serverErr = '{"error":{"message":"Service unavailable","code":503}}';
    const serverRes = normalizarErroDoProvedor(serverErr, 503);
    expect(serverRes.categoria).toBe("PROVIDER_TEMPORARILY_UNAVAILABLE");
    expect(serverRes.titulo).toBe("Provedor temporariamente indisponível");
  });

  it("7. classificarResposta in prova-de-credito delegates to canonical normalized errors", () => {
    const rawZenError = '{"type":"error","error":{"type":"FreeUsageLimitError","message":"Rate limit exceeded."}}';
    const prova = classificarResposta(429, rawZenError);

    expect(prova.ok).toBe(false);
    if (!prova.ok) {
      expect(prova.codigo).toBe("limite_ou_saldo");
      expect(prova.httpStatus).toBe(429);
    }
  });
});
