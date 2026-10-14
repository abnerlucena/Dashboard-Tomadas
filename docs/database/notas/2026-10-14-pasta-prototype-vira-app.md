# A pasta `prototype/` virou `app/`

> Data: 14/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Não pede decisão. Pede só que o branch do banco traga a `main`.

## Em uma linha

A interface mudou de pasta: `prototype/` agora é **`app/`** (D69). Nada no banco nem
na camada de dados (`src/lib/**`) mudou.

## O que a sessão do banco precisa saber

- Caminhos novos: `app/src/data/machines.ts` (compartilhado) e
  `app/src/data/fromBackend.ts`. O `CLAUDE.md` já está atualizado.
- Os comandos continuam os mesmos (`npm run dev`, `npm run build`, `npm test`…);
  o build sai em `app/dist`.
- O `infra/servidor-interno/scripts/publicar-site.sh` passou a copiar de `app/dist`.
- `docs/database/README.md` e `02-referencia-tecnica.md` tiveram só a menção à
  pasta trocada. Notas antigas e decisões antigas ficaram como estavam.
- Ao trazer a `main`, o Git acompanha a renomeação. Se o seu branch criou arquivo
  novo em `prototype/`, mova-o para `app/`.
