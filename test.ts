import { parse } from "./src/index";

const EXAMPLE_DSL = `
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

  table RecentUsers {
    columns ["Name", "Role", "Last Seen"]
    row ["Alice", "Admin",  "2 mins ago"]
    row ["Bob",   "Viewer", "1 hour ago"]
    row ["Carol", "Editor", "Yesterday"]
  }

  chart MonthlyLogins line {
    series "Logins" {
      point "Jan", 320
      point "Feb", 410
      point "Mar", 390
      point "Apr", 520
    }
  }

  chart TrafficSource pie {
    series "Sources" {
      point "Organic", 58
      point "Paid",    27
      point "Direct",  15
    }
  }
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
  console.log("Parsed Program:\n" + JSON.stringify(program, null, 2));
}

// main().catch(console.error).finally(() => process.exit(0));
