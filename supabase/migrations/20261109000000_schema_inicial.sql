-- =====================================================================
-- Gestão de Leads | Controle de Aquisição — UniFatecie
-- Migration inicial: tabelas, funções, triggers de auditoria e RLS
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.papel_usuario as enum ('admin', 'atendente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_conferencia as enum ('PENDENTE', 'EM CONFERÊNCIA', 'CONFERIDO', 'COM DIVERGÊNCIA');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Perfis de usuário (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null,
  papel       public.papel_usuario not null default 'atendente',
  ativo       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Canais de aquisição
-- ---------------------------------------------------------------------
create table if not exists public.canais (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint canais_nome_nao_vazio check (length(trim(nome)) > 0)
);
create unique index if not exists canais_nome_unico on public.canais (upper(trim(nome)));

-- ---------------------------------------------------------------------
-- Conferências (uma por data — regra 1 e 2)
-- ---------------------------------------------------------------------
create table if not exists public.conferencias (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  status          public.status_conferencia not null default 'PENDENTE',
  criado_por      uuid references public.perfis(id) on delete set null,
  atualizado_por  uuid references public.perfis(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint conferencias_data_unica unique (data)
);

-- ---------------------------------------------------------------------
-- Lançamentos por canal dentro de uma conferência
-- NULL = campo não preenchido (diferente de zero — regra 10)
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id              uuid primary key default gen_random_uuid(),
  conferencia_id  uuid not null references public.conferencias(id) on delete cascade,
  canal_id        uuid not null references public.canais(id) on delete restrict,
  leads_crm       integer check (leads_crm is null or leads_crm >= 0),
  leads_planilha  integer check (leads_planilha is null or leads_planilha >= 0),
  diferenca       integer generated always as (leads_crm - leads_planilha) stored,
  observacao      text,
  atualizado_por  uuid references public.perfis(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint lancamentos_canal_unico unique (conferencia_id, canal_id)
);
create index if not exists lancamentos_canal_idx on public.lancamentos (canal_id);

-- ---------------------------------------------------------------------
-- Histórico de alterações (auditoria) — nunca apagado automaticamente
-- ---------------------------------------------------------------------
create table if not exists public.auditoria (
  id              bigint generated always as identity primary key,
  tabela          text not null,
  acao            text not null,              -- INSERT / UPDATE / DELETE
  registro_id     uuid,
  conferencia_id  uuid,                       -- sem FK: preserva histórico após exclusão
  data_referencia date,
  canal_nome      text,
  dados_antigos   jsonb,
  dados_novos     jsonb,
  usuario_id      uuid,
  usuario_nome    text,
  created_at      timestamptz not null default now()
);
create index if not exists auditoria_conf_idx on public.auditoria (conferencia_id);
create index if not exists auditoria_data_idx on public.auditoria (data_referencia);

-- ---------------------------------------------------------------------
-- Configurações gerais (chave/valor)
-- ---------------------------------------------------------------------
create table if not exists public.configuracoes (
  chave       text primary key,
  valor       jsonb not null,
  descricao   text,
  updated_at  timestamptz not null default now()
);

insert into public.configuracoes (chave, valor, descricao) values
  ('limite_divergencia_recorrente', '3'::jsonb, 'Nº mínimo de dias com divergência no período para um canal ser marcado como "recorrente"'),
  ('considerar_fim_de_semana', 'true'::jsonb, 'Sábados e domingos entram no controle de dias pendentes'),
  ('dias_edicao_atendente', '0'::jsonb, 'Quantos dias para trás um atendente pode editar (0 = sem limite)')
on conflict (chave) do nothing;

insert into public.canais (nome, ordem) values
  ('META', 1), ('GOOGLE', 2), ('TIKTOK', 3), ('SITE', 4), ('WHATSAPP 0036', 5), ('WHATSAPP 1357', 6)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Funções auxiliares de permissão
-- ---------------------------------------------------------------------
create or replace function public.usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo);
$$;

create or replace function public.usuario_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo and papel = 'admin');
$$;

-- updated_at automático
create or replace function public.tg_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists perfis_updated_at on public.perfis;
create trigger perfis_updated_at before update on public.perfis for each row execute function public.tg_updated_at();
drop trigger if exists canais_updated_at on public.canais;
create trigger canais_updated_at before update on public.canais for each row execute function public.tg_updated_at();
drop trigger if exists configuracoes_updated_at on public.configuracoes;
create trigger configuracoes_updated_at before update on public.configuracoes for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Criação automática do perfil ao cadastrar usuário no Auth.
-- O PRIMEIRO usuário do sistema vira administrador ativo.
-- Os demais entram como atendentes INATIVOS até um admin aprovar.
-- ---------------------------------------------------------------------
create or replace function public.tg_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_primeiro boolean;
begin
  select not exists (select 1 from public.perfis where papel = 'admin') into v_primeiro;
  insert into public.perfis (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when v_primeiro then 'admin'::public.papel_usuario else 'atendente'::public.papel_usuario end,
    v_primeiro
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- Impede ficar sem nenhum administrador ativo
create or replace function public.tg_protege_ultimo_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.papel = 'admin' and old.ativo)
     and (tg_op = 'DELETE' or new.papel <> 'admin' or not new.ativo) then
    if not exists (select 1 from public.perfis where id <> old.id and papel = 'admin' and ativo) then
      raise exception 'Não é possível remover o último administrador ativo do sistema.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists perfis_protege_admin on public.perfis;
create trigger perfis_protege_admin before update or delete on public.perfis
  for each row execute function public.tg_protege_ultimo_admin();

-- ---------------------------------------------------------------------
-- Auditoria de lançamentos e conferências
-- ---------------------------------------------------------------------
create or replace function public.tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conf_id uuid;
  v_data date;
  v_canal text;
  v_nome text;
  v_reg uuid;
begin
  select nome into v_nome from public.perfis where id = auth.uid();

  if tg_table_name = 'lancamentos' then
    v_conf_id := coalesce(new.conferencia_id, old.conferencia_id);
    v_reg := coalesce(new.id, old.id);
    select data into v_data from public.conferencias where id = v_conf_id;
    select nome into v_canal from public.canais where id = coalesce(new.canal_id, old.canal_id);
    -- Exclusão em cascata da conferência: o registro completo é gravado por excluir_conferencia()
    if tg_op = 'DELETE' and v_data is null then
      return old;
    end if;
    -- Ignora UPDATE sem mudança real de valores
    if tg_op = 'UPDATE'
       and new.leads_crm is not distinct from old.leads_crm
       and new.leads_planilha is not distinct from old.leads_planilha
       and new.observacao is not distinct from old.observacao then
      return new;
    end if;
    insert into public.auditoria (tabela, acao, registro_id, conferencia_id, data_referencia, canal_nome,
                                  dados_antigos, dados_novos, usuario_id, usuario_nome)
    values ('lancamentos', tg_op, v_reg, v_conf_id, v_data, v_canal,
      case when tg_op in ('UPDATE','DELETE') then jsonb_build_object('leads_crm', old.leads_crm, 'leads_planilha', old.leads_planilha, 'observacao', old.observacao) end,
      case when tg_op in ('INSERT','UPDATE') then jsonb_build_object('leads_crm', new.leads_crm, 'leads_planilha', new.leads_planilha, 'observacao', new.observacao) end,
      auth.uid(), v_nome);
  else -- conferencias
    if tg_op = 'DELETE' then
      return old; -- registrado por excluir_conferencia() com o retrato completo
    end if;
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then
      return new;
    end if;
    insert into public.auditoria (tabela, acao, registro_id, conferencia_id, data_referencia,
                                  dados_antigos, dados_novos, usuario_id, usuario_nome)
    values ('conferencias', tg_op, coalesce(new.id, old.id), coalesce(new.id, old.id), coalesce(new.data, old.data),
      case when tg_op in ('UPDATE','DELETE') then jsonb_build_object('status', old.status) end,
      case when tg_op in ('INSERT','UPDATE') then jsonb_build_object('status', new.status) end,
      auth.uid(), v_nome);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists lancamentos_auditoria on public.lancamentos;
create trigger lancamentos_auditoria after insert or update or delete on public.lancamentos
  for each row execute function public.tg_auditoria();
drop trigger if exists conferencias_auditoria on public.conferencias;
create trigger conferencias_auditoria after insert or update or delete on public.conferencias
  for each row execute function public.tg_auditoria();

-- ---------------------------------------------------------------------
-- Cálculo do status geral de uma conferência (regra da seção 8)
-- ---------------------------------------------------------------------
create or replace function public.calcular_status(p_conferencia_id uuid)
returns public.status_conferencia
language sql stable set search_path = public as $$
  select case
    when count(*) filter (where leads_crm is not null or leads_planilha is not null) = 0 then 'PENDENTE'
    when count(*) filter (where leads_crm is null or leads_planilha is null) > 0 then 'EM CONFERÊNCIA'
    when count(*) filter (where diferenca <> 0) > 0 then 'COM DIVERGÊNCIA'
    else 'CONFERIDO'
  end::public.status_conferencia
  from public.lancamentos where conferencia_id = p_conferencia_id;
$$;

-- ---------------------------------------------------------------------
-- RPC: salvar conferência do dia (transação única, sem duplicidade)
-- p_itens: [{ "canal_id": uuid, "leads_crm": int|null, "leads_planilha": int|null, "observacao": text|null }]
-- p_versao: updated_at que o usuário carregou (controle de edição simultânea);
--           null quando o usuário acredita que a data ainda não tem conferência.
-- ---------------------------------------------------------------------
create or replace function public.salvar_conferencia(p_data date, p_itens jsonb, p_versao timestamptz default null)
returns public.conferencias
language plpgsql security definer set search_path = public as $$
declare
  v_conf public.conferencias;
  v_item jsonb;
  v_crm integer;
  v_pla integer;
  v_obs text;
  v_limite integer;
  v_preenchidos integer := 0;
begin
  if not public.usuario_ativo() then
    raise exception 'Usuário sem permissão ou inativo.' using errcode = '42501';
  end if;
  if p_data is null then
    raise exception 'Informe a data de referência.';
  end if;
  if p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Não é possível lançar conferência para uma data futura.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum canal informado.';
  end if;

  -- Validação dos itens antes de gravar
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_crm := (v_item->>'leads_crm')::integer;
    v_pla := (v_item->>'leads_planilha')::integer;
    if v_crm < 0 or v_pla < 0 then
      raise exception 'Valores negativos não são permitidos.';
    end if;
    if v_crm is not null or v_pla is not null or nullif(trim(coalesce(v_item->>'observacao','')), '') is not null then
      v_preenchidos := v_preenchidos + 1;
    end if;
    if not exists (select 1 from public.canais where id = (v_item->>'canal_id')::uuid) then
      raise exception 'Canal inválido informado.';
    end if;
  end loop;

  if v_preenchidos = 0 then
    raise exception 'Preencha ao menos um campo antes de salvar.';
  end if;

  -- Trava a linha da data (ou garante criação única)
  select * into v_conf from public.conferencias where data = p_data for update;

  if found then
    if p_versao is null or date_trunc('milliseconds', v_conf.updated_at) <> date_trunc('milliseconds', p_versao) then
      raise exception 'CONFLITO: a conferência de % foi alterada por outro usuário. Recarregue a página para ver os dados atuais.', to_char(p_data, 'DD/MM/YYYY')
        using errcode = 'P0409';
    end if;
    if not public.usuario_admin() then
      select (valor)::text::integer into v_limite from public.configuracoes where chave = 'dias_edicao_atendente';
      if coalesce(v_limite, 0) > 0
         and p_data < (now() at time zone 'America/Sao_Paulo')::date - v_limite then
        raise exception 'Atendentes só podem editar conferências dos últimos % dias. Solicite a um gestor.', v_limite;
      end if;
    end if;
  else
    begin
      insert into public.conferencias (data, criado_por, atualizado_por)
      values (p_data, auth.uid(), auth.uid())
      returning * into v_conf;
    exception when unique_violation then
      raise exception 'CONFLITO: outro usuário acabou de criar a conferência de %. Recarregue a página.', to_char(p_data, 'DD/MM/YYYY')
        using errcode = 'P0409';
    end;
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_crm := (v_item->>'leads_crm')::integer;
    v_pla := (v_item->>'leads_planilha')::integer;
    v_obs := nullif(trim(coalesce(v_item->>'observacao', '')), '');
    insert into public.lancamentos (conferencia_id, canal_id, leads_crm, leads_planilha, observacao, atualizado_por)
    values (v_conf.id, (v_item->>'canal_id')::uuid, v_crm, v_pla, v_obs, auth.uid())
    on conflict (conferencia_id, canal_id) do update
      set leads_crm = excluded.leads_crm,
          leads_planilha = excluded.leads_planilha,
          observacao = excluded.observacao,
          atualizado_por = case
            when lancamentos.leads_crm is distinct from excluded.leads_crm
              or lancamentos.leads_planilha is distinct from excluded.leads_planilha
              or lancamentos.observacao is distinct from excluded.observacao
            then excluded.atualizado_por else lancamentos.atualizado_por end,
          updated_at = case
            when lancamentos.leads_crm is distinct from excluded.leads_crm
              or lancamentos.leads_planilha is distinct from excluded.leads_planilha
              or lancamentos.observacao is distinct from excluded.observacao
            then now() else lancamentos.updated_at end;
  end loop;

  update public.conferencias
     set status = public.calcular_status(v_conf.id),
         atualizado_por = auth.uid(),
         updated_at = clock_timestamp()
   where id = v_conf.id
  returning * into v_conf;

  return v_conf;
end $$;

-- ---------------------------------------------------------------------
-- RPC: excluir conferência (somente admin)
-- ---------------------------------------------------------------------
create or replace function public.excluir_conferencia(p_conferencia_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_conf public.conferencias;
  v_nome text;
begin
  if not public.usuario_admin() then
    raise exception 'Somente administradores podem excluir conferências.' using errcode = '42501';
  end if;
  select * into v_conf from public.conferencias where id = p_conferencia_id for update;
  if not found then
    raise exception 'Conferência não encontrada.';
  end if;
  select nome into v_nome from public.perfis where id = auth.uid();
  insert into public.auditoria (tabela, acao, registro_id, conferencia_id, data_referencia,
                                dados_antigos, dados_novos, usuario_id, usuario_nome)
  values ('conferencias', 'DELETE', v_conf.id, v_conf.id, v_conf.data,
    jsonb_build_object(
      'status', v_conf.status,
      'lancamentos', (select coalesce(jsonb_agg(jsonb_build_object(
          'canal', ca.nome, 'leads_crm', l.leads_crm, 'leads_planilha', l.leads_planilha, 'observacao', l.observacao)
          order by ca.ordem), '[]'::jsonb)
        from public.lancamentos l join public.canais ca on ca.id = l.canal_id
        where l.conferencia_id = v_conf.id)),
    null, auth.uid(), v_nome);
  delete from public.conferencias where id = p_conferencia_id;
end $$;

-- ---------------------------------------------------------------------
-- View achatada para consultas por período (respeita RLS de quem consulta)
-- ---------------------------------------------------------------------
create or replace view public.v_lancamentos with (security_invoker = true) as
select
  l.id,
  c.id            as conferencia_id,
  c.data,
  c.status        as status_conferencia,
  l.canal_id,
  ca.nome         as canal_nome,
  ca.ordem        as canal_ordem,
  l.leads_crm,
  l.leads_planilha,
  l.diferenca,
  l.observacao,
  c.criado_por,
  c.atualizado_por as conferencia_atualizada_por,
  l.atualizado_por,
  l.updated_at
from public.lancamentos l
join public.conferencias c on c.id = l.conferencia_id
join public.canais ca on ca.id = l.canal_id;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.perfis        enable row level security;
alter table public.canais        enable row level security;
alter table public.conferencias  enable row level security;
alter table public.lancamentos   enable row level security;
alter table public.auditoria     enable row level security;
alter table public.configuracoes enable row level security;

-- perfis
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (id = auth.uid() or public.usuario_ativo());
drop policy if exists perfis_update_admin on public.perfis;
create policy perfis_update_admin on public.perfis for update to authenticated
  using (public.usuario_admin()) with check (public.usuario_admin());

-- canais
drop policy if exists canais_select on public.canais;
create policy canais_select on public.canais for select to authenticated using (public.usuario_ativo());
drop policy if exists canais_insert on public.canais;
create policy canais_insert on public.canais for insert to authenticated with check (public.usuario_admin());
drop policy if exists canais_update on public.canais;
create policy canais_update on public.canais for update to authenticated using (public.usuario_admin()) with check (public.usuario_admin());
drop policy if exists canais_delete on public.canais;
create policy canais_delete on public.canais for delete to authenticated using (public.usuario_admin());

-- conferencias / lancamentos: leitura para usuários ativos; escrita só pelas RPCs
drop policy if exists conferencias_select on public.conferencias;
create policy conferencias_select on public.conferencias for select to authenticated using (public.usuario_ativo());
drop policy if exists lancamentos_select on public.lancamentos;
create policy lancamentos_select on public.lancamentos for select to authenticated using (public.usuario_ativo());

-- auditoria: admin vê tudo; atendente vê as próprias alterações
drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (public.usuario_admin() or (public.usuario_ativo() and usuario_id = auth.uid()));

-- configuracoes
drop policy if exists configuracoes_select on public.configuracoes;
create policy configuracoes_select on public.configuracoes for select to authenticated using (public.usuario_ativo());
drop policy if exists configuracoes_update on public.configuracoes;
create policy configuracoes_update on public.configuracoes for update to authenticated using (public.usuario_admin()) with check (public.usuario_admin());

-- Privilégios
revoke all on public.perfis, public.canais, public.conferencias, public.lancamentos, public.auditoria, public.configuracoes from anon;
revoke all on public.v_lancamentos from anon;
grant select on public.perfis, public.canais, public.conferencias, public.lancamentos, public.auditoria, public.configuracoes, public.v_lancamentos to authenticated;
grant update (nome, papel, ativo) on public.perfis to authenticated;
grant insert, update, delete on public.canais to authenticated;
grant update (valor) on public.configuracoes to authenticated;

revoke execute on function public.salvar_conferencia(date, jsonb, timestamptz) from public, anon;
revoke execute on function public.excluir_conferencia(uuid) from public, anon;
grant execute on function public.salvar_conferencia(date, jsonb, timestamptz) to authenticated;
grant execute on function public.excluir_conferencia(uuid) to authenticated;
grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.usuario_admin() to authenticated;

-- Escrita em conferências, lançamentos e auditoria somente via funções (RPC)
revoke insert, update, delete, truncate on public.conferencias, public.lancamentos, public.auditoria from authenticated;
revoke insert, delete, truncate on public.perfis, public.configuracoes from authenticated;

-- Ajustes de produção ------------------------------------------------
-- Somente o e-mail do gestor vira administrador automaticamente
create or replace function public.tg_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  v_admin := lower(new.email) = 'gestaocomercial@fatecie.edu.br'
             and not exists (select 1 from public.perfis where papel = 'admin');
  insert into public.perfis (id, nome, email, papel, ativo)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)), new.email,
          case when v_admin then 'admin'::public.papel_usuario else 'atendente'::public.papel_usuario end, v_admin)
  on conflict (id) do nothing;
  return new;
end $$;

-- Confirmação automática de e-mail (acesso controlado pela aprovação do gestor)
create or replace function public.tg_autoconfirmar_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then new.email_confirmed_at := now(); end if;
  return new;
end $$;
drop trigger if exists autoconfirmar_email on auth.users;
create trigger autoconfirmar_email before insert on auth.users for each row execute function public.tg_autoconfirmar_email();
revoke execute on function public.usuario_ativo() from public, anon;
revoke execute on function public.usuario_admin() from public, anon;
