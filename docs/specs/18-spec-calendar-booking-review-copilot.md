# Spec 18 — Google Calendar + Booking Nativo + Google Review Lite + CRM AI Copilot

Status: LOCKED FOR IMPLEMENTATION
Baseline: `244c8c6b51e62c228a122bdff2351528606de04b`

## 1. Visão geral

O Deskcomm seguirá com três módulos complementares ao CRM existente:

1. Google Calendar como engine externo de disponibilidade/eventos, com booking nativo dentro do Deskcomm.
2. Google Review Lite, sem dependência da Google Business Profile API para envio de pedidos de avaliação.
3. CRM AI Copilot integrado à inbox e ao contexto do lead, inicialmente read-heavy e human-in-the-loop.

Fora de escopo desta spec: omnichannel e landing pages.

## 2. Google Calendar + booking nativo

### 2.1 Decisão de produto

Não usar Cal.com/Calendly como dependência na V1. O CRM deve exibir disponibilidade, criar, reagendar e cancelar agendamentos diretamente na sua UI, usando o Google Calendar como fonte de busy/free e como calendário externo do negócio.

Princípio:

> O Google Calendar informa quando o tempo está ocupado. O Deskcomm decide quando o agendamento é permitido.

### 2.2 Integração OAuth

Reutilizar `tenant_integrations` para conexão Google por organização.

Escopos mínimos:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.freebusy`
- `https://www.googleapis.com/auth/calendar.readonly`

Tokens devem permanecer cifrados com a infraestrutura OAuth existente e acessíveis apenas pelo backend/service role.

### 2.3 Modelo de domínio

Criar entidade `appointments` com, no mínimo:

- `organization_id`
- `contact_id`
- `opportunity_id`
- `assigned_user_id`
- `external_provider`
- `external_calendar_id`
- `external_event_id`
- `title`
- `description`
- `service_type`
- `starts_at`
- `ends_at`
- `timezone`
- `status`
- `created_by_kind`
- `created_by_user_id`
- `created_by_agent_id`
- `idempotency_key`
- `metadata`

Estados mínimos: `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`, `rescheduled`.

Toda alteração relevante deve gerar atividade na timeline do CRM.

### 2.4 Availability engine

Configuração em `organizations.settings.scheduling`:

- `business_hours`
- `service_duration_minutes`
- `minimum_notice_minutes`
- `max_horizon_days`
- `buffer_before_minutes`
- `buffer_after_minutes`
- `blocked_dates`
- timezone canônico da organização

Algoritmo:

1. gerar slots teóricos pelas regras do negócio;
2. aplicar antecedência mínima e horizonte máximo;
3. consultar Google Calendar `freebusy.query`;
4. expandir busy blocks pelos buffers;
5. subtrair horários ocupados;
6. retornar slots válidos.

### 2.5 UI nativa

Adicionar:

- botão `Agendar` e seção `Agendamentos` em `CRMSidePanel`;
- próximo compromisso + reagendar/cancelar em `LeadDossier`;
- histórico de agendamentos no contato 360;
- página `/app/agenda` com visão diária/semanal.

### 2.6 Tools de agente

Adicionar tools MCP:

- `crm_check_availability`
- `crm_create_appointment`
- `crm_reschedule_appointment`
- `crm_cancel_appointment`
- `crm_list_appointments`

As tools devem herdar o contexto multitenant existente e emitir auditoria.

### 2.7 Sincronização V1

- criação/reagendamento/cancelamento síncrono entre Deskcomm e Google;
- consulta de disponibilidade sempre ao vivo via FreeBusy;
- reconciliação periódica de eventos futuros a cada 15–30 min;
- webhooks/push do Google ficam fora da V1.

## 3. Google Review Lite

### 3.1 Objetivo

Permitir envio manual ou automático de pedido de avaliação usando um link configurado pela empresa, por exemplo `https://g.page/r/.../review`.

Não depender da Google Business Profile API para a V1.

### 3.2 Configuração

Persistir em `organizations.settings.google_review`:

```json
{
  "enabled": true,
  "review_url": "https://g.page/r/EXEMPLO/review",
  "message_template": "Olá {{nome}}, foi um prazer atender você! Se puder nos avaliar no Google, agradecemos muito: {{review_url}}",
  "cooldown_days": 90,
  "trigger_on_appointment_completed": true,
  "trigger_on_lead_won": false
}
```

### 3.3 Gatilhos

- manual: botão `Pedir avaliação` no painel da conversa;
- automático: após `appointment.completed`, opcionalmente com atraso configurável;
- opcional futuro: lead ganho.

### 3.4 Proteções

- cooldown por contato;
- deduplicação;
- uso da fila nativa de outbound e ledger existentes;
- respeito a opt-out/anti-ban;
- não fazer review gating por nota/sentimento.

## 4. CRM AI Copilot

### 4.1 Objetivo

Copiloto embutido no CRM para auxiliar atendentes sem executar mutações silenciosas.

Novo AI point sugerido: `crm_copilot`.

### 4.2 Contexto

Reutilizar contexto canônico da organização e carregar:

- histórico da conversa;
- contato;
- oportunidade/estágio;
- notas;
- agendamentos.

### 4.3 Capacidades V1

- `summarize_thread`
- `suggest_next_action`
- `draft_reply`
- `detect_missing_data`

### 4.4 Human-in-the-loop

Sugestões podem oferecer ações como:

- `Inserir no chat`
- `Criar tarefa`
- `Mover estágio`

Nenhuma mutação deve ocorrer sem confirmação explícita do atendente na V1.

## 5. Segurança e isolamento

- todas as novas tabelas/consultas devem ser scoped por `organization_id`;
- RLS compatível com o padrão atual;
- tokens OAuth nunca retornam ao browser;
- ações administrativas de conexão/configuração exigem admin;
- atendentes podem usar agenda e Copilot conforme RBAC;
- todas as operações relevantes devem ser auditadas.

Ações mínimas de auditoria:

- `calendar.connected`
- `calendar.disconnected`
- `appointment.created`
- `appointment.rescheduled`
- `appointment.cancelled`
- `review_request.sent`

## 6. Plano de implementação

### PR #7 — Google Calendar Foundation & appointments schema

- schema/migration `appointments`;
- OAuth Google Calendar via `tenant_integrations`;
- calendar client + refresh token;
- availability engine;
- testes de schema e disponibilidade.

### PR #8 — Booking UI & Agent Calendar Tools

- UI nativa de agendamento;
- `/app/agenda`;
- tools MCP de appointments;
- timeline CRM;
- testes de tools/UI.

### PR #9 — Google Review Lite

- settings;
- handler de envio;
- cooldown/deduplicação;
- trigger por appointment completed;
- botão manual;
- testes.

### PR #10 — CRM AI Copilot

- AI point `crm_copilot`;
- endpoint;
- resumo, próxima ação, lacunas e draft;
- widget na inbox/composer;
- human-in-the-loop;
- testes.

## 7. Critérios de aceite de produto

O conjunto só é considerado completo quando:

- operador e agente conseguem consultar disponibilidade real;
- operador e agente conseguem criar/reagendar/cancelar sem sair do CRM;
- eventos ficam sincronizados com Google Calendar;
- agendamentos aparecem no contato/oportunidade/timeline;
- pedido de Google Review pode ser manual e automático com cooldown;
- Copilot resume, sugere próxima ação, detecta lacunas e gera draft;
- nenhuma dessas features quebra isolamento multitenant ou fontes de verdade existentes.
