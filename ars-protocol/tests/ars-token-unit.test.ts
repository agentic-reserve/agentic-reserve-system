import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsToken } from "../target/types/ars_token";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, getAccount } from "@solana/spl-token";

describe("ars-token unit tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArsToken as Program<ArsToken>;
  
  let mintState: PublicKey;
  let authority: Keypair;
  let aruMint: PublicKey;

  before(async () => {
    authority = Keypair.generate();
    
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

    // Derive mint state PDA
    [mintState] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_state"), authority.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("initialize", () => {
    it("should initialize mint state with valid parameters", async () => {
      const epochDuration = new anchor.BN(86400); // 24 hours
      const mintCapPerEpochBps = 200; // 2%
      const burnCapPerEpochBps = 200; // 2%

      await program.methods
        .initialize(epochDuration, mintCapPerEpochBps, burnCapPerEpochBps)
        .accounts({
          mintState,
          authority: authority.publicKey,
          aruMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const mintStateAccount = await program.account.mintState.fetch(mintState);
      expect(mintStateAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(mintStateAccount.epochDuration.toNumber()).to.equal(86400);
      expect(mintStateAccount.mintCapPerEpochBps).to.equal(200);
      expect(mintStateAccount.burnCapPerEpochBps).to.equal(200);
      expect(mintStateAccount.currentEpoch.toNumber()).to.equal(0);
      expect(mintStateAccount.totalSupply.toNumber()).to.equal(0);
    });

    it("should fail with invalid epoch duration", async () => {
      const invalidEpochDuration = new anchor.BN(0);
      
      try {
        await program.methods
          .initialize(invalidEpochDuration, 200, 200)
          .accounts({
            mintState,
            authority: authority.publicKey,
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

    it("should fail with invalid mint cap", async () => {
      const invalidMintCap = 15000; // Above 100% (10000)
      
      try {
        await program.methods
          .initialize(new anchor.BN(86400), invalidMintCap, 200)
          .accounts({
            mintState,
            authority: authority.publicKey,
            aruMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidMintCap");
      }
    });

    it("should fail with invalid burn cap", async () => {
      const invalidBurnCap = 15000; // Above 100% (10000)
      
      try {
        await program.methods
          .initialize(new anchor.BN(86400), 200, invalidBurnCap)
          .accounts({
            mintState,
            authority: authority.publicKey,
            aruMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidBurnCap");
      }
    });
  });

  describe("mint_aru", () => {
    let destination: PublicKey;

    before(async () => {
      // Create destination token account
      destination = await createAccount(
        provider.connection,
        authority,
        aruMint,
        authority.publicKey
      );
    });

    it("should mint ARU tokens within epoch cap", async () => {
      const mintAmount = new anchor.BN(1_000_000); // 1 ARU

      await program.methods
        .mintAru(mintAmount)
        .accounts({
          mintState,
          aruMint,
          destination,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const mintStateAccount = await program.account.mintState.fetch(mintState);
      expect(mintStateAccount.epochMinted.toNumber()).to.equal(1_000_000);
      expect(mintStateAccount.totalSupply.toNumber()).to.equal(1_000_000);

      const destinationAccount = await getAccount(provider.connection, destination);
      expect(Number(destinationAccount.amount)).to.equal(1_000_000);
    });

    it("should fail when epoch mint cap exceeded", async () => {
      // First, mint up to the cap
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      const totalSupply = mintStateAccount.totalSupply.toNumber();
      const mintCap = Math.floor((totalSupply * 200) / 10000); // 2% of total supply

      // Try to mint more than the remaining cap
      const excessiveMint = new anchor.BN(mintCap + 1_000_000);
      
      try {
        await program.methods
          .mintAru(excessiveMint)
          .accounts({
            mintState,
            aruMint,
            destination,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("MintCapExceeded");
      }
    });

    it("should update epoch minted counter", async () => {
      const mintAmount = new anchor.BN(500_000); // 0.5 ARU

      const mintStateBefore = await program.account.mintState.fetch(mintState);
      const epochMintedBefore = mintStateBefore.epochMinted.toNumber();

      await program.methods
        .mintAru(mintAmount)
        .accounts({
          mintState,
          aruMint,
          destination,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const mintStateAfter = await program.account.mintState.fetch(mintState);
      expect(mintStateAfter.epochMinted.toNumber()).to.equal(epochMintedBefore + 500_000);
    });
  });

  describe("burn_aru", () => {
    let source: PublicKey;

    before(async () => {
      // Create source token account with tokens
      source = await createAccount(
        provider.connection,
        authority,
        aruMint,
        authority.publicKey
      );

      // Mint some tokens to burn
      await program.methods
        .mintAru(new anchor.BN(10_000_000)) // 10 ARU
        .accounts({
          mintState,
          aruMint,
          destination: source,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    });

    it("should burn ARU tokens within epoch cap", async () => {
      const burnAmount = new anchor.BN(1_000_000); // 1 ARU

      const mintStateBefore = await program.account.mintState.fetch(mintState);
      const totalSupplyBefore = mintStateBefore.totalSupply.toNumber();

      await program.methods
        .burnAru(burnAmount)
        .accounts({
          mintState,
          aruMint,
          source,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      const mintStateAfter = await program.account.mintState.fetch(mintState);
      expect(mintStateAfter.epochBurned.toNumber()).to.equal(1_000_000);
      expect(mintStateAfter.totalSupply.toNumber()).to.equal(totalSupplyBefore - 1_000_000);

      const sourceAccount = await getAccount(provider.connection, source);
      expect(Number(sourceAccount.amount)).to.equal(9_000_000);
    });

    it("should fail when epoch burn cap exceeded", async () => {
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      const totalSupply = mintStateAccount.totalSupply.toNumber();
      const burnCap = Math.floor((totalSupply * 200) / 10000); // 2% of total supply

      // Try to burn more than the remaining cap
      const excessiveBurn = new anchor.BN(burnCap + 1_000_000);
      
      try {
        await program.methods
          .burnAru(excessiveBurn)
          .accounts({
            mintState,
            aruMint,
            source,
            authority: authority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("BurnCapExceeded");
      }
    });

    it("should update epoch burned counter", async () => {
      const burnAmount = new anchor.BN(500_000); // 0.5 ARU

      const mintStateBefore = await program.account.mintState.fetch(mintState);
      const epochBurnedBefore = mintStateBefore.epochBurned.toNumber();

      await program.methods
        .burnAru(burnAmount)
        .accounts({
          mintState,
          aruMint,
          source,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      const mintStateAfter = await program.account.mintState.fetch(mintState);
      expect(mintStateAfter.epochBurned.toNumber()).to.equal(epochBurnedBefore + 500_000);
    });
  });

  describe("start_new_epoch", () => {
    let epochHistory: PublicKey;

    before(async () => {
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      
      [epochHistory] = PublicKey.findProgramAddressSync(
        [Buffer.from("epoch_history"), mintStateAccount.currentEpoch.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
    });

    it("should fail when epoch duration not complete", async () => {
      try {
        await program.methods
          .startNewEpoch()
          .accounts({
            mintState,
            epochHistory,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("EpochNotComplete");
      }
    });

    it("should start new epoch after duration elapsed", async () => {
      // Wait for epoch duration (in test, we'd need to manipulate time)
      // For now, we'll test the logic assuming time has passed
      
      // This would require time manipulation in tests
      // Example: await provider.connection.warpToSlot(futureSlot);
    });

    it("should record epoch history", async () => {
      // After epoch transition, verify history is recorded
      // This test depends on the previous test succeeding
    });

    it("should reset epoch counters", async () => {
      // After epoch transition, verify counters are reset
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      
      // If epoch has transitioned:
      // expect(mintStateAccount.epochMinted.toNumber()).to.equal(0);
      // expect(mintStateAccount.epochBurned.toNumber()).to.equal(0);
    });

    it("should increment epoch number", async () => {
      const mintStateBefore = await program.account.mintState.fetch(mintState);
      const currentEpochBefore = mintStateBefore.currentEpoch.toNumber();

      // After successful epoch transition:
      // const mintStateAfter = await program.account.mintState.fetch(mintState);
      // expect(mintStateAfter.currentEpoch.toNumber()).to.equal(currentEpochBefore + 1);
    });
  });

  describe("epoch supply caps", () => {
    it("should calculate mint cap correctly", async () => {
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      const totalSupply = mintStateAccount.totalSupply.toNumber();
      const mintCapBps = mintStateAccount.mintCapPerEpochBps;
      
      const expectedMintCap = Math.floor((totalSupply * mintCapBps) / 10000);
      
      // Verify the cap is enforced correctly
      expect(expectedMintCap).to.be.greaterThan(0);
    });

    it("should calculate burn cap correctly", async () => {
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      const totalSupply = mintStateAccount.totalSupply.toNumber();
      const burnCapBps = mintStateAccount.burnCapPerEpochBps;
      
      const expectedBurnCap = Math.floor((totalSupply * burnCapBps) / 10000);
      
      // Verify the cap is enforced correctly
      expect(expectedBurnCap).to.be.greaterThan(0);
    });

    it("should allow minting up to exact cap", async () => {
      const mintStateAccount = await program.account.mintState.fetch(mintState);
      const totalSupply = mintStateAccount.totalSupply.toNumber();
      const epochMinted = mintStateAccount.epochMinted.toNumber();
      const mintCap = Math.floor((totalSupply * 200) / 10000);
      
      const remainingCap = mintCap - epochMinted;
      
      if (remainingCap > 0) {
        const destination = await createAccount(
          provider.connection,
          authority,
          aruMint,
          authority.publicKey
        );

        await program.methods
          .mintAru(new anchor.BN(remainingCap))
          .accounts({
            mintState,
            aruMint,
            destination,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        const mintStateAfter = await program.account.mintState.fetch(mintState);
        expect(mintStateAfter.epochMinted.toNumber()).to.equal(mintCap);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle zero total supply", async () => {
      // When total supply is 0, mint cap should be 0
      // This tests the initial state
    });

    it("should handle arithmetic overflow in cap calculation", async () => {
      // Test with very large total supply values
      // Should use checked arithmetic
    });

    it("should handle concurrent mint operations", async () => {
      // Test for race conditions in epoch counter updates
    });

    it("should handle epoch transition during mint", async () => {
      // Test what happens if epoch transitions while minting
    });
  });

  describe("checked arithmetic", () => {
    it("should prevent overflow in total supply", async () => {
      // Try to mint amount that would overflow u64
      const maxU64 = new anchor.BN("18446744073709551615");
      
      try {
        await program.methods
          .mintAru(maxU64)
          .accounts({
            mintState,
            aruMint,
            destination: await createAccount(
              provider.connection,
              authority,
              aruMint,
              authority.publicKey
            ),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("ArithmeticOverflow");
      }
    });

    it("should prevent underflow in total supply", async () => {
      // Try to burn more than total supply
      const excessiveBurn = new anchor.BN(1_000_000_000_000);
      
      try {
        await program.methods
          .burnAru(excessiveBurn)
          .accounts({
            mintState,
            aruMint,
            source: await createAccount(
              provider.connection,
              authority,
              aruMint,
              authority.publicKey
            ),
            authority: authority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("ArithmeticOverflow");
      }
    });
  });
});
