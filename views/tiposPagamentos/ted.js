const { Client } = require('pg');

async function realizarTransacao() {
    const client = new Client({
        user: 'seu_usuario',
        host: 'localhost',
        database: 'seu_banco_de_dados',
        password: 'sua_senha',
        port: 5432,
    });

    await client.connect();

    try {
        await client.query('BEGIN');

        // Exemplo de operações dentro da transação
        await client.query('INSERT INTO conta (nome, saldo) VALUES ($1, $2)', ['Ted', 1000]);
        await client.query('UPDATE conta SET saldo = saldo - 100 WHERE nome = $1', ['Ted']);

        // Se tudo correr bem, commitamos a transação
        await client.query('COMMIT');
        console.log('Transação realizada com sucesso!');
    } catch (e) {
        // Se algo der errado, fazemos rollback da transação
        await client.query('ROLLBACK');
        console.error('Transação falhou', e);
    } finally {
        await client.end();
    }
}

realizarTransacao();