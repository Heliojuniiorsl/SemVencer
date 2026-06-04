import { supabase, supabaseConfigurado } from './supabaseClient';

export const ADMIN_MATRICULA = '000000';
export const CONTATO_LIBERACAO = '61998427629';

const localUsersKey = 'semVencer.usuarios.local.v1';

function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
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

function normalizarUsuario(usuario) {
  if (!usuario) return null;
  const matricula = somenteDigitos(usuario.matricula);
  const admin = matricula === ADMIN_MATRICULA;

  return {
    id: usuario.id || `local-${matricula}`,
    matricula,
    telefone: usuario.telefone || '',
    admin,
    aprovado: admin || Boolean(usuario.aprovado),
  };
}

async function garantirUsuarioRemoto(usuario) {
  if (!supabaseConfigurado || !usuario) return usuario;

  if (usuario.id && !String(usuario.id).startsWith('local-')) {
    return usuario;
  }

  const payload = {
    matricula: somenteDigitos(usuario.matricula),
    telefone: somenteDigitos(usuario.telefone) || '00000000000',
    admin: somenteDigitos(usuario.matricula) === ADMIN_MATRICULA,
    aprovado: somenteDigitos(usuario.matricula) === ADMIN_MATRICULA || Boolean(usuario.aprovado),
  };

  const { data, error } = await supabase
    .from('usuarios')
    .upsert(payload, { onConflict: 'matricula' })
    .select('id, matricula, telefone, admin, aprovado')
    .single();

  if (error) throw new Error(error.message);
  return normalizarUsuario(data);
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
    imagem: item.imagem || '',
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
    imagem: item.imagem || '',
    responsavel: item.responsavel || '',
    revisado: Boolean(item.revisado),
  };
}

function fotosArrayParaMapa(fotos) {
  return fotos.reduce((resultado, item) => {
    if (!item.plu || !item.imagem) return resultado;
    return {
      ...resultado,
      [item.plu]: item.imagem,
    };
  }, {});
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

export async function carregarDadosRemotos(usuario, validadesFallback, fotosFallback) {
  if (!supabaseConfigurado || !usuario) {
    return {
      usuario,
      validades: validadesFallback,
      fotosPorPlu: fotosFallback,
    };
  }

  const usuarioBanco = await garantirUsuarioRemoto(usuario);
  const [{ data: validades, error: validadesError }, { data: fotos, error: fotosError }] = await Promise.all([
    supabase.from('validades').select('*').eq('usuario_id', usuarioBanco.id).order('created_at', { ascending: false }),
    supabase.from('fotos_produtos').select('*'),
  ]);

  if (validadesError) throw new Error(validadesError.message);
  if (fotosError) throw new Error(fotosError.message);

  if (!validades || validades.length === 0) {
    await salvarValidadesRemotas(validadesFallback, usuarioBanco);
    await salvarFotosRemotas(fotosFallback);
    return {
      usuario: usuarioBanco,
      validades: validadesFallback,
      fotosPorPlu: fotosFallback,
    };
  }

  return {
    usuario: usuarioBanco,
    validades: validades.map(fromDbValidade),
    fotosPorPlu: fotosArrayParaMapa(fotos || []),
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

export async function salvarFotosRemotas(fotosPorPlu) {
  if (!supabaseConfigurado) return;

  const payload = Object.entries(fotosPorPlu)
    .filter(([plu, imagem]) => plu && imagem)
    .map(([plu, imagem]) => ({
      plu,
      imagem,
    }));

  if (payload.length === 0) return;

  const { error } = await supabase.from('fotos_produtos').upsert(payload, { onConflict: 'plu' });
  if (error) throw new Error(error.message);
}
