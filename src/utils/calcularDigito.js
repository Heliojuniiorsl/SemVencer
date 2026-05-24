export function somenteNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function calcularUltimoDigito(pluBase) {
  const numeros = somenteNumeros(pluBase).split('').map(Number);

  if (numeros.length < 2) {
    return null;
  }

  let soma = 0;
  let peso = 3;

  for (let indice = numeros.length - 1; indice >= 0; indice -= 1) {
    soma += numeros[indice] * peso;
    peso = peso === 3 ? 1 : 3;
  }

  return (10 - (soma % 10)) % 10;
}

export function montarPluCompleto(pluBase) {
  const base = somenteNumeros(pluBase);
  const digito = calcularUltimoDigito(base);

  if (digito === null) {
    return '';
  }

  return `${base}${digito}`;
}
