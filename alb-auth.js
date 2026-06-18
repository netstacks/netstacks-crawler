// alb-auth.js — verify the AWS ALB OIDC JWT and expose the user's email.
//
// The ALB injects a signed JWT in the `x-amzn-oidc-data` header after OIDC
// sign-in. We verify its ES256 signature against the ALB's regional public key
// (fetched by `kid`, cached per worker) and, only if valid and unexpired,
// return the email claim in the `X-Auth-User` response header. nginx captures
// that via auth_request_set and forwards it to the backend as X-Remote-User.
//
// This runs as an auth_request handler and ALWAYS returns 204 (never blocks):
//   - valid token   -> X-Auth-User: <email>
//   - no token       -> no X-Auth-User (backend falls back to no_auth guest)
//   - invalid / expired / unverifiable token -> no X-Auth-User (fail closed:
//     treated as no identity, never as the claimed user)
// So an attacker who reaches the container directly and forges the header gets
// nothing, even with no_auth disabled.

var keyCache = {}; // kid -> CryptoKey, persists for the worker's lifetime

function b64urlToBuf(s) {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function b64urlToStr(s) {
    return b64urlToBuf(s).toString('utf-8');
}
function pemToDer(pem) {
    var b64 = pem.replace(/-----BEGIN [^-]+-----/, '')
                 .replace(/-----END [^-]+-----/, '')
                 .replace(/\s+/g, '');
    return Buffer.from(b64, 'base64');
}

async function getKey(r, region, kid) {
    if (keyCache[kid]) return keyCache[kid];

    var url = 'https://public-keys.auth.elb.' + region + '.amazonaws.com/' + kid;
    var resp = await ngx.fetch(url);
    if (resp.status !== 200) {
        r.log('alb-auth: key fetch for kid=' + kid + ' returned ' + resp.status);
        return null;
    }
    var pem = await resp.text();
    var key = await crypto.subtle.importKey(
        'spki', pemToDer(pem),
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    keyCache[kid] = key;
    return key;
}

async function verifiedEmail(r) {
    var data = r.headersIn['x-amzn-oidc-data'];
    if (!data) return '';

    var parts = data.split('.');
    if (parts.length !== 3) return '';

    var header = JSON.parse(b64urlToStr(parts[0]));
    if (header.alg !== 'ES256' || !header.kid || !header.signer) return '';

    // Region comes from the signer ARN, e.g.
    // arn:aws:elasticloadbalancing:<region>:<account-id>:loadbalancer/...
    var arn = header.signer.split(':');
    if (arn[2] !== 'elasticloadbalancing') return '';
    var region = arn[3];
    if (!region) return '';

    var key = await getKey(r, region, header.kid);
    if (!key) return '';

    var ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        b64urlToBuf(parts[2]),                 // raw r||s, exactly what WebCrypto wants
        Buffer.from(parts[0] + '.' + parts[1]) // signing input
    );
    if (!ok) { r.log('alb-auth: signature verification failed'); return ''; }

    var claims = JSON.parse(b64urlToStr(parts[1]));
    if (claims.exp && (Date.now() / 1000) > (claims.exp + 60)) {
        r.log('alb-auth: token expired');
        return '';
    }

    return claims.email
        || claims.preferred_username
        || claims.upn
        || claims['cognito:username']
        || claims.sub
        || '';
}

// js_content handler for /api/. Verifies the ALB JWT, stashes the verified email
// in the $alb_remote_user js_var, then internal-redirects to the @backend proxy
// location. internalRedirect keeps the SAME request, so the variable propagates
// and the backend response still streams through proxy_pass (not buffered here).
// On any failure email is empty -> backend sees no X-Remote-User (guest / 401).
async function authAndForward(r) {
    var email = '';
    try {
        email = await verifiedEmail(r);
    } catch (e) {
        r.log('alb-auth: ' + e.message);
    }
    r.variables.alb_remote_user = email;
    r.internalRedirect('@backend');
}

export default { authAndForward };
