const path = require("path");
const livereload = require("livereload");

module.exports = function startLiveReload() {
    const server = livereload.createServer();

    server.watch([
        path.join(__dirname, "views"),
        path.join(__dirname, "public"),
        path.join(__dirname, "index.js"),
        path.join(__dirname, "task.js"),
        path.join(__dirname, "contratante.js"),
        path.join(__dirname, "contasPagamento.js"),
        path.join(__dirname, "pagamento.html")
    ]);

    return server;
};
