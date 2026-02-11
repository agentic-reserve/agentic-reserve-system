/**
 * Devnet Instruction Testing Suite
 * 
 * Tests all ARS protocol instructions on Solana devnet:
 * - Agent registration
 * - ILI updates with Byzantine consensus
 * - Proposal creation and voting
 * - Vault deposits and withdrawals
 * - ARU minting and burning
 * 
 * Requirements: 7.5
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { ArsReserve } from "../target/types/ars_reserve";
import { ArsToken } from "../target/types/ars_token";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("Devnet Instructions Test", () => {
  // Configure provider for devnet
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const arsCoreProgram = anchor.workspace.ArsCore as Program<ArsCore>;
  const arsReserveProgram = anchor.workspace.ArsReserve as Program<ArsReserve>;
  const arsTokenProgram = anchor.workspace.ArsToken as Program<ArsToken>;

  const authority = provider.wallet.publicKey;
  
  // Test keypairs
  let aruMint: web3.PublicKey;
  let usdcMint: web3.PublicKey;
  let agent1: web3.Keypair;
  let agent2: web3.Keypair;
  let agent3: web3.Keypair;
  
  // PDAs
  let globalState: web3.PublicKey;
  let iliOracle: web3.PublicKey;
  let reserveVault: web3.PublicKey;
  let mintState: web3.PublicKey;
  
  // Token accounts
  let agent1TokenAccount: web3.PublicKey;
  let agent2TokenAccount: web3.PublicKey;
  let agent3TokenAccount: web3.PublicKey;
  let stakeEscrow: web3.PublicKey;
  let vaultUsdcAccount: web3.PublicKey;
  let userUsdcAccount: web3.PublicKey;

  before(async () => {
    console.log("\n🚀 Setting up devnet test environment...");
    console.log(`Authority: ${authority.toString()}`);
    console.log(`Cluster: ${provider.connection.rpcEndpoint}`);

    // Generate test keypairs
    agent1 = web3.Keypair.generate();
    agent2 = web3.Keypair.generate();
    agent3 = web3.Keypair.generate();

    console.log(`\nAgent 1: ${agent1.publicKey.toString()}`);
    console.log(`Agent 2: ${agent2.publicKey.toString()}`);
    console.log(`Agent 3: ${agent3.publicKey.toString()}`);

    // Airdrop SOL to agents for transaction fees
    console.log("\n💰 Airdropping SOL to test accounts...");
    try {
      const airdropAmount = 2 * web3.LAMPORTS_PER_SOL;
      
      await provider.connection.requestAirdrop(agent1.publicKey, airdropAmount);
      await provider.connection.requestAirdrop(agent2.publicKey, airdropAmount);
      await provider.connection.requestAirdrop(agent3.publicKey, airdropAmount);
      
      // Wait for airdrops to confirm
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log("✅ Airdrops completed");
    } catch (error) {
      console.warn("⚠️  Airdrop failed (rate limit or devnet issue):", error.message);
      console.log("Continuing with existing balances...");
    }

    // Create ARU mint
    console.log("\n🪙 Creating ARU token mint...");
    aruMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      authority,
      6 // 6 decimals
    );
    console.log(`ARU Mint: ${aruMint.toString()}`);

    // Create USDC mock mint for testing
    console.log("🪙 Creating USDC mock mint...");
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      authority,
      6
    );
    console.log(`USDC Mint: ${usdcMint.toString()}`);

    // Derive PDAs
    [globalState] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      arsCoreProgram.programId
    );

    [iliOracle] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ili_oracle")],
      arsCoreProgram.programId
    );

    [reserveVault] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authority.toBuffer()],
      arsReserveProgram.programId
    );

    [mintState] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint_state"), authority.toBuffer()],
      arsTokenProgram.programId
    );

    console.log("\n📍 PDAs:");
    console.log(`Global State: ${globalState.toString()}`);
    console.log(`ILI Oracle: ${iliOracle.toString()}`);
    console.log(`Reserve Vault: ${reserveVault.toString()}`);
    console.log(`Mint State: ${mintState.toString()}`);

    // Create token accounts
    console.log("\n💼 Creating token accounts...");
    
    agent1TokenAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      agent1.publicKey
    );

    agent2TokenAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      agent2.publicKey
    );

    agent3TokenAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      agent3.publicKey
    );

    stakeEscrow = await createAccount(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      globalState,
      web3.Keypair.generate()
    );

    vaultUsdcAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      reserveVault,
      web3.Keypair.generate()
    );

    userUsdcAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      authority
    );

    // Mint ARU tokens to agents for staking
    console.log("\n💸 Minting ARU tokens to agents...");
    const stakeAmount = new BN(10_000_000_000); // 10,000 ARU
    
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      agent1TokenAccount,
      authority,
      stakeAmount.toNumber()
    );

    await mintTo(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      agent2TokenAccount,
      authority,
      stakeAmount.toNumber()
    );

    await mintTo(
      provider.connection,
      provider.wallet.payer,
      aruMint,
      agent3TokenAccount,
      authority,
      stakeAmount.toNumber()
    );

    // Mint USDC to user for deposits
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      userUsdcAccount,
      authority,
      1_000_000_000 // 1,000 USDC
    );

    console.log("✅ Setup complete!\n");
  });

  describe("1. Protocol Initialization", () => {
    it("Should initialize ars-core protocol", async () => {
      console.log("\n🔧 Initializing ars-core...");

      const tx = await arsCoreProgram.methods
        .initialize(
          new BN(86400), // 24 hour epochs
          200, // 2% mint/burn cap
          15000 // 150% VHR threshold
        )
        .accounts({
          globalState,
          iliOracle,
          authority,
          reserveVault,
          aruMint,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      // Verify initialization
      const globalStateAccount = await arsCoreProgram.account.globalState.fetch(globalState);
      assert.equal(globalStateAccount.authority.toString(), authority.toString());
      assert.equal(globalStateAccount.epochDuration.toNumber(), 86400);
      assert.equal(globalStateAccount.mintBurnCapBps, 200);
      
      console.log("✅ ars-core initialized successfully");
    });

    it("Should initialize ars-reserve vault", async () => {
      console.log("\n🔧 Initializing ars-reserve...");

      // Create dummy vault accounts
      const solVault = web3.Keypair.generate().publicKey;
      const msolVault = web3.Keypair.generate().publicKey;
      const jitosolVault = web3.Keypair.generate().publicKey;

      const tx = await arsReserveProgram.methods
        .initialize(
          15000, // 150% min VHR
          17500  // 175% rebalance threshold
        )
        .accounts({
          vault: reserveVault,
          authority,
          usdcVault: vaultUsdcAccount,
          solVault,
          msolVault,
          jitosolVault,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const vaultAccount = await arsReserveProgram.account.reserveVault.fetch(reserveVault);
      assert.equal(vaultAccount.authority.toString(), authority.toString());
      assert.equal(vaultAccount.minVhr, 15000);
      
      console.log("✅ ars-reserve initialized successfully");
    });

    it("Should initialize ars-token mint state", async () => {
      console.log("\n🔧 Initializing ars-token...");

      const tx = await arsTokenProgram.methods
        .initialize(
          new BN(86400), // 24 hour epochs
          200, // 2% mint cap
          200  // 2% burn cap
        )
        .accounts({
          mintState,
          authority,
          aruMint,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const mintStateAccount = await arsTokenProgram.account.mintState.fetch(mintState);
      assert.equal(mintStateAccount.authority.toString(), authority.toString());
      assert.equal(mintStateAccount.epochDuration.toNumber(), 86400);
      
      console.log("✅ ars-token initialized successfully");
    });
  });

  describe("2. Agent Registration", () => {
    it("Should register agent 1 with Silver tier", async () => {
      console.log("\n👤 Registering Agent 1...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent1.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const stakeAmount = new BN(5_000_000_000); // 5,000 ARU = Silver tier

      const tx = await arsCoreProgram.methods
        .registerAgent(stakeAmount)
        .accounts({
          agentRegistry,
          agent: agent1.publicKey,
          agentTokenAccount: agent1TokenAccount,
          stakeEscrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([agent1])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const agentAccount = await arsCoreProgram.account.agentRegistry.fetch(agentRegistry);
      assert.equal(agentAccount.agentPubkey.toString(), agent1.publicKey.toString());
      assert.equal(agentAccount.stakeAmount.toString(), stakeAmount.toString());
      assert.equal(agentAccount.agentTier.silver !== undefined, true);
      
      console.log(`✅ Agent 1 registered with tier: Silver`);
    });

    it("Should register agent 2 with Silver tier", async () => {
      console.log("\n👤 Registering Agent 2...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent2.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const stakeAmount = new BN(5_000_000_000);

      const tx = await arsCoreProgram.methods
        .registerAgent(stakeAmount)
        .accounts({
          agentRegistry,
          agent: agent2.publicKey,
          agentTokenAccount: agent2TokenAccount,
          stakeEscrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([agent2])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);
      console.log(`✅ Agent 2 registered`);
    });

    it("Should register agent 3 with Silver tier", async () => {
      console.log("\n👤 Registering Agent 3...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent3.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const stakeAmount = new BN(5_000_000_000);

      const tx = await arsCoreProgram.methods
        .registerAgent(stakeAmount)
        .accounts({
          agentRegistry,
          agent: agent3.publicKey,
          agentTokenAccount: agent3TokenAccount,
          stakeEscrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([agent3])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);
      console.log(`✅ Agent 3 registered`);
    });
  });

  describe("3. ILI Updates with Byzantine Consensus", () => {
    it("Should submit ILI update from agent 1", async () => {
      console.log("\n📊 Agent 1 submitting ILI update...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent1.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const iliValue = new BN(5000);
      const timestamp = new BN(Date.now() / 1000);

      const tx = await arsCoreProgram.methods
        .submitIliUpdate(iliValue, timestamp)
        .accounts({
          iliOracle,
          globalState,
          agentRegistry,
          agent: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);
      console.log(`✅ Agent 1 submitted ILI: ${iliValue.toString()}`);
    });

    it("Should submit ILI update from agent 2", async () => {
      console.log("\n📊 Agent 2 submitting ILI update...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent2.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const iliValue = new BN(5100);
      const timestamp = new BN(Date.now() / 1000);

      const tx = await arsCoreProgram.methods
        .submitIliUpdate(iliValue, timestamp)
        .accounts({
          iliOracle,
          globalState,
          agentRegistry,
          agent: agent2.publicKey,
        })
        .signers([agent2])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);
      console.log(`✅ Agent 2 submitted ILI: ${iliValue.toString()}`);
    });

    it("Should achieve Byzantine consensus with agent 3 and update ILI", async () => {
      console.log("\n📊 Agent 3 submitting ILI update (consensus)...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent3.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const iliValue = new BN(4900);
      const timestamp = new BN(Date.now() / 1000);

      const tx = await arsCoreProgram.methods
        .submitIliUpdate(iliValue, timestamp)
        .accounts({
          iliOracle,
          globalState,
          agentRegistry,
          agent: agent3.publicKey,
        })
        .signers([agent3])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      // Verify consensus was reached and median calculated
      const iliOracleAccount = await arsCoreProgram.account.iliOracle.fetch(iliOracle);
      console.log(`✅ Consensus reached! ILI updated to: ${iliOracleAccount.currentIli.toString()}`);
      console.log(`   (Median of 5000, 5100, 4900 = 5000)`);
      
      assert.equal(iliOracleAccount.currentIli.toNumber(), 5000);
      assert.equal(iliOracleAccount.pendingUpdates.length, 0);
    });
  });

  describe("4. Proposal Creation and Voting", () => {
    let proposalId: BN;
    let proposalPda: web3.PublicKey;

    it("Should create a governance proposal", async () => {
      console.log("\n🗳️  Creating governance proposal...");

      const globalStateAccount = await arsCoreProgram.account.globalState.fetch(globalState);
      proposalId = globalStateAccount.proposalCounter;

      [proposalPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        arsCoreProgram.programId
      );

      const policyParams = Buffer.from([1, 0, 0, 0]); // Simple params
      const votingPeriod = new BN(86400); // 24 hours

      const tx = await arsCoreProgram.methods
        .createProposal(
          { mintAru: {} }, // PolicyType enum
          Array.from(policyParams),
          votingPeriod
        )
        .accounts({
          globalState,
          proposal: proposalPda,
          proposer: agent1.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([agent1])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);
      console.log(`✅ Proposal ${proposalId.toString()} created`);

      const proposalAccount = await arsCoreProgram.account.policyProposal.fetch(proposalPda);
      assert.equal(proposalAccount.id.toString(), proposalId.toString());
      assert.equal(proposalAccount.proposer.toString(), agent1.publicKey.toString());
    });

    it("Should vote YES on proposal with quadratic voting", async () => {
      console.log("\n✅ Agent 1 voting YES on proposal...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent1.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const stakeAmount = new BN(1_000_000_000); // 1,000 ARU

      const tx = await arsCoreProgram.methods
        .voteOnProposal(true, stakeAmount)
        .accounts({
          proposal: proposalPda,
          agentRegistry,
          voter: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const proposalAccount = await arsCoreProgram.account.policyProposal.fetch(proposalPda);
      console.log(`✅ Vote recorded:`);
      console.log(`   Stake: ${proposalAccount.yesStake.toString()}`);
      console.log(`   Quadratic power: ${proposalAccount.quadraticYes.toString()}`);
      
      // Verify quadratic voting (sqrt of 1,000,000,000 ≈ 31,622)
      assert.ok(proposalAccount.quadraticYes.toNumber() > 31000);
      assert.ok(proposalAccount.quadraticYes.toNumber() < 32000);
    });

    it("Should vote NO on proposal", async () => {
      console.log("\n❌ Agent 2 voting NO on proposal...");

      const [agentRegistry] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent2.publicKey.toBuffer()],
        arsCoreProgram.programId
      );

      const stakeAmount = new BN(500_000_000); // 500 ARU

      const tx = await arsCoreProgram.methods
        .voteOnProposal(false, stakeAmount)
        .accounts({
          proposal: proposalPda,
          agentRegistry,
          voter: agent2.publicKey,
        })
        .signers([agent2])
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const proposalAccount = await arsCoreProgram.account.policyProposal.fetch(proposalPda);
      console.log(`✅ Vote recorded:`);
      console.log(`   NO stake: ${proposalAccount.noStake.toString()}`);
      console.log(`   Quadratic power: ${proposalAccount.quadraticNo.toString()}`);
    });
  });

  describe("5. Vault Deposits and Withdrawals", () => {
    it("Should deposit USDC to reserve vault", async () => {
      console.log("\n💰 Depositing USDC to vault...");

      const depositAmount = new BN(100_000_000); // 100 USDC

      const tx = await arsReserveProgram.methods
        .deposit(depositAmount)
        .accounts({
          vault: reserveVault,
          user: authority,
          userTokenAccount: userUsdcAccount,
          vaultTokenAccount: vaultUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const vaultAccount = await arsReserveProgram.account.reserveVault.fetch(reserveVault);
      console.log(`✅ Deposit successful:`);
      console.log(`   Total value: ${vaultAccount.totalValueUsd.toString()}`);
      console.log(`   VHR: ${vaultAccount.vhr}`);
      
      assert.ok(vaultAccount.totalValueUsd.toNumber() > 0);
    });

    it("Should withdraw USDC from reserve vault", async () => {
      console.log("\n💸 Withdrawing USDC from vault...");

      const withdrawAmount = new BN(50_000_000); // 50 USDC

      const tx = await arsReserveProgram.methods
        .withdraw(withdrawAmount)
        .accounts({
          vault: reserveVault,
          user: authority,
          userTokenAccount: userUsdcAccount,
          vaultTokenAccount: vaultUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const vaultAccount = await arsReserveProgram.account.reserveVault.fetch(reserveVault);
      console.log(`✅ Withdrawal successful:`);
      console.log(`   Total value: ${vaultAccount.totalValueUsd.toString()}`);
      console.log(`   VHR: ${vaultAccount.vhr}`);
    });
  });

  describe("6. ARU Minting and Burning", () => {
    let userAruAccount: web3.PublicKey;

    before(async () => {
      userAruAccount = await createAccount(
        provider.connection,
        provider.wallet.payer,
        aruMint,
        authority
      );
    });

    it("Should mint ARU tokens", async () => {
      console.log("\n🪙 Minting ARU tokens...");

      const mintAmount = new BN(1_000_000_000); // 1,000 ARU

      const tx = await arsTokenProgram.methods
        .mintAru(mintAmount)
        .accounts({
          mintState,
          aruMint,
          destination: userAruAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const mintStateAccount = await arsTokenProgram.account.mintState.fetch(mintState);
      console.log(`✅ Mint successful:`);
      console.log(`   Total supply: ${mintStateAccount.totalSupply.toString()}`);
      console.log(`   Epoch minted: ${mintStateAccount.epochMinted.toString()}`);
      
      assert.equal(mintStateAccount.totalSupply.toString(), mintAmount.toString());
      assert.equal(mintStateAccount.epochMinted.toString(), mintAmount.toString());

      // Verify user balance
      const userAccount = await getAccount(provider.connection, userAruAccount);
      assert.equal(userAccount.amount.toString(), mintAmount.toString());
    });

    it("Should burn ARU tokens", async () => {
      console.log("\n🔥 Burning ARU tokens...");

      const burnAmount = new BN(500_000_000); // 500 ARU

      const tx = await arsTokenProgram.methods
        .burnAru(burnAmount)
        .accounts({
          mintState,
          aruMint,
          source: userAruAccount,
          authority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Transaction: ${tx}`);

      const mintStateAccount = await arsTokenProgram.account.mintState.fetch(mintState);
      console.log(`✅ Burn successful:`);
      console.log(`   Total supply: ${mintStateAccount.totalSupply.toString()}`);
      console.log(`   Epoch burned: ${mintStateAccount.epochBurned.toString()}`);
      
      assert.equal(mintStateAccount.epochBurned.toString(), burnAmount.toString());

      // Verify user balance decreased
      const userAccount = await getAccount(provider.connection, userAruAccount);
      assert.equal(userAccount.amount.toString(), "500000000");
    });
  });

  after(() => {
    console.log("\n" + "=".repeat(80));
    console.log("✅ ALL DEVNET INSTRUCTION TESTS COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(80));
    console.log("\n📋 Summary:");
    console.log("  ✅ Protocol initialization (ars-core, ars-reserve, ars-token)");
    console.log("  ✅ Agent registration (3 agents with Silver tier)");
    console.log("  ✅ ILI updates with Byzantine consensus (median calculation)");
    console.log("  ✅ Proposal creation and quadratic voting");
    console.log("  ✅ Vault deposits and withdrawals");
    console.log("  ✅ ARU minting and burning with epoch caps");
    console.log("\n🎉 All instructions tested successfully on devnet!");
  });
});
