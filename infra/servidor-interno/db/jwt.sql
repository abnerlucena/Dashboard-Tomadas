-- Roda uma vez, na primeira subida do banco. Igual ao arquivo oficial.
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';
