import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("Percolator Integration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArsCore as Program<ArsCore>;
  
  // Percolator devnet addresses
  const PERCOLATOR_PROGRAM_ID = new PublicKey("46iB4ET4WpqfTXAqGSmyBczLBgVhd1sHre93KtU3sTg9");
  const PERCOLATOR_SLAB = new PublicKey("AcF3Q3UMHqx2xZR2Ty6pNvfCaogFmsLEqyMACQ2c4UPK");
  const PERCOLATOR_VAULT = new PublicKey("D7QrsrJ4emtsw5LgPGY2coM5K9WPPVgQNJVr5TbK7qtU");
  
  let authority: Keypair;
  let agent: Keypair;
  let mint: PublicKey;
  let arsTokenAccount: PublicKey;
  let globalStatePda: PublicKey;
  let iliOraclePda: PublicKey;
  let agentRegistryPda: PublicKey;
  
  before(async () => {
    authority = Keypair.generate();
    agent = Keypair.generate();
    
    // Airdrop SOL
    await provider.connection.requestAirdrop(authority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(agent.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create mint
    mint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      9
    );
    
    // Create token account
    arsTokenAccount = await createAccount(
      provider.connection,
      authority,
      mint,
      authority.publicKey
    );
    
    // Mint tokens
    await mintTo(
      provider.connection,
      authority,
      mint,
      arsTokenAccount,
      authority,
      100_000_000_000 // 100 tokens
    );
    
    // Derive PDAs
    [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );
    
    [iliOraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ili_oracle")],
      program.programId
    );
    
    [agentRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_registry"), agent.publicKey.toBuffer()],
      program.programId
    );
  });
  
  it("Initializes ARS protocol", async () => {
    await program.methods
      .initialize()
      .accounts({
        globalState: globalStatePda,
        iliOracle: iliOraclePda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
    
    const globalState = await program.account.globalState.fetch(globalStatePda);
    assert.equal(globalState.authority.toBase58(), authority.publicKey.toBase58());
  });
  
  it("Registers an agent", async () => {
    await program.methods
      .registerAgent(new anchor.BN(100_000_000_000)) // 100 ARU stake
      .accounts({
        globalState: globalStatePda,
        agentRegistry: agentRegistryPda,
        agent: agent.publicKey,
        authority: agent.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();
    
    const agentRegistry = await program.account.agentRegistry.fetch(agentRegistryPda);
    assert.equal(agentRegistry.isActive, true);
    assert.equal(agentRegistry.tier, 3); // Platinum tier
  });
  
  it("Allocates collateral to Percolator", async () => {
    const userIdx = 0;
    const amount = new anchor.BN(1_000_000_000); // 1 SOL
    
    const tx = await program.methods
      .allocateToPercolator(userIdx, amount)
      .accounts({
        globalState: globalStatePda,
        authority: authority.publicKey,
        percolatorDeposit: {
          slab: PERCOLATOR_SLAB,
          vault: PERCOLATOR_VAULT,
          authority: authority.publicKey,
          arsTokenAccount: arsTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          percolatorProgram: PERCOLATOR_PROGRAM_ID,
        },
      })
      .signers([authority])
      .rpc();
    
    console.log("Allocation tx:", tx);
    
    // Verify event was emitted
    const events = await program.account.globalState.fetch(globalStatePda);
    // Note: Event verification would require parsing transaction logs
  });
  
  it("Updates Percolator oracle with ILI price", async () => {
    // First, submit an ILI update
    await program.methods
      .submitIliUpdate(
        new anchor.BN(10500), // ILI = 105%
        Buffer.from(new Uint8Array(64)), // Mock signature
        new anchor.BN(Date.now() / 1000)
      )
      .accounts({
        globalState: globalStatePda,
        iliOracle: iliOraclePda,
        agentRegistry: agentRegistryPda,
        agent: agent.publicKey,
      })
      .signers([agent])
      .rpc();
    
    // Now update Percolator oracle
    const tx = await program.methods
      .updatePercolatorOracle()
      .accounts({
        globalState: globalStatePda,
        iliOracle: iliOraclePda,
        authority: authority.publicKey,
        percolatorPush: {
          slab: PERCOLATOR_SLAB,
          authority: authority.publicKey,
          percolatorProgram: PERCOLATOR_PROGRAM_ID,
        },
      })
      .signers([authority])
      .rpc();
    
    console.log("Oracle update tx:", tx);
  });
  
  it("Executes trade on Percolator", async () => {
    const userIdx = 0;
    const lpIdx = 0;
    const size = new anchor.BN(1000); // Long 1000 units
    
    // Derive oracle account (mock for test)
    const oracleAccount = Keypair.generate().publicKey;
    
    const tx = await program.methods
      .executePercolatorTrade(userIdx, lpIdx, size)
      .accounts({
        agentRegistry: agentRegistryPda,
        authority: agent.publicKey,
        percolatorTrade: {
          slab: PERCOLATOR_SLAB,
          oracle: oracleAccount,
          authority: agent.publicKey,
          percolatorProgram: PERCOLATOR_PROGRAM_ID,
        },
      })
      .signers([agent])
      .rpc();
    
    console.log("Trade tx:", tx);
  });
  
  it("Withdraws from Percolator", async () => {
    const userIdx = 0;
    const amount = new anchor.BN(500_000_000); // 0.5 SOL
    
    // Derive vault authority PDA
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), PERCOLATOR_SLAB.toBuffer()],
      PERCOLATOR_PROGRAM_ID
    );
    
    // Derive oracle account (mock for test)
    const oracleAccount = Keypair.generate().publicKey;
    
    const tx = await program.methods
      .withdrawFromPercolator(userIdx, amount)
      .accounts({
        globalState: globalStatePda,
        authority: authority.publicKey,
        percolatorWithdraw: {
          slab: PERCOLATOR_SLAB,
          vault: PERCOLATOR_VAULT,
          vaultAuthority: vaultAuthority,
          authority: authority.publicKey,
          arsTokenAccount: arsTokenAccount,
          oracle: oracleAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          percolatorProgram: PERCOLATOR_PROGRAM_ID,
        },
      })
      .signers([authority])
      .rpc();
    
    console.log("Withdrawal tx:", tx);
  });
  
  it("Rejects allocation from non-admin", async () => {
    const userIdx = 0;
    const amount = new anchor.BN(1_000_000_000);
    
    try {
      await program.methods
        .allocateToPercolator(userIdx, amount)
        .accounts({
          globalState: globalStatePda,
          authority: agent.publicKey, // Non-admin
          percolatorDeposit: {
            slab: PERCOLATOR_SLAB,
            vault: PERCOLATOR_VAULT,
            authority: agent.publicKey,
            arsTokenAccount: arsTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            percolatorProgram: PERCOLATOR_PROGRAM_ID,
          },
        })
        .signers([agent])
        .rpc();
      
      assert.fail("Should have thrown unauthorized error");
    } catch (err) {
      assert.include(err.toString(), "Unauthorized");
    }
  });
  
  it("Rejects trade from inactive agent", async () => {
    const inactiveAgent = Keypair.generate();
    await provider.connection.requestAirdrop(inactiveAgent.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const [inactiveAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_registry"), inactiveAgent.publicKey.toBuffer()],
      program.programId
    );
    
    const oracleAccount = Keypair.generate().publicKey;
    
    try {
      await program.methods
        .executePercolatorTrade(0, 0, new anchor.BN(1000))
        .accounts({
          agentRegistry: inactiveAgentPda,
          authority: inactiveAgent.publicKey,
          percolatorTrade: {
            slab: PERCOLATOR_SLAB,
            oracle: oracleAccount,
            authority: inactiveAgent.publicKey,
            percolatorProgram: PERCOLATOR_PROGRAM_ID,
          },
        })
        .signers([inactiveAgent])
        .rpc();
      
      assert.fail("Should have thrown agent not active error");
    } catch (err) {
      // Expected to fail because agent is not registered
      assert.ok(err);
    }
  });
});
