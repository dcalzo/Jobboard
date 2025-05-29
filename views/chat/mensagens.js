const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var chatmensagem = new Schema({
    remetente: String,
    destinatario: String,
    mensagem: String
},{collection:"chatmensagem"})

var chatmensagem = mongoose.model("Chatmensagem",chatmensagem);

module.exports = chatmensagem;