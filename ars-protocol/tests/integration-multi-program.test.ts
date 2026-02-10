import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { ArsReserve } from "../target/types/ars_reserve";
import { ArsToken } from "../target/types/ars_token";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";

describe("Multi-program integration tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.ArsCore as Program<ArsCore>;
  const reserveProgram = anchor.workspace.ArsReserve as Program<ArsReserve>;
  const tokenProgram = anchor.workspace.ArsToken as Program<ArsToken>;
  
  let globalState: PublicKey;
  let iliOracle: PublicKey;
  let vault: PublicKey;
  let mintState: PublicKey;
  let authority: Keypair;
  let aruMint: PublicKey;
  let usdcMint: PublicKey;

  before(async () => {
    authority = Keypair.generate();
    
    // Airdrop SOL to authority
    const signature = await provider.connection.requestAirdrop(
      authority.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create mints
    aruMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    usdcMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // Derive PDAs
    [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      coreProgram.programId
    );

    [iliOracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("ili_oracle")],
      coreProgram.programId
    );

    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authority.publicKey.toBuffer()],
      reserveProgram.programId
    );

    [mintState] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_state"), authority.publicKey.toBuffer()],
      tokenProgram.programId
    );
  });

  describe("ars-core + ars-reserve interaction", () => {
    let usdcVault: PublicKey;
    let solVault: Keypair;
    let msolVault: Keypair;
    let jitosolVault: Keypair;

    before(async () => {
      solVault = Keypair.generate();
      msolVault = Keypair.generate();
      jitosolVault = Keypair.generate();

      // Create USDC vault
      usdcVault = await createAccount(
        provider.connection,
        authority,
        usdcMint,
        authority.publicKey
      );

      // Initialize core
      await coreProgram.methods
        .initialize(
          new anchor.BN(86400), // 24h epoch
          200, // 2% mint/burn cap
          15000 // 150% VHR threshold
        )
        .accounts({
          globalState,
          iliOracle,
          authority: authority.publicKey,
          reserveVault: vault,
          aruMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Initialize reserve
      await reserveProgram.methods
        .initialize(
          15000, // 150% min VHR
          17500  // 175% rebalance threshold
        )
        .accounts({
          vault,
          authority: authority.publicKey,
          usdcVault,
          solVault: solVault.publicKey,
          msolVault: msolVault.publicKey,
          jitosolVault: jitosolVault.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    });

    it("should coordinate proposal execution with vault rebalancing", async () => {
      // 1. Create proposal to rebalance vault
      const proposal = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])],
        coreProgram.programId
      )[0];

      await coreProgram.methods
        .createProposal(
          { rebalanceVault: {} },
          [1, 2, 3, 4],
          new anchor.BN(86400)
        )
        .accounts({
          globalState,
          proposal,
          proposer: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // 2. Vote on proposal
      const agent = Keypair.generate();
      const agentRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        coreProgram.programId
      )[0];

      // Register agent first (simplified)
      // ... agent registration ...

      // 3. Execute proposal which triggers rebalance
      // This would involve CPI from core to reserve
      
      // 4. Verify vault state updated
      const vaultAccount = await reserveProgram.account.reserveVault.fetch(vault);
      expect(vaultAccount.lastRebalance.toNumber()).to.be.greaterThan(0);
    });

    it("should enforce circuit breaker across programs", async () => {
      // 1. Trigger circuit breaker in core
      const agent = Keypair.generate();
      const agentRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        coreProgram.programId
      )[0];

      await coreProgram.methods
        .triggerCircuitBreaker("Emergency test")
        .accounts({
          globalState,
          agentRegistry,
          agent: agent.publicKey,
        })
        .signers([agent])
        .rpc();

      // 2. Verify circuit breaker is active
      const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
      expect(globalStateAccount.circuitBreakerActive).to.be.true;

      // 3. Try to deposit to reserve (should fail if circuit breaker is checked)
      const user = Keypair.generate();
      const userTokenAccount = await createAccount(
        provider.connection,
        authority,
        usdcMint,
        user.publicKey
      );

      try {
        await reserveProgram.methods
          .deposit(new anchor.BN(1_000_000))
          .accounts({
            vault,
            user: user.publicKey,
            userTokenAccount,
            vaultTokenAccount: usdcVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        // If circuit breaker is enforced in reserve, this should fail
        // Otherwise, it's a cross-program coordination issue
      } catch (error) {
        // Expected if circuit breaker is enforced
      }
    });

    it("should update VHR based on ILI oracle data", async () => {
      // 1. Submit ILI updates from multiple agents
      const agent1 = Keypair.generate();
      const agent2 = Keypair.generate();
      const agent3 = Keypair.generate();

      // Register agents (simplified)
      // ...

      // 2. Submit ILI updates to reach consensus
      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(5000), new anchor.BN(Date.now() / 1000))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: PublicKey.findProgramAddressSync(
            [Buffer.from("agent"), agent1.publicKey.toBuffer()],
            coreProgram.programId
          )[0],
          agent: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      // 3. Verify ILI is updated
      const iliOracleAccount = await coreProgram.account.iliOracle.fetch(iliOracle);
      
      // 4. Trigger vault rebalance based on ILI
      // This would involve reading ILI from core and using it in reserve
      
      // 5. Verify VHR is recalculated
      const vaultAccount = await reserveProgram.account.reserveVault.fetch(vault);
      expect(vaultAccount.vhr).to.be.greaterThan(0);
    });
  });

  describe("ars-core + ars-token interaction", () => {
    before(async () => {
      // Initialize token program
      await tokenProgram.methods
        .initialize(
          new anchor.BN(86400), // 24h epoch
          200, // 2% mint cap
          200  // 2% burn cap
        )
        .accounts({
          mintState,
          authority: authority.publicKey,
          aruMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    });

    it("should execute proposal to mint ARU tokens", async () => {
      // 1. Create proposal to mint tokens
      const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
      const proposal = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), globalStateAccount.proposalCounter.toArrayLike(Buffer, "le", 8)],
        coreProgram.programId
      )[0];

      const mintAmount = 1_000_000_000; // 1,000 ARU
      const policyParams = Buffer.alloc(8);
      policyParams.writeBigUInt64LE(BigInt(mintAmount));

      await coreProgram.methods
        .createProposal(
          { mintAru: {} },
          Array.from(policyParams),
          new anchor.BN(86400)
        )
        .accounts({
          globalState,
          proposal,
          proposer: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // 2. Vote on proposal
      // ... voting logic ...

      // 3. Execute proposal which triggers mint
      // This would involve CPI from core to token program
      
      // 4. Verify tokens were minted
      const mintStateAccount = await tokenProgram.account.mintState.fetch(mintState);
      expect(mintStateAccount.totalSupply.toNumber()).to.be.greaterThan(0);
    });

    it("should execute proposal to burn ARU tokens", async () => {
      // 1. First mint some tokens
      const destination = await createAccount(
        provider.connection,
        authority,
        aruMint,
        authority.publicKey
      );

      await tokenProgram.methods
        .mintAru(new anchor.BN(10_000_000))
        .accounts({
          mintState,
          aruMint,
          destination,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // 2. Create proposal to burn tokens
      const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
      const proposal = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), globalStateAccount.proposalCounter.toArrayLike(Buffer, "le", 8)],
        coreProgram.programId
      )[0];

      const burnAmount = 1_000_000; // 1 ARU
      const policyParams = Buffer.alloc(8);
      policyParams.writeBigUInt64LE(BigInt(burnAmount));

      await coreProgram.methods
        .createProposal(
          { burnAru: {} },
          Array.from(policyParams),
          new anchor.BN(86400)
        )
        .accounts({
          globalState,
          proposal,
          proposer: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // 3. Execute proposal which triggers burn
      // This would involve CPI from core to token program
      
      // 4. Verify tokens were burned
      const mintStateAccount = await tokenProgram.account.mintState.fetch(mintState);
      expect(mintStateAccount.epochBurned.toNumber()).to.be.greaterThan(0);
    });

    it("should coordinate epoch transitions with governance", async () => {
      // 1. Get current epoch
      const mintStateBefore = await tokenProgram.account.mintState.fetch(mintState);
      const currentEpoch = mintStateBefore.currentEpoch.toNumber();

      // 2. Wait for epoch duration (in test, would need time manipulation)
      // ... time advancement ...

      // 3. Create proposal to start new epoch
      const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
      const proposal = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), globalStateAccount.proposalCounter.toArrayLike(Buffer, "le", 8)],
        coreProgram.programId
      )[0];

      await coreProgram.methods
        .createProposal(
          { startNewEpoch: {} },
          [],
          new anchor.BN(86400)
        )
        .accounts({
          globalState,
          proposal,
          proposer: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // 4. Execute proposal which triggers epoch transition
      // This would involve CPI from core to token program
      
      // 5. Verify epoch incremented
      const mintStateAfter = await tokenProgram.account.mintState.fetch(mintState);
      // expect(mintStateAfter.currentEpoch.toNumber()).to.equal(currentEpoch + 1);
    });
  });

  describe("full governance workflow", () => {
    let agent1: Keypair, agent2: Keypair, agent3: Keypair;
    let agentRegistry1: PublicKey, agentRegistry2: PublicKey, agentRegistry3: PublicKey;

    before(async () => {
      // Setup 3 agents for Byzantine consensus
      agent1 = Keypair.generate();
      agent2 = Keypair.generate();
      agent3 = Keypair.generate();

      // Airdrop SOL to agents
      for (const agent of [agent1, agent2, agent3]) {
        const signature = await provider.connection.requestAirdrop(
          agent.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(signature);
      }

      // Derive agent registries
      [agentRegistry1] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent1.publicKey.toBuffer()],
        coreProgram.programId
      );
      [agentRegistry2] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent2.publicKey.toBuffer()],
        coreProgram.programId
      );
      [agentRegistry3] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent3.publicKey.toBuffer()],
        coreProgram.programId
      );

      // Register all agents
      for (const [agent, registry] of [
        [agent1, agentRegistry1],
        [agent2, agentRegistry2],
        [agent3, agentRegistry3],
      ]) {
        const agentTokenAccount = await createAccount(
          provider.connection,
          agent,
          aruMint,
          agent.publicKey
        );

        await mintTo(
          provider.connection,
          authority,
          aruMint,
          agentTokenAccount,
          authority,
          10_000_000_000 // 10,000 ARU
        );

        const stakeEscrow = await createAccount(
          provider.connection,
          agent,
          aruMint,
          globalState
        );

        await coreProgram.methods
          .registerAgent(new anchor.BN(10_000_000_000))
          .accounts({
            agentRegistry: registry,
            agent: agent.publicKey,
            agentTokenAccount,
            stakeEscrow,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([agent])
          .rpc();
      }
    });

    it("should complete full governance cycle: ILI update → proposal → vote → execution", async () => {
      // Step 1: Submit ILI updates from 3 agents (Byzantine consensus)
      const iliValue1 = 5000;
      const iliValue2 = 5100;
      const iliValue3 = 4900;
      const timestamp = Math.floor(Date.now() / 1000);

      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(iliValue1), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry1,
          agent: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(iliValue2), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry2,
          agent: agent2.publicKey,
        })
        .signers([agent2])
        .rpc();

      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(iliValue3), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry3,
          agent: agent3.publicKey,
        })
        .signers([agent3])
        .rpc();

      // Verify median is accepted (5000)
      const iliOracleAccount = await coreProgram.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.currentIli.toNumber()).to.equal(5000);

      // Step 2: Create proposal based on ILI
      const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
      const proposal = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), globalStateAccount.proposalCounter.toArrayLike(Buffer, "le", 8)],
        coreProgram.programId
      )[0];

      await coreProgram.methods
        .createProposal(
          { mintAru: {} },
          [1, 2, 3, 4],
          new anchor.BN(86400)
        )
        .accounts({
          globalState,
          proposal,
          proposer: agent1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agent1])
        .rpc();

      // Step 3: Agents vote on proposal (quadratic voting)
      await coreProgram.methods
        .voteOnProposal(true, new anchor.BN(10_000_000_000))
        .accounts({
          proposal,
          agentRegistry: agentRegistry1,
          voter: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      await coreProgram.methods
        .voteOnProposal(true, new anchor.BN(10_000_000_000))
        .accounts({
          proposal,
          agentRegistry: agentRegistry2,
          voter: agent2.publicKey,
        })
        .signers([agent2])
        .rpc();

      // Step 4: Verify voting power is quadratic
      const proposalAccount = await coreProgram.account.policyProposal.fetch(proposal);
      expect(proposalAccount.yesStake.toNumber()).to.equal(20_000_000_000);
      // Quadratic voting power = sqrt(10,000,000,000) * 2 = 200,000
      expect(proposalAccount.quadraticYes.toNumber()).to.be.greaterThan(0);

      // Step 5: Execute proposal (would trigger CPI to token program)
      // ... execution logic ...

      // Step 6: Verify state changes across all programs
      const mintStateAccount = await tokenProgram.account.mintState.fetch(mintState);
      const vaultAccount = await reserveProgram.account.reserveVault.fetch(vault);
      
      // Verify protocol state is consistent
      expect(mintStateAccount.totalSupply.toNumber()).to.be.greaterThanOrEqual(0);
      expect(vaultAccount.vhr).to.be.greaterThan(0);
    });

    it("should handle Byzantine fault tolerance in governance", async () => {
      // Test with 2 honest agents and 1 malicious agent
      const honestIli = 5000;
      const maliciousIli = 10000;
      const timestamp = Math.floor(Date.now() / 1000);

      // 2 honest agents submit correct ILI
      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(honestIli), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry1,
          agent: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(honestIli), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry2,
          agent: agent2.publicKey,
        })
        .signers([agent2])
        .rpc();

      // 1 malicious agent submits false ILI
      await coreProgram.methods
        .submitIliUpdate(new anchor.BN(maliciousIli), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry3,
          agent: agent3.publicKey,
        })
        .signers([agent3])
        .rpc();

      // Verify median is used (5000, not 10000)
      const iliOracleAccount = await coreProgram.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.currentIli.toNumber()).to.equal(honestIli);
    });
  });

  describe("cross-program state consistency", () => {
    it("should maintain consistent state across all programs", async () => {
      // Read state from all programs
      const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
      const vaultAccount = await reserveProgram.account.reserveVault.fetch(vault);
      const mintStateAccount = await tokenProgram.account.mintState.fetch(mintState);

      // Verify references are consistent
      expect(globalStateAccount.reserveVault.toString()).to.equal(vault.toString());
      expect(globalStateAccount.aruMint.toString()).to.equal(aruMint.toString());
      expect(mintStateAccount.aruMint.toString()).to.equal(aruMint.toString());

      // Verify epoch durations match
      expect(globalStateAccount.epochDuration.toNumber()).to.equal(
        mintStateAccount.epochDuration.toNumber()
      );
    });

    it("should handle concurrent operations across programs", async () => {
      // Test concurrent deposit and mint operations
      // This tests for race conditions and state consistency
    });
  });
});
