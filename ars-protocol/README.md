# ARS Protocol - Smart Contracts

Ini adalah lokasi utama untuk semua smart contract **Agentic Reserve System (ARS)**.

## Struktur Folder

```
ars-protocol/
├── programs/
│   ├── ars-core/       # Program utama: ILI, ICR, governance
│   ├── ars-reserve/    # Vault management & rebalancing
│   └── ars-token/      # Token lifecycle & epoch control
├── Anchor.toml         # Konfigurasi Anchor
├── Cargo.toml          # Workspace Rust
└── README.md           # File ini
```

## Program Smart Contract

### 1. ars-core
Program utama yang mengelola:
- **ILI (Internet Liquidity Index)** - Agregasi data dari 8+ protokol DeFi
- **ICR (Internet Credit Rate)** - Suku bunga kredit
- **Futarchy Governance** - Sistem voting dengan quadratic staking
- **Circuit Breaker** - Keamanan dengan timelock 24 jam

**Program ID (Devnet):** `ArSGtMbaesLSG4LR2EvGCzBntmKeBQqG5DP3jVUNZbQU`

### 2. ars-reserve
Mengelola vault multi-asset:
- SOL, USDC, mSOL, JitoSOL
- Rebalancing otomatis berdasarkan VHR (Vault Health Ratio)
- Target backing ratio 200%

**Program ID (Devnet):** `ARSCR7FeeVfrwxkJhxU6ErdRXAX6peSbufkHLzUzsEew`

### 3. ars-token
Lifecycle token ARU (Agentic Reserve Unit):
- Minting & burning dengan supply cap
- Epoch-based supply control
- Stability fee 0.1%

**Program ID (Devnet):** `ARSrGLpBEnS2kD4qLWciXECaVwSSYV1o6FWCCXXSC9ft`

## Migrasi Pinocchio

Saat ini sedang dalam proses migrasi dari **Anchor 0.30.1** ke **Pinocchio 0.10.1** untuk:
- ✅ Mengurangi ukuran binary 20%
- ✅ Mengurangi compute units 15%
- ✅ Meningkatkan performa deserialization
- ✅ Menghilangkan dependency eksternal

Status migrasi dapat dilihat di: `.kiro/specs/pinocchio-migration/tasks.md`

## Build & Deploy

### Build semua program
```bash
cd ars-protocol
anchor build
```

### Test
```bash
anchor test
```

### Deploy ke Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Deploy ke Mainnet
```bash
anchor deploy --provider.cluster mainnet
```

## Development

### Menambah program baru
1. Buat folder baru di `programs/`
2. Tambahkan ke `workspace.members` di `Cargo.toml`
3. Tambahkan program ID di `Anchor.toml`

### Testing
- Unit tests: `cargo test --package <program-name>`
- Property-based tests: `cargo test --package <program-name> --test property_tests`
- Integration tests: `anchor test`

## Catatan Penting

⚠️ **Jangan gunakan folder `programs/` di root repository!**

Semua development smart contract harus dilakukan di folder `ars-protocol/` ini.

Folder `programs/` di root adalah legacy dan akan dihapus setelah migrasi Pinocchio selesai.

## Dokumentasi Lengkap

- [Whitepaper](../WHITEPAPER.md)
- [Implementation Status](../documentation/IMPLEMENTATION_STATUS.md)
- [Security Audit](../documentation/security/)
- [Pinocchio Migration Spec](../.kiro/specs/pinocchio-migration/)

## Support

Untuk pertanyaan atau issue, silakan buka issue di GitHub repository.
