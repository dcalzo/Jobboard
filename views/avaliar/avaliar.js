const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var avaliar = new Schema({
    idtask: Number,
    contato: String,
    comentario: String,
    dataCriacao: { type: Date, default: Date.now },
    nota: String
},{collection:"avaliar"})

var avaliar = mongoose.model("Avaliar",avaliar);

module.exports = avaliar;