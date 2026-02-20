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

/** Dot-access: user.role, session.token, env.name */
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
    | "||";

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
// Navigation target
// ---------------------------------------------------------------------------

export interface NavTarget {
    /** The page identifier this navigation points to */
    target: string;
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
    | ConditionalStmt;

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
    | "SR-6";

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
