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
	ispbPorCodigoBanco
};
