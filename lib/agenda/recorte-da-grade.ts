import { addDays, startOfDay, startOfMonth, startOfWeek } from "date-fns";

import type { VisaoDaAgenda } from "@/components/agenda/tipos";
import type { RecorteDaGrade } from "@/hooks/agenda/useAgendamentos";

/**
 * Quantidade de semanas que a Visão de Mês desenha na grade.
 *
 * `GradeDaAgenda.tsx` (`VisaoDeMes`) fixa 6 semanas (42 dias) sempre, para manter
 * a grade retangular e evitar que as células mudem de altura de um mês para outro.
 */
export const SEMANAS_VISAO_MES = 6;
export const DIAS_VISAO_MES = SEMANAS_VISAO_MES * 7;

/**
 * Calcula o recorte de datas que a grade desenha em cada visão.
 *
 * - Dia: 1 dia (de startOfDay até addDays(1))
 * - Semana: 7 dias (de startOfWeek até addDays(7))
 * - Mês: 42 dias / 6 semanas (de startOfWeek(startOfMonth) até addDays(42))
 *
 * ## Por que o Mês precisa das 6 semanas completas
 *
 * A `VisaoDeMes` desenha uma grade retangular de 7 colunas × 6 linhas. Células do
 * mês anterior e posterior preenchem o início e o fim da grade. Se a consulta
 * limitasse apenas ao mês calendário (`startOfMonth` até `endOfMonth`), eventos que
 * caem nos dias exibidos nas bordas (como na virada de semana/mês) não seriam
 * consultados e a célula apareceria vazia mesmo estando visível na tela.
 */
export function calcularRecorteDaGrade(visao: VisaoDaAgenda, ancora: Date): RecorteDaGrade {
  const inicio =
    visao === "mes"
      ? startOfWeek(startOfMonth(ancora), { weekStartsOn: 0 })
      : visao === "semana"
        ? startOfWeek(ancora, { weekStartsOn: 0 })
        : startOfDay(ancora);

  const fim =
    visao === "mes" ? addDays(inicio, DIAS_VISAO_MES) : addDays(inicio, visao === "semana" ? 7 : 1);

  return { de: inicio.toISOString(), ate: fim.toISOString() };
}
