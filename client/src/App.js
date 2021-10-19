import React, { useState, useEffect } from 'react';
import Header from 'Header';
import Footer from 'Footer';
// import Wallet
import Wallet from 'Wallet';

function App(props) {
  const { web3, accounts, contracts } = props;
  const [tokens, setTokens] = useState([]);
  const [user, setUser] = useState({
    accounts: [],
    // we will have a new entry
    balances : {
      tokenDex: 0,
      tokenWallet: 0
    },
    selectedToken: undefined
  });

  // function for getting balance
  const getBalances = async(account, token) => {
    const tokenDex = await contracts.dex.methods
      .traderBalances(account, web3.utils.fromAscii(token.ticker))
      .call();
    const tokenWallet = await contracts[token.ticker].methods
      .balanceOf(account)
      .call();
    return {tokenDex, tokenWallet};    
  }

  const selectToken = token => {
    setUser({
      ...user,
      selectedToken: token
    });
  }
  // we will create deposit function
  const deposit = async amount => {
    // we will call deposit function of the dex smart contract, but before
    // we do this, we need to approve dex smart contract to spend our tokens, and
    // for that we will use ERC20 smart contract
    await contracts[user.selectedToken.ticker].methods
      .approve(contracts.dex.options.address, amount)
      .send({from: user.accounts[0]});
    // and now we can call deposit function
    await contracts.dex.methods
      .deposit(amount, web3.utils.fromAscii(user.selectedToken.ticker))
      .send({from: user.accounts[0]});
    // and now we need to update token balances of the wallet
    const balances = await getBalances(user.accounts[0], user.selectedToken);
    // we will not overewrite whole object, so we will use callback function to 
    // update the state
    setUser(user => ({
      ...user,
      balances
    }))
  }

  // now we will create wirthdraw function, it will be very similar to deposit function
  const withdraw = async amount => {
    await contracts.dex.methods
      .withdraw(amount, web3.utils.fromAscii(user.selectedToken.ticker))
      .send({from: user.accounts[0]});
    const balances = await getBalances(user.accounts[0], user.selectedToken);
    setUser(user => ({
      ...user,
      balances
    }))
  }


  useEffect(() => {
    const init = async() => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map(token => ({
        ...token,
        ticker: web3.utils.hexToUtf8(token.ticker)
      }));
      // when component initially loads, we need to populate balances of token
      const balances = await getBalances(accounts[0], tokens[0]);
      setTokens(tokens);
      // when we set user object we will also include balances
      setUser({accounts, balances, selectedToken: tokens[0]});
    }
    init();
  }, []);
  
  if(typeof user.selectedToken === 'undefined') {
    return(
      <div>Loading...</div>
    );
  }
  
  return (
    <div id="app">
      <Header
        contracts={contracts} 
        tokens={tokens}
        user={user}
        selectToken={selectToken}
      />
      <main className="containter-fluid">
        <div className="row">
          <div className="col-sm-4 first-col">
            <Wallet
              user={user}
              deposit={deposit}
              withdraw={withdraw} 
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
