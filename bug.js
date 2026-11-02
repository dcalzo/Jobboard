const mongoose = require("mongoose");
var Schema = mongoose.Schema;

var bug = new Schema({
    idtask: Number,
    email: String,
    titleService: String,
    description: String
},{collection:"bug"})

var bug = mongoose.model("Bug",bug);

module.exports = bug;
