# Vendored Geist fonts

Used to render share cards and the profile OG image on the server. They are
committed rather than fetched at runtime because Google Fonts changes the format
it serves based on the request's User-Agent, and both card paths need the bytes
before they can respond.

| File                        | Used by                                     |
| --------------------------- | ------------------------------------------- |
| `Geist-Regular.ttf`         | `next/og` profile card (satori needs ttf)   |
| `Geist-Bold.ttf`            | `next/og` profile card                      |
| `GeistMono-Regular.ttf`     | `next/og` profile card                      |
| `Geist-Variable.woff2`      | SVG share cards, inlined as a data URI      |
| `GeistMono-Variable.woff2`  | SVG share cards, inlined as a data URI      |

Geist and Geist Mono are by Vercel, licensed under the SIL Open Font License
1.1: https://github.com/vercel/geist-font

Static `.ttf` instances and latin-subset variable `.woff2` files come from Google
Fonts (`Geist` v5, `Geist Mono` v6).
