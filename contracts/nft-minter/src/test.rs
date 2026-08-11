#![cfg(test)]

// Crate la `no_std`, nen test muon dung println!/format! phai tu keo std vao.
extern crate std;

use super::*;
use soroban_sdk::{
    map,
    testutils::{Address as _, Events, Ledger},
    vec, Address, Env, IntoVal, Map, Symbol, Val, Vec,
};

// CID that co dinh dang CIDv0 (46 ky tu), du dai de qua kiem tra MIN_CID_LEN.
const CID_A: &str = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const CID_B: &str = "QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4";
const CID_C: &str = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";

/// Deploy contract voi tran cung cho truoc va bat sang mock auth, vi `mint`
/// goi `to.require_auth()`.
fn setup(e: &Env, max_supply: u32) -> NftMinterClient<'_> {
    e.mock_all_auths();
    let id = e.register(
        NftMinter,
        (
            String::from_str(e, "https://gateway.pinata.cloud/ipfs/"),
            String::from_str(e, "Stellar Mints"),
            String::from_str(e, "SMINT"),
            max_supply,
        ),
    );
    NftMinterClient::new(e, &id)
}

fn s(e: &Env, v: &str) -> String {
    String::from_str(e, v)
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

#[test]
fn mint_luu_metadata_va_tang_bo_dem() {
    let e = Env::default();
    e.ledger().set_timestamp(1_700_000_000);
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    let token_id = client.mint(&user, &s(&e, "Sao Bac Dau"), &s(&e, "NFT dau tien"), &s(&e, CID_A));

    // Base::sequential_mint cua OZ v0.7.2 danh so tu 0. Docs Stellar ghi la
    // "starting from 1" nhung do la mo ta sai - kiem chung bang event thuc te.
    assert_eq!(token_id, 0, "id tuan tu bat dau tu 0");
    assert_eq!(client.total_minted(), 1);

    let meta = client.get_meta(&token_id);
    assert_eq!(meta.name, s(&e, "Sao Bac Dau"));
    assert_eq!(meta.description, s(&e, "NFT dau tien"));
    assert_eq!(meta.cid, s(&e, CID_A));
    assert_eq!(meta.minter, user);
    assert_eq!(meta.minted_at, 1_700_000_000);
}

#[test]
fn giao_dien_nft_chuan_cua_openzeppelin_hoat_dong() {
    let e = Env::default();
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    let token_id = client.mint(&user, &s(&e, "Alpha"), &s(&e, ""), &s(&e, CID_A));

    // Chung minh phan chuan thuc su den tu OZ chu khong phai tu code cua ta.
    assert_eq!(client.owner_of(&token_id), user);
    assert_eq!(client.balance(&user), 1);
    assert_eq!(client.name(), s(&e, "Stellar Mints"));
    assert_eq!(client.symbol(), s(&e, "SMINT"));
}

#[test]
fn mo_ta_rong_van_hop_le() {
    let e = Env::default();
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    // Chi `name` bat buoc; mo ta de trong la chuyen binh thuong.
    assert_eq!(client.mint(&user, &s(&e, "Khong mo ta"), &s(&e, ""), &s(&e, CID_A)), 0);
}

// ---------------------------------------------------------------------------
// Loi 1 - InvalidMetadata
// ---------------------------------------------------------------------------

#[test]
fn loi_ten_rong() {
    let e = Env::default();
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    assert_eq!(
        client.try_mint(&user, &s(&e, ""), &s(&e, "mo ta"), &s(&e, CID_A)),
        Err(Ok(Error::InvalidMetadata))
    );
    assert_eq!(client.total_minted(), 0, "mint that bai khong duoc tang bo dem");
}

#[test]
fn loi_cid_qua_ngan() {
    let e = Env::default();
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    assert_eq!(
        client.try_mint(&user, &s(&e, "Alpha"), &s(&e, ""), &s(&e, "QmQuaNgan")),
        Err(Ok(Error::InvalidMetadata))
    );
}

#[test]
fn loi_ten_qua_dai() {
    let e = Env::default();
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    // 65 ky tu, vuot MAX_NAME_LEN = 64.
    let qua_dai = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    assert_eq!(qua_dai.len(), 65);
    assert_eq!(
        client.try_mint(&user, &s(&e, qua_dai), &s(&e, ""), &s(&e, CID_A)),
        Err(Ok(Error::InvalidMetadata))
    );
}

// ---------------------------------------------------------------------------
// Loi 2 - SupplyExhausted
// ---------------------------------------------------------------------------

#[test]
fn loi_het_tran_cung() {
    let e = Env::default();
    let client = setup(&e, 2); // tran cung = 2
    let user = Address::generate(&e);

    client.mint(&user, &s(&e, "Mot"), &s(&e, ""), &s(&e, CID_A));
    client.mint(&user, &s(&e, "Hai"), &s(&e, ""), &s(&e, CID_B));

    assert_eq!(
        client.try_mint(&user, &s(&e, "Ba"), &s(&e, ""), &s(&e, CID_C)),
        Err(Ok(Error::SupplyExhausted))
    );
    assert_eq!(client.total_minted(), 2);
}

// ---------------------------------------------------------------------------
// Loi 3 - DuplicateCid
// ---------------------------------------------------------------------------

#[test]
fn loi_trung_cid() {
    let e = Env::default();
    let client = setup(&e, 10);
    let user = Address::generate(&e);
    let khac = Address::generate(&e);

    client.mint(&user, &s(&e, "Ban goc"), &s(&e, ""), &s(&e, CID_A));

    // Nguoi khac cung khong mint lai duoc cung mot anh.
    assert_eq!(
        client.try_mint(&khac, &s(&e, "Ban sao"), &s(&e, ""), &s(&e, CID_A)),
        Err(Ok(Error::DuplicateCid))
    );
    assert_eq!(client.total_minted(), 1);
}

// ---------------------------------------------------------------------------
// Loi 4 - TokenNotFound
// ---------------------------------------------------------------------------

#[test]
fn loi_token_khong_ton_tai() {
    let e = Env::default();
    let client = setup(&e, 10);

    assert_eq!(client.try_get_meta(&999), Err(Ok(Error::TokenNotFound)));
}

// ---------------------------------------------------------------------------
// Event - frontend dua vao day de lam live feed
// ---------------------------------------------------------------------------

#[test]
fn mint_phat_ra_event_kem_metadata() {
    let e = Env::default();
    e.ledger().set_timestamp(1_700_000_000);
    let client = setup(&e, 10);
    let user = Address::generate(&e);

    client.mint(&user, &s(&e, "Co Event"), &s(&e, ""), &s(&e, CID_A));

    // Cac kieu duoi day phai ghi ro: `.into_val()` co nhieu dich hop le nen
    // trinh bien dich khong tu suy ra duoc.
    let oz_data: Map<Symbol, Val> = map![&e, (Symbol::new(&e, "token_id"), 0u32.into_val(&e))];
    let our_data: Map<Symbol, Val> = map![
        &e,
        (Symbol::new(&e, "cid"), s(&e, CID_A).into_val(&e)),
        (Symbol::new(&e, "minted_at"), 1_700_000_000u64.into_val(&e)),
        (Symbol::new(&e, "name"), s(&e, "Co Event").into_val(&e)),
        (Symbol::new(&e, "token_id"), 0u32.into_val(&e)),
    ];

    // Moi lan mint sinh ra dung 2 event: event chuan cua OZ roi den event cua
    // ung dung. So sanh ca danh sach de neu OZ doi hinh dang event thi test bao
    // ngay, thay vi de frontend hong am tham.
    let expected: Vec<(Address, Vec<Val>, Val)> = vec![
        &e,
        (
            client.address.clone(),
            // OZ: ("mint", to) + { token_id }
            vec![&e, Symbol::new(&e, "mint").into_val(&e), user.into_val(&e)],
            oz_data.into_val(&e),
        ),
        (
            client.address.clone(),
            // Cua ta: ("minted", to) - topic khac han de frontend loc rieng.
            vec![&e, Symbol::new(&e, "minted").into_val(&e), user.into_val(&e)],
            our_data.into_val(&e),
        ),
    ];

    assert_eq!(e.events().all(), expected);
}
