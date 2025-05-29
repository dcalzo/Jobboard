require('dotenv').config();
const fetch = require('node-fetch');

class BitcoinTransaction {
    constructor() {
        this.baseUrl = 'https://api.binance.com';
        this.apiKey = process.env.API_KEY;
        this.apiSecret = process.env.API_SECRET;
    }

    // Método para obter o preço atual do Bitcoin
    async getCurrentPrice() {
        try {
            const response = await fetch(`${this.baseUrl}/api/v3/ticker/price?symbol=BTCUSDT`);
            const data = await response.json();
            return parseFloat(data.price);
        } catch (error) {
            console.error('Error fetching current price:', error);
            return null;
        }
    }

    // Método para fazer uma compra de Bitcoin
    async buyBitcoin(amountInUSDT) {
        const price = await this.getCurrentPrice();
        if (!price) return "Failed to get current price.";

        const quantity = (amountInUSDT / price).toFixed(8); // Precisão para evitar erros de arredondamento

        const params = new URLSearchParams({
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'MARKET',
            quantity: quantity
        });

        try {
            const response = await fetch(`${this.baseUrl}/api/v3/order`, {
                method: 'POST',
                headers: {
                    'X-MBX-APIKEY': this.apiKey
                },
                body: params
            });
            const order = await response.json();
            return order;
        } catch (error) {
            console.error('Error executing buy order:', error);
            return null;
        }
    }

    // Método para fazer uma venda de Bitcoin
    async sellBitcoin(amountInBTC) {
        const params = new URLSearchParams({
            symbol: 'BTCUSDT',
            side: 'SELL',
            type: 'MARKET',
            quantity: amountInBTC
        });

        try {
            const response = await fetch(`${this.baseUrl}/api/v3/order`, {
                method: 'POST',
                headers: {
                    'X-MBX-APIKEY': this.apiKey
                },
                body: params
            });
            const order = await response.json();
            return order;
        } catch (error) {
            console.error('Error executing sell order:', error);
            return null;
        }
    }
}

// Exemplo de uso:
// (Nota: Este é apenas um exemplo e não deve ser executado sem revisão e segurança adequada)

// const transaction = new BitcoinTransaction();
// transaction.buyBitcoin(100).then(console.log); // Compra Bitcoin com 100 USDT
// transaction.sellBitcoin(0.001).then(console.log); // Vende 0.001 BTC