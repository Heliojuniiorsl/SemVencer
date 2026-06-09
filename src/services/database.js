import { supabase, supabaseConfigurado } from './supabaseClient';

export const ADMIN_MATRICULA = '000000';
export const CONTATO_LIBERACAO = '61998427629';

function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function exigirSupabase() {
  if (!supabaseConfigurado || !supabase) {
    throw new Error('Supabase nao configurado. O app precisa estar online para acessar o banco.');
  }
}

export function telefoneValido(valor) {
  const telefone = somenteDigitos(valor);
  const ddd = Number(telefone.slice(0, 2));
  const numero = telefone.slice(2);

  return (
    telefone.length === 11 &&
    ddd >= 11 &&
    ddd <= 99 &&
    numero.startsWith('9') &&
    !/^(\d)\1+$/.test(telefone)
  );
}

export function formatarTelefone(valor) {
  const telefone = somenteDigitos(valor).slice(0, 11);

  if (telefone.length <= 2) return telefone;
  if (telefone.length <= 7) return `(${telefone.slice(0, 2)}) ${telefone.slice(2)}`;

  return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`;
}

function normalizarPreferencias(preferencias = {}) {
  const secoes = Array.isArray(preferencias.secoesSelecionadas)
    ? preferencias.secoesSelecionadas
    : Array.isArray(preferencias.secoes_selecionadas)
      ? preferencias.secoes_selecionadas
      : [];

  return {
    secoesSelecionadas: Array.from(new Set(secoes.map((secao) => String(secao || '').trim()).filter(Boolean))),
    secoesConfiguradas: Boolean(preferencias.secoesConfiguradas ?? preferencias.secoes_configuradas),
    tema: ['claro', 'azul'].includes(preferencias.tema) ? preferencias.tema : 'claro',
  };
}

function normalizarUsuario(usuario) {
  if (!usuario) return null;
  const matricula = somenteDigitos(usuario.matricula);
  const admin = matricula === ADMIN_MATRICULA;

  return {
    id: usuario.id || `local-${matricula}`,
    matricula,
    telefone: somenteDigitos(usuario.telefone),
    admin,
    aprovado: admin || Boolean(usuario.aprovado),
    createdAt: usuario.created_at || usuario.createdAt || '',
    lastLoginAt: usuario.last_login_at || usuario.lastLoginAt || '',
    lastActivityLabel: usuario.last_activity_label || usuario.lastActivityLabel || '',
    lastActivityAt: usuario.last_activity_at || usuario.lastActivityAt || '',
    lastRoute: usuario.last_route || usuario.lastRoute || '',
    atividade: usuario.atividade || null,
  };
}

async function garantirUsuarioRemoto(usuario) {
  exigirSupabase();
  if (!usuario) throw new Error('Sessao invalida.');

  const matricula = somenteDigitos(usuario.matricula);
  const idRemoto = usuario.id && !String(usuario.id).startsWith('local-') ? usuario.id : '';
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, matricula, telefone, admin, aprovado')
    .eq(idRemoto ? 'id' : 'matricula', idRemoto || matricula)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Sessao local nao encontrada no Supabase. Cadastre a matricula e aguarde a aprovacao do admin.');

  const usuarioRemoto = normalizarUsuario(data);
  if (!usuarioRemoto.admin && !usuarioRemoto.aprovado) {
    throw new Error(`Cadastro pendente. Entre em contato com ${CONTATO_LIBERACAO} para liberar o acesso.`);
  }

  return usuarioRemoto;
}

function toDbValidade(item, usuario) {
  return {
    id: item.id,
    usuario_id: usuario?.id || null,
    produto: item.produto,
    plu: item.plu,
    categoria: item.categoria || 'Cadastro',
    lote: item.lote || 'Cadastro manual',
    setor: item.setor || '',
    tipo: item.tipo || '',
    quantidade: item.quantidade || '',
    fabricacao: item.fabricacao || null,
    validade: item.validade,
    responsavel: item.responsavel || '',
    revisado: Boolean(item.revisado),
  };
}

function fromDbValidade(item) {
  return {
    id: item.id,
    produto: item.produto,
    plu: item.plu,
    categoria: item.categoria || 'Cadastro',
    lote: item.lote || 'Cadastro manual',
    setor: item.setor || '',
    tipo: item.tipo || '',
    quantidade: item.quantidade || '',
    fabricacao: item.fabricacao || '',
    validade: item.validade,
    responsavel: item.responsavel || '',
    revisado: Boolean(item.revisado),
  };
}

function fromDbProduto(item) {
  return {
    plu: item.plu,
    descricao: item.descricao,
    categoria: item.categoria || 'Outros',
    tipo: item.tipo || item.tipo_plu || 'Nao informado',
    tipoPlu: item.tipo_plu || 'Nao informado',
    secao: item.secao || 'Outros',
    embalagemMultiplo: item.embalagem_multiplo ?? null,
  };
}

export function bancoAtivo() {
  return supabaseConfigurado;
}

export async function carregarProdutosBaseRemotos() {
  exigirSupabase();

  const tamanhoPagina = 1000;
  const produtos = [];

  for (let pagina = 0; ; pagina += 1) {
    const inicio = pagina * tamanhoPagina;
    const fim = inicio + tamanhoPagina - 1;
    const { data, error } = await supabase
      .from('produtos_base')
      .select('plu, descricao, categoria, tipo, tipo_plu, secao, embalagem_multiplo')
      .order('categoria', { ascending: true })
      .order('descricao', { ascending: true })
      .range(inicio, fim);

    if (error) {
      throw new Error(error.message);
    }

    produtos.push(...(data || []));

    if (!data || data.length < tamanhoPagina) {
      break;
    }
  }

  return produtos.map(fromDbProduto);
}

export async function cadastrarUsuario({ matricula, telefone }) {
  const matriculaLimpa = somenteDigitos(matricula);
  const telefoneLimpo = somenteDigitos(telefone);

  if (!matriculaLimpa || !telefoneLimpo) {
    throw new Error('Informe telefone e matricula.');
  }

  if (!telefoneValido(telefoneLimpo)) {
    throw new Error('Informe um telefone celular valido com DDD.');
  }

  const usuarioPayload = {
    matricula: matriculaLimpa,
    telefone: telefoneLimpo,
    admin: matriculaLimpa === ADMIN_MATRICULA,
    aprovado: matriculaLimpa === ADMIN_MATRICULA,
  };

  exigirSupabase();

  const { data: existente, error: consultaError } = await supabase
    .from('usuarios')
    .select('id, matricula, telefone, admin, aprovado')
    .eq('matricula', matriculaLimpa)
    .maybeSingle();

  if (consultaError) throw new Error(consultaError.message);

  if (existente) {
    if (!existente.admin && !existente.aprovado) {
      throw new Error(`Cadastro pendente. Entre em contato com ${CONTATO_LIBERACAO} para liberar o acesso.`);
    }

    throw new Error('Matricula ja cadastrada. Use o login para entrar.');
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert(usuarioPayload)
    .select('id, matricula, telefone, admin, aprovado')
    .single();

  if (error) throw new Error(error.message);
  return normalizarUsuario(data);
}

export async function loginUsuario(matricula) {
  const matriculaLimpa = somenteDigitos(matricula);

  if (!matriculaLimpa) {
    throw new Error('Informe a matricula.');
  }

  exigirSupabase();

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, matricula, telefone, admin, aprovado')
    .eq('matricula', matriculaLimpa)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data && matriculaLimpa === ADMIN_MATRICULA) {
    const { data: adminData, error: adminError } = await supabase
      .from('usuarios')
      .insert({ matricula: ADMIN_MATRICULA, telefone: '00000000000', admin: true, aprovado: true })
      .select('id, matricula, telefone, admin, aprovado')
      .single();

    if (adminError) throw new Error(adminError.message);
    return normalizarUsuario(adminData);
  }
  if (!data) throw new Error('Matricula nao cadastrada.');

  const precisaAdmin = matriculaLimpa === ADMIN_MATRICULA && !data.admin;
  if (precisaAdmin) {
    await supabase.from('usuarios').update({ admin: true, aprovado: true }).eq('id', data.id);
  }
  await supabase.from('usuarios').update({ last_login_at: new Date().toISOString() }).eq('id', data.id);

  const usuarioNormalizado = normalizarUsuario({ ...data, admin: data.admin || matriculaLimpa === ADMIN_MATRICULA });
  if (!usuarioNormalizado.admin && !usuarioNormalizado.aprovado) {
    throw new Error(`Cadastro pendente. Entre em contato com ${CONTATO_LIBERACAO} para liberar o acesso.`);
  }

  return usuarioNormalizado;
}

export async function carregarUsuariosPendentes() {
  exigirSupabase();

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, matricula, telefone, admin, aprovado, created_at')
    .eq('aprovado', false)
    .eq('admin', false)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(normalizarUsuario);
}

function resumoAtividadeUsuario(usuario, validades = []) {
  const itens = validades
    .filter((item) => item.usuario_id === usuario.id)
    .sort((a, b) => {
      const dataA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dataB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dataB - dataA;
  });
  const ultimo = itens[0] || null;
  const atividadeLabel =
    usuario.last_activity_label || usuario.lastActivityLabel || (ultimo ? `Cadastrou ${ultimo.produto}` : 'Sem atividade recente');
  const atividadeAt =
    usuario.last_activity_at || usuario.lastActivityAt || usuario.last_login_at || usuario.lastLoginAt || ultimo?.updated_at || ultimo?.created_at || '';

  return {
    totalProdutos: itens.length,
    ultimoProduto: ultimo?.produto || '',
    ultimoPlu: ultimo?.plu || '',
    ultimaValidade: ultimo?.validade || '',
    ultimaMovimentacaoAt: ultimo?.updated_at || ultimo?.created_at || '',
    label: atividadeLabel,
    at: atividadeAt,
    rota: usuario.last_route || usuario.lastRoute || '',
  };
}

async function carregarUsuariosRemotosAdmin() {
  const selectCompleto =
    'id, matricula, telefone, admin, aprovado, created_at, last_login_at, last_activity_label, last_activity_at, last_route';
  const selectBasico = 'id, matricula, telefone, admin, aprovado, created_at, last_login_at';

  let consulta = await supabase.from('usuarios').select(selectCompleto).order('created_at', { ascending: false });

  if (consulta.error && /last_activity_|last_route/i.test(consulta.error.message)) {
    consulta = await supabase.from('usuarios').select(selectBasico).order('created_at', { ascending: false });
  }

  if (consulta.error) throw new Error(consulta.error.message);

  return consulta.data || [];
}

export async function carregarUsuariosAdmin() {
  exigirSupabase();

  const usuarios = await carregarUsuariosRemotosAdmin();
  const ids = usuarios.map((usuario) => usuario.id).filter(Boolean);
  let validades = [];

  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('validades')
      .select('usuario_id, produto, plu, validade, created_at, updated_at')
      .in('usuario_id', ids);

    if (error) throw new Error(error.message);
    validades = data || [];
  }

  return usuarios.map((usuario) => {
    const normalizado = normalizarUsuario(usuario);
    return {
      ...normalizado,
      atividade: resumoAtividadeUsuario(usuario, validades),
    };
  });
}

export async function carregarPreferenciasUsuario(usuario, fallback = {}) {
  const preferenciasFallback = normalizarPreferencias(fallback);

  exigirSupabase();
  if (!usuario) return preferenciasFallback;

  const usuarioBanco = await garantirUsuarioRemoto(usuario);
  const { data, error } = await supabase
    .from('preferencias_usuario')
    .select('secoes_selecionadas, secoes_configuradas, tema')
    .eq('usuario_id', usuarioBanco.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Nao foi possivel carregar preferencias no Supabase: ${error.message}`);
  }

  if (!data) {
    await salvarPreferenciasUsuario(usuarioBanco, preferenciasFallback);
    return preferenciasFallback;
  }

  return normalizarPreferencias(data);
}

export async function salvarPreferenciasUsuario(usuario, preferencias) {
  exigirSupabase();
  if (!usuario) return;

  const usuarioBanco = await garantirUsuarioRemoto(usuario);
  const preferenciasNormalizadas = normalizarPreferencias(preferencias);
  const payload = {
    usuario_id: usuarioBanco.id,
    matricula: usuarioBanco.matricula,
    secoes_selecionadas: preferenciasNormalizadas.secoesSelecionadas,
    secoes_configuradas: preferenciasNormalizadas.secoesConfiguradas,
    tema: preferenciasNormalizadas.tema,
  };

  const { error } = await supabase.from('preferencias_usuario').upsert(payload, { onConflict: 'usuario_id' });

  if (error) {
    throw new Error(`Nao foi possivel salvar preferencias no Supabase: ${error.message}`);
  }
}

export async function registrarAtividadeUsuario(usuario, atividade, rota = '') {
  if (!usuario || !atividade) return;
  exigirSupabase();

  const agora = new Date().toISOString();
  const dadosAtividade = {
    lastActivityLabel: atividade,
    lastActivityAt: agora,
    lastRoute: rota,
  };

  const payload = {
    last_activity_label: atividade,
    last_activity_at: agora,
    last_route: rota,
  };

  const filtro = usuario.id && !String(usuario.id).startsWith('local-') ? { coluna: 'id', valor: usuario.id } : { coluna: 'matricula', valor: somenteDigitos(usuario.matricula) };
  const { error } = await supabase.from('usuarios').update(payload).eq(filtro.coluna, filtro.valor);

  if (error && !/last_activity_|last_route/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function aprovarUsuario(matricula) {
  const matriculaLimpa = somenteDigitos(matricula);

  if (!matriculaLimpa) {
    throw new Error('Matricula invalida.');
  }

  exigirSupabase();

  const { data, error } = await supabase
    .from('usuarios')
    .update({ aprovado: true, admin: false })
    .eq('matricula', matriculaLimpa)
    .select('id, matricula, telefone, admin, aprovado')
    .single();

  if (error) throw new Error(error.message);
  return normalizarUsuario(data);
}

export async function carregarDadosRemotos(usuario) {
  exigirSupabase();
  if (!usuario) {
    throw new Error('Sessao invalida.');
  }

  const usuarioBanco = await garantirUsuarioRemoto(usuario);
  const { data: validades, error: validadesError } = await supabase
    .from('validades')
    .select('*')
    .eq('usuario_id', usuarioBanco.id)
    .order('created_at', { ascending: false });

  if (validadesError) throw new Error(validadesError.message);

  return {
    usuario: usuarioBanco,
    validades: (validades || []).map(fromDbValidade),
  };
}

export async function carregarValidadesRemotas(usuario) {
  exigirSupabase();
  if (!usuario) return [];

  const usuarioBanco = await garantirUsuarioRemoto(usuario);
  const { data, error } = await supabase
    .from('validades')
    .select('*')
    .eq('usuario_id', usuarioBanco.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(fromDbValidade);
}

export function assinarValidadesRemotas(usuario, onChange, onError) {
  if (!supabaseConfigurado || !supabase || !usuario?.id || String(usuario.id).startsWith('local-')) {
    return () => {};
  }

  const canal = supabase
    .channel(`validades:${usuario.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'validades',
        filter: `usuario_id=eq.${usuario.id}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe((status, error) => {
      if (error) {
        onError(error);
      }
    });

  return () => {
    supabase.removeChannel(canal);
  };
}

export async function salvarValidadesRemotas(validades, usuario) {
  exigirSupabase();
  if (!usuario || validades.length === 0) return;

  const payload = validades.map((item) => toDbValidade(item, usuario));
  const { error } = await supabase.from('validades').upsert(payload, { onConflict: 'id' });

  if (error) throw new Error(error.message);
}

export async function removerValidadeRemota(id) {
  exigirSupabase();
  if (!id) return;

  const { error } = await supabase.from('validades').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
