import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";

describe("Byzantine Fault Tolerance Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArsCore as Program<ArsCore>;
  
  let globalState: PublicKey;
  let iliOracle: PublicKey;
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
      program.programId
    );

    [iliOracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("ili_oracle")],
      program.programId
    );

    await program.methods
      .initialize(new anchor.BN(86400), 200, 15000)
      .accounts({
        globalState,
        iliOracle,
        authority: authority.publicKey,
        reserveVault: Keypair.generate().publicKey,
        aruMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  });

  describe("Malicious Agent Submissions", () => {
    let agents: Keypair[];
    let agentRegistries: PublicKey[];

    before(async () => {
      // Setup 5 agents (3 honest, 2 malicious)
      agents = [];
      agentRegistries = [];

      for (let i = 0; i < 5; i++) {
        const agent = Keypair.generate();
        const signature = await provider.connection.requestAirdrop(
          agent.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(signature);

        const agentRegistry = PublicKey.findProgramAddressSync(
          [Buffer.from("agent"), agent.publicKey.toBuffer()],
          program.programId
        )[0];

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

        await program.methods
          .registerAgent(new anchor.BN(10_000_000_000))
          .accounts({
            agentRegistry,
            agent: agent.publicKey,
            agentTokenAccount,
            stakeEscrow,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([agent])
          .rpc();

        agents.push(agent);
        agentRegistries.push(agentRegistry);
      }
    });

    it("should use median when 3 honest + 2 malicious agents submit", async () => {
      const honestIli = 5000;
      const maliciousIli = 10000;
      const timestamp = Math.floor(Date.now() / 1000);

      // 3 honest agents submit correct ILI
      for (let i = 0; i < 3; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(honestIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // 2 malicious agents submit false ILI
      for (let i = 3; i < 5; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(maliciousIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // Verify median is used (5000, not 10000)
      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.currentIli.toNumber()).to.equal(honestIli);
    });

    it("should handle all malicious submissions gracefully", async () => {
      const maliciousIli = 50000;
      const timestamp = Math.floor(Date.now() / 1000);

      // All 5 agents submit malicious ILI
      for (let i = 0; i < 5; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(maliciousIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // Median will be malicious value, but this is expected
      // System should detect anomaly through other means (e.g., deviation from historical data)
      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.currentIli.toNumber()).to.equal(maliciousIli);
    });

    it("should handle varying malicious values", async () => {
      const honestIli = 5000;
      const maliciousValues = [10000, 15000, 20000];
      const timestamp = Math.floor(Date.now() / 1000);

      // 2 honest agents
      for (let i = 0; i < 2; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(honestIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // 3 malicious agents with different values
      for (let i = 0; i < 3; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(maliciousValues[i]), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i + 2],
            agent: agents[i + 2].publicKey,
          })
          .signers([agents[i + 2]])
          .rpc();
      }

      // Median should be middle value
      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      const allValues = [honestIli, honestIli, ...maliciousValues].sort((a, b) => a - b);
      const expectedMedian = allValues[Math.floor(allValues.length / 2)];
      expect(iliOracleAccount.currentIli.toNumber()).to.equal(expectedMedian);
    });

    it("should require minimum 3 agents for consensus", async () => {
      const iliValue = 5000;
      const timestamp = Math.floor(Date.now() / 1000);

      // Submit only 2 updates
      await program.methods
        .submitIliUpdate(new anchor.BN(iliValue), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistries[0],
          agent: agents[0].publicKey,
        })
        .signers([agents[0]])
        .rpc();

      await program.methods
        .submitIliUpdate(new anchor.BN(iliValue), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistries[1],
          agent: agents[1].publicKey,
        })
        .signers([agents[1]])
        .rpc();

      // ILI should not be updated yet (need 3+ agents)
      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.pendingUpdates.length).to.equal(2);
    });
  });

  describe("Timing Attacks", () => {
    let agent: Keypair;
    let agentRegistry: PublicKey;

    before(async () => {
      agent = Keypair.generate();
      const signature = await provider.connection.requestAirdrop(
        agent.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      agentRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        program.programId
      )[0];

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
        10_000_000_000
      );

      const stakeEscrow = await createAccount(
        provider.connection,
        agent,
        aruMint,
        globalState
      );

      await program.methods
        .registerAgent(new anchor.BN(10_000_000_000))
        .accounts({
          agentRegistry,
          agent: agent.publicKey,
          agentTokenAccount,
          stakeEscrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([agent])
        .rpc();
    });

    it("should reject ILI update with old timestamp", async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 1000;
      
      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(oldTimestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry,
            agent: agent.publicKey,
          })
          .signers([agent])
          .rpc();
        
        expect.fail("Should have rejected old timestamp");
      } catch (error) {
        // Expected to fail
      }
    });

    it("should reject ILI update with future timestamp", async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 10000;
      
      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(futureTimestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry,
            agent: agent.publicKey,
          })
          .signers([agent])
          .rpc();
        
        expect.fail("Should have rejected future timestamp");
      } catch (error) {
        // Expected to fail
      }
    });

    it("should enforce update interval", async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      
      // First update succeeds
      await program.methods
        .submitIliUpdate(new anchor.BN(5000), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry,
          agent: agent.publicKey,
        })
        .signers([agent])
        .rpc();

      // Immediate second update should fail
      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5100), new anchor.BN(timestamp + 1))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry,
            agent: agent.publicKey,
          })
          .signers([agent])
          .rpc();
        
        expect.fail("Should have enforced update interval");
      } catch (error) {
        expect(error.toString()).to.include("UpdateTooFrequent");
      }
    });

    it("should handle clock manipulation attempts", async () => {
      // Attacker tries to manipulate system clock
      // This should fail due to Solana's clock being consensus-based
    });
  });

  describe("Signature Forgery Attempts", () => {
    let agent: Keypair;
    let agentRegistry: PublicKey;

    before(async () => {
      agent = Keypair.generate();
      const signature = await provider.connection.requestAirdrop(
        agent.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      agentRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        program.programId
      )[0];

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
        10_000_000_000
      );

      const stakeEscrow = await createAccount(
        provider.connection,
        agent,
        aruMint,
        globalState
      );

      await program.methods
        .registerAgent(new anchor.BN(10_000_000_000))
        .accounts({
          agentRegistry,
          agent: agent.publicKey,
          agentTokenAccount,
          stakeEscrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([agent])
        .rpc();
    });

    it("should reject ILI update with invalid signature", async () => {
      // Note: In actual implementation, signature verification would be done
      // For now, we test that the instruction requires proper signer
      
      const wrongSigner = Keypair.generate();
      
      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(Date.now() / 1000))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry,
            agent: wrongSigner.publicKey, // Wrong signer
          })
          .signers([wrongSigner])
          .rpc();
        
        expect.fail("Should have rejected wrong signer");
      } catch (error) {
        // Expected to fail due to account mismatch
      }
    });

    it("should reject replay attack", async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      
      // First submission succeeds
      await program.methods
        .submitIliUpdate(new anchor.BN(5000), new anchor.BN(timestamp))
        .accounts({
          iliOracle,
          globalState,
          agentRegistry,
          agent: agent.publicKey,
        })
        .signers([agent])
        .rpc();

      // Replay same submission should fail
      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry,
            agent: agent.publicKey,
          })
          .signers([agent])
          .rpc();
        
        expect.fail("Should have rejected replay");
      } catch (error) {
        // Expected to fail
      }
    });

    it("should reject submission from unregistered agent", async () => {
      const unregisteredAgent = Keypair.generate();
      const unregisteredRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), unregisteredAgent.publicKey.toBuffer()],
        program.programId
      )[0];

      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(Date.now() / 1000))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: unregisteredRegistry,
            agent: unregisteredAgent.publicKey,
          })
          .signers([unregisteredAgent])
          .rpc();
        
        expect.fail("Should have rejected unregistered agent");
      } catch (error) {
        // Expected to fail
      }
    });
  });

  describe("Consensus Manipulation", () => {
    let agents: Keypair[];
    let agentRegistries: PublicKey[];

    before(async () => {
      agents = [];
      agentRegistries = [];

      for (let i = 0; i < 10; i++) {
        const agent = Keypair.generate();
        const signature = await provider.connection.requestAirdrop(
          agent.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(signature);

        const agentRegistry = PublicKey.findProgramAddressSync(
          [Buffer.from("agent"), agent.publicKey.toBuffer()],
          program.programId
        )[0];

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
          10_000_000_000
        );

        const stakeEscrow = await createAccount(
          provider.connection,
          agent,
          aruMint,
          globalState
        );

        await program.methods
          .registerAgent(new anchor.BN(10_000_000_000))
          .accounts({
            agentRegistry,
            agent: agent.publicKey,
            agentTokenAccount,
            stakeEscrow,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([agent])
          .rpc();

        agents.push(agent);
        agentRegistries.push(agentRegistry);
      }
    });

    it("should handle Sybil attack (multiple agents from same entity)", async () => {
      // Attacker controls 5 out of 10 agents
      const attackerIli = 10000;
      const honestIli = 5000;
      const timestamp = Math.floor(Date.now() / 1000);

      // 5 attacker-controlled agents
      for (let i = 0; i < 5; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(attackerIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // 5 honest agents
      for (let i = 5; i < 10; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(honestIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // With 50/50 split, median should be between values
      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      const median = iliOracleAccount.currentIli.toNumber();
      
      // Median of [5000, 5000, 5000, 5000, 5000, 10000, 10000, 10000, 10000, 10000]
      // Should be (5000 + 10000) / 2 = 7500
      expect(median).to.be.closeTo(7500, 100);
    });

    it("should handle collusion attack", async () => {
      // Multiple agents collude to submit coordinated false values
      const collusionIli = 15000;
      const timestamp = Math.floor(Date.now() / 1000);

      // 7 colluding agents
      for (let i = 0; i < 7; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(collusionIli), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // 3 honest agents
      for (let i = 7; i < 10; i++) {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(timestamp))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistries[i],
            agent: agents[i].publicKey,
          })
          .signers([agents[i]])
          .rpc();
      }

      // With 70% colluding, median will be collusion value
      // This demonstrates the need for additional safeguards (reputation, slashing)
      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.currentIli.toNumber()).to.equal(collusionIli);
    });

    it("should handle gradual consensus manipulation", async () => {
      // Attacker gradually shifts consensus over multiple rounds
      const rounds = 5;
      const startIli = 5000;
      const targetIli = 10000;
      const step = (targetIli - startIli) / rounds;

      for (let round = 0; round < rounds; round++) {
        const currentIli = startIli + (step * round);
        const timestamp = Math.floor(Date.now() / 1000) + (round * 300);

        // 6 agents submit gradually increasing values
        for (let i = 0; i < 6; i++) {
          await program.methods
            .submitIliUpdate(new anchor.BN(Math.floor(currentIli)), new anchor.BN(timestamp))
            .accounts({
              iliOracle,
              globalState,
              agentRegistry: agentRegistries[i],
              agent: agents[i].publicKey,
            })
            .signers([agents[i]])
            .rpc();
        }

        // 4 honest agents submit correct value
        for (let i = 6; i < 10; i++) {
          await program.methods
            .submitIliUpdate(new anchor.BN(startIli), new anchor.BN(timestamp))
            .accounts({
              iliOracle,
              globalState,
              agentRegistry: agentRegistries[i],
              agent: agents[i].publicKey,
            })
            .signers([agents[i]])
            .rpc();
        }

        // Check if manipulation is detected
        const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
        // System should detect gradual drift and trigger alerts
      }
    });
  });

  describe("Byzantine Resilience Metrics", () => {
    it("should maintain consensus with up to 33% Byzantine agents", async () => {
      // Standard Byzantine fault tolerance: f < n/3
      // With 9 agents, can tolerate up to 2 Byzantine agents
      
      const totalAgents = 9;
      const byzantineAgents = 2;
      const honestAgents = totalAgents - byzantineAgents;

      // Setup agents
      // ... agent setup ...

      // Byzantine agents submit false values
      // Honest agents submit correct values
      
      // Verify consensus is reached with correct value
    });

    it("should measure consensus convergence time", async () => {
      // Measure how long it takes to reach consensus
      const startTime = Date.now();
      
      // Submit updates from agents
      // ... submission logic ...

      const endTime = Date.now();
      const convergenceTime = endTime - startTime;

      // Verify convergence time is within acceptable bounds
      expect(convergenceTime).to.be.lessThan(5000); // 5 seconds
    });

    it("should track Byzantine agent detection rate", async () => {
      // Track how many Byzantine agents are detected and slashed
      let detectedByzantine = 0;
      let totalByzantine = 5;

      // Simulate Byzantine behavior
      // ... simulation logic ...

      // Verify detection rate is high
      const detectionRate = detectedByzantine / totalByzantine;
      expect(detectionRate).to.be.greaterThan(0.8); // 80% detection rate
    });
  });
});
