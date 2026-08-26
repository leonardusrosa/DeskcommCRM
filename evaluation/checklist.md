# Reusable End-to-End Evaluation Checklist

Este checklist cobre os 14 eixos operacionais críticos do DeskcommCRM para avaliação estruturada em ambiente de produção.

---

### 1. WhatsApp Inbound
- [ ] Mensagem de texto enviada por contato externo é recebida via WAHA webhook.
- [ ] Mensagens de áudio/mídia são recebidas com status e transcrição/aviso adequados.
- [ ] Mensagem gera ou atualiza sessão de atendimento na Inbox em tempo real.
- [ ] Indicador de canal (WhatsApp) e status de entrega/leitura sincronizados.

### 2. Contact Creation & Enrichment
- [ ] Novo número de telefone cria registro de contato no banco com dados mínimos.
- [ ] Nome e foto de perfil (se disponíveis no canal) são persistidos.
- [ ] Deduplicação correta ao receber nova mensagem do mesmo telefone (sem duplicar contato).
- [ ] Histórico de mensagens anteriores vinculado ao contato correto.

### 3. AI Qualification & Tone
- [ ] Agente responde conforme o prompt e papel configurados para o estágio.
- [ ] Qualificação captura intenção do lead (produto, orçamento, urgência).
- [ ] Resposta respeita limites de tamanho e tom de voz (sem jargões/alucinações).
- [ ] Agente respeita horário de atendimento e regras de negócio.

### 4. CRM Pipeline Creation & Stage Update
- [ ] Lead é criado automaticamente no Kanban/Pipeline correspondente.
- [ ] Movimentação de estágio (ex: *Novo* → *Qualificado* → *Proposta*) reflete na UI.
- [ ] Alteração manual de estágio no Kanban sincroniza com o estado do agente.
- [ ] Métricas do funil e contadores de estágio são atualizados corretamente.

### 5. Agent Tool Calls
- [ ] Agente invoca ferramentas configuradas (ex: agendamento, consulta de preço, tag).
- [ ] Parâmetros passados para as ferramentas são validados e bem tipados.
- [ ] Erros de tool call são tratados com fallback elegante (sem expor stack trace ao lead).
- [ ] Log de execução registra chamada, parâmetros e resposta da tool em `llm_calls`.

### 6. Human Handoff (Transbordo Humano)
- [ ] Agente reconhece gatilho de transbordo (solicitação explícita ou regra de risco).
- [ ] Atendimento muda para status manual / pausado para o bot.
- [ ] Atendente humano recebe notificação / visualiza conversa na fila de espera.
- [ ] Mensagem enviada pelo atendente humano é entregue ao WhatsApp do lead.

### 7. Return to AI (Retorno ao Bot)
- [ ] Atendente humano pode devolver o atendimento ao agente com 1 clique.
- [ ] Agente retoma contexto da conversa sem repetir saudações iniciais.
- [ ] Histórico gerado pelo humano é visível no contexto do agente.
- [ ] Status de automação atualizado visualmente na Inbox.

### 8. Follow-up Scheduling
- [ ] Agendamento de follow-up programado por inatividade ou estágio de funil.
- [ ] Registro persistido na tabela de agendamentos com data/hora e fluxo alvo.
- [ ] Cancelamento automático do follow-up se o lead responder antes do prazo.
- [ ] Visualização do fluxo e agendamentos pendentes na tela de Follow-ups.

### 9. Follow-up Execution
- [ ] Scheduler/Worker processa fila no horário correto.
- [ ] Mensagem de follow-up é disparada via WhatsApp.
- [ ] Se o lead responder ao follow-up, o agente continua a qualificação contextualmente.
- [ ] Bloqueio de múltiplos follow-ups simultâneos (anti-spam).

### 10. Conversation Memory & Context
- [ ] Agente lembra informações enviadas pelo lead em turnos anteriores.
- [ ] Memória organizacional / RAG injeta dados factuais da empresa quando aplicável.
- [ ] Limpeza/resumo de contexto para conversas muito longas preserva pontos críticos.
- [ ] Histórico de sessões passadas acessível pelo operador.

### 11. Worker Restart & Recovery
- [ ] Envio de mensagem durante reinicialização do container `deskcomm-worker`.
- [ ] Worker recupera jobs pendentes da fila Redis após subida sem perda de mensagem.
- [ ] Sem duplicidade de respostas ao reprocessar jobs interrompidos (idempotência).
- [ ] Heartbeat e métricas de saúde voltam ao estado `healthy`.

### 12. BYOK Provider Switching
- [ ] Alternar provedor ativo (ex: OpenCode Zen → OpenAI → Anthropic → DeepSeek).
- [ ] Teste de conexão e prova de saldo funcionam para todos os provedores cadastrados.
- [ ] Agente passa a responder usando o novo modelo imediatamente.
- [ ] Custos e contadores de tokens continuam sendo atribuídos ao provedor correto.

### 13. Light / Dark / System Mode
- [ ] Alternância entre Claro, Escuro e Sistema sem quebra de contraste.
- [ ] Legibilidade mantida em Kanban, Inbox, tabelas de logs e formulários.
- [ ] Preferência de tema persiste após refresh e em novas abas (`localStorage`).
- [ ] Atalho de teclado (`Mod+Shift+L`) funciona globalmente.

### 14. Mobile Usability & Responsiveness
- [ ] Inbox e visualização de conversas navegáveis em tela de smartphone (< 400px).
- [ ] Painel Kanban com scroll horizontal suave ou visualização em lista.
- [ ] Menus de navegação, modais e seletores de provedor acessíveis no toque.
- [ ] Input de mensagem e envio não sobrepostos pelo teclado virtual.
