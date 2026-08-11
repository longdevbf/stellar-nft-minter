#![no_std]

//! NFT Minter
//!
//! Chuan NFT (transfer/approve/burn) lay tu OpenZeppelin `stellar-tokens`.
//! Phan contract nay them vao:
//!   - metadata rieng cho tung token (OZ Base chi co base-URI cap collection,
//!     token_uri = base_uri + token_id, nen khong luu duoc CID rieng moi anh),
//!   - ba loai loi nghiep vu duoc kiem tra truoc khi mint,
//!   - event mang day du metadata de frontend dung lam live feed.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
};
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, Base, NonFungibleToken};

// ---------------------------------------------------------------------------
// Hang so
// ---------------------------------------------------------------------------

const MAX_NAME_LEN: u32 = 64;
const MAX_DESC_LEN: u32 = 280;
/// CIDv0 dai 46 ky tu ("Qm..."), CIDv1 base32 dai 59. Lay 32 lam can duoi de
/// chan chuoi rac ma van khong khoa cung mot phien ban CID cu the.
const MIN_CID_LEN: u32 = 32;

// TTL. Ledger dong khoang 5 giay -> 1 ngay ~ 17_280 ledger.
// Khi entry con duoi 7 ngay thi gia han len 30 ngay.
const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = DAY_IN_LEDGERS * 7;
const TTL_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30;

// ---------------------------------------------------------------------------
// Loi
// ---------------------------------------------------------------------------

/// Loi nghiep vu cua contract nay.
///
/// Danh so 1..=4 co chu dich: OpenZeppelin da chiem dai 200..=214 cho
/// `NonFungibleTokenError`, dung trung se khien frontend doc sai loai loi.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u32)]
pub enum Error {
    /// Ten rong/qua dai, mo ta qua dai, hoac CID khong hop le.
    InvalidMetadata = 1,
    /// Da mint du MAX_SUPPLY.
    SupplyExhausted = 2,
    /// CID nay da duoc mint roi - chan mint trung cung mot anh.
    DuplicateCid = 3,
    /// Hoi metadata cua token chua ton tai.
    TokenNotFound = 4,
}

// ---------------------------------------------------------------------------
// Kieu du lieu & khoa storage
// ---------------------------------------------------------------------------

/// Event rieng cua ung dung, phat ra moi lan mint thanh cong.
///
/// OZ da emit event `Mint` chuan nhung no chi mang `to` + `token_id`. Frontend
/// can them ten va CID de dung live feed ma khong phai goi nguoc lai contract
/// cho tung token vua thay.
///
/// Topic: `("minted", to)`. KHONG duoc dat topic la "mint": OZ da dung dung
/// `("mint", to)` cho event chuan cua no, trung topic thi frontend loc ra hai
/// event lan lon nhau. Ten macro mac dinh (ten struct viet snake_case) cho ra
/// "minted" nen de nguyen la an toan.
/// Data: map co khoa `token_id`, `name`, `cid`, `minted_at`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Minted {
    #[topic]
    pub to: Address,
    pub token_id: u32,
    pub name: String,
    pub cid: String,
    pub minted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMeta {
    pub name: String,
    pub description: String,
    /// CID cua anh tren IPFS (khong kem tien to "ipfs://").
    pub cid: String,
    pub minter: Address,
    /// Unix timestamp cua ledger luc mint.
    pub minted_at: u64,
}

#[contracttype]
pub enum DataKey {
    /// token_id -> TokenMeta
    Meta(u32),
    /// cid -> () ; chi can biet co ton tai hay khong
    CidUsed(String),
    /// Tong so da mint. Khong the suy ra tu OZ vi burn khong lam giam bo dem
    /// sinh id tuan tu, ma ta muon tran cung tinh theo so da phat hanh.
    Minted,
    /// Tran cung cua bo suu tap, dat luc deploy.
    MaxSupply,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct NftMinter;

#[contractimpl]
impl NftMinter {
    /// `base_uri` la tien to gateway IPFS, vi du "https://gateway.pinata.cloud/ipfs/".
    /// `max_supply` la tran cung, khong doi duoc sau khi deploy.
    pub fn __constructor(e: &Env, base_uri: String, name: String, symbol: String, max_supply: u32) {
        Base::set_metadata(e, base_uri, name, symbol);
        e.storage().instance().set(&DataKey::MaxSupply, &max_supply);
    }

    /// Mint mot NFT moi cho `to`.
    ///
    /// Mo cho moi nguoi mint (chi can chinh `to` ky), khong gioi han theo owner
    /// - neu khoa lai thi nguoi cham bai khong mint duoc tu frontend.
    pub fn mint(
        e: &Env,
        to: Address,
        name: String,
        description: String,
        cid: String,
    ) -> Result<u32, Error> {
        to.require_auth();

        // (1) Metadata phai hop le.
        if name.len() == 0
            || name.len() > MAX_NAME_LEN
            || description.len() > MAX_DESC_LEN
            || cid.len() < MIN_CID_LEN
        {
            return Err(Error::InvalidMetadata);
        }

        // (2) Con cho trong bo suu tap.
        let minted: u32 = e.storage().instance().get(&DataKey::Minted).unwrap_or(0);
        if minted >= Self::max_supply(e) {
            return Err(Error::SupplyExhausted);
        }

        // (3) Anh chua tung duoc mint.
        let cid_key = DataKey::CidUsed(cid.clone());
        if e.storage().persistent().has(&cid_key) {
            return Err(Error::DuplicateCid);
        }

        // Kiem tra xong het roi moi ghi - tranh de lai trang thai dang do.
        let token_id = Base::sequential_mint(e, &to);

        let meta = TokenMeta {
            name: name.clone(),
            description,
            cid: cid.clone(),
            minter: to.clone(),
            minted_at: e.ledger().timestamp(),
        };

        let meta_key = DataKey::Meta(token_id);
        e.storage().persistent().set(&meta_key, &meta);
        e.storage().persistent().extend_ttl(&meta_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        e.storage().persistent().set(&cid_key, &());
        e.storage().persistent().extend_ttl(&cid_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        e.storage().instance().set(&DataKey::Minted, &(minted + 1));
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);

        Minted { to, token_id, name, cid, minted_at: meta.minted_at }.publish(e);

        Ok(token_id)
    }

    /// Metadata cua mot token. Loi thu (4).
    pub fn get_meta(e: &Env, token_id: u32) -> Result<TokenMeta, Error> {
        let key = DataKey::Meta(token_id);
        let meta: TokenMeta =
            e.storage().persistent().get(&key).ok_or(Error::TokenNotFound)?;
        e.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(meta)
    }

    /// So NFT da phat hanh.
    pub fn total_minted(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::Minted).unwrap_or(0)
    }

    /// Tran cung cua bo suu tap.
    pub fn max_supply(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::MaxSupply).unwrap_or(0)
    }
}

// Chuan NFT day du (balance, owner_of, transfer, approve, token_uri...) lay
// nguyen tu OZ. Cu phap `contractimpl(contracttrait)` la cua v0.7.2 - docs
// Stellar dang huong dan `#[default_impl]` cua ban cu hon va se khong compile.
#[contractimpl(contracttrait)]
impl NonFungibleToken for NftMinter {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for NftMinter {}

mod test;
