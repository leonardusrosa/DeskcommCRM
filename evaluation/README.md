# DeskcommCRM Product Evaluation Workspace

Este diretório contém a estrutura para avaliação de produto ponta a ponta (E2E) do DeskcommCRM em ambiente real de homologação/produção.

**Baseline de Rollback:** `b027a915ffa82420acff9fde27c5ff98dc01efb4`  
**Ambiente:** `https://deskcomm.autocora.com.br`

---

## 📁 Estrutura de Arquivos

- [`checklist.md`](./checklist.md) — Checklist estruturado e reutilizável de testes funcionais e operacionais.
- [`findings.md`](./findings.md) — Registro consolidado de apontamentos encontrados durante a avaliação.
- [`templates/finding-template.md`](./templates/finding-template.md) — Modelo padrão para registro manual de achados.
- [`scripts/log-finding.py`](./scripts/log-finding.py) — Script CLI para registro rápido e interativo de novos apontamentos.

---

## 🏷️ Categorias de Apontamentos

| Categoria | Descrição |
| :--- | :--- |
| **`BUG`** | Falha de execução, erro de estado, quebra de contrato ou comportamento incorreto. |
| **`UX_FRICTION`** | Dificuldade de navegação, lentidão perceptual, feedback visual ausente ou confuso. |
| **`MISSING_FEATURE`** | Funcionalidade esperada para o fluxo de valor que não está presente. |
| **`UNNECESSARY`** | Elemento de interface, passo ou abstração desnecessária/bloat. |
| **`GOOD`** | Comportamento que superou expectativas, fluxo fluido ou diferencial positivo. |
| **`QUESTION`** | Dúvida de negócio, regra que requer alinhamento ou decisão de produto. |

---

## 🚦 Níveis de Severidade

- **`blocker`**: Impede a continuidade do fluxo operacional crítico (ex: mensagem travada, erro 500 no login).
- **`high`**: Afeta fluxo principal, mas há contorno manual temporário.
- **`medium`**: Inconsistência pontual ou atrito de usabilidade que não bloqueia o fluxo.
- **`low`**: Ajuste cosmético, refinamento tipográfico ou detalhe visual menor.

---

## ⚡ Como Registrar um Novo Apontamento

### Opção 1: Via script CLI (rápido e interativo)
```bash
python3 evaluation/scripts/log-finding.py
```

### Opção 2: Edição direta no Markdown
Adicione uma nova seção em [`findings.md`](./findings.md) utilizando a estrutura de [`templates/finding-template.md`](./templates/finding-template.md).
