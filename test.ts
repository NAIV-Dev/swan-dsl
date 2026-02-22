import { parse } from "./src/index";
import { checkSemantics } from "./src/semantic";

const EXAMPLE_DSL = `
app MyApp {
  entry Home
}

page Home {
  header "Welcome"
  button "Log in" -> Login
  button "Search" -> Search?q=""&page=1
  button "Dashboard" -> Dashboard
  button "Help" // non-navigation button
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

  table RecentUsers {
    columns ["Name", "Role", "Last Seen", "Actions"]
    row ["Alice", "Admin",  "2 mins ago"] {
      button "Edit" -> EditUser?id="Alice"
      button "Delete User" // Explains action without navigation
    }
    row ["Bob",   "Viewer", "1 hour ago"] {
      button "Edit" -> EditUser?id="Bob"
      button "Delete User"
    }
  }
}

page EditUser {
  query id : string = ""
  header "Edit User"
  button "Back" -> Dashboard
}

page Search {
  query q      : string  = ""
  query page   : number  = 1
  query active : boolean

  header "Search"
  text "Showing results"

  if query.active == true {
    text "Showing active items only"
  }

  button "Next" -> Search?q=query.q&page=query.page+1
  button "Home" -> Home
}
`.trim();

async function main() {
  const program = parse(EXAMPLE_DSL);
  console.log("Parsed AST successfully.");
  console.log("Home Page Buttons:", program.pages.find(p => p.name === 'Home')?.body.filter(s => s.kind === 'ButtonStmt').map((b: any) => ({ label: b.label, hasNav: !!b.nav })));
  const dashboard = program.pages.find(p => p.name === 'Dashboard');
  const table: any = dashboard?.body.find(s => s.kind === 'TableStmt');
  console.log("Table Row 0 Actions:", table?.rows[0].actions?.map((a: any) => ({ kind: a.kind, label: a.label, hasNav: !!a.nav })));
  
  checkSemantics(program);
  console.log("Semantic check passed successfully.");
}

main().catch(console.error).finally(() => process.exit(0));
