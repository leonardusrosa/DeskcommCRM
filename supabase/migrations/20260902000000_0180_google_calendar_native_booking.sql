-- ============================================================================
-- 0180 — GOOGLE CALENDAR + AGENDAMENTO NATIVO (CALENDÁRIO VIVO)
-- ============================================================================

-- ---- supabase/migrations/20260826190000_0177_agenda_o_compromisso_marcado.sql ----
-- ============================================================================
-- 0177 — O PRODUTO SABE QUANDO VOLTAR A FALAR, MAS NÃO SABE QUE HORA FOI
--        COMBINADA COM O CLIENTE
--
-- Hoje o DeskcommCRM sabe agendar um RETORNO — o sistema volta a falar com o
-- lead daqui a X — e isso mora em `cron_jobs` (kind='at', job_kind=
-- 'followup_turn'), escrito por `lib/followup/retorno-crm.ts`. É uma decisão
-- interna: o cliente não sabe, ninguém combinou nada com ele, e não ocupa a
-- hora de ninguém.
--
-- O que não existe é o oposto disso: DUAS PESSOAS COMBINARAM ESTAR JUNTAS ÀS
-- 14h DE QUINTA. A consulta da clínica, a visita do corretor, a call da
-- agência. Tem hora, tem dono, ocupa a agenda de um atendente, e o cliente
-- sabe — porque foi combinado com ele. Um dono de clínica que instala este
-- produto hoje marca consulta no caderno.
--
-- ─── Por que NÃO reusar `cron_jobs` nem `followup_enrollments` ─────────────
-- Já medi as duas e nenhuma responde a pergunta desta tabela.
--   * `cron_jobs` guarda "dispare tal coisa neste instante". Um compromisso
--     não é um disparo: ele existe entre o momento em que foi marcado e o
--     momento em que aconteceu, tem estado próprio (aguardando confirmação,
--     confirmado, realizado, faltou) e sobrevive ao instante que o dispara.
--   * `followup_enrollments` é lead sendo nutrido por um fluxo. Não tem hora
--     marcada com ninguém e não ocupa agenda.
-- Fundir os dois daria ao produto DUAS agendas cegas uma para a outra — a IA
-- marcando retorno num lugar e compromisso noutro, sem tela que mostre a
-- outra. Ficam separados, e a aresta entre eles está desenhada abaixo, no
-- índice `calendar_appointments_org_vivos_idx`.
--
-- ─── Por que NENHUMA tabela de jornada semanal ─────────────────────────────
-- Porque ela já existe: `attendant_availability.schedule` guarda
-- {timezone, windows[{dow,start,end}]}, é validada por `availabilityScheduleSchema`
-- (lib/schemas/routing.ts), é lida pelo roteamento de conversa
-- (`isWithinSchedule`, lib/routing/eligibility.ts) e tem tela em
-- app/app/team/_components/AttendantsClient.tsx. Duplicá-la faria o dono de
-- clínica configurar o horário do funcionário em DOIS lugares — anti-pattern
-- nº 2 do CLAUDE.md. A agenda LÊ aquela coluna; não escreve outra.
--
-- ⚠️ E lê com OUTRA RÉGUA, de propósito: para o roteamento, `windows` vazio
-- significa 24/7 (mensagem chega a qualquer hora); para a agenda, significa
-- "esta pessoa não publicou horário" ⇒ zero slots. Agenda 24/7 por omissão
-- deixaria marcar consulta às 3h da manhã. `isWithinSchedule` NÃO é tocada.
--
-- ─── DIRC, coluna a coluna onde houve dúvida ───────────────────────────────
--   * `lead_id` — REFERENCIAR, e o ponteiro já existe: `crm_lead_links`
--     aceita `target_kind='appointment'` desde antes desta migration
--     (baseline.sql, CHECK `crm_lead_links_target_kind_enum`). Coluna própria
--     seria um segundo mecanismo de vínculo para o mesmo fato — anti-pattern
--     nº 8. Não existe aqui.
--   * `contact_id` — INTEGRAR, com FK real: é QUEM VAI SER ATENDIDO e quem
--     recebe o lembrete. Precisa de integridade, e contato não é lead:
--     `crm_lead_links.lead_id` é NOT NULL, então um agendamento de contato que
--     ainda não virou lead não teria vínculo nenhum se dependesse só do link.
--   * campos do Google — DUPLICAR, deliberado e 1:1. Um agendamento tem no
--     máximo um evento espelho lá fora; tabela à parte para uma relação 1:1
--     seria um join em toda leitura da grade.
--   * duração/buffers/aviso — no MOLDE (`calendar_event_types`), não na cópia:
--     mudar "consulta passa a durar 50min" não pode reescrever o passado.
--
-- ─── Por que NÃO há constraint de sobreposição de horário ──────────────────
-- A ferramenta certa seria `exclude using gist (owner_user_id with =,
-- tstzrange(starts_at, ends_at) with &&)`. Medido: `btree_gist` NÃO está
-- disponível — nem no baseline (só `pgcrypto`), nem no prelude de
-- `scripts/test-db.sh` (uuid-ossp, pgcrypto, vector, citext, pg_trgm). A
-- constraint quebraria o `install` de todo clone. E, mesmo disponível, ela
-- proibiria o encaixe deliberado que uma recepção faz todo dia. Quem impede
-- overbooking acidental é o motor de slots, que é onde a regra pode ter
-- exceção; o banco guarda o fato.
--
-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Org-flat nas cinco tabelas de agenda: a agenda de uma clínica é vista por
-- quem trabalha nela, e esconder o compromisso do colega quebraria o produto
-- (o requisito é filtro POR pessoa, não sigilo entre pessoas).
--
-- `calendar_connections` é a exceção e leva GATE: ela guarda token OAuth. Os
-- tokens são `bytea` cifrado por `fn_encrypt_oauth` (inúteis sem a chave, que
-- só `service_role` alcança), mas a linha diz de quem é a conta do Google e
-- qual o e-mail dela. Quem lê: o DONO da conexão, ou `manager`+. Defesa em
-- profundidade — a rota HTTP não é a única porta, o PostgREST também serve
-- esta tabela com a anon key + o JWT do usuário.
--
-- Aditiva e idempotente: seis tabelas NOVAS e uma coluna nova, nullable, numa
-- tabela existente. Nenhuma linha atual passa a violar nada — não há o que
-- deduplicar antes.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · o molde: que tipos de compromisso esta organização marca
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.calendar_event_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  -- Identificador legível e estável. NÃO é para URL pública (auto-agendamento
  -- ficou fora do escopo): serve para (a) impedir dois "Consulta" iguais na
  -- mesma organização e (b) dar à IA um handle que ela não alucina, ao
  -- contrário de um uuid. Renomear o tipo não muda o slug.
  slug text not null,
  description text,

  category text not null default 'outro',
  duration_minutes int not null default 30,
  buffer_before_minutes int not null default 0,
  buffer_after_minutes int not null default 0,
  minimum_notice_minutes int not null default 120,
  -- null = a grade anda de duração em duração. Preenchido, permite oferecer
  -- 09:00/09:15/09:30 para um serviço de 30min.
  slot_interval_minutes int,
  booking_window_days int not null default 60,

  color text,
  location_kind text not null default 'in_person',
  location_details text,
  requires_confirmation boolean not null default false,
  is_active boolean not null default true,

  -- ─── o lembrete, e por que ele é COLUNA e não detalhe de implementação ───
  -- Em canal oficial (meta_cloud, zernio) texto livre fora da janela de 24h é
  -- recusado — e o lembrete cai exatamente aí: a pessoa marca na terça, o
  -- lembrete sai na quinta, e ela não mandou mensagem desde então, que é o
  -- normal de quem já marcou. Medido em lib/channels/capabilities.ts:
  -- `freeformOutsideWindow` é true só para `waha`; meta_cloud e zernio exigem
  -- template, e o gate de envio (guardrails/before-send.ts) só abre a porta
  -- para `isTemplate === true`.
  --
  -- ⚠️ O que torna isto grave não é a recusa, é a FORMA dela: a API responde
  -- 200 com wamid e a Meta recusa a ENTREGA depois, pelo webhook (131047,
  -- re-engagement). Quem lê o 200 como "enviado" acha que funcionou. Sem esta
  -- coluna, num canal oficial, o lembrete NÃO SAI e o sistema ACHA QUE SAIU —
  -- o cliente falta à consulta e não há erro nenhum para investigar.
  --
  -- O mecanismo de mandar template já existe (`sendTemplateForSession`). O que
  -- não existia é o DADO que diz qual template este tipo de compromisso usa.
  reminder_enabled boolean not null default true,
  -- 1440 = 24h antes. É quanto tempo ANTES do compromisso o lembrete sai.
  reminder_minutes_before int not null default 1440,
  -- NULL = texto livre, que basta em WAHA. Preenchido, é o nome do template
  -- aprovado no provedor oficial. Cadastro e escolha de template são tela de
  -- outra wave; o que não podia era a coluna faltar.
  reminder_template_name text,

  -- `numeric`, NUNCA `int`: a lista é arrastável e o repo usa fractional
  -- indexing (CLAUDE.md § Modelagem, mesma razão de crm_leads.position_in_stage).
  position numeric not null default 1000,
  default_owner_user_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_event_types_category_check check (category in (
    'consulta','procedimento','retorno','visita','vistoria',
    'reuniao','call','orcamento','demonstracao','outro'
  )),
  constraint calendar_event_types_location_kind_check check (location_kind in (
    'in_person','phone','whatsapp','video_link','google_meet'
  )),
  -- Mesma forma de crm_stages_color_format, e a mesma tolerância a maiúscula.
  -- (platform_branding.accent_hex exige minúscula; é cor de MARCA, outra régua.)
  constraint calendar_event_types_color_format
    check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint calendar_event_types_duracao_sensata
    check (duration_minutes between 5 and 1440),
  constraint calendar_event_types_intervalo_sensato
    check (slot_interval_minutes is null or slot_interval_minutes between 5 and 1440),
  constraint calendar_event_types_lembrete_sensato
    check (reminder_minutes_before between 0 and 43200),
  constraint calendar_event_types_buffers_nao_negativos
    check (buffer_before_minutes >= 0 and buffer_after_minutes >= 0
           and minimum_notice_minutes >= 0 and booking_window_days > 0)
);

create unique index if not exists calendar_event_types_org_slug_key
  on public.calendar_event_types (organization_id, slug);
create index if not exists calendar_event_types_org_ativos_idx
  on public.calendar_event_types (organization_id, position)
  where is_active;

comment on table public.calendar_event_types is
  'O MOLDE de um compromisso: quanto dura, com que folga, com que antecedência mínima se marca. Distinto de calendar_appointments, que é o compromisso marcado — mudar o molde não reescreve o que já foi combinado.';
comment on column public.calendar_event_types.slug is
  'Handle estável e legível dentro da organização. Não é URL pública: serve para a IA referenciar o tipo sem inventar uuid, e para impedir dois tipos com o mesmo nome.';
comment on column public.calendar_event_types.minimum_notice_minutes is
  'Antecedência mínima para marcar. 120 = ninguém marca para daqui a meia hora. É o que impede a agenda de aceitar um encaixe que o atendente não tem como cumprir.';
comment on column public.calendar_event_types.slot_interval_minutes is
  'De quanto em quanto tempo a grade oferece horário. NULL = de duração em duração.';
comment on column public.calendar_event_types.reminder_template_name is
  'Nome do template aprovado no provedor, para o lembrete. NULL = texto livre, que basta em WAHA. Em canal oficial (meta_cloud, zernio) texto livre fora da janela de 24h é aceito com 200 e tem a ENTREGA recusada depois pelo webhook — sem template, o lembrete não sai e o sistema acha que saiu.';
comment on column public.calendar_event_types.reminder_minutes_before is
  'Quantos minutos ANTES do compromisso o lembrete sai. 1440 = 24h.';
comment on column public.calendar_event_types.category is
  'consulta/procedimento/retorno = clínica; visita/vistoria = imobiliária; reuniao/call = serviços e agência; orcamento = obra e serviço; demonstracao = loja e software; outro = qualquer. Espelha os nichos de lib/onboarding/pacotes-de-funil.ts.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · o compromisso marcado
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.calendar_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- `set null`: apagar o molde não pode apagar o histórico do que já aconteceu.
  event_type_id uuid references public.calendar_event_types(id) on delete set null,

  title text not null,
  description text,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- O fuso em que a pessoa MARCOU. Guardado porque "quinta às 14h" é o que foi
  -- combinado; o instante UTC sozinho não sabe dizer isso depois de uma virada
  -- de horário de verão. Sem CHECK: a validação de fuso é do Intl, e o repo já
  -- tem o lugar dela — `fusoValido` em lib/tempo/fusos.ts, aplicado no Zod.
  time_zone text not null default 'America/Sao_Paulo',

  status text not null default 'confirmed',

  -- O ATENDENTE dono. `set null` e não cascade: o compromisso aconteceu mesmo
  -- que a pessoa saia da empresa depois.
  owner_user_id uuid references auth.users(id) on delete set null,

  -- QUEM VAI SER ATENDIDO. `restrict` acompanha conversations.contact_id e
  -- messages.contact_id — as duas únicas FKs RESTRICT do schema, e existem
  -- pela mesma razão: apagar um contato não pode apagar o histórico dele. Na
  -- prática a LGPD deste produto anonimiza em vez de apagar (CLAUDE.md § LGPD),
  -- então o RESTRICT nunca é o caminho normal — é o cinto.
  contact_id uuid references public.contacts(id) on delete restrict,
  conversation_id uuid references public.conversations(id) on delete set null,

  location_kind text not null default 'in_person',
  location_details text,
  meeting_url text,
  notes text,

  cancellation_reason text,
  cancelled_at timestamptz,
  -- A cadeia de remarcações. `set null` porque a remarcação sobrevive ao
  -- sumiço do compromisso original.
  rescheduled_from_id uuid references public.calendar_appointments(id) on delete set null,

  -- QUEM MARCOU. O par `created_by_*` espelha `created_by_user_id`, que já
  -- existe em crm_leads e crm_lead_links.
  -- ⚠️ Os VALORES seguem crm_lead_activities.actor_kind ('user','ai','system',
  -- 'rule','contact') e não o par 'human'/'agent' que a outra tabela usa,
  -- porque é na timeline do lead que esta autoria vai ser RENDERIZADA: gravar
  -- 'human' aqui e 'user' lá faria a tela mostrar duas palavras para a mesma
  -- pessoa. 'sync' é o único acréscimo, e não é ator do produto: significa que
  -- a linha nasceu de um evento que já existia na agenda externa.
  created_by_kind text not null default 'user',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_agent_id uuid references public.ai_agents(id) on delete set null,
  source text not null default 'ui',

  -- Lembrete: idempotência do lado do dado. Quem DISPARA é a fila
  -- (`cron_jobs` kind='at' agenda; `job_queue` executa), e o envio passa pela
  -- MESMA cadeia de saída do produto — janela horária, espaçamento, opt-out.
  -- Nenhum caminho novo de saída: esta base já pagou por uma automação com
  -- janela paralela.
  reminder_sent_at timestamptz,

  -- Espelho do Google. 1:1 e por isso mora aqui (DIRC: duplicar).
  google_connection_id uuid,
  google_calendar_id text,
  google_event_id text,
  google_ical_uid text,
  google_sequence int not null default 0,
  google_synced_at timestamptz,
  google_sync_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_appointments_status_check check (status in (
    'pending','confirmed','cancelled','completed','no_show'
  )),
  constraint calendar_appointments_location_kind_check check (location_kind in (
    'in_person','phone','whatsapp','video_link','google_meet'
  )),
  constraint calendar_appointments_created_by_kind_check check (created_by_kind in (
    'user','ai','system','contact','sync'
  )),
  constraint calendar_appointments_source_check check (source in (
    'ui','mcp','google_sync','public_page'
  )),
  constraint calendar_appointments_periodo_valido check (ends_at > starts_at),
  -- Regra de negócio em constraint SEPARADA da de vocabulário, de propósito:
  -- duas constraints casando `col in (...)` na mesma coluna fazem o extrator
  -- do invariante de vocabulário se recusar a escolher. É a mesma convivência
  -- de crm_leads.status com crm_leads_closed_at_consistency.
  constraint calendar_appointments_cancelamento_coerente check (
    (status <> 'cancelled' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

-- A grade: "o que há entre terça e domingo".
create index if not exists calendar_appointments_org_periodo_idx
  on public.calendar_appointments (organization_id, starts_at);
-- O filtro por pessoa, que é o requisito explícito da tela.
create index if not exists calendar_appointments_org_dono_idx
  on public.calendar_appointments (organization_id, owner_user_id, starts_at)
  where owner_user_id is not null;
-- A ARESTA COM O FOLLOW-UP (e com o Radar de Risco): "este lead tem consulta
-- marcada?". Quem tem compromisso vivo no futuro NÃO é lead parado, e cobrar
-- "ainda tem interesse?" de quem marcou para amanhã é o tipo de erro que faz
-- desinstalar o produto. Parcial nos dois estados vivos porque cancelado e
-- realizado não seguram ninguém. A consulta canônica, já que o vínculo com o
-- lead é polimórfico:
--   select 1 from crm_lead_links l join calendar_appointments a on a.id = l.target_id
--    where l.lead_id = $1 and l.target_kind = 'appointment'
--      and a.organization_id = $2 and a.status in ('pending','confirmed')
--      and a.starts_at > now();
create index if not exists calendar_appointments_org_vivos_idx
  on public.calendar_appointments (organization_id, starts_at)
  where status in ('pending','confirmed');
create index if not exists calendar_appointments_contato_idx
  on public.calendar_appointments (contact_id, starts_at desc)
  where contact_id is not null;
-- Idempotência do sync: o mesmo evento do Google não vira dois agendamentos.
-- O parceiro disto no código é a captura de `23505` no INSERT (CLAUDE.md
-- § Idempotência), não um SELECT-antes-de-inserir.
create unique index if not exists calendar_appointments_google_evento_key
  on public.calendar_appointments (organization_id, google_connection_id, google_event_id)
  where google_event_id is not null;

comment on table public.calendar_appointments is
  'O compromisso COMBINADO: hora marcada, com alguém, ocupando a agenda de um atendente. Distinto do RETORNO agendado (cron_jobs kind=at, job_kind=followup_turn), que é decisão interna do sistema, não ocupa agenda de ninguém e o cliente não sabe.';
comment on column public.calendar_appointments.time_zone is
  'O fuso em que foi marcado. "Quinta às 14h" é o que se combinou — o instante UTC sozinho não reconstrói isso depois de uma virada de horário de verão.';
comment on column public.calendar_appointments.created_by_kind is
  'user = pessoa da equipe pela tela; ai = agente de IA; system = o próprio produto; contact = o cliente (auto-agendamento, quando existir); sync = a linha nasceu de evento que já estava na agenda externa. Valores alinhados a crm_lead_activities.actor_kind, que é onde esta autoria aparece na tela.';
comment on column public.calendar_appointments.reminder_sent_at is
  'Carimbo de que o lembrete SAIU — idempotência do lado do dado, para remarcação ou reprocesso não avisarem duas vezes. Quem agenda o disparo é cron_jobs (kind=at); quem envia é a cadeia de saída do produto, com janela, espaçamento e opt-out.';
comment on column public.calendar_appointments.google_sequence is
  'O `sequence` do evento no Google. Ele exige que uma atualização venha com sequence >= o que está lá; guardar o nosso evita sobrescrever uma edição feita do lado de lá.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · a exceção por data — a ÚNICA tabela nova de disponibilidade
-- ────────────────────────────────────────────────────────────────────────────
-- `attendant_availability.schedule` sabe dizer "atendo de segunda a sexta, das
-- 9h às 18h". Não sabe dizer "no dia 12 eu não atendo" nem "neste sábado, das
-- 9h ao meio-dia, atendo". Isso é informação NOVA — inflar o jsonb com ela é
-- que seria o lock-in do anti-pattern nº 6.
create table if not exists public.calendar_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  exception_date date not null,
  -- true = este pedaço do dia NÃO tem atendimento (o caso comum: feriado,
  -- férias, congresso). false = tem atendimento AQUI mesmo que a jornada
  -- semanal diga que não (o sábado excepcional).
  is_unavailable boolean not null default true,

  -- Minutos desde 00:00, NO MESMO FUSO da jornada da pessoa
  -- (`attendant_availability.schedule.timezone`). Minutos inteiros e não
  -- `time`: elimina a classe inteira de bug de fuso que um `time` carrega.
  --
  -- ⚠️ NOT NULL com default, e não nullable, e a razão é uma armadilha de
  -- Postgres: numa UNIQUE, NULL não colide com NULL. Com `start_minute`
  -- nullable, dois "dia 12 bloqueado o dia todo" para a mesma pessoa passariam
  -- os dois, em silêncio, e a tela mostraria a exceção duplicada. Dia inteiro
  -- é (0, 1440) — que é a mesma coisa e colide como deve.
  start_minute int not null default 0,
  end_minute int not null default 1440,
  reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_exceptions_faixa_valida
    check (start_minute >= 0 and end_minute <= 1440 and end_minute > start_minute)
);

create unique index if not exists calendar_exceptions_pessoa_dia_faixa_key
  on public.calendar_availability_exceptions (organization_id, user_id, exception_date, start_minute);
create index if not exists calendar_exceptions_org_dia_idx
  on public.calendar_availability_exceptions (organization_id, exception_date);

comment on table public.calendar_availability_exceptions is
  'O que a jornada semanal não sabe dizer: "neste dia não atendo" e "neste sábado atendo". A jornada continua morando em attendant_availability.schedule — esta tabela não a duplica, a excepciona.';
comment on column public.calendar_availability_exceptions.start_minute is
  'Minutos desde 00:00 no fuso da JORNADA da pessoa (attendant_availability.schedule.timezone), não em UTC. Dia inteiro = 0..1440.';
comment on column public.calendar_availability_exceptions.is_unavailable is
  'true = bloqueia esta faixa; false = ABRE esta faixa mesmo fora da jornada semanal.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · a agenda conectada (BYO) — uma por PESSOA, não por organização
-- ────────────────────────────────────────────────────────────────────────────
-- `tenant_integrations` foi desenhada para OAuth com refresh e serviria — não
-- fosse a cardinalidade: ela tem UNIQUE (organization_id, provider), uma
-- conexão por organização. A agenda do Google é de cada atendente. Mudar
-- aquela unique reescreveria o contrato de uma tabela viva para servir outro
-- caso.
--
-- O que É reusado dela, porque é mecanismo e não modelo: a cifra
-- (`fn_encrypt_oauth`/`fn_decrypt_oauth`, pgp_sym AES-256 com a chave em
-- `private.fn_oauth_key()`, EXECUTE só para service_role), os nomes das
-- colunas de token, e o vocabulário de `status` — os SETE valores de
-- `tenant_integrations_status_check`, incluindo `rate_limited`, que é
-- justamente o estado que uma API de calendário mais produz.
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  provider text not null default 'google_calendar',
  account_email text not null,

  -- `bytea`, como as nove colunas cifradas do repo. Passe o valor CRU de
  -- fn_encrypt_oauth (com o `\x`); tirar o prefixo é regra de quem guarda
  -- cifrado dentro de jsonb, e aqui não é o caso.
  oauth_access_token_encrypted bytea,
  oauth_refresh_token_encrypted bytea,
  token_expires_at timestamptz,
  scopes text[] not null default array[]::text[],

  status text not null default 'connecting',
  last_sync_at timestamptz,
  last_sync_error text,
  -- Sync incremental da CONTA. O do calendário individual mora na tabela de
  -- baixo, porque o Google versiona por calendário.
  sync_token text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_connections_provider_check check (provider in ('google_calendar')),
  constraint calendar_connections_status_check check (status in (
    'connecting','healthy','token_expired','scope_missing','disconnected','rate_limited','error'
  ))
);

create unique index if not exists calendar_connections_conta_key
  on public.calendar_connections (organization_id, user_id, provider, account_email);
-- A varredura do worker de renovação: quem está para vencer. Parcial porque
-- conexão desconectada não se renova.
create index if not exists calendar_connections_renovacao_idx
  on public.calendar_connections (token_expires_at)
  where status in ('healthy','rate_limited') and token_expires_at is not null;
create index if not exists calendar_connections_org_pessoa_idx
  on public.calendar_connections (organization_id, user_id);

comment on table public.calendar_connections is
  'A conta de agenda externa que UMA PESSOA conectou. Uma por atendente, e por isso não cabe em tenant_integrations, que é uma por organização e por provedor.';
comment on column public.calendar_connections.status is
  'connecting = o OAuth começou e ainda não voltou; healthy = renovando e sincronizando; token_expired = o refresh falhou com invalid_grant e SÓ a pessoa resolve, reconectando; scope_missing = conectou sem a permissão de calendário; rate_limited = o Google recusou por volume e vale tentar depois; disconnected = a pessoa desligou; error = falha que não se encaixa nas anteriores. Vocabulário idêntico ao de tenant_integrations.status — mesma pergunta, mesma palavra.';
comment on column public.calendar_connections.oauth_access_token_encrypted is
  'Cifrado por public.fn_encrypt_oauth (pgp_sym AES-256). NUNCA em claro. A chave vive em private.fn_oauth_key() e só service_role executa a decifragem.';
comment on column public.calendar_connections.token_expires_at is
  'Quando o access_token vence (~1h no Google). É o que o worker de renovação varre. Sem esse worker a integração morre em uma hora — e é por isso que o índice calendar_connections_renovacao_idx existe desde o primeiro dia, e não depois.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · quais agendas daquela conta contam
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.calendar_connection_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,

  external_calendar_id text not null,
  name text not null,
  is_primary boolean not null default false,
  -- O que este produto pergunta a cada agenda de fora: "você ocupa o horário
  -- desta pessoa?" e "você recebe o que eu marcar?". São perguntas diferentes:
  -- a agenda de aniversários ocupa nada e recebe nada; a pessoal ocupa e não
  -- recebe; a de trabalho faz as duas.
  counts_for_conflicts boolean not null default true,
  is_destination boolean not null default false,
  sync_token text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calendar_connection_calendars_key
  on public.calendar_connection_calendars (organization_id, connection_id, external_calendar_id);
-- Só UM destino por conexão: se dois calendários recebessem, o mesmo
-- compromisso apareceria duas vezes na agenda da pessoa.
create unique index if not exists calendar_connection_calendars_um_destino_key
  on public.calendar_connection_calendars (connection_id)
  where is_destination;

comment on table public.calendar_connection_calendars is
  'As agendas dentro de uma conta conectada, e o que cada uma faz por nós: ocupar horário (counts_for_conflicts) e/ou receber o que marcamos (is_destination). São perguntas independentes.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · o que veio de fora e ocupa a hora
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.calendar_external_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,

  external_calendar_id text not null,
  external_event_id text not null,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  status text not null default 'confirmed',
  -- O vocabulário é do próprio Google: `opaque` ocupa o horário, `transparent`
  -- não. Um evento marcado como livre lá não pode bloquear horário aqui.
  transparency text not null default 'opaque',
  external_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_external_events_status_check check (status in (
    'confirmed','tentative','cancelled'
  )),
  constraint calendar_external_events_transparency_check check (transparency in (
    'opaque','transparent'
  )),
  constraint calendar_external_events_periodo_valido check (ends_at > starts_at)
);

create unique index if not exists calendar_external_events_key
  on public.calendar_external_events (organization_id, connection_id, external_calendar_id, external_event_id);
-- A pergunta do motor de slots: "o que ocupa esta janela?". Parcial, porque
-- evento cancelado ou marcado como livre não ocupa nada e só engordaria o
-- índice.
create index if not exists calendar_external_events_ocupam_idx
  on public.calendar_external_events (organization_id, external_calendar_id, starts_at)
  where status <> 'cancelled' and transparency = 'opaque';

comment on table public.calendar_external_events is
  'Espelho, somente-leitura, do que já existe na agenda conectada. Ocupa horário e aparece na grade, mas não é compromisso NOSSO: não tem lead, não tem estado de atendimento e nunca é reescrito por nós.';
comment on column public.calendar_external_events.transparency is
  'opaque = ocupa o horário; transparent = a pessoa marcou como livre lá, e não bloqueia nada aqui. É o vocabulário do próprio Google.';

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · a cor da pessoa, na tabela de membros
-- ────────────────────────────────────────────────────────────────────────────
-- A cor é DA PESSOA NAQUELA ORGANIZAÇÃO, e por isso mora em user_organizations
-- e não em auth.users: quem trabalha em duas organizações pode ser verde numa
-- e azul na outra, e a cor de uma não vaza para a outra.
alter table public.user_organizations
  add column if not exists calendar_color text;

alter table public.user_organizations
  drop constraint if exists user_organizations_calendar_color_format;
alter table public.user_organizations
  add constraint user_organizations_calendar_color_format
  check (calendar_color is null or calendar_color ~ '^#[0-9a-fA-F]{6}$');

comment on column public.user_organizations.calendar_color is
  'Cor desta pessoa na grade da Agenda, nesta organização. NULL = a tela deriva uma cor estável do user_id, para ninguém nascer sem cor. ⚠️ A policy de SELECT desta tabela é self-OU-manager+: um `agent` NÃO lê a linha dos colegas pelo PostgREST. A tela recebe as cores pela rota que já monta o roster com service role (GET /api/v1/team), não por leitura direta.';

-- ────────────────────────────────────────────────────────────────────────────
-- 8 · o cascade que o polimórfico não tem
-- ────────────────────────────────────────────────────────────────────────────
-- O vínculo com o lead vai por `crm_lead_links` (target_kind='appointment'), e
-- `target_id` é polimórfico: não pode ter FK, logo não tem ON DELETE. Apagar
-- um agendamento deixaria o vínculo apontando para o nada.
--
-- O caminho NORMAL é que agendamento não se apague: cancela-se (`status`
-- 'cancelled'), porque o cancelamento é informação de negócio e a aba
-- Histórico existe para mostrá-lo. Mas "ninguém deveria apagar" é prosa, e
-- prosa não é guarda. Este trigger é o mecanismo.
create or replace function public.fn_limpar_vinculos_do_agendamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.crm_lead_links
   where organization_id = old.organization_id
     and target_kind = 'appointment'
     and target_id = old.id;
  return old;
end;
$$;

-- Função de trigger não exige EXECUTE de quem dispara o DELETE, então revogar
-- das três origens não a quebra — e mantém a função fora da lista de exceções
-- do invariante de hardening, que é congelada.
revoke execute on function public.fn_limpar_vinculos_do_agendamento() from public, anon, authenticated;
grant  execute on function public.fn_limpar_vinculos_do_agendamento() to service_role;

drop trigger if exists trg_limpar_vinculos_do_agendamento on public.calendar_appointments;
create trigger trg_limpar_vinculos_do_agendamento
  after delete on public.calendar_appointments
  for each row
  execute function public.fn_limpar_vinculos_do_agendamento();

-- ────────────────────────────────────────────────────────────────────────────
-- 9 · updated_at
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'calendar_event_types','calendar_appointments','calendar_availability_exceptions',
    'calendar_connections','calendar_connection_calendars','calendar_external_events'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
         for each row execute function public.fn_set_updated_at()', t, t);
  end loop;
end
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 10 · tenancy E PAPEL
-- ────────────────────────────────────────────────────────────────────────────
-- A primeira versão deste bloco dava `for all` só-tenancy às cinco tabelas de
-- agenda, e o invariante `rbac-config-ia-canais` reprovou as cinco. Ele estava
-- certo, e não é allowlist: `DIVIDA_RBAC_CONHECIDA` é uma CATRACA — a lista
-- congelada das tabelas que JÁ nasceram só-tenancy antes da migration 0150. O
-- teste se chama "a dívida de RBAC não cresce", e pôr tabela nova ali é
-- exatamente o movimento que ele existe para impedir.
--
-- A razão de fundo (migration 0150): `requireRole()` na rota Next NÃO é a única
-- porta. O PostgREST é exposto ao browser por construção — URL e anon key vão no
-- bundle — e um usuário logado fala com ele direto, com o próprio JWT. Uma
-- policy `for all` só-tenancy significa que o papel mais fraco do tenant escreve
-- tudo o que a organização tem.
--
-- Por tabela, e cada uma tem uma razão diferente:
--
--   event_types            lê membro · escreve manager+   é CONFIGURAÇÃO do
--     negócio: quanto dura uma consulta, que folga tem, quando se pode marcar.
--     O atendente usa; quem define é quem responde pelo negócio.
--
--   appointments           lê membro · escreve agent+     é a OPERAÇÃO do dia.
--     Marcar, remarcar e cancelar é o trabalho do atendente. O `viewer` vê a
--     agenda e não mexe nela.
--
--   availability_exceptions lê membro · escreve o DONO ou manager+
--     "No dia 12 eu não atendo" é da pessoa. Ela mesma escreve a sua, sem
--     depender de ninguém; manager+ escreve a dos outros porque escala é
--     trabalho de quem coordena.
--
--   connection_calendars   acompanha a conexão · escreve ninguém
--     Ele é filho de `calendar_connections` e herda o escopo dela, como
--     `crm_lead_links` herda o do lead. Quem escreve é o callback do OAuth.
--
--   external_events        lê membro · escreve NINGUÉM além de service_role
--     Vem do sync e é espelho. Escrita humana aqui só teria um caso de uso:
--     corromper a fonte de conflito, fazendo a agenda marcar em cima de
--     compromisso real. Ausência de policy de escrita é a decisão.
--
-- Nenhuma leva `for all` só-tenancy, e por isso nenhuma precisa entrar na
-- catraca.

-- ─── os tipos de agendamento: configuração do negócio ─────────────────────
alter table public.calendar_event_types enable row level security;
drop policy if exists tenant_isolation_calendar_event_types_all on public.calendar_event_types;
drop policy if exists calendar_event_types_select on public.calendar_event_types;
create policy calendar_event_types_select on public.calendar_event_types
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists calendar_event_types_write on public.calendar_event_types;
create policy calendar_event_types_write on public.calendar_event_types
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );
revoke all on public.calendar_event_types from anon;

-- ─── os compromissos: a operação do dia ───────────────────────────────────
alter table public.calendar_appointments enable row level security;
drop policy if exists tenant_isolation_calendar_appointments_all on public.calendar_appointments;
drop policy if exists calendar_appointments_select on public.calendar_appointments;
create policy calendar_appointments_select on public.calendar_appointments
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists calendar_appointments_write on public.calendar_appointments;
create policy calendar_appointments_write on public.calendar_appointments
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );
revoke all on public.calendar_appointments from anon;

-- ─── as exceções: a agenda é de quem a vive ───────────────────────────────
alter table public.calendar_availability_exceptions enable row level security;
drop policy if exists tenant_isolation_calendar_availability_exceptions_all on public.calendar_availability_exceptions;
drop policy if exists calendar_availability_exceptions_select on public.calendar_availability_exceptions;
create policy calendar_availability_exceptions_select on public.calendar_availability_exceptions
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists calendar_availability_exceptions_write on public.calendar_availability_exceptions;
create policy calendar_availability_exceptions_write on public.calendar_availability_exceptions
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and (user_id = auth.uid() or public.fn_role_at_least(organization_id, 'manager')))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and (user_id = auth.uid() or public.fn_role_at_least(organization_id, 'manager')))
  );
revoke all on public.calendar_availability_exceptions from anon;

-- ─── os calendários da conexão: herdam o escopo do pai ────────────────────
alter table public.calendar_connection_calendars enable row level security;
drop policy if exists tenant_isolation_calendar_connection_calendars_all on public.calendar_connection_calendars;
drop policy if exists calendar_connection_calendars_select on public.calendar_connection_calendars;
create policy calendar_connection_calendars_select on public.calendar_connection_calendars
  for select using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and exists (
          select 1 from public.calendar_connections c
           where c.id = connection_id
             and (c.user_id = auth.uid()
                  or public.fn_role_at_least(c.organization_id, 'manager'))
        ))
  );
revoke all on public.calendar_connection_calendars from anon;

-- ─── o espelho do Google: leitura de todos, escrita de ninguém ────────────
alter table public.calendar_external_events enable row level security;
drop policy if exists tenant_isolation_calendar_external_events_all on public.calendar_external_events;
drop policy if exists calendar_external_events_select on public.calendar_external_events;
create policy calendar_external_events_select on public.calendar_external_events
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
revoke all on public.calendar_external_events from anon;

alter table public.calendar_connections enable row level security;

drop policy if exists tenant_isolation_calendar_connections_all on public.calendar_connections;
drop policy if exists calendar_connections_dono_ou_manager_read on public.calendar_connections;
create policy calendar_connections_dono_ou_manager_read on public.calendar_connections
  for select using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and (user_id = auth.uid() or public.fn_role_at_least(organization_id, 'manager')))
  );

-- Escrita não tem policy: quem conecta e desconecta é o callback do OAuth e o
-- worker de renovação, ambos com service role, e ambos filtram organization_id
-- de fonte confiável. Uma policy de escrita aqui só abriria caminho para
-- gravar token pelo PostgREST.
revoke all on public.calendar_connections from anon;

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260826200000_0182_dois_cliques_nao_marcam_duas_vezes.sql ----
-- ============================================================================
-- 0182 — ENTRE A VALIDAÇÃO E O INSERT HÁ UMA JANELA, E DOIS POSTS CABEM NELA
--
-- O motor de slots decide se o horário está livre ANTES de gravar. Entre aquela
-- pergunta e o INSERT existe um intervalo em que o banco não repete a pergunta
-- — então dois POSTs simultâneos para o mesmo horário passam OS DOIS na
-- checagem e criam dois agendamentos. É o duplo clique da recepcionista, e é a
-- corrida entre duas pessoas marcando o mesmo slot ao mesmo tempo.
--
-- O acidental é justamente o que o motor NÃO vê: ele validou, e estava certo
-- quando validou.
--
-- ─── Por que ISTO e não a constraint de sobreposição ──────────────────────
-- A 0177 recusou `exclude using gist (owner_user_id with =, tstzrange(...) &&)`
-- por duas razões que continuam valendo, e esta migration não as contradiz:
--   1. exigiria `btree_gist`, medido ausente no baseline (que só cria
--      `pgcrypto`) e no prelude de `scripts/test-db.sh` — quebraria o `install`
--      de todo clone;
--   2. proibiria SOBREPOSIÇÃO — 14h-15h contra 14h30-15h30 —, que é o encaixe
--      que uma recepção faz todo dia.
-- Um índice único parcial é outra coisa: é btree PURO, e proíbe só a
-- COINCIDÊNCIA EXATA de instante para o MESMO dono. Nunca alcança 14h30 contra
-- 14h. A distinção é do @DevVivo e ela é o que faz esta passar onde aquela não
-- passava.
--
-- ─── `owner_user_id is not null`: o que ela faz, e o que NÃO faz ─────────
-- ⚠️ Eu apresentei esta condição como conserto de um buraco, e ela NÃO é. Medi
-- num pg17 descartável, os dois índices lado a lado com dono NULL e mesmo
-- instante:
--
--     sem a condição -> 2 linhas entram
--     com a condição -> 2 linhas entram      (idêntico)
--     controle, com dono real -> a segunda é recusada (23505)
--
-- A razão é que `NULL` nunca colide com `NULL` numa UNIQUE, esteja a linha
-- DENTRO ou FORA do índice. Tirar a condição não abriria buraco nenhum: as
-- linhas sem dono já não colidem entre si de qualquer forma.
--
-- O que a condição faz de verdade, e por isso ela fica: (1) mantém fora do
-- índice as linhas que nunca vão colidir, e (2) DECLARA o alcance da guarda —
-- ela é sobre a agenda de uma PESSOA, e agendamento sem atendente não ocupa a
-- agenda de ninguém. É documentação executável, não proteção.
--
-- Escrito assim porque a versão anterior deste comentário afirmava uma proteção
-- inexistente, e comentário que promete guarda que não existe é pior que
-- comentário nenhum: quem lê para de procurar.
--
-- ─── O que esta constraint CUSTA, escrito para ninguém descobrir sozinho ──
-- Ela proíbe dois compromissos do MESMO atendente no MESMO instante — e numa
-- clínica isso às vezes É o encaixe: a recepção põe dois pacientes às 14h de
-- propósito, sabendo que um vai esperar.
--
-- A troca é deliberada: uma corrida silenciosa vale mais que um caso legítimo
-- raro. Mas o 23505 NÃO pode virar um erro genérico na tela. A rota captura e
-- devolve 409 dizendo QUAL compromisso está ali e oferecendo o caminho
-- (remarcar, ou marcar no minuto seguinte). É o invariante 4 do Sistema Vivo —
-- nenhuma demanda sem próximo passo. Sem isso, trocamos uma corrida rara por
-- uma parede diária, e "o sistema não me deixa marcar" é a frase que faz PME
-- desinstalar.
--
-- ─── Deduplicar ANTES da constraint (a doutrina, e ela morde de verdade) ──
-- Índice único falha se os dados já o violam, e num clone isso quebraria o
-- `update.sh` — que roda SEM `ON_ERROR_STOP` e filtra erro por texto, então o
-- operador veria o alarme errado.
--
-- Hoje nenhum clone tem linha nesta tabela: ela nasceu na 0177, hoje, e a rota
-- que grava ainda não existe. O bloco abaixo é para o clone que vier a ter, e
-- ele NÃO decide qual compromisso vale — deslocar é a única correção que não
-- destrói informação. Cancelar a duplicata apagaria um compromisso combinado
-- com uma pessoa real, e isso uma migration não faz.
-- ============================================================================

-- ─── 1 · deduplicar deslocando, sem perder nenhum compromisso ──────────────
-- Empurra a 2ª, 3ª… ocorrência em 1 segundo cada, levando `ends_at` junto para
-- a duração não mudar. Em laço porque um deslocamento pode cair em cima de
-- outro instante já ocupado; 10 passadas cobrem qualquer caso real e o teto
-- impede laço infinito num dado patológico.
do $$
declare
  mexidas integer;
  passada integer := 0;
begin
  loop
    with duplicadas as (
      select id,
             row_number() over (
               partition by organization_id, owner_user_id, starts_at
               order by created_at, id
             ) - 1 as posicao
        from public.calendar_appointments
       where status in ('pending', 'confirmed')
         and owner_user_id is not null
    )
    update public.calendar_appointments a
       set starts_at = a.starts_at + (d.posicao * interval '1 second'),
           ends_at   = a.ends_at   + (d.posicao * interval '1 second')
      from duplicadas d
     where d.id = a.id
       and d.posicao > 0;

    get diagnostics mexidas = row_count;
    passada := passada + 1;
    exit when mexidas = 0 or passada >= 10;
  end loop;
end
$$;

-- ─── 2 · a guarda ─────────────────────────────────────────────────────────
create unique index if not exists calendar_appointments_sem_duplicata_idx
  on public.calendar_appointments (organization_id, owner_user_id, starts_at)
  where status in ('pending', 'confirmed') and owner_user_id is not null;

comment on index public.calendar_appointments_sem_duplicata_idx is
  'Fecha a janela entre a validação do motor de slots e o INSERT: dois POSTs simultâneos para o mesmo instante e o mesmo atendente não viram dois compromissos. Parcial em (pending, confirmed) porque cancelado e realizado não ocupam ninguém, e em owner_user_id não nulo porque NULL não colide com NULL numa UNIQUE — e porque agendamento sem atendente não ocupa agenda. Quem captura o 23505 é a rota, que devolve 409 dizendo qual compromisso está ali.';

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260826210000_0183_a_grade_da_agenda_nao_se_move_sozinha.sql ----
-- ============================================================================
-- 0183 — A GRADE NÃO ATUALIZA SOZINHA, E O DIAGNÓSTICO VAI PARA O LUGAR ERRADO
--
-- `publication supabase_realtime` é um array fechado, e `calendar_appointments`
-- não estava nele. O `.channel()` sobe, o `subscribe` devolve SUBSCRIBED,
-- nenhum erro em lugar nenhum — e nenhum evento chega nunca. Duas pessoas com a
-- agenda aberta não veem o que a outra marcou até alguém recarregar, e a tela
-- parada é indistinguível de "ninguém marcou nada".
--
-- ⚠️ E o agravante é de diagnóstico: nesta base o canal já morre calado por
-- OUTRO motivo quando o token não chega ao socket. Quem for investigar vai
-- direto para o `setAuth`, que é onde o defeito esteve antes — e não para a
-- publicação, que é onde ele está agora. Dois defeitos com o MESMO sintoma
-- (SUBSCRIBED e silêncio) fazem o segundo custar o dobro.
--
-- ─── Por que SÓ `calendar_appointments`, e não as seis ───────────────────
-- A doutrina desta publicação julga tabela a tabela, com as palavras do próprio
-- schema: `crm_lead_scores` ficou FORA porque "recálculo é telemetria e não deve
-- pintar card"; `crm_lead_risk_states` entrou porque "risco é mudança de estado".
--
--   calendar_appointments   ENTRA. Alguém marcou, remarcou ou cancelou às 14h de
--                           quinta — é mudança de estado, e é o que a grade
--                           mostra.
--   calendar_external_events FICA FORA. É espelho reescrito em lote pelo sync do
--                           Google; o próprio `comment on table` diz que não é
--                           compromisso nosso. Um sync que traz 200 eventos
--                           publicaria 200 pulsos seguidos — é o "pulso que
--                           mente" da 0075 em forma de calendário. Se um dia
--                           entrar, a contrapartida vive no ESCRITOR: só escrever
--                           quando horário ou status mudarem de fato, nunca
--                           `delete + insert` da janela inteira.
--   calendar_connections     FICA FORA. Guarda token OAuth e tem RLS com gate de
--                           papel; publicar mudança dela é superfície sem
--                           consumidor.
--   event_types, exceptions, connection_calendars  FICAM FORA. São configuração:
--                           mudam quando alguém edita, e quem edita já está na
--                           tela que recarrega.
--
-- ─── O QUE ESTA MIGRATION NÃO RESOLVE, e quem for assinar precisa saber ──
-- `replica identity` tem ZERO ocorrência neste schema — nem no baseline, nem nas
-- migrations. Com o default (PK), o payload de DELETE traz SÓ o `id`.
--
-- Consequência concreta para esta tela: um canal que assine com
-- `filter: owner_user_id=eq.<uuid>` NÃO recebe o DELETE, porque o payload não
-- tem `owner_user_id` para casar o filtro — e o card do compromisso apagado fica
-- na tela até o F5. As tabelas que já estão na publicação convivem com isso
-- porque seus consumidores invalidam a query inteira no `onChange`, em vez de
-- aplicar o payload.
--
-- NÃO ponho `replica identity full` aqui, e a razão é medida: hoje não existe
-- assinante — `app/app/agenda/_client.tsx` tem zero ocorrência de realtime.
-- Ligar `full` aumenta o WAL de toda escrita da tabela para servir um consumidor
-- que ainda não existe, e a decisão de COMO a tela lida com o DELETE (invalidar
-- a janela ou aplicar o payload) é de quem escrever o hook. Fica declarado aqui
-- para não ser descoberto em produção.
--
-- Aditiva e idempotente: só acrescenta uma tabela à publicação, com a guarda de
-- `pg_publication_tables` que o próprio baseline usa.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'calendar_appointments'
  ) then
    execute 'alter publication supabase_realtime add table public.calendar_appointments';
  end if;
end $$;

comment on table public.calendar_appointments is
  'O compromisso COMBINADO: hora marcada, com alguém, ocupando a agenda de um atendente. Distinto do RETORNO agendado (cron_jobs kind=at, job_kind=followup_turn), que é decisão interna do sistema, não ocupa agenda de ninguém e o cliente não sabe. ESTÁ na publicação supabase_realtime (migration 0183) porque marcar e cancelar é mudança de estado, não telemetria — mas o DELETE só traz o id, então um canal com filter por owner_user_id não o recebe.';

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260826220000_0184_anonimizar_um_contato_deixava_a_agenda_legivel.sql ----
-- ============================================================================
-- 0184 — ANONIMIZAR UM CONTATO REPORTAVA SUCESSO E DEIXAVA A CONSULTA LEGÍVEL
--
-- `fn_lgpd_cascade_redact_contact` percorre uma lista de tabelas escrita à mão,
-- e `calendar_appointments` não estava nela. A tabela guarda, em texto livre:
-- `title` ("Consulta — Maria Silva"), `description`, `notes` (a anotação do
-- atendimento, que numa clínica é queixa clínica), `location_details` (o
-- endereço de uma visita) e `cancellation_reason`.
--
-- ⚠️ O que torna isto grave não é o esquecimento — é a FORMA do silêncio. A
-- função devolve contagem por tabela, a rota reporta sucesso, o SLA de D+15 é
-- marcado como cumprido. Nada erra, nada loga, e o titular recebe a confirmação
-- de que seus dados foram anonimizados enquanto a queixa dele continua legível
-- no banco, com hora e endereço.
--
-- E o `on delete restrict` de `contact_id` não protege NADA aqui: a LGPD deste
-- produto ANONIMIZA em vez de apagar (é a doutrina, e é a escolha certa), então
-- o contato vira "Cliente Anonimizado #N" e as linhas da agenda seguem intactas.
--
-- ─── Por que TRIGGER e não um passo dentro da função ─────────────────────
-- A função vem do `pg_dump` e tem ~180 linhas no corpo do baseline. Acrescentar
-- um passo exigiria carregar uma CÓPIA inteira dela no apêndice — duas cópias
-- que divergem no primeiro conserto de qualquer uma. O repo já recusou esse
-- caminho antes, e o gancho em uso é este: `after update of is_anonymized on
-- contacts`, que é o que a 0174 faz para o histórico de captação e roda na MESMA
-- transação do cascade.
--
-- E há uma razão que vale mais que a economia de linhas: o trigger escuta a
-- COLUNA, não o chamador. Existe mais de um caminho de anonimização neste repo,
-- e um passo dentro da função só cobriria quem a chama.
--
-- ─── O que se redige, e o que se PRESERVA ────────────────────────────────
-- Redige o texto livre. PRESERVA `starts_at`, `ends_at`, `status`,
-- `event_type_id` e `owner_user_id` — a doutrina de LGPD deste produto manda
-- preservar timestamps nas atividades, e a razão vale aqui: a clínica precisa
-- responder "quantos atendimentos houve em março" depois de anonimizar, e isso
-- é registro de operação, não dado pessoal. O QUE aconteceu e QUANDO fica; COM
-- QUEM e SOBRE O QUÊ sai.
--
-- ─── `calendar_external_events` fica de FORA, e não por esquecimento ─────
-- Ela não tem `contact_id`. O único vínculo com a pessoa é o `title` copiado do
-- Google, e não há predicado que a alcance a partir do contato anonimizado.
-- Alcançá-la exigiria decidir entre duas coisas que são de produto, não de
-- schema: declarar por escrito que é espelho de sistema de terceiro e o titular
-- exerce o direito lá (e então o EXPORT precisa dizer isso a ele), ou apagar a
-- janela inteira daquela conexão. Fica registrado como pendência com dono, não
-- como omissão silenciosa.
--
-- Aditiva: função nova e trigger novo. Nenhuma linha existente muda ao aplicar.
-- ============================================================================

create or replace function public.fn_redigir_agenda_do_contato_anonimizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.calendar_appointments
     set title               = 'Compromisso anonimizado',
         description         = null,
         notes               = null,
         location_details    = null,
         meeting_url         = null,
         cancellation_reason = null
   where organization_id = new.organization_id
     and contact_id = new.id;
  return new;
end;
$$;

-- Função de trigger não exige EXECUTE de quem dispara o UPDATE, então revogar
-- das três origens não a quebra — e a mantém fora da lista de exceções do
-- invariante de hardening, que é congelada.
revoke execute on function public.fn_redigir_agenda_do_contato_anonimizado() from public, anon, authenticated;
grant  execute on function public.fn_redigir_agenda_do_contato_anonimizado() to service_role;

drop trigger if exists trg_redigir_agenda_ao_anonimizar on public.contacts;
create trigger trg_redigir_agenda_ao_anonimizar
  after update of is_anonymized on public.contacts
  for each row
  when (new.is_anonymized is true and old.is_anonymized is distinct from true)
  execute function public.fn_redigir_agenda_do_contato_anonimizado();

comment on column public.calendar_appointments.notes is
  'Anotação livre do atendimento — numa clínica, queixa clínica. É dado pessoal: o trigger trg_redigir_agenda_ao_anonimizar (migration 0184) a apaga quando o contato é anonimizado, junto com title, description, location_details, meeting_url e cancellation_reason. Horário, status e dono são PRESERVADOS: o que aconteceu e quando é registro de operação.';

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260826230000_0185_instalacao_fresca_nao_dava_para_marcar_nada.sql ----
-- ============================================================================
-- 0185 — INSTALAÇÃO FRESCA ABRIA A AGENDA E NÃO DAVA PARA MARCAR NADA
--
-- Zero `INSERT` em `calendar_event_types` em todo o repo — medido em `lib/`,
-- `app/`, `scripts/` e `supabase/`, com controle positivo (a mesma sonda contra
-- `crm_stages` acha 3 lugares no SQL e 31 no TypeScript). O vocabulário de
-- categorias existe desde a 0177 e ninguém escreve linha nenhuma.
--
-- E não dá erro: a grade vazia é indistinguível de "ninguém marcou hoje". Quem
-- instala numa VPS abre a Agenda, vê uma semana em branco e não tem o que
-- clicar — sem mensagem, sem próximo passo. É o caso P0 da doutrina de QA
-- Visual e é o item 7 do pedido do dono do produto.
--
-- ─── Por que TRIGGER e BACKFILL, e não um só ─────────────────────────────
-- Medido: o baseline NUNCA semeia organização que ainda não existe. O que ele
-- faz é `insert ... select from public.organizations` — backfill dos clones de
-- hoje. O único mecanismo que alcança organização FUTURA é trigger em
-- `organizations`, e há exatamente um no schema: `trg_seed_default_pipeline_for_org`.
--
-- Só backfill deixaria a segunda organização que o dono criar amanhã com a
-- agenda vazia. Só trigger deixaria sem nada todo clone que já instalou. Os dois
-- juntos são o que a doutrina de migrations deste repo pede quando o efeito vale
-- para o passado e para o futuro.
--
-- ─── O que se semeia, e por que NEUTRO ───────────────────────────────────
-- Três tipos que servem a qualquer negócio: Consulta, Reunião e Atendimento.
--
-- Não semeio por nicho AQUI, e a razão é medida: o nicho não é persistido em
-- lugar nenhum. `escolherPacotePorTexto()` roda em memória no passo do funil e o
-- resultado morre ali — o que fica gravado em `onboarding_state.funil` é
-- `{pipeline_id, origem, etapas}`, sem o id do pacote. Um trigger no INSERT da
-- organização roda antes de existir qualquer texto para inferir: o nome da
-- organização é tudo o que há, e `welcome.o_que_faz` ainda não foi preenchido.
--
-- E há um segundo argumento, que o maestro mediu e que sobrevive à mudança do
-- instalador: `scripts/bootstrap-owner.ts` NÃO é invocado pelo `install.sh` do
-- kit nem por script do `package.json`. Ninguém sabe com certeza QUEM cria a
-- organização numa VPS fresca. Semear por script exigiria acertar o caminho;
-- semear por TRIGGER pega qualquer caminho que seja um INSERT de verdade.
--
-- Isto é o PISO, não o teto. O enriquecimento por nicho — que é o que o item 7
-- pede de verdade — vive onde o nicho EXISTE, vivo, em
-- `app/actions/onboarding/montarQuadro.ts`, e entra em commit próprio. Os dois
-- não competem: este garante que dá para marcar; aquele faz a clínica ver
-- "Retorno" e a imobiliária ver "Visita".
--
-- ─── `on conflict do nothing`, nunca `do update` ─────────────────────────
-- O `update.sh` re-aplica o `baseline.sql` inteiro a cada atualização. Com
-- `do update`, o tipo que o dono JÁ editou — renomeado, com outra duração —
-- seria sobrescrito a cada versão do produto, em silêncio. `do nothing` é a
-- diferença entre semear e mandar.
--
-- ─── `default_owner_user_id` fica NULL, e é deliberado ───────────────────
-- O trigger dispara no INSERT de `organizations`, e `scripts/bootstrap-owner.ts`
-- só escreve em `user_organizations` DEPOIS. Não há a quem apontar; a FK é
-- `on delete set null` e aceita.
--
-- Aditiva e idempotente: função nova, trigger novo, e um backfill guardado por
-- `not exists`. Nenhuma linha existente muda.
-- ============================================================================

create or replace function public.fn_semear_tipos_de_agendamento(p_organization_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_criados integer := 0;
  r record;
begin
  for r in
    select * from (values
      ('Consulta',    'consulta',    'consulta', 30, 1000::numeric),
      ('Reunião',     'reuniao',     'reuniao',  30, 2000::numeric),
      ('Atendimento', 'atendimento', 'outro',    30, 3000::numeric)
    ) as t(nome, slug, categoria, duracao, posicao)
  loop
    insert into public.calendar_event_types
      (organization_id, name, slug, category, duration_minutes, position)
    values
      (p_organization_id, r.nome, r.slug, r.categoria, r.duracao, r.posicao)
    on conflict (organization_id, slug) do nothing;

    if found then
      v_criados := v_criados + 1;
    end if;
  end loop;

  return v_criados;
end;
$$;

create or replace function public.fn_semear_tipos_de_agendamento_na_org_nova()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.fn_semear_tipos_de_agendamento(new.id);
  return new;
end;
$$;

-- Função de trigger não exige EXECUTE de quem dispara o INSERT, e a de seed é
-- chamada por ela e pelo backfill — nenhum dos dois passa pelo PostgREST.
revoke execute on function public.fn_semear_tipos_de_agendamento(uuid) from public, anon, authenticated;
revoke execute on function public.fn_semear_tipos_de_agendamento_na_org_nova() from public, anon, authenticated;
grant  execute on function public.fn_semear_tipos_de_agendamento(uuid) to service_role;
grant  execute on function public.fn_semear_tipos_de_agendamento_na_org_nova() to service_role;

drop trigger if exists trg_semear_tipos_de_agendamento on public.organizations;
create trigger trg_semear_tipos_de_agendamento
  after insert on public.organizations
  for each row
  execute function public.fn_semear_tipos_de_agendamento_na_org_nova();

-- Backfill: os clones que JÁ instalaram. Guardado por `not exists` para o
-- `update.sh` poder re-aplicar sem duplicar e sem tocar em quem já editou.
do $$
declare o record;
begin
  for o in
    select id from public.organizations
     where not exists (
       select 1 from public.calendar_event_types t where t.organization_id = organizations.id
     )
  loop
    perform public.fn_semear_tipos_de_agendamento(o.id);
  end loop;
end
$$;

comment on function public.fn_semear_tipos_de_agendamento(uuid) is
  'O PISO da agenda: três tipos neutros (Consulta, Reunião, Atendimento) para que instalação fresca tenha o que marcar. Não é o teto — o enriquecimento por nicho vive no passo do funil do onboarding, onde o nicho existe. `on conflict do nothing` para nunca sobrescrever o que o dono editou.';

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260827000000_0186_a_cor_da_pessoa_e_uma_trilha_nao_um_hex.sql ----
-- ============================================================================
-- 0186 — A COR DA PESSOA É UMA TRILHA, E A DO TIPO NÃO EXISTE
--
-- A 0177 criou duas colunas de cor guardando hex, com CHECK de formato:
-- `user_organizations.calendar_color` e `calendar_event_types.color`. As duas
-- estavam erradas, e o argumento que as derruba não é meu — é o do @VPS, escrito
-- no cabeçalho de `components/agenda/paleta.ts`: hex guardado é "um segundo
-- lugar para a mesma verdade, e o tema escuro fica de fora".
--
-- Medido: as cores vivem em `app/globals.css` como `--agenda-pessoa-1..8`, em
-- TRÊS blocos de tema, e a MESMA trilha tem hex diferente em cada um — a trilha 1
-- é `#ac4d40` num bloco e `#f89080` noutro. Um hex no banco não tem como ser as
-- duas coisas: ele nasce sem tema escuro, e a tela ou ignora o valor do cliente
-- ou perde o tema.
--
-- ─── Por que AGORA, e não depois ─────────────────────────────────────────
-- Zero consumidores das duas colunas, medido com controle positivo (a mesma
-- sonda acha `trilha` em 34 arquivos, então estava viva). Trocar hoje custa esta
-- migration; trocar depois que a rota de marcar gravar custa migração de dado de
-- cliente. A janela fecha quando o POST nascer.
--
-- ─── `calendar_color` VIRA TRILHA, e a escolha manual FICA ───────────────
-- A cor da pessoa é o eixo visual da grade e o item 10 do pedido do dono do
-- produto. `trilhaPadraoDoMembro()` deriva uma trilha estável do `user_id`, mas
-- a derivação COLIDE para alguns pares — oito trilhas e mais de oito pessoas —,
-- e quem administra vai querer desempatar. Por isso a coluna continua existindo:
-- ela guarda a ESCOLHA, e NULL significa "use a derivada".
--
-- ─── `calendar_event_types.color` SAI, e não é só por falta de consumidor ──
-- Há UM pixel por compromisso na grade. Duas colorações competindo pelo mesmo
-- lugar significam que uma delas mente: ou a faixa diz de quem é o compromisso,
-- ou diz que tipo ele é, e o olho não lê as duas. O pedido diz cor POR PESSOA.
--
-- Se um dia alguém quiser colorir por tipo, volta como TRILHA também, com um
-- alternador que torne as duas mutuamente exclusivas — que é o desenho honesto
-- para um recurso que disputa o mesmo pixel.
--
-- ⚠️ DROP COLUMN é destrutivo e eu não o escrevo de leve. O que autoriza aqui:
-- as colunas nasceram na 0177, hoje; o seed da 0185 não preenche nenhuma das
-- duas; e a varredura por consumidor devolveu zero em `lib`, `app`, `components`,
-- `hooks`, `workers` e `tests`, com controle positivo. Não há dado de cliente a
-- perder porque não há caminho que grave.
-- ============================================================================

-- ─── 1 · a cor da pessoa vira trilha ──────────────────────────────────────
alter table public.user_organizations
  add column if not exists calendar_trilha smallint;

alter table public.user_organizations
  drop constraint if exists user_organizations_calendar_trilha_valida;
alter table public.user_organizations
  add constraint user_organizations_calendar_trilha_valida
  check (calendar_trilha is null or calendar_trilha between 1 and 8);

comment on column public.user_organizations.calendar_trilha is
  'A trilha de cor desta pessoa na grade da Agenda, nesta organização (1..8). NULL = use a derivada de trilhaPadraoDoMembro(user_id), que é estável mas colide para alguns pares — esta coluna existe para quem administra desempatar. A COR de cada trilha vive em app/globals.css (--agenda-pessoa-N) e muda com o tema; guardar hex aqui seria um segundo lugar para a mesma verdade, sem tema escuro. ⚠️ A policy de SELECT desta tabela é self-OU-manager+: um `agent` não lê a linha dos colegas pelo PostgREST, então as trilhas chegam à tela pela rota que monta o roster com service role.';

alter table public.user_organizations
  drop constraint if exists user_organizations_calendar_color_format;
alter table public.user_organizations
  drop column if exists calendar_color;

-- ─── 2 · a cor do tipo de agendamento sai ─────────────────────────────────
alter table public.calendar_event_types
  drop constraint if exists calendar_event_types_color_format;
alter table public.calendar_event_types
  drop column if exists color;

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260827010000_0187_o_espelho_do_google_e_cache_com_prazo.sql ----
-- ============================================================================
-- 0187 — ESPELHO DECLARADO SEM PRAZO VIRA ARQUIVO PERMANENTE COM OUTRO NOME
--
-- A 0184 deixou `calendar_external_events` FORA da cascata de LGPD, e a razão
-- está escrita lá: a tabela não tem `contact_id`, e o único vínculo com a pessoa
-- é o `title` copiado do Google. Não há predicado que a alcance a partir do
-- contato anonimizado, e apagar por conexão destruiria dado de terceiros que não
-- pediram nada.
--
-- A decisão de produto foi declarar ESPELHO: a fonte da verdade daquele dado é a
-- agenda do Google do próprio cliente, onde o titular exerce o direito com o
-- controlador de lá. Mas uma declaração dessas só é honesta com TRÊS
-- propriedades, e a terceira é a que faltava:
--
--   1. é reconstruível — o sync repõe o que for apagado;
--   2. some quando a conexão sai — já verdade: `connection_id` é
--      `on delete cascade` desde a 0177;
--   3. TEM PRAZO. Sem isto, "espelho" é só um nome mais simpático para um
--      arquivo permanente de compromissos de terceiros, guardado por um produto
--      que declarou não ser o controlador daquele dado.
--
-- Esta migration entrega a terceira.
--
-- ─── O que se apaga, e o que NUNCA se apaga ──────────────────────────────
-- Só o PASSADO. O corte é `ends_at < now() - N dias`: um compromisso futuro não
-- envelhece, por mais antigo que seja o registro dele. Apagar pelo `created_at`
-- — que é o que a poda de audit faz — removeria um evento marcado com um ano de
-- antecedência antes de ele acontecer, e a agenda passaria a marcar em cima dele.
--
-- ─── Piso, e por que ele é baixo aqui ────────────────────────────────────
-- O piso é 7 dias, o mesmo de `RETENCAO_FILA_DIAS_PISO`, e não os 90 da
-- auditoria. Auditoria é rastro que existe para ser consultado depois de um
-- incidente, e um piso alto impede que o knob vire apagador de rastro. Este
-- espelho é cache: quem quiser um passado mais longo pede ao sync, que repõe.
-- Piso alto aqui não protege ninguém — só guarda mais tempo dado de terceiro.
--
-- Aditiva: função nova. Nenhuma linha é apagada pela aplicação da migration —
-- quem apaga é o cron, em lotes, quando chamado.
-- ============================================================================

create or replace function public.fn_expurgar_espelho_da_agenda(
  p_retencao_dias int default null,
  p_limite int default null
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- 90 dias de passado visível; piso de 7 porque isto é cache reconstruível pelo
  -- sync, e não rastro que precise sobreviver a um incidente.
  v_dias int := greatest(coalesce(p_retencao_dias, 90), 7);
  v_limite int := least(greatest(coalesce(p_limite, 1000), 1), 10000);
  v_apagadas int;
begin
  with vencidos as (
    select e.id
      from public.calendar_external_events e
     -- `ends_at` e não `created_at`: um compromisso futuro não envelhece, e
     -- apagá-lo faria a agenda marcar em cima de hora ocupada.
     where e.ends_at < now() - make_interval(days => v_dias)
     order by e.ends_at
     limit v_limite
  )
  delete from public.calendar_external_events e
   using vencidos v
   where e.id = v.id;
  get diagnostics v_apagadas = row_count;
  return v_apagadas;
end;
$$;

revoke execute on function public.fn_expurgar_espelho_da_agenda(int, int) from public, anon, authenticated;
grant  execute on function public.fn_expurgar_espelho_da_agenda(int, int) to service_role;

comment on table public.calendar_external_events is
  'ESPELHO, somente-leitura, do que já existe na agenda conectada. Ocupa horário e aparece na grade, mas NÃO é compromisso nosso: não tem lead, não tem estado de atendimento e nunca é reescrito por nós. É CACHE — reconstruível pelo sync, apagado em cascata quando a conexão sai, e com prazo (fn_expurgar_espelho_da_agenda, migration 0187). Fica FORA da cascata de LGPD por não ter contact_id: o único vínculo com a pessoa é o title copiado do Google, e a fonte da verdade daquele dado é a agenda do próprio cliente, onde o titular exerce o direito com o controlador de lá. A mira de verdade só nasce com o escritor do sync, que terá o ical_uid para ligar — decisão de QUANDO, não de SE.';

create index if not exists calendar_external_events_poda_idx
  on public.calendar_external_events (ends_at);

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260827020000_0188_a_volta_do_google_sem_identidade_cria_fantasma.sql ----
-- 0188 — a volta do Google sem identidade cria compromisso fantasma
--
-- O QUÊ: acrescenta `ical_uid` a `public.calendar_external_events`.
--
-- POR QUÊ, e o custo já está sendo pago em dois lugares:
--
-- `calendar_appointments` guarda `google_ical_uid` desde a 0177 — o lado de IDA
-- sabe qual evento do Google é nosso. A linha de VOLTA não guardava nada
-- equivalente: `external_event_id` é o id do Google, não a nossa identidade.
-- Sem ela não existe chave entre o evento que voltou e o agendamento que o
-- originou, e as duas consequências já estão medidas:
--
--  1. COMPROMISSO FANTASMA. Um agendamento nosso que a pessoa MOVEU no Google
--     volta pelo sync e ocupa o horário NOVO, enquanto `calendar_appointments`
--     segue ocupando o ANTIGO. O mesmo compromisso bloqueia dois horários, e
--     nada liga um ao outro para desfazer.
--  2. O CRON DO "ACONTECEU?" NÃO PODE PERGUNTAR. Para saber se um compromisso
--     foi cancelado do lado de lá, a única alternativa sem identidade é casar
--     por mesmo dono e mesma janela — heurística que erra nos dois sentidos, e
--     cujo falso positivo é DESTRUTIVO: cancelaria um compromisso real porque
--     outro evento na mesma janela foi cancelado. O passo está barrado no
--     handler, esperando esta coluna.
--
-- Com ela, o anti-eco (`ehIcalUidNosso`, `lib/agenda/google/evento.ts`) deixa de
-- ser função pura sem consumidor e passa a filtrar na hora da escrita: evento
-- que nós mesmos criamos não é reimportado como se fosse de terceiro.
--
-- ADITIVA e idempotente: coluna nova, anulável, sem default e sem constraint —
-- nada a corrigir antes, e o `update.sh` de um clone com dados a aplica sem
-- tocar em linha nenhuma.

alter table public.calendar_external_events
  add column if not exists ical_uid text;

comment on column public.calendar_external_events.ical_uid is
  'O iCalUID que o Google devolveu. É por ele que se reconhece um evento criado por nós (sufixo do produto) e que se liga a linha ao calendar_appointments correspondente.';

-- Parcial: só as linhas que TÊM uid entram, que são as que alguém procura.
create index if not exists calendar_external_events_ical_uid_idx
  on public.calendar_external_events (organization_id, ical_uid)
  where ical_uid is not null;


-- ---- supabase/migrations/20260827030000_0189_o_espelho_nao_se_limpa_sozinho.sql ----
-- ============================================================================
-- 0189 — A PODA POR PRAZO NÃO FECHA O FANTASMA, E QUEM LER VAI PRESUMIR QUE SIM
--
-- A 0187 deu prazo ao espelho da agenda e o `comment on table` passou a dizer
-- que ele é "cache com prazo". Está certo e é insuficiente: quem ler aquela
-- frase vai concluir que o espelho se limpa sozinho, e não se limpa.
--
-- O caso que a poda NÃO alcança: um evento com `ends_at` no FUTURO, de uma
-- conexão VIVA, que foi apagado no Google. Ele nunca envelhece — o corte é por
-- `ends_at < now() - N dias`, e `ends_at` no futuro não vence nunca. Fica no
-- espelho para sempre, ocupando um horário que na agenda do cliente já está
-- livre. O sintoma é o oposto do que a poda protege: em vez de dado velho
-- demais, é dado que deveria ter sumido e não some, e ele faz a agenda RECUSAR
-- um horário que existe.
--
-- Quem limpa isso é a RECONCILIAÇÃO do sync: ao trazer a janela do Google,
-- remover o que não veio na resposta. Isso é da frente do Google e não existe
-- hoje. Não é defeito desta migration — é o limite dela, e o limite precisa
-- estar escrito onde a promessa está, senão a promessa engana.
--
-- ⚠️ Por que isto merece uma migration em vez de uma linha de doc: o
-- `comment on table` é o que um DBA lê no `\d+`, e é a única declaração que
-- viaja junto com o schema para todo clone. Uma ressalva que fica só no
-- briefing morre com a entrega.
--
-- Aditiva: só reescreve um comentário. Nenhuma linha de dado é tocada.
-- ============================================================================

comment on table public.calendar_external_events is
  'ESPELHO, somente-leitura, do que já existe na agenda conectada. Ocupa horário e aparece na grade, mas NÃO é compromisso nosso: não tem lead, não tem estado de atendimento e nunca é reescrito por nós. '
  'É CACHE — reconstruível pelo sync, apagado em cascata quando a conexão sai, e com prazo para o PASSADO (fn_expurgar_espelho_da_agenda, migration 0187). '
  '⚠️ O PRAZO NÃO LIMPA O FANTASMA: evento com ends_at no FUTURO, de conexão viva, apagado lá no Google, nunca envelhece e fica aqui para sempre — ocupando um horário que na agenda do cliente já está livre, e fazendo a agenda RECUSAR hora que existe. Quem limpa isso é a RECONCILIAÇÃO do sync (remover o que não veio na resposta da janela), que é da frente do Google e não existe hoje. '
  'Fica FORA da cascata de LGPD por não ter contact_id: o único vínculo com a pessoa é o title copiado do Google, e a fonte da verdade daquele dado é a agenda do próprio cliente, onde o titular exerce o direito com o controlador de lá. A mira de verdade só nasce com o escritor do sync, que terá o ical_uid para ligar — decisão de QUANDO, não de SE.';

notify pgrst, 'reload schema';


-- ---- supabase/migrations/20260827040000_0190_o_mesmo_state_do_google_valia_duas_vezes.sql ----
-- 0190 — o mesmo `state` do OAuth do Google valia duas vezes
--
-- O QUÊ: tabela `public.calendar_oauth_nonces`, onde o callback QUEIMA o nonce
-- do `state` no primeiro uso.
--
-- POR QUÊ: o `state` é assinado com HMAC e tem prazo de dez minutos, e dentro
-- desse prazo ele valia quantas vezes fosse apresentado — o nonce era emitido e
-- jogado fora. A dívida estava declarada em `lib/agenda/google/estado.ts` desde
-- que aquele arquivo nasceu, e o cético a provou POR EXECUÇÃO.
--
-- TABELA E NÃO REDIS, e a razão é falhar fechado. Postgres é o único
-- armazenamento garantido em TODA instalação; o Upstash é opcional no
-- self-host. Uma propriedade de segurança que degrada em silêncio onde a
-- dependência opcional falta é pior que propriedade nenhuma — a instalação sem
-- Redis PARECERIA protegida.
--
-- ⚠️ ISTO FECHA REPLAY, E SÓ. A outra porta — o callback aceitar um `state`
-- válido apresentado por OUTRA pessoa — é fechada pela leitura da sessão, que já
-- está no callback. São portas diferentes, e a distinção importa: durante horas
-- a dívida do nonce deu a impressão de cobrir as duas.
--
-- A LIMPEZA JÁ TEM DONO: o cron `data-retention`, que hoje poda fila, auditoria
-- e o espelho da agenda. Esta é a quarta poda, e a função abaixo é a que ele
-- chama. Sem ela a tabela cresceria para sempre — uma linha por conexão
-- tentada, para sempre, num produto que se instala e ninguém monitora.

create table if not exists public.calendar_oauth_nonces (
  nonce text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- O prazo do próprio `state`. Depois dele a linha não serve para mais nada:
  -- um `state` vencido já é recusado pela assinatura, antes de chegar aqui.
  expira_em timestamptz not null,
  usado_em timestamptz not null default now()
);

comment on table public.calendar_oauth_nonces is
  'Nonces de state do OAuth do Google já usados. A chave primária é o próprio nonce: a segunda tentativa viola a unicidade, e é assim que o replay é recusado.';

create index if not exists calendar_oauth_nonces_expiracao_idx
  on public.calendar_oauth_nonces (expira_em);

alter table public.calendar_oauth_nonces enable row level security;

-- Sem policy nenhuma, e é deliberado: quem escreve é o callback do OAuth, com
-- service role, e ninguém precisa LER isto pela API. Policy aqui só abriria
-- caminho para enumerar tentativas de conexão pelo PostgREST.
revoke all on public.calendar_oauth_nonces from anon, authenticated;

-- A quarta poda do `data-retention`. Assinatura idêntica às três irmãs
-- (`p_dias`, `p_lote`) para o mesmo laço de lotes servir sem caso especial.
create or replace function public.fn_expurgar_nonces_de_oauth(p_dias int, p_lote int default 500)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_removidas int;
begin
  -- Piso no CORPO, como as irmãs: um chamador que passe 0 não apaga nonce que
  -- ainda protege. O prazo do state é de 10 minutos, então um dia já é folga
  -- de duas ordens de grandeza.
  if p_dias is null or p_dias < 1 then
    p_dias := 1;
  end if;

  with alvo as (
    select nonce
      from public.calendar_oauth_nonces
     where expira_em < now() - make_interval(days => p_dias)
     limit greatest(p_lote, 1)
  )
  delete from public.calendar_oauth_nonces n
   using alvo
   where n.nonce = alvo.nonce;

  get diagnostics v_removidas = row_count;
  return v_removidas;
end$$;

-- Função nova em `public` nasce EXPOSTA — as DUAS origens de EXECUTE.
revoke execute on function public.fn_expurgar_nonces_de_oauth(int, int) from public, anon;
grant execute on function public.fn_expurgar_nonces_de_oauth(int, int) to service_role;


-- ---- supabase/migrations/20260827060000_0192_a_poda_de_nonces_esqueceu_authenticated.sql ----
-- ============================================================================
-- 0192 — A PODA DE NONCES ERA EXECUTÁVEL POR QUALQUER USUÁRIO LOGADO
--
-- `fn_expurgar_nonces_de_oauth` nasceu na 0190 com
-- `revoke ... from public, anon` — e as DUAS irmãs de assinatura idêntica
-- revogam de `public, anon, authenticated`:
--
--   fn_expurgar_auditoria_vencida(int,int)  from public, anon, authenticated
--   fn_expurgar_espelho_da_agenda(int,int)  from public, anon, authenticated
--   fn_expurgar_nonces_de_oauth(int,int)    from public, anon          ← esta
--
-- O `authenticated` não vem de um grant escrito: vem do
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO authenticated` do
-- baseline, que alcança toda função criada depois dele. Então a omissão não
-- aparece como uma linha errada — aparece como uma linha AUSENTE, que é o modo
-- de falha que a doutrina de função exposta deste repo já nomeia.
--
-- ⚠️ O QUE ISTO PERMITIA, concretamente: qualquer usuário logado de QUALQUER
-- organização podia chamar a RPC pelo PostgREST e apagar os nonces de OAuth de
-- TODOS os tenants — a função é `security definer` e não tem recorte por org
-- (não precisa ter: o único chamador é o cron de retenção, com service role).
-- Não vaza dado; derruba a conexão do Google de quem estivesse no meio do
-- fluxo, de graça e sem rastro de quem foi.
--
-- Não é vazamento de dado, e é exatamente por isso que passou: quem revisa
-- procura leitura indevida, e esta função só APAGA.
--
-- Achado por `tests/invariants/hardening-definer-varredura.test.ts`, que varre
-- TODA definer volátil de `public` — não uma lista fixa. Foi a varredura que
-- pegou, não a leitura.
--
-- Forward-fix em vez de editar a 0190: quem já aplicou a 0190 numa base local
-- não reexecutaria o arquivo editado.
-- ============================================================================

revoke execute on function public.fn_expurgar_nonces_de_oauth(int, int)
  from public, anon, authenticated;
grant  execute on function public.fn_expurgar_nonces_de_oauth(int, int) to service_role;

-- ─── E A NEGAÇÃO PASSA A SER ESCRITA, NÃO IMPLÍCITA ──────────────────────
-- `calendar_oauth_nonces` tem RLS ligada e ZERO policy. Isso já nega tudo para
-- `anon`/`authenticated`, e é o estado certo: quem escreve é o callback do
-- OAuth com service role, e ninguém precisa LER isto pela API.
--
-- Mas `tests/invariants/agenda-nenhuma-tabela-sem-rls.test.ts` cobra ao menos
-- uma policy em tabela de agenda com `organization_id`, e ele está CERTO em
-- cobrar: negação implícita e negação esquecida têm exatamente a mesma
-- aparência no catálogo. A primeira tentativa de conserto foi declarar a tabela
-- numa allowlist do invariante — o catraca de `tests/invariants/**` bloqueou, e
-- também estava certo: invariante incômodo se ESCALA, não se edita.
--
-- A policy abaixo não abre nada. Ela escreve no schema o que antes era
-- ausência, e quem ler o catálogo vê a decisão em vez de deduzi-la de um vazio.
drop policy if exists tenant_isolation_calendar_oauth_nonces_all on public.calendar_oauth_nonces;
drop policy if exists calendar_oauth_nonces_ninguem_le on public.calendar_oauth_nonces;
create policy calendar_oauth_nonces_ninguem_le
  on public.calendar_oauth_nonces
  for select
  using (false);

-- Por que SELECT e não ALL: a primeira versão desta policy era `for all
-- using(false)`, e um SEGUNDO invariante a reprovou —
-- `rbac-config-ia-canais.test.ts` proíbe tabela nova entrar com policy `ALL` que
-- não cite `role_at_least`. Os dois invariantes estavam certos ao mesmo tempo, e
-- a discordância deles apontou a forma correta: a intenção escrita na 0190 é
-- "ninguém precisa LER isto pela API", que é uma frase sobre SELECT. Escrita
-- segue negada pelo RLS sem policy que a case — mais estreito, não menos.


-- ---- supabase/migrations/20260827080000_0193_a_conexao_do_google_sem_fk_e_sem_fuso.sql ----
-- 0193 — a conexão do Google era um ponteiro sem FK, e o fuso dela não tinha onde morar.
--
-- Duas ausências na 0177, achadas por varredura de ausência (não por leitura), e as duas
-- da mesma família: a falha não aparece como linha errada, aparece como linha AUSENTE.
--
-- (1) `calendar_appointments.google_connection_id` é a ÚNICA das nove colunas-ponteiro
--     daquela tabela sem `references` — as outras oito trazem FK com `on delete` explícito
--     E comentário justificando a escolha. É o anti-pattern nº 4 do CLAUDE.md ("FK ausente
--     que vira inferência por nome"), e hoje ele não custa nada porque o escritor de ida
--     ainda não nasceu. Custa no dia em que nascer — e aí o órfão é construtível.
--     `set null` e não `cascade`: se a conexão do Google sumir, o compromisso NÃO some com
--     ela. Ele existe no CRM por direito próprio e só perde o ponteiro; apagá-lo seria
--     cascade fantasma (anti-pattern nº 7), destruindo histórico por causa de uma
--     integração revogada.
--
-- (2) O fuso do calendário é buscado do Google, gasto como metadado de auditoria e
--     DESCARTADO, porque não existe coluna onde guardá-lo — o sync crava `fuso: null` e o
--     fallback `?? 'UTC'` dispara SEMPRE. Em `America/Sao_Paulo` um evento de dia inteiro
--     bloqueia das 21h do dia anterior às 21h do dia seguinte: a noite do próprio dia vaza.
--     A coluna vai em `calendar_connection_calendars` e não em `calendar_connections`
--     porque o Google devolve `timeZone` POR CALENDÁRIO — guardar na conexão achataria N
--     em 1, e uma conexão com dois calendários em fusos diferentes passaria a mentir sobre
--     um dos dois.
--
-- Por que forward-fix em vez de editar a 0177: ela já vive em QUATORZE branches, com o
-- baseline aplicado. O `create table` do baseline é `if not exists`, então banco já criado
-- não recebe coluna por reescrita do create — o statement inteiro vira no-op. Editar a
-- 0177 não alcançaria nenhuma das quatorze.

alter table public.calendar_appointments
  add column if not exists google_connection_id uuid;

-- Backfill ANTES da constraint: a coluna é nova e nada escreve nela hoje, mas um clone
-- adiantado poderia ter linha com ponteiro morto — e constraint criada sobre dado que a
-- viola quebra o `update.sh` do clone, que roda SEM ON_ERROR_STOP e falharia no meio.
update public.calendar_appointments a
   set google_connection_id = null
 where a.google_connection_id is not null
   and not exists (select 1 from public.calendar_connections c where c.id = a.google_connection_id);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.calendar_appointments'::regclass
       and conname = 'calendar_appointments_google_connection_id_fkey'
  ) then
    alter table public.calendar_appointments
      add constraint calendar_appointments_google_connection_id_fkey
      foreign key (google_connection_id)
      references public.calendar_connections(id) on delete set null;
  end if;
end
$fk$;

comment on column public.calendar_appointments.google_connection_id is
  'Conexão do Google que espelha este compromisso. `set null`: conexão revogada não apaga compromisso — ele é do CRM, não da integração.';

alter table public.calendar_connection_calendars
  add column if not exists time_zone text;

comment on column public.calendar_connection_calendars.time_zone is
  'Fuso IANA do calendário, como o Google devolve (`timeZone`). NULL = ainda não sincronizado; quem lê deve tratar NULL como "não sei", nunca como UTC — foi o `?? UTC` que fez evento de dia inteiro vazar a noite anterior.';


-- ---- supabase/migrations/20260827090000_0194_lembrete_nasce_desligado.sql ----
-- 0194 — o lembrete nascia LIGADO, e quem escolheu isso foi o default.
--
-- `calendar_event_types.reminder_enabled` nasceu `default true` na 0177. Medido hoje:
-- ZERO leitores fora do `database.types.ts` — a coluna e a `reminder_minutes_before`
-- irmã não são lidas por lib, app, workers, tests nem hooks —, e o `scheduler` do
-- compose não tem cron de lembrete nenhum. (Controle da mesma sonda: `event_type_id`
-- aparece em 9 arquivos, então o instrumento enxerga colunas desta entrega sendo lidas.)
--
-- ⚠️ E É JUSTAMENTE POR NÃO HAVER DISPARADOR QUE ISTO SE CONSERTA AGORA. O perigo não é
-- o envio de hoje — não há envio. É a ORDEM DOS EVENTOS: no dia em que alguém escrever o
-- disparador, ele lê esta coluna, e TODA linha criada antes daquele dia, em TODA instalação,
-- já estará marcada `true`. A chave chega PRÉ-LIGADA para o histórico inteiro, e ninguém
-- escolheu isso — o default escolheu, por ausência de decisão. Enviar mensagem a uma pessoa
-- é irreversível e nunca é operação comum: default que inscreve gente numa ação irreversível
-- é decisão de produto tomada pelo schema.
--
-- "Não há quem dispare" é razão para o defeito não ser URGENTE. Nunca é razão para ele não
-- ser DEFEITO — e aqui a ausência de disparador é o que torna a correção barata: uma palavra
-- agora, contra data migration sobre linhas que o operador já pode ter mexido depois.
--
-- Ligar lembrete por padrão fica com o dono do produto NO DIA em que o disparador nascer —
-- aí ele decide com o mecanismo na frente, e não com uma coluna que ninguém lê.
--
-- Forward-fix e não edição da 0177 pela mesma razão da 0193: ela vive em treze branches com
-- o baseline aplicado, e `create table if not exists` faz a reescrita virar no-op.

alter table public.calendar_event_types
  alter column reminder_enabled set default false;

-- As linhas JÁ criadas também voltam: com zero leitores e zero disparador, nada depende do
-- valor atual, então este é o único momento em que corrigir o histórico não regride
-- comportamento de ninguém. Depois do disparador, isto seria apagar a escolha de um operador.
update public.calendar_event_types
   set reminder_enabled = false
 where reminder_enabled is true;

comment on column public.calendar_event_types.reminder_enabled is
  'Lembrete automático deste tipo. Nasce DESLIGADO de propósito: enviar mensagem é irreversível, e um default ligado inscreveria o histórico inteiro sem ninguém ter escolhido. Ligar por padrão é decisão do dono do produto, a ser tomada quando o disparador existir.';


-- ---- supabase/migrations/20260827100000_0195_tipo_semeado_nascia_sem_dono.sql ----
-- 0195 — os três tipos que o produto semeia nasciam SEM DONO, e sem dono não há agenda.
--
-- `fn_semear_tipos_de_agendamento` insere `(organization_id, name, slug, category,
-- duration_minutes, position)` e nunca define `default_owner_user_id`. E a consulta de
-- horários livres EXIGE dono: sem ele devolve `sem_responsavel`. Medido no caminho real
-- pela cerca `agenda-marcar-pela-tela`: a rota respondeu 422 três vezes com "Atendimento não
-- tem responsável definido".
--
-- Consequência: TODA organização nova nasce com três tipos de agendamento que não produzem
-- horário nenhum, para sempre, até alguém definir dono por fora. Os três tipos que o produto
-- semeia são decorativos — o usuário abre a Agenda numa instalação fresca, clica em Novo
-- agendamento, e não há horário. Nunca.
--
-- ⚠️ POR QUE O SEED NÃO PODE RESOLVER SOZINHO: o trigger é `after insert on organizations`,
-- e naquele instante NÃO EXISTE usuário vinculado — `user_organizations` ainda está vazia
-- para essa org. Não há dono a escolher; a função não estava errada, estava cedo.
--
-- A saída é o outro lado do tempo: preencher quando o PRIMEIRO membro chega. E só o
-- primeiro — se preenchesse a cada membro novo, um tipo que o operador deliberadamente
-- deixou sem dono voltaria a ganhar um, e o produto passaria a desfazer escolha de gente.

create or replace function public.fn_adotar_tipos_de_agendamento_sem_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Só o primeiro membro ATIVO da organização.
  --
  -- ⚠️ As duas condições nasceram de um caso que a predição pegou antes do commit: sem
  -- `new.revoked_at is null`, uma linha que JÁ nasce revogada adota os tipos e o dono padrão
  -- da agenda vira alguém que nunca esteve lá. E contar TODOS em vez de só os ativos criaria
  -- o furo simétrico: numa org com um ex-membro, o primeiro membro de verdade veria contagem
  -- 2 e não adotaria nada — a org ficaria órfã para sempre.
  --
  -- `= 1` e não `> 0`: neste ponto a linha nova já está na tabela, então o primeiro ativo
  -- vê contagem 1.
  if new.revoked_at is null
     and (select count(*) from public.user_organizations u
           where u.organization_id = new.organization_id
             and u.revoked_at is null) = 1 then
    update public.calendar_event_types
       set default_owner_user_id = new.user_id
     where organization_id = new.organization_id
       and default_owner_user_id is null;
  end if;
  return new;
end
$fn$;

revoke execute on function public.fn_adotar_tipos_de_agendamento_sem_dono() from public, anon, authenticated;
grant  execute on function public.fn_adotar_tipos_de_agendamento_sem_dono() to service_role;

drop trigger if exists trg_adotar_tipos_de_agendamento_sem_dono on public.user_organizations;
create trigger trg_adotar_tipos_de_agendamento_sem_dono
  after insert on public.user_organizations
  for each row execute function public.fn_adotar_tipos_de_agendamento_sem_dono();

-- Backfill: organizações que JÁ nasceram com os tipos órfãos e já têm membro. Adota o
-- membro ATIVO mais antigo — o mesmo que o trigger teria escolhido se existisse na época.
--
-- ⚠️ `revoked_at is null` nas DUAS metades, e não é detalhe: `user_organizations` guarda o
-- ex-membro em vez de apagá-lo. Sem o filtro, o backfill adotaria como dono padrão da agenda
-- alguém que já saiu da empresa — e o `exists` sem filtro faria pior, deixando o tipo órfão
-- numa org que só tem ex-membros parecer "já resolvido" por ter alguém na tabela.
update public.calendar_event_types t
   set default_owner_user_id = (
         select u.user_id from public.user_organizations u
          where u.organization_id = t.organization_id
            and u.revoked_at is null
          order by u.created_at, u.user_id
          limit 1)
 where t.default_owner_user_id is null
   and exists (select 1 from public.user_organizations u
                where u.organization_id = t.organization_id and u.revoked_at is null);


-- ---- supabase/migrations/20260827190000_0200_o_que_ainda_nao_foi_ao_google.sql ----
-- 0200 · O worker que empurra compromisso para o Google NUNCA empurrou nada.
--
-- ─── O sintoma, medido em produção ──────────────────────────────────────────
-- Log do contêiner de `crm.deskcomm.com.br`, a cada 5 minutos, desde o deploy
-- da v1.7.0:
--
--   {"level":"warn","msg":"[agenda-google-push] leitura falhou",
--    "error":"invalid input syntax for type timestamp with time zone:
--             \"google_synced_at\""}
--
-- ─── A causa ────────────────────────────────────────────────────────────────
-- `app/api/v1/cron/agenda-google-push/route.ts` pedia os pendentes assim:
--
--   .or("google_synced_at.is.null,updated_at.gt.google_synced_at")
--
-- O PostgREST trata o lado DIREITO de `gt.` como VALOR LITERAL, nunca como nome
-- de coluna: ele tenta converter a string "google_synced_at" em `timestamptz` e
-- recusa a consulta INTEIRA. Não é que a comparação dava errado — é que nenhuma
-- linha voltava, jamais. A ida ao Google nunca aconteceu em instalação nenhuma.
--
-- ─── Por que uma coluna gerada, e não uma RPC ───────────────────────────────
-- A pergunta "esta linha ainda precisa ir ao Google?" é DERIVADA de duas colunas
-- da própria linha. Derivado que alguém precisa lembrar de atualizar é derivado
-- que diverge — o mesmo argumento que já sustenta `contacts.wa_identity` e
-- `contacts.wa_lid` neste schema. A coluna gerada faz o PostgREST conseguir
-- filtrar (`.eq("needs_google_push", true)`) sem inventar RPC nova, que traria
-- de brinde a obrigação de revogar `execute` de `public` e de `anon`.
--
-- MEDIDO antes de escolher esta via, porque este repo já quebrou escrevendo em
-- coluna `GENERATED`: os 11 sítios que tocam `calendar_appointments` foram
-- lidos, e NENHUM faz upsert de linha inteira — todo `insert`/`update` nomeia
-- as colunas uma a uma. Ver `app/api/v1/agenda/agendamentos/_handler.ts:150`.
--
-- O nome é inglês (`needs_google_push`) porque o schema inteiro é: `wa_identity`,
-- `email_normalized`, `google_synced_at`. Comentário em português, identificador
-- em inglês — é a convenção em vigor neste arquivo.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ DOIS RELÓGIOS — e é isto que faz o conserto ser DUAS coisas, não uma
-- ═══════════════════════════════════════════════════════════════════════════
-- A coluna gerada sozinha trocaria "nunca empurra" por "empurra para sempre", e
-- o segundo é PIOR: ele queima a cota da API do Google reenviando o mesmo evento
-- a cada 5 minutos, e ninguém vê, porque o log de sucesso parece saudável.
--
-- O motivo é que os dois lados da comparação vinham de relógios DIFERENTES:
--
--   `updated_at`       ← `fn_set_updated_at()`, um trigger, com `now()` do
--                         POSTGRES (o instante de início da transação);
--   `google_synced_at` ← `new Date().toISOString()` do NODE, calculado no worker
--                         ANTES de a requisição sair.
--
-- O do Node é sempre ANTERIOR — latência de rede e do PostgREST, mais qualquer
-- desvio de relógio entre o contêiner do app e o do banco. Então, logo depois de
-- uma sincronização bem-sucedida:
--
--   updated_at (banco, depois) > google_synced_at (app, antes)  →  TRUE
--
-- e a linha volta à fila na rodada seguinte. Para sempre.
--
-- ─── Por que um trigger, e não consertar o worker ───────────────────────────
-- Consertar a chamada resolveria UM sítio. O trigger resolve a CLASSE: a partir
-- daqui, quem quer que grave `google_synced_at` — este worker, uma rota futura,
-- um backfill à mão num psql — recebe o carimbo do BANCO, no mesmo `now()` da
-- transação que move o `updated_at`. Os dois lados passam a sair do mesmo
-- relógio, e a comparação vira exata em vez de provável.
--
-- Ele NÃO carimba quando o valor novo é `NULL`: gravar `google_synced_at = null`
-- é como se força uma re-sincronização de propósito, e transformar isso em
-- "agora" faria o produto ignorar um pedido explícito.

alter table public.calendar_appointments
  add column if not exists needs_google_push boolean
  generated always as (google_synced_at is null or updated_at > google_synced_at) stored;

comment on column public.calendar_appointments.needs_google_push is
  'Derivada: a linha ainda não foi ao Google, ou mudou depois da última ida. Existe porque o PostgREST não compara coluna com coluna — o filtro do worker de push é `.eq("needs_google_push", true)`.';

create or replace function public.fn_carimbar_ida_ao_google()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  -- `now()` e não `new.updated_at`: os dois são o instante de início da
  -- transação, então o valor é o mesmo — e usar `now()` remove a dependência de
  -- ORDEM entre este trigger e o de `updated_at` (triggers `before` disparam em
  -- ordem de NOME, que é uma amarra frágil demais para uma igualdade da qual
  -- depende o fim de um laço).
  if new.google_synced_at is not null
     and (tg_op = 'INSERT' or new.google_synced_at is distinct from old.google_synced_at) then
    new.google_synced_at := now();
  end if;
  return new;
end
$fn$;

revoke execute on function public.fn_carimbar_ida_ao_google() from public, anon, authenticated;
grant  execute on function public.fn_carimbar_ida_ao_google() to service_role;

drop trigger if exists trg_calendar_appointments_carimbo_do_google on public.calendar_appointments;
create trigger trg_calendar_appointments_carimbo_do_google
  before insert or update on public.calendar_appointments
  for each row execute function public.fn_carimbar_ida_ao_google();

-- O recorte exato do worker: pendentes, de quem tem dono, na ordem em que ele
-- lê. Parcial porque a esmagadora maioria das linhas de uma agenda madura já
-- foi sincronizada, e um índice cheio pagaria por elas em toda escrita.
create index if not exists calendar_appointments_pendente_no_google_idx
  on public.calendar_appointments (starts_at)
  where needs_google_push and owner_user_id is not null;


-- ---- supabase/migrations/20260827200000_0201_credencial_do_google_pela_tela.sql ----
-- 0201 · Conectar o Google exigia SSH na VPS e um editor de texto.
--
-- ─── O que o usuário via ────────────────────────────────────────────────────
-- "Esta instalação não tem as credenciais do Google cadastradas — não é nada que
--  você tenha feito. Quem instalou o sistema precisa configurar
--  GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET."
--
-- O produto é self-host para quem NÃO programa. Nomear variáveis de ambiente
-- para essa pessoa é o mesmo que dizer que a funcionalidade não existe.
--
-- ─── Por que INSTALAÇÃO, e não organização ──────────────────────────────────
-- O `redirect_uri` sai de `NEXT_PUBLIC_APP_URL`, o `install.sh` grava o par no
-- `.env` da VPS, e o app OAuth é registrado no console do Google pelo dono da
-- instalação. É uma VPS por cliente: a credencial pareia 1:1 com a instalação.
-- Mesmo objeto de `platform_branding` (migration 0155), e este arquivo é um
-- clone declarado daquele molde.
--
-- A doutrina de marca própria do CLAUDE.md já diz a forma: o banco está ACIMA do
-- `.env`, e o `.env` é semente e piso de rollback. Vale igual aqui.
--
-- ─── Por que RLS LIGADA com ZERO policies ───────────────────────────────────
-- Não é descuido, é o desenho — o mesmo de `platform_branding`.
--
-- A anon key VAI PARA O BROWSER. Uma tabela servida pelo PostgREST e "protegida
-- por policy" depende de a policy estar certa; uma tabela com RLS ligada, sem
-- policy nenhuma e com os grants de `anon`/`authenticated` revogados não é
-- servida de jeito nenhum. Só o `service_role`, que vive no servidor, a alcança.
--
-- O que está em jogo justifica a diferença: o `client_secret` do app OAuth é o
-- que permite a QUALQUER UM trocar códigos e refresh tokens em nome desta
-- instalação — isto é, ler a agenda de todos os atendentes que conectaram.
--
-- ─── A cifra é a que já existe, e isso é decisão ────────────────────────────
-- `fn_encrypt_oauth`/`fn_decrypt_oauth` (migration 0041), que o próprio callback
-- do Google já usa para gravar os tokens em `calendar_connections`. Nenhuma
-- função nova em `public` ⇒ nenhuma superfície `security definer` nova ⇒ o item
-- 9 da doutrina de migrations não é acionado aqui.
--
-- Havia uma segunda cifra no repo (AES-GCM em Node, `ai_provider_credentials`),
-- e ela NÃO serve: é de escopo de ORGANIZAÇÃO e exposta por view. Usá-la seria
-- um terceiro caminho de cifra num módulo que já usa o primeiro.

create table if not exists public.platform_google_oauth (
  id smallint primary key default 1,
  client_id text,
  client_secret_encrypted bytea,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint platform_google_oauth_singleton check (id = 1)
);

comment on table public.platform_google_oauth is
  'O app OAuth do Google DESTA INSTALAÇÃO (singleton). Server-side only: RLS ligada sem policies e grants revogados de anon/authenticated — o PostgREST não a serve. O segredo nunca volta ao browser; a tela devolve apenas se existe.';
comment on column public.platform_google_oauth.client_secret_encrypted is
  'Cifrado por fn_encrypt_oauth (pgp_sym_encrypt/aes256), a mesma cifra dos tokens em calendar_connections. Nunca gravar em claro: sem a chave mestra o save recusa.';

alter table public.platform_google_oauth enable row level security;

revoke all on public.platform_google_oauth from anon, authenticated;
grant select, insert, update on public.platform_google_oauth to service_role;

drop trigger if exists trg_platform_google_oauth_updated_at on public.platform_google_oauth;
create trigger trg_platform_google_oauth_updated_at
  before update on public.platform_google_oauth
  for each row execute function public.fn_set_updated_at();


-- ---- supabase/migrations/20260828000000_0202_o_nome_do_atendente_custava_uma_chamada_http.sql ----
-- 0202 · O nome de quem atende custava uma chamada HTTP por atendente único da página.
--
-- ─── O sintoma ───────────────────────────────────────────────────────────────
-- Toda chamada a GET /api/v1/conversations (a listagem do Inbox) resolve o nome
-- do atendente de cada linha com `comNomeDoAtendente()` → `nomesDosAtendentes()`
-- (lib/users/nome-do-atendente.ts), que dispara UMA REQUISIÇÃO HTTP ao GoTrue
-- Admin API (`admin.auth.admin.getUserById`) por ID ÚNICO de atendente na
-- página — mesmo dedupado, mesmo quando a tela não vai mostrar o nome (o badge
-- só aparece quando há mais de um dono distinto na página). O próprio arquivo já
-- media o custo no cabeçalho: ~60ms para 1 atendente único, ~350ms para 10,
-- ~1,2s para 50 — e já apontava o conserto: desnormalizar o nome na linha, como
-- o repo já faz em `conversation_notes.created_by_name`.
--
-- ─── Por que a escrita entra em fn_conversation_assign, e não em 4 arquivos TS ──
-- Toda atribuição de conversa passa por ESTA função SECURITY DEFINER — claim,
-- release, transfer (app/api/v1/conversations/[id]/{claim,release,transfer}/route.ts)
-- e o worker de roteamento automático (lib/routing/worker.ts) chamam todos
-- `fn_conversation_assign` via RPC, e não existe UPDATE direto de
-- `assigned_to_user_id` em lugar nenhum do repo fora dela. Gravar o nome aqui,
-- uma vez, é a superfície mínima — replicar a resolução do nome em 4 call sites
-- TS criaria 4 chances de um deles ficar para trás.
--
-- ─── O que muda ──────────────────────────────────────────────────────────────
-- 1. `conversations.assigned_to_user_name` (nullable): a cópia do nome, escrita
--    no MESMO update que grava `assigned_to_user_id` — e zerada junto quando a
--    atribuição é removida (release: `p_to_user_id is null`).
-- 2. Backfill das linhas já atribuídas, lendo `auth.users.raw_user_meta_data
--    ->> 'full_name'` — o MESMO path que `app/api/v1/admin/users/route.ts` e
--    `app/api/v1/admin/platform-admins/route.ts` já leem para o mesmo campo.
-- 3. `fn_conversation_assign` (CREATE OR REPLACE, assinatura IDÊNTICA — mesma
--    razão da 0173: parâmetro novo criaria OVERLOAD e as chamadas por nome
--    passariam a falhar com `is not unique`) passa a resolver o nome por
--    subquery contra `auth.users` no mesmo UPDATE que grava o id.
--
-- O lado do app (`lib/users/com-nome-do-atendente.ts`) passa a ler a coluna já
-- presente na linha em vez de chamar `nomesDosAtendentes()` para toda a página —
-- mudança companion no TypeScript, fora desta migration (mesmo commit).
-- `nomesDosAtendentes()` continua existindo, agora só como fallback para o caso
-- raro de `assigned_to_user_id` preenchido sem `assigned_to_user_name` (linha
-- atribuída antes desta migration, se o backfill abaixo não alcançar por algum
-- motivo — ex. clone que aplica esta migration fora de ordem).
--
-- Aditiva e idempotente: coluna nullable com `add column if not exists`,
-- `create or replace function` de assinatura idêntica, backfill guardado por
-- `where assigned_to_user_name is null` (nunca sobrescreve nome já preenchido
-- numa reaplicação).

alter table public.conversations
  add column if not exists assigned_to_user_name text;

comment on column public.conversations.assigned_to_user_name is
  'Cópia do nome de quem atende (auth.users.raw_user_meta_data->>''full_name''), escrita por fn_conversation_assign no mesmo UPDATE que grava assigned_to_user_id, e zerada junto quando a atribuição é removida. Existe para evitar 1 chamada HTTP ao GoTrue Admin API por atendente único na listagem do Inbox — ver lib/users/nome-do-atendente.ts. NULL quando a conversa não está atribuída, ou quando o atendente não tem full_name em user_metadata.';

-- Backfill: só linhas já atribuídas, e só quando o nome ainda não está
-- presente — não sobrescreve dado que uma reaplicação já preencheu.
update public.conversations c
   set assigned_to_user_name = u.raw_user_meta_data ->> 'full_name'
  from auth.users u
 where c.assigned_to_user_id = u.id
   and c.assigned_to_user_name is null;

create or replace function public.fn_conversation_assign(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_to_user_id uuid,
  p_reason text,
  p_expected_assignee uuid default null,
  p_enforce_expected boolean default false
) returns setof public.conversations
language plpgsql security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_conv public.conversations%rowtype;
begin
  if auth.uid() is not null
     and not public.fn_role_at_least(p_organization_id, 'agent') then
    raise exception 'caller_not_authorized_for_org'
      using hint = 'caller must be an active agent+ member of the organization';
  end if;

  if p_to_user_id is not null then
    if coalesce(public.fn_member_role_in_org(p_to_user_id, p_organization_id), 'none')
         not in ('agent','manager','admin') then
      raise exception 'assignee_not_eligible_member'
        using hint = 'target must be an active agent+ member of the organization';
    end if;
  end if;

  select assigned_to_user_id into v_from
    from public.conversations
   where id = p_conversation_id
     and organization_id = p_organization_id
   for update;

  if not found then
    return;
  end if;

  if p_enforce_expected and v_from is distinct from p_expected_assignee then
    return;
  end if;

  update public.conversations
     set assigned_to_user_id = p_to_user_id,
         -- Desnormalizado JUNTO com o dono, na mesma transação: nunca existe uma
         -- janela em que id e nome discordam. NULL junto com o id quando a
         -- atribuição é removida (release) — nunca sobra um nome órfão de dono
         -- nenhum. Lido de auth.users porque quem chama esta função (RPC) não
         -- necessariamente tem acesso ao Admin API — a definer resolve por dentro.
         assigned_to_user_name = case
           when p_to_user_id is null then null
           else (select raw_user_meta_data ->> 'full_name' from auth.users where id = p_to_user_id)
         end,
         assigned_at = case when p_to_user_id is null then null else now() end,
         assignee_kind = case when p_to_user_id is null then null else 'user' end,
         status = case when p_to_user_id is null then 'open' else 'claimed' end,
         status_changed_at = now(),
         unread_count_for_assignee = 0,
         -- A trava só é solta por quem a pôs. `last_handoff_at` é o discriminador
         -- que já existe: uma ESCALAÇÃO o carimba, um humano ASSUMINDO não.
         bot_silenced_until = case
           when p_reason = 'routing'  then bot_silenced_until
           when p_to_user_id is null  then (case when last_handoff_at is null
                                                 then null
                                                 else bot_silenced_until end)
           else 'infinity'::timestamptz
         end,
         updated_at = now()
   where id = p_conversation_id
   returning * into v_conv;

  insert into public.conversation_assignment_events
    (organization_id, conversation_id, from_user_id, to_user_id, changed_by, reason)
  values
    (p_organization_id, p_conversation_id, v_from, p_to_user_id, auth.uid(), p_reason);

  return next v_conv;
end;
$$;

-- As DUAS origens de EXECUTE (doutrina, item 9), reafirmadas: `revoke from
-- public` não remove o grant direto que `anon` carrega via ALTER DEFAULT
-- PRIVILEGES, e `revoke from anon` não remove o grant a PUBLIC dado na criação.
revoke all     on function public.fn_conversation_assign(uuid, uuid, uuid, text, uuid, boolean) from public;
revoke execute on function public.fn_conversation_assign(uuid, uuid, uuid, text, uuid, boolean) from anon;
grant  execute on function public.fn_conversation_assign(uuid, uuid, uuid, text, uuid, boolean)
  to authenticated, service_role;


