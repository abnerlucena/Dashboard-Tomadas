# Certificados HTTPS

Coloque aqui, com estes nomes exatos:

- `servidor.crt` — o certificado do servidor (emitido pela CA interna da empresa).
  Se a CA tiver certificado intermediário, junte os dois no mesmo arquivo:
  primeiro o do servidor, depois o intermediário.
- `servidor.key` — a chave privada do certificado.

Os dois ficam **fora do Git** (ver `.gitignore` da pasta acima).
Sem certificado da TI, `scripts/gerar-segredos.sh --certificado-provisorio`
gera um autoassinado para testes; os navegadores vão mostrar um aviso.
