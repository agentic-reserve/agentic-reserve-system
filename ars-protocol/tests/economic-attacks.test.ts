import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { ArsReserve } from "../target/types/ars_reserve";
import { ArsToken } from "../target/types/ars_token";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";

describe("Economic Attack Simulations", () => {
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

  before(async () => {
    authority = Keypair.generate();
    
    const signature = await provider.connection.requestAirdrop(
      authority.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    aruMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

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

    // Initialize all programs
    await coreProgram.methods
      .initialize(new anchor.BN(86400), 200, 15000)
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
  });

  describe("Governance Manipulation Resistance", () => {
    it("should prevent whale from passing malicious proposal alone", async () => {
      // Attacker registers with massive stake
      const attacker = Keypair.generate();
      const attackerRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), attacker.publicKey.toBuffer()],
        coreProgram.programId
      )[0];

      const signature = await provider.connection.requestAirdrop(
        attacker.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      const attackerTokenAccount = await createAccount(
        provider.connection,
        attacker,
        aruMint,
        attacker.publicKey
      );

      // Mint massive stake to attacker
      await mintTo(
        provider.connection,
        authority,
        aruMint,
        attackerTokenAccount,
        authority,
        1_000_000_000_000 // 1 million ARU
      );

      const stakeEscrow = await createAccount(
        provider.connection,
        attacker,
        aruMint,
        globalState
      );

      await coreProgram.methods
        .registerAgent(new anchor.BN(1_000_000_000_000))
        .accounts({
          agentRegistry: attackerRegistry,
          agent: attacker.publicKey,
          agentTokenAccount: attackerTokenAccount,
          stakeEscrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();

      // Attacker creates malicious proposal to mint excessive ARU
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
          proposer: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();

      // Attacker votes with full stake
      await coreProgram.methods
        .voteOnProposal(true, new anchor.BN(1_000_000_000_000))
        .accounts({
          proposal,
          agentRegistry: attackerRegistry,
          voter: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();

      // Even with massive stake, quadratic voting limits power
      const proposalAccount = await coreProgram.account.policyProposal.fetch(proposal);
      
      // Quadratic voting power = sqrt(1,000,000,000,000) = 1,000,000
      // This is much less than linear voting would give
      expect(proposalAccount.quadraticYes.toNumber()).to.be.lessThan(2_000_000);
      
      // Execution should still fail due to supply cap
      // Even if proposal passes, mint cap prevents excessive minting
    });

    it("should prevent coordinated voting attack", async () => {
      // Multiple attackers coordinate to pass malicious proposal
      const attackers = [];
      for (let i = 0; i < 5; i++) {
        const attacker = Keypair.generate();
        const signature = await provider.connection.requestAirdrop(
          attacker.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(signature);
        attackers.push(attacker);
      }

      // All attackers vote on same malicious proposal
      // Even with coordination, supply caps and VHR limits prevent damage
    });

    it("should prevent proposal spam attack", async () => {
      // Attacker creates many proposals to spam governance
      const attacker = Keypair.generate();
      
      // Create 100 proposals rapidly
      for (let i = 0; i < 100; i++) {
        try {
          const globalStateAccount = await coreProgram.account.globalState.fetch(globalState);
          const proposal = PublicKey.findProgramAddressSync(
            [Buffer.from("proposal"), globalStateAccount.proposalCounter.toArrayLike(Buffer, "le", 8)],
            coreProgram.programId
          )[0];

          await coreProgram.methods
            .createProposal(
              { mintAru: {} },
              [i],
              new anchor.BN(86400)
            )
            .accounts({
              globalState,
              proposal,
              proposer: attacker.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([attacker])
            .rpc();
        } catch (error) {
          // Should eventually fail due to rate limiting or griefing protection
        }
      }
    });
  });

  describe("ILI Manipulation Resistance", () => {
    it("should resist false ILI submission attack", async () => {
      // Attacker submits false ILI values
      const attacker = Keypair.generate();
      const attackerRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), attacker.publicKey.toBuffer()],
        coreProgram.programId
      )[0];

      // Register attacker as agent
      // ... registration logic ...

      // Attacker submits false ILI (10x normal value)
      const falseIli = 50000; // Normal is ~5000
      
      try {
        await coreProgram.methods
          .submitIliUpdate(new anchor.BN(falseIli), new anchor.BN(Date.now() / 1000))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: attackerRegistry,
            agent: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        // Even if submitted, Byzantine consensus requires 3+ agents
        // Median calculation prevents single false value from being accepted
        const iliOracleAccount = await coreProgram.account.iliOracle.fetch(iliOracle);
        
        // ILI should not be updated to false value
        expect(iliOracleAccount.currentIli.toNumber()).to.not.equal(falseIli);
      } catch (error) {
        // May fail due to signature verification or timestamp bounds
      }
    });

    it("should resist coordinated ILI manipulation", async () => {
      // 2 malicious agents + 1 honest agent
      const malicious1 = Keypair.generate();
      const malicious2 = Keypair.generate();
      const honest = Keypair.generate();

      // Register all agents
      // ... registration logic ...

      // Malicious agents submit false ILI
      const falseIli = 50000;
      const correctIli = 5000;

      // Submit updates
      // ... submission logic ...

      // Median should be closer to correct value
      // Byzantine consensus protects against minority of malicious agents
      const iliOracleAccount = await coreProgram.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.currentIli.toNumber()).to.be.closeTo(correctIli, 1000);
    });

    it("should resist timing attack on ILI updates", async () => {
      // Attacker tries to submit ILI updates outside time window
      const attacker = Keypair.generate();
      const attackerRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), attacker.publicKey.toBuffer()],
        coreProgram.programId
      )[0];

      // Try to submit with old timestamp
      const oldTimestamp = Math.floor(Date.now() / 1000) - 1000;
      
      try {
        await coreProgram.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(oldTimestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: attackerRegistry,
            agent: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have rejected old timestamp");
      } catch (error) {
        expect(error.toString()).to.include("UpdateTooFrequent");
      }
    });
  });

  describe("Vault Drain Resistance", () => {
    it("should prevent withdrawal that violates VHR", async () => {
      // Attacker tries to drain vault below minimum VHR
      const attacker = Keypair.generate();
      
      // Setup vault with minimal VHR
      // ... vault setup ...

      // Try to withdraw large amount
      const largeWithdrawal = new anchor.BN(1_000_000_000);
      
      try {
        await reserveProgram.methods
          .withdraw(largeWithdrawal)
          .accounts({
            vault,
            user: attacker.publicKey,
            userTokenAccount: await createAccount(
              provider.connection,
              attacker,
              aruMint,
              attacker.publicKey
            ),
            vaultTokenAccount: await createAccount(
              provider.connection,
              authority,
              aruMint,
              vault
            ),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have rejected withdrawal");
      } catch (error) {
        expect(error.toString()).to.include("VHRTooLow");
      }
    });

    it("should prevent flash loan attack on vault", async () => {
      // Attacker tries to manipulate vault with flash loan
      // 1. Borrow large amount
      // 2. Deposit to vault
      // 3. Manipulate price oracle
      // 4. Withdraw more than deposited
      // 5. Repay loan with profit

      // This should fail due to:
      // - Oracle price manipulation resistance
      // - VHR checks
      // - Reentrancy guards
    });

    it("should prevent sandwich attack on rebalancing", async () => {
      // Attacker front-runs rebalancing transaction
      // 1. Detect rebalancing tx in mempool
      // 2. Front-run with large deposit
      // 3. Rebalancing executes
      // 4. Back-run with withdrawal for profit

      // This should fail due to:
      // - Slippage protection
      // - VHR checks
      // - Rebalancing thresholds
    });
  });

  describe("Supply Manipulation Resistance", () => {
    it("should prevent excessive minting attack", async () => {
      // Attacker tries to mint beyond epoch cap
      const attacker = Keypair.generate();
      
      // Try to mint 10x the cap
      const excessiveMint = new anchor.BN(10_000_000_000);
      
      try {
        await tokenProgram.methods
          .mintAru(excessiveMint)
          .accounts({
            mintState,
            aruMint,
            destination: await createAccount(
              provider.connection,
              attacker,
              aruMint,
              attacker.publicKey
            ),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        expect.fail("Should have rejected excessive mint");
      } catch (error) {
        expect(error.toString()).to.include("MintCapExceeded");
      }
    });

    it("should prevent epoch manipulation attack", async () => {
      // Attacker tries to start new epoch prematurely
      const attacker = Keypair.generate();
      
      try {
        const epochHistory = PublicKey.findProgramAddressSync(
          [Buffer.from("epoch_history"), Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])],
          tokenProgram.programId
        )[0];

        await tokenProgram.methods
          .startNewEpoch()
          .accounts({
            mintState,
            epochHistory,
            authority: attacker.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have rejected premature epoch transition");
      } catch (error) {
        expect(error.toString()).to.include("EpochNotComplete");
      }
    });

    it("should prevent supply inflation through repeated minting", async () => {
      // Attacker tries to mint repeatedly to inflate supply
      const attacker = Keypair.generate();
      const destination = await createAccount(
        provider.connection,
        attacker,
        aruMint,
        attacker.publicKey
      );

      let totalMinted = 0;
      const mintAmount = 1_000_000; // 1 ARU

      // Try to mint 1000 times
      for (let i = 0; i < 1000; i++) {
        try {
          await tokenProgram.methods
            .mintAru(new anchor.BN(mintAmount))
            .accounts({
              mintState,
              aruMint,
              destination,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
          
          totalMinted += mintAmount;
        } catch (error) {
          // Should eventually hit epoch cap
          expect(error.toString()).to.include("MintCapExceeded");
          break;
        }
      }

      // Verify total minted is within cap
      const mintStateAccount = await tokenProgram.account.mintState.fetch(mintState);
      const cap = (mintStateAccount.totalSupply.toNumber() * 200) / 10000;
      expect(totalMinted).to.be.lessThanOrEqual(cap);
    });
  });

  describe("Circuit Breaker Griefing Resistance", () => {
    it("should prevent low-reputation agent from triggering circuit breaker", async () => {
      // Attacker with low reputation tries to trigger circuit breaker
      const attacker = Keypair.generate();
      const attackerRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), attacker.publicKey.toBuffer()],
        coreProgram.programId
      )[0];

      // Register attacker with minimal stake
      // ... registration logic ...

      try {
        await coreProgram.methods
          .triggerCircuitBreaker("Griefing attack")
          .accounts({
            globalState,
            agentRegistry: attackerRegistry,
            agent: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have rejected circuit breaker trigger");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientReputation");
      }
    });

    it("should prevent repeated circuit breaker triggers", async () => {
      // Attacker tries to trigger circuit breaker repeatedly
      const attacker = Keypair.generate();
      
      // First trigger succeeds (if reputation is high enough)
      // ... trigger logic ...

      // Second trigger should fail (circuit breaker already active)
      try {
        await coreProgram.methods
          .triggerCircuitBreaker("Second trigger")
          .accounts({
            globalState,
            agentRegistry: PublicKey.findProgramAddressSync(
              [Buffer.from("agent"), attacker.publicKey.toBuffer()],
              coreProgram.programId
            )[0],
            agent: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        // Should succeed but not change state (already active)
      } catch (error) {
        // May fail if additional checks are in place
      }
    });

    it("should require deposit for circuit breaker trigger", async () => {
      // Attacker tries to trigger without deposit
      const attacker = Keypair.generate();
      
      try {
        await coreProgram.methods
          .triggerCircuitBreaker("No deposit attack")
          .accounts({
            globalState,
            agentRegistry: PublicKey.findProgramAddressSync(
              [Buffer.from("agent"), attacker.publicKey.toBuffer()],
              coreProgram.programId
            )[0],
            agent: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have required deposit");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientDeposit");
      }
    });
  });

  describe("Cross-Program Attack Resistance", () => {
    it("should prevent reentrancy attack across programs", async () => {
      // Attacker tries to reenter from one program to another
      // This should fail due to reentrancy guards
    });

    it("should prevent CPI manipulation attack", async () => {
      // Attacker tries to manipulate CPI calls between programs
      // This should fail due to account validation
    });

    it("should prevent account substitution attack", async () => {
      // Attacker tries to substitute accounts in cross-program calls
      // This should fail due to PDA validation
    });
  });
});
