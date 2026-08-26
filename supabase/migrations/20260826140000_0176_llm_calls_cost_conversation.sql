-- 0176 — atribuição financeira de IA por conversa + fallback de preço honesto
--
-- `llm_calls` já é o ledger canônico de IA, mas perdia a conversa/mensagem que
-- originou a chamada. Ao mesmo tempo, `pricing.ts` conhece só parte dos modelos:
-- para qualquer modelo novo `cost_cents` fica NULL e as telas antigas somavam
-- NULL como zero. Esta migration fecha as duas lacunas sem inventar preço.
--
-- Regras:
--   1. conversa/mensagem são enriquecidas pelo job que já está em `job_queue`;
--   2. custo calculado pelo runtime continua sendo a fonte preferida;
--   3. se o runtime não souber o custo, o preço do catálogo `ai_models` pode
--      fornecer uma ESTIMATIVA simples de input/output;
--   4. sem preço conhecido, custo continua NULL — nunca zero falso;
--   5. não há FK para conversa/mensagem: telemetria financeira precisa sobreviver
--      à remoção/redação do objeto operacional.

alter table public.llm_calls
  add column if not exists conversation_id uuid,
  add column if not exists message_id uuid,
  add column if not exists cost_is_estimate boolean not null default false,
  add column if not exists pricing_source text;

comment on column public.llm_calls.conversation_id is
  'Conversa à qual o gasto é atribuído. Sem FK de propósito: o ledger financeiro sobrevive à remoção da conversa.';
comment on column public.llm_calls.message_id is
  'Mensagem inbound que originou o job/chamada, quando conhecida. Sem FK pelo mesmo motivo de retenção do ledger.';
comment on column public.llm_calls.cost_is_estimate is
  'true quando cost_cents veio do preço atual do catálogo, e não do cálculo/runtime original da chamada.';
comment on column public.llm_calls.pricing_source is
  'runtime_pricing | ai_models_catalog | unknown | no_usage; descreve de onde veio o custo sem fingir precisão.';

create index if not exists llm_calls_conversation_idx
  on public.llm_calls (organization_id, conversation_id, created_at desc)
  where conversation_id is not null;

create index if not exists llm_calls_message_idx
  on public.llm_calls (organization_id, message_id, created_at desc)
  where message_id is not null;

create or replace function public.fn_enrich_llm_call_attribution_and_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation text;
  v_message text;
  v_input_price numeric;
  v_output_price numeric;
begin
  -- Todo job do agent-engine já leva conversation_id e inbound_message_id no
  -- payload. Resolver aqui cobre turno principal, classificadores e compaction
  -- sem obrigar cada call site a lembrar de copiar os dois campos.
  if new.job_id is not null
     and (new.conversation_id is null or new.message_id is null) then
    select
      j.payload ->> 'conversation_id',
      j.payload ->> 'inbound_message_id'
    into v_conversation, v_message
    from public.job_queue j
    where j.id = new.job_id
      and j.organization_id = new.organization_id
    limit 1;

    if new.conversation_id is null
       and v_conversation is not null
       and pg_input_is_valid(v_conversation, 'uuid') then
      new.conversation_id := v_conversation::uuid;
    end if;

    if new.message_id is null
       and v_message is not null
       and pg_input_is_valid(v_message, 'uuid') then
      new.message_id := v_message::uuid;
    end if;
  end if;

  -- Se o seam já calculou o custo (incluindo cache quando suportado), ele é a
  -- fonte mais fiel e nunca é sobrescrito pelo catálogo.
  if new.cost_cents is not null then
    new.cost_is_estimate := false;
    new.pricing_source := coalesce(new.pricing_source, 'runtime_pricing');
    return new;
  end if;

  -- Falha antes de usage não é tratada como "preço zero do modelo". O ledger
  -- mantém cost_cents NULL, mas marca que não houve tokens observados.
  if coalesce(new.input_tokens, 0) = 0 and coalesce(new.output_tokens, 0) = 0 then
    new.cost_is_estimate := false;
    new.pricing_source := coalesce(new.pricing_source, 'no_usage');
    return new;
  end if;

  -- Fallback: o catálogo usa CENTS por milhão de tokens. É estimativa porque
  -- não conhece, de forma portátil, descontos de cache/lotes ou tarifas
  -- especiais que alguns gateways aplicam.
  select
    m.input_price_per_million_cents,
    m.output_price_per_million_cents
  into v_input_price, v_output_price
  from public.ai_models m
  where m.provider = new.provider
    and m.model_id = new.model
    and m.deprecated_at is null
  limit 1;

  if v_input_price is not null and v_output_price is not null then
    new.cost_cents :=
      ((coalesce(new.input_tokens, 0)::numeric * v_input_price) +
       (coalesce(new.output_tokens, 0)::numeric * v_output_price)) / 1000000::numeric;
    new.cost_is_estimate := true;
    new.pricing_source := 'ai_models_catalog';
  else
    new.cost_is_estimate := false;
    new.pricing_source := 'unknown';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_enrich_llm_call_attribution_and_cost() from public;

-- BEFORE: o trigger de orçamento existente é AFTER INSERT, portanto enxerga o
-- custo já enriquecido nesta função.
drop trigger if exists trg_llm_calls_enrich_attribution_cost on public.llm_calls;
create trigger trg_llm_calls_enrich_attribution_cost
  before insert on public.llm_calls
  for each row execute function public.fn_enrich_llm_call_attribution_and_cost();

-- Backfill SOMENTE da atribuição. Não recalculamos dinheiro histórico com preço
-- atual: isso transformaria uma estimativa de hoje em "fatura" de ontem.
update public.llm_calls c
set
  conversation_id = case
    when c.conversation_id is null
      and pg_input_is_valid(j.payload ->> 'conversation_id', 'uuid')
      then (j.payload ->> 'conversation_id')::uuid
    else c.conversation_id
  end,
  message_id = case
    when c.message_id is null
      and pg_input_is_valid(j.payload ->> 'inbound_message_id', 'uuid')
      then (j.payload ->> 'inbound_message_id')::uuid
    else c.message_id
  end
from public.job_queue j
where c.job_id = j.id
  and c.organization_id = j.organization_id
  and (c.conversation_id is null or c.message_id is null);

update public.llm_calls
set pricing_source = case
  when cost_cents is not null then 'runtime_pricing'
  when coalesce(input_tokens, 0) = 0 and coalesce(output_tokens, 0) = 0 then 'no_usage'
  else 'unknown'
end
where pricing_source is null;

-- Leitura pronta para UI/analytics. `known_cost_cents` é deliberadamente nomeado
-- assim: quando `cost_is_complete=false`, o valor é parcial e não pode ser
-- apresentado como custo total real da conversa.
drop view if exists public.ai_conversation_costs;
create view public.ai_conversation_costs
with (security_invoker = true)
as
select
  c.organization_id,
  c.conversation_id,
  conv.contact_id,
  count(*)::bigint as llm_calls,
  coalesce(sum(c.input_tokens), 0)::bigint as input_tokens,
  coalesce(sum(c.output_tokens), 0)::bigint as output_tokens,
  coalesce(sum(c.cost_cents) filter (where c.cost_cents is not null), 0::numeric) as known_cost_cents,
  count(*) filter (
    where c.cost_cents is null
      and (coalesce(c.input_tokens, 0) > 0 or coalesce(c.output_tokens, 0) > 0)
  )::bigint as unknown_cost_calls,
  count(*) filter (where c.cost_is_estimate)::bigint as estimated_cost_calls,
  bool_and(
    c.cost_cents is not null
    or (coalesce(c.input_tokens, 0) = 0 and coalesce(c.output_tokens, 0) = 0)
  ) as cost_is_complete,
  min(c.created_at) as first_llm_call_at,
  max(c.created_at) as last_llm_call_at
from public.llm_calls c
left join public.conversations conv
  on conv.id = c.conversation_id
 and conv.organization_id = c.organization_id
where c.conversation_id is not null
group by c.organization_id, c.conversation_id, conv.contact_id;

revoke all on public.ai_conversation_costs from anon;
grant select on public.ai_conversation_costs to authenticated, service_role;

comment on view public.ai_conversation_costs is
  'Custo/uso agregado por conversa. known_cost_cents é parcial quando cost_is_complete=false; estimated_cost_calls identifica fallback pelo catálogo.';
