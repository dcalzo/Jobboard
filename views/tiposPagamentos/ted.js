const axios = require("axios");
const env = require("../../dev.env.js");

const ispbPorCodigoBanco = {
	"001": "00000000",
	"033": "90400888",
	"077": "00416968",
	"104": "00360305",
	"237": "60746948",
	"341": "60701190",
	"389": "17184037",
	"422": "58160789",
	"655": "61186680",
	"707": "62232889"
};

function lerDadosBancarios(codigo) {
	if (typeof codigo !== "string" || !codigo.trim()) {
		throw new Error("Os dados bancários do serviço não foram cadastrados.");
	}

	let dadosBancarios;
	try {
		dadosBancarios = JSON.parse(codigo);
	} catch (error) {
		const codigoLegado = codigo.match(/^\{Banco:'([\s\S]*)',agencia:'([\s\S]*)',conta:'([\s\S]*)',tipo:'([\s\S]*)'\}$/);
		if (!codigoLegado) {
			throw new Error("Os dados bancários do serviço não estão em um formato válido.");
		}
		dadosBancarios = {
			Banco: codigoLegado[1],
			agencia: codigoLegado[2],
			conta: codigoLegado[3],
			tipo: codigoLegado[4]
		};
	}

	if (!dadosBancarios || typeof dadosBancarios !== "object" || Array.isArray(dadosBancarios)) {
		throw new Error("Os dados bancários do serviço não estão em um formato válido.");
	}

	return {
		banco: String(dadosBancarios.Banco || dadosBancarios.banco || "").trim(),
		agencia: String(dadosBancarios.agencia || "").trim(),
		numeroConta: String(dadosBancarios.conta || dadosBancarios.numeroConta || "").trim(),
		tipoConta: String(dadosBancarios.tipo || dadosBancarios.tipoConta || "").trim()
	};
}

function criarPreviaTransferenciaPagBank(taskPagamento, contaPagamento = {}, erro = "") {
	const valorTexto = String(taskPagamento.valor).trim();
	const valor = Number(valorTexto.includes(",")
		? valorTexto.replace(/\./g, "").replace(",", ".")
		: valorTexto);
	if (!Number.isFinite(valor) || valor <= 0) {
		throw new Error("O valor do serviço é inválido para pré-visualização da transferência.");
	}

	const valorTaxaPlataforma = Math.round(valor * 0.15 * 100) / 100;
	if (valorTaxaPlataforma <= 0) {
		throw new Error("O valor da taxa da plataforma deve ser maior que zero.");
	}

	let dadosBancarios = {};
	try {
		dadosBancarios = lerDadosBancarios(taskPagamento.codigo);
	} catch (error) {
		dadosBancarios = {};
	}

	return {
		preview: true,
		id: "PRÉVIA",
		status: "SIMULAÇÃO - NÃO ENVIADA",
		tipo: "Prévia de transferência PagBank",
		valorServico: valor.toFixed(2),
		taxaPlataforma: valorTaxaPlataforma.toFixed(2),
		valorTotal: (valor + valorTaxaPlataforma).toFixed(2),
		banco: dadosBancarios.banco || "",
		agencia: dadosBancarios.agencia || "",
		conta: dadosBancarios.numeroConta || "",
		tipoConta: dadosBancarios.tipoConta || "",
		titular: contaPagamento.nome || "",
		erro: erro || "Transferência não enviada: pré-visualização de desenvolvimento."
	};
}

async function criarTransferenciaPagBank(taskPagamento, contaPagamento) {
	const valorTexto = String(taskPagamento.valor).trim();
	const valor = Number(valorTexto.includes(",")
		? valorTexto.replace(/\./g, "").replace(",", ".")
		: valorTexto);
	if (!Number.isFinite(valor) || valor <= 0) {
		throw new Error("O valor do serviço é inválido para transferência.");
	}

	const accessToken = env.PAGBANK_TRANSFER_ACCESS_TOKEN || process.env.PAGBANK_TRANSFER_ACCESS_TOKEN;
	const notificationUrl = env.PAGBANK_NOTIFICATION_URL || process.env.PAGBANK_NOTIFICATION_URL;
	if (!accessToken || !notificationUrl) {
		throw new Error("Configure PAGBANK_TRANSFER_ACCESS_TOKEN e PAGBANK_NOTIFICATION_URL.");
	}
	if (!contaPagamento) {
		throw new Error("Os dados bancários do profissional não foram cadastrados.");
	}

	const banco = String(contaPagamento.banco || "").padStart(3, "0");
	const documento = String(contaPagamento.documento || "").replace(/\D/g, "");
	const agencia = String(contaPagamento.agencia || "").replace(/\D/g, "");
	const numeroConta = String(contaPagamento.numeroConta || "").replace(/\D/g, "");
	const tipoConta = String(contaPagamento.tipoConta || "").toLowerCase() === "poupança" ? "PP" : "CC";
	const bankIspb = ispbPorCodigoBanco[banco] || String(contaPagamento.ispb || "").replace(/\D/g, "");

	if (!contaPagamento.nome || !["11", "14"].includes(String(documento.length)) ||
		!bankIspb || !agencia || !numeroConta) {
		throw new Error("Os dados bancários do profissional estão incompletos ou inválidos.");
	}

	const valorTotal = Math.round(valor * 1.15 * 100);
	const resposta = await axios.post(
		env.PAGBANK_TRANSFER_API_URL || process.env.PAGBANK_TRANSFER_API_URL || "https://secure.api.pagseguro.com/transfers",
		{
			amount: { value: valorTotal, currency: "BRL" },
			description: `Pagamento do serviço ${taskPagamento.titleService}`.slice(0, 72),
			reference_id: String(taskPagamento.idtask || taskPagamento._id),
			instrument: {
				type: "PIX",
				pix: {
					name: contaPagamento.nome,
					tax_id: documento,
					bank_ispb: bankIspb,
					bank_branch: agencia,
					account_number: numeroConta,
					account_type: tipoConta
				}
			},
			notification_urls: [notificationUrl]
		},
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"x-idempotency-key": `jobboard-${taskPagamento.idtask || taskPagamento._id}`
			}
		}
	);
	const dados = resposta.data;
	return {
		id: dados.id,
		status: dados.status,
		tipo: "Transferência PagBank para conta bancária",
		valorServico: valor.toFixed(2),
		taxaPlataforma: (valor * 0.15).toFixed(2),
		valorTotal: (valor * 1.15).toFixed(2),
		endToEndId: dados.enToEndId || null
	};
}

module.exports = {
	criarTransferenciaPagBank,
	criarPreviaTransferenciaPagBank,
	lerDadosBancarios,
	ispbPorCodigoBanco
};
