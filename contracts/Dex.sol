pragma solidity 0.6.3;

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol';
// import SafeMath.sol
import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v2.5.1/contracts/math/SafeMath.sol';

contract Dex {
    // we will use special keyword 'using'. 'using' basically allows to use a library and attach it to specific type.
    // If you go to smart contract of SafeMath.sol, you will see couple of functions, first argument for each function
    // is going to be replaced by number for which we call this 'add' method.
    // That means inside our smart contract, if we have variable that is called 'a' and it is uint. We will go for
    // example a.add(2), 'add' function is going to be called with 'a' as first argument and '2' as second argument.
    // Now we need to replace our all arithmetic operations by calling functions of SafeMath.
    using SafeMath for uint;

    enum Side {
        BUY,
        SELL
    }

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint date;
    }

    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList;
    mapping(address => mapping(bytes32 => uint)) public traderBalances;
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;
    address public admin;
    uint public nextOrderId;
    uint public nextTradeId;
    bytes32 constant DAI = bytes32('DAI');

    event NewTrade(
        uint tradeId, 
        uint orderId,
        bytes32 indexed ticker,
        address indexed trader1, 
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );

    constructor() public {
        admin = msg.sender;
    }

    function addToken(bytes32 ticker, address tokenAddress) onlyAdmin() external {
        tokens[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    function deposit(uint amount, bytes32 ticker) tokenExist(ticker) external {
        IERC20(tokens[ticker].tokenAddress).transferFom(msg.sender, address(this), amount);
        // we change this
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].add(amount); 
        
    }

    function withdraw(uint amount, bytes32 ticker) tokenExist(ticker) external {
        require(traderBalances[msg.sender][ticker] >= amount, 'Balance is too low!');
        // we change this, 'sub' function is for subtraction
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].sub(amount);
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }

    function createLimitOrder(
        bytes32 ticker,
        uint amount,
        uint price,
        Side side
    )
    tokenExist(ticker)
    tokenIsNotDai(ticker)
    external {
        if(side == Side.SELL) {
            require(traderBalances[msg.sender][ticker] >= amount, 'Token balance is too low!');
        } else {
            // we change this line
            require(traderBalances[msg.sender][DAI] >= amount.mul(price), 'DAI balance is too low!');
        }
        Order[] storage orders = orderBook[ticker][uint(side)];
        orders.push(Order(
            nextOrderId,
            msg.sender,
            side,
            ticker,
            amount,
            0,
            price,
            now
        ));
        // we protect here potential underflow problem
        uint i = (orders.length > 0)? (orders.length - 1) : 0;
        while(i > 0) {
            if(side == Side.BUY && orders[i-1].price > orders[i].price) {
                break;
            }
            if(side == Side.SELL && orders[i-1].price < orders[i].price) {
                break;
            }
            Order memory order = orders[i-1];
            orders[i-1] = orders[i];
            orders[i] = order;
            // this will never be negative but just in case we will protect it
            i = i.sub(1);
        }
        // we change this line
        nextOrderId = nextOrderId.add(1);
    }

    function createMarketOrder(
        bytes32 ticker,
        uint amount,
        Side side
    )
    tokenExist(ticker)
    tokenIsNotDai(ticker)
    external {
        if(side == Side.SELL) {
            require(traderBalances[msg.sender][ticker] >= amount, 'Token balance is too low!');
        }
        Order[] storage orders = orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)];
        uint i;
        uint remaining = amount;
        while(i < orders.length && remaining > 0) {
            // we change this
            uint available = orders[i].amount.sub(orders[i].filled);
            uint matched = (remaining > available)? available : remaining;
            // we change those next 2 lines
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);
            emit NewTrade(
                nextTradeId,
                orders[i].id,
                ticker,
                orders[i].trader,
                msg.sender,
                matched,
                orders[i].price,
                now
            );
            if(side == Side.SELL) {
                // we change this all lines in if
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI]
                    .add(matched.mul(orders[i].price)); 
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI]
                    .sub(matched.mul(orders[i].price));
            } else {
                // we change this all lines in else
                require(traderBalances[msg.sender][DAI] >= matched.mul(orders[i].price), 
                    'DAI balance is too low!');
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI]
                    .sub(matched.mul(orders[i].price)); 
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI]
                    .add(matched.mul(orders[i].price));
            }
            // we change next 2 lines
            nextTradeId = nextTradeId.add(1);
            i = i.add(1);
        }
        i = 0;
        while(i < orders.length && orders[i].filled == orders[i].amount) {
            for(uint j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }
            orders.pop();
            // we change this line
            i = i.add(1);
        }
    }

    modifier tokenIsNotDai(bytes32 ticker) {
        require(ticker != DAI, 'You cannot trade DAI!');
        _;
    }

    modifier tokenExist(bytes32 ticker) {
        require(tokens[ticker].tokenAddress != address(0), 'This token does not exist!');
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, 'Only for admin!');
        _;
    }
}
