#!/usr/bin/env python3
import os
import sys
import re
import argparse
from datetime import datetime, timezone, timedelta

FINDINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "findings.md")

CATEGORIAS_VALIDAS = ["BUG", "UX_FRICTION", "MISSING_FEATURE", "UNNECESSARY", "GOOD", "QUESTION"]
SEVERIDADES_VALIDAS = ["blocker", "high", "medium", "low"]
ESCOPOS_VALIDOS = ["generic", "niche-specific"]

def obter_proximo_id(conteudo: str) -> str:
    matches = re.findall(r"\[FND-(\d+)\]", conteudo)
    if not matches:
        return "FND-001"
    numeros = [int(m) for m in matches]
    proximo = max(numeros) + 1
    return f"FND-{proximo:03d}"

def obter_timestamp_atual() -> str:
    tz_br = timezone(timedelta(hours=-3))
    return datetime.now(tz_br).strftime("%Y-%m-%dT%H:%M:%S-03:00")

def prompt_opcao(titulo: str, opcoes: list, padrao: str = None) -> str:
    print(f"\n{titulo}")
    for i, op in enumerate(opcoes, 1):
        default_mark = " (padrão)" if op == padrao else ""
        print(f"  [{i}] {op}{default_mark}")
    while True:
        escolha = input(f"Selecione [1-{len(opcoes)}]: ").strip()
        if not escolha and padrao:
            return padrao
        if escolha.isdigit() and 1 <= int(escolha) <= len(opcoes):
            return opcoes[int(escolha) - 1]
        if escolha in opcoes:
            return escolha
        print("Opção inválida. Tente novamente.")

def coletar_interativo():
    print("=" * 60)
    print("  📋 Registro de Apontamento de Produto — DeskcommCRM")
    print("=" * 60)

    titulo = input("\nTítulo resumido do apontamento: ").strip()
    while not titulo:
        titulo = input("O título é obrigatório: ").strip()

    categoria = prompt_opcao("Categoria:", CATEGORIAS_VALIDAS, "BUG")
    severidade = prompt_opcao("Severidade:", SEVERIDADES_VALIDAS, "medium")
    escopo = prompt_opcao("Escopo:", ESCOPOS_VALIDOS, "generic")

    area = input("\nÁrea / Tela afetada (ex: Inbox, Kanban, Follow-ups): ").strip() or "Geral"
    scenario = input("\nCenário (O que o usuário/operador estava tentando fazer?): ").strip() or "N/A"
    expected = input("\nComportamento esperado: ").strip() or "N/A"
    observed = input("\nComportamento observado: ").strip() or "N/A"

    print("\nPassos para reprodução (linhas separadas, pressione Enter em branco para finalizar):")
    passos = []
    while True:
        linha = input(f"  {len(passos) + 1}. ").strip()
        if not linha:
            break
        passos.append(linha)
    if not passos:
        passos = ["1. Conforme descrito no cenário."]

    evidencias = input("\nEvidências / URLs / Logs: ").strip() or "N/A"
    componente = input("\nComponente ou código suspeito (ex: app/inbox/page.tsx): ").strip() or "A investigar"
    sugestao = input("\nSugestão de correção (NÃO será implementada agora): ").strip() or "A avaliar no ciclo de refinamento"

    return {
        "titulo": titulo,
        "categoria": categoria,
        "severidade": severidade,
        "escopo": escopo,
        "area": area,
        "scenario": scenario,
        "expected": expected,
        "observed": observed,
        "passos": passos,
        "evidencias": evidencias,
        "componente": componente,
        "sugestao": sugestao,
    }

def salvar_apontamento(dados: dict):
    if not os.path.exists(FINDINGS_FILE):
        print(f"Erro: Arquivo {FINDINGS_FILE} não encontrado.")
        sys.exit(1)

    with open(FINDINGS_FILE, "r", encoding="utf-8") as f:
        conteudo = f.read()

    fnd_id = obter_proximo_id(conteudo)
    timestamp = obter_timestamp_atual()

    passos_md = "\n".join(f"{i+1}. {p}" for i, p in enumerate(dados["passos"]))

    bloco_detalhado = f"""### [{fnd_id}] {dados['titulo']}

- **Timestamp:** {timestamp}
- **Categoria:** `{dados['categoria']}`
- **Área / Tela:** {dados['area']}
- **Severidade:** `{dados['severidade']}`
- **Escopo:** `{dados['escopo']}`

#### 🎯 Cenário
{dados['scenario']}

#### 🟢 Comportamento Esperado
{dados['expected']}

#### 🔴 Comportamento Observado
{dados['observed']}

#### 📋 Passos para Reprodução
{passos_md}

#### 📸 Evidências & Logs
{dados['evidencias']}

#### 🔍 Componente / Código Suspeito
- `{dados['componente']}`

#### 💡 Sugestão de Correção (Não implementar automaticamente)
- {dados['sugestao']}

---
"""

    linha_tabela = f"| **{fnd_id}** | `{dados['categoria']}` | `{dados['severidade']}` | {dados['area']} | {dados['titulo']} | `{dados['escopo']}` |"
    
    if "*(Nenhum apontamento registrado ainda)*" in conteudo:
        conteudo = conteudo.replace(
            "| *(Nenhum apontamento registrado ainda)* | - | - | - | - | - |",
            linha_tabela
        )
    else:
        divisoria = "\n---\n\n## 📝 Registro Detalhado"
        if divisoria in conteudo:
            conteudo = conteudo.replace(divisoria, f"\n{linha_tabela}{divisoria}")
        else:
            conteudo += f"\n{linha_tabela}"

    conteudo += f"\n{bloco_detalhado}"

    with open(FINDINGS_FILE, "w", encoding="utf-8") as f:
        f.write(conteudo)

    print(f"\n✅ Apontamento [{fnd_id}] registrado com sucesso em {FINDINGS_FILE}!")

def main():
    parser = argparse.ArgumentParser(description="Registra um apontamento de produto no DeskcommCRM.")
    parser.add_argument("--title", help="Título resumido")
    parser.add_argument("--category", choices=CATEGORIAS_VALIDAS, help="Categoria do apontamento")
    parser.add_argument("--severity", choices=SEVERIDADES_VALIDAS, help="Severidade")
    parser.add_argument("--scope", choices=ESCOPOS_VALIDOS, default="generic", help="Escopo")
    parser.add_argument("--area", default="Geral", help="Área / Tela")
    parser.add_argument("--scenario", default="N/A", help="Cenário")
    parser.add_argument("--expected", default="N/A", help="Comportamento esperado")
    parser.add_argument("--observed", default="N/A", help="Comportamento observado")
    parser.add_argument("--evidence", default="N/A", help="Evidências ou Logs")
    parser.add_argument("--component", default="A investigar", help="Código ou componente suspeito")
    parser.add_argument("--fix", default="A avaliar no ciclo de refinamento", help="Sugestão de correção")

    args = parser.parse_args()

    if args.title and args.category and args.severity:
        dados = {
            "titulo": args.title,
            "categoria": args.category,
            "severidade": args.severity,
            "escopo": args.scope,
            "area": args.area,
            "scenario": args.scenario,
            "expected": args.expected,
            "observed": args.observed,
            "passos": ["1. Conforme descrito no cenário."],
            "evidencias": args.evidence,
            "componente": args.component,
            "sugestao": args.fix,
        }
    else:
        dados = coletar_interativo()

    salvar_apontamento(dados)

if __name__ == "__main__":
    main()
