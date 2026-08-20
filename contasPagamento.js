const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var contasPagamento = new Schema({
    nome: String,
    email: String,
    tipo: String,
    documento: String,
    redeBTC: String,
    enderecoBTC: String,
    banco: String,
    agencia: Number,
    numeroConta: String,
    tipoConta: String,
    tipochave: String,
    chave: String,
    senha: String,
    valor: Number,
    observacao: String,
    produto: String
},{collection:"contasPagamento"})

var contasPagamento = mongoose.model("ContasPagamento",contasPagamento);

module.exports = contasPagamento;