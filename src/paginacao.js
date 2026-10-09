const PAGINACAO = { paginaPadrao: 1, limitePadrao: 20, limiteMaximo: 100 };

function lerPaginacao({ pagina, limite }) {
  return {
    pagina: pagina === undefined ? PAGINACAO.paginaPadrao : Number(pagina),
    limite: limite === undefined ? PAGINACAO.limitePadrao : Number(limite),
  };
}

function resumirPaginacao({ pagina, limite }, total) {
  return { pagina, limite, total, totalPaginas: Math.ceil(total / limite) };
}

module.exports = { PAGINACAO, lerPaginacao, resumirPaginacao };
