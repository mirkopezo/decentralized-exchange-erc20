const { expectRevert } = require('@openzeppelin/test-helpers');
const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Dex = artifacts.require('Dex.sol');

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
});