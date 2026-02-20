// ─────────────────────────────────────────────────────────────────────────────
// SWAN DSL — Public API
// ─────────────────────────────────────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import { parse as parseSource } from "./parser";
import { checkSemantics } from "./semantic";
import type { ParseOptions, Program } from "./types";

export type { ParseOptions, Program } from "./types";
export type {
    AppDecl,
    BinaryExpr,
    BinaryOperator,
    BooleanLiteral,
    ButtonStmt,
    ClickStmt,
    ComponentDecl,
    ConditionalStmt,
    Expression,
    FieldStmt,
    HandlerStmt,
    HeaderStmt,
    IdentifierExpr,
    InputStmt,
    LinkStmt,
    Literal,
    MemberExpr,
    NavTarget,
    NumberLiteral,
    OutcomeClause,
    PageDecl,
    Position,
    SemanticRuleCode,
    Statement,
    StringLiteral,
    SubmitStmt,
    TextStmt,
    UnaryExpr,
    UseStmt,
} from "./types.js";
export { ParseError, SemanticError } from "./types.js";

// ---------------------------------------------------------------------------
// parse — from a DSL source string
// ---------------------------------------------------------------------------

/**
 * Parse and semantically validate a SWAN DSL source string.
 *
 * @param source - The DSL program text
 * @param options - Optional: `{ strictMode: true }` enables SR-4 orphan page check
 * @returns A fully-typed `Program` AST
 * @throws {ParseError} on syntax errors
 * @throws {SemanticError} on semantic violations (SR-1 through SR-6)
 */
export function parse(source: string, options: ParseOptions = {}): Program {
    const program = parseSource(source);
    checkSemantics(program, { strictMode: options.strictMode });
    return program;
}

// ---------------------------------------------------------------------------
// parseFile — from a file path
// ---------------------------------------------------------------------------

/**
 * Read a SWAN DSL file from disk, then parse and semantically validate it.
 *
 * @param filePath - Absolute or relative path to the `.swan` / `.dsl` file
 * @param options - Optional: `{ strictMode: true }` enables SR-4 orphan page check
 * @returns A fully-typed `Program` AST
 * @throws {ParseError} on syntax errors
 * @throws {SemanticError} on semantic violations (SR-1 through SR-6)
 */
export async function parseFile(
    filePath: string,
    options: ParseOptions = {},
): Promise<Program> {
    const source = await readFile(filePath, "utf-8");
    return parse(source, options);
}
