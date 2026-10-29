const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var contabilidade = new Schema({
    idtask: Number,
    taskId: String,
    contato: String,
    company:String,
    tipo: String,
    ano: String,
    mes: String,
    dia: String,
    valor: String
},{collection:"contabilidade"})

contabilidade.index(
    { contato: 1, tipo: 1, taskId: 1 },
    { unique: true, partialFilterExpression: { taskId: { $type: "string" } } }
);

var contabilidade = mongoose.model("Contabilidade",contabilidade);

module.exports = contabilidade;