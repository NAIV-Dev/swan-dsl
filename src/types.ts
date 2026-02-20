// ─────────────────────────────────────────────────────────────────────────────
// SWAN DSL — Strict TypeScript AST Types
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Source position
// ---------------------------------------------------------------------------

export interface Position {
    line: number;
    col: number;
}

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

export interface StringLiteral {
    kind: "StringLiteral";
    value: string;
    pos: Position;
}

export interface NumberLiteral {
    kind: "NumberLiteral";
    value: number;
    pos: Position;
}

export interface BooleanLiteral {
    kind: "BooleanLiteral";
    value: boolean;
    pos: Position;
}

export type Literal = StringLiteral | NumberLiteral | BooleanLiteral;

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

export interface IdentifierExpr {
    kind: "IdentifierExpr";
    name: string;
    pos: Position;
}

/** Dot-access: user.role, session.token, env.name, query.page */
export interface MemberExpr {
    kind: "MemberExpr";
    object: IdentifierExpr;
    member: string;
    pos: Position;
}

export type BinaryOperator =
    | "=="
    | "!="
    | "<"
    | ">"
    | "<="
    | ">="
    | "&&"
    | "||"
    | "+";

export interface BinaryExpr {
    kind: "BinaryExpr";
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
    pos: Position;
}

export interface UnaryExpr {
    kind: "UnaryExpr";
    operator: "!";
    operand: Expression;
    pos: Position;
}

export type Expression =
    | IdentifierExpr
    | MemberExpr
    | Literal
    | BinaryExpr
    | UnaryExpr;

// ---------------------------------------------------------------------------
// Query parameter type annotation
// ---------------------------------------------------------------------------

/** The type keyword used in a query declaration: `query key : <QueryType>` */
export type QueryType = "string" | "number" | "boolean";

// ---------------------------------------------------------------------------
// Navigation target
// ---------------------------------------------------------------------------

/**
 * A single query argument passed in a navigation target's query string.
 * e.g. `-> Search?q="hello"&page=2`  →  [{ key:"q", value:StringLiteral },
 *                                         { key:"page", value:NumberLiteral }]
 */
export interface QueryArg {
    key: string;
    value: Expression;
    pos: Position;
}

export interface NavTarget {
    /** The page identifier this navigation points to */
    target: string;
    /** Optional inline query args: `-> Page?key=expr&key2=expr2` */
    queryArgs?: QueryArg[];
    pos: Position;
}

// ---------------------------------------------------------------------------
// Outcome clause  (inside `on` handler)
// ---------------------------------------------------------------------------

export interface OutcomeClause {
    /** The outcome label, e.g. "success" or "error" */
    outcome: string;
    /** The page identifier to navigate to */
    target: string;
    pos: Position;
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export interface HeaderStmt {
    kind: "HeaderStmt";
    text: string;
    pos: Position;
}

export interface TextStmt {
    kind: "TextStmt";
    text: string;
    pos: Position;
}

export interface ButtonStmt {
    kind: "ButtonStmt";
    label: string;
    nav: NavTarget;
    pos: Position;
}

export interface LinkStmt {
    kind: "LinkStmt";
    label: string;
    nav: NavTarget;
    pos: Position;
}

export interface FieldStmt {
    kind: "FieldStmt";
    name: string;
    pos: Position;
}

export interface InputStmt {
    kind: "InputStmt";
    name: string;
    pos: Position;
}

export interface UseStmt {
    kind: "UseStmt";
    component: string;
    pos: Position;
}

export interface SubmitStmt {
    kind: "SubmitStmt";
    label: string;
    action: string;
    pos: Position;
}

export interface ClickStmt {
    kind: "ClickStmt";
    label: string;
    action: string;
    pos: Position;
}

export interface HandlerStmt {
    kind: "HandlerStmt";
    action: string;
    outcomes: OutcomeClause[];
    pos: Position;
}

export interface ConditionalStmt {
    kind: "ConditionalStmt";
    condition: Expression;
    body: Statement[];
    pos: Position;
}

/**
 * Declares a URL query parameter accepted by a page.
 *
 * Syntax:  `query <name> [: <type>] [= <default>]`
 *
 * Example: `query page : number = 1`
 *
 * Only valid inside `page` blocks (enforced by SR-7).
 */
export interface QueryStmt {
    kind: "QueryStmt";
    /** The query parameter key (maps to `?key=value` in the URL) */
    name: string;
    /** Optional type annotation */
    valueType?: QueryType;
    /** Optional default value when the parameter is absent */
    defaultValue?: Literal;
    pos: Position;
}

export type Statement =
    | HeaderStmt
    | TextStmt
    | ButtonStmt
    | LinkStmt
    | FieldStmt
    | InputStmt
    | UseStmt
    | SubmitStmt
    | ClickStmt
    | HandlerStmt
    | ConditionalStmt
    | QueryStmt;

// ---------------------------------------------------------------------------
// Top-level declarations
// ---------------------------------------------------------------------------

export interface AppDecl {
    kind: "AppDecl";
    name: string;
    entry: string;
    pos: Position;
}

export interface PageDecl {
    kind: "PageDecl";
    name: string;
    body: Statement[];
    pos: Position;
}

export interface ComponentDecl {
    kind: "ComponentDecl";
    name: string;
    body: Statement[];
    pos: Position;
}

// ---------------------------------------------------------------------------
// Program (root)
// ---------------------------------------------------------------------------

export interface Program {
    kind: "Program";
    app: AppDecl;
    pages: PageDecl[];
    components: ComponentDecl[];
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ParseError extends Error {
    constructor(
        message: string,
        public readonly pos: Position,
    ) {
        super(`ParseError at ${pos.line}:${pos.col} — ${message}`);
        this.name = "ParseError";
    }
}

export type SemanticRuleCode =
    | "SR-1"
    | "SR-2"
    | "SR-3"
    | "SR-4"
    | "SR-5"
    | "SR-6"
    | "SR-7"
    | "SR-8"
    | "SR-9";

export class SemanticError extends Error {
    constructor(
        public readonly rule: SemanticRuleCode,
        message: string,
        public readonly pos?: Position,
    ) {
        const loc = pos ? ` at ${pos.line}:${pos.col}` : "";
        super(`SemanticError [${rule}]${loc} — ${message}`);
        this.name = "SemanticError";
    }
}

// ---------------------------------------------------------------------------
// Public parse options
// ---------------------------------------------------------------------------

export interface ParseOptions {
    /** Enable SR-4: all pages must be reachable from entry */
    strictMode?: boolean;
}
