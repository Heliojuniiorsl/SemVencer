import { supabase, supabaseConfigurado } from './supabaseClient';

export const ADMIN_MATRICULA = '000000';
export const CONTATO_LIBERACAO = '61998427629';

const localUsersKey = 'semVencer.usuarios.local.v1';
const localMigrationPrefix = 'semVencer.migracao.supabase.v1';

function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
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

function lerLocal(chave, fallback) {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : fallback;
  } catch {
    return fallback;
  }
}

function salvarLocal(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Local fallback best-effort.
  }
}

function localTemChave(chave) {
  try {
    return window.localStorage.getItem(chave) !== null;
  } catch {
    return false;
  }
}

function chaveMigracaoUsuario(usuario) {
  const matricula = somenteDigitos(usuario?.matricula);
  return matricula ? `${localMigrationPrefix}.${matricula}` : '';
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
  if (!supabaseConfigurado || !usuario) return usuario;

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

export async function carregarProdutosBaseRemotos(fallback = []) {
  if (!supabaseConfigurado) {
    return fallback;
  }

  const { data, error } = await supabase
    .from('produtos_base')
    .select('plu, descricao, categoria, tipo, tipo_plu, secao, embalagem_multiplo')
    .order('categoria', { ascending: true })
    .order('descricao', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data && data.length > 0 ? data.map(fromDbProduto) : fallback;
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

  if (!supabaseConfigurado) {
    const usuarios = lerLocal(localUsersKey, []);
    const existente = usuarios.find((item) => item.matricula === matriculaLimpa);
    const usuario = normalizarUsuario({
      ...existente,
      ...usuarioPayload,
      aprovado: matriculaLimpa === ADMIN_MATRICULA || Boolean(existente?.aprovado),
    });
    const atualizados = existente
      ? usuarios.map((item) => (item.matricula === matriculaLimpa ? usuario : item))
      : [...usuarios, usuario];
    salvarLocal(localUsersKey, atualizados);
    return usuario;
  }

  const { data: existente, error: consultaError } = await supabase
    .from('usuarios')
    .select('id, matricula, telefone, admin, aprovado')
    .eq('matricula', matriculaLimpa)
    .maybeSingle();

  if (consultaError) throw new Error(consultaError.message);

  if (existente) {
    const { data, error } = await supabase
      .from('usuarios')
      .update({
        telefone: telefoneLimpo,
        admin: matriculaLimpa === ADMIN_MATRICULA,
        aprovado: matriculaLimpa === ADMIN_MATRICULA || Boolean(existente.aprovado),
      })
      .eq('id', existente.id)
      .select('id, matricula, telefone, admin, aprovado')
      .single();

    if (error) throw new Error(error.message);
    return normalizarUsuario(data);
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

  if (!supabaseConfigurado) {
    const usuarios = lerLocal(localUsersKey, []);
    const usuario = usuarios.find((item) => item.matricula === matriculaLimpa);
    if (!usuario && matriculaLimpa === ADMIN_MATRICULA) {
      const adminLocal = normalizarUsuario({ matricula: ADMIN_MATRICULA, telefone: '', admin: true, aprovado: true });
      salvarLocal(localUsersKey, [...usuarios, adminLocal]);
      return adminLocal;
    }
    if (!usuario) throw new Error('Matricula nao cadastrada.');
    const usuarioNormalizado = normalizarUsuario(usuario);
    if (!usuarioNormalizado.admin && !usuarioNormalizado.aprovado) {
      throw new Error(`Cadastro pendente. Entre em contato com ${CONTATO_LIBERACAO} para liberar o acesso.`);
    }
    return usuarioNormalizado;
  }

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
  if (!supabaseConfigurado) {
    return lerLocal(localUsersKey, [])
      .map(normalizarUsuario)
      .filter((usuario) => usuario && !usuario.admin && !usuario.aprovado);
  }

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
  if (!supabaseConfigurado) {
    const usuarios = lerLocal(localUsersKey, []).map(normalizarUsuario).filter(Boolean);

    return usuarios.map((usuario) => {
      const validades = lerLocal(`semVencer.validades.usuario.v1.${usuario.matricula}`, []);
      return {
        ...usuario,
        atividade: resumoAtividadeUsuario(usuario, validades.map((item) => ({ ...item, usuario_id: usuario.id }))),
      };
    });
  }

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

  if (!supabaseConfigurado || !usuario) {
    return preferenciasFallback;
  }

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
  if (!supabaseConfigurado || !usuario) return;

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

  const agora = new Date().toISOString();
  const dadosAtividade = {
    lastActivityLabel: atividade,
    lastActivityAt: agora,
    lastRoute: rota,
  };

  if (!supabaseConfigurado) {
    const matricula = somenteDigitos(usuario.matricula);
    const usuarios = lerLocal(localUsersKey, []);
    const atualizados = usuarios.map((item) =>
      somenteDigitos(item.matricula) === matricula
        ? {
            ...item,
            ...dadosAtividade,
          }
        : item,
    );

    salvarLocal(localUsersKey, atualizados);
    return;
  }

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

  if (!supabaseConfigurado) {
    const usuarios = lerLocal(localUsersKey, []);
    const atualizados = usuarios.map((usuario) =>
      usuario.matricula === matriculaLimpa ? { ...usuario, aprovado: true, admin: false } : usuario,
    );
    salvarLocal(localUsersKey, atualizados);
    return normalizarUsuario(atualizados.find((usuario) => usuario.matricula === matriculaLimpa));
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update({ aprovado: true, admin: false })
    .eq('matricula', matriculaLimpa)
    .select('id, matricula, telefone, admin, aprovado')
    .single();

  if (error) throw new Error(error.message);
  return normalizarUsuario(data);
}

export async function carregarDadosRemotos(usuario, validadesFallback) {
  if (!supabaseConfigurado || !usuario) {
    return {
      usuario,
      validades: validadesFallback,
    };
  }

  const usuarioBanco = await garantirUsuarioRemoto(usuario);
  let { data: validades, error: validadesError } = await supabase
    .from('validades')
    .select('*')
    .eq('usuario_id', usuarioBanco.id)
    .order('created_at', { ascending: false });

  if (validadesError) throw new Error(validadesError.message);

  const migrationKey = chaveMigracaoUsuario(usuarioBanco);
  const deveMigrarLocal = Array.isArray(validadesFallback) && validadesFallback.length > 0 && !localTemChave(migrationKey);

  if (deveMigrarLocal) {
    await salvarValidadesRemotas(validadesFallback, usuarioBanco);
    salvarLocal(migrationKey, {
      at: new Date().toISOString(),
      total: validadesFallback.length,
    });

    const consultaAtualizada = await supabase
      .from('validades')
      .select('*')
      .eq('usuario_id', usuarioBanco.id)
      .order('created_at', { ascending: false });

    if (consultaAtualizada.error) throw new Error(consultaAtualizada.error.message);
    validades = consultaAtualizada.data || [];
  }

  return {
    usuario: usuarioBanco,
    validades: (validades || []).map(fromDbValidade),
  };
}

export async function carregarValidadesRemotas(usuario) {
  if (!supabaseConfigurado || !usuario) return [];

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
  if (!supabaseConfigurado || !usuario?.id || String(usuario.id).startsWith('local-')) {
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
  if (!supabaseConfigurado || !usuario || validades.length === 0) return;

  const payload = validades.map((item) => toDbValidade(item, usuario));
  const { error } = await supabase.from('validades').upsert(payload, { onConflict: 'id' });

  if (error) throw new Error(error.message);
}

export async function removerValidadeRemota(id) {
  if (!supabaseConfigurado || !id) return;

  const { error } = await supabase.from('validades').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
