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
  | "button" String [ NavTarget ]
  | "link" String NavTarget
  | "field" Identifier
  | "input" Identifier
  | TableStatement
  | ChartStatement
```

Example:

```dsl
header "Login"
text "Welcome back"
```

---

## 6.7 Table Statement

A `table` statement renders **tabular data** with named columns.

Each row is a fixed-width list of values that must match the declared columns.

```ebnf
TableStatement  ::= "table" Identifier "{" TableColumns TableRows "}"

TableColumns    ::= "columns" "[" ColumnName { "," ColumnName } "]"

ColumnName      ::= String

TableRows       ::= { TableRow }

TableRow        ::= "row" "[" CellValue { "," CellValue } "]" [ Block ]

CellValue       ::= Literal | Expression
```

Example:

table UserList {
  columns ["Name", "Role", "Status", "Actions"]
  row ["Alice", "Admin",  "Active"] {
    button "Edit" -> EditUser?id="Alice"
    button "Delete" // Explains action without navigation
  }
  row ["Bob",   "Viewer", "Inactive"] {
    button "Edit" -> EditUser?id="Bob"
    button "Delete"
  }
}
```

A `TableRow` may optionally be followed by a **block** of statements. This block semantically represents the actions available for that specific row. For instance, it can contain `button`, `submit`, or `click` statements that apply to the record represented by the row.

The table identifier (`UserList`) names the table for semantic checking. It does **not** introduce a navigable scope.

---

## 6.8 Chart Statement

A `chart` statement renders **visual data** using a specified chart type.

Each `series` is a named data sequence. Each `point` is a single `x, y` data pair.

```ebnf
ChartStatement  ::= "chart" Identifier ChartType "{" { SeriesDecl } "}"

ChartType       ::= "bar" | "line" | "pie" | "area" | "scatter"

SeriesDecl      ::= "series" String "{" { DataPoint } "}"

DataPoint       ::= "point" CellValue "," CellValue

CellValue       ::= Literal | Expression
```

| Part           | Required | Description                              |
| -------------- | -------- | ---------------------------------------- |
| Identifier     | Yes      | Chart name (unique within scope)         |
| ChartType      | Yes      | Visual style: bar, line, pie, area, scatter |
| `series` block | Yes (≥1) | Named sequence of data points            |
| `point` x, y  | Yes (≥1) | Single (x, y) coordinate or category    |

Example:

```dsl
chart MonthlySales line {
  series "Revenue" {
    point "Jan", 4200
    point "Feb", 5800
    point "Mar", 7100
  }
  series "Cost" {
    point "Jan", 2100
    point "Feb", 3000
    point "Mar", 3500
  }
}
```

Pie charts use label/value pairs:

```dsl
chart TrafficSource pie {
  series "Sources" {
    point "Organic", 65
    point "Paid",    20
    point "Direct",  15
  }
}
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
button "Save" // Does not navigate
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
* tables (within a page or component block)
* charts (within a page or component block)

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

### SR-10: Table Column Count Consistency

```
Every row in a table must have exactly as many cells
as there are declared columns
```

Example of a violation:

```dsl
table Bad {
  columns ["A", "B", "C"]
  row ["x", "y"]         // error: 2 cells, 3 columns expected
}
```

### SR-11: Table Must Have Columns

```
A table block must declare at least one column
and at least one row
```

### SR-12: Chart Must Have at Least One Series

```
A chart block must contain at least one series declaration
```

### SR-13: Series Must Have at Least One Point

```
Each series block must contain at least one data point
```

### SR-14: Pie Chart Single Series

```
A pie chart may only contain a single series
```

Pie charts represent a whole divided into parts. Multiple series on a pie chart are undefined and rejected.

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

## 10.4 Table Rendering

A table is rendered as a **two-dimensional grid**:

```
Render(Table):
  render header row from columns[]
  for each row:
    render cells left-to-right
```

Cell values are evaluated lazily at render time. If a cell contains an expression, it is resolved against the current scope (`user`, `session`, `env`, `query`).

---

## 10.5 Chart Rendering

A chart is rendered as a **visual data graphic** delegated to the compilation target:

```
Render(Chart):
  resolve all point values
  emit chart type + series data to target backend
```

The DSL does not prescribe pixel layout — that is the responsibility of the compilation target (e.g., React renders a `<Chart>` component; HTML emits a `<canvas>` block).

Point values:

* `x` axis — category label (String) or numeric position (Number)
* `y` axis — numeric value (Number)

For pie charts the `x` value is the **slice label** and `y` is the **slice size**.

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

| Target  | Page / Component Mapping | Table Mapping       | Chart Mapping              |
| ------- | ------------------------ | ------------------- | -------------------------- |
| HTML    | Routes + templates       | `<table>` element   | `<canvas>` + Chart.js      |
| React   | Router + components      | `<Table>` component | `<Chart>` component        |
| Flutter | Navigator + Widgets      | `DataTable` widget  | `fl_chart` widget          |
| SwiftUI | NavigationStack          | `Table` view        | `Swift Charts` view        |

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
  button "Dashboard" -> Dashboard
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

  // Recent users table
  table RecentUsers {
    columns ["Name", "Role", "Last Seen", "Actions"]
    row ["Alice", "Admin",  "2 mins ago"] {
      button "Edit" -> EditUser?id="Alice"
      button "Delete"
    }
    row ["Bob",   "Viewer", "1 hour ago"] {
      button "Edit" -> EditUser?id="Bob"
      button "Delete"
    }
    row ["Carol", "Editor", "Yesterday"] {
      button "Edit" -> EditUser?id="Carol"
      button "Delete"
    }
  }

  // Monthly activity chart
  chart MonthlyLogins line {
    series "Logins" {
      point "Jan", 320
      point "Feb", 410
      point "Mar", 390
      point "Apr", 520
    }
  }

  // Traffic breakdown (pie)
  chart TrafficSource pie {
    series "Sources" {
      point "Organic", 58
      point "Paid",    27
      point "Direct",  15
    }
  }
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
✅ Schema-checked tabular data
✅ Declarative, backend-agnostic charts

---

# 16. Design Philosophy

> Pages are states.
> Components are behavior.
> Flows are explicit.
> Navigation is centralized.
