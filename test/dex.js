const { expectRevert } = require('@openzeppelin/test-helpers');
const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Dex = artifacts.require('Dex.sol');
const SIDE = {
    BUY: 0,
    SELL: 1
};

contract('Dex', (accounts) => {
    let dai, rep, zrx, bat, dex;
    const [trader1, trader2] = [accounts[1], accounts[2]];
    const [DAI, REP, ZRX, BAT] = ['DAI', 'BAT', 'REP', 'ZRX']
        .map(ticker => web3.utils.fromAscii(ticker));
    beforeEach(async() => {
        ([dai, rep, zrx, bat] = await Promise.all([
            Dai.new(),
            Rep.new(),
            Zrx.new(),
            Bat.new()
        ]));
        dex = await Dex.new();
        await Promise.all([
            dex.addToken(DAI, dai.address),
            dex.addToken(REP, rep.address),
            dex.addToken(ZRX, zrx.address),
            dex.addToken(BAT, bat.address)
        ]);
        const amount = web3.utils.toWei('1000');
        const seedTokenBalance = async(token, trader) => {
            await token.faucet(trader, amount);
            await token.approve(dex.address, amount, {from: trader}); 
        };
        await Promise.all(
            [dai, rep, zrx, bat].map(
                token => seedTokenBalance(token, trader1)
            )
        );
        await Promise.all(
            [dai, rep, zrx, bat].map(
                token => seedTokenBalance(token, trader2)
            )
        );
    });
    it('Should deposit tokens', async() => {
        const amount = web3.utils.toWei('100');
        await dex.deposit(amount, DAI, {from: trader1});
        const balance = await dex.traderBalances(trader1, DAI);
        assert(balance.toString() === amount);
    });
    it('Should not deposit tokens if token does not exist on DEX', async() => {
        const amount = web3.utils.toWei('100');
        await expectRevert(
            dex.deposit(
                amount, 
                web3.utils.fromAscii('token-not-approved-on-dex'), 
                {from: trader1}
            ),
            'This token does not exist!'
        );
    });
    it('Should withdraw tokens', async() => {
        const amount = web3.utils.toWei('100');
        await dex.deposit(amount, DAI, {from: trader1});
        await dex.withdraw(amount, DAI, {from: trader1});
        const [balanceDex, balanceDai] = await Promise.all([
            dex.traderBalances(trader1, DAI),
            dai.balanceOf(trader1)
        ]);
        assert(balanceDex.isZero());
        assert(balanceDai.toString() === web3.utils.toWei('1000'));
    });
    it('Should not withdraw tokens if token does not exist on DEX', async() => {
        const amount = web3.utils.toWei('100');
        await expectRevert(
            dex.withdraw(
                amount, 
                web3.utils.fromAscii('token-not-approved-on-dex'), 
                {from: trader1}
            ),
            'This token does not exist!'
        );
    });
    it('Should not withdraw more tokens than allowed', async() => {
        const amount = web3.utils.toWei('100');
        await dex.deposit(amount, DAI, {from: trader1});
        await expectRevert(
            dex.withdraw(
                web3.utils.toWei('110'), 
                DAI, 
                {from: trader1}
            ),
            'Balance is too low!'
        );
    });
    it('Should create limit order', async() => {
        const amount = web3.utils.toWei('100');
        await dex.deposit(amount, DAI, {from: trader1});
        await dex.createLimitOrder(
            BAT,
            web3.utils.toWei('20'),
            5,
            SIDE.BUY,
            {from: trader1}
        );
        let buyOrders = await dex.getOrders(BAT, SIDE.BUY);
        let sellOrders = await dex.getOrders(BAT, SIDE.SELL);
        assert(buyOrders.length === 1);
        assert(buyOrders[0].trader === trader1);
        assert(buyOrders[0].ticker === web3.utils.padRight(BAT, 64));
        assert(buyOrders[0].price === '5');
        assert(buyOrders[0].amount === web3.utils.toWei('20'));
        assert(sellOrders.length === 0);

        await dex.deposit(amount, DAI, {from: trader2});
        await dex.createLimitOrder(
            BAT,
            web3.utils.toWei('10'),
            10,
            SIDE.BUY,
            {from: trader2}
        );
        buyOrders = await dex.getOrders(BAT, SIDE.BUY);
        sellOrders = await dex.getOrders(BAT, SIDE.SELL);
        assert(buyOrders.length === 2);
        assert(buyOrders[0].trader === trader2);
        assert(buyOrders[1].trader === trader1);
        assert(sellOrders.length === 0);

        await dex.deposit(amount, DAI, {from: trader2});
        await dex.createLimitOrder(
            BAT,
            web3.utils.toWei('50'),
            2,
            SIDE.BUY,
            {from: trader2}
        );
        buyOrders = await dex.getOrders(BAT, SIDE.BUY);
        sellOrders = await dex.getOrders(BAT, SIDE.SELL);
        assert(buyOrders.length === 3);
        assert(buyOrders[0].trader === trader2);
        assert(buyOrders[1].trader === trader1);
        assert(buyOrders[2].trader === trader2);
        assert(buyOrders[2].price === '2');
        assert(sellOrders.length === 0); 
    })
    it('Should not create limit order if token does not exist on DEX', async() => {
        await expectRevert(
            dex.createLimitOrder(
                web3.utils.fromAscii('token-not-approved-on-dex'),
                web3.utils.toWei('5'),
                5,
                SIDE.BUY,
                {from: trader1}
            ),
            'This token does not exist!'
        );
    });
    it('Should not create limit order if token is DAI', async() => {
        await expectRevert(
            dex.createLimitOrder(
                DAI,
                web3.utils.toWei('5'),
                5,
                SIDE.BUY,
                {from: trader1}
            ),
            'You cannot trade DAI!'
        );
    });
    it('Should not create limit order if token balance is too low', async() => {
        const amount = web3.utils.toWei('100');
        await dex.deposit(amount, BAT, {from: trader1});
        await expectRevert(
            dex.createLimitOrder(
                BAT,
                web3.utils.toWei('105'),
                5,
                SIDE.SELL,
                {from: trader1}
            ),
            'Token balance is too low!'
        );
    });
    it('Should not create limit order if DAI balance is too low', async() => {
        const amount = web3.utils.toWei('100');
        await dex.deposit(amount, DAI, {from: trader1});
        await expectRevert(
            dex.createLimitOrder(
                BAT,
                web3.utils.toWei('21'),
                5,
                SIDE.BUY,
                {from: trader1}
            ),
            'DAI balance is too low!'
        );
    });
    it('Should create market order and match against existing limit order', async() => {
        await dex.deposit(web3.utils.toWei('100'), DAI, {from: trader1});
        await dex.createLimitOrder(
            BAT,
            web3.utils.toWei('20'),
            5,
            SIDE.BUY,
            {from: trader1}
        );
        await dex.deposit(web3.utils.toWei('30'), BAT, {from: trader2});
        await dex.createMarketOrder(
            BAT,
            web3.utils.toWei('10'),
            SIDE.SELL,
            {from: trader2}
        );
        const balances = await Promise.all([
            dex.traderBalances(trader1, DAI),
            dex.traderBalances(trader1, BAT),
            dex.traderBalances(trader2, DAI),
            dex.traderBalances(trader2, BAT)
        ]);
        const orders = await dex.getOrders(BAT, SIDE.BUY);
        assert(balances[0].toString() === web3.utils.toWei('50'));
        assert(balances[1].toString() === web3.utils.toWei('10'));
        assert(balances[2].toString() === web3.utils.toWei('50'));
        assert(balances[3].toString() === web3.utils.toWei('20'));
        assert(orders[0].filled === web3.utils.toWei('10'));
    });
    it('Should not create market order if token does not exist on DEX', async() => {
        await expectRevert(
            dex.createMarketOrder(
                web3.utils.fromAscii('token-not-approved-on-dex'),
                web3.utils.toWei('10'),
                SIDE.SELL,
                {from: trader1}
            ),
            'This token does not exist!'
        );
    });
    it('Should not create market order if token is DAI', async() => {
        await expectRevert(
            dex.createMarketOrder(
                DAI,
                web3.utils.toWei('10'),
                SIDE.SELL,
                {from: trader1}
            ),
            'You cannot trade DAI!'
        );
    });
    it('Should not create market order if token balance is too low', async() => {
        await dex.deposit(web3.utils.toWei('100'), BAT, {from: trader1});
        await expectRevert(
            dex.createMarketOrder(
                BAT,
                web3.utils.toWei('110'),
                SIDE.SELL,
                {from: trader1}
            ),
            'Token balance is too low!'
        );
    });
    it('Should not create market order if DAI balance is too low', async() => {
        await dex.deposit(web3.utils.toWei('50'), BAT, {from: trader1});
        await dex.createLimitOrder(
            BAT,
            web3.utils.toWei('50'),
            5,
            SIDE.SELL,
            {from: trader1}
        );
        await dex.deposit(web3.utils.toWei('100'), DAI, {from: trader2});
        await expectRevert(
            dex.createMarketOrder(
                BAT,
                web3.utils.toWei('21'),
                SIDE.BUY,
                {from: trader2}
            ),
            'DAI balance is too low!'
        );
    });
});