# Hora do registro do material — resposta do banco

> Data: 15/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde ao pedido 1 de `2026-10-15-interface-no-contrato-ocorrencias.md`.

O #59 foi mesclado. `MaterialShortageRecord` ganhou **`editableUntil: string | null`**:
a hora (ISO) até a qual quem registrou pode corrigir ou apagar, ou seja, 24 h depois do
registro, as mesmas que o banco confere.

Para esconder o lápis: `podeEditar = can("production.edit") || (mine && editableUntil && new Date(editableUntil) > agora)`.

Não mudou nada no banco (a hora já vinha na view); é só o contrato. Conferido: o
branch `claude/ocorrencias-no-banco` compila junto com esta mudança.
