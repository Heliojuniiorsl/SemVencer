create extension if not exists "pgcrypto";

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique,
  telefone text not null,
  admin boolean not null default false,
  aprovado boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table if exists public.usuarios
add column if not exists aprovado boolean not null default false;

create table if not exists public.validades (
  id text primary key,
  usuario_id uuid references public.usuarios(id) on delete set null,
  produto text not null,
  plu text not null,
  categoria text default 'Cadastro',
  lote text default 'Cadastro manual',
  setor text,
  tipo text check (tipo in ('RESF', 'CONG') or tipo is null),
  quantidade text,
  fabricacao date,
  validade date not null,
  imagem text,
  responsavel text,
  revisado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fotos_produtos (
  plu text primary key,
  imagem text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_validades_updated_at on public.validades;
create trigger set_validades_updated_at
before update on public.validades
for each row execute function public.set_updated_at();

drop trigger if exists set_fotos_produtos_updated_at on public.fotos_produtos;
create trigger set_fotos_produtos_updated_at
before update on public.fotos_produtos
for each row execute function public.set_updated_at();

insert into public.usuarios (matricula, telefone, admin, aprovado)
values ('000000', '00000000000', true, true)
on conflict (matricula)
do update set admin = true, aprovado = true;

update public.usuarios
set admin = false
where matricula = '3408990';

alter table public.usuarios enable row level security;
alter table public.validades enable row level security;
alter table public.fotos_produtos enable row level security;

drop policy if exists "usuarios leitura anon" on public.usuarios;
create policy "usuarios leitura anon"
on public.usuarios for select
to anon
using (true);

drop policy if exists "usuarios cadastro anon" on public.usuarios;
create policy "usuarios cadastro anon"
on public.usuarios for insert
to anon
with check (true);

drop policy if exists "usuarios atualizacao anon" on public.usuarios;
create policy "usuarios atualizacao anon"
on public.usuarios for update
to anon
using (true)
with check (true);

drop policy if exists "validades leitura anon" on public.validades;
create policy "validades leitura anon"
on public.validades for select
to anon
using (true);

drop policy if exists "validades escrita anon" on public.validades;
create policy "validades escrita anon"
on public.validades for insert
to anon
with check (true);

drop policy if exists "validades atualizacao anon" on public.validades;
create policy "validades atualizacao anon"
on public.validades for update
to anon
using (true)
with check (true);

drop policy if exists "validades exclusao anon" on public.validades;
create policy "validades exclusao anon"
on public.validades for delete
to anon
using (true);

drop policy if exists "fotos leitura anon" on public.fotos_produtos;
create policy "fotos leitura anon"
on public.fotos_produtos for select
to anon
using (true);

drop policy if exists "fotos escrita anon" on public.fotos_produtos;
create policy "fotos escrita anon"
on public.fotos_produtos for insert
to anon
with check (true);

drop policy if exists "fotos atualizacao anon" on public.fotos_produtos;
create policy "fotos atualizacao anon"
on public.fotos_produtos for update
to anon
using (true)
with check (true);
