# Testes de verificação do banco

Scripts SQL que conferem as regras do banco **no banco real**, sem deixar rastro:
cada execução acontece dentro de uma transação que termina em `rollback`
(tudo é desfeito no final — inclusive os usuários fictícios `@example.com`).

| Arquivo | O que testa |
|---|---|
| `00_fixtures.sql` | Cria usuários fictícios (gestora, 2 operadores, conta Admin compartilhada, pendente, TV, novo cadastro) e a tabela `results` |
| `01_funcoes.sql` | Funções de regra de negócio (migration 0009): apontar, completar, hora extra, permissões, conta compartilhada, ações em massa, metas, máquinas |
| `02_rls.sql` | Políticas de acesso (migration 0010): quem vê e quem altera o quê |
| `03_capacidade.sql` | Campos de processo, capacidade, tempo de turno e base da meta (migration 0013) |
| `04_importacao.sql` | Área de preparo da importação (migration 0016): coerência das linhas e quem enxerga |
| `05_carga_importacao.sql` | Carga e reversão do lote (migration 0019). **Monta o próprio lote de rascunho** — não depende de haver um lote na área de preparo |
| `06_meta_por_lotacao.sql` | Meta que depende da lotação (migrations 0021 e 0022): as três bases, a conta na leitura, e `save_machine_targets` preservando a base |
| `07_operadores_obrigatorios.sql` | Nº de operadores obrigatório onde a meta é por pessoa (migration 0028): quem exige, o que recusa, e que o passado importado continua lido como 1 pessoa |
| `08_calendario_pelo_app.sql` | O gestor mantém o calendário sozinho, pelo app: feriado de dia inteiro, parada de um turno, escopo municipal, remoção — e o operador não consegue. Confere também que o turno anulado sai do atingimento |
| `09_formato_da_op.sql` | Nº da OP só com números, até 15 dígitos (migration 0029): o que aceita, o que recusa, que uma OP ruim barra o apontamento inteiro, e que o histórico `IMPORTADO` ficou |
| `10_corrigir_apontamento.sql` | Corrigir um apontamento (migration 0030): OPs substituídas, D52, D54 e D57 na correção, mover de dia refaz a meta, o importado mantém a da planilha e aceita `IMPORTADO`, e o operador não corrige o apontamento de outra pessoa |
| `11_metas_historicas.sql` | Linha do tempo de metas anterior a 25/09 vinda da planilha (migrations 0031 a 0033): sem degrau de reserva, valores da planilha, todo importado bate com a meta do seu dia, repetível, nenhuma máquina sem degrau, e a trava de vigência volta a valer |

## Como rodar (SQL Editor do Supabase)

Pré-requisito: todas as migrations aplicadas. O seed estrutural pode ou não estar aplicado
(o bloco abaixo o inclui; ele não duplica nada).

Cole, **em uma única execução**, na ordem:

```sql
begin;
-- conteúdo de supabase/seed/01_estrutural.sql
-- conteúdo de supabase/tests/00_fixtures.sql
-- conteúdo de supabase/tests/01_funcoes.sql   (ou 02_rls.sql — um de cada vez)
rollback;
```

O resultado mostra a tabela `results`: cada linha é um teste, com `ok = true` quando o
banco se comportou como esperado. Linhas "NÃO pode…" passam quando o banco **recusa** a ação,
e a coluna `info` traz a mensagem de erro devolvida.

Resultado em 21/09/2026 (schema v0.10.3, banco já com o seed de demonstração): 24/24 testes de funções e 23/23 de RLS com `ok = true`.
Os testes filtram pelos dados que eles mesmos criam, então funcionam com o banco vazio ou com dados.

## Ao ler o resultado das suítes 01 e 02

Elas gravam numa tabela `results` com uma coluna `ok`. Um caso que dá resultado
**nulo** (por exemplo, uma comparação com `null`) não é verdadeiro nem falso. Por
isso conte as falhas com `ok is not true`, e não com `not ok`: do contrário o
caso nulo some das duas contas. Foi assim que, em 03/10/2026, a suíte 02 passou
de 23 para 22 casos sem nenhuma falha aparente.
