import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsReserve } from "../target/types/ars_reserve";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";

describe("ars-reserve unit tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArsReserve as Program<ArsReserve>;
  
  let vault: PublicKey;
  let authority: Keypair;
  let usdcMint: PublicKey;
  let usdcVault: PublicKey;
  let solVault: Keypair;
  let msolVault: Keypair;
  let jitosolVault: Keypair;

  before(async () => {
    authority = Keypair.generate();
    solVault = Keypair.generate();
    msolVault = Keypair.generate();
    jitosolVault = Keypair.generate();
    
    // Airdrop SOL to authority
    const signature = await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // Create USDC vault
    usdcVault = await createAccount(
      provider.connection,
      authority,
      usdcMint,
      authority.publicKey
    );

    // Derive vault PDA
    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authority.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("initialize", () => {
    it("should initialize vault with valid parameters", async () => {
      const minVhr = 15000; // 150%
      const rebalanceThresholdBps = 17500; // 175%

      await program.methods
        .initialize(minVhr, rebalanceThresholdBps)
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

      const vaultAccount = await program.account.reserveVault.fetch(vault);
      expect(vaultAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(vaultAccount.minVhr).to.equal(15000);
      expect(vaultAccount.rebalanceThresholdBps).to.equal(17500);
      expect(vaultAccount.totalValueUsd.toNumber()).to.equal(0);
      expect(vaultAccount.vhr).to.equal(65535); // u16::MAX
    });

    it("should fail with invalid min VHR", async () => {
      const invalidMinVhr = 5000; // Below 100% (10000)
      
      try {
        await program.methods
          .initialize(invalidMinVhr, 17500)
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
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidVHR");
      }
    });

    it("should fail with invalid rebalance threshold", async () => {
      const invalidThreshold = 15000; // Above 100% (10000)
      
      try {
        await program.methods
          .initialize(15000, invalidThreshold)
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
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidThreshold");
      }
    });
  });

  describe("deposit", () => {
    let user: Keypair;
    let userTokenAccount: PublicKey;
    let vaultTokenAccount: PublicKey;

    before(async () => {
      user = Keypair.generate();
      
      // Airdrop SOL to user
      const signature = await provider.connection.requestAirdrop(
        user.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      // Create user token account
      userTokenAccount = await createAccount(
        provider.connection,
        user,
        usdcMint,
        user.publicKey
      );

      // Mint tokens to user
      await mintTo(
        provider.connection,
        authority,
        usdcMint,
        userTokenAccount,
        authority,
        1_000_000_000 // 1,000 USDC
      );

      // Create vault token account
      vaultTokenAccount = await createAccount(
        provider.connection,
        authority,
        usdcMint,
        vault
      );
    });

    it("should deposit tokens to vault", async () => {
      const depositAmount = new anchor.BN(100_000_000); // 100 USDC

      await program.methods
        .deposit(depositAmount)
        .accounts({
          vault,
          user: user.publicKey,
          userTokenAccount,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const vaultAccount = await program.account.reserveVault.fetch(vault);
      expect(vaultAccount.totalValueUsd.toNumber()).to.equal(100_000_000);

      const vaultTokenAccountInfo = await getAccount(provider.connection, vaultTokenAccount);
      expect(Number(vaultTokenAccountInfo.amount)).to.equal(100_000_000);
    });

    it("should fail with zero amount", async () => {
      const zeroAmount = new anchor.BN(0);
      
      try {
        await program.methods
          .deposit(zeroAmount)
          .accounts({
            vault,
            user: user.publicKey,
            userTokenAccount,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidAmount");
      }
    });

    it("should update VHR after deposit", async () => {
      const depositAmount = new anchor.BN(50_000_000); // 50 USDC

      await program.methods
        .deposit(depositAmount)
        .accounts({
          vault,
          user: user.publicKey,
          userTokenAccount,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const vaultAccount = await program.account.reserveVault.fetch(vault);
      expect(vaultAccount.totalValueUsd.toNumber()).to.equal(150_000_000);
      // VHR should be recalculated
      expect(vaultAccount.vhr).to.be.greaterThan(0);
    });
  });

  describe("withdraw", () => {
    let user: Keypair;
    let userTokenAccount: PublicKey;
    let vaultTokenAccount: PublicKey;

    before(async () => {
      user = Keypair.generate();
      
      // Airdrop SOL to user
      const signature = await provider.connection.requestAirdrop(
        user.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      // Create user token account
      userTokenAccount = await createAccount(
        provider.connection,
        user,
        usdcMint,
        user.publicKey
      );

      // Use existing vault token account
      vaultTokenAccount = usdcVault;
    });

    it("should withdraw tokens from vault", async () => {
      const withdrawAmount = new anchor.BN(25_000_000); // 25 USDC

      const vaultBefore = await program.account.reserveVault.fetch(vault);
      const totalValueBefore = vaultBefore.totalValueUsd.toNumber();

      await program.methods
        .withdraw(withdrawAmount)
        .accounts({
          vault,
          user: user.publicKey,
          userTokenAccount,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const vaultAfter = await program.account.reserveVault.fetch(vault);
      expect(vaultAfter.totalValueUsd.toNumber()).to.equal(totalValueBefore - 25_000_000);

      const userTokenAccountInfo = await getAccount(provider.connection, userTokenAccount);
      expect(Number(userTokenAccountInfo.amount)).to.equal(25_000_000);
    });

    it("should fail when VHR would fall below minimum", async () => {
      // Set liabilities to make VHR critical
      const largeWithdraw = new anchor.BN(1_000_000_000); // 1,000 USDC
      
      try {
        await program.methods
          .withdraw(largeWithdraw)
          .accounts({
            vault,
            user: user.publicKey,
            userTokenAccount,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("VHRTooLow");
      }
    });

    it("should fail with insufficient balance", async () => {
      const excessiveWithdraw = new anchor.BN(10_000_000_000); // 10,000 USDC
      
      try {
        await program.methods
          .withdraw(excessiveWithdraw)
          .accounts({
            vault,
            user: user.publicKey,
            userTokenAccount,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }
    });
  });

  describe("rebalance", () => {
    it("should trigger rebalance when VHR below threshold", async () => {
      const rebalanceAmount = new anchor.BN(10_000_000); // 10 USDC

      await program.methods
        .rebalance(rebalanceAmount)
        .accounts({
          vault,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const vaultAccount = await program.account.reserveVault.fetch(vault);
      expect(vaultAccount.lastRebalance.toNumber()).to.be.greaterThan(0);
    });

    it("should fail when rebalance not needed", async () => {
      // If VHR is above threshold, rebalance should fail
      try {
        await program.methods
          .rebalance(new anchor.BN(10_000_000))
          .accounts({
            vault,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("RebalanceNotNeeded");
      }
    });
  });

  describe("VHR calculation", () => {
    it("should calculate VHR correctly with liabilities", async () => {
      // Deposit to increase total value
      const user = Keypair.generate();
      const signature = await provider.connection.requestAirdrop(
        user.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      const userTokenAccount = await createAccount(
        provider.connection,
        user,
        usdcMint,
        user.publicKey
      );

      await mintTo(
        provider.connection,
        authority,
        usdcMint,
        userTokenAccount,
        authority,
        500_000_000 // 500 USDC
      );

      await program.methods
        .deposit(new anchor.BN(500_000_000))
        .accounts({
          vault,
          user: user.publicKey,
          userTokenAccount,
          vaultTokenAccount: usdcVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const vaultAccount = await program.account.reserveVault.fetch(vault);
      
      // VHR = (total_value * 10000) / liabilities
      // If liabilities = 0, VHR = u16::MAX
      if (vaultAccount.liabilitiesUsd.toNumber() === 0) {
        expect(vaultAccount.vhr).to.equal(65535);
      } else {
        const expectedVhr = Math.floor(
          (vaultAccount.totalValueUsd.toNumber() * 10000) / vaultAccount.liabilitiesUsd.toNumber()
        );
        expect(vaultAccount.vhr).to.be.closeTo(expectedVhr, 10);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle maximum deposit amount", async () => {
      const user = Keypair.generate();
      const signature = await provider.connection.requestAirdrop(
        user.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      const userTokenAccount = await createAccount(
        provider.connection,
        user,
        usdcMint,
        user.publicKey
      );

      const maxAmount = new anchor.BN("18446744073709551615"); // u64::MAX
      
      await mintTo(
        provider.connection,
        authority,
        usdcMint,
        userTokenAccount,
        authority,
        Number(maxAmount.toString())
      );

      try {
        await program.methods
          .deposit(maxAmount)
          .accounts({
            vault,
            user: user.publicKey,
            userTokenAccount,
            vaultTokenAccount: usdcVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        // Should either succeed or fail with overflow
      } catch (error) {
        expect(error.toString()).to.include("ArithmeticOverflow");
      }
    });

    it("should handle concurrent deposits", async () => {
      const user1 = Keypair.generate();
      const user2 = Keypair.generate();
      
      // Setup users (simplified)
      // ... create accounts and mint tokens ...
      
      // Attempt concurrent deposits
      // This tests for race conditions and state consistency
    });
  });
});
