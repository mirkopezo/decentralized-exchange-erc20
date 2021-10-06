const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Dex = artifacts.require('Dex.sol');

contract('Dex', (accounts) => {
    let dai, rep, zrx, bat;
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
        const dex = await Dex.new();
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
});