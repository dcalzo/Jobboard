const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var avaliar = new Schema({
    idtask: Number,
    contato: String,
    comentario: String,
    nota: String
},{collection:"avaliar"})

var avaliar = mongoose.model("Avaliar",avaliar);

module.exports = avaliar;