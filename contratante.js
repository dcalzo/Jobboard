const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var contratante = new Schema({
    nome: String,
    endereco: String,
    cidade: String,
    estado: String,
    cep: Number,
    pais: String,
    cpf_cnpj: String,
    email: String,
    senha: String,
    tipoPagamento: String,
    produto: String
},{collection:"contratante"})

var contratante = mongoose.model("Contratante",contratante);

module.exports = contratante;