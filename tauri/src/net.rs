// Network rules for the full app (calendar feed, updates), the same as electron/main.js:
// https only on every redirect hop, size and time caps, no cookies, and only public addresses. The address check runs
// in the DNS resolver itself, so the address that was checked is the one connected to (no rebinding window).
use std::{net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr}, sync::Arc, time::Duration};

fn v4_public(a: Ipv4Addr) -> bool {
    let o = a.octets();
    let n = u32::from(a);
    let inn = |base: [u8; 4], bits: u32| { let b = u32::from(Ipv4Addr::from(base)); let m = if bits == 0 { 0 } else { u32::MAX << (32 - bits) }; n & m == b & m };
    !(inn([0, 0, 0, 0], 8) || inn([10, 0, 0, 0], 8) || inn([100, 64, 0, 0], 10) || inn([127, 0, 0, 0], 8) || inn([169, 254, 0, 0], 16)
        || inn([172, 16, 0, 0], 12) || inn([192, 0, 0, 0], 24) || inn([192, 0, 2, 0], 24) || inn([192, 168, 0, 0], 16)
        || inn([198, 18, 0, 0], 15) || inn([198, 51, 100, 0], 24) || inn([203, 0, 113, 0], 24) || o[0] >= 224)
}

// IPv6 fails closed: only global unicast (2000::/3) outside special-purpose ranges; forms that carry an IPv4
// address (mapped ::ffff:, NAT64 64:ff9b::, 6to4 2002::) are judged by that IPv4 address
fn v6_public(a: Ipv6Addr) -> bool {
    let s = a.segments();
    if let Some(v4) = a.to_ipv4_mapped() { return v4_public(v4); }
    if s[0] == 0x64 && s[1] == 0xff9b && s[2..6] == [0, 0, 0, 0] { return v4_public(Ipv4Addr::new((s[6] >> 8) as u8, s[6] as u8, (s[7] >> 8) as u8, s[7] as u8)); }
    if s[0] == 0x2002 { return v4_public(Ipv4Addr::new((s[1] >> 8) as u8, s[1] as u8, (s[2] >> 8) as u8, s[2] as u8)); }
    let global = s[0] & 0xe000 == 0x2000;
    let special = (s[0] == 0x2001 && s[1] == 0) || (s[0] == 0x2001 && s[1] == 0x0db8);
    global && !special
}

pub fn is_public(ip: IpAddr) -> bool {
    match ip { IpAddr::V4(a) => v4_public(a), IpAddr::V6(a) => v6_public(a) }
}

// a resolver that refuses names with any non-public address
struct PublicOnly;
impl reqwest::dns::Resolve for PublicOnly {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), 443)).await?.collect();
            if addrs.is_empty() || !addrs.iter().all(|a| is_public(a.ip())) {
                return Err(Box::<dyn std::error::Error + Send + Sync>::from("private address"));
            }
            Ok(Box::new(addrs.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

pub fn client(timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .dns_resolver(Arc::new(PublicOnly))
        .redirect(reqwest::redirect::Policy::none()) // every hop is checked by the caller
        .timeout(timeout)
        .user_agent("Groundwork Habits")
        .build()
        .expect("http client")
}

pub enum Got { Body(Vec<u8>), Redirect(String), Status(u16), TooBig }

// one request: an IP-literal host is checked here (the resolver only sees names); the body is capped at `max`
pub async fn get_once(c: &reqwest::Client, url: &reqwest::Url, max: usize, accept: &str) -> Result<Got, String> {
    if let Some(h) = url.host() {
        let ip = match h { url::Host::Ipv4(a) => Some(IpAddr::V4(a)), url::Host::Ipv6(a) => Some(IpAddr::V6(a)), _ => None };
        if let Some(ip) = ip { if !is_public(ip) { return Err("private address".into()); } }
    }
    let mut r = c.get(url.clone()).header("Accept", accept).send().await.map_err(|e| if format!("{e:?}").contains("private address") { "private address".to_string() } else { e.to_string() })?;
    let st = r.status().as_u16();
    if (300..400).contains(&st) {
        if let Some(l) = r.headers().get("location").and_then(|v| v.to_str().ok()) { return Ok(Got::Redirect(l.to_string())); }
    }
    if st != 200 { return Ok(Got::Status(st)); }
    if r.content_length().map_or(false, |n| n as usize > max) { return Ok(Got::TooBig); }
    let mut body = Vec::new();
    while let Some(chunk) = r.chunk().await.map_err(|e| e.to_string())? {
        body.extend_from_slice(&chunk);
        if body.len() > max { return Ok(Got::TooBig); }
    }
    Ok(Got::Body(body))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn p(s: &str) -> bool { is_public(s.parse().unwrap()) }
    #[test]
    fn private_and_special_v4_are_refused() {
        for a in ["0.1.2.3", "10.0.0.1", "100.64.1.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.0.0.8",
                  "192.0.2.1", "192.168.1.1", "198.18.0.1", "198.51.100.7", "203.0.113.9", "224.0.0.1", "255.255.255.255"] {
            assert!(!p(a), "{a} must be refused");
        }
    }
    #[test]
    fn public_v4_is_allowed() { for a in ["8.8.8.8", "140.82.112.3", "172.32.0.1", "1.1.1.1"] { assert!(p(a), "{a} is public"); } }
    #[test]
    fn v6_rules() {
        for a in ["::1", "::", "fe80::1", "fc00::1", "fd12::1", "ff02::1", "2001:db8::1", "2001::1", "::ffff:127.0.0.1", "::ffff:7f00:1",
                  "64:ff9b::a00:1", "2002:c0a8:0101::1", "100::1"] {
            assert!(!p(a), "{a} must be refused");
        }
        for a in ["2606:4700:4700::1111", "2a00:1450:4001:80b::200e", "::ffff:8.8.8.8", "2002:0808:0808::1"] { assert!(p(a), "{a} is public"); }
    }
}
