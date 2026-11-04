const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var bug = new Schema({
    idtask: Number,
    email: String,
    titleService: String,
    dataCriacao: { type: Date, default: Date.now },
    description: String
},{collection:"bug"})

var bug = mongoose.model("Bug",bug);

module.exports = bug;
