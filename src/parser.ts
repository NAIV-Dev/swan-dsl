// ─────────────────────────────────────────────────────────────────────────────
// SWAN DSL — Hand-crafted Recursive Descent Parser
// ─────────────────────────────────────────────────────────────────────────────

import type { Token } from "moo";
import { lexer } from "./lexer";
import {
    ParseError,
    type AppDecl,
    type BinaryExpr,
    type BinaryOperator,
    type BooleanLiteral,
    type ButtonStmt,
    type ClickStmt,
    type ComponentDecl,
    type ConditionalStmt,
    type Expression,
    type FieldStmt,
    type HandlerStmt,
    type HeaderStmt,
    type IdentifierExpr,
    type InputStmt,
    type LinkStmt,
    type MemberExpr,
    type NavTarget,
    type NumberLiteral,
    type OutcomeClause,
    type PageDecl,
    type Position,
    type Program,
    type Statement,
    type StringLiteral,
    type SubmitStmt,
    type TextStmt,
    type UnaryExpr,
    type UseStmt,
} from "./types";

// ---------------------------------------------------------------------------
// Token stream helpers
// ---------------------------------------------------------------------------

/** Tokens we actively care about (skip WS, NL, COMMENT). */
const SKIP_TYPES = new Set(["WS", "NL", "COMMENT"]);

export class Parser {
    private tokens: Token[] = [];
    private pos = 0;

    constructor(input: string) {
        lexer.reset(input);
        for (const tok of lexer) {
            if (!SKIP_TYPES.has(tok.type ?? "")) {
                this.tokens.push(tok as Token);
            }
        }
    }

    // ─── Token stream primitives ──────────────────────────────────────────────

    private peek(): Token | undefined {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        const tok = this.tokens[this.pos];
        if (!tok) throw new ParseError("Unexpected end of input", { line: 0, col: 0 });
        this.pos++;
        return tok;
    }

    private isAtEnd(): boolean {
        return this.pos >= this.tokens.length;
    }

    private tokenPos(tok: Token): Position {
        return { line: tok.line, col: tok.col };
    }

    private currentPos(): Position {
        const tok = this.peek();
        return tok ? this.tokenPos(tok) : { line: 0, col: 0 };
    }

    /**
     * Expect a token of the given type (or value) and advance.
     * Throws ParseError if the next token doesn't match.
     */
    private expect(typeOrValue: string): Token {
        const tok = this.peek();
        if (!tok) {
            throw new ParseError(
                `Expected "${typeOrValue}" but reached end of input`,
                { line: 0, col: 0 },
            );
        }
        if (tok.type !== typeOrValue && tok.value !== typeOrValue) {
            throw new ParseError(
                `Expected "${typeOrValue}" but got "${tok.value}" (${tok.type})`,
                this.tokenPos(tok),
            );
        }
        return this.advance();
    }

    /**
     * Consume a token only if it matches the given type/value.
     */
    private match(typeOrValue: string): Token | null {
        const tok = this.peek();
        if (tok && (tok.type === typeOrValue || tok.value === typeOrValue)) {
            return this.advance();
        }
        return null;
    }

    private check(typeOrValue: string): boolean {
        const tok = this.peek();
        return tok !== undefined &&
            (tok.type === typeOrValue || tok.value === typeOrValue);
    }

    // ─── Entry point ──────────────────────────────────────────────────────────

    parseProgram(): Program {
        const app = this.parseAppDecl();
        const pages: PageDecl[] = [];
        const components: ComponentDecl[] = [];

        while (!this.isAtEnd()) {
            const tok = this.peek()!;
            if (tok.type === "page") {
                pages.push(this.parsePageDecl());
            } else if (tok.type === "component") {
                components.push(this.parseComponentDecl());
            } else {
                throw new ParseError(
                    `Unexpected token "${tok.value}" — expected "page" or "component"`,
                    this.tokenPos(tok),
                );
            }
        }

        return { kind: "Program", app, pages, components };
    }

    // ─── App declaration ──────────────────────────────────────────────────────

    private parseAppDecl(): AppDecl {
        const appTok = this.expect("app");
        const nameTok = this.expectIdent();
        this.expect("LBRACE");
        this.expect("entry");
        const entryTok = this.expectIdent();
        this.expect("RBRACE");

        return {
            kind: "AppDecl",
            name: nameTok.value,
            entry: entryTok.value,
            pos: this.tokenPos(appTok),
        };
    }

    // ─── Page declaration ────────────────────────────────────────────────────

    private parsePageDecl(): PageDecl {
        const pageTok = this.expect("page");
        const nameTok = this.expectIdent();
        const body = this.parseBlock();

        return {
            kind: "PageDecl",
            name: nameTok.value,
            body,
            pos: this.tokenPos(pageTok),
        };
    }

    // ─── Component declaration ───────────────────────────────────────────────

    private parseComponentDecl(): ComponentDecl {
        const compTok = this.expect("component");
        const nameTok = this.expectIdent();
        const body = this.parseBlock();

        return {
            kind: "ComponentDecl",
            name: nameTok.value,
            body,
            pos: this.tokenPos(compTok),
        };
    }

    // ─── Block ────────────────────────────────────────────────────────────────

    private parseBlock(): Statement[] {
        this.expect("LBRACE");
        const stmts: Statement[] = [];

        while (!this.check("RBRACE") && !this.isAtEnd()) {
            stmts.push(this.parseStatement());
        }

        this.expect("RBRACE");
        return stmts;
    }

    // ─── Statements ──────────────────────────────────────────────────────────

    private parseStatement(): Statement {
        const tok = this.peek();
        if (!tok) {
            throw new ParseError("Unexpected end of input inside block", {
                line: 0,
                col: 0,
            });
        }

        switch (tok.type) {
            case "header": return this.parseHeaderStmt();
            case "text": return this.parseTextStmt();
            case "button": return this.parseButtonStmt();
            case "link": return this.parseLinkStmt();
            case "field": return this.parseFieldStmt();
            case "input": return this.parseInputStmt();
            case "use": return this.parseUseStmt();
            case "submit": return this.parseSubmitStmt();
            case "click": return this.parseClickStmt();
            case "on": return this.parseHandlerStmt();
            case "if": return this.parseConditionalStmt();
            default:
                throw new ParseError(
                    `Unexpected token "${tok.value}" — not a valid statement keyword`,
                    this.tokenPos(tok),
                );
        }
    }

    // -- UI statements ---------------------------------------------------------

    private parseHeaderStmt(): HeaderStmt {
        const kw = this.expect("header");
        const str = this.expectString();
        return { kind: "HeaderStmt", text: str.value, pos: this.tokenPos(kw) };
    }

    private parseTextStmt(): TextStmt {
        const kw = this.expect("text");
        const str = this.expectString();
        return { kind: "TextStmt", text: str.value, pos: this.tokenPos(kw) };
    }

    private parseButtonStmt(): ButtonStmt {
        const kw = this.expect("button");
        const str = this.expectString();
        const nav = this.parseNavTarget();
        return { kind: "ButtonStmt", label: str.value, nav, pos: this.tokenPos(kw) };
    }

    private parseLinkStmt(): LinkStmt {
        const kw = this.expect("link");
        const str = this.expectString();
        const nav = this.parseNavTarget();
        return { kind: "LinkStmt", label: str.value, nav, pos: this.tokenPos(kw) };
    }

    private parseFieldStmt(): FieldStmt {
        const kw = this.expect("field");
        const id = this.expectIdent();
        return { kind: "FieldStmt", name: id.value, pos: this.tokenPos(kw) };
    }

    private parseInputStmt(): InputStmt {
        const kw = this.expect("input");
        const id = this.expectIdent();
        return { kind: "InputStmt", name: id.value, pos: this.tokenPos(kw) };
    }

    // -- Component use ---------------------------------------------------------

    private parseUseStmt(): UseStmt {
        const kw = this.expect("use");
        const id = this.expectIdent();
        return { kind: "UseStmt", component: id.value, pos: this.tokenPos(kw) };
    }

    // -- Action statements -----------------------------------------------------

    private parseSubmitStmt(): SubmitStmt {
        const kw = this.expect("submit");
        const str = this.expectString();
        this.expect("ARROW");
        const id = this.expectIdent();
        return {
            kind: "SubmitStmt",
            label: str.value,
            action: id.value,
            pos: this.tokenPos(kw),
        };
    }

    private parseClickStmt(): ClickStmt {
        const kw = this.expect("click");
        const str = this.expectString();
        this.expect("ARROW");
        const id = this.expectIdent();
        return {
            kind: "ClickStmt",
            label: str.value,
            action: id.value,
            pos: this.tokenPos(kw),
        };
    }

    // -- Handler statement -----------------------------------------------------

    private parseHandlerStmt(): HandlerStmt {
        const kw = this.expect("on");
        const actionTok = this.expectIdent();
        this.expect("LBRACE");

        const outcomes: OutcomeClause[] = [];
        while (!this.check("RBRACE") && !this.isAtEnd()) {
            outcomes.push(this.parseOutcomeClause());
        }

        this.expect("RBRACE");

        return {
            kind: "HandlerStmt",
            action: actionTok.value,
            outcomes,
            pos: this.tokenPos(kw),
        };
    }

    private parseOutcomeClause(): OutcomeClause {
        const outcomeTok = this.expectIdent();
        const arrowTok = this.expect("ARROW");
        const targetTok = this.expectIdent();

        return {
            outcome: outcomeTok.value,
            target: targetTok.value,
            pos: this.tokenPos(outcomeTok),
        };
    }

    // -- Conditional statement -------------------------------------------------

    private parseConditionalStmt(): ConditionalStmt {
        const kw = this.expect("if");
        const condition = this.parseExpression();
        const body = this.parseBlock();

        return { kind: "ConditionalStmt", condition, body, pos: this.tokenPos(kw) };
    }

    // ─── Navigation target ────────────────────────────────────────────────────

    private parseNavTarget(): NavTarget {
        const arrowTok = this.expect("ARROW");
        const targetTok = this.expectIdent();
        return { target: targetTok.value, pos: this.tokenPos(arrowTok) };
    }

    // ─── Expressions (operator precedence, left-to-right) ────────────────────
    //
    //  Precedence (lowest → highest):
    //    1. || (binary OR)
    //    2. && (binary AND)
    //    3. == != < > <= >= (comparison)
    //    4. primary / unary !

    parseExpression(): Expression {
        return this.parseOr();
    }

    private parseOr(): Expression {
        let left = this.parseAnd();
        while (this.check("OR")) {
            const opTok = this.advance();
            const right = this.parseAnd();
            const expr: BinaryExpr = {
                kind: "BinaryExpr",
                operator: "||",
                left,
                right,
                pos: this.tokenPos(opTok),
            };
            left = expr;
        }
        return left;
    }

    private parseAnd(): Expression {
        let left = this.parseComparison();
        while (this.check("AND")) {
            const opTok = this.advance();
            const right = this.parseComparison();
            const expr: BinaryExpr = {
                kind: "BinaryExpr",
                operator: "&&",
                left,
                right,
                pos: this.tokenPos(opTok),
            };
            left = expr;
        }
        return left;
    }

    private readonly COMPARISON_OPS = new Map<string, BinaryOperator>([
        ["EQ", "=="],
        ["NEQ", "!="],
        ["LT", "<"],
        ["GT", ">"],
        ["LTE", "<="],
        ["GTE", ">="],
    ]);

    private parseComparison(): Expression {
        let left = this.parseUnary();
        const tok = this.peek();
        if (tok && this.COMPARISON_OPS.has(tok.type ?? "")) {
            const opTok = this.advance();
            const operator = this.COMPARISON_OPS.get(opTok.type ?? "")!;
            const right = this.parseUnary();
            const expr: BinaryExpr = {
                kind: "BinaryExpr",
                operator,
                left,
                right,
                pos: this.tokenPos(opTok),
            };
            return expr;
        }
        return left;
    }

    private parseUnary(): Expression {
        if (this.check("BANG")) {
            const bangTok = this.advance();
            const operand = this.parsePrimary();
            const expr: UnaryExpr = {
                kind: "UnaryExpr",
                operator: "!",
                operand,
                pos: this.tokenPos(bangTok),
            };
            return expr;
        }
        return this.parsePrimary();
    }

    private parsePrimary(): Expression {
        const tok = this.peek();
        if (!tok) {
            throw new ParseError("Expected an expression but reached end of input", {
                line: 0,
                col: 0,
            });
        }

        // Boolean literal
        if (tok.type === "true" || tok.type === "false") {
            this.advance();
            const lit: BooleanLiteral = {
                kind: "BooleanLiteral",
                value: tok.type === "true",
                pos: this.tokenPos(tok),
            };
            return lit;
        }

        // String literal
        if (tok.type === "STRING") {
            this.advance();
            const lit: StringLiteral = {
                kind: "StringLiteral",
                value: tok.value,
                pos: this.tokenPos(tok),
            };
            return lit;
        }

        // Number literal
        if (tok.type === "NUMBER") {
            this.advance();
            const lit: NumberLiteral = {
                kind: "NumberLiteral",
                value: parseFloat(tok.value),
                pos: this.tokenPos(tok),
            };
            return lit;
        }

        // Identifier or member expression (user.role)
        if (tok.type === "IDENT") {
            this.advance();
            const base: IdentifierExpr = {
                kind: "IdentifierExpr",
                name: tok.value,
                pos: this.tokenPos(tok),
            };
            if (this.check("DOT")) {
                this.advance(); // consume "."
                const memberTok = this.expectIdent();
                const member: MemberExpr = {
                    kind: "MemberExpr",
                    object: base,
                    member: memberTok.value,
                    pos: this.tokenPos(tok),
                };
                return member;
            }
            return base;
        }

        throw new ParseError(
            `Unexpected token "${tok.value}" in expression`,
            this.tokenPos(tok),
        );
    }

    // ─── Small helpers ───────────────────────────────────────────────────────

    /**
     * Expect an IDENT token (not a keyword).
     * Moo assigns keyword token types to matched words, so we need to accept
     * both generic IDENT tokens and keyword tokens when used as identifiers
     * (e.g. outcome labels like "success", "error").
     */
    private expectIdent(): Token {
        const tok = this.peek();
        if (!tok) {
            throw new ParseError("Expected identifier but reached end of input", {
                line: 0,
                col: 0,
            });
        }
        // Idents are either IDENT type or a keyword being used as a plain word
        // (e.g. outcome names like "success"/"error" inside on-blocks).
        // We accept any non-punctuation, non-literal, non-operator token.
        const tokType = tok.type ?? "";
        const isIdentLike =
            tokType === "IDENT" ||
            // keywords can appear as outcome clause labels (e.g. "success", "error")
            // so accept them here
            [
                "app", "page", "component", "entry", "use", "header", "text",
                "button", "link", "field", "input", "submit", "click", "on", "if",
                "true", "false", // generally disallowed as ident elsewhere; allowed in outcomes
            ].includes(tokType);

        if (!isIdentLike) {
            throw new ParseError(
                `Expected identifier but got "${tok.value}" (${tok.type})`,
                this.tokenPos(tok),
            );
        }
        return this.advance();
    }

    private expectString(): Token {
        const tok = this.peek();
        if (!tok || tok.type !== "STRING") {
            const pos = tok ? this.tokenPos(tok) : { line: 0, col: 0 };
            const got = tok ? `"${tok.value}"` : "end of input";
            throw new ParseError(`Expected string literal but got ${got}`, pos);
        }
        return this.advance();
    }
}

// ---------------------------------------------------------------------------
// Convenience parse function (accepts a DSL source string)
// ---------------------------------------------------------------------------

export function parse(source: string): Program {
    const parser = new Parser(source);
    return parser.parseProgram();
}
