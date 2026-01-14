// --- CONFIGURAÇÃO GLOBAL CODIGO UTILIZADO NO GOOGLE SCRIPT PRA CONECTAR O SHEETS AO FRONTEND---
const NOME_ABA_SOLICITACOES = "Solicitações";
const NOME_ABA_ESTOQUE = "Estoque";

const COLUNAS = {
  ID: 1, DATA: 2, EMAIL: 3, SOLICITANTE: 4, SAP: 5, DESCRICAO: 6, QUANTIDADE: 7, STATUS: 8, RETIRANTE: 9, PROCESSO: 10
};
// --- FIM DA CONFIGURAÇÃO ---

function doGet(e) {
  if (e.parameter.page === 'print' && e.parameter.id) {
    const template = HtmlService.createTemplateFromFile('printView');
    template.id = e.parameter.id;
    return template.evaluate().setTitle('Comprovante de Solicitação - ID ' + e.parameter.id);
  } else {
    const userEmail = Session.getActiveUser().getEmail();
    const template = HtmlService.createTemplateFromFile('index');
    template.userEmail = userEmail;
    return template.evaluate().setTitle('Sistema de Controle de Estoque');
  }
}

function registrarSolicitacao(dados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const solicitacoesSheet = ss.getSheetByName(NOME_ABA_SOLICITACOES);
    const idColumnRange = solicitacoesSheet.getRange(2, COLUNAS.ID, solicitacoesSheet.getLastRow(), 1);
    const idValues = idColumnRange.getValues().flat().filter(id => typeof id === 'number');
    const ultimoId = idValues.length > 0 ? Math.max(...idValues) : 0;
    const idDoGrupo = ultimoId + 1;
    const timestamp = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    const nomeSolicitante = dados.solicitante;
    dados.items.slice().reverse().forEach(item => {
      let sapParaSalvar = (item.isFromStock) ? item.codigo : "";
      let descricaoParaSalvar = (item.isFromStock) ? item.nome : item.codigo;
      solicitacoesSheet.insertRowAfter(1);
      solicitacoesSheet.getRange(2, 1, 1, 10).setValues([[
        idDoGrupo, timestamp, userEmail, nomeSolicitante, sapParaSalvar, 
        descricaoParaSalvar, item.quantidade, "Pendente", "", ""
      ]]);
    });
    return "Solicitação enviada com sucesso!";
  } catch (e) {
    Logger.log(e);
    return "Erro ao registrar a solicitação: " + e.message;
  }
}

// histórico na página apareça na ordem correta.
function getMinhasSolicitacoes(cacheBuster) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA_SOLICITACOES);
    const userEmail = Session.getActiveUser().getEmail();
    const data = sheet.getDataRange().getValues();
    const solicitacoesAgrupadas = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const emailDaLinha = row[COLUNAS.EMAIL - 1];
      if (emailDaLinha === userEmail) {
        const id = row[COLUNAS.ID - 1];
        if (!solicitacoesAgrupadas[id]) {
          solicitacoesAgrupadas[id] = {
            id: id,
            timestamp: new Date(row[COLUNAS.DATA - 1]).toLocaleDateString('pt-BR'),
            solicitante: row[COLUNAS.SOLICITANTE - 1],
            status: row[COLUNAS.STATUS - 1],
            items: []
          };
        }
        solicitacoesAgrupadas[id].items.push({
          descricao: row[COLUNAS.DESCRICAO - 1],
          quantidade: row[COLUNAS.QUANTIDADE - 1]
        });
      }
    }
    // 
    return Object.values(solicitacoesAgrupadas);
  } catch (e) {
    Logger.log("Erro em getMinhasSolicitacoes: " + e.message);
    return [];
  }
}

// ---  ---

function getScriptUrl() { return ScriptApp.getService().getUrl(); }

function getSolicitacaoPorId(id) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA_SOLICITACOES);
    const data = sheet.getDataRange().getValues();
    const solicitacao = { items: [] };
    let encontrou = false;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COLUNAS.ID - 1].toString() === id.toString()) {
        if (!encontrou) {
          solicitacao.id = row[COLUNAS.ID - 1];
          solicitacao.data = new Date(row[COLUNAS.DATA - 1]).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
          solicitacao.solicitante = row[COLUNAS.SOLICITANTE - 1];
          solicitacao.status = row[COLUNAS.STATUS - 1];
          encontrou = true;
        }
        solicitacao.items.push({
          descricao: row[COLUNAS.DESCRICAO - 1],
          quantidade: row[COLUNAS.QUANTIDADE - 1]
        });
      }
    }
    return encontrou ? solicitacao : null;
  } catch(e) { Logger.log(e); return null; }
}

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== NOME_ABA_SOLICITACOES || range.getColumn() !== COLUNAS.STATUS || range.getRow() <= 1) return;
  const editedRow = range.getRow();
  const novoStatus = e.value;
  const travaProcesso = sheet.getRange(editedRow, COLUNAS.PROCESSO).getValue();
  if (novoStatus.toLowerCase() !== "aceito" || travaProcesso !== "") return;
  const itemCodigo = sheet.getRange(editedRow, COLUNAS.SAP).getValue();
  if (!itemCodigo) {
    sheet.getRange(editedRow, COLUNAS.PROCESSO).setValue("Item manual, sem baixa no estoque.");
    return;
  }
  const quantidadeSolicitada = sheet.getRange(editedRow, COLUNAS.QUANTIDADE).getValue();
  try {
    const estoqueSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA_ESTOQUE);
    const codigosEstoque = estoqueSheet.getRange("A2:A" + estoqueSheet.getLastRow()).getValues();
    let linhaDoItemNoEstoque = -1;
    for (let i = 0; i < codigosEstoque.length; i++) {
      if (codigosEstoque[i][0].toString().trim() == itemCodigo.toString().trim()) {
        linhaDoItemNoEstoque = i + 2;
        break;
      }
    }
    if (linhaDoItemNoEstoque !== -1) {
      const celulaQuantidadeEstoque = estoqueSheet.getRange(linhaDoItemNoEstoque, 3);
      const quantidadeAtual = celulaQuantidadeEstoque.getValue();
      celulaQuantidadeEstoque.setValue(quantidadeAtual - quantidadeSolicitada);
      sheet.getRange(editedRow, COLUNAS.PROCESSO).setValue("Processado em " + new Date().toLocaleString());
      SpreadsheetApp.flush();
    } else {
      sheet.getRange(editedRow, COLUNAS.PROCESSO).setValue("ERRO: Item não encontrado no estoque");
    }
  } catch (error) {
    sheet.getRange(editedRow, COLUNAS.PROCESSO).setValue("ERRO: " + error.message);
  }
}

function getItensDeEstoque() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA_ESTOQUE);
    const range = sheet.getRange("A2:B" + sheet.getLastRow());
    const values = range.getValues();
    return values.filter(row => row[0] !== "").map(row => ({ codigo: row[0], nome: row[1] }));
  } catch (e) { return []; }
}
