pragma solidity 0.6.3;

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol';
import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v2.5.1/contracts/token/ERC20/ERC20Detailed.sol';

contract Rep is ERC20, ERC20Detailed {
    constructor() ERC20Detailed('REP', 'Augur token', 18) public {}

    function faucet(address to, uint amount) external {
        _mint(to, amount);
    }
}