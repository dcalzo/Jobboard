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

function criarImagemQrDemonstracao(semente) {
	const tamanho = 29;
	const modulo = 8;
	const margem = 4;
	const fonteSemente = String(semente || "PIX").split("").reduce((total, caractere) => total + caractere.charCodeAt(0), 0);
	const modulos = [];
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(tamanho + margem * 2) * modulo} ${(tamanho + margem * 2) * modulo}"><rect width="100%" height="100%" fill="white"/>`;

	for (let y = 0; y < tamanho; y++) {
		for (let x = 0; x < tamanho; x++) {
			const reservado = [[0, 0], [tamanho - 7, 0], [0, tamanho - 7]]
				.some(([origemX, origemY]) => x >= origemX - 1 && x <= origemX + 7 && y >= origemY - 1 && y <= origemY + 7);
			if (!reservado && (x * 17 + y * 31 + fonteSemente + x * y) % 7 < 3) {
				modulos.push(`<rect x="${(x + margem) * modulo}" y="${(y + margem) * modulo}" width="${modulo}" height="${modulo}" fill="black"/>`);
			}
		}
	}

	for (const [x, y] of [[0, 0], [tamanho - 7, 0], [0, tamanho - 7]]) {
		const posicaoX = (x + margem) * modulo;
		const posicaoY = (y + margem) * modulo;
		modulos.push(`<rect x="${posicaoX}" y="${posicaoY}" width="${7 * modulo}" height="${7 * modulo}" fill="black"/>`);
		modulos.push(`<rect x="${posicaoX + modulo}" y="${posicaoY + modulo}" width="${5 * modulo}" height="${5 * modulo}" fill="white"/>`);
		modulos.push(`<rect x="${posicaoX + 2 * modulo}" y="${posicaoY + 2 * modulo}" width="${3 * modulo}" height="${3 * modulo}" fill="black"/>`);
	}

	svg += `${modulos.join("")}</svg>`;
	return Buffer.from(svg).toString("base64");
}

function criarPreviaPagamentoPix(taskPagamento) {
	const valorTexto = String(taskPagamento.valor).trim();
	const valor = Number(valorTexto.includes(",")
		? valorTexto.replace(/\./g, "").replace(",", ".")
		: valorTexto);
	if (!Number.isFinite(valor) || valor <= 0) {
		throw new Error("O valor do serviço é inválido para pré-visualização do PIX.");
	}

	const valorTaxaPlataforma = Math.round(valor * 0.15 * 100) / 100;
	if (valorTaxaPlataforma <= 0) {
		throw new Error("O valor da taxa da plataforma deve ser maior que zero.");
	}

	const semente = taskPagamento.titleService || taskPagamento.idtask || "PIX";
	const qrCodeBase64 = criarImagemQrDemonstracao(semente);
	return {
		preview: true,
		qrCodeMimeType: "image/svg+xml",
		id: "PRÉVIA",
		idTaxaPlataforma: "PRÉVIA",
		valorServico: valor.toFixed(2),
		taxaPlataforma: valorTaxaPlataforma.toFixed(2),
		valorTotal: (valor + valorTaxaPlataforma).toFixed(2),
		qrCode: "PREVIA-PIX-NAO-PAGAVEL-SERVICO",
		qrCodeBase64,
		qrCodeTaxaPlataforma: "PREVIA-PIX-NAO-PAGAVEL-TAXA",
		qrCodeTaxaPlataformaBase64: qrCodeBase64
	};
}

async function criarPagamentoPix(taskPagamento, emailPagador) {
	if (typeof emailPagador !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPagador)) {
		const error = new Error("Informe um e-mail válido para o pagador do PIX.");
		error.code = "INVALID_PAYER_EMAIL";
		throw error;
	}

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
		qrCodeMimeType: "image/png",
		qrCodeTaxaPlataforma: transacaoTaxa.qr_code,
		qrCodeTaxaPlataformaBase64: transacaoTaxa.qr_code_base64
	};
}

module.exports = {
	criarPagamentoPix,
	criarPreviaPagamentoPix
};
