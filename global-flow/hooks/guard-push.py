#!/usr/bin/env python3
"""Guarda global de push (hook PreToolUse do Claude Code, matcher Bash, if "Bash(git push *)").

Bloqueia, em qualquer projeto:
  - push direto para main ou master;
  - push forçado (--force, --force-with-lease e -f).

Entrada: JSON da chamada na entrada padrão ({"tool_name": "Bash", "tool_input": {"command": "..."}}).
Saída: JSON com permissionDecision "deny" quando bloqueia; sem saída quando permite.
Falha do próprio script: o hook é configurado com onFailure "block" (ver settings.snippet.json).
"""
import json
import re
import sys


def decide(command: str) -> str | None:
    if not re.search(r"\bgit\s+push\b", command):
        return None
    if re.search(r"(\s--force(-with-lease)?\b|\s-f\b)", command):
        return "Push forçado bloqueado pela regra global de fluxo. Use um commit novo ou peça confirmação explícita ao usuário."
    # destino main/master: aparece como argumento depois de "git push", inclusive "HEAD:main" ou "origin main"
    if re.search(r"\s(main|master)\b", command) or re.search(r":(main|master)\b", command):
        return "Push direto para main/master bloqueado. Trabalhe em um branch próprio e abra PR quando o usuário pedir."
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0  # sem payload legível: não é o nosso caso; o onFailure cuida de falhas reais
    if payload.get("tool_name") != "Bash":
        return 0
    command = (payload.get("tool_input") or {}).get("command", "")
    reason = decide(command)
    if reason:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
