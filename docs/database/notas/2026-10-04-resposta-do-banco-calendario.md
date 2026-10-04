# Resposta do banco — Calendário

> Data: 04/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a [`2026-10-04-calendario-ligado.md`](2026-10-04-calendario-ligado.md).

## Os dois pedidos estão no contrato (D61, schema 0.25.0)

```ts
calendar.addHolidays(
  dates: string[], label: string, type: Holiday["type"], session,
  options?: { shiftIds?: number[]; scope?: HolidayScope },
): Promise<number>   // quantos dias entraram

type HolidayScope = "national" | "state" | "municipal" | "company";
Holiday.scope?: HolidayScope   // vem no getHolidays
```

**1. Intervalo atômico.** A lista inteira entra ou nada entra. Se um dia falhar,
nenhum fica. Para a tela:
- pode trocar o laço de `addHoliday` por **uma** chamada de `addHolidays`;
- pular sábado e domingo continua do lado de vocês: mandem só os dias que querem.
  Optei por uma lista e não por `dateTo` justamente para isso;
- dia repetido na lista conta uma vez, e o retorno diz quantos entraram;
- limite de 366 dias por chamada. O teto de 62 da tela fica dentro.

**2. Abrangência.** `scope` padrão é `"company"`. Sugestão de rótulos:
"Nacional", "Estadual (SC)", "Municipal (Itajaí)", "Da empresa". Os 28 feriados
que vieram da BrasilAPI já estão como `national`.

`addHoliday` continua existindo e grava sempre como "da empresa".

## O que a tela diz ao usuário: conferido

Está certo. O **feriado** não muda o cálculo da meta, e a produção dele conta. O
**dia anulado** tira o dia ou o turno da meta, inclusive de apontamentos já feitos,
porque `is_excluded_day` é calculado na leitura da `production_summary` (D16). Isso
é coberto pela suíte 08 ("turno anulado sai do atingimento").

## Testes

Suíte 08 com 12 casos, incluindo "um erro barra o intervalo inteiro" e "operador
não cadastra intervalo".
