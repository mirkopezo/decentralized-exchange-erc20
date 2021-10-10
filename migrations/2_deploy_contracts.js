const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Dex = artifacts.require('Dex.sol');

const [DAI, REP, ZRX, BAT] = ['DAI', 'REP', 'ZRX', 'BAT']
    .map(ticker => web3.utils.fromAscii(ticker));

module.exports = async function(deployer) {
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
}