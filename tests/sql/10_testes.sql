\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001','gestor@x.com','{"nome":"Gestor"}'),
 ('00000000-0000-0000-0000-000000000002','ana@x.com','{"nome":"Ana"}');
select nome, papel, ativo from perfis order by email;

-- atendente inativo não consegue salvar nem ler
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as canais_visiveis_inativo from canais;
select salvar_conferencia('2026-11-08', '[{"canal_id":"00000000-0000-0000-0000-000000000000"}]');
reset role;

-- gestor aprova a atendente
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-000000000001';
update perfis set ativo = true where email = 'ana@x.com';
-- tentar rebaixar o único admin
update perfis set papel = 'atendente' where email = 'gestor@x.com';
reset role;

-- atendente salva conferência parcial
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-000000000002';
select status from salvar_conferencia('2026-11-08',
  (select jsonb_agg(jsonb_build_object('canal_id', id, 'leads_crm', case when nome='META' then 150 end, 'leads_planilha', case when nome='META' then 145 end, 'observacao', null)) from canais));
-- duplicidade: salvar de novo sem versão => CONFLITO
select salvar_conferencia('2026-11-08', (select jsonb_agg(jsonb_build_object('canal_id', id, 'leads_crm', 1, 'leads_planilha', 1)) from canais));
-- negativo
select salvar_conferencia('2026-11-07', (select jsonb_agg(jsonb_build_object('canal_id', id, 'leads_crm', -1, 'leads_planilha', 1)) from canais));
-- vazio
select salvar_conferencia('2026-11-07', (select jsonb_agg(jsonb_build_object('canal_id', id)) from canais));
-- futuro
select salvar_conferencia('2030-01-01', (select jsonb_agg(jsonb_build_object('canal_id', id, 'leads_crm', 1, 'leads_planilha', 1)) from canais));
-- completo com zero (zero conta como preenchido) e sem divergência
select status from salvar_conferencia('2026-11-07', (select jsonb_agg(jsonb_build_object('canal_id', id, 'leads_crm', 0, 'leads_planilha', 0)) from canais));
-- edição com versão correta => completa com divergência
select status from salvar_conferencia('2026-11-08',
  (select jsonb_agg(jsonb_build_object('canal_id', id, 'leads_crm', 150, 'leads_planilha', case when nome='META' then 145 else 150 end, 'observacao', case when nome='META' then 'Instabilidade CRM' end)) from canais),
  (select updated_at from conferencias where data='2026-11-08'));
-- escrita direta bloqueada
insert into conferencias (data) values ('2026-11-01');
update lancamentos set leads_crm = 999;
select count(*) filter (where leads_crm = 999) as alterados_direto from lancamentos;
-- atendente não exclui
select excluir_conferencia((select id from conferencias where data='2026-11-07'));
-- atendente não cria canal
insert into canais (nome) values ('X');
select data, canal_nome, leads_crm, leads_planilha, diferenca, status_conferencia from v_lancamentos where canal_nome='META' order by data;
select count(*) as auditoria_visivel_atendente from auditoria;
reset role;

-- admin exclui e auditoria preserva retrato
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-000000000001';
select excluir_conferencia((select id from conferencias where data='2026-11-07'));
select tabela, acao, data_referencia, canal_nome, dados_antigos->>'leads_crm' ant, dados_novos->>'leads_crm' novo, usuario_nome,
       jsonb_array_length(dados_antigos->'lancamentos') snap from auditoria order by id;
select data, status from conferencias;
insert into canais (nome, ordem) values ('meta ', 9);
reset role;
-- anon sem acesso
set role anon; select count(*) from canais; reset role;
