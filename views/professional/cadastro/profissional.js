const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var profissional = new Schema({
    nome: String,
    endereco: String,
    cidade: String,
    estado: String,
    cep: Number,
    pais: String,
    rg: String,
    cpf_cnpj: String,
    email: String,
    telefone: String,
    senha: String,
    sexo: String,
    profissao: String,
    historico: String,
    conhecimento: String,
    tipoPagamento: String,
    chavePixSel: String,
    bancopix: String,
    chavepix: String,
    carteiraBitcoin: String,
    conta: String,
    agencia: String,
    banco: String,
    tipoconta: String,
    produto: String
},{collection:"profissional"})

var profissional = mongoose.model("Profissional",profissional);

module.exports = profissional;