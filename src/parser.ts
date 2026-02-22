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
    type ChartPoint,
    type ChartSeries,
    type ChartStmt,
    type ChartType,
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
    type QueryArg,
    type QueryStmt,
    type QueryType,
    type Statement,
    type StringLiteral,
    type SubmitStmt,
    type TableRow,
    type TableStmt,
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
            case "query": return this.parseQueryStmt();
            case "table": return this.parseTableStmt();
            case "chart": return this.parseChartStmt();
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

        let nav: NavTarget | undefined;
        if (this.check("ARROW")) {
            nav = this.parseNavTarget();
        }

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
        this.expect("ARROW");
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

    // -- Query statement -------------------------------------------------------

    /**
     * query <name> [: string | number | boolean] [= <literal>]
     *
     * Only semantically valid inside a `page` block (SR-7 enforced by semantic checker).
     */
    private parseQueryStmt(): QueryStmt {
        const kw = this.expect("query");
        const nameTok = this.expectIdent();

        let valueType: QueryType | undefined;
        let defaultValue: QueryStmt["defaultValue"];

        // Optional type annotation:  `: string | number | boolean`
        if (this.match("COLON")) {
            const typeTok = this.peek();
            if (
                typeTok &&
                (typeTok.type === "string" ||
                    typeTok.type === "number" ||
                    typeTok.type === "boolean")
            ) {
                this.advance();
                valueType = typeTok.value as QueryType;
            } else {
                const pos = typeTok ? this.tokenPos(typeTok) : this.currentPos();
                const got = typeTok ? `"${typeTok.value}"` : "end of input";
                throw new ParseError(
                    `Expected type keyword (string | number | boolean) after ":" but got ${got}`,
                    pos,
                );
            }
        }

        // Optional default value:  `= <literal>`
        if (this.match("ASSIGN")) {
            defaultValue = this.parseLiteral();
        }

        return {
            kind: "QueryStmt",
            name: nameTok.value,
            valueType,
            defaultValue,
            pos: this.tokenPos(kw),
        };
    }

    // -- Table statement -------------------------------------------------------

    /**
     * table <Name> {
     *   columns ["Col1", "Col2", ...]
     *   row [val1, val2, ...]
     *   ...
     * }
     */
    private parseTableStmt(): TableStmt {
        const kw = this.expect("table");
        const nameTok = this.expectIdent();
        this.expect("LBRACE");

        // -- columns declaration -----------------------------------------------
        this.expect("columns");
        this.expect("LBRACKET");
        const columns: string[] = [];
        if (!this.check("RBRACKET")) {
            columns.push(this.expectString().value);
            while (this.match("COMMA")) {
                // allow trailing comma before ]
                if (this.check("RBRACKET")) break;
                columns.push(this.expectString().value);
            }
        }
        this.expect("RBRACKET");

        // -- rows --------------------------------------------------------------
        const rows: TableRow[] = [];
        while (this.check("row") && !this.isAtEnd()) {
            rows.push(this.parseTableRow());
        }

        this.expect("RBRACE");

        return {
            kind: "TableStmt",
            name: nameTok.value,
            columns,
            rows,
            pos: this.tokenPos(kw),
        };
    }

    private parseTableRow(): TableRow {
        const kw = this.expect("row");
        this.expect("LBRACKET");
        const cells: Expression[] = [];
        if (!this.check("RBRACKET")) {
            cells.push(this.parseExpression());
            while (this.match("COMMA")) {
                if (this.check("RBRACKET")) break;
                cells.push(this.parseExpression());
            }
        }
        this.expect("RBRACKET");

        let actions: Statement[] | undefined;
        if (this.check("LBRACE")) {
            actions = this.parseBlock();
        }

        return { cells, actions, pos: this.tokenPos(kw) };
    }

    // -- Chart statement -------------------------------------------------------

    /**
     * chart <Name> <bar|line|pie|area|scatter> {
     *   series "Label" {
     *     point x, y
     *     ...
     *   }
     *   ...
     * }
     */
    private parseChartStmt(): ChartStmt {
        const kw = this.expect("chart");
        const nameTok = this.expectIdent();

        // Chart type keyword
        const typeTok = this.peek();
        const CHART_TYPES = new Set(["bar", "line", "pie", "area", "scatter"]);
        if (!typeTok || !CHART_TYPES.has(typeTok.type ?? "")) {
            const pos = typeTok ? this.tokenPos(typeTok) : this.currentPos();
            const got = typeTok ? `"${typeTok.value}"` : "end of input";
            throw new ParseError(
                `Expected chart type (bar | line | pie | area | scatter) but got ${got}`,
                pos,
            );
        }
        this.advance();
        const chartType = typeTok.value as ChartType;

        this.expect("LBRACE");
        const seriesList: ChartSeries[] = [];
        while (this.check("series") && !this.isAtEnd()) {
            seriesList.push(this.parseSeriesDecl());
        }
        this.expect("RBRACE");

        return {
            kind: "ChartStmt",
            name: nameTok.value,
            chartType,
            series: seriesList,
            pos: this.tokenPos(kw),
        };
    }

    private parseSeriesDecl(): ChartSeries {
        const kw = this.expect("series");
        const labelTok = this.expectString();
        this.expect("LBRACE");
        const points: ChartPoint[] = [];
        while (this.check("point") && !this.isAtEnd()) {
            points.push(this.parseChartPoint());
        }
        this.expect("RBRACE");
        return { label: labelTok.value, points, pos: this.tokenPos(kw) };
    }

    private parseChartPoint(): ChartPoint {
        const kw = this.expect("point");
        const x = this.parseExpression();
        this.expect("COMMA");
        const y = this.parseExpression();
        return { x, y, pos: this.tokenPos(kw) };
    }

    // ─── Navigation target ────────────────────────────────────────────────────

    /**
     * NavTarget ::= "->" Identifier [ "?" QueryArg { "&" QueryArg } ]
     * QueryArg  ::= Identifier "=" Expression
     */
    private parseNavTarget(): NavTarget {
        const arrowTok = this.expect("ARROW");
        const targetTok = this.expectIdent();

        let queryArgs: QueryArg[] | undefined;

        // Optional query string: `?key=expr&key2=expr2`
        if (this.match("QUESTION")) {
            queryArgs = [];
            queryArgs.push(this.parseQueryArg());
            while (this.match("AMPERSAND")) {
                queryArgs.push(this.parseQueryArg());
            }
        }

        return {
            target: targetTok.value,
            queryArgs: queryArgs?.length ? queryArgs : undefined,
            pos: this.tokenPos(arrowTok),
        };
    }

    private parseQueryArg(): QueryArg {
        const keyTok = this.expectIdent();
        this.expect("ASSIGN");
        const value = this.parseExpression();
        return { key: keyTok.value, value, pos: this.tokenPos(keyTok) };
    }

    // ─── Expressions (operator precedence, left-to-right) ────────────────────
    //
    //  Precedence (lowest → highest):
    //    1. || (binary OR)
    //    2. && (binary AND)
    //    3. == != < > <= >= (comparison)
    //    4. + (additive)
    //    5. primary / unary !

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
        let left = this.parseAdditive();
        const tok = this.peek();
        if (tok && this.COMPARISON_OPS.has(tok.type ?? "")) {
            const opTok = this.advance();
            const operator = this.COMPARISON_OPS.get(opTok.type ?? "")!;
            const right = this.parseAdditive();
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

    /** Handles `+` for expressions like `query.page + 1` in nav query args. */
    private parseAdditive(): Expression {
        let left = this.parseUnary();
        while (this.check("PLUS")) {
            const opTok = this.advance();
            const right = this.parseUnary();
            const expr: BinaryExpr = {
                kind: "BinaryExpr",
                operator: "+",
                left,
                right,
                pos: this.tokenPos(opTok),
            };
            left = expr;
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

        // Identifier or member expression (user.role, query.page, etc.)
        if (tok.type === "IDENT" || tok.type === "query") {
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

    // ─── Literal helper ───────────────────────────────────────────────────────

    /** Parse a bare literal (string, number, boolean). Used in `query` default values. */
    private parseLiteral(): StringLiteral | NumberLiteral | BooleanLiteral {
        const tok = this.peek();
        if (!tok) {
            throw new ParseError("Expected literal but reached end of input", {
                line: 0,
                col: 0,
            });
        }
        if (tok.type === "STRING") {
            this.advance();
            return { kind: "StringLiteral", value: tok.value, pos: this.tokenPos(tok) };
        }
        if (tok.type === "NUMBER") {
            this.advance();
            return { kind: "NumberLiteral", value: parseFloat(tok.value), pos: this.tokenPos(tok) };
        }
        if (tok.type === "true" || tok.type === "false") {
            this.advance();
            return { kind: "BooleanLiteral", value: tok.type === "true", pos: this.tokenPos(tok) };
        }
        throw new ParseError(
            `Expected literal (string, number, or boolean) but got "${tok.value}"`,
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
            // so accept them here; also "query" for member access (query.page)
            [
                "app", "page", "component", "entry", "use", "header", "text",
                "button", "link", "field", "input", "submit", "click", "on", "if",
                "query", "string", "number", "boolean",
                "true", "false", // generally disallowed as ident elsewhere; allowed in outcomes
                // table / chart keywords can appear as names
                "table", "columns", "row",
                "chart", "series", "point",
                "bar", "line", "pie", "area", "scatter",
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
