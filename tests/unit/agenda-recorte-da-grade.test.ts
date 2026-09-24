import { describe, expect, it } from "vitest";

import {
  calcularRecorteDaGrade,
  DIAS_VISAO_MES,
  SEMANAS_VISAO_MES,
} from "@/lib/agenda/recorte-da-grade";

describe("calcularRecorteDaGrade", () => {
  it("na visão dia, recorte cobre exatamente 1 dia a partir do início do dia", () => {
    const ancora = new Date("2026-09-24T15:30:00.000Z");
    const { de, ate } = calcularRecorteDaGrade("dia", ancora);

    const dataDe = new Date(de);
    const dataAte = new Date(ate);

    const diffMs = dataAte.getTime() - dataDe.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it("na visão semana, recorte cobre exatamente 7 dias começando no domingo", () => {
    // 2026-09-24 é uma quinta-feira
    const ancora = new Date("2026-09-24T12:00:00.000Z");
    const { de, ate } = calcularRecorteDaGrade("semana", ancora);

    const dataDe = new Date(de);
    const dataAte = new Date(ate);

    // Domingo correspondente
    expect(dataDe.getDay()).toBe(0);
    const diffDias = (dataAte.getTime() - dataDe.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBe(7);
  });

  it("na visão mês, recorte cobre exatamente 6 semanas (42 dias) a partir do domingo do 1º dia", () => {
    // 2026-10-01 é uma quinta-feira
    const ancora = new Date("2026-10-01T12:00:00.000Z");
    const { de, ate } = calcularRecorteDaGrade("mes", ancora);

    const dataDe = new Date(de);
    const dataAte = new Date(ate);

    // Domingo inicial deve ser o domingo da semana do dia 01/10 (ou seja, 27/09/2026)
    expect(dataDe.getDay()).toBe(0);
    expect(dataDe.toISOString().slice(0, 10)).toBe("2026-09-27");

    const diffDias = (dataAte.getTime() - dataDe.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBe(DIAS_VISAO_MES);
    expect(diffDias).toBe(SEMANAS_VISAO_MES * 7);

    // Deve cobrir o dia 30 de setembro (alvo do teste de E2E que caía na virada)
    const alvo = new Date("2026-09-30T15:00:00.000Z");
    expect(alvo.getTime()).toBeGreaterThanOrEqual(dataDe.getTime());
    expect(alvo.getTime()).toBeLessThan(dataAte.getTime());
  });

  it("na visão mês de setembro/2026, também inclui 30 de setembro", () => {
    const ancora = new Date("2026-09-24T12:00:00.000Z");
    const { de, ate } = calcularRecorteDaGrade("mes", ancora);

    const dataDe = new Date(de);
    const dataAte = new Date(ate);

    const alvo = new Date("2026-09-30T15:00:00.000Z");
    expect(alvo.getTime()).toBeGreaterThanOrEqual(dataDe.getTime());
    expect(alvo.getTime()).toBeLessThan(dataAte.getTime());
  });
});
