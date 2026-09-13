# DeskcommCRM Product Evaluation Findings

Registro consolidado de apontamentos encontrados durante a avaliação estruturada de produto.

**Baseline de Avaliação:** `b027a915ffa82420acff9fde27c5ff98dc01efb4`  
**Data de Início:** 2026-08-25  

---

## 📊 Sumário de Apontamentos

| ID | Categoria | Severidade | Área/Tela | Título Resumido | Escopo |
| :--- | :---: | :---: | :--- | :--- | :---: |
| *(Nenhum apontamento registrado ainda)* | - | - | - | - | - |

---

## 📝 Registro Detalhado de Apontamentos

*(Novos apontamentos gerados pelo script `evaluation/scripts/log-finding.py` ou adicionados manualmente serão inseridos abaixo)*


### F-20260827-01 — Provedor OpenCode Zen devolve HTTP 500 durante execução de turno inbound
- **Categoria:** `BUG`
- **Severidade:** `high`
- **Escopo:** `provider-specific`
- **Área/Tela:** `workers/agent-worker (agent-engine) / OpenCode Zen Gateway`
- **Título Resumido:** Provedor OpenCode Zen (muse-spark-1.2-contributor-free) retornou HTTP 500 Internal Server Error no gateway upstream
- **Esperado:** O modelo responder a mensagem inbound normalmente.
- **Atual:** O provedor `opencode_zen` falhou após 3 tentativas com `AI_APICallError: Internal server error` no endpoint `https://opencode.ai/zen/v1`.
- **Evidências:** 
  - Inbound Message ID: `12e099ae-5ead-4819-b280-56e4867e4771`
  - Job Queue ID: `5e20e550-ccf1-44ca-b57f-00f349a658b0`
  - Conversation ID: `796e8acb-34d7-430a-96cf-d0c1540e7164`
- **Impacto Comercial:** A mensagem do lead entra com sucesso pelo WAHA e é gravada no banco, mas a resposta da IA não é disparada devido a instabilidade no gateway de terceiros.
- **Direção Sugerida:** Adicionar fallback transparente para outro provedor configurado na organização (ex: OpenRouter / Anthropic) quando o provedor primário sofrer 5xx continuado.
- **Corrigir agora?** Não (Regra de governança do E2E: não alterar código ou versão durante a avaliação).
