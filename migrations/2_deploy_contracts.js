const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Dex = artifacts.require('Dex.sol');

const [DAI, REP, ZRX, BAT] = ['DAI', 'REP', 'ZRX', 'BAT']
    .map(ticker => web3.utils.fromAscii(ticker));
module.exports = async function(deployer, _network, accounts) {
    const [trader1, trader2, trader3, trader4, _] = accounts;
    await Promise.all(
        [Dai, Rep, Zrx, Bat, Dex].map(contract => deployer.deploy(contract))
    );
    const [dai, rep, zrx, bat, dex] = await Promise.all(
        [Dai, Rep, Zrx, Bat, Dex].map(contract => contract.deployed())
    );
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
        const ticker = await token.name(); 
        await dex.deposit(amount, web3.utils.toAscii(ticker), {from: trader});
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
    await Promise.all(
        [dai, rep, zrx, bat].map(
            token => seedTokenBalance(token, trader3)
        )
    );
    await Promise.all(
        [dai, rep, zrx, bat].map(
            token => seedTokenBalance(token, trader4)
        )
    );
}