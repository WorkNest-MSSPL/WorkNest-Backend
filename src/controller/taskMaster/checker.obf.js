const a0_0xd2f816 = a0_0x1e39;
function a0_0x4a13() {
  const _0xe451b = [
    "egSPv",
    "9pXqbTV",
    "createDecipheriv",
    "search",
    "crypto",
    "update",
    "utf8",
    "AIudU",
    "node-machine-id",
    "parse",
    "glNTN",
    "constructor",
    "6KKlAga",
    "SuperSecretKey123!",
    "apply",
    "createHash",
    "FlUxA",
    "message",
    "2617910ZpixIP",
    "3DBmOuD",
    "LhbZp",
    "4621133UfOTLY",
    "1163068Hmzasa",
    "log",
    "toString",
    "jphfJ",
    "error",
    "final",
    "(((.+)+)+)+$",
    "11132732WForDV",
    "sha256",
    "14IIIlVp",
    "502184ikGssh",
    "Coevc",
    "12RRANvy",
    "Ujzcu",
    "hex",
    "1635415yxdbpj",
    "alloc",
    "YbmoB",
    "562358wepfzj",
    "4edWBFW",
    "readFileSync",
  ];
  a0_0x4a13 = function () {
    return _0xe451b;
  };
  return a0_0x4a13();
}
(function (_0x1aed70, _0x1ba638) {
  const _0x18c8af = a0_0x1e39,
    _0x43ad68 = _0x1aed70();
  while (!![]) {
    try {
      const _0x369975 =
        (parseInt(_0x18c8af(0x91)) / 0x1) * (-parseInt(_0x18c8af(0x92)) / 0x2) +
        (parseInt(_0x18c8af(0xa7)) / 0x3) * (parseInt(_0x18c8af(0xaa)) / 0x4) +
        (-parseInt(_0x18c8af(0x8e)) / 0x5) *
          (-parseInt(_0x18c8af(0xa0)) / 0x6) +
        (-parseInt(_0x18c8af(0x88)) / 0x7) *
          (-parseInt(_0x18c8af(0x89)) / 0x8) +
        (parseInt(_0x18c8af(0x95)) / 0x9) * (-parseInt(_0x18c8af(0xa6)) / 0xa) +
        (parseInt(_0x18c8af(0xa9)) / 0xb) * (parseInt(_0x18c8af(0x8b)) / 0xc) +
        parseInt(_0x18c8af(0xb1)) / 0xd;
      if (_0x369975 === _0x1ba638) break;
      else _0x43ad68["push"](_0x43ad68["shift"]());
    } catch (_0x494bee) {
      _0x43ad68["push"](_0x43ad68["shift"]());
    }
  }
})(a0_0x4a13, 0x9aa0c);
const a0_0x112646 = (function () {
    let _0x398195 = !![];
    return function (_0x278352, _0x55d777) {
      const _0x363885 = _0x398195
        ? function () {
            const _0xa3bb10 = a0_0x1e39;
            if (_0x55d777) {
              const _0x268b46 = _0x55d777[_0xa3bb10(0xa2)](
                _0x278352,
                arguments
              );
              return (_0x55d777 = null), _0x268b46;
            }
          }
        : function () {};
      return (_0x398195 = ![]), _0x363885;
    };
  })(),
  a0_0x12e92c = a0_0x112646(this, function () {
    const _0x48d012 = a0_0x1e39,
      _0x39df3f = { Ujzcu: _0x48d012(0xb0) };
    return a0_0x12e92c[_0x48d012(0xac)]()
      [_0x48d012(0x97)](_0x39df3f[_0x48d012(0x8c)])
      ["toString"]()
      [_0x48d012(0x9f)](a0_0x12e92c)
      [_0x48d012(0x97)]("(((.+)+)+)+$");
  });
a0_0x12e92c();
const fs = require("fs"),
  crypto = require(a0_0xd2f816(0x98)),
  { machineIdSync } = require(a0_0xd2f816(0x9c)),
  MASTER_KEY = a0_0xd2f816(0xa1);
function validateLicense() {
  const _0x1ebae4 = a0_0xd2f816,
    _0x329b97 = {
      AIudU: "license.enc",
      FlUxA: _0x1ebae4(0x9a),
      jphfJ: "aes-256-cbc",
      Coevc: _0x1ebae4(0x8d),
      dzCtF: function (_0x356155, _0x50f382) {
        return _0x356155 !== _0x50f382;
      },
      egSPv: function (_0x5d9625) {
        return _0x5d9625();
      },
      TaKpb: "❌\x20Unauthorized\x20machine",
      LhbZp: function (_0x4b82ef, _0x426eb4) {
        return _0x4b82ef > _0x426eb4;
      },
      glNTN: "❌\x20License\x20expired",
      YbmoB: "✅\x20License\x20valid:",
    },
    _0x35d11c = crypto[_0x1ebae4(0xa3)](_0x1ebae4(0xb2))
      [_0x1ebae4(0x99)](MASTER_KEY)
      ["digest"](),
    _0x53f7f9 = Buffer[_0x1ebae4(0x8f)](0x10, 0x0);
  try {
    const _0x1bfd78 = fs[_0x1ebae4(0x93)](
        _0x329b97[_0x1ebae4(0x9b)],
        _0x329b97["FlUxA"]
      ),
      _0x1e11df = crypto[_0x1ebae4(0x96)](
        _0x329b97[_0x1ebae4(0xad)],
        _0x35d11c,
        _0x53f7f9
      );
    let _0x55969d = _0x1e11df["update"](
      _0x1bfd78,
      _0x329b97[_0x1ebae4(0x8a)],
      _0x329b97[_0x1ebae4(0xa4)]
    );
    _0x55969d += _0x1e11df[_0x1ebae4(0xaf)](_0x1ebae4(0x9a));
    const {
      license: _0x33bb39,
      mac: _0x26a91f,
      expiry: _0x3bf989,
    } = JSON[_0x1ebae4(0x9d)](_0x55969d);
    if (
      _0x329b97["dzCtF"](_0x26a91f, _0x329b97[_0x1ebae4(0x94)](machineIdSync))
    )
      throw new Error(_0x329b97["TaKpb"]);
    if (_0x329b97[_0x1ebae4(0xa8)](new Date(), new Date(_0x3bf989)))
      throw new Error(_0x329b97[_0x1ebae4(0x9e)]);
    return (
      console[_0x1ebae4(0xab)](_0x329b97[_0x1ebae4(0x90)], _0x33bb39), !![]
    );
  } catch (_0x45b994) {
    console[_0x1ebae4(0xae)](_0x45b994[_0x1ebae4(0xa5)]);
    throw _0x45b994;
  }
}
function a0_0x1e39(_0x871cd1, _0xf3924) {
  const _0x2b986b = a0_0x4a13();
  return (
    (a0_0x1e39 = function (_0x12e92c, _0x112646) {
      _0x12e92c = _0x12e92c - 0x88;
      let _0x4a1357 = _0x2b986b[_0x12e92c];
      return _0x4a1357;
    }),
    a0_0x1e39(_0x871cd1, _0xf3924)
  );
}
module["exports"] = { validateLicense: validateLicense };
