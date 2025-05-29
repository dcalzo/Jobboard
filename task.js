const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var task = new Schema({
    idtask: Number,
    email: String,
    company: String,
    developer: String,
    titleService: String,
    description: String,
    tipoPagamento: String,
    valor: String,
    gitLocal: String,
    urlDoc: String,
    column: String
},{collection:"task"})

var task = mongoose.model("Task",task);

module.exports = task;