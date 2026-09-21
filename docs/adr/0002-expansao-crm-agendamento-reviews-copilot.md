# ADR-0002 — Expansão do CRM: agendamento nativo, Google Review Lite e AI Copilot

- **Status:** aceito
- **Data:** 2026-09-01
- **Contexto medido em:** `244c8c6b` (`main`)
- **Decisões de produto:** [`PRODUCT_DECISIONS.md`](../../PRODUCT_DECISIONS.md)

---

## Contexto

O DeskcommCRM já concentra atendimento, contatos, oportunidades, memória do agente, handoff e automações relacionadas ao funil. A próxima expansão deve aumentar o valor do CRM sem transformar o produto, neste momento, em uma suíte omnichannel ou em um construtor de landing pages.

Foram travadas três capacidades de produto:

1. **Google Review Lite** para solicitar avaliações por meio do canal de atendimento já conectado;
2. **agendamento nativo no Deskcomm, usando Google Calendar como engine/source of truth de calendário**;
3. **CRM AI Copilot** voltado ao operador do CRM.

O objetivo deste ADR é fixar as fronteiras de arquitetura antes da implementação, para evitar dependências desnecessárias e duplicação de fontes de verdade.

---

## Decisões

### D1 — Google Review Lite não depende da Google Business Profile API no v1

O primeiro produto de reviews será deliberadamente simples.

Cada organização poderá configurar:

- URL direta de avaliação no Google;
- template da solicitação;
- habilitação/desabilitação;
- regras de elegibilidade/trigger quando a automação for adicionada;
- cooldown/deduplicação para evitar solicitações repetidas;
- registro de envio e auditoria.

O CRM deverá permitir inicialmente envio manual e, depois, disparo por evento de ciclo de vida do contato/oportunidade. A mensagem usa o mesmo canal de atendimento já conectado; esta feature não cria um novo canal.

Exemplo de template:

> Aproveitando...
>
> Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.
>
> Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.
>
> Avalie pelo link:
> {{google_review_url}}

**Regras obrigatórias:**

- não fazer review gating;
- não condicionar o pedido a sentimento, NPS ou previsão de nota;
- não selecionar somente clientes que aparentam estar satisfeitos;
- respeitar as regras do provedor/canal de mensageria para mensagens outbound;
- registrar quem/o que disparou a solicitação;
- não exigir OAuth ou API do Google apenas para enviar o link de avaliação.

**Fora do Lite v1:** importar avaliações, responder avaliações, analytics de reputação e sincronização com Google Business Profile.

**Reconsideraríamos se:** gestão de reputação dentro do CRM virar requisito comercial relevante. Nesse caso a integração com Google Business Profile entra como módulo posterior, sem bloquear o Lite.

---

### D2 — Google Calendar é a engine de calendário; Deskcomm é a UX e a engine de booking

Não adotaremos Cal.com/Calendly como dependência obrigatória da primeira implementação.

O desenho escolhido é:

```text
Cliente / operador / agente
          |
          v
Deskcomm Booking Service
  - regras de agenda
  - cálculo de slots
  - idempotência
  - vínculo com CRM
          |
          v
Google Calendar adapter
  - free/busy
  - create/update/cancel event
          |
          v
Google Calendar
```

A separação de responsabilidades é:

- **Google Calendar:** fonte de verdade para ocupação do calendário e eventos externos;
- **Deskcomm:** fonte de verdade para regras de booking, vínculo CRM, estado operacional e UX;
- **adapter de calendário:** fronteira que impede dependência estrutural do Google e permite um provider futuro, inclusive Cal.com, sem reescrever o domínio de booking.

#### Booking nativo significa, na prática

O Deskcomm deverá oferecer a experiência de agendamento diretamente no CRM e ao agente:

- tela/agenda nativa para visualizar disponibilidade e compromissos vinculados;
- operador escolhe contato/oportunidade, serviço e horário sem sair do CRM;
- agente consulta disponibilidade e oferece slots diretamente na conversa;
- após aceitação explícita do cliente, o agente pode criar o compromisso;
- reagendamento e cancelamento usam o mesmo domínio;
- timeline do contato/oportunidade registra o ciclo do compromisso.

Não é necessário um link externo do Cal.com para o fluxo principal. Uma página/widget público de booking poderá ser adicionado depois consumindo a mesma API interna.

#### Configuração mínima por organização

O domínio deverá suportar, sem exigir que todos os campos estejam no primeiro PR:

- conexão OAuth Google;
- calendário(s) e usuários responsáveis;
- tipos de atendimento/serviço;
- duração;
- horário comercial/disponibilidade base;
- buffers antes/depois;
- antecedência mínima;
- janela máxima para agendamento;
- timezone;
- política de reagendamento/cancelamento.

#### Invariantes

- nunca criar duas reservas para o mesmo slot/recurso por corrida concorrente;
- criação precisa ser idempotente para evitar evento duplicado por retry;
- disponibilidade deve considerar free/busy do Google antes da confirmação;
- timezone/DST são dados explícitos, não suposições do servidor;
- guardar o ID externo do evento e o vínculo com organização, contato e, quando aplicável, oportunidade/conversa;
- edição direta no Google não pode deixar o CRM indefinidamente divergente: a implementação deverá prever reconciliação por mecanismo suportado pelo provider ou fallback periódico;
- tokens OAuth são segredos e seguem a política existente de credenciais, nunca `organizations.settings` em texto puro.

#### Ferramentas esperadas para agente/Copilot

A API interna deverá permitir capacidades equivalentes a:

- `calendar.check_availability`;
- `calendar.create_booking`;
- `calendar.reschedule_booking`;
- `calendar.cancel_booking`;
- `calendar.get_booking`.

Nomes finais podem mudar. A regra é que agente e UI chamem o mesmo domínio de booking, em vez de cada um implementar Google Calendar diretamente.

Leitura de disponibilidade pode ser automática. Mutação exige uma intenção explícita: aceite do cliente no fluxo de atendimento ou ação/confirmação do operador.

**Cal.com fica opcional.** Só entra se, depois de medir a implementação nativa, entregar valor material — por exemplo recursos avançados de round-robin, routing forms, payments ou disponibilidade multi-provider que não compense reproduzir.

---

### D3 — CRM AI Copilot é uma capacidade operator-facing distinta do agente que atende clientes

O CRM terá um copiloto embutido para ajudar o operador a entender e agir sobre os dados do tenant.

Capacidades-alvo:

- resumir contato e conversa;
- explicar estágio do lead/oportunidade e contexto que levou até ele;
- mostrar memória relevante, promessas, objeções, follow-ups e pendências;
- sugerir próxima melhor ação;
- gerar rascunhos de resposta para aprovação;
- consultar pipeline e registros da organização;
- responder perguntas operacionais sobre contatos/oportunidades;
- depois de D2 implementado, consultar agenda e preparar ações de booking.

O Copilot será **tenant-scoped** e terá identidade/AI point próprio. Ele não deve reutilizar implicitamente o prompt do agente customer-facing como se fossem a mesma função.

#### Regra inicial de autonomia

Na primeira versão:

- leitura/análise pode ocorrer diretamente;
- rascunhos não são enviados automaticamente;
- mutações de CRM exigem confirmação explícita do operador;
- envio de mensagens exige confirmação explícita do operador;
- automação autônoma futura só entra por decisão separada, com auditabilidade e permissões próprias.

O Copilot deverá reutilizar, quando aplicável, a infraestrutura existente de provider/model credentials, métricas de uso/custo e audit trail, sem criar uma segunda stack de IA paralela.

#### Segurança e isolamento

- toda consulta é limitada à organização ativa;
- ferramentas aplicam RBAC no servidor, não apenas na UI;
- o LLM não recebe segredos/credenciais;
- mutações são validadas no backend independentemente do texto gerado pelo modelo;
- ações relevantes entram no audit trail.

---

## Ordem de implementação recomendada

A decisão de produto está travada; a ordem abaixo pode mudar se os testes mostrarem dependências diferentes.

1. **Google Review Lite** — menor superfície e entrega valor rapidamente;
2. **Google Calendar + booking nativo** — cria um novo domínio reutilizável pela UI e pelos agentes;
3. **CRM AI Copilot** — pode nascer já consumindo o domínio de booking e as fontes de contexto consolidadas.

A implementação deve ocorrer em PRs separados. Este ADR, sozinho, não autoriza migrations, OAuth, deploy ou ativação de automações em produção.

---

## Fora de escopo desta decisão

- expansão omnichannel;
- landing-page builder;
- full Google Business Profile/review analytics no Review Lite;
- Cal.com/Calendly como dependência core;
- pagamentos no agendamento;
- automação autônoma irrestrita do Copilot;
- substituição do Google Calendar como primeira engine de calendário.

---

## Consequências

**Ganhamos:** uma proposta de CRM mais completa sem terceirizar a UX de booking; uma feature de reviews de baixo atrito; e uma camada de IA para operador que pode reutilizar ferramentas e contexto já existentes.

**Evitamos:** hospedar e manter Cal.com sem necessidade comprovada; bloquear Review Lite em burocracia de Google Business Profile; e misturar o agente customer-facing com um copiloto operator-facing.

**Pagamos:** OAuth/sincronização com Google Calendar vira responsabilidade nossa; booking precisa de idempotência e reconciliação corretas; e o Copilot amplia a superfície de RBAC/auditoria.

**Reconsideraremos:** providers adicionais de calendário, integração completa com Google Business Profile e autonomia maior do Copilot somente a partir de necessidade comercial ou evidência operacional.