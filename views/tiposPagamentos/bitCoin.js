const BitPay = require("bitpay-sdk");
const env = require("../../dev.env.js");

function criarPreviaPagamentoBitcoin(taskPagamento) {
	const valorTexto = String(taskPagamento.valor).trim();
	const valor = Number(valorTexto.includes(",")
		? valorTexto.replace(/\./g, "").replace(",", ".")
		: valorTexto);
	if (!Number.isFinite(valor) || valor <= 0) {
		throw new Error("O valor do serviço é inválido para pré-visualização do Bitcoin.");
	}

	const valorTaxaPlataforma = Math.round(valor * 0.15 * 100) / 100;
	if (valorTaxaPlataforma <= 0) {
		throw new Error("O valor da taxa da plataforma deve ser maior que zero.");
	}

	return {
		preview: true,
		invoiceId: "PRÉVIA",
		valorServico: valor.toFixed(2),
		taxaPlataforma: valorTaxaPlataforma.toFixed(2),
		valorTotal: (valor + valorTaxaPlataforma).toFixed(2),
		paymentUrl: "#",
		lightningInvoice: "PREVIA-LIGHTNING-NAO-PAGAVEL"
	};
}

async function criarPagamentoBitcoinLightning(taskPagamento) {
	const valorTexto = String(taskPagamento.valor).trim();
	const valor = Number(valorTexto.includes(",")
		? valorTexto.replace(/\./g, "").replace(",", ".")
		: valorTexto);
	if (!Number.isFinite(valor) || valor <= 0) {
		throw new Error("O valor do serviço é inválido para pagamento Bitcoin.");
	}

	const privateKey = env.BITPAY_PRIVATE_KEY || process.env.BITPAY_PRIVATE_KEY;
	const merchantToken = env.BITPAY_MERCHANT_TOKEN || process.env.BITPAY_MERCHANT_TOKEN;
	if (!privateKey || !merchantToken) {
		throw new Error("Configure BITPAY_PRIVATE_KEY e BITPAY_MERCHANT_TOKEN para habilitar o Lightning.");
	}

	const ambiente = (env.BITPAY_ENVIRONMENT || process.env.BITPAY_ENVIRONMENT || "Prod").toLowerCase();
	const environment = ambiente === "test" ? BitPay.Environment.Test : BitPay.Environment.Prod;
	const tokenContainer = new BitPay.TokenContainer({
		[BitPay.Facade.Merchant]: merchantToken
	});
	const clienteBitPay = BitPay.Client.createClientByPrivateKey(
		privateKey,
		tokenContainer,
		environment,
		"Jobboard"
	);
	const invoice = new BitPay.Invoice.Invoice(Math.round(valor * 1.15 * 100) / 100, "BRL");
	invoice.itemDesc = `Pagamento pelo serviço ${taskPagamento.titleService}`;
	invoice.orderId = String(taskPagamento.idtask);
	invoice.forcedBuyerSelectedWallet = "lightning";
	invoice.forcedBuyerSelectedTransactionCurrency = "BTC";
	invoice.paymentCurrencies = ["BTC"];

	const resposta = await clienteBitPay.createInvoice(invoice, BitPay.Facade.Merchant, true);
	if (!resposta || !resposta.url) {
		throw new Error("O BitPay não retornou uma URL de pagamento Lightning.");
	}

	return {
		id: resposta.id,
		invoiceId: resposta.id,
		valorServico: valor.toFixed(2),
		taxaPlataforma: (valor * 0.15).toFixed(2),
		valorTotal: (valor * 1.15).toFixed(2),
		paymentUrl: resposta.url,
		lightningInvoice: resposta.paymentCodes?.BTC?.lightning || resposta.paymentCodes?.BTC?.ln || null
	};
}

module.exports = {
	criarPagamentoBitcoinLightning,
	criarPreviaPagamentoBitcoin
};
