import { ethers } from 'ethers';
import { PrivacyPoolSDK, Circuits, generateMasterKeys, generateDepositSecrets, getCommitment } from '@0xbow/privacy-pools-core-sdk';
require('dotenv').config();


async function makeDepositWithSDK() {
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('🎯 Making fresh deposit with published SDK...\n');
  console.log('Using wallet address:', wallet.address);
  console.log('Wallet balance:', ethers.utils.formatEther(await wallet.getBalance()), 'ETH');
  
  // Contract details
  const entrypointAddress = '0x7cd270068e633288eC331168fE28ED2b478B3073';
  const poolAddress = '0x1228D61073f4866B3BDD5bC3A0C379F5d8d38D3d';
  const scope = 2965934225275424589397773664030107646589219804421350713155887092841900884479n;
  
  try {
    console.log('1️⃣ Generating fresh credentials...');
    
    // Generate a fresh mnemonic
    const mnemonic = ethers.utils.entropyToMnemonic(ethers.utils.randomBytes(16));
    console.log('   Generated mnemonic:', mnemonic);
    
    // Generate master keys and deposit secrets
    const masterKeys = generateMasterKeys(mnemonic);
    const index = 0n;
    const depositSecrets = generateDepositSecrets(masterKeys, scope, index);
    
    console.log('   Generated nullifier:', depositSecrets.nullifier.toString());
    console.log('   Generated secret:', depositSecrets.secret.toString());
    
    console.log('\n2️⃣ Creating commitment...');
    
    // Create commitment with known parameters
    const value = BigInt(ethers.utils.parseEther('0.01').toString());
    const label = 1n; // Use label 1
    
    const commitment = getCommitment(value, label, depositSecrets.nullifier, depositSecrets.secret);
    
    console.log('   Value:', ethers.utils.formatEther(value.toString()), 'ETH');
    console.log('   Label:', label.toString());
    console.log('   Commitment hash:', commitment.hash.toString());
    console.log('   Precommitment (nullifier hash):', commitment.nullifierHash.toString());
    
    console.log('\n3️⃣ Making deposit transaction...');
    
    const entrypoint = new ethers.Contract(
      entrypointAddress,
      ['function deposit(uint256 _precommitment) external payable returns (uint256 _commitment)'],
      wallet
    );
    
    const depositTx = await entrypoint.deposit(commitment.nullifierHash, { 
      value: value.toString() 
    });
    
    console.log('   📤 Deposit transaction submitted:', depositTx.hash);
    
    const receipt = await depositTx.wait();
    console.log('   ✅ Deposit confirmed in block:', receipt.blockNumber);
    
    console.log('\n4️⃣ Verifying deposit event...');
    
    // Check all logs in the transaction to find our deposit event
    console.log('   📋 Transaction logs:', receipt.logs.length);
    
    // Try to parse logs with different event signatures
    const poolInterface = new ethers.utils.Interface([
      'event Deposited(address indexed _processooor, uint256 _value, uint256 _precommitment, uint256 indexed _commitment)',
      'event Deposited(address indexed _depositor, address indexed _pool, uint256 _commitment, uint256 _amount)'
    ]);
    
    let depositEvent = null;
    for (const log of receipt.logs) {
      try {
        const parsed = poolInterface.parseLog(log);
        if (parsed.name === 'Deposited') {
          console.log('   🎯 Found Deposited event:', parsed.args);
          depositEvent = parsed;
          break;
        }
      } catch (e) {
        // Ignore unparseable logs
      }
    }
    
    if (depositEvent) {
      // Handle different event formats
      let actualCommitment, actualValue, actualPrecommitment;
      
      if (depositEvent.args._precommitment !== undefined) {
        // Format 1: _processooor, _value, _precommitment, _commitment
        actualCommitment = depositEvent.args._commitment;
        actualPrecommitment = depositEvent.args._precommitment;
        actualValue = depositEvent.args._value;
      } else if (depositEvent.args._amount !== undefined) {
        // Format 2: _depositor, _pool, _commitment, _amount  
        actualCommitment = depositEvent.args._commitment;
        actualValue = depositEvent.args._amount;
        actualPrecommitment = commitment.nullifierHash; // Use our calculated value
      }
      
      
      console.log('   📋 Deposit event details:');
      console.log('     Block:', receipt.blockNumber);
      console.log('     Commitment:', actualCommitment.toString());
      console.log('     Precommitment:', actualPrecommitment ? actualPrecommitment.toString() : 'N/A');
      console.log('     Value:', ethers.utils.formatEther(actualValue), 'ETH');
      
      console.log('\n   🔍 Verification:');
      console.log('     Our commitment matches:', commitment.hash.toString() === actualCommitment.toString() ? '✅' : '❌');
      if (actualPrecommitment) {
        console.log('     Our precommitment matches:', commitment.nullifierHash.toString() === actualPrecommitment.toString() ? '✅' : '❌');
      }
      console.log('     Value matches:', value.toString() === actualValue.toString() ? '✅' : '❌');
      
      console.log('\n💾 SAVE THESE VALUES FOR WITHDRAWAL:');
      console.log('=====================================================');
      console.log('Mnemonic:', mnemonic);
      console.log('Scope:', scope.toString());
      console.log('Index:', index.toString());
      console.log('Label:', label.toString());
      console.log('Value:', value.toString(), '// wei (0.01 ETH)');
      console.log('Nullifier:', depositSecrets.nullifier.toString());
      console.log('Secret:', depositSecrets.secret.toString());
      console.log('Commitment:', actualCommitment.toString());
      console.log('Precommitment:', actualPrecommitment ? actualPrecommitment.toString() : commitment.nullifierHash.toString());
      console.log('Block:', receipt.blockNumber);
      console.log('Pool Address:', poolAddress);
      console.log('Entrypoint Address:', entrypointAddress);
      console.log('=====================================================');
      
      // Write credentials to a file for easy access
      const credentials = {
        mnemonic,
        scope: scope.toString(),
        index: index.toString(),
        label: label.toString(),
        value: value.toString(),
        nullifier: depositSecrets.nullifier.toString(),
        secret: depositSecrets.secret.toString(),
        commitment: actualCommitment.toString(),
        precommitment: actualPrecommitment ? actualPrecommitment.toString() : commitment.nullifierHash.toString(),
        blockNumber: receipt.blockNumber,
        poolAddress,
        entrypointAddress,
        timestamp: new Date().toISOString()
      };
      
      // Save to file
      const fs = await import('fs');
      fs.writeFileSync('deposit-credentials.json', JSON.stringify(credentials, null, 2));
      console.log('\n💾 Credentials saved to deposit-credentials.json');
      
      console.log('\n🎉 Fresh deposit completed successfully!');
      console.log('You can now use these exact credentials for withdrawal.');
      
    } else {
      console.log('   ❌ No deposit event found in transaction');
    }
    
  } catch (error) {
    console.error('❌ Deposit failed:', error.message);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('💡 Need more ETH in wallet to pay for gas + deposit amount');
    } else if (error.reason) {
      console.log('💡 Contract revert reason:', error.reason);
    }
    console.error('Full error:', error);
  }
}

makeDepositWithSDK().catch(console.error);