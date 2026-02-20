// ─────────────────────────────────────────────────────────────────────────────
// SWAN DSL — Semantic Checker
// Enforces static semantic rules SR-1 through SR-9.
// ─────────────────────────────────────────────────────────────────────────────

import {
    SemanticError,
    type ComponentDecl,
    type ConditionalStmt,
    type HandlerStmt,
    type NavTarget,
    type PageDecl,
    type Program,
    type Statement,
} from "./types";

export interface SemanticCheckOptions {
    /** Enable SR-4: all pages must be reachable from the entry page */
    strictMode?: boolean;
}

export function checkSemantics(
    program: Program,
    options: SemanticCheckOptions = {},
): void {
    const checker = new SemanticChecker(program, options);
    checker.check();
}

// ---------------------------------------------------------------------------
// Internal checker class
// ---------------------------------------------------------------------------

class SemanticChecker {
    private readonly pageNames: Set<string>;
    private readonly componentNames: Set<string>;
    /** Map of page name → Set of declared query param names */
    private readonly pageQueryParams: Map<string, Set<string>>;

    constructor(
        private readonly program: Program,
        private readonly options: SemanticCheckOptions,
    ) {
        this.pageNames = new Set(program.pages.map((p) => p.name));
        this.componentNames = new Set(program.components.map((c) => c.name));
        this.pageQueryParams = new Map();

        // Pre-build query param sets for SR-8 and SR-9
        for (const page of program.pages) {
            const paramNames = new Set<string>();
            this.pageQueryParams.set(page.name, paramNames);
        }
    }

    check(): void {
        this.checkSR1andSR2();
        this.checkSR6Names();
        this.checkSR7QueryInPagesOnly();
        this.checkSR8UniqueQueryKeys();
        this.collectAndCheckNavTargets();
        this.checkSR5ComponentCycles();
        if (this.options.strictMode) {
            this.checkSR4Reachability();
        }
    }

    // ─── SR-1 & SR-2 ──────────────────────────────────────────────────────────
    // SR-1: app defines exactly one entry point (guaranteed by grammar)
    // SR-2: entry must reference a page

    private checkSR1andSR2(): void {
        const { app } = this.program;
        // SR-1: grammar forces exactly one entry, but verify it's non-empty
        if (!app.entry || app.entry.trim() === "") {
            throw new SemanticError("SR-1", "app must define an entry page", app.pos);
        }
        // SR-2: entry must be a page
        if (!this.pageNames.has(app.entry)) {
            const hint = this.componentNames.has(app.entry)
                ? ` ("${app.entry}" is a component, not a page)`
                : ` ("${app.entry}" is not defined)`;
            throw new SemanticError(
                "SR-2",
                `entry "${app.entry}" must reference a page${hint}`,
                app.pos,
            );
        }
    }

    // ─── SR-6 ─────────────────────────────────────────────────────────────────
    // Identifiers must be unique within each namespace.

    private checkSR6Names(): void {
        // Pages namespace
        const pagesSeen = new Set<string>();
        for (const page of this.program.pages) {
            if (pagesSeen.has(page.name)) {
                throw new SemanticError(
                    "SR-6",
                    `Duplicate page name "${page.name}"`,
                    page.pos,
                );
            }
            pagesSeen.add(page.name);
        }

        // Components namespace
        const componentsSeen = new Set<string>();
        for (const comp of this.program.components) {
            if (componentsSeen.has(comp.name)) {
                throw new SemanticError(
                    "SR-6",
                    `Duplicate component name "${comp.name}"`,
                    comp.pos,
                );
            }
            componentsSeen.add(comp.name);
        }

        // Actions namespace: action names must be unique per page/component scope
        // (we collect across the whole program for simplicity)
        for (const page of this.program.pages) {
            this.checkActionUniqueness(page.name, page.body);
        }
        for (const comp of this.program.components) {
            this.checkActionUniqueness(comp.name, comp.body);
        }
    }

    private collectActions(stmts: Statement[]): Map<string, number> {
        const actions = new Map<string, number>();
        for (const stmt of stmts) {
            if (stmt.kind === "SubmitStmt" || stmt.kind === "ClickStmt") {
                actions.set(stmt.action, (actions.get(stmt.action) ?? 0) + 1);
            }
            if (stmt.kind === "ConditionalStmt") {
                for (const [k, v] of this.collectActions(stmt.body)) {
                    actions.set(k, (actions.get(k) ?? 0) + v);
                }
            }
        }
        return actions;
    }

    private checkActionUniqueness(scopeName: string, stmts: Statement[]): void {
        const counts = this.collectActions(stmts);
        for (const [action, count] of counts) {
            if (count > 1) {
                throw new SemanticError(
                    "SR-6",
                    `Duplicate action "${action}" in scope "${scopeName}"`,
                );
            }
        }
    }

    // ─── SR-7 ─────────────────────────────────────────────────────────────────
    // `query` statements are only valid inside page blocks, not components.

    private checkSR7QueryInPagesOnly(): void {
        for (const comp of this.program.components) {
            this.assertNoQueryInStatements(comp.name, comp.body);
        }
    }

    private assertNoQueryInStatements(
        scopeName: string,
        stmts: Statement[],
    ): void {
        for (const stmt of stmts) {
            if (stmt.kind === "QueryStmt") {
                throw new SemanticError(
                    "SR-7",
                    `"query" statement is not allowed inside component "${scopeName}" — only pages may declare query parameters`,
                    stmt.pos,
                );
            }
            if (stmt.kind === "ConditionalStmt") {
                this.assertNoQueryInStatements(scopeName, stmt.body);
            }
        }
    }

    // ─── SR-8 ─────────────────────────────────────────────────────────────────
    // Query parameter identifiers must be unique within a page.

    private checkSR8UniqueQueryKeys(): void {
        for (const page of this.program.pages) {
            this.checkQueryKeyUniqueness(page);
        }
    }

    private checkQueryKeyUniqueness(page: PageDecl): void {
        const seen = new Set<string>();
        const paramSet = this.pageQueryParams.get(page.name)!;
        this.collectQueryKeys(page.body, page.name, seen, paramSet);
    }

    private collectQueryKeys(
        stmts: Statement[],
        pageName: string,
        seen: Set<string>,
        paramSet: Set<string>,
    ): void {
        for (const stmt of stmts) {
            if (stmt.kind === "QueryStmt") {
                if (seen.has(stmt.name)) {
                    throw new SemanticError(
                        "SR-8",
                        `Duplicate query parameter "${stmt.name}" in page "${pageName}"`,
                        stmt.pos,
                    );
                }
                seen.add(stmt.name);
                paramSet.add(stmt.name);
            }
            if (stmt.kind === "ConditionalStmt") {
                this.collectQueryKeys(stmt.body, pageName, seen, paramSet);
            }
        }
    }

    // ─── SR-3 ─────────────────────────────────────────────────────────────────
    // All navigation targets must be pages.
    // Also checks SR-9 (query arg keys must match declared params on target page).

    private collectAndCheckNavTargets(): void {
        for (const page of this.program.pages) {
            this.checkNavInStatements(page.body);
        }
        for (const comp of this.program.components) {
            this.checkNavInStatements(comp.body);
        }
    }

    private checkNavInStatements(stmts: Statement[]): void {
        for (const stmt of stmts) {
            this.checkNavInStatement(stmt);
        }
    }

    private checkNavInStatement(stmt: Statement): void {
        switch (stmt.kind) {
            case "ButtonStmt":
            case "LinkStmt":
                this.validateNavTarget(stmt.nav);
                break;
            case "HandlerStmt":
                this.checkHandlerNav(stmt);
                break;
            case "ConditionalStmt":
                this.checkNavInStatements(stmt.body);
                break;
            // SubmitStmt and ClickStmt target actions, not pages directly
            default:
                break;
        }
    }

    private validateNavTarget(nav: NavTarget): void {
        // SR-3: target must be a known page
        if (!this.pageNames.has(nav.target)) {
            const hint = this.componentNames.has(nav.target)
                ? ` ("${nav.target}" is a component, not a page)`
                : ` ("${nav.target}" is not defined)`;
            throw new SemanticError(
                "SR-3",
                `Navigation target "${nav.target}" must be a page${hint}`,
                nav.pos,
            );
        }

        // SR-9: each query arg key must match a declared query param on target page
        if (nav.queryArgs && nav.queryArgs.length > 0) {
            const targetParams = this.pageQueryParams.get(nav.target);
            for (const arg of nav.queryArgs) {
                if (!targetParams || !targetParams.has(arg.key)) {
                    throw new SemanticError(
                        "SR-9",
                        `Navigation query argument "${arg.key}" is not declared as a query parameter on page "${nav.target}"`,
                        arg.pos,
                    );
                }
            }
        }
    }

    private checkHandlerNav(handler: HandlerStmt): void {
        for (const outcome of handler.outcomes) {
            if (!this.pageNames.has(outcome.target)) {
                const hint = this.componentNames.has(outcome.target)
                    ? ` ("${outcome.target}" is a component, not a page)`
                    : ` ("${outcome.target}" is not defined)`;
                throw new SemanticError(
                    "SR-3",
                    `Handler outcome "${outcome.outcome}" targets "${outcome.target}" which must be a page${hint}`,
                    outcome.pos,
                );
            }
        }
    }

    // ─── SR-5 ─────────────────────────────────────────────────────────────────
    // Component composition graph must be acyclic.

    private checkSR5ComponentCycles(): void {
        // Build adjacency list: component -> list of components it uses
        const usesMap = new Map<string, string[]>();
        for (const comp of this.program.components) {
            usesMap.set(comp.name, this.collectUsedComponents(comp.body));
        }

        // Also check that all `use` statements reference defined components
        for (const comp of this.program.components) {
            for (const used of usesMap.get(comp.name) ?? []) {
                if (!this.componentNames.has(used)) {
                    throw new SemanticError(
                        "SR-6",
                        `Component "${comp.name}" uses undefined component "${used}"`,
                        comp.pos,
                    );
                }
            }
        }
        // Pages can also use components — check they exist
        for (const page of this.program.pages) {
            for (const used of this.collectUsedComponents(page.body)) {
                if (!this.componentNames.has(used)) {
                    throw new SemanticError(
                        "SR-6",
                        `Page "${page.name}" uses undefined component "${used}"`,
                        page.pos,
                    );
                }
            }
        }

        // DFS cycle detection
        const visited = new Set<string>();
        const inStack = new Set<string>();

        const dfs = (name: string): void => {
            if (inStack.has(name)) {
                throw new SemanticError(
                    "SR-5",
                    `Cyclic component composition detected: "${name}" is part of a cycle`,
                );
            }
            if (visited.has(name)) return;

            inStack.add(name);
            visited.add(name);

            for (const dep of usesMap.get(name) ?? []) {
                dfs(dep);
            }

            inStack.delete(name);
        };

        for (const name of this.componentNames) {
            dfs(name);
        }
    }

    private collectUsedComponents(stmts: Statement[]): string[] {
        const used: string[] = [];
        for (const stmt of stmts) {
            if (stmt.kind === "UseStmt") {
                used.push(stmt.component);
            }
            if (stmt.kind === "ConditionalStmt") {
                used.push(...this.collectUsedComponents(stmt.body));
            }
        }
        return used;
    }

    // ─── SR-4 (strict mode) ───────────────────────────────────────────────────
    // All pages must be reachable from the entry page.

    private checkSR4Reachability(): void {
        const { app, pages, components } = this.program;

        // Build a page -> reachable pages graph
        const reachable = new Set<string>();
        const queue: string[] = [app.entry];

        // Collect all nav targets from a body
        const navTargetsOf = (stmts: Statement[]): string[] => {
            const targets: string[] = [];
            for (const stmt of stmts) {
                if (stmt.kind === "ButtonStmt" || stmt.kind === "LinkStmt") {
                    targets.push(stmt.nav.target);
                }
                if (stmt.kind === "HandlerStmt") {
                    for (const o of stmt.outcomes) targets.push(o.target);
                }
                if (stmt.kind === "ConditionalStmt") {
                    targets.push(...navTargetsOf(stmt.body));
                }
            }
            return targets;
        };

        // Component bodies contribute nav targets to any page that uses them
        const compNavTargets = new Map<string, string[]>();
        for (const comp of components) {
            compNavTargets.set(comp.name, navTargetsOf(comp.body));
        }

        const pageMap = new Map<string, PageDecl>(pages.map((p) => [p.name, p]));

        while (queue.length > 0) {
            const name = queue.shift()!;
            if (reachable.has(name)) continue;
            reachable.add(name);

            const page = pageMap.get(name);
            if (!page) continue;

            // Direct nav targets
            for (const t of navTargetsOf(page.body)) {
                if (!reachable.has(t)) queue.push(t);
            }

            // Nav targets from used components
            for (const stmt of page.body) {
                if (stmt.kind === "UseStmt") {
                    for (const t of compNavTargets.get(stmt.component) ?? []) {
                        if (!reachable.has(t)) queue.push(t);
                    }
                }
            }
        }

        for (const page of pages) {
            if (!reachable.has(page.name)) {
                throw new SemanticError(
                    "SR-4",
                    `Page "${page.name}" is not reachable from entry "${app.entry}"`,
                    page.pos,
                );
            }
        }
    }
}
