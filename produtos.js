const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var produtos = new Schema({
    idtask: Number,
    email: String,
    nome: String,
    url: String,
    descricao: String,
    valor: String,
    dataCriacao: { type: Date, default: Date.now },
},{collection:"task"})

var produtos = mongoose.model("Produtos",produtos);

module.exports = produtos;