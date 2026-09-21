# ADR 0002 — Google Calendar como engine + booking nativo no Deskcomm

Status: Accepted
Date: 2026-08-31

## Contexto

O Deskcomm precisa oferecer agendamento integrado ao CRM e aos agentes de IA. As opções consideradas para a V1 foram:

1. incorporar/operar um produto externo de booking, como Cal.com;
2. usar somente links externos de Google Calendar/appointment scheduling;
3. construir a experiência de booking dentro do Deskcomm, usando Google Calendar como fonte de disponibilidade e calendário externo.

O produto já possui fundações reutilizáveis para integrações OAuth por tenant, criptografia de tokens, MCP tools, scheduler, auditoria e isolamento multitenant.

## Decisão

Adotar a opção 3:

> O Deskcomm será dono da experiência de booking e das regras de disponibilidade; o Google Calendar será o engine externo de busy/free e persistência/sincronização de eventos.

Não adicionar Cal.com/Calendly como dependência obrigatória na V1.

## Razões

- experiência permanece dentro do CRM;
- agente de IA e operador usam a mesma availability engine;
- evita duplicar CRM/contato/agendamento em outro sistema;
- reduz complexidade operacional de self-host de uma aplicação adicional;
- permite regras próprias de horário, buffers, antecedência, duração e bloqueios;
- Google Calendar continua sendo a agenda familiar ao cliente final;
- aproveita `tenant_integrations`, criptografia OAuth, scheduler e MCP existentes.

## Invariantes

1. Google Calendar informa busy/free; Deskcomm calcula slots permitidos.
2. `appointments` é a entidade canônica de agendamento dentro do CRM.
3. Escritas devem ser idempotentes.
4. Toda operação deve ser scoped por `organization_id`.
5. Tokens OAuth nunca são expostos ao frontend.
6. Alterações externas no Google devem ser reconciliadas periodicamente.
7. Agent tools e UI humana usam a mesma camada de domínio/availability.
8. A V1 não depende de Google push notifications/webhooks.

## Consequências positivas

- booking nativo no Inbox/Kanban/Contato/Agenda;
- IA pode consultar e criar horários reais;
- menor dependência de terceiros;
- UX e regras de negócio sob controle do Deskcomm;
- caminho simples para futura página pública de booking, se desejada.

## Consequências / custos

- Deskcomm passa a manter um availability engine;
- precisa tratar conflitos, timezones, buffers e idempotência;
- precisa reconciliar exclusões/edições feitas diretamente no Google Calendar;
- requer OAuth Google por organização.

## Fora do escopo inicial

- Cal.com/Calendly;
- omnichannel;
- landing pages;
- Google Calendar push notifications;
- roteamento avançado multi-recursos/multi-localização;
- pagamentos no booking.

## Evolução futura

Se houver demanda real, o mesmo domínio `appointments` poderá suportar:

- múltiplos calendários/atendentes;
- round-robin;
- página pública de booking;
- reminders;
- Google Meet;
- webhooks do Google;
- outros providers de calendário.

A eventual integração com Cal.com ou outro provider deverá ser um adapter opcional, nunca a fonte de verdade do CRM.
