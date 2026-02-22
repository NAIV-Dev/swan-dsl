// ─────────────────────────────────────────────────────────────────────────────
// SWAN DSL — Moo Lexer
// ─────────────────────────────────────────────────────────────────────────────

import moo from "moo";

// All DSL keywords — must come before the general IDENT rule so moo
// matches them by their longest-match keyword priority.
export const KEYWORDS = [
    "app",
    "page",
    "component",
    "entry",
    "use",
    "header",
    "text",
    "button",
    "link",
    "field",
    "input",
    "submit",
    "click",
    "on",
    "if",
    "query",
    "string",
    "number",
    "boolean",
    "true",
    "false",
    "password",
    "email",
    "date",
    "dropdown",
    "radio",
    // ── Table keywords ──────────────────────────────────────────────────────
    "table",
    "columns",
    "row",
    // ── Chart keywords ──────────────────────────────────────────────────────
    "chart",
    "series",
    "point",
    // ── Chart type keywords ─────────────────────────────────────────────────
    "bar",
    "line",
    "pie",
    "area",
    "scatter",
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export type TokenType =
    | Keyword
    | "IDENT"
    | "STRING"
    | "NUMBER"
    | "ARROW"
    | "LBRACE"
    | "RBRACE"
    | "LBRACKET"
    | "RBRACKET"
    | "COMMA"
    | "DOT"
    | "EQ"
    | "NEQ"
    | "LTE"
    | "GTE"
    | "LT"
    | "GT"
    | "AND"
    | "OR"
    | "BANG"
    | "ASSIGN"
    | "COLON"
    | "QUESTION"
    | "AMPERSAND"
    | "PLUS"
    | "NL"
    | "WS"
    | "COMMENT";

// Build the moo lexer rules.
// moo uses longest-match semantics and processes rules top-to-bottom
// within equal-length matches, so operators with shared prefixes must
// be listed longest-first (e.g. "<=" before "<").
export const lexer = moo.compile({
    WS: { match: /[ \t]+/, lineBreaks: false },
    NL: { match: /\r?\n/, lineBreaks: true },
    COMMENT: /\/\/[^\n]*/,
    // Multi-char operators (longest first to avoid prefix collisions)
    ARROW: "->",
    EQ: "==",
    NEQ: "!=",
    LTE: "<=",
    GTE: ">=",
    AND: "&&",
    OR: "||",
    // Single-char operators / punctuation
    LT: "<",
    GT: ">",
    BANG: "!",
    LBRACE: "{",
    RBRACE: "}",
    LBRACKET: "[",
    RBRACKET: "]",
    COMMA: ",",
    DOT: ".",
    COLON: ":",
    QUESTION: "?",
    AMPERSAND: "&",
    PLUS: "+",
    // Assignment = (must come after EQ "==" check; moo checks longest match first)
    ASSIGN: "=",
    // Literals
    STRING: { match: /"[^"]*"/, value: (s) => s.slice(1, -1) },
    NUMBER: {
        match: /[0-9]+(?:\.[0-9]+)?/,
        value: (s) => s,
    },
    // Keywords and identifiers — moo.keywords maps specific values
    // of the IDENT rule to their keyword token type automatically.
    IDENT: {
        match: /[A-Za-z][A-Za-z0-9_]*/,
        type: moo.keywords(
            Object.fromEntries(KEYWORDS.map((k) => [k, k])) as Record<
                Keyword,
                Keyword
            >,
        ),
    },
});
