const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var contabilidade = new Schema({
    idtask: Number,
    contato: String,
    ano: String,
    mes: String,
    dia: String,
    valor: String
},{collection:"contabilidade"})

var contabilidade = mongoose.model("Contabilidade",contabilidade);

module.exports = contabilidade;