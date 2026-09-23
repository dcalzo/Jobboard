const mercadopago = require("mercadopago");
const env = require("../../dev.env.js");
const tokenMercadoPago = env.TOKEN_MERCADO_PAGO || process.env.TOKEN_MERCADO_PAGO;
const tokenMercadoPagoPlataforma = env.TOKEN_MERCADO_PAGO_PLATAFORMA || process.env.TOKEN_MERCADO_PAGO_PLATAFORMA;

const mercadoPagoClient = new mercadopago.MercadoPagoConfig({
	accessToken: tokenMercadoPago
});
const mercadoPagoPayment = new mercadopago.Payment(mercadoPagoClient);
const mercadoPagoPlataformaClient = new mercadopago.MercadoPagoConfig({
	accessToken: tokenMercadoPagoPlataforma
});
const mercadoPagoPlataformaPayment = new mercadopago.Payment(mercadoPagoPlataformaClient);

async function criarPagamentoPix(taskPagamento, emailPagador) {
	const valorTexto = String(taskPagamento.valor).trim();
	const valor = Number(valorTexto.includes(",")
		? valorTexto.replace(/\./g, "").replace(",", ".")
		: valorTexto);
	if (!Number.isFinite(valor) || valor <= 0) {
		throw new Error("O valor do serviço é inválido para pagamento PIX.");
	}
	if (!tokenMercadoPagoPlataforma) {
		throw new Error("Configure TOKEN_MERCADO_PAGO_PLATAFORMA para receber a taxa da plataforma.");
	}

	const valorTaxaPlataforma = Math.round(valor * 0.15 * 100) / 100;
	if (valorTaxaPlataforma <= 0) {
		throw new Error("O valor da taxa da plataforma deve ser maior que zero.");
	}
	const valorTotal = Math.round((valor + valorTaxaPlataforma) * 100) / 100;

	const respostaServico = await mercadoPagoPayment.create({
		body: {
			transaction_amount: valor,
			description: `Pagamento pelo serviço ${taskPagamento.titleService}`,
			payment_method_id: "pix",
			payer: { email: emailPagador }
		}
	});
	const respostaTaxa = await mercadoPagoPlataformaPayment.create({
		body: {
			transaction_amount: valorTaxaPlataforma,
			description: `Taxa da plataforma - ${taskPagamento.titleService}`,
			payment_method_id: "pix",
			payer: { email: emailPagador }
		}
	});
	const dadosServico = respostaServico.body || respostaServico;
	const dadosTaxa = respostaTaxa.body || respostaTaxa;
	const transacaoServico = dadosServico.point_of_interaction && dadosServico.point_of_interaction.transaction_data;
	const transacaoTaxa = dadosTaxa.point_of_interaction && dadosTaxa.point_of_interaction.transaction_data;

	if (!transacaoServico || !transacaoServico.qr_code || !transacaoTaxa || !transacaoTaxa.qr_code) {
		throw new Error("O Mercado Pago não retornou os dados do PIX.");
	}

	return {
		id: dadosServico.id,
		idTaxaPlataforma: dadosTaxa.id,
		valorServico: valor.toFixed(2),
		taxaPlataforma: valorTaxaPlataforma.toFixed(2),
		valorTotal: valorTotal.toFixed(2),
		qrCode: transacaoServico.qr_code,
		qrCodeBase64: transacaoServico.qr_code_base64,
		qrCodeTaxaPlataforma: transacaoTaxa.qr_code,
		qrCodeTaxaPlataformaBase64: transacaoTaxa.qr_code_base64
	};
}

module.exports = {
	criarPagamentoPix
};
