import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";

describe("ars-core unit tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArsCore as Program<ArsCore>;
  
  let globalState: PublicKey;
  let iliOracle: PublicKey;
  let authority: Keypair;
  let aruMint: PublicKey;
  let reserveVault: Keypair;

  before(async () => {
    authority = Keypair.generate();
    reserveVault = Keypair.generate();
    
    // Airdrop SOL to authority
    const signature = await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create ARU mint
    aruMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // Derive PDAs
    [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    [iliOracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("ili_oracle")],
      program.programId
    );
  });

  describe("initialize", () => {
    it("should initialize protocol with valid parameters", async () => {
      const epochDuration = new anchor.BN(86400); // 24 hours
      const mintBurnCapBps = 200; // 2%
      const vhrThreshold = 15000; // 150%

      await program.methods
        .initialize(epochDuration, mintBurnCapBps, vhrThreshold)
        .accounts({
          globalState,
          iliOracle,
          authority: authority.publicKey,
          reserveVault: reserveVault.publicKey,
          aruMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const globalStateAccount = await program.account.globalState.fetch(globalState);
      expect(globalStateAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(globalStateAccount.epochDuration.toNumber()).to.equal(86400);
      expect(globalStateAccount.mintBurnCapBps).to.equal(200);
      expect(globalStateAccount.vhrThreshold).to.equal(15000);
      expect(globalStateAccount.circuitBreakerActive).to.be.false;
    });

    it("should fail with invalid epoch duration", async () => {
      const invalidEpochDuration = new anchor.BN(0);
      
      try {
        await program.methods
          .initialize(invalidEpochDuration, 200, 15000)
          .accounts({
            globalState,
            iliOracle,
            authority: authority.publicKey,
            reserveVault: reserveVault.publicKey,
            aruMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidEpochDuration");
      }
    });
  });

  describe("admin transfer", () => {
    let newAuthority: Keypair;

    before(() => {
      newAuthority = Keypair.generate();
    });

    it("should initiate admin transfer with 48h timelock", async () => {
      await program.methods
        .initiateAdminTransfer(newAuthority.publicKey)
        .accounts({
          globalState,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const globalStateAccount = await program.account.globalState.fetch(globalState);
      expect(globalStateAccount.pendingAuthority.toString()).to.equal(newAuthority.publicKey.toString());
      expect(globalStateAccount.transferTimelock.toNumber()).to.be.greaterThan(0);
    });

    it("should fail to execute transfer before timelock expires", async () => {
      try {
        await program.methods
          .executeAdminTransfer()
          .accounts({
            globalState,
          })
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("TimelockNotExpired");
      }
    });

    it("should fail with unauthorized signer", async () => {
      const unauthorizedSigner = Keypair.generate();
      
      try {
        await program.methods
          .initiateAdminTransfer(newAuthority.publicKey)
          .accounts({
            globalState,
            authority: unauthorizedSigner.publicKey,
          })
          .signers([unauthorizedSigner])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("Unauthorized");
      }
    });
  });

  describe("agent registration", () => {
    let agent: Keypair;
    let agentRegistry: PublicKey;
    let agentTokenAccount: PublicKey;
    let stakeEscrow: PublicKey;

    before(async () => {
      agent = Keypair.generate();
      
      // Airdrop SOL to agent
      const signature = await provider.connection.requestAirdrop(
        agent.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      // Create agent token account and mint tokens
      agentTokenAccount = await createAccount(
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

      // Create stake escrow
      stakeEscrow = await createAccount(
        provider.connection,
        agent,
        aruMint,
        globalState
      );

      [agentRegistry] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should register agent with valid stake (Bronze tier)", async () => {
      const stakeAmount = new anchor.BN(100_000_000); // 100 ARU

      await program.methods
        .registerAgent(stakeAmount)
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

      const agentRegistryAccount = await program.account.agentRegistry.fetch(agentRegistry);
      expect(agentRegistryAccount.agentPubkey.toString()).to.equal(agent.publicKey.toString());
      expect(agentRegistryAccount.stakeAmount.toNumber()).to.equal(100_000_000);
      expect(agentRegistryAccount.agentTier).to.deep.equal({ bronze: {} });
      expect(agentRegistryAccount.isActive).to.be.true;
    });

    it("should fail with insufficient stake", async () => {
      const insufficientStake = new anchor.BN(50_000_000); // 50 ARU (below minimum)
      
      try {
        await program.methods
          .registerAgent(insufficientStake)
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
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientStake");
      }
    });
  });

  describe("ILI updates", () => {
    let agent1: Keypair, agent2: Keypair, agent3: Keypair;
    let agentRegistry1: PublicKey, agentRegistry2: PublicKey, agentRegistry3: PublicKey;

    before(async () => {
      // Setup 3 agents for Byzantine consensus testing
      agent1 = Keypair.generate();
      agent2 = Keypair.generate();
      agent3 = Keypair.generate();

      [agentRegistry1] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent1.publicKey.toBuffer()],
        program.programId
      );
      [agentRegistry2] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent2.publicKey.toBuffer()],
        program.programId
      );
      [agentRegistry3] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent3.publicKey.toBuffer()],
        program.programId
      );

      // Register all agents (simplified - would need full setup)
    });

    it("should accept ILI update from active agent", async () => {
      const iliValue = new anchor.BN(5000);
      const timestamp = new anchor.BN(Date.now() / 1000);

      await program.methods
        .submitIliUpdate(iliValue, timestamp)
        .accounts({
          iliOracle,
          globalState,
          agentRegistry: agentRegistry1,
          agent: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      const iliOracleAccount = await program.account.iliOracle.fetch(iliOracle);
      expect(iliOracleAccount.pendingUpdates.length).to.be.greaterThan(0);
    });

    it("should fail when circuit breaker is active", async () => {
      // First trigger circuit breaker
      await program.methods
        .triggerCircuitBreaker("Test emergency")
        .accounts({
          globalState,
          agentRegistry: agentRegistry1,
          agent: agent1.publicKey,
        })
        .signers([agent1])
        .rpc();

      // Try to submit ILI update
      try {
        await program.methods
          .submitIliUpdate(new anchor.BN(5000), new anchor.BN(Date.now() / 1000))
          .accounts({
            iliOracle,
            globalState,
            agentRegistry: agentRegistry1,
            agent: agent1.publicKey,
          })
          .signers([agent1])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("CircuitBreakerActive");
      }
    });
  });

  describe("proposal creation and voting", () => {
    let proposer: Keypair;
    let proposerRegistry: PublicKey;
    let proposal: PublicKey;

    before(async () => {
      proposer = Keypair.generate();
      
      [proposerRegistry] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), proposer.publicKey.toBuffer()],
        program.programId
      );

      const globalStateAccount = await program.account.globalState.fetch(globalState);
      [proposal] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), globalStateAccount.proposalCounter.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
    });

    it("should create proposal with valid parameters", async () => {
      const policyType = { mintAru: {} };
      const policyParams = Buffer.from([1, 2, 3, 4]);
      const votingPeriod = new anchor.BN(86400); // 24 hours

      await program.methods
        .createProposal(policyType, Array.from(policyParams), votingPeriod)
        .accounts({
          globalState,
          proposal,
          proposer: proposer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([proposer])
        .rpc();

      const proposalAccount = await program.account.policyProposal.fetch(proposal);
      expect(proposalAccount.proposer.toString()).to.equal(proposer.publicKey.toString());
      expect(proposalAccount.status).to.deep.equal({ active: {} });
    });

    it("should fail with invalid voting period", async () => {
      const invalidVotingPeriod = new anchor.BN(0);
      
      try {
        await program.methods
          .createProposal({ mintAru: {} }, [1, 2, 3], invalidVotingPeriod)
          .accounts({
            globalState,
            proposal,
            proposer: proposer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([proposer])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidVotingPeriod");
      }
    });

    it("should cast vote with quadratic voting power", async () => {
      const stakeAmount = new anchor.BN(10_000_000_000); // 10,000 ARU
      const voteYes = true;

      await program.methods
        .voteOnProposal(voteYes, stakeAmount)
        .accounts({
          proposal,
          agentRegistry: proposerRegistry,
          voter: proposer.publicKey,
        })
        .signers([proposer])
        .rpc();

      const proposalAccount = await program.account.policyProposal.fetch(proposal);
      expect(proposalAccount.yesStake.toNumber()).to.equal(10_000_000_000);
      // Quadratic voting power = sqrt(10,000,000,000) = 100,000
      expect(proposalAccount.quadraticYes.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("circuit breaker", () => {
    let agent: Keypair;
    let agentRegistry: PublicKey;

    before(async () => {
      agent = Keypair.generate();
      
      [agentRegistry] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should trigger circuit breaker with high reputation agent", async () => {
      const reason = "Emergency detected";

      await program.methods
        .triggerCircuitBreaker(reason)
        .accounts({
          globalState,
          agentRegistry,
          agent: agent.publicKey,
        })
        .signers([agent])
        .rpc();

      const globalStateAccount = await program.account.globalState.fetch(globalState);
      expect(globalStateAccount.circuitBreakerActive).to.be.true;
      expect(globalStateAccount.circuitBreakerTimelock.toNumber()).to.be.greaterThan(0);
    });

    it("should fail with low reputation agent", async () => {
      // Create agent with low reputation
      const lowRepAgent = Keypair.generate();
      const lowRepRegistry = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), lowRepAgent.publicKey.toBuffer()],
        program.programId
      )[0];

      try {
        await program.methods
          .triggerCircuitBreaker("Test")
          .accounts({
            globalState,
            agentRegistry: lowRepRegistry,
            agent: lowRepAgent.publicKey,
          })
          .signers([lowRepAgent])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientReputation");
      }
    });
  });

  describe("slashing", () => {
    let agent: Keypair;
    let agentRegistry: PublicKey;

    before(async () => {
      agent = Keypair.generate();
      
      [agentRegistry] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should slash agent for malicious behavior", async () => {
      const slashAmount = new anchor.BN(1_000_000); // 1 ARU
      const reason = "Malicious ILI submission";

      await program.methods
        .slashAgent(slashAmount, reason)
        .accounts({
          globalState,
          agentRegistry,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const agentRegistryAccount = await program.account.agentRegistry.fetch(agentRegistry);
      expect(agentRegistryAccount.slashedAmount.toNumber()).to.equal(1_000_000);
      expect(agentRegistryAccount.reputationScore).to.be.lessThan(0);
    });

    it("should fail with unauthorized signer", async () => {
      const unauthorized = Keypair.generate();
      
      try {
        await program.methods
          .slashAgent(new anchor.BN(1_000_000), "Test")
          .accounts({
            globalState,
            agentRegistry,
            authority: unauthorized.publicKey,
          })
          .signers([unauthorized])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("Unauthorized");
      }
    });

    it("should fail when slash amount exceeds stake", async () => {
      const excessiveSlash = new anchor.BN(1_000_000_000_000); // 1 million ARU
      
      try {
        await program.methods
          .slashAgent(excessiveSlash, "Test")
          .accounts({
            globalState,
            agentRegistry,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("SlashAmountTooHigh");
      }
    });
  });
});
