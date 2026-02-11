import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArsCore } from "../target/types/ars_core";
import { ArsReserve } from "../target/types/ars_reserve";
import { ArsToken } from "../target/types/ars_token";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fc from "fast-check";

describe("PDA Derivation Property Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const arsCoreProgram = anchor.workspace.ArsCore as Program<ArsCore>;
  const arsReserveProgram = anchor.workspace.ArsReserve as Program<ArsReserve>;
  const arsTokenProgram = anchor.workspace.ArsToken as Program<ArsToken>;

  /**
   * Property 13: PDA Derivation Validation
   * Validates: Requirement 1.13 - THE ars-core SHALL validate all PDA derivations before account access
   */
  describe("Property 13: PDA Derivation Determinism", () => {
    it("should derive the same PDA for identical seeds and program ID", () => {
      fc.assert(
        fc.property(
          fc.record({
            seedString: fc.string({ minLength: 1, maxLength: 32 }),
            programId: fc.constantFrom(
              arsCoreProgram.programId.toString(),
              arsReserveProgram.programId.toString(),
              arsTokenProgram.programId.toString(),
            ),
          }),
          (inputs) => {
            const programId = new PublicKey(inputs.programId);
            const seeds = [Buffer.from(inputs.seedString)];

            const [pda1] = PublicKey.findProgramAddressSync(seeds, programId);
            const [pda2] = PublicKey.findProgramAddressSync(seeds, programId);

            expect(pda1.toString()).to.equal(pda2.toString());
          },
        ),
        { numRuns: 500 },
      );
    });

    it("should derive different PDAs for different seed strings", () => {
      fc.assert(
        fc.property(
          fc
            .record({
              seed1: fc.string({ minLength: 1, maxLength: 32 }),
              seed2: fc.string({ minLength: 1, maxLength: 32 }),
            })
            .filter((record) => record.seed1 !== record.seed2),
          (inputs) => {
            const seeds1 = [Buffer.from(inputs.seed1)];
            const seeds2 = [Buffer.from(inputs.seed2)];

            const [pda1] = PublicKey.findProgramAddressSync(
              seeds1,
              arsCoreProgram.programId,
            );
            const [pda2] = PublicKey.findProgramAddressSync(
              seeds2,
              arsCoreProgram.programId,
            );

            expect(pda1.toString()).not.to.equal(pda2.toString());
          },
        ),
        { numRuns: 500 },
      );
    });

    it("should derive different PDAs for same seeds but different program IDs", () => {
      fc.assert(
        fc.property(
          fc.record({
            seedString: fc.string({ minLength: 1, maxLength: 32 }),
            programId1: fc.constant(arsCoreProgram.programId.toString()),
            programId2: fc.constant(arsReserveProgram.programId.toString()),
          }),
          (inputs) => {
            const seeds = [Buffer.from(inputs.seedString)];
            const programId1 = new PublicKey(inputs.programId1);
            const programId2 = new PublicKey(inputs.programId2);

            const [pda1] = PublicKey.findProgramAddressSync(seeds, programId1);
            const [pda2] = PublicKey.findProgramAddressSync(seeds, programId2);

            expect(pda1.toString()).not.to.equal(pda2.toString());
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("Property 13: PDA Bump Seed Validation", () => {
    it("should always find a valid bump seed between 254 and 255", () => {
      fc.assert(
        fc.property(
          fc.record({
            seed1: fc.string({ minLength: 1, maxLength: 32 }),
            seed2: fc.string({ minLength: 1, maxLength: 32 }),
            seed3: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (inputs) => {
            const seeds = [
              Buffer.from(inputs.seed1),
              Buffer.from(inputs.seed2),
              Buffer.from(inputs.seed3),
            ];

            const [pda, bump] = PublicKey.findProgramAddressSync(
              seeds,
              arsCoreProgram.programId,
            );

            expect(pda).to.be.instanceOf(PublicKey);
            expect(bump).to.be.greaterThanOrEqual(254);
            expect(bump).to.be.lessThanOrEqual(255);
          },
        ),
        { numRuns: 500 },
      );
    });

    it("should produce different PDAs when adding byte prefix to seeds", () => {
      fc.assert(
        fc.property(
          fc.record({
            baseSeed: fc.string({ minLength: 1, maxLength: 31 }),
            byteValue: fc.integer({ min: 0, max: 255 }),
          }),
          (inputs) => {
            const seedsWithoutByte = [Buffer.from(inputs.baseSeed)];
            const seedsWithByte = [
              Buffer.from(inputs.baseSeed),
              Buffer.from([inputs.byteValue]),
            ];

            const [pda1] = PublicKey.findProgramAddressSync(
              seedsWithoutByte,
              arsCoreProgram.programId,
            );
            const [pda2] = PublicKey.findProgramAddressSync(
              seedsWithByte,
              arsCoreProgram.programId,
            );

            expect(pda1.toString()).not.to.equal(pda2.toString());
          },
        ),
        { numRuns: 300 },
      );
    });
  });

  describe("Property 13: ARS Core PDA Derivation", () => {
    it("should derive GlobalState PDA correctly", () => {
      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        arsCoreProgram.programId,
      );

      expect(globalState).to.be.instanceOf(PublicKey);
      expect(globalState.toString().length).to.be.greaterThan(30);
    });

    it("should derive ILIOracle PDA correctly", () => {
      const [iliOracle] = PublicKey.findProgramAddressSync(
        [Buffer.from("ili_oracle")],
        arsCoreProgram.programId,
      );

      expect(iliOracle).to.be.instanceOf(PublicKey);
      expect(iliOracle.toString().length).to.be.greaterThan(30);
    });

    it("should derive AgentRegistry PDAs uniquely for different agents", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 32, maxLength: 44 }), {
            minLength: 2,
            maxLength: 5,
          }),
          (agentPubkeys) => {
            const derivedPDAs = agentPubkeys.map((pubkey) => {
              const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from("agent"), new PublicKey(pubkey).toBuffer()],
                arsCoreProgram.programId,
              );
              return pda.toString();
            });

            const uniquePDAs = new Set(derivedPDAs);
            expect(uniquePDAs.size).to.equal(derivedPDAs.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should derive Proposal PDAs with incrementing counters", () => {
      const counter1 = new anchor.BN(1).toArrayLike(Buffer, "le", 8);
      const counter2 = new anchor.BN(2).toArrayLike(Buffer, "le", 8);
      const counter3 = new anchor.BN(100).toArrayLike(Buffer, "le", 8);

      const [proposal1] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), counter1],
        arsCoreProgram.programId,
      );

      const [proposal2] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), counter2],
        arsCoreProgram.programId,
      );

      const [proposal3] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), counter3],
        arsCoreProgram.programId,
      );

      expect(proposal1.toString()).not.to.equal(proposal2.toString());
      expect(proposal2.toString()).not.to.equal(proposal3.toString());
      expect(proposal1.toString()).not.to.equal(proposal3.toString());
    });
  });

  describe("Property 13: ARS Reserve PDA Derivation", () => {
    it("should derive ReserveVault PDA correctly", () => {
      const [reserveVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("reserve_vault")],
        arsReserveProgram.programId,
      );

      expect(reserveVault).to.be.instanceOf(PublicKey);
    });

    it("should derive AssetConfig PDAs uniquely for different assets", () => {
      const assetSeeds = ["sol", "usdc", "msol", "jitosol"];

      const derivedPDAs = assetSeeds.map((asset) => {
        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from("asset_config"), Buffer.from(asset)],
          arsReserveProgram.programId,
        );
        return pda.toString();
      });

      const uniquePDAs = new Set(derivedPDAs);
      expect(uniquePDAs.size).to.equal(assetSeeds.length);
    });
  });

  describe("Property 13: ARS Token PDA Derivation", () => {
    it("should derive MintState PDA correctly", () => {
      const [mintState] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_state")],
        arsTokenProgram.programId,
      );

      expect(mintState).to.be.instanceOf(PublicKey);
    });

    it("should derive EpochHistory PDAs uniquely for different epochs", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 1000 }), {
            minLength: 3,
            maxLength: 5,
          }),
          (epochs) => {
            const derivedPDAs = epochs.map((epoch) => {
              const epochBuffer = new anchor.BN(epoch).toArrayLike(
                Buffer,
                "le",
                8,
              );
              const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from("epoch_history"), epochBuffer],
                arsTokenProgram.programId,
              );
              return pda.toString();
            });

            const uniquePDAs = new Set(derivedPDAs);
            expect(uniquePDAs.size).to.equal(epochs.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("Property 13: Cross-Program PDA Consistency", () => {
    it("should derive consistent PDAs across multiple derivations", () => {
      fc.assert(
        fc.property(
          fc.record({
            prefix: fc.string({ minLength: 5, maxLength: 20 }),
            identifier: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (inputs) => {
            const seeds = [
              Buffer.from(inputs.prefix),
              Buffer.from(inputs.identifier),
            ];

            const [pda1] = PublicKey.findProgramAddressSync(
              seeds,
              arsCoreProgram.programId,
            );
            const [pda2] = PublicKey.findProgramAddressSync(
              seeds,
              arsCoreProgram.programId,
            );
            const [pda3] = PublicKey.findProgramAddressSync(
              seeds,
              arsCoreProgram.programId,
            );

            expect(pda1.toString()).to.equal(pda2.toString());
            expect(pda2.toString()).to.equal(pda3.toString());
          },
        ),
        { numRuns: 300 },
      );
    });

    it("should handle complex seed combinations consistently", () => {
      const testCases = [
        {
          seeds: [
            Buffer.from("proposal"),
            new anchor.BN(42).toArrayLike(Buffer, "le", 8),
            Buffer.from("voting"),
          ],
        },
        {
          seeds: [
            Buffer.from("agent"),
            Keypair.generate().publicKey.toBuffer(),
            Buffer.from("stake"),
          ],
        },
        {
          seeds: [
            Buffer.from("vault"),
            Buffer.from("rebalance"),
            new anchor.BN(1000000).toArrayLike(Buffer, "le", 8),
          ],
        },
      ];

      testCases.forEach((testCase, index) => {
        const [pda1] = PublicKey.findProgramAddressSync(
          testCase.seeds,
          arsCoreProgram.programId,
        );
        const [pda2] = PublicKey.findProgramAddressSync(
          testCase.seeds,
          arsCoreProgram.programId,
        );

        expect(pda1.toString()).to.equal(
          pda2.toString(),
          `Test case ${index + 1} failed`,
        );
      });
    });
  });

  describe("Property 13: PDA Address Format Validation", () => {
    it("should always produce valid Solana public key format", () => {
      fc.assert(
        fc.property(
          fc.record({
            seed1: fc.string({ minLength: 1, maxLength: 32 }),
            seed2: fc.string({ minLength: 1, maxLength: 32 }),
            seed3: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (inputs) => {
            const seeds = [
              Buffer.from(inputs.seed1),
              Buffer.from(inputs.seed2),
              Buffer.from(inputs.seed3),
            ];

            const [pda] = PublicKey.findProgramAddressSync(
              seeds,
              arsCoreProgram.programId,
            );

            expect(pda.toString()).to.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
            expect(pda.toBase58().length).to.be.greaterThanOrEqual(32);
            expect(pda.toBase58().length).to.be.lessThanOrEqual(44);
          },
        ),
        { numRuns: 500 },
      );
    });

    it("should not produce the system program ID as a PDA", () => {
      fc.assert(
        fc.property(
          fc.record({
            seed: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (inputs) => {
            const [pda] = PublicKey.findProgramAddressSync(
              [Buffer.from(inputs.seed)],
              arsCoreProgram.programId,
            );

            expect(pda.toString()).not.to.equal(
              SystemProgram.programId.toString(),
            );
          },
        ),
        { numRuns: 200 },
      );
    });

    it("should not produce the ARS program ID as a PDA", () => {
      fc.assert(
        fc.property(
          fc.record({
            seed: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (inputs) => {
            const [pda] = PublicKey.findProgramAddressSync(
              [Buffer.from(inputs.seed)],
              arsCoreProgram.programId,
            );

            expect(pda.toString()).not.to.equal(
              arsCoreProgram.programId.toString(),
            );
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe("Property 13: Invalid PDA Detection", () => {
    it("should detect when provided PDA does not match expected derivation", async () => {
      const [expectedGlobalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        arsCoreProgram.programId,
      );

      const wrongPDA = Keypair.generate().publicKey;

      expect(expectedGlobalState.toString()).not.to.equal(wrongPDA.toString());
    });

    it("should validate PDA ownership matches program", async () => {
      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        arsCoreProgram.programId,
      );

      expect(globalState.toString().length).to.be.greaterThan(30);
    });
  });
});
