# SWAN DSL — a UI Interaction DSL Full Specification

---

# 1. Purpose

This DSL describes:

> **User interfaces as hierarchical interaction graphs with explicit navigation states.**

It is designed to:

* Model pages, components, and flows
* Separate navigation from interaction
* Enable compilation to web/mobile frameworks
* Support visualization and verification

It is **declarative**, **state-oriented**, and **framework-agnostic**.

---

# 2. Core Concepts

## 2.1 Application

An application is the top-level container.

It defines:

* identity
* entry point
* owned pages and components

```dsl
app MyApp {
  entry Home
}
```

---

## 2.2 Pages (Navigation States)

A `page` represents a **reachable navigation state**.

Properties:

| Property    | Value |
| ----------- | ----- |
| Addressable | Yes   |
| Routable    | Yes   |
| Reusable    | No    |
| Stateful    | Yes   |

Pages:

* may contain UI
* may contain components
* may emit navigation
* may be navigation targets

---

## 2.3 Components (Interaction Units)

A `component` represents a **reusable interaction unit**.

Properties:

| Property    | Value               |
| ----------- | ------------------- |
| Addressable | No                  |
| Routable    | No                  |
| Reusable    | Yes                 |
| Stateful    | No (locally scoped) |

Components:

* may contain components
* may contain logic
* may emit navigation
* may not be targets

---

## 2.4 Navigation

Navigation is the transition between pages.

Only pages may be navigation destinations.

```dsl
-> Dashboard   // valid
-> LoginForm   // invalid
```

Navigation events bubble upward.

---

# 3. Structural Model

```
Application
 ├── Pages (graph nodes)
 └── Components (hierarchical tree)
```

* Pages form a directed graph
* Components form a tree
* Navigation edges connect pages

No cycles restriction is imposed.

---

# 4. Lexical Elements

## 4.1 Identifiers

```
Identifier ::= Letter (Letter | Digit | "_")*
```

Case-sensitive.

---

## 4.2 Literals

### String

```
"Any UTF-8 text"
```

### Number

```
123 | 45.67
```

### Boolean

```
true | false
```

---

# 5. Top-Level Grammar (EBNF)

```ebnf
Program        ::= AppDecl { PageDecl | ComponentDecl }

AppDecl        ::= "app" Identifier "{" "entry" Identifier "}"

PageDecl       ::= "page" Identifier Block

ComponentDecl  ::= "component" Identifier Block

Block          ::= "{" { Statement } "}"

QueryDecl      ::= "query" Identifier [ ":" Type ] [ "=" Literal ]

Type           ::= "string" | "number" | "boolean"
```

---

# 6. Statements

```ebnf
Statement ::=
    UIStatement
  | UseStatement
  | ActionStatement
  | HandlerStatement
  | ConditionalStatement
  | QueryStatement
```

---

## 6.1 UI Statements

```ebnf
UIStatement ::=
    "header" String
  | "text" String
  | "button" String NavTarget
  | "link" String NavTarget
  | "field" Identifier
  | "input" Identifier
```

Example:

```dsl
header "Login"
text "Welcome back"
```

---

## 6.2 Component Composition

```ebnf
UseStatement ::= "use" Identifier
```

Example:

```dsl
use LoginForm
```

---

## 6.3 Actions

Actions represent named interaction events.

```ebnf
ActionStatement ::=
    "submit" String "->" Identifier
  | "click" String "->" Identifier
```

Example:

```dsl
submit "Continue" -> authenticate
```

Here `authenticate` is an action identifier.

---

## 6.4 Event Handlers

Handlers define control flow.

```ebnf
HandlerStatement ::=
  "on" Identifier "{" { OutcomeClause } "}"

OutcomeClause ::=
  Identifier "->" Identifier
```

Example:

```dsl
on authenticate {
  success -> Dashboard
  error   -> LoginError
}
```

---

## 6.5 Conditionals

```ebnf
ConditionalStatement ::=
  "if" Expression Block
```

Example:

```dsl
if user.role == "admin" {
  button "Admin" -> AdminPanel
}
```

---

## 6.6 Page Query Statement

A `query` statement declares a **URL query parameter** accepted by a page.
It maps directly to the query string portion of the URL (e.g. `/search?q=hello&page=2`).

Only valid inside a `page` block — **not** inside components.

```ebnf
QueryStatement ::=
  "query" Identifier [ ":" Type ] [ "=" Literal ]

Type ::= "string" | "number" | "boolean"
```

| Part        | Required | Description                              |
| ----------- | -------- | ---------------------------------------- |
| Identifier  | Yes      | Query parameter key (maps to URL `?key`) |
| `:` Type    | No       | Expected value type (default: `string`)  |
| `=` Literal | No       | Default value when parameter is absent   |

Example:

```dsl
page Search {
  query q              // ?q=<any string>
  query page : number = 1   // ?page=2  (default: 1)
  query active : boolean    // ?active=true

  header "Search Results"
  text "Showing results for query"
}
```

Runtime behaviour:

* Query values are read from the URL on page entry.
* If a parameter is absent and a default is declared, the default is used.
* If a parameter is absent and no default is declared, the value is `null`.
* Query values are available in expressions via the `query` scope:

```dsl
if query.active == true {
  text "Showing active items only"
}
```

---

# 7. Expressions

```ebnf
Expression ::=
  Identifier
| Literal
| Expression Operator Expression
```

Operators:

```
== != < > <= >= && || !
```

Scope:

* `user`
* `session`
* `env`

---

# 8. Navigation Targets

```ebnf
NavTarget    ::= "->" Identifier [ QueryArgs ]

QueryArgs    ::= "?" QueryArg { "&" QueryArg }

QueryArg     ::= Identifier "=" Expression
```

Semantics:

* Identifier must resolve to a `page`
* Resolution is static
* `QueryArgs` are optional; they set query parameter values on the target page
* Each key in `QueryArgs` must match a `query` declaration on the target page

Example:

```dsl
button "Next Page" -> Search?q="hello"&page=2
```

---

# 9. Semantic Rules (Static)

### SR-1: Single Entry Point

```
app must define exactly one entry page
```

### SR-2: Valid Entry

```
entry must reference a page
```

### SR-3: Valid Targets

```
All navigation targets must be pages
```

### SR-4: No Orphan Pages

```
All pages must be reachable from entry
```

(optional strict mode)

### SR-5: No Cyclic Components

```
Component composition graph must be acyclic
```

### SR-6: Unique Names

```
Identifiers are unique per namespace
```

Namespaces:

* pages
* components
* actions

### SR-7: Query in Pages Only

```
query statements are only valid inside page blocks
```

### SR-8: Unique Query Keys

```
Query parameter identifiers must be unique within a page
```

### SR-9: Valid Query Args in Navigation

```
Each key in a navigation QueryArgs list must match
a query declaration on the target page
```

---

# 10. Runtime Semantics

## 10.1 Rendering

Rendering is recursive:

```
Render(Page):
  render local UI
  render used components

Render(Component):
  render UI
  render children
```

---

## 10.2 Event Propagation

1. User triggers event
2. Component handles if defined
3. Otherwise bubbles up
4. Page resolves navigation

---

## 10.3 Navigation Resolution

When a navigation intent occurs:

```
-> TargetPage
```

Runtime:

```
currentPage := TargetPage
re-render
```

State is reset unless persisted.

---

# 11. Flow Semantics

Each action defines a mini-state machine.

Example:

```dsl
submit -> auth

on auth {
  success -> Dashboard
  error -> LoginError
}
```

Equivalent to:

```
Idle → Submitting → {Success, Error}
```

---

# 12. Validation Phases

## Phase 1: Parsing

* Grammar conformance

## Phase 2: Name Resolution

* Link identifiers
* Build symbol tables

## Phase 3: Flow Analysis

* Build navigation graph
* Check reachability

## Phase 4: Type Checking (optional)

* Validate expressions
* Validate fields

---

# 13. Compilation Targets

The DSL is target-independent.

Possible backends:

| Target  | Mapping             |
| ------- | ------------------- |
| HTML    | Routes + templates  |
| React   | Router + components |
| Flutter | Navigator + Widgets |
| SwiftUI | NavigationStack     |

---

# 14. Example (Complete Program)

```dsl
app MyApp {
  entry Home
}

page Home {
  header "Welcome"
  button "Log in" -> Login
  button "Search" -> Search?q=""&page=1
}

component LoginForm {
  field email
  field password

  submit "Continue" -> auth

  on auth {
    success -> Dashboard
    error   -> LoginError
  }
}

page Login {
  header "Login"
  use LoginForm
}

page LoginError {
  text "Invalid credentials"
  button "Retry" -> Login
}

page Dashboard {
  header "Dashboard"
  text "Hello!"
  button "Logout" -> Home
  button "Search Items" -> Search?q=""&page=1
}

page Search {
  query q            : string  = ""
  query page         : number  = 1
  query active       : boolean

  header "Search"
  text "Showing results"

  if query.active == true {
    text "(active items only)"
  }

  button "Next" -> Search?q=query.q&page=query.page+1
  button "Home" -> Home
}
```

---

# 15. Design Guarantees

This DSL guarantees:

✅ Explicit navigation graph
✅ No hidden routes
✅ Predictable composition
✅ Static analyzability
✅ Framework independence
✅ AI-safe generation

---

# 16. Design Philosophy

> Pages are states.
> Components are behavior.
> Flows are explicit.
> Navigation is centralized.
