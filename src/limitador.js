const TENTATIVAS_PERMITIDAS = 5;
const JANELA_DE_BLOQUEIO_MS = 15 * 60 * 1000;

function criarLimitadorDeTentativas({ maximo = TENTATIVAS_PERMITIDAS, janelaMs = JANELA_DE_BLOQUEIO_MS } = {}) {
  const falhasPorChave = new Map();

  function falhasRecentes(chave) {
    const inicioDaJanela = Date.now() - janelaMs;
    const recentes = (falhasPorChave.get(chave) ?? []).filter((momento) => momento > inicioDaJanela);

    if (recentes.length) falhasPorChave.set(chave, recentes);
    else falhasPorChave.delete(chave);
    return recentes;
  }

  return {
    estaBloqueado: (chave) => falhasRecentes(chave).length >= maximo,

    segundosParaLiberar(chave) {
      const recentes = falhasRecentes(chave);
      const falhaQueLibera = recentes[recentes.length - maximo];
      return Math.max(1, Math.ceil((falhaQueLibera + janelaMs - Date.now()) / 1000));
    },

    registrarFalha(chave) {
      falhasPorChave.set(chave, [...falhasRecentes(chave), Date.now()]);
    },

    esquecer(chave) {
      falhasPorChave.delete(chave);
    },
  };
}

module.exports = { criarLimitadorDeTentativas };
