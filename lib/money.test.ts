import { describe, it, expect } from "vitest";

import { parseReaisToCents, formatCentsBRL, formatCentsUSD, formatAiCostCents } from "./money";

describe("parseReaisToCents", () => {
  it("lê ponto como decimal quando o grupo final não é de milhar", () => {
    expect(parseReaisToCents("249.90")).toBe(24990);
    expect(parseReaisToCents("1234.5")).toBe(123450);
    expect(parseReaisToCents("0.99")).toBe(99);
  });

  it("lê vírgula como decimal (pt-BR)", () => {
    expect(parseReaisToCents("249,90")).toBe(24990);
    expect(parseReaisToCents("1.234,56")).toBe(123456);
    expect(parseReaisToCents("1.234.567,89")).toBe(123456789);
  });

  it("trata ponto seguido de 3 dígitos como milhar", () => {
    expect(parseReaisToCents("1.234")).toBe(123400);
    expect(parseReaisToCents("1.234.567")).toBe(123456700);
  });

  it("aceita o formato en quando o último separador é o ponto", () => {
    expect(parseReaisToCents("1,234.56")).toBe(123456);
  });

  it("lê número simples", () => {
    expect(parseReaisToCents("250")).toBe(25000);
    expect(parseReaisToCents(" 250 ")).toBe(25000);
  });

  it("devolve null para o que não é valor", () => {
    expect(parseReaisToCents("")).toBeNull();
    expect(parseReaisToCents("abc")).toBeNull();
    expect(parseReaisToCents("R$ 10")).toBeNull();
    expect(parseReaisToCents("-5")).toBeNull();
  });
});

describe("formatCentsBRL", () => {
  it("mostra em reais o que está guardado em centavos", () => {
    expect(formatCentsBRL(24990).replace(/\s/g, " ")).toBe("R$ 249,90");
    expect(formatCentsBRL(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});

describe("formatCentsUSD / formatAiCostCents", () => {
  it("formata zero exato como US$ 0,00", () => {
    expect(formatCentsUSD(0).replace(/\s/g, " ")).toBe("US$ 0,00");
    expect(formatAiCostCents(0).replace(/\s/g, " ")).toBe("US$ 0,00");
  });

  it("formata valores >= 1 centavo (>= US$ 0.01) com 2 casas decimais", () => {
    expect(formatCentsUSD(1).replace(/\s/g, " ")).toBe("US$ 0,01");
    expect(formatCentsUSD(2).replace(/\s/g, " ")).toBe("US$ 0,02");
    expect(formatCentsUSD(125).replace(/\s/g, " ")).toBe("US$ 1,25");
    expect(formatCentsUSD(24990).replace(/\s/g, " ")).toBe("US$ 249,90");
  });

  it("formata valores sub-centavo (< US$ 0.01) com casas suficientes para evitar zero falso", () => {
    // 0.37 centavos = US$ 0.0037
    expect(formatCentsUSD(0.37).replace(/\s/g, " ")).toBe("US$ 0,0037");
    // 0.057430 centavos = US$ 0.000574
    expect(formatCentsUSD(0.05743).replace(/\s/g, " ")).toBe("US$ 0,000574");
    // 0.0035 centavos = US$ 0.000035
    expect(formatCentsUSD(0.0035).replace(/\s/g, " ")).toBe("US$ 0,000035");
  });

  it("devolve 'Preço desconhecido' para null ou undefined (nunca zero)", () => {
    expect(formatCentsUSD(null)).toBe("Preço desconhecido");
    expect(formatCentsUSD(undefined)).toBe("Preço desconhecido");
    expect(formatAiCostCents(null)).toBe("Preço desconhecido");
    expect(formatAiCostCents(undefined)).toBe("Preço desconhecido");
  });
});